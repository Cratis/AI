#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""New bounded parsing contract around the temporary unbounded value oracle."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType
from typing import Any

MAXIMUM_INPUT_BYTES = 2_000_000
MAXIMUM_CANONICAL_BYTES = 2_000_000
MAXIMUM_NESTING_DEPTH = 64
MAXIMUM_STRING_SCALARS = 1_000_000
MAXIMUM_STRUCTURAL_TOKENS = 100_000
MAXIMUM_ARRAY_ITEMS = 99_999
MAXIMUM_OBJECT_MEMBERS = 49_999
MAXIMUM_SAFE_INTEGER = 9_007_199_254_740_991


class BoundedJsonError(ValueError):
    """A typed envelope rejection with bounded metadata only."""

    def __init__(self, code: str, position: int | None = None, depth: int | None = None) -> None:
        super().__init__(code)
        self.position = position
        self.depth = depth


def _load_preflight() -> ModuleType:
    path = Path(__file__).with_name("json_preflight.py")
    specification = importlib.util.spec_from_file_location("factory_json_preflight", path)
    if specification is None or specification.loader is None:
        raise RuntimeError("The bounded JSON preflight could not be loaded")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


_preflight = _load_preflight()


def parse_bounded_json(raw: bytes) -> Any:
    """Parse the newly bounded version 1 domain without reflecting input in errors."""
    if len(raw) > MAXIMUM_INPUT_BYTES:
        raise BoundedJsonError("InputTooLarge", MAXIMUM_INPUT_BYTES)
    if raw.startswith(b"\xef\xbb\xbf"):
        raise BoundedJsonError("ByteOrderMarkNotAllowed", 0)
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise BoundedJsonError("MalformedUtf8", error.start) from error

    _preflight.validate_json(
        raw,
        text,
        MAXIMUM_NESTING_DEPTH,
        MAXIMUM_STRING_SCALARS,
        MAXIMUM_STRUCTURAL_TOKENS,
        MAXIMUM_ARRAY_ITEMS,
        MAXIMUM_OBJECT_MEMBERS,
        MAXIMUM_SAFE_INTEGER,
    )
    try:
        value = json.loads(
            text,
            object_pairs_hook=_duplicate_object,
            parse_int=_parse_integer,
            parse_float=_unsupported_number,
            parse_constant=_malformed_constant,
        )
    except ValueError as error:
        if str(error) in {"DuplicateObjectKey", "IntegerOutOfRange", "MalformedJson", "UnsupportedNumber"}:
            raise
        raise ValueError("MalformedJson") from error
    return value


def _duplicate_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("DuplicateObjectKey")
        result[key] = value
    return result


def _malformed_constant(_: str) -> None:
    raise ValueError("MalformedJson")


def _unsupported_number(_: str) -> None:
    raise ValueError("UnsupportedNumber")


def _parse_integer(value: str) -> int:
    digits = value[1:] if value.startswith("-") else value
    if len(digits) > 16:
        raise ValueError("IntegerOutOfRange")
    parsed = int(value)
    if parsed < -MAXIMUM_SAFE_INTEGER or parsed > MAXIMUM_SAFE_INTEGER:
        raise ValueError("IntegerOutOfRange")
    return parsed
