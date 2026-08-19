#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Canonical JSON and content hashing for immutable Factory definitions."""

from __future__ import annotations

import hashlib
import json
from typing import Any

MAXIMUM_SAFE_INTEGER = 9_007_199_254_740_991


class CanonicalJsonError(ValueError):
    """Raised when a value cannot be represented by Factory canonical JSON v1."""


def canonical_json(value: Any) -> str:
    """Serialize a value using the deterministic Factory canonical JSON v1 subset."""
    _reject_unsupported_values(value, "$")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def content_hash(value: Any) -> str:
    """Return a SHA-256 content identifier for a canonical JSON value."""
    digest = hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def bytes_content_hash(value: bytes) -> str:
    """Return a SHA-256 content identifier for an immutable byte sequence."""
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _reject_unsupported_values(value: Any, location: str) -> None:
    if isinstance(value, float):
        raise CanonicalJsonError(f"{location}: floating-point numbers are not supported")
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        if value < -MAXIMUM_SAFE_INTEGER or value > MAXIMUM_SAFE_INTEGER:
            raise CanonicalJsonError(f"{location}: integer exceeds the cross-runtime safe range")
        return
    if isinstance(value, str):
        _validate_unicode(value, location)
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _reject_unsupported_values(item, f"{location}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise CanonicalJsonError(f"{location}: object keys must be strings")
            _validate_unicode(key, location)
            _reject_unsupported_values(item, f"{location}.{key}")
        return
    raise CanonicalJsonError(f"{location}: unsupported value type {type(value).__name__}")


def _validate_unicode(value: str, location: str) -> None:
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        raise CanonicalJsonError(f"{location}: lone Unicode surrogate code points are not supported")
