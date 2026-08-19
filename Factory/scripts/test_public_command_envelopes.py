#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Integration specifications for public Factory inspect and definition validation commands."""

from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest
from unittest import mock

import operation_result
import resolve_factory
import validate_factory


class PublicCommandEnvelopeTests(unittest.TestCase):
    def test_resolver_success_is_the_same_typed_fact_in_every_projection(self) -> None:
        arguments = (
            "--repository",
            "Factory/Fixtures/Ecosystems/golden-stack",
        )

        envelope, text = self._assert_subprocess_projections("resolve_factory.py", arguments, 0)

        self.assertEqual("inspect", envelope["operation"])
        self.assertEqual("success", envelope["status"])
        self.assertFalse(envelope["sideEffectsOccurred"])
        self.assertEqual(
            "https://schemas.cratis.io/factory/v1/resolved-profile.schema.json",
            envelope["result"]["schemaId"],
        )
        self.assertEqual("application", envelope["result"]["value"]["repositoryMode"])
        self.assertIn(
            f"target {envelope['result']['value']['targetPath']}",
            text,
        )
        self.assertIn("application-cratis-components", text)
        self.assertIn("repository-investigator", text)

    def test_resolver_text_progressively_explains_every_ecosystem_fixture(self) -> None:
        fixture_root = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems"
        fixtures = sorted(path for path in fixture_root.iterdir() if path.is_dir())

        for fixture in fixtures:
            with self.subTest(fixture=fixture.name):
                process, envelope = run_json_command(
                    "resolve_factory.py",
                    "--repository",
                    str(fixture),
                )
                self.assertIn(
                    process.returncode,
                    {
                        operation_result.exit_code_for_status("success"),
                        operation_result.exit_code_for_status("blocked"),
                    },
                )
                result = envelope["result"]["value"]
                projections = {}
                for detail in ("summary", "explain", "trace"):
                    projection = run_command(
                        "resolve_factory.py",
                        "--repository",
                        str(fixture),
                        "--format",
                        "text",
                        "--detail",
                        detail,
                    )
                    self.assertEqual(process.returncode, projection.returncode, projection.stderr)
                    self.assertEqual("", projection.stderr)
                    self.assertNotIn("\x1b", projection.stdout)
                    projections[detail] = projection.stdout

                summary = projections["summary"]
                self.assertLessEqual(len(summary.splitlines()), 24)
                visual_lines = sum(
                    max(1, len(textwrap.wrap(line, width=80)))
                    for line in summary.splitlines()
                )
                self.assertLessEqual(visual_lines, 24)
                self.assertIn(f"target {result['targetPath']}", summary)
                self.assertIn(f"{result['repositoryMode']} mode", summary)
                self.assertIn(f"purpose {result['purpose']}", summary)
                self.assertNotIn("Request hash:", summary)
                self.assertNotIn("Content hash:", summary)
                self.assertNotIn("Result hash:", summary)
                self.assertNotIn("Request hash:", projections["explain"])

                surface_evidence = [
                    evidence
                    for evidence in result["evidence"]
                    if evidence["kind"] in {"dependency", "repository-package"}
                ]
                if surface_evidence:
                    for evidence in surface_evidence:
                        self.assertIn(
                            f"{resolve_factory._surface_name(evidence['ecosystem'], evidence['value'])} "
                            f"{evidence['version']}",
                            summary,
                        )
                repository_evidence = [
                    evidence for evidence in result["evidence"] if evidence["kind"] == "repository"
                ]
                for evidence in repository_evidence:
                    self.assertIn(evidence["value"], summary)
                if not surface_evidence and not repository_evidence:
                    self.assertIn("Detected surfaces: none.", summary)
                for capability, label in (
                    ("dotnet", ".NET/C#"),
                    ("typescript", "TypeScript"),
                    ("jvm", "Java/Kotlin"),
                    ("elixir", "Elixir"),
                    ("react", "React UI"),
                ):
                    if capability in result["capabilities"]:
                        self.assertIn(label, summary)
                for profile in result["profiles"]:
                    self.assertIn(profile["id"], summary)
                    self.assertIn(
                        resolve_factory._compact_selected_profile_reason(profile["id"]),
                        summary,
                    )
                self.assertIn("Important exclusions:", summary)
                self.assertIn(
                    resolve_factory._summary_exclusion_line(result),
                    summary,
                )
                selected_ids = {profile["id"] for profile in result["profiles"]}
                for match in result["matches"]:
                    self.assertIn(match["profileId"], projections["explain"])
                    for reason in match["reasons"]:
                        self.assertIn(reason, projections["explain"])
                for agent in result["agents"]:
                    self.assertIn(f"agent {agent['id']} — {agent['rationale']}", summary)
                for workflow in result["workflows"]:
                    self.assertIn(
                        f"workflow {workflow['id']} — {workflow['rationale']}",
                        summary,
                    )
                for diagnostic in envelope["diagnostics"]:
                    self.assertIn(f"Blocker [{diagnostic['code']}]:", summary)
                    self.assertIn(diagnostic["message"], summary)
                if envelope["nextActions"]:
                    for action in envelope["nextActions"]:
                        self.assertIn(
                            f"Next [{action['id']}; {action['kind']}; "
                            f"{action['automation']}]",
                            summary,
                        )
                        self.assertIn(action["title"], summary)
                        self.assertIn(action["description"], summary)
                else:
                    self.assertIn(
                        f"Next: preflight target {result['targetPath']} for purpose {result['purpose']}",
                        summary,
                    )

                trace = projections["trace"]
                self.assertIn(f"Request hash: {envelope['requestHash']}", trace)
                self.assertIn(f"Content hash: {envelope['contentHash']}", trace)
                self.assertIn(f"Result hash: {envelope['result']['contentHash']}", trace)
                for evidence in result["evidence"]:
                    self.assertIn(f"source={evidence['source']}", trace)
                    self.assertIn(f"value={evidence['value']}", trace)

    def test_resolver_detail_is_projection_only_for_machine_results(self) -> None:
        arguments = (
            "--repository",
            "Factory/Fixtures/Ecosystems/golden-stack",
            "--format",
            "json-compact",
        )
        baseline = run_command("resolve_factory.py", *arguments)
        self.assertEqual(0, baseline.returncode, baseline.stderr)
        for detail in ("summary", "explain", "trace"):
            with self.subTest(detail=detail):
                projection = run_command(
                    "resolve_factory.py",
                    *arguments,
                    "--detail",
                    detail,
                )
                self.assertEqual(0, projection.returncode, projection.stderr)
                self.assertEqual(baseline.stdout, projection.stdout)

    def test_resolver_invalid_request_is_the_same_failure_in_every_projection(self) -> None:
        arguments = (
            "--repository",
            "Factory/Fixtures/Ecosystems/golden-stack",
            "--target",
            "..",
        )

        envelope, _ = self._assert_subprocess_projections(
            "resolve_factory.py",
            arguments,
            operation_result.exit_code_for_status("invalid"),
        )

        self.assertEqual("invalid", envelope["status"])
        self.assertEqual("FACTORY-RESOLVE-INPUT-INVALID", envelope["diagnostics"][0]["code"])
        self.assertNotIn("result", envelope)

    def test_unknown_repository_is_blocked_with_a_typed_recovery_action_in_every_projection(self) -> None:
        arguments = (
            "--repository",
            "Factory/Fixtures/Ecosystems/unknown",
        )

        envelope, _ = self._assert_subprocess_projections(
            "resolve_factory.py",
            arguments,
            operation_result.exit_code_for_status("blocked"),
        )

        self.assertEqual("blocked", envelope["status"])
        self.assertEqual(
            ["FACTORY-RESOLVE-UNKNOWN-REPOSITORY"],
            [item["code"] for item in envelope["diagnostics"]],
        )
        action = envelope["nextActions"][0]
        self.assertEqual("supply-project-manifest", action["id"])
        self.assertEqual("supply-input", action["kind"])
        self.assertEqual("project-manifest", action["inputId"])
        self.assertEqual("unknown", envelope["result"]["value"]["repositoryMode"])

    def test_contracts_only_is_blocked_with_an_idiomatic_client_action(self) -> None:
        process, envelope = run_json_command(
            "resolve_factory.py",
            "--repository",
            "Factory/Fixtures/Ecosystems/contracts-only",
        )

        self.assertEqual(operation_result.exit_code_for_status("blocked"), process.returncode)
        self.assertEqual(
            {
                "FACTORY-RESOLVE-CONTRACTS-ONLY",
                "FACTORY-RESOLVE-UNKNOWN-REPOSITORY",
            },
            {item["code"] for item in envelope["diagnostics"]},
        )
        actions = {item["id"]: item for item in envelope["nextActions"]}
        self.assertEqual("chronicle-client-dependency", actions["supply-chronicle-client"]["inputId"])

    def test_missing_components_peers_are_blocked_with_a_peer_action(self) -> None:
        process, envelope = run_json_command(
            "resolve_factory.py",
            "--repository",
            "Factory/Fixtures/Ecosystems/components-missing-peer",
        )

        self.assertEqual(operation_result.exit_code_for_status("blocked"), process.returncode)
        self.assertIn(
            "FACTORY-RESOLVE-REQUIRED-PEER-MISSING",
            {item["code"] for item in envelope["diagnostics"]},
        )
        self.assertNotIn(
            "FACTORY-RESOLVE-NO-ROUTE",
            {item["code"] for item in envelope["diagnostics"]},
        )
        actions = {item["id"]: item for item in envelope["nextActions"]}
        self.assertEqual(
            "components-peer-dependencies",
            actions["supply-components-peers"]["inputId"],
        )
        self.assertNotIn("correct-inspection-purpose", actions)

    def test_missing_purpose_route_is_blocked_with_a_correction_action(self) -> None:
        process, envelope = run_json_command(
            "resolve_factory.py",
            "--repository",
            "Factory/Fixtures/Ecosystems/golden-stack",
            "--purpose",
            "unsupported",
        )

        self.assertEqual(operation_result.exit_code_for_status("blocked"), process.returncode)
        self.assertEqual(
            ["FACTORY-RESOLVE-NO-ROUTE"],
            [item["code"] for item in envelope["diagnostics"]],
        )
        action = envelope["nextActions"][0]
        self.assertEqual("correct-inspection-purpose", action["id"])
        self.assertEqual("correct-input", action["kind"])
        self.assertEqual("--purpose", action["location"]["reference"])

    def test_resolver_unknown_flag_is_a_sanitized_machine_invocation_error(self) -> None:
        process = run_command(
            "resolve_factory.py",
            "--format",
            "json-compact",
            "--unknown\u001b[2J",
        )

        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertNotIn("\u001b", process.stdout)
        envelope = json.loads(process.stdout)
        self.assertEqual("inspect", envelope["operation"])
        self.assertEqual("invocation-error", envelope["status"])
        self.assertEqual("FACTORY-RESOLVE-INVOCATION-INVALID", envelope["diagnostics"][0]["code"])
        operation_result.verify_operation_result_hash(envelope)

    def test_definition_validation_success_is_the_same_typed_fact_in_every_projection(self) -> None:
        envelope, text = self._assert_subprocess_projections("validate_factory.py", (), 0)

        self.assertEqual("validate", envelope["operation"])
        self.assertEqual("success", envelope["status"])
        self.assertFalse(envelope["sideEffectsOccurred"])
        self.assertEqual(
            validate_factory.DEFINITION_VALIDATION_RESULT_SCHEMA,
            envelope["result"]["schemaId"],
        )
        self.assertEqual("valid", envelope["result"]["value"]["outcome"])
        self.assertIn(f"{envelope['result']['value']['counts']['schemas']} schemas", text)

    def test_definition_validation_errors_are_the_same_failure_in_every_projection(self) -> None:
        outputs: dict[str, tuple[int, str, str]] = {}
        for output_format in ("text", "json", "json-compact"):
            stdout = io.StringIO()
            stderr = io.StringIO()
            with (
                mock.patch.object(
                    sys,
                    "argv",
                    ["validate_factory.py", "--format", output_format],
                ),
                mock.patch.object(
                    validate_factory,
                    "validate_documents",
                    return_value=["Factory/Profiles/example.profile.json: invalid profile"],
                ),
                redirect_stdout(stdout),
                redirect_stderr(stderr),
            ):
                exit_code = validate_factory.main()
            outputs[output_format] = (exit_code, stdout.getvalue(), stderr.getvalue())

        pretty = json.loads(outputs["json"][1])
        compact = json.loads(outputs["json-compact"][1])
        self.assertEqual(pretty, compact)
        self.assertEqual(operation_result.exit_code_for_status("invalid"), outputs["text"][0])
        self.assertEqual(operation_result.exit_code_for_status("invalid"), outputs["json"][0])
        self.assertEqual(operation_result.exit_code_for_status("invalid"), outputs["json-compact"][0])
        self.assertTrue(all(not value[2] for value in outputs.values()))
        self.assertEqual("invalid", pretty["status"])
        self.assertEqual("invalid", pretty["result"]["value"]["outcome"])
        self.assertEqual("FACTORY-DEFINITIONS-INVALID", pretty["diagnostics"][0]["code"])
        self._assert_text_material(outputs["text"][1], pretty, expect_hashes=True)

    def test_definition_load_failure_is_a_typed_invalid_result_without_prose(self) -> None:
        outputs: dict[str, tuple[int, str, str]] = {}
        for output_format in ("text", "json", "json-compact"):
            stdout = io.StringIO()
            stderr = io.StringIO()
            with (
                mock.patch.object(
                    sys,
                    "argv",
                    ["validate_factory.py", "--format", output_format],
                ),
                mock.patch.object(
                    validate_factory,
                    "load_json",
                    side_effect=validate_factory.ValidationFailure(
                        "Contracts/v1/broken.schema.json: duplicate object key allOf"
                    ),
                ),
                redirect_stdout(stdout),
                redirect_stderr(stderr),
            ):
                exit_code = validate_factory.main()
            outputs[output_format] = (exit_code, stdout.getvalue(), stderr.getvalue())

        envelope = json.loads(outputs["json"][1])
        self.assertEqual(envelope, json.loads(outputs["json-compact"][1]))
        self.assertTrue(
            all(
                output[0] == operation_result.exit_code_for_status("invalid")
                for output in outputs.values()
            )
        )
        self.assertTrue(all(not output[2] for output in outputs.values()))
        self.assertEqual("invalid", envelope["status"])
        self.assertEqual("FACTORY-DEFINITIONS-LOAD-INVALID", envelope["diagnostics"][0]["code"])
        self.assertNotIn("Traceback", outputs["text"][1])
        self._assert_text_material(outputs["text"][1], envelope, expect_hashes=True)
        operation_result.verify_operation_result_hash(envelope)

    def test_canonical_invalid_definition_is_invalid_not_unexpected(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()
        path = validate_factory.CONTRACTS / "canonical-invalid.fixture.json"
        with (
            mock.patch.object(
                sys,
                "argv",
                ["validate_factory.py", "--format", "json-compact"],
            ),
            mock.patch.object(validate_factory, "all_json_files", return_value=[path]),
            mock.patch.object(validate_factory, "load_json", return_value={"budget": 1.5}),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            exit_code = validate_factory.main()

        self.assertEqual(operation_result.exit_code_for_status("invalid"), exit_code)
        self.assertEqual("", stderr.getvalue())
        envelope = json.loads(stdout.getvalue())
        self.assertEqual("invalid", envelope["status"])
        self.assertEqual(
            "FACTORY-DEFINITIONS-CANONICAL-INVALID",
            envelope["diagnostics"][0]["code"],
        )
        self.assertIn("canonical JSON v1", envelope["diagnostics"][0]["message"])
        operation_result.verify_operation_result_hash(envelope)

    def test_unexpected_failures_are_path_opaque_and_projection_equivalent(self) -> None:
        secret = "/private/customer-identity/internal.json"
        resolver_outputs: dict[str, tuple[int, str, str]] = {}
        validator_outputs: dict[str, tuple[int, str, str]] = {}
        for output_format in ("text", "json", "json-compact"):
            resolver_outputs[output_format] = invoke_main(
                "resolve",
                output_format,
                RuntimeError(secret),
            )
            validator_outputs[output_format] = invoke_main(
                "validate",
                output_format,
                RuntimeError(secret),
            )

        for outputs, operation in (
            (resolver_outputs, "inspect"),
            (validator_outputs, "validate"),
        ):
            pretty = json.loads(outputs["json"][1])
            compact = json.loads(outputs["json-compact"][1])
            self.assertEqual(pretty, compact)
            self.assertEqual("unexpected", pretty["status"])
            self.assertEqual(operation, pretty["operation"])
            self.assertTrue(
                all(
                    output[0] == operation_result.exit_code_for_status("unexpected")
                    for output in outputs.values()
                )
            )
            self.assertTrue(all(not output[2] for output in outputs.values()))
            self.assertTrue(all(secret not in output[1] for output in outputs.values()))
            self.assertTrue(all("customer-identity" not in output[1] for output in outputs.values()))
            self._assert_text_material(
                outputs["text"][1],
                pretty,
                expect_hashes=operation == "validate",
            )
            operation_result.verify_operation_result_hash(pretty)

    def test_definition_validation_rejects_unknown_flags_in_machine_mode(self) -> None:
        process = run_command(
            "validate_factory.py",
            "--format",
            "json-compact",
            "--unknown\u001b[2J",
        )

        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertNotIn("\u001b", process.stdout)
        envelope = json.loads(process.stdout)
        self.assertEqual("validate", envelope["operation"])
        self.assertEqual("invocation-error", envelope["status"])
        self.assertEqual(
            "FACTORY-DEFINITIONS-INVOCATION-INVALID",
            envelope["diagnostics"][0]["code"],
        )
        operation_result.verify_operation_result_hash(envelope)

    def _assert_subprocess_projections(
        self,
        script: str,
        arguments: tuple[str, ...],
        expected_exit: int,
    ) -> tuple[dict, str]:
        text_process = run_command(script, *arguments, "--format", "text")
        pretty_process = run_command(script, *arguments, "--format", "json")
        compact_process = run_command(script, *arguments, "--format", "json-compact")
        for process in (text_process, pretty_process, compact_process):
            self.assertEqual(expected_exit, process.returncode, process.stderr)
            self.assertEqual("", process.stderr)
        pretty = json.loads(pretty_process.stdout)
        compact = json.loads(compact_process.stdout)
        self.assertEqual(pretty, compact)
        operation_result.verify_operation_result_hash(pretty)
        self._assert_text_material(
            text_process.stdout,
            pretty,
            expect_hashes=script != "resolve_factory.py",
        )
        return pretty, text_process.stdout

    def _assert_text_material(
        self,
        text: str,
        envelope: dict,
        *,
        expect_hashes: bool,
    ) -> None:
        self.assertIn(f"Operation: {envelope['operation']}", text)
        self.assertIn(f"Status: {envelope['status']}", text)
        self.assertIn(envelope["summary"], text)
        self.assertIn(f"Side effects occurred: {'yes' if envelope['sideEffectsOccurred'] else 'no'}", text)
        if expect_hashes:
            self.assertIn(f"Request hash: {envelope['requestHash']}", text)
            self.assertIn(f"Content hash: {envelope['contentHash']}", text)
        else:
            self.assertNotIn("Request hash:", text)
            self.assertNotIn("Content hash:", text)
        for diagnostic in envelope["diagnostics"]:
            self.assertIn(diagnostic["code"], text)
            self.assertIn(diagnostic["message"], text)
        for action in envelope["nextActions"]:
            self.assertIn(action["id"], text)
            self.assertIn(action["kind"], text)
            self.assertIn(action["title"], text)
            self.assertIn(action["description"], text)
        if "result" in envelope and expect_hashes:
            self.assertIn(f"Result schema: {envelope['result']['schemaId']}", text)
            self.assertIn(f"Result hash: {envelope['result']['contentHash']}", text)


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
    self_contained = json.loads(process.stdout)
    operation_result.verify_operation_result_hash(self_contained)
    return process, self_contained


def invoke_main(
    command: str,
    output_format: str,
    error: Exception,
) -> tuple[int, str, str]:
    import resolve_factory

    stdout = io.StringIO()
    stderr = io.StringIO()
    module = resolve_factory if command == "resolve" else validate_factory
    script = "resolve_factory.py" if command == "resolve" else "validate_factory.py"
    arguments = [script, "--format", output_format]
    if command == "resolve":
        arguments.extend(
            ["--repository", "Factory/Fixtures/Ecosystems/golden-stack"]
        )
        patch = mock.patch.object(resolve_factory, "resolve_repository", side_effect=error)
    else:
        patch = mock.patch.object(validate_factory, "validate_documents", side_effect=error)
    with (
        mock.patch.object(sys, "argv", arguments),
        patch,
        redirect_stdout(stdout),
        redirect_stderr(stderr),
    ):
        exit_code = module.main()
    return exit_code, stdout.getvalue(), stderr.getvalue()


if __name__ == "__main__":
    unittest.main()
