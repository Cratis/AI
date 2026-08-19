#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Adversarial specifications for cross-runtime compiler contracts and its public boundary."""

from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import canonical_json
import compile_factory
import operation_result
from test_validate_factory import compile_fixture, load_documents
import validate_factory


class CrossRuntimeNumericContractTests(unittest.TestCase):
    def test_every_contract_integer_has_finite_cross_runtime_bounds(self) -> None:
        for path in sorted(validate_factory.CONTRACTS.glob("*.schema.json")):
            document = validate_factory.load_json(path)
            for location, value in integer_contracts(document):
                with self.subTest(schema=path.name, location=location):
                    self.assertIn("minimum", value)
                    self.assertIn("maximum", value)
                    self.assertGreaterEqual(
                        value["minimum"],
                        -canonical_json.MAXIMUM_SAFE_INTEGER,
                    )
                    self.assertLessEqual(
                        value["maximum"],
                        canonical_json.MAXIMUM_SAFE_INTEGER,
                    )

    def test_unsafe_compiled_ordinal_is_rejected_before_canonical_hashing(self) -> None:
        compiled = compile_fixture(load_documents())
        compiled["orderedPhases"][0]["ordinal"] = canonical_json.MAXIMUM_SAFE_INTEGER + 1

        with (
            mock.patch.object(
                compile_factory.canonical_json,
                "content_hash",
                side_effect=AssertionError("canonical hashing was reached"),
            ),
            self.assertRaises(compile_factory.CompilationCanonicalFailure),
        ):
            compile_factory.verify_compiled_workflow_hash(compiled)

    def test_compiled_and_harness_phase_ranges_are_aligned(self) -> None:
        documents = load_documents()
        compiled_schema = next(
            document
            for document in documents.values()
            if document.get("$id") == compile_factory.COMPILED_WORKFLOW_SCHEMA
        )
        workflow_schema = next(
            document
            for document in documents.values()
            if document.get("$id") == "https://schemas.cratis.io/factory/v1/workflow.schema.json"
        )
        harness_schema = next(
            document
            for document in documents.values()
            if document.get("$id") == "https://schemas.cratis.io/factory/v1/harness-request.schema.json"
        )

        self.assertEqual(4096, workflow_schema["properties"]["phases"]["maxItems"])
        self.assertEqual(4096, compiled_schema["properties"]["orderedPhases"]["maxItems"])
        self.assertEqual(4095, compiled_schema["$defs"]["compiledPhase"]["properties"]["ordinal"]["maximum"])
        self.assertEqual(4095, harness_schema["properties"]["phase"]["properties"]["ordinal"]["maximum"])

    def test_ordinal_schema_rejects_unsafe_negative_boolean_and_float_values(self) -> None:
        documents = load_documents()
        for ordinal in (
            canonical_json.MAXIMUM_SAFE_INTEGER + 1,
            -1,
            True,
            1.5,
        ):
            compiled = compile_fixture(documents)
            compiled["orderedPhases"][0]["ordinal"] = ordinal
            with self.subTest(ordinal=ordinal):
                if ordinal > canonical_json.MAXIMUM_SAFE_INTEGER:
                    with (
                        mock.patch.object(
                            compile_factory,
                            "_reject_unsafe_compiled_ordinals",
                            return_value=None,
                        ),
                        self.assertRaises(compile_factory.CompilationFailure),
                    ):
                        compile_factory._validate_compiled_workflow(compiled, documents)
                else:
                    with self.assertRaises(compile_factory.CompilationFailure):
                        compile_factory._validate_compiled_workflow(compiled, documents)


class CompilerPublicBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.compiled = compile_fixture(load_documents())

    def test_success_is_one_typed_envelope_with_format_independent_request_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "compiled.json"
            second_path = Path(temporary_directory) / "same-bytes-different-path.json"
            plan_bytes = json.dumps(self.compiled).encode("utf-8")
            plan.write_bytes(plan_bytes)
            second_path.write_bytes(plan_bytes)
            pretty = run_compiler("--verify-plan", str(plan), "--format", "json")
            compact = run_compiler("--verify-plan", str(second_path), "--format", "json-compact")
            text = run_compiler("--verify-plan", str(plan), "--format", "text")
            plan.write_bytes(plan_bytes + b"\n")
            changed_bytes = run_compiler("--verify-plan", str(plan), "--format", "json-compact")

        self.assertEqual(0, pretty.returncode, pretty.stderr)
        self.assertEqual(0, compact.returncode, compact.stderr)
        self.assertEqual(0, text.returncode, text.stderr)
        pretty_envelope = json.loads(pretty.stdout)
        compact_envelope = json.loads(compact.stdout)
        changed_envelope = json.loads(changed_bytes.stdout)
        self.assertEqual(pretty_envelope, compact_envelope)
        self.assertNotEqual(pretty_envelope["requestHash"], changed_envelope["requestHash"])
        self.assertEqual("verify", compact_envelope["operation"])
        self.assertEqual("success", compact_envelope["status"])
        self.assertEqual(
            compile_factory.COMPILED_WORKFLOW_SCHEMA,
            compact_envelope["result"]["schemaId"],
        )
        self.assertIn(f"Request hash: {compact_envelope['requestHash']}", text.stdout)
        self.assertIn("Status: success", text.stdout)
        operation_result.verify_operation_result_hash(compact_envelope)

    def test_direct_compilation_remains_disabled_with_typed_recovery(self) -> None:
        with mock.patch.object(
            compile_factory.validate_factory,
            "all_json_files",
            side_effect=AssertionError("definitions were loaded"),
        ):
            exit_code, stdout, stderr = invoke_direct_disabled()
        envelope = json.loads(stdout)

        self.assertEqual(operation_result.exit_code_for_status("invalid"), exit_code)
        self.assertEqual("", stderr)
        self.assertEqual("FACTORY-COMPILER-DIRECT-DISABLED", envelope["diagnostics"][0]["code"])
        self.assertEqual("use-authoritative-preflight", envelope["nextActions"][0]["id"])

    def test_malformed_external_plan_is_invalid_and_path_opaque(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "customer-identity" / "malformed-plan.json"
            plan.parent.mkdir()
            plan.write_text("{", encoding="utf-8")
            process, envelope = run_json_compiler("--verify-plan", str(plan))

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertEqual("FACTORY-COMPILER-INPUT-INVALID", envelope["diagnostics"][0]["code"])
        self.assertNotIn("customer-identity", process.stdout)
        self.assertNotIn(str(plan), process.stdout)
        self.assertNotIn("Traceback", process.stdout)

    def test_outer_hash_tamper_is_an_integrity_error(self) -> None:
        tampered = deepcopy(self.compiled)
        tampered["contentHash"] = f"sha256:{'0' * 64}"
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "tampered.json"
            plan.write_text(json.dumps(tampered), encoding="utf-8")
            process, envelope = run_json_compiler("--verify-plan", str(plan))

        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), process.returncode)
        self.assertEqual("FACTORY-COMPILER-HASH-MISMATCH", envelope["diagnostics"][0]["code"])
        self.assertEqual("supply-untampered-compiled-plan", envelope["nextActions"][0]["id"])

    def test_nested_hash_tampering_is_detected_after_outer_rehash(self) -> None:
        mutations = {
            "repository-snapshot": lambda value: value["repositoryBinding"]["repositorySnapshot"].__setitem__(
                "contentHash", f"sha256:{'0' * 64}"
            ),
            "resolved-profile": lambda value: value["repositoryBinding"]["resolvedProfile"].__setitem__(
                "contentHash", f"sha256:{'0' * 64}"
            ),
            "effective-policy": lambda value: value["effectivePolicy"].__setitem__(
                "contentHash", f"sha256:{'0' * 64}"
            ),
        }
        for label, mutate in mutations.items():
            tampered = deepcopy(self.compiled)
            mutate(tampered)
            tampered["contentHash"] = canonical_json.content_hash(
                {key: value for key, value in tampered.items() if key != "contentHash"}
            )
            with self.subTest(binding=label), tempfile.TemporaryDirectory() as temporary_directory:
                plan = Path(temporary_directory) / "nested-tamper.json"
                plan.write_text(json.dumps(tampered), encoding="utf-8")
                process, envelope = run_json_compiler("--verify-plan", str(plan))
            self.assertEqual(operation_result.exit_code_for_status("integrity-error"), process.returncode)
            self.assertEqual("FACTORY-COMPILER-HASH-MISMATCH", envelope["diagnostics"][0]["code"])

    def test_parsed_schema_invalid_plan_is_invalid(self) -> None:
        invalid = deepcopy(self.compiled)
        invalid.pop("workflow")
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "schema-invalid.json"
            plan.write_text(json.dumps(invalid), encoding="utf-8")
            process, envelope = run_json_compiler("--verify-plan", str(plan))

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("FACTORY-COMPILER-INPUT-INVALID", envelope["diagnostics"][0]["code"])

    def test_self_hashed_deterministic_tamper_is_an_integrity_error(self) -> None:
        tampered = deepcopy(self.compiled)
        tampered["compilerVersion"] = "0.2.0"
        tampered["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in tampered.items() if key != "contentHash"}
        )
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "deterministic-tamper.json"
            plan.write_text(json.dumps(tampered), encoding="utf-8")
            process, envelope = run_json_compiler("--verify-plan", str(plan))

        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), process.returncode)
        self.assertEqual("FACTORY-COMPILER-INTEGRITY-INVALID", envelope["diagnostics"][0]["code"])
        self.assertEqual("supply-deterministic-compiled-plan", envelope["nextActions"][0]["id"])

    def test_unsafe_ordinal_is_a_canonical_invalid_public_failure(self) -> None:
        unsafe = deepcopy(self.compiled)
        unsafe["orderedPhases"][0]["ordinal"] = canonical_json.MAXIMUM_SAFE_INTEGER + 1
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "unsafe.json"
            plan.write_text(json.dumps(unsafe), encoding="utf-8")
            process, envelope = run_json_compiler("--verify-plan", str(plan))

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("FACTORY-COMPILER-CANONICAL-INVALID", envelope["diagnostics"][0]["code"])

    def test_unknown_control_bearing_argument_is_one_safe_invocation_envelope(self) -> None:
        process = run_compiler("--format", "json-compact", "--bad\x1b[2J-option")

        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertNotIn("\x1b", process.stdout)
        self.assertNotIn("Traceback", process.stdout)
        envelope = json.loads(process.stdout)
        self.assertEqual("FACTORY-COMPILER-INVOCATION-INVALID", envelope["diagnostics"][0]["code"])
        operation_result.verify_operation_result_hash(envelope)

    def test_invocation_errors_never_echo_private_argument_values(self) -> None:
        private_value = "/private/customer-identity/internal.json\x1b[2J"
        unknown = run_compiler("--format", "json-compact", f"--bad={private_value}")
        invalid_format = run_compiler("--format", private_value)

        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), unknown.returncode)
        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), invalid_format.returncode)
        for process in (unknown, invalid_format):
            self.assertEqual("", process.stderr)
            self.assertNotIn("customer-identity", process.stdout)
            self.assertNotIn("\x1b", process.stdout)
            self.assertNotIn("Traceback", process.stdout)

    def test_machine_failures_are_single_projection_invariant_envelopes(self) -> None:
        canonical_invalid = deepcopy(self.compiled)
        canonical_invalid["orderedPhases"][0]["ordinal"] = canonical_json.MAXIMUM_SAFE_INTEGER + 1
        hash_invalid = deepcopy(self.compiled)
        hash_invalid["contentHash"] = f"sha256:{'0' * 64}"
        integrity_invalid = deepcopy(self.compiled)
        integrity_invalid["compilerVersion"] = "0.2.0"
        integrity_invalid["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in integrity_invalid.items() if key != "contentHash"}
        )
        schema_invalid = deepcopy(self.compiled)
        schema_invalid.pop("workflow")
        cases = (
            (canonical_invalid, "invalid", "FACTORY-COMPILER-CANONICAL-INVALID"),
            (hash_invalid, "integrity-error", "FACTORY-COMPILER-HASH-MISMATCH"),
            (integrity_invalid, "integrity-error", "FACTORY-COMPILER-INTEGRITY-INVALID"),
            (schema_invalid, "invalid", "FACTORY-COMPILER-INPUT-INVALID"),
        )
        for document, status, code in cases:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as temporary_directory:
                plan = Path(temporary_directory) / "plan.json"
                plan.write_text(json.dumps(document), encoding="utf-8")
                pretty = run_compiler("--verify-plan", str(plan), "--format", "json")
                compact = run_compiler("--verify-plan", str(plan), "--format", "json-compact")
            self.assertEqual("", pretty.stderr)
            self.assertEqual("", compact.stderr)
            pretty_envelope = json.loads(pretty.stdout)
            compact_envelope = json.loads(compact.stdout)
            self.assertEqual(pretty_envelope, compact_envelope)
            self.assertEqual(status, compact_envelope["status"])
            self.assertEqual(code, compact_envelope["diagnostics"][0]["code"])
            operation_result.verify_operation_result_hash(compact_envelope)

    def test_unexpected_failure_is_generic_path_opaque_and_projection_equivalent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            plan = Path(temporary_directory) / "compiled.json"
            plan.write_text(json.dumps(self.compiled), encoding="utf-8")
            outputs = {
                output_format: invoke_main(
                    plan,
                    output_format,
                    RuntimeError("/private/customer-identity/internal.json\x1b[2J"),
                )
                for output_format in ("text", "json", "json-compact")
            }

        pretty = json.loads(outputs["json"][1])
        compact = json.loads(outputs["json-compact"][1])
        self.assertEqual(pretty, compact)
        self.assertEqual("unexpected", compact["status"])
        self.assertEqual("FACTORY-COMPILER-UNEXPECTED", compact["diagnostics"][0]["code"])
        self.assertIn(f"Request hash: {compact['requestHash']}", outputs["text"][1])
        for exit_code, stdout, stderr in outputs.values():
            self.assertEqual(operation_result.exit_code_for_status("unexpected"), exit_code)
            self.assertEqual("", stderr)
            self.assertNotIn("customer-identity", stdout)
            self.assertNotIn("\x1b", stdout)
            self.assertNotIn("Traceback", stdout)


def integer_contracts(value: object, location: str = "$") -> list[tuple[str, dict]]:
    found: list[tuple[str, dict]] = []
    if isinstance(value, dict):
        if value.get("type") == "integer":
            found.append((location, value))
        for key, child in value.items():
            found.extend(integer_contracts(child, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(integer_contracts(child, f"{location}[{index}]"))
    return found


def run_compiler(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(validate_factory.ROOT / "Factory/scripts/compile_factory.py"), *arguments],
        cwd=validate_factory.ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def run_json_compiler(*arguments: str) -> tuple[subprocess.CompletedProcess[str], dict]:
    process = run_compiler(*arguments, "--format", "json-compact")
    envelope = json.loads(process.stdout)
    operation_result.verify_operation_result_hash(envelope)
    return process, envelope


def invoke_direct_disabled() -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    with (
        mock.patch.object(sys, "argv", ["compile_factory.py", "--format", "json-compact"]),
        redirect_stdout(stdout),
        redirect_stderr(stderr),
    ):
        exit_code = compile_factory.main()
    return exit_code, stdout.getvalue(), stderr.getvalue()


def invoke_main(plan: Path, output_format: str, error: Exception) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    with (
        mock.patch.object(
            sys,
            "argv",
            [
                "compile_factory.py",
                "--verify-plan",
                str(plan),
                "--format",
                output_format,
            ],
        ),
        mock.patch.object(
            compile_factory,
            "verify_compiled_workflow_integrity",
            side_effect=error,
        ),
        redirect_stdout(stdout),
        redirect_stderr(stderr),
    ):
        exit_code = compile_factory.main()
    return exit_code, stdout.getvalue(), stderr.getvalue()


if __name__ == "__main__":
    unittest.main()
