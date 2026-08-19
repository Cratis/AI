#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Accessibility conformance specifications for public Factory command output."""

from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
import json
import os
import pty
import re
import subprocess
import sys
import textwrap
import unicodedata
import unittest
from unittest import mock

import operation_result
import resolve_factory
import validate_factory


FIXTURE_NAMES = (
    "arc-only",
    "arc-react-mvvm",
    "components-framework",
    "components-missing-peer",
    "contracts-only",
    "elixir-client",
    "golden-stack",
    "jvm-client",
    "typescript-client",
    "unknown",
    "workspace-monorepo",
)
DETAIL_LEVELS = ("summary", "explain", "trace")

# A rendered line either IS the free-form operation summary sentence (checked separately by
# equality) or it OPENS with the name of the fact it carries. Four shapes exist in the wild,
# tuned against every fixture at every detail level plus validate/blocked/invalid output
# (see the module docstring of test_public_command_accessibility for the tuning evidence):
#   1. "Label:" / "Label [qualifier]:" / "Label (qualifier):" / "Label word:" — the dominant
#      shape ("Operation:", "Status:", "Not selected (application):",
#      "Diagnostic [CODE] warning:", "Next action [id] (kind, automation):"). The qualifier
#      alternatives may repeat and combine (bracket, then parenthetical, then a bare lowercase
#      qualifying word) because production combines them in exactly that order.
#   2. "profile-id [status] — " — the indented "Complete profile match rationale" bullets open
#      with the profile's own kebab-case identifier (the fact being carried is *which* profile),
#      not a capitalized label, followed by its outcome in brackets and an em dash.
#   3. "field=value" — the indented evidence-trace bullets are semicolon-joined field lists
#      ("kind=dependency; source=...; value=..."); the leading field name is still the opening
#      "name of the fact", just spelled with "=" instead of ":".
#   4. "input …" / "correct …" — the indented next-action detail sub-lines in the inspection
#      renderer name the fact (which input, what to correct) before the value, without a colon.
LABEL_LINE_PATTERN = re.compile(
    r"^(?: {2})*(?:"
    r"[A-Z][A-Za-z /]*(?: \[[^\]]+\]| \([^)]+\)| [a-z][a-z-]*)*:"
    r"|[a-z][a-z0-9-]* \[[a-z-]+\] — "
    r"|[a-z]+=\S"
    r"|(?:input|correct) \S"
    r")"
)
COLUMNAR_PADDING_PATTERN = re.compile(r"\S {3,}\S")
ANSI_CSI_PATTERN = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
DECORATIVE_SYMBOL_RANGE_START = 0x2500  # box drawing / block elements / geometric shapes / dingbats
EMOJI_RANGE_START = 0x1F000


class PublicCommandAccessibilityTests(unittest.TestCase):
    """Accessibility conformance specifications for public Factory command output."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.golden_repo = str(
            validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        )
        cls.fixture_repo = {
            fixture: str(validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / fixture)
            for fixture in FIXTURE_NAMES
        }
        cls.fixture_text: dict[str, dict[str, subprocess.CompletedProcess[str]]] = {}
        cls.fixture_envelope: dict[str, dict] = {}
        for fixture, repository in cls.fixture_repo.items():
            texts = {
                detail: run_command(
                    "resolve_factory.py",
                    "--repository",
                    repository,
                    "--format",
                    "text",
                    "--detail",
                    detail,
                )
                for detail in DETAIL_LEVELS
            }
            cls.fixture_text[fixture] = texts
            _process, envelope = run_json_command("resolve_factory.py", "--repository", repository)
            cls.fixture_envelope[fixture] = envelope

        cls.validate_text = run_command("validate_factory.py", "--format", "text")
        _process, cls.validate_envelope = run_json_command("validate_factory.py")

        cls.blocked_text = run_command(
            "resolve_factory.py",
            "--repository",
            cls.golden_repo,
            "--purpose",
            "unsupported",
            "--format",
            "text",
        )
        _process, cls.blocked_envelope = run_json_command(
            "resolve_factory.py",
            "--repository",
            cls.golden_repo,
            "--purpose",
            "unsupported",
        )

        cls.invalid_text = run_command(
            "resolve_factory.py",
            "--repository",
            cls.golden_repo,
            "--target",
            "..",
            "--format",
            "text",
        )
        _process, cls.invalid_envelope = run_json_command(
            "resolve_factory.py",
            "--repository",
            cls.golden_repo,
            "--target",
            "..",
        )

        cls.samples: list[tuple[str, str, str]] = []
        for fixture in FIXTURE_NAMES:
            summary = cls.fixture_envelope[fixture]["summary"]
            for detail in DETAIL_LEVELS:
                cls.samples.append(
                    (f"{fixture}:{detail}", cls.fixture_text[fixture][detail].stdout, summary)
                )
        cls.samples.append(("validate:text", cls.validate_text.stdout, cls.validate_envelope["summary"]))
        cls.samples.append(("blocked:text", cls.blocked_text.stdout, cls.blocked_envelope["summary"]))
        cls.samples.append(("invalid:text", cls.invalid_text.stdout, cls.invalid_envelope["summary"]))

    # 1-3: presentation environment must never change the rendered human text.

    def test_human_text_is_byte_identical_regardless_of_color_environment(self) -> None:
        variants: tuple[dict[str, str | None], ...] = (
            {"NO_COLOR": "1"},
            {"NO_COLOR": ""},
            {"FORCE_COLOR": "3"},
            {"CLICOLOR_FORCE": "1"},
            {"CLICOLOR": "0"},
        )
        self._assert_environment_does_not_change_output(variants)

    def test_human_text_is_byte_identical_regardless_of_terminal_type(self) -> None:
        variants: tuple[dict[str, str | None], ...] = (
            {"TERM": "dumb"},
            {"TERM": "xterm-256color"},
            {"TERM": ""},
            {"TERM": None},
        )
        self._assert_environment_does_not_change_output(variants)

    def test_human_text_is_byte_identical_regardless_of_declared_terminal_width(self) -> None:
        variants: tuple[dict[str, str | None], ...] = (
            {"COLUMNS": "40"},
            {"COLUMNS": "200"},
        )
        self._assert_environment_does_not_change_output(variants)

    def _assert_environment_does_not_change_output(
        self,
        variants: tuple[dict[str, str | None], ...],
    ) -> None:
        commands = (
            ("resolve_factory.py", ("--repository", self.golden_repo, "--format", "text")),
            ("validate_factory.py", ("--format", "text")),
        )
        baselines = {script: run_command(script, *arguments) for script, arguments in commands}
        for script, baseline in baselines.items():
            self.assertEqual("", baseline.stderr)
        for variant in variants:
            for script, arguments in commands:
                with self.subTest(variant=variant, script=script):
                    baseline = baselines[script]
                    process = run_with_environment(script, variant, *arguments)
                    self.assertEqual(baseline.returncode, process.returncode)
                    self.assertEqual("", process.stderr)
                    self.assertEqual(baseline.stdout, process.stdout)

    # 4: no public command may emit a terminal control/escape sequence, on any code path.

    def test_no_public_command_emits_a_terminal_escape_sequence(self) -> None:
        for label, text, _summary in self.samples:
            with self.subTest(sample=label):
                self.assertNotIn("\x1b", text)
                self.assertNotIn("\x07", text)
                self.assertNotIn("\x9b", text)
                self.assertIsNone(ANSI_CSI_PATTERN.search(text))

    # 5: output must be identical whether standard output is a pipe or a real terminal device.

    def test_output_is_identical_on_a_terminal_and_on_a_pipe(self) -> None:
        arguments = ("--repository", self.golden_repo, "--format", "text")
        piped = run_command("resolve_factory.py", *arguments)
        self.assertEqual("", piped.stderr)

        pty_output = self._run_via_pty("resolve_factory.py", *arguments)
        self.assertEqual(piped.stdout, pty_output.replace("\r\n", "\n"))

    def _run_via_pty(self, script: str, *arguments: str) -> str:
        master_fd, slave_fd = pty.openpty()
        slave_open = True
        try:
            process = subprocess.Popen(
                [sys.executable, str(validate_factory.ROOT / "Factory" / "scripts" / script), *arguments],
                cwd=validate_factory.ROOT,
                stdin=subprocess.DEVNULL,
                stdout=slave_fd,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
            os.close(slave_fd)
            slave_open = False
            chunks: list[bytes] = []
            while True:
                try:
                    chunk = os.read(master_fd, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
            process.wait(timeout=30)
        finally:
            if slave_open:
                os.close(slave_fd)
            os.close(master_fd)
        return b"".join(chunks).decode("utf-8")

    # 6: status, diagnostics, side effects, and next actions must be readable as literal words,
    # never signalled only by an icon, colour, or other decorative presentation.

    def test_no_state_is_signalled_only_by_presentation(self) -> None:
        for fixture in FIXTURE_NAMES:
            with self.subTest(fixture=fixture):
                envelope = self.fixture_envelope[fixture]
                text = self.fixture_text[fixture]["summary"].stdout

                self.assertIn(f"Status: {envelope['status']}", text)
                for diagnostic in envelope["diagnostics"]:
                    self.assertIn(diagnostic["code"], text)
                expected_side_effects = "yes" if envelope["sideEffectsOccurred"] else "no"
                self.assertIn(f"Side effects occurred: {expected_side_effects}", text)
                for action in envelope["nextActions"]:
                    self.assertIn(action["id"], text)
                    self.assertIn(action["kind"], text)

                self._assert_no_decorative_symbols(text)

    def _assert_no_decorative_symbols(self, text: str) -> None:
        for character in text:
            codepoint = ord(character)
            if codepoint <= 0x7F:
                # Plain ASCII punctuation ('=', '+', '<', '>', '$', ...) is literal data — it
                # shows up legitimately inside version ranges ("react + arc.react") and
                # key=value evidence fields. Unicode classifies it as a "Symbol" category for
                # historical/technical reasons, not because it is a decorative icon a screen
                # reader would announce as a picture rather than a character.
                continue
            is_symbol_category = unicodedata.category(character).startswith("S")
            is_decorative_range = (
                DECORATIVE_SYMBOL_RANGE_START <= codepoint <= 0x27BF or codepoint >= EMOJI_RANGE_START
            )
            self.assertFalse(
                is_symbol_category or is_decorative_range,
                f"decorative symbol U+{codepoint:04X} ({character!r}) found in text output",
            )

    # 7: every line opens with the name of the fact it carries; no line is padded into columns.

    def test_every_text_line_opens_with_the_name_of_the_fact_it_carries(self) -> None:
        for label, text, summary in self.samples:
            for line in text.splitlines():
                if not line:
                    continue
                with self.subTest(sample=label, line=line):
                    self.assertIsNone(COLUMNAR_PADDING_PATTERN.search(line))
                    if line == summary:
                        continue
                    self.assertRegex(line, LABEL_LINE_PATTERN)

    # 8: material facts (what happened, what to do about it) precede bookkeeping (hashes,
    # side-effect confirmation) in reading order.

    def test_material_facts_precede_bookkeeping_in_reading_order(self) -> None:
        for label, text, _summary in self.samples:
            with self.subTest(sample=label):
                operation_index = _first_line_start_index(text, ("Operation:",))
                status_index = _first_line_start_index(text, ("Status:",))
                self.assertIsNotNone(operation_index)
                self.assertIsNotNone(status_index)
                self.assertLess(operation_index, status_index)

                diagnostic_index = _first_line_start_index(text, ("Blocker [", "Diagnostic ["))
                if diagnostic_index is not None:
                    self.assertLess(status_index, diagnostic_index)

                side_effects_index = _first_line_start_index(text, ("Side effects occurred:",))
                self.assertIsNotNone(side_effects_index)
                next_index = _last_line_start_index(text, "Next ")
                if next_index is not None:
                    self.assertLess(next_index, side_effects_index)

                request_hash_index = _first_line_start_index(text, ("Request hash:",))
                if request_hash_index is not None:
                    self.assertLess(side_effects_index, request_hash_index)

    # 9: for commands whose text is a bounded status report, the default rendering fits a
    # standard 24-line terminal screen at 80 columns. This is deliberately NOT "every public
    # command" — evaluate_factory.py and preflight_factory.py are excluded on purpose, not by
    # oversight: evaluate's default run is 43 visual lines (its "Catalog case IDs:" line alone
    # is 1153 characters, wrapping to 15 lines by itself), and preflight's success path is 33
    # visual lines measured across 8 fixtures. Both exceed 24 by design, because those commands
    # project a complete inventory rather than a status summary — a bounded text envelope is a
    # property of specific commands, not of every public command, per
    # Documentation/Factory/contracts-and-interfaces.md. Extending this test to cover evaluate or
    # preflight would fail on correct output and would be frozen feature work under issue #67.

    def test_default_text_of_bounded_commands_fits_a_standard_terminal_screen(self) -> None:
        samples = (
            ("validate --format text", self.validate_text.stdout),
            ("inspect --purpose unsupported", self.blocked_text.stdout),
            ("inspect --target ..", self.invalid_text.stdout),
            ("inspect --repository unknown", self.fixture_text["unknown"]["summary"].stdout),
        )
        for label, text in samples:
            with self.subTest(sample=label):
                self.assertLessEqual(visual_lines(text, 80), 24)

    # 10: --detail explain/trace only ever add to --detail summary; nothing material disappears.

    def test_progressive_detail_never_drops_a_material_fact(self) -> None:
        for fixture in FIXTURE_NAMES:
            with self.subTest(fixture=fixture):
                summary_text = self.fixture_text[fixture]["summary"].stdout
                explain_text = self.fixture_text[fixture]["explain"].stdout
                trace_text = self.fixture_text[fixture]["trace"].stdout

                summary_lines = visual_lines(summary_text)
                explain_lines = visual_lines(explain_text)
                trace_lines = visual_lines(trace_text)
                self.assertLessEqual(summary_lines, explain_lines)
                self.assertLessEqual(explain_lines, trace_lines)

                for diagnostic in self.fixture_envelope[fixture]["diagnostics"]:
                    code = diagnostic["code"]
                    self.assertIn(code, summary_text)
                    self.assertIn(code, explain_text)
                    self.assertIn(code, trace_text)

    # 11: no public command, in any status or format, writes anything to standard error.

    def test_no_public_command_writes_to_standard_error(self) -> None:
        for output_format in ("text", "json", "json-compact"):
            with self.subTest(command="inspect", status="success", format=output_format):
                process = run_command(
                    "resolve_factory.py", "--repository", self.golden_repo, "--format", output_format
                )
                self.assertEqual("", process.stderr)

            with self.subTest(command="inspect", status="blocked", format=output_format):
                process = run_command(
                    "resolve_factory.py",
                    "--repository",
                    self.golden_repo,
                    "--purpose",
                    "unsupported",
                    "--format",
                    output_format,
                )
                self.assertEqual("", process.stderr)

            with self.subTest(command="inspect", status="invalid", format=output_format):
                process = run_command(
                    "resolve_factory.py",
                    "--repository",
                    self.golden_repo,
                    "--target",
                    "..",
                    "--format",
                    output_format,
                )
                self.assertEqual("", process.stderr)

            with self.subTest(command="inspect", status="invocation-error", format=output_format):
                process = run_command(
                    "resolve_factory.py",
                    "--repository",
                    self.golden_repo,
                    "--not-a-real-flag",
                    "--format",
                    output_format,
                )
                self.assertEqual("", process.stderr)

            with self.subTest(command="validate", status="success", format=output_format):
                process = run_command("validate_factory.py", "--format", output_format)
                self.assertEqual("", process.stderr)

            with self.subTest(command="validate", status="invalid", format=output_format):
                # validate_factory.py's CLI can only ever reach success/invalid/unexpected — its
                # own _validation_failure_envelope() never constructs a "blocked" status, so
                # "blocked" is exercised only for inspect above. "invalid" itself is unreachable
                # through a real subprocess against this repository's own (valid) definitions, so
                # it is driven the same way the sibling envelope specs drive it: in-process, with
                # validate_documents() made to return findings, capturing real stdout/stderr.
                _exit_code, _stdout, stderr = _invoke_validate_main_with_mocked_documents(
                    output_format, ["Factory/Profiles/example.profile.json: invalid profile"]
                )
                self.assertEqual("", stderr)

            with self.subTest(command="validate", status="invocation-error", format=output_format):
                process = run_command("validate_factory.py", "--not-a-real-flag", "--format", output_format)
                self.assertEqual("", process.stderr)


def _first_line_start_index(text: str, prefixes: tuple[str, ...]) -> int | None:
    position = 0
    for line in text.splitlines(keepends=True):
        if line.startswith(prefixes):
            return position
        position += len(line)
    return None


def _last_line_start_index(text: str, prefix: str) -> int | None:
    position = 0
    last_match: int | None = None
    for line in text.splitlines(keepends=True):
        if line.startswith(prefix):
            last_match = position
        position += len(line)
    return last_match


def _invoke_validate_main_with_mocked_documents(
    output_format: str,
    errors: list[str],
) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    with (
        mock.patch.object(sys, "argv", ["validate_factory.py", "--format", output_format]),
        mock.patch.object(validate_factory, "validate_documents", return_value=errors),
        redirect_stdout(stdout),
        redirect_stderr(stderr),
    ):
        exit_code = validate_factory.main()
    return exit_code, stdout.getvalue(), stderr.getvalue()


def visual_lines(text: str, width: int = 80) -> int:
    """Count how many terminal rows a block of text occupies once wrapped at ``width``."""
    return sum(max(1, len(textwrap.wrap(line, width=width))) for line in text.splitlines())


def run_with_environment(
    script: str,
    env_overrides: dict[str, str | None],
    *arguments: str,
) -> subprocess.CompletedProcess[str]:
    """Run a public command with specific environment variables set, emptied, or removed."""
    environment = os.environ.copy()
    for key, value in env_overrides.items():
        if value is None:
            environment.pop(key, None)
        else:
            environment[key] = value
    return subprocess.run(
        [
            sys.executable,
            str(validate_factory.ROOT / "Factory" / "scripts" / script),
            *arguments,
        ],
        cwd=validate_factory.ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
        env=environment,
    )


def run_command(script: str, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(validate_factory.ROOT / "Factory" / "scripts" / script),
            *arguments,
        ],
        cwd=validate_factory.ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def run_json_command(script: str, *arguments: str) -> tuple[subprocess.CompletedProcess[str], dict]:
    process = run_command(script, *arguments, "--format", "json-compact")
    envelope = json.loads(process.stdout)
    operation_result.verify_operation_result_hash(envelope)
    return process, envelope


if __name__ == "__main__":
    unittest.main()
