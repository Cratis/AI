#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Adversarial specifications for control-safe public Factory command projections."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import operation_result
import validate_factory


# C0/C1 terminal controls that a correct guard has always rejected. Every
# character below is written as a Python escape, never as a literal glyph,
# so this source file stays pure ASCII and cannot be mangled in transport.
_ASCII_CONTROL_CASES = (
    ("U+0000 NUL", "\x00"),
    ("U+0007 BEL", "\x07"),
    ("U+009B CSI (8-bit form)", "\x9b"),
)

# The full Unicode Bidi_Control character set: U+061C plus U+200E-U+200F,
# U+202A-U+202E, and U+2066-U+2069. operation_result._TERMINAL_CONTROL and
# _TYPED_VALUE_CONTROL both name every one of these explicitly.
_BIDI_CONTROL_CASES = (
    ("U+061C ARABIC LETTER MARK", "\u061c"),
    ("U+200E LEFT-TO-RIGHT MARK", "\u200e"),
    ("U+200F RIGHT-TO-LEFT MARK", "\u200f"),
    ("U+202A LEFT-TO-RIGHT EMBEDDING", "\u202a"),
    ("U+202B RIGHT-TO-LEFT EMBEDDING", "\u202b"),
    ("U+202C POP DIRECTIONAL FORMATTING", "\u202c"),
    ("U+202D LEFT-TO-RIGHT OVERRIDE", "\u202d"),
    ("U+202E RIGHT-TO-LEFT OVERRIDE", "\u202e"),
    ("U+2066 LEFT-TO-RIGHT ISOLATE", "\u2066"),
    ("U+2067 RIGHT-TO-LEFT ISOLATE", "\u2067"),
    ("U+2068 FIRST STRONG ISOLATE", "\u2068"),
    ("U+2069 POP DIRECTIONAL ISOLATE", "\u2069"),
)

# Invisible zero-width format characters (Unicode category Cf) that are
# neither C0/C1 controls nor part of Bidi_Control.
_ZERO_WIDTH_FORMAT_CASES = (
    ("U+200B ZERO WIDTH SPACE", "\u200b"),
    ("U+200D ZERO WIDTH JOINER", "\u200d"),
    ("U+FEFF ZERO WIDTH NO-BREAK SPACE", "\ufeff"),
)

# Real terminal-injection payloads built from already-covered control bytes.
_ESCAPE_SEQUENCE_CASES = (
    ("ESC CSI clear-screen", "\x1b[2J"),
    ("OSC 8 hyperlink", "\x1b]8;;http://x\x07"),
)

# Unicode line/paragraph separators: the established hole. Neither is a
# member of Unicode category C, so unicodedata.category(c).startswith("C")
# never matches them, and neither appears in the operation_result regexes.
_LINE_PARAGRAPH_SEPARATOR_CASES = (
    ("U+2028 LINE SEPARATOR", "\u2028"),
    ("U+2029 PARAGRAPH SEPARATOR", "\u2029"),
)

# Every single-character payload a correct guard must reject, used against
# both the public command surface and the public operation_result builders.
_ALL_SINGLE_CHARACTER_CASES = (
    _ASCII_CONTROL_CASES
    + _BIDI_CONTROL_CASES
    + _ZERO_WIDTH_FORMAT_CASES
    + _LINE_PARAGRAPH_SEPARATOR_CASES
)

# Every payload (single characters and multi-character escape sequences)
# exercised against the command-line surface.
_ALL_COMMAND_LINE_CASES = (
    _ASCII_CONTROL_CASES
    + _ESCAPE_SEQUENCE_CASES
    + _BIDI_CONTROL_CASES
    + _ZERO_WIDTH_FORMAT_CASES
)

_TYPED_RESULT_SCHEMA = "https://schemas.cratis.io/factory/v1/factory-objective.schema.json"


class PublicCommandControlSafetyTests(unittest.TestCase):
    """Adversarial specifications for control-safe public Factory command projections."""

    def test_control_and_bidirectional_characters_never_reach_any_projection(self) -> None:
        for label, payload in _ALL_COMMAND_LINE_CASES:
            for script in ("resolve_factory.py", "validate_factory.py"):
                for output_format in ("text", "json", "json-compact"):
                    with self.subTest(character=label, script=script, format=output_format):
                        self._assert_payload_never_reaches_projection(label, payload, script, output_format)

    def test_unicode_line_and_paragraph_separators_never_reach_any_projection(self) -> None:
        for label, payload in _LINE_PARAGRAPH_SEPARATOR_CASES:
            for script in ("resolve_factory.py", "validate_factory.py"):
                for output_format in ("text", "json", "json-compact"):
                    with self.subTest(character=label, script=script, format=output_format):
                        self._assert_payload_never_reaches_projection(label, payload, script, output_format)

    def test_one_diagnostic_is_exactly_one_line_in_the_text_projection(self) -> None:
        ascii_process = run_command(
            "resolve_factory.py", "--format", "text", "--unknown\x07value"
        )
        ascii_line_count = len(ascii_process.stdout.decode("utf-8").splitlines())
        for label, payload in _LINE_PARAGRAPH_SEPARATOR_CASES:
            with self.subTest(character=label):
                hostile_process = run_command(
                    "resolve_factory.py", "--format", "text", f"--unknown{payload}value"
                )
                hostile_line_count = len(hostile_process.stdout.decode("utf-8").splitlines())
                self.assertEqual(
                    ascii_line_count,
                    hostile_line_count,
                    f"one diagnostic must render as one text line for {label} "
                    f"just as it does for an ASCII control character",
                )

    def test_machine_json_carries_no_unescaped_javascript_line_terminator(self) -> None:
        for script in ("resolve_factory.py", "validate_factory.py"):
            for output_format in ("json", "json-compact"):
                with self.subTest(script=script, format=output_format):
                    process = run_command(
                        script,
                        "--format",
                        output_format,
                        "--unknown\u2028\u2029value",
                    )
                    self.assertNotIn(b"\xe2\x80\xa8", process.stdout)
                    self.assertNotIn(b"\xe2\x80\xa9", process.stdout)

    def test_the_diagnostic_builder_rejects_every_character_the_renderer_must_not_emit(self) -> None:
        for label, character in _ALL_SINGLE_CHARACTER_CASES:
            with self.subTest(character=label):
                with self.assertRaises(operation_result.OperationResultError):
                    operation_result.make_diagnostic(
                        "FACTORY-TEST-HOSTILE",
                        "error",
                        f"hostile{character}value",
                        "not-retryable",
                        "reason",
                    )

    def test_the_typed_result_builder_rejects_every_character_the_renderer_must_not_emit(self) -> None:
        for label, character in _ALL_SINGLE_CHARACTER_CASES:
            with self.subTest(character=label):
                value = {
                    "protocolVersion": "1",
                    "objective": f"hostile{character}value",
                    "targetPath": "Source",
                    "classification": "public",
                    "constraints": ["none"],
                }
                with self.assertRaises(operation_result.OperationResultError):
                    operation_result.make_typed_result(_TYPED_RESULT_SCHEMA, value)

    def test_unicode_line_and_paragraph_separators_reach_the_diagnostic_through_manifest_policy_content(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as raw_repository_root:
            repository_root = Path(raw_repository_root)
            cratis_directory = repository_root / ".cratis"
            cratis_directory.mkdir(parents=True, exist_ok=True)
            manifest_path = cratis_directory / "factory.json"

            for label, payload in _LINE_PARAGRAPH_SEPARATOR_CASES:
                manifest = {
                    "schemaVersion": "1",
                    "documentKind": "project-manifest",
                    "profiles": {"include": [], "exclude": []},
                    "workflows": {},
                    "policy": {"id": f"hostile{payload}policy", "denyCapabilities": []},
                }
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

                for output_format in ("text", "json", "json-compact"):
                    with self.subTest(character=label, format=output_format):
                        process = run_command(
                            "resolve_factory.py",
                            "--repository",
                            str(repository_root),
                            "--format",
                            output_format,
                        )
                        self.assertNotIn(payload.encode("utf-8"), process.stdout)
                        self.assertEqual(b"", process.stderr)
                        self.assertEqual(
                            operation_result.exit_code_for_status("invalid"),
                            process.returncode,
                        )
                        if output_format in ("json", "json-compact"):
                            envelope = json.loads(process.stdout.decode("utf-8"))
                            operation_result.verify_operation_result_hash(envelope)

    def _assert_payload_never_reaches_projection(
        self,
        label: str,
        payload: str,
        script: str,
        output_format: str,
    ) -> None:
        try:
            process = run_command(script, "--format", output_format, f"--unknown{payload}value")
        except ValueError as error:
            self.skipTest(f"argv cannot carry {label}: {error}")
            return
        self.assertNotIn(payload.encode("utf-8"), process.stdout)
        self.assertEqual(b"", process.stderr)
        self.assertEqual(
            operation_result.exit_code_for_status("invocation-error"),
            process.returncode,
        )
        if output_format in ("json", "json-compact"):
            envelope = json.loads(process.stdout.decode("utf-8"))
            operation_result.verify_operation_result_hash(envelope)


def run_command(script: str, *arguments: str) -> subprocess.CompletedProcess[bytes]:
    """Run a public Factory command capturing raw, undecoded bytes."""
    return subprocess.run(
        [
            sys.executable,
            str(validate_factory.ROOT / "Factory" / "scripts" / script),
            *arguments,
        ],
        cwd=validate_factory.ROOT,
        check=False,
        capture_output=True,
        text=False,
        timeout=30,
    )


def run_json_command(script: str, *arguments: str) -> tuple[subprocess.CompletedProcess[bytes], dict]:
    """Run a public Factory command and parse its json-compact projection."""
    process = run_command(script, *arguments, "--format", "json-compact")
    envelope = json.loads(process.stdout.decode("utf-8"))
    operation_result.verify_operation_result_hash(envelope)
    return process, envelope


if __name__ == "__main__":
    unittest.main()
