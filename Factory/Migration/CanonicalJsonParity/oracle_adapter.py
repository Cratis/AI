#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Temporary, line-oriented adapter around the Stage 0 canonical JSON oracle."""

from __future__ import annotations

import base64
import binascii
import hmac
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

MAXIMUM_REQUEST_LINE_CHARACTERS = 2_667_200


def _load_module(path: Path, name: str) -> ModuleType:
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError("The migration module could not be loaded")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def _calculate_self_hash(oracle: ModuleType, value: Any, field: str) -> str | None:
    return (
        oracle.content_hash({key: item for key, item in value.items() if key != field})
        if isinstance(value, dict)
        else None
    )


def _verify_self_hash(oracle: ModuleType, value: Any, field: str) -> dict[str, Any]:
    calculated = _calculate_self_hash(oracle, value, field)
    if calculated is None:
        return {"calculated": None, "declared": None, "verificationStatus": "RootNotObject"}
    declared = value.get(field)
    if field not in value:
        status = "Missing"
        declared = None
    elif not isinstance(declared, str) or not _is_sha256(declared):
        status = "Malformed"
        declared = None
    elif hmac.compare_digest(declared, calculated):
        status = "Verified"
    else:
        status = "Mismatch"
    return {"calculated": calculated, "declared": declared, "verificationStatus": status}


def _is_sha256(value: str) -> bool:
    if len(value) != 71 or not value.startswith("sha256:"):
        return False
    return all(character in "0123456789abcdef" for character in value[7:])


def _evaluate_once(
    raw: bytes,
    self_hash_field: str | None,
    mode: str | None,
    oracle: ModuleType,
    bounds: ModuleType,
) -> dict[str, Any]:
    try:
        value = bounds.parse_bounded_json(raw)
        canonical = oracle.canonical_json(value).encode("utf-8")
        if len(canonical) > bounds.MAXIMUM_CANONICAL_BYTES:
            raise ValueError("CanonicalOutputTooLarge")
        whole_hash = oracle.content_hash(value)
        result: dict[str, Any] = {
            "accepted": True,
            "canonicalBase64": base64.b64encode(canonical).decode("ascii"),
            "canonicalByteLength": len(canonical),
            "canonicalHash": whole_hash,
            "byteHash": oracle.bytes_content_hash(raw),
        }
        if self_hash_field is not None:
            if mode == "calculate":
                calculated = _calculate_self_hash(oracle, value, self_hash_field)
                if calculated is None:
                    result["calculationError"] = "RootNotObject"
                else:
                    result["selfHash"] = {
                        "calculated": calculated,
                        "declared": None,
                        "verificationStatus": None,
                    }
            else:
                result["selfHash"] = _verify_self_hash(oracle, value, self_hash_field)
        return result
    except ValueError as error:
        error_code = str(error)
        if error_code not in {
            "ArrayItemLimitExceeded",
            "ByteOrderMarkNotAllowed",
            "CanonicalOutputTooLarge",
            "DuplicateObjectKey",
            "InputTooLarge",
            "IntegerOutOfRange",
            "InvalidUnicodeScalar",
            "MalformedJson",
            "MalformedUtf8",
            "NestingTooDeep",
            "ObjectMemberLimitExceeded",
            "StringTooLong",
            "StructuralTokenLimitExceeded",
            "UnsupportedNumber",
            "invalid-migration-request",
        }:
            oracle_error = str(error).lower()
            if "integer exceeds" in oracle_error:
                error_code = "IntegerOutOfRange"
            elif "floating-point" in oracle_error:
                error_code = "UnsupportedNumber"
            elif "surrogate" in oracle_error:
                error_code = "InvalidUnicodeScalar"
            else:
                error_code = "oracle-failure"
        result = {"accepted": False, "errorCode": error_code}
        position = getattr(error, "position", None)
        depth = getattr(error, "depth", None)
        if position is not None:
            result["position"] = position
        if depth is not None:
            result["depth"] = depth
        return result
    except Exception:
        return {"accepted": False, "errorCode": "oracle-failure"}


def _evaluate(request: Any, oracle: ModuleType, bounds: ModuleType) -> dict[str, Any]:
    try:
        if not isinstance(request, dict):
            raise ValueError("invalid-migration-request")
        encoded = request.get("inputBase64")
        repeat_count = request.get("repeatCount", 2)
        self_hash_field = request.get("selfHashField")
        mode = request.get("mode")
        if (
            not isinstance(encoded, str)
            or not isinstance(repeat_count, int)
            or repeat_count < 2
            or repeat_count > 100
        ):
            raise ValueError("invalid-migration-request")
        if self_hash_field not in {None, "contentHash", "requestHash"}:
            raise ValueError("invalid-migration-request")
        if mode not in {None, "calculate", "verify"}:
            raise ValueError("invalid-migration-request")
        if (self_hash_field is None) != (mode is None):
            raise ValueError("invalid-migration-request")
        maximum_base64_characters = ((bounds.MAXIMUM_INPUT_BYTES + 3) // 3 * 4) + 4
        if len(encoded) > maximum_base64_characters:
            raise ValueError("invalid-migration-request")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise ValueError("invalid-migration-request") from error
    except ValueError:
        return {"accepted": False, "errorCode": "invalid-migration-request"}

    first = _evaluate_once(raw, self_hash_field, mode, oracle, bounds)
    repeat_deterministic = all(
        _evaluate_once(raw, self_hash_field, mode, oracle, bounds) == first
        for _ in range(repeat_count - 1)
    )
    return {**first, "repeatDeterministic": repeat_deterministic}


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] != "--oracle":
        print(json.dumps({"accepted": False, "errorCode": "invalid-migration-request"}, separators=(",", ":")))
        return 2

    try:
        oracle = _load_module(Path(sys.argv[2]).resolve(strict=True), "factory_canonical_json_oracle")
        bounds = _load_module(Path(__file__).with_name("bounded_json.py"), "factory_bounded_json")
    except Exception:
        print(json.dumps({"accepted": False, "errorCode": "oracle-load-failure"}, separators=(",", ":")))
        return 2

    while True:
        line = sys.stdin.readline(MAXIMUM_REQUEST_LINE_CHARACTERS + 1)
        if not line:
            break
        if len(line) > MAXIMUM_REQUEST_LINE_CHARACTERS:
            while line and not line.endswith("\n"):
                line = sys.stdin.readline(MAXIMUM_REQUEST_LINE_CHARACTERS + 1)
            print(
                json.dumps({"accepted": False, "errorCode": "invalid-migration-request"}, separators=(",", ":")),
                flush=True,
            )
            continue
        try:
            request = json.loads(line)
        except (UnicodeError, json.JSONDecodeError):
            response = {"accepted": False, "errorCode": "invalid-migration-request"}
        else:
            response = _evaluate(request, oracle, bounds)
        print(json.dumps(response, ensure_ascii=True, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
