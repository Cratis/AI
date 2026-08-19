#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the shared Factory operation result contract and renderer."""

from __future__ import annotations

from copy import deepcopy
import json
import unittest

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json
import operation_result
import validate_factory


class OperationResultTests(unittest.TestCase):
    def test_blocked_result_conforms_to_the_versioned_contract(self) -> None:
        result = blocked_result()

        errors = list(schema_validator("operation-result.schema.json").iter_errors(result))

        self.assertEqual([], errors)

    def test_compact_machine_output_is_deterministic(self) -> None:
        first = blocked_result()
        second = blocked_result()

        first_output = operation_result.render_operation_result(first, "json-compact")
        second_output = operation_result.render_operation_result(second, "json-compact")

        self.assertEqual(first, second)
        self.assertEqual(first_output, second_output)
        self.assertEqual(canonical_json.canonical_json(first) + "\n", first_output)

    def test_error_machine_output_is_only_the_structured_envelope(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-MANIFEST-INVALID",
            "error",
            "The project manifest does not conform to its schema.",
            "retry-after-correction",
            "Correct the reported manifest property before retrying.",
            locations=[
                {
                    "kind": "json-pointer",
                    "reference": ".cratis/factory.json",
                    "pointer": "/profiles/include/0",
                }
            ],
        )
        envelope = operation_result.make_operation_result(
            "inspect",
            "invalid",
            "The repository configuration is invalid.",
            request_hash(),
            diagnostics=[diagnostic],
        )

        output = operation_result.render_operation_result(envelope, "json-compact")

        self.assertEqual(envelope, json.loads(output))
        self.assertTrue(output.startswith("{"))
        self.assertNotIn("Factory operation failed:", output)

    def test_every_status_has_a_stable_exit_code(self) -> None:
        expected = {
            "success": 0,
            "invocation-error": 2,
            "blocked": 3,
            "invalid": 4,
            "integrity-error": 5,
            "approval-required": 6,
            "denied": 7,
            "unexpected": 70,
        }

        self.assertEqual(expected, operation_result.EXIT_CODES)
        for status, exit_code in expected.items():
            with self.subTest(status=status):
                self.assertEqual(exit_code, operation_result.exit_code_for_status(status))

    def test_every_status_can_be_represented_by_the_same_envelope(self) -> None:
        for status in operation_result.STATUSES:
            with self.subTest(status=status):
                diagnostics = []
                actions = []
                if status in {"blocked", "approval-required"}:
                    actions = [supply_repository_mode_action()]
                    diagnostics = [
                        operation_result.make_diagnostic(
                            "FACTORY-PREFLIGHT-BLOCKED",
                            "warning",
                            "Preflight needs one explicit input.",
                            "retry-after-correction",
                            "Supply the missing input before retrying.",
                            related_action_ids=[actions[0]["id"]],
                        )
                    ]
                elif status != "success":
                    diagnostics = [
                        operation_result.make_diagnostic(
                            f"FACTORY-OPERATION-{status.upper().replace('-', '')}",
                            "error",
                            f"The operation ended with status {status}.",
                            "not-retryable",
                            "Use the structured diagnostic to choose the next request.",
                        )
                    ]
                envelope = operation_result.make_operation_result(
                    "preflight",
                    status,
                    f"Preflight status: {status}.",
                    request_hash(),
                    diagnostics=diagnostics,
                    next_actions=actions,
                )

                errors = list(schema_validator("operation-result.schema.json").iter_errors(envelope))
                self.assertEqual([], errors)

    def test_blocked_status_requires_a_next_action(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-PREFLIGHT-BLOCKED",
            "warning",
            "The requested workflow cannot be compiled.",
            "retry-after-correction",
            "Supply the missing workflow role before retrying.",
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "next action"):
            operation_result.make_operation_result(
                "preflight",
                "blocked",
                "Preflight is blocked.",
                request_hash(),
                diagnostics=[diagnostic],
            )

    def test_failure_status_requires_an_error_diagnostic(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-VERIFY-WARNING",
            "warning",
            "The plan could not be fully inspected.",
            "not-retryable",
            "Use a valid compiled plan.",
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "error diagnostic"):
            operation_result.make_operation_result(
                "verify",
                "integrity-error",
                "Plan integrity verification failed.",
                request_hash(),
                diagnostics=[diagnostic],
            )

    def test_success_cannot_contain_an_error_diagnostic(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-VALIDATE-FAILED",
            "error",
            "Validation failed.",
            "retry-after-correction",
            "Correct the invalid definition.",
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "Successful"):
            operation_result.make_operation_result(
                "validate",
                "success",
                "Validation passed.",
                request_hash(),
                diagnostics=[diagnostic],
            )

    def test_tampered_envelope_is_rejected_before_rendering(self) -> None:
        envelope = blocked_result()
        envelope["summary"] = "Tampered summary"

        with self.assertRaisesRegex(operation_result.OperationResultError, "content hash mismatch"):
            operation_result.render_operation_result(envelope, "json-compact")

    def test_typed_result_is_content_addressed(self) -> None:
        typed = objective_typed_result()
        envelope = operation_result.make_operation_result(
            "inspect",
            "success",
            "Repository inspection completed.",
            request_hash(),
            result=typed,
        )

        self.assertEqual(canonical_json.content_hash(typed["value"]), typed["contentHash"])
        self.assertEqual([], list(schema_validator("operation-result.schema.json").iter_errors(envelope)))

        tampered = deepcopy(typed)
        tampered["value"]["classification"] = "public"
        with self.assertRaisesRegex(operation_result.OperationResultError, "Typed result content hash mismatch"):
            operation_result.make_operation_result(
                "inspect",
                "success",
                "Repository inspection completed.",
                request_hash(),
                result=tampered,
            )

    def test_typed_result_must_use_a_trusted_schema(self) -> None:
        with self.assertRaisesRegex(operation_result.OperationResultError, "untrusted schema ID"):
            operation_result.make_typed_result(
                "https://attacker.example/result.schema.json",
                {"outcome": "pass"},
            )

    def test_typed_result_value_must_conform_to_its_trusted_schema(self) -> None:
        value = objective_value()
        value["objective"] = ""

        with self.assertRaisesRegex(operation_result.OperationResultError, "does not conform"):
            operation_result.make_typed_result(
                "https://schemas.cratis.io/factory/v1/factory-objective.schema.json",
                value,
            )

    def test_typed_result_rejects_controls_and_unannotated_newlines_even_when_schema_allows(self) -> None:
        for control in (
            "\x00",
            "\x85",
            "\u061c",
            "\u200e",
            "\u200f",
            "\u202a",
            "\u202e",
            "\u2066",
            "\u2069",
            "\n",
        ):
            with self.subTest(control=repr(control)):
                value = objective_value()
                value["objective"] = f"Inspect safely{control}for everyone."
                with self.assertRaises(operation_result.OperationResultError):
                    operation_result.make_typed_result(
                        "https://schemas.cratis.io/factory/v1/factory-objective.schema.json",
                        value,
                    )

    def test_renderer_rejects_rehashed_typed_value_controls_in_machine_and_text_projections(self) -> None:
        envelope = operation_result.make_operation_result(
            "inspect",
            "success",
            "Inspection completed.",
            request_hash(),
            result=objective_typed_result(),
        )
        envelope["result"]["value"]["objective"] = "Safe-looking\u202eidentity"
        envelope["result"]["contentHash"] = canonical_json.content_hash(
            envelope["result"]["value"]
        )
        envelope["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in envelope.items() if key != "contentHash"}
        )

        for output_format in ("text", "json", "json-compact"):
            with self.subTest(output_format=output_format):
                with self.assertRaisesRegex(
                    operation_result.OperationResultError,
                    "terminal control",
                ):
                    operation_result.render_operation_result(envelope, output_format)

    def test_contract_annotated_bounded_multiline_typed_value_is_preserved(self) -> None:
        value = approval_decision_value()
        value["decision"] = "correction-requested"
        value["requestedCorrection"] = "Correct the bounded input.\nThen rerun validation."

        typed = operation_result.make_typed_result(
            "https://schemas.cratis.io/factory/v1/approval-decision.schema.json",
            value,
        )

        self.assertEqual(value, typed["value"])
        self.assertEqual(canonical_json.content_hash(value), typed["contentHash"])

    def test_unknown_envelope_properties_are_rejected(self) -> None:
        envelope = blocked_result()
        envelope["displayOnlyState"] = "hidden"

        errors = list(schema_validator("operation-result.schema.json").iter_errors(envelope))

        self.assertTrue(any("Additional properties" in error.message for error in errors))

    def test_builder_rejects_a_schema_invalid_action(self) -> None:
        action = supply_repository_mode_action()
        action["hiddenState"] = "not-authoritative"
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-PREFLIGHT-BLOCKED",
            "warning",
            "Preflight needs one explicit input.",
            "retry-after-correction",
            "Supply the missing input before retrying.",
            related_action_ids=[action["id"]],
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "does not conform"):
            operation_result.make_operation_result(
                "preflight",
                "blocked",
                "Preflight is blocked.",
                request_hash(),
                diagnostics=[diagnostic],
                next_actions=[action],
            )

    def test_builder_rejects_malformed_collections_without_leaking_runtime_errors(self) -> None:
        with self.assertRaisesRegex(operation_result.OperationResultError, "diagnostics must be an array"):
            operation_result.make_operation_result(
                "inspect",
                "success",
                "Inspection completed.",
                request_hash(),
                diagnostics={"severity": "error"},
            )

        with self.assertRaisesRegex(operation_result.OperationResultError, "Diagnostic does not conform"):
            operation_result.make_operation_result(
                "inspect",
                "invalid",
                "Inspection input is invalid.",
                request_hash(),
                diagnostics=["not-a-diagnostic"],
            )

    def test_renderer_rejects_a_rehashed_schema_invalid_envelope(self) -> None:
        envelope = blocked_result()
        envelope["displayOnlyState"] = "hidden"
        envelope["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in envelope.items() if key != "contentHash"}
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "does not conform"):
            operation_result.render_operation_result(envelope, "json-compact")

    def test_raw_command_action_requires_a_capability_and_confirmation(self) -> None:
        action = {
            "protocolVersion": "1",
            "id": "apply-fix",
            "kind": "run-command",
            "title": "Apply the configuration fix",
            "description": "Apply the reviewed configuration change.",
            "automation": "safe",
            "argv": ["factory-tool", "apply"],
            "workingDirectory": ".",
            "declaredEffect": "read",
            "requiresApproval": False,
        }

        errors = list(schema_validator("next-action.schema.json").iter_errors(action))

        self.assertTrue(errors)

    def test_terminal_controls_are_rejected_before_projection(self) -> None:
        with self.assertRaisesRegex(operation_result.OperationResultError, "terminal control"):
            operation_result.make_diagnostic(
                "FACTORY-MANIFEST-INVALID",
                "error",
                "Invalid manifest.\x1b[31m",
                "retry-after-correction",
                "Correct the manifest.",
            )

        envelope = blocked_result()
        envelope["summary"] = "Blocked.\x1b[2J"
        envelope["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in envelope.items() if key != "contentHash"}
        )
        with self.assertRaisesRegex(operation_result.OperationResultError, "terminal control"):
            operation_result.render_operation_result(envelope, "text")

    def test_untrusted_control_text_is_not_reflected_from_a_stale_envelope(self) -> None:
        envelope = blocked_result()
        envelope["contentHash"] = "sha256:\x1b[31m"

        with self.assertRaises(operation_result.OperationResultError) as raised:
            operation_result.render_operation_result(envelope, "text")

        self.assertIn("terminal control", str(raised.exception))
        self.assertNotIn("\x1b", str(raised.exception))

    def test_unknown_output_format_is_sanitized_before_it_is_reported(self) -> None:
        with self.assertRaises(operation_result.OperationResultError) as raised:
            operation_result.render_operation_result(
                blocked_result(),
                "attacker\x1b[2J\nnext-line",
            )

        message = str(raised.exception)
        self.assertEqual(
            "Unknown output format: attacker\\u001b[2J\\u000anext-line",
            message,
        )
        self.assertNotIn("\x1b", message)
        self.assertNotIn("\n", message)

    def test_approval_required_status_requires_a_next_action(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-APPROVAL-REQUIRED",
            "warning",
            "The requested capability requires approval.",
            "retry-after-correction",
            "Supply an approval bound to the request before retrying.",
        )

        with self.assertRaisesRegex(operation_result.OperationResultError, "next action"):
            operation_result.make_operation_result(
                "preflight",
                "approval-required",
                "Approval is required.",
                request_hash(),
                diagnostics=[diagnostic],
            )

    def test_text_projection_exposes_material_safety_evidence_and_result_facts(self) -> None:
        action = confirmed_command_action()
        evidence_hash = f"sha256:{'1' * 64}"
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-APPROVAL-REQUIRED",
            "warning",
            "The exact capability requires human approval.",
            "retry-after-correction",
            "Submit an approval bound to this request.",
            evidence=[
                {
                    "reference": "artifact:preflight-plan",
                    "contentHash": evidence_hash,
                    "classification": "internal",
                }
            ],
            related_action_ids=[action["id"]],
        )
        typed = objective_typed_result()
        envelope = operation_result.make_operation_result(
            "preflight",
            "approval-required",
            "Preflight requires one human decision.",
            request_hash(),
            diagnostics=[diagnostic],
            next_actions=[action],
            result=typed,
        )

        rendered = operation_result.render_operation_result(envelope, "text")

        self.assertIn(f"Evidence (internal): artifact:preflight-plan [{evidence_hash}]", rendered)
        self.assertIn("Automation: requires-confirmation", rendered)
        self.assertIn("Capability: factory-verify-evidence", rendered)
        self.assertIn("Declared effect: read", rendered)
        self.assertIn("Approval required: yes", rendered)
        self.assertIn(f"Result schema: {typed['schemaId']}", rendered)
        self.assertIn(f"Result hash: {typed['contentHash']}", rendered)

    def test_retry_later_requires_a_bounded_delay(self) -> None:
        with self.assertRaisesRegex(operation_result.OperationResultError, "retryAfterSeconds"):
            operation_result.make_diagnostic(
                "FACTORY-WORKER-UNAVAILABLE",
                "error",
                "The worker is temporarily unavailable.",
                "retry-later",
                "Retry after the worker lease is available.",
            )

    def test_retry_later_rejects_non_integer_delays_as_operation_errors(self) -> None:
        for invalid_delay in (True, "30", 30.0, object()):
            with self.subTest(invalid_delay=repr(invalid_delay)):
                with self.assertRaisesRegex(
                    operation_result.OperationResultError,
                    "retryAfterSeconds between 1 and 86400",
                ):
                    operation_result.make_diagnostic(
                        "FACTORY-WORKER-UNAVAILABLE",
                        "error",
                        "The worker is temporarily unavailable.",
                        "retry-later",
                        "Retry after the worker lease is available.",
                        retry_after_seconds=invalid_delay,
                    )

    def test_text_projection_includes_location_coordinates_and_retry_delay(self) -> None:
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-WORKER-UNAVAILABLE",
            "error",
            "The worker is temporarily unavailable.",
            "retry-later",
            "Retry after the worker lease is available.",
            locations=[
                {
                    "kind": "json-pointer",
                    "reference": ".cratis/factory.json",
                    "pointer": "/policy/id",
                    "line": 12,
                    "column": 7,
                }
            ],
            retry_after_seconds=30,
        )
        envelope = operation_result.make_operation_result(
            "validate",
            "invalid",
            "Validation must be retried later.",
            request_hash(),
            diagnostics=[diagnostic],
        )

        rendered = operation_result.render_operation_result(envelope, "text")

        self.assertIn(
            "Location (json-pointer): .cratis/factory.json/policy/id [line 12, column 7]",
            rendered,
        )
        self.assertIn(
            "Retry: retry-later after 30 seconds — Retry after the worker lease is available.",
            rendered,
        )


def blocked_result() -> dict:
    action = supply_repository_mode_action()
    diagnostic = operation_result.make_diagnostic(
        "FACTORY-RESOLVE-UNKNOWN-REPOSITORY",
        "warning",
        "Repository mode could not be determined from available evidence.",
        "retry-after-correction",
        "Supply an explicit repository mode before retrying.",
        locations=[{"kind": "repository", "reference": "."}],
        related_action_ids=[action["id"]],
    )
    return operation_result.make_operation_result(
        "inspect",
        "blocked",
        "Repository inspection needs one explicit decision.",
        request_hash(),
        diagnostics=[diagnostic],
        next_actions=[action],
    )


def supply_repository_mode_action() -> dict:
    return {
        "protocolVersion": "1",
        "id": "supply-repository-mode",
        "kind": "supply-input",
        "title": "Choose the repository mode",
        "description": "Provide the repository mode from known project intent.",
        "automation": "human-only",
        "inputId": "repository-mode",
        "expected": "One supported repository mode identifier.",
    }


def confirmed_command_action() -> dict:
    return {
        "protocolVersion": "1",
        "id": "verify-evidence",
        "kind": "run-command",
        "title": "Verify the evidence",
        "description": "Run the trusted evidence verification capability.",
        "automation": "requires-confirmation",
        "capabilityId": "factory-verify-evidence",
        "argv": ["factory-verify-evidence", "--plan", "artifact:preflight-plan"],
        "workingDirectory": ".",
        "declaredEffect": "read",
        "requiresApproval": True,
    }


def objective_value() -> dict:
    return {
        "protocolVersion": "1",
        "objective": "Inspect the repository safely.",
        "targetPath": ".",
        "classification": "internal",
        "constraints": ["Do not change source files."],
    }


def objective_typed_result() -> dict:
    return operation_result.make_typed_result(
        "https://schemas.cratis.io/factory/v1/factory-objective.schema.json",
        objective_value(),
    )


def approval_decision_value() -> dict:
    return {
        "protocolVersion": "1",
        "decisionId": "00000000-0000-4000-8000-000000000001",
        "runId": "00000000-0000-4000-8000-000000000002",
        "phaseAttemptId": "00000000-0000-4000-8000-000000000003",
        "requestHash": f"sha256:{'0' * 64}",
        "decision": "accepted",
        "summary": "The bounded request is accepted.",
        "inlineTextClassification": "internal",
        "requestedCorrection": None,
        "decidedBy": {
            "kind": "human",
            "actorReference": f"run-actor:{'1' * 64}",
        },
        "decidedAt": "2026-08-15T12:00:00Z",
    }


def request_hash() -> str:
    return canonical_json.content_hash(
        {
            "operation": "inspect",
            "repository": ".",
            "target": ".",
        }
    )


def schema_validator(schema_name: str) -> Draft202012Validator:
    documents = {
        path: validate_factory.load_json(path)
        for path in sorted(validate_factory.CONTRACTS.glob("*.schema.json"))
    }
    schemas = {
        document["$id"]: document
        for path, document in documents.items()
        if path.parent == validate_factory.CONTRACTS and path.name.endswith(".schema.json")
    }
    schema = documents[validate_factory.CONTRACTS / schema_name]
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document))
        for identifier, document in schemas.items()
    )
    return Draft202012Validator(schema, format_checker=FormatChecker(), registry=registry)


if __name__ == "__main__":
    unittest.main()
