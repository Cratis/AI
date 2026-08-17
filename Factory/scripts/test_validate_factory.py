#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the Cratis Factory foundation validator."""

from __future__ import annotations

from copy import deepcopy
import unittest
from unittest.mock import patch

from jsonschema import Draft202012Validator

import canonical_json
import compile_factory
import resolve_factory
import validate_factory


class FactoryValidatorTests(unittest.TestCase):
    def test_dependency_cycle_is_rejected(self) -> None:
        dependencies = {
            "model": ["review"],
            "review": ["model"],
        }

        self.assertTrue(validate_factory.has_cycle(dependencies))

    def test_acyclic_dependencies_are_accepted(self) -> None:
        dependencies = {
            "model": [],
            "review": ["model"],
            "accept": ["review"],
        }

        self.assertFalse(validate_factory.has_cycle(dependencies))

    def test_cli_confirmation_bypass_is_rejected(self) -> None:
        errors: list[str] = []
        profile = profile_with(["cratis", "chronicle", "observers", "replay", "example", "--yes"])

        validate_factory.validate_profile(validate_factory.ROOT / "Factory/Profiles/test.profile.json", profile, [], errors)

        self.assertTrue(any("confirmation bypass" in error for error in errors))

    def test_developer_owned_cli_command_is_rejected(self) -> None:
        errors: list[str] = []
        profile = profile_with(["cratis", "context", "set", "production"])

        validate_factory.validate_profile(
            validate_factory.ROOT / "Factory/Profiles/test.profile.json",
            profile,
            [["context", "set"]],
            errors,
        )

        self.assertTrue(any("owned by the developer" in error for error in errors))

    def test_bare_developer_owned_cli_command_is_rejected(self) -> None:
        errors: list[str] = []
        profile = profile_with(["cratis", "init"])

        validate_factory.validate_profile(
            validate_factory.ROOT / "Factory/Profiles/test.profile.json",
            profile,
            [["init"]],
            errors,
        )

        self.assertTrue(any("owned by the developer" in error for error in errors))

    def test_shell_operator_is_rejected(self) -> None:
        errors: list[str] = []
        profile = profile_with(["dotnet", "build", "&&", "dotnet", "test"])

        validate_factory.validate_profile(validate_factory.ROOT / "Factory/Profiles/test.profile.json", profile, [], errors)

        self.assertTrue(any("shell operators are forbidden" in error for error in errors))

    def test_factory_markdown_links_resolve(self) -> None:
        errors: list[str] = []

        validate_factory.validate_markdown_links(errors)

        self.assertEqual([], errors)

    def test_unknown_workflow_property_is_rejected_by_json_schema(self) -> None:
        errors: list[str] = []
        documents = load_documents()
        workflow_path = validate_factory.ROOT / "Workflows/investigate-cratis-issue.factory.json"
        documents[workflow_path]["unexpected"] = True

        validate_factory.validate_json_schema_documents(documents, errors)

        self.assertTrue(any("Additional properties are not allowed" in error for error in errors))

    def test_invalid_profile_command_effect_is_rejected_by_json_schema(self) -> None:
        errors: list[str] = []
        documents = load_documents()
        profile_path = validate_factory.ROOT / "Factory/Profiles/cratis-dotnet-react.profile.json"
        documents[profile_path]["commands"]["cli-version"]["effect"] = "unknown"

        validate_factory.validate_json_schema_documents(documents, errors)

        self.assertTrue(any("is not one of" in error for error in errors))

    def test_compiler_is_deterministic(self) -> None:
        documents = load_documents()

        first = compile_fixture(documents)
        second = compile_fixture(documents)

        self.assertEqual(first, second)
        unhashed = {key: value for key, value in first.items() if key != "contentHash"}
        self.assertEqual(canonical_json.content_hash(unhashed), first["contentHash"])
        self.assertEqual(
            ["accept-intent", "investigate", "verify-workspace", "review", "accept-result"],
            [phase["id"] for phase in first["orderedPhases"]],
        )

    def test_unknown_workflow_capability_is_rejected(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        workflow["phases"][2]["capability"] = "invented-capability"

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("unknown capability invented-capability" in error for error in errors))

    def test_agent_phase_cannot_omit_its_explicit_capability(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        del workflow["phases"][1]["capability"]

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(
            any(
                "agent phases require capability" in error
                or "'capability' is a required property" in error
                for error in errors
            )
        )

    def test_unbound_workflow_input_is_rejected(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        workflow["phases"][1]["inputs"][1]["source"]["id"] = "missing-objective"

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("unknown workflow input missing-objective" in error for error in errors))

    def test_non_ancestor_phase_output_is_rejected(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        workflow["phases"][1]["inputs"][0]["source"]["phaseId"] = "review"

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("producer review is not an ancestor of investigate" in error for error in errors))

    def test_downstream_correction_route_is_rejected(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        workflow["phases"][1]["correction"]["targetPhase"] = "review"

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("review must be this phase or one of its ancestors" in error for error in errors))

    def test_incomplete_acceptance_set_is_rejected(self) -> None:
        documents = load_documents()
        workflow = workflow_from(documents)
        workflow["acceptance"]["requiredGateIds"].remove("review-envelope-valid")

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("acceptance omits required gates: review-envelope-valid" in error for error in errors))

    def test_floating_point_values_are_not_canonicalized(self) -> None:
        with self.assertRaises(canonical_json.CanonicalJsonError):
            canonical_json.canonical_json({"budget": 1.5})

    def test_policy_denial_prevents_compilation(self) -> None:
        documents = load_documents()
        policy_path = validate_factory.ROOT / "Factory/Policies/local-development.policy.json"
        documents[policy_path]["capabilities"]["run-quality-gates"] = "deny"

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_fixture(documents)

        self.assertTrue(any("resolves to deny" in error for error in context.exception.errors))

    def test_compiled_plan_preserves_executable_security_contract(self) -> None:
        compiled = compile_fixture(load_documents())

        self.assertEqual(3, len(compiled["workflowInputs"]))
        accept_intent = compiled["orderedPhases"][0]
        self.assertEqual("human", accept_intent["execution"]["kind"])
        self.assertEqual("intent-accepted", accept_intent["execution"]["approval"]["decision"])
        self.assertEqual([], accept_intent["policy"]["writeScopes"])
        verify_workspace = compiled["orderedPhases"][2]
        self.assertEqual("factory-verify-investigation", verify_workspace["execution"]["capability"])
        self.assertTrue(
            all(grant["decision"] == "allow" for grant in verify_workspace["capabilities"])
        )

    def test_tampered_compiled_plan_hash_is_rejected(self) -> None:
        compiled = compile_fixture(load_documents())
        compiled["orderedPhases"][1]["policy"]["timeoutSeconds"] = 1

        with self.assertRaises(compile_factory.CompilationFailure):
            compile_factory.verify_compiled_workflow_hash(compiled)

    def test_schema_closure_hash_changes_with_transitive_reference(self) -> None:
        documents = load_documents()
        workflow_path = validate_factory.ROOT / "Workflows/investigate-cratis-issue.factory.json"
        investigation_reference = "../Contracts/v1/investigation-result.schema.json"
        initial = compile_factory._schema_reference(workflow_path, investigation_reference, documents)
        phase_envelope_path = validate_factory.CONTRACTS / "phase-envelope.schema.json"
        documents[phase_envelope_path]["title"] = "Changed transitive contract"

        changed = compile_factory._schema_reference(workflow_path, investigation_reference, documents)

        self.assertNotEqual(initial["contentHash"], changed["contentHash"])

    def test_unknown_document_kind_is_rejected(self) -> None:
        documents = load_documents()
        invalid_path = validate_factory.PROFILES / "unknown.profile.json"
        documents[invalid_path] = {
            "$schema": "../../Contracts/v1/profile.schema.json",
            "documentKind": "profiel",
        }

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("unknown or missing documentKind profiel" in error for error in errors))

    def test_broken_external_schema_reference_is_rejected(self) -> None:
        documents = load_documents()
        schema_path = validate_factory.CONTRACTS / "investigation-result.schema.json"
        documents[schema_path]["properties"]["envelope"]["$ref"] = (
            "https://schemas.cratis.io/factory/v1/missing.schema.json"
        )

        errors = validate_factory.validate_documents(documents)

        self.assertTrue(any("unresolved external reference" in error for error in errors))

    def test_gate_report_cannot_pass_with_a_failing_check(self) -> None:
        documents = load_documents()
        schema = documents[validate_factory.CONTRACTS / "gate-report.schema.json"]
        report = gate_report("pass", "fail")

        errors = list(Draft202012Validator(schema).iter_errors(report))

        self.assertTrue(errors)

    def test_gate_report_requires_checks_and_evidence(self) -> None:
        documents = load_documents()
        schema = documents[validate_factory.CONTRACTS / "gate-report.schema.json"]
        report = gate_report("pass", "pass")
        report["checks"] = []
        report["evidence"] = []

        errors = list(Draft202012Validator(schema).iter_errors(report))

        self.assertGreaterEqual(len(errors), 2)

    def test_golden_stack_resolves_composable_profiles(self) -> None:
        result = resolve_fixture("golden-stack")

        self.assertEqual("application", result["repositoryMode"])
        self.assertEqual(
            {
                "application-arc-dotnet",
                "application-arc-react",
                "application-chronicle-dotnet",
                "application-cratis-components",
            },
            {profile["id"] for profile in result["profiles"]},
        )
        self.assertIn("cratis-components", result["capabilities"])
        self.assertEqual(["repository-investigator"], [agent["id"] for agent in result["agents"]])

    def test_arc_does_not_imply_chronicle(self) -> None:
        result = resolve_fixture("arc-only")

        self.assertEqual(["application-arc-dotnet"], [profile["id"] for profile in result["profiles"]])
        self.assertNotIn("chronicle", result["capabilities"])

    def test_typescript_chronicle_does_not_imply_react(self) -> None:
        result = resolve_fixture("typescript-client")

        self.assertIn("chronicle-client-typescript", result["capabilities"])
        self.assertNotIn("react", result["capabilities"])
        self.assertNotIn("arc-react", result["capabilities"])

    def test_low_level_contracts_do_not_select_an_idiomatic_client(self) -> None:
        result = resolve_fixture("contracts-only")

        self.assertEqual("unknown", result["repositoryMode"])
        self.assertFalse(result["profiles"])
        self.assertTrue(
            any(item["reason"] == "low-level-contracts-only" for item in result["negativeCapabilities"])
        )

    def test_components_without_required_peers_is_blocked(self) -> None:
        result = resolve_fixture("components-missing-peer")

        self.assertFalse(result["profiles"])
        self.assertTrue(result["blockedReasons"])
        self.assertTrue(
            any(item["reason"] == "required-peer-missing" for item in result["negativeCapabilities"])
        )

    def test_jvm_and_elixir_clients_resolve_without_frontend_capabilities(self) -> None:
        jvm = resolve_fixture("jvm-client")
        elixir = resolve_fixture("elixir-client")

        self.assertIn("chronicle-client-jvm", jvm["capabilities"])
        self.assertIn("chronicle-client-elixir", elixir["capabilities"])
        self.assertNotIn("react", jvm["capabilities"])
        self.assertNotIn("react", elixir["capabilities"])

    def test_framework_identity_suppresses_application_profiles(self) -> None:
        with patch.object(resolve_factory, "_repository_identity", return_value="cratis-components"):
            result = resolve_fixture("components-framework")

        self.assertEqual("framework", result["repositoryMode"])
        self.assertEqual(["framework-components"], [profile["id"] for profile in result["profiles"]])
        self.assertNotIn("application", result["capabilities"])

    def test_resolved_profile_is_deterministic_and_has_a_human_projection(self) -> None:
        first = resolve_fixture("golden-stack")
        second = resolve_fixture("golden-stack")

        self.assertEqual(first, second)
        rendered = resolve_factory._render_text(first)
        self.assertIn(first["contentHash"], rendered)
        self.assertIn("Repository mode: application", rendered)


def profile_with(argv: list[str]) -> dict:
    return {
        "schemaVersion": "1",
        "documentKind": "profile",
        "id": "test-profile",
        "recommendations": {
            "agents": [],
            "workflows": [],
        },
        "commands": {
            "test-capability": {
                "argv": argv,
                "workingDirectory": ".",
                "effect": "read",
                "captures": "text",
            }
        },
    }


def load_documents() -> dict:
    return {
        path: deepcopy(validate_factory.load_json(path))
        for path in validate_factory.all_json_files()
    }


def workflow_from(documents: dict) -> dict:
    workflow_path = validate_factory.ROOT / "Workflows/investigate-cratis-issue.factory.json"
    return documents[workflow_path]


def gate_report(outcome: str, check_outcome: str) -> dict:
    return {
        "protocolVersion": "1",
        "gateId": "test-gate",
        "outcome": outcome,
        "inlineTextClassification": "internal",
        "checks": [
            {
                "name": "test-check",
                "outcome": check_outcome,
                "message": "test",
            }
        ],
        "evidence": [
            {
                "reference": f"artifact:sha256:{'1' * 64}",
                "contentHash": f"sha256:{'0' * 64}",
                "classification": "internal",
            }
        ],
        "durationMs": 1,
    }


def resolve_fixture(name: str) -> dict:
    repository = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / name
    return resolve_factory.resolve_repository(repository, ".", "investigate", load_documents())


def compile_fixture(documents: dict) -> dict:
    repository = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
    resolved_profile = resolve_factory.resolve_repository(repository, ".", "investigate", documents)
    repository_snapshot = {
        "protocolVersion": "1",
        "repository": "compiler-unit-fixture",
        "revision": "0" * 40,
        "targetPath": resolved_profile["targetPath"],
        "dirty": False,
    }
    repository_snapshot["contentHash"] = canonical_json.content_hash(repository_snapshot)
    return compile_factory.compile_documents(
        documents,
        "investigate-cratis-issue",
        resolved_profile,
        repository_snapshot,
        "local-development",
    )


if __name__ == "__main__":
    unittest.main()
