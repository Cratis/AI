#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Token-ordered validation for the temporary bounded Python parity wrapper."""

from __future__ import annotations

import json


class JsonPreflightError(ValueError):
    """A typed, bounded rejection that never contains input text."""

    def __init__(self, code: str, position: int | None = None, depth: int | None = None) -> None:
        super().__init__(code)
        self.position = position
        self.depth = depth


def validate_json(
    raw: bytes,
    text: str,
    maximum_depth: int,
    maximum_string_scalars: int,
    maximum_structural_tokens: int,
    maximum_array_items: int,
    maximum_object_members: int,
    maximum_safe_integer: int,
) -> None:
    """Apply native preflight ordering before Python materializes the value."""
    structural_overflow_position = _inspect_structure(raw, maximum_depth, maximum_structural_tokens)
    _TokenReader(
        text,
        maximum_string_scalars,
        maximum_array_items,
        maximum_object_members,
        maximum_safe_integer,
    ).validate()
    if structural_overflow_position is not None:
        raise JsonPreflightError("StructuralTokenLimitExceeded", structural_overflow_position)


def _inspect_structure(raw: bytes, maximum_depth: int, maximum_tokens: int) -> int | None:
    depth = 0
    tokens = 0
    in_string = False
    escaped = False
    overflow_position: int | None = None
    for position, value in enumerate(raw):
        if in_string:
            if escaped:
                escaped = False
            elif value == ord("\\"):
                escaped = True
            elif value == ord('"'):
                in_string = False
            continue
        if value == ord('"'):
            in_string = True
        elif value in (ord("{"), ord("[")):
            depth += 1
            tokens += 1
            if depth > maximum_depth:
                raise JsonPreflightError("NestingTooDeep", position, depth)
        elif value in (ord("}"), ord("]"), ord(","), ord(":")):
            tokens += 1
            if value in (ord("}"), ord("]")):
                depth -= 1
        if tokens > maximum_tokens and overflow_position is None:
            overflow_position = position
    return overflow_position


class _TokenReader:
    def __init__(
        self,
        text: str,
        maximum_string_scalars: int,
        maximum_array_items: int,
        maximum_object_members: int,
        maximum_safe_integer: int,
    ) -> None:
        self._text = text
        self._position = 0
        self._depth = 0
        self._maximum_string_scalars = maximum_string_scalars
        self._maximum_array_items = maximum_array_items
        self._maximum_object_members = maximum_object_members
        self._maximum_safe_integer = maximum_safe_integer

    def validate(self) -> None:
        self._skip_whitespace()
        self._read_value()
        self._skip_whitespace()
        if self._position != len(self._text):
            self._malformed()

    def _read_value(self) -> None:
        self._skip_whitespace()
        value = self._peek()
        if value == "{":
            self._read_object()
        elif value == "[":
            self._read_array()
        elif value == '"':
            self._read_string()
        elif value == "t":
            self._read_literal("true")
        elif value == "f":
            self._read_literal("false")
        elif value == "n":
            self._read_literal("null")
        elif value == "-" or value in "0123456789":
            self._read_number()
        else:
            self._malformed()

    def _read_object(self) -> None:
        self._position += 1
        self._depth += 1
        self._skip_whitespace()
        if self._consume("}"):
            self._depth -= 1
            return
        keys: set[str] = set()
        member_count = 0
        while True:
            if self._peek() != '"':
                self._malformed()
            key_position = self._position
            key = self._read_string()
            self._skip_whitespace()
            if not self._consume(":"):
                self._malformed()
            member_count += 1
            if member_count > self._maximum_object_members:
                self._reject("ObjectMemberLimitExceeded", key_position, self._depth)
            if key in keys:
                self._reject("DuplicateObjectKey", key_position, self._depth)
            keys.add(key)
            self._read_value()
            self._skip_whitespace()
            if self._consume("}"):
                self._depth -= 1
                return
            if not self._consume(","):
                self._malformed()
            self._skip_whitespace()

    def _read_array(self) -> None:
        self._position += 1
        self._depth += 1
        self._skip_whitespace()
        if self._consume("]"):
            self._depth -= 1
            return
        item_count = 0
        while True:
            item_position = self._position
            if not self._is_value_start(self._peek()):
                self._malformed()
            item_count += 1
            if item_count > self._maximum_array_items:
                self._reject("ArrayItemLimitExceeded", item_position, self._depth)
            self._read_value()
            self._skip_whitespace()
            if self._consume("]"):
                self._depth -= 1
                return
            if not self._consume(","):
                self._malformed()
            self._skip_whitespace()

    def _read_string(self) -> str:
        start = self._position
        self._position += 1
        while self._position < len(self._text):
            value = self._text[self._position]
            if value == '"':
                self._position += 1
                try:
                    decoded = json.loads(self._text[start:self._position])
                except (UnicodeError, json.JSONDecodeError) as error:
                    raise ValueError("MalformedJson") from error
                self._validate_string(decoded, start)
                return decoded
            if ord(value) < 0x20:
                self._malformed()
            if value == "\\":
                self._position += 1
                if self._position >= len(self._text):
                    self._malformed()
                escape = self._text[self._position]
                if escape == "u":
                    hexadecimal = self._text[self._position + 1:self._position + 5]
                    if len(hexadecimal) != 4 or any(character not in "0123456789abcdefABCDEF" for character in hexadecimal):
                        self._malformed()
                    self._position += 5
                    continue
                if escape not in '"\\/bfnrt':
                    self._malformed()
            self._position += 1
        self._malformed()

    def _validate_string(self, value: str, position: int) -> None:
        if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
            self._reject("InvalidUnicodeScalar", position, self._depth)
        if len(value) > self._maximum_string_scalars:
            self._reject("StringTooLong", position)

    def _read_number(self) -> None:
        start = self._position
        self._consume("-")
        if self._consume("0"):
            pass
        elif self._peek() in "123456789":
            self._read_digits()
        else:
            self._malformed()
        unsupported = False
        if self._consume("."):
            unsupported = True
            if self._peek() not in "0123456789":
                self._malformed()
            self._read_digits()
        if self._peek() in "eE":
            unsupported = True
            self._position += 1
            if self._peek() in "+-":
                self._position += 1
            if self._peek() not in "0123456789":
                self._malformed()
            self._read_digits()
        if unsupported:
            self._reject("UnsupportedNumber", start, self._depth)
        number = self._text[start:self._position]
        digits = number[1:] if number.startswith("-") else number
        if len(digits) > 16 or abs(int(number)) > self._maximum_safe_integer:
            self._reject("IntegerOutOfRange", start, self._depth)

    def _read_digits(self) -> None:
        while self._peek() in "0123456789":
            self._position += 1

    def _read_literal(self, literal: str) -> None:
        if not self._text.startswith(literal, self._position):
            self._malformed()
        self._position += len(literal)

    def _skip_whitespace(self) -> None:
        while self._peek() in " \t\r\n":
            self._position += 1

    def _peek(self) -> str:
        return self._text[self._position] if self._position < len(self._text) else "\0"

    def _consume(self, expected: str) -> bool:
        if self._peek() != expected:
            return False
        self._position += 1
        return True

    @staticmethod
    def _is_value_start(value: str) -> bool:
        return value in '{["-tfn0123456789'

    def _malformed(self) -> None:
        self._reject("MalformedJson", self._position, self._depth)

    def _reject(self, code: str, position: int, depth: int | None = None) -> None:
        byte_position = len(self._text[:position].encode("utf-8"))
        raise JsonPreflightError(code, byte_position, depth)
