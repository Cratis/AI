#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Privacy and finite-shape specifications for durable Factory contracts."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import unittest
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import validate_factory


TARGET_SCHEMAS = (
    "approval-decision.schema.json",
    "investigation-result.schema.json",
    "gate-report.schema.json",
    "phase-envelope.schema.json",
    "harness-event.schema.json",
)
STRUCTURALLY_BOUNDED_FORMATS = {"uuid"}
FIXED_PATTERNS = {
    "^sha256:[a-f0-9]{64}$",
    "^run-actor:[a-f0-9]{64}$",
    "^artifact:sha256:[a-f0-9]{64}$",
}


class DurableContractPrivacyTests(unittest.TestCase):
    def test_every_target_free_text_and_array_has_finite_control_safe_shape(self) -> None:
        documents = schema_documents()
        failures: list[str] = []

        def inspect(schema: Any, location: str) -> None:
            if not isinstance(schema, dict):
                return
            value_type = schema.get("type")
            types = set(value_type) if isinstance(value_type, list) else {value_type}
            if "array" in types:
                if not isinstance(schema.get("maxItems"), int):
                    failures.append(f"{location}: array has no finite maxItems")
                inspect(schema.get("items"), f"{location}/items")
            if "string" in types:
                pattern = schema.get("pattern")
                structurally_bounded = (
                    isinstance(schema.get("maxLength"), int)
                    or schema.get("format") in STRUCTURALLY_BOUNDED_FORMATS
                    or pattern in FIXED_PATTERNS
                    or "const" in schema
                    or "enum" in schema
                )
                if not structurally_bounded:
                    failures.append(f"{location}: string has no finite bound")
                control_safe_pattern = isinstance(pattern, str) and (
                    all(
                        marker in pattern
                        for marker in (
                            "\\u0000",
                            "\\u009f",
                            "\\u061c",
                            "\\u200e",
                            "\\u200f",
                            "\\u202a",
                            "\\u2066",
                        )
                    )
                    or pattern in FIXED_PATTERNS
                    or pattern.startswith("^[a-z][a-z0-9]")
                    or "(?:[A-Za-z0-9._-]+/)*" in pattern
                )
                control_safe = (
                    control_safe_pattern
                    or schema.get("format") in STRUCTURALLY_BOUNDED_FORMATS
                    or schema.get("format") == "date-time"
                    or "const" in schema
                    or "enum" in schema
                )
                if not control_safe:
                    failures.append(f"{location}: string has no control-safe constraint")
                if schema.get("format") == "date-time" and not isinstance(
                    schema.get("maxLength"), int
                ):
                    failures.append(f"{location}: date-time has no explicit maxLength")
            properties = schema.get("properties")
            if isinstance(properties, dict):
                for name, child in properties.items():
                    inspect(child, f"{location}/properties/{name}")
            definitions = schema.get("$defs")
            if isinstance(definitions, dict):
                for name, child in definitions.items():
                    inspect(child, f"{location}/$defs/{name}")

        for name in TARGET_SCHEMAS:
            inspect(documents[name], name)

        self.assertEqual([], failures)

    def test_approval_actor_reference_is_opaque_run_scoped_and_not_a_subject(self) -> None:
        validator = schema_validator("approval-decision.schema.json")
        valid = approval_decision()

        self.assertEqual([], list(validator.iter_errors(valid)))
        for leaked_identity in (
            "developer@example.com",
            "user-0192837465",
            "chronicle-subject:customer-42",
        ):
            with self.subTest(leaked_identity=leaked_identity):
                invalid = deepcopy(valid)
                invalid["decidedBy"]["actorReference"] = leaked_identity
                self.assertTrue(list(validator.iter_errors(invalid)))

        legacy = deepcopy(valid)
        del legacy["decidedBy"]["actorReference"]
        legacy["decidedBy"]["subjectReference"] = "user-42"
        self.assertTrue(list(validator.iter_errors(legacy)))

    def test_target_text_rejects_controls_bidi_and_unannotated_newlines(self) -> None:
        cases = [
            ("approval-decision.schema.json", approval_decision(), ("summary",)),
            ("investigation-result.schema.json", investigation_result(), ("summary",)),
            ("gate-report.schema.json", gate_report(), ("checks", 0, "message")),
            ("phase-envelope.schema.json", phase_envelope(), ("summary",)),
            ("harness-event.schema.json", harness_event(), ("traceId",)),
        ]
        for control in (
            "\x00",
            "\x1f",
            "\x7f",
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
            for schema_name, value, path in cases:
                with self.subTest(control=repr(control), schema=schema_name):
                    invalid = deepcopy(value)
                    set_path(invalid, path, f"safe{control}unsafe")
                    self.assertTrue(list(schema_validator(schema_name).iter_errors(invalid)))

    def test_only_explicit_bounded_multiline_fields_accept_newlines(self) -> None:
        approval = approval_decision()
        approval["decision"] = "correction-requested"
        approval["requestedCorrection"] = "Change the policy.\nThen rerun the gate."

        self.assertEqual(
            [],
            list(schema_validator("approval-decision.schema.json").iter_errors(approval)),
        )

    def test_oversize_text_and_collections_are_rejected_for_every_target_contract(self) -> None:
        cases = [
            ("approval-decision.schema.json", approval_decision(), ("summary",), "x" * 2001),
            (
                "investigation-result.schema.json",
                investigation_result(),
                ("evidence",),
                [investigation_result()["evidence"][0]] * 129,
            ),
            ("gate-report.schema.json", gate_report(), ("checks",), gate_report()["checks"] * 129),
            (
                "phase-envelope.schema.json",
                phase_envelope(),
                ("changedFiles",),
                [f"Source/File{index}.cs" for index in range(513)],
            ),
            (
                "harness-event.schema.json",
                harness_event(),
                ("data", "sessionId"),
                "s" * 129,
            ),
        ]
        for schema_name, value, path, oversized in cases:
            with self.subTest(schema=schema_name):
                invalid = deepcopy(value)
                set_path(invalid, path, oversized)
                self.assertTrue(list(schema_validator(schema_name).iter_errors(invalid)))

        approval = approval_decision()
        approval["decidedAt"] = "2026-08-15T12:00:00." + "1" * 65 + "Z"
        event = harness_event()
        event["occurredAt"] = "2026-08-15T12:00:00." + "1" * 65 + "Z"
        self.assertTrue(
            list(schema_validator("approval-decision.schema.json").iter_errors(approval))
        )
        self.assertTrue(list(schema_validator("harness-event.schema.json").iter_errors(event)))

    def test_raw_command_approval_reason_and_failure_message_are_artifact_references(self) -> None:
        investigation = investigation_result()
        investigation["evidence"][0]["command"] = ["tool", "--customer", "user@example.com"]
        del investigation["evidence"][0]["commandReference"]
        self.assertTrue(
            list(schema_validator("investigation-result.schema.json").iter_errors(investigation))
        )

        approval_event = harness_event("approval-requested")
        approval_event["data"] = {
            "requestHash": content_hash(),
            "capabilityId": "run-quality-gates",
            "reason": "Approve for user@example.com",
        }
        self.assertTrue(
            list(schema_validator("harness-event.schema.json").iter_errors(approval_event))
        )

        failure_event = harness_event("phase-failed")
        failure_event["data"] = {
            "code": "worker-failed",
            "message": "Stack trace containing customer data",
            "retryable": False,
        }
        self.assertTrue(
            list(schema_validator("harness-event.schema.json").iter_errors(failure_event))
        )

    def test_artifact_references_are_opaque_and_changed_files_are_repository_relative(self) -> None:
        phase = phase_envelope()
        for leaked_reference in (
            "/Users/customer/source/output.log",
            "https://user:token@example.invalid/artifact",
            "artifact:user@example.com",
        ):
            with self.subTest(reference=leaked_reference):
                invalid = deepcopy(phase)
                invalid["evidence"][0]["reference"] = leaked_reference
                self.assertTrue(
                    list(schema_validator("phase-envelope.schema.json").iter_errors(invalid))
                )

        for unsafe_path in ("/etc/passwd", "../secret", "Source/../../secret", "file://secret"):
            with self.subTest(path=unsafe_path):
                invalid = deepcopy(phase)
                invalid["changedFiles"] = [unsafe_path]
                self.assertTrue(
                    list(schema_validator("phase-envelope.schema.json").iter_errors(invalid))
                )

    def test_inline_text_classification_is_not_an_artifact_aggregate(self) -> None:
        documents = schema_documents()
        for schema_name in (
            "approval-decision.schema.json",
            "investigation-result.schema.json",
            "gate-report.schema.json",
            "phase-envelope.schema.json",
        ):
            with self.subTest(schema=schema_name):
                schema = documents[schema_name]
                self.assertIn("inlineTextClassification", schema["required"])
                self.assertNotIn("classification", schema["properties"])


def approval_decision() -> dict[str, Any]:
    return {
        "protocolVersion": "1",
        "decisionId": "00000000-0000-4000-8000-000000000001",
        "runId": "00000000-0000-4000-8000-000000000002",
        "phaseAttemptId": "00000000-0000-4000-8000-000000000003",
        "requestHash": content_hash(),
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


def artifact_reference(reference: str | None = None) -> dict[str, str]:
    return {
        "reference": reference or f"artifact:sha256:{'2' * 64}",
        "contentHash": content_hash(),
        "classification": "internal",
    }


def phase_envelope() -> dict[str, Any]:
    return {
        "protocolVersion": "1",
        "phaseAttemptId": "00000000-0000-4000-8000-000000000003",
        "status": "success",
        "summary": "The phase completed.",
        "inlineTextClassification": "internal",
        "artifacts": [],
        "changedFiles": [],
        "evidence": [
            {
                "kind": "gate-report",
                **artifact_reference(),
            }
        ],
        "findings": [],
        "risks": [],
        "notesForNextPhase": {
            "kind": "phase-notes",
            **artifact_reference(f"artifact:sha256:{'3' * 64}"),
        },
    }


def investigation_result() -> dict[str, Any]:
    return {
        "protocolVersion": "1",
        "envelope": phase_envelope(),
        "outcome": "reproduced",
        "summary": "The issue was reproduced.",
        "inlineTextClassification": "internal",
        "evidence": [
            {
                "kind": "reproduction",
                "commandReference": artifact_reference(f"artifact:sha256:{'4' * 64}"),
                "exitCode": 1,
                "artifact": artifact_reference(f"artifact:sha256:{'5' * 64}"),
            }
        ],
        "plan": [],
        "settledDecisions": [],
        "openDecisions": [],
        "risks": [],
        "recommendedEffort": "normal",
    }


def gate_report() -> dict[str, Any]:
    return {
        "protocolVersion": "1",
        "gateId": "quality-gate",
        "outcome": "pass",
        "inlineTextClassification": "internal",
        "checks": [{"name": "unit-tests", "outcome": "pass", "message": "Passed."}],
        "evidence": [artifact_reference(f"artifact:sha256:{'6' * 64}")],
        "durationMs": 10,
    }


def harness_event(event_type: str = "session-started") -> dict[str, Any]:
    return {
        "protocolVersion": "1",
        "eventId": "00000000-0000-4000-8000-000000000004",
        "runId": "00000000-0000-4000-8000-000000000002",
        "phaseAttemptId": "00000000-0000-4000-8000-000000000003",
        "sequence": 1,
        "type": event_type,
        "occurredAt": "2026-08-15T12:00:00Z",
        "traceId": "trace-1",
        "data": {
            "sessionId": "session-1",
            "harness": "factory-worker",
            "harnessVersion": "1.0.0",
        },
    }


def set_path(value: Any, path: tuple[str | int, ...], replacement: Any) -> None:
    current = value
    for part in path[:-1]:
        current = current[part]
    current[path[-1]] = replacement


def content_hash() -> str:
    return f"sha256:{'0' * 64}"


def schema_documents() -> dict[str, dict[str, Any]]:
    return {
        path.name: validate_factory.load_json(path)
        for path in sorted(validate_factory.CONTRACTS.glob("*.schema.json"))
    }


def schema_validator(schema_name: str) -> Draft202012Validator:
    documents = schema_documents()
    schemas = {document["$id"]: document for document in documents.values()}
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document))
        for identifier, document in schemas.items()
    )
    return Draft202012Validator(
        documents[schema_name],
        format_checker=FormatChecker(),
        registry=registry,
    )


if __name__ == "__main__":
    unittest.main()
