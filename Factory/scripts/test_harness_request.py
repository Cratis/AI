#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

from __future__ import annotations

import unittest
from copy import deepcopy
from pathlib import Path

import canonical_json
import compile_factory
import harness_request
import resolve_factory
import validate_factory


class HarnessRequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.documents = {
            path: validate_factory.load_json(path)
            for path in validate_factory.all_json_files()
        }
        repository = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        resolved_profile = resolve_factory.resolve_repository(
            repository,
            ".",
            "investigate",
            cls.documents,
        )
        repository_snapshot = {
            "$schema": "https://schemas.cratis.io/factory/v1/repository-snapshot.schema.json",
            "protocolVersion": "1",
            "repository": "test-repository",
            "revision": "a" * 40,
            "targetPath": ".",
            "dirty": False,
        }
        repository_snapshot["contentHash"] = canonical_json.content_hash(repository_snapshot)
        cls.compiled = compile_factory.compile_documents(
            cls.documents,
            "investigate-cratis-issue",
            resolved_profile,
            repository_snapshot,
            "local-development",
        )

    def setUp(self) -> None:
        self.request = self._build_request()

    def test_builder_binds_the_exact_compiled_phase_and_self_hash(self) -> None:
        harness_request.verify_harness_request(
            self.request,
            self.compiled,
            self.documents,
        )

        self.assertEqual(
            self.compiled["contentHash"],
            self.request["compiledWorkflow"]["contentHash"],
        )
        self.assertEqual(
            self.compiled["repositoryBinding"]["resolvedProfile"]["profiles"],
            self.request["repositoryBinding"]["resolvedProfile"]["profiles"],
        )
        self.assertNotIn("profile", self.request)
        self.assertEqual(
            harness_request.harness_request_hash(self.request),
            self.request["requestHash"],
        )
        self.assertEqual("read-repository", self.request["agent"]["capability"])
        self.assertIn(
            {
                "id": "read-repository",
                "usage": "agent",
                "sourceId": "investigate",
                "effect": "read",
                "policyCapability": "read-repository",
                "decision": "allow",
            },
            self.request["capabilityGrants"],
        )

    def test_harness_rejects_rehashed_compiled_agent_without_exact_access_grant(self) -> None:
        for label, mutate in (
            (
                "declaration",
                lambda phase: phase["execution"].pop("capability"),
            ),
            (
                "grant",
                lambda phase: phase["capabilities"].__setitem__(
                    slice(None),
                    [grant for grant in phase["capabilities"] if grant["usage"] != "agent"],
                ),
            ),
        ):
            with self.subTest(binding=label):
                compiled = deepcopy(self.compiled)
                phase = next(
                    phase
                    for phase in compiled["orderedPhases"]
                    if phase["id"] == "investigate"
                )
                mutate(phase)
                compiled["contentHash"] = canonical_json.content_hash(
                    {key: value for key, value in compiled.items() if key != "contentHash"}
                )

                with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
                    harness_request.build_harness_request(
                        self.documents,
                        compiled,
                        "investigate",
                        run_id="11111111-1111-4111-8111-111111111111",
                        phase_attempt_id="22222222-2222-4222-8222-222222222222",
                        objective=self.request["objective"],
                        effective_classification="internal",
                        provider_policy=self.request["providerPolicy"],
                        checkpoint="immutable-checkpoint",
                        harness="test-harness",
                        model="test-model",
                        reasoning="high",
                        execution_limits=self.request["executionLimits"],
                        inputs=self.request["inputs"],
                    )

                self.assertTrue(
                    any("capability" in error or "grant" in error for error in raised.exception.errors)
                )

    def test_stale_request_hash_fails(self) -> None:
        self.request["objective"]["text"] = "tampered objective"

        with self.assertRaisesRegex(
            harness_request.HarnessRequestFailure,
            "Factory harness request validation failed",
        ) as raised:
            harness_request.verify_harness_request(
                self.request,
                self.compiled,
                self.documents,
            )

        self.assertIn("Harness request content hash mismatch", raised.exception.errors[0])

    def test_missing_required_traceability_references_fail_closed(self) -> None:
        removals = (
            ("compiled workflow", lambda request: request.pop("compiledWorkflow")),
            (
                "repository snapshot",
                lambda request: request["repositoryBinding"].pop("repositorySnapshot"),
            ),
            (
                "resolved composition",
                lambda request: request["repositoryBinding"].pop("resolvedProfile"),
            ),
            ("effective policy", lambda request: request.pop("effectivePolicy")),
            ("agent definition", lambda request: request["agent"].pop("definition")),
            ("capability grants", lambda request: request.pop("capabilityGrants")),
        )

        for label, remove in removals:
            with self.subTest(binding=label):
                request = deepcopy(self.request)
                remove(request)
                request = harness_request.seal_harness_request(request)

                with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
                    harness_request.verify_harness_request(
                        request,
                        self.compiled,
                        self.documents,
                    )

                self.assertTrue(raised.exception.errors)

    def test_rehashing_cannot_replace_authority_bindings(self) -> None:
        mutations = {
            "compiled workflow": lambda request: request["compiledWorkflow"].__setitem__(
                "contentHash", f"sha256:{'0' * 64}"
            ),
            "phase ordinal": lambda request: request["phase"].__setitem__("ordinal", 3),
            "repository snapshot": lambda request: request["repositoryBinding"][
                "repositorySnapshot"
            ].__setitem__("contentHash", f"sha256:{'1' * 64}"),
            "resolved profile": lambda request: request["repositoryBinding"][
                "resolvedProfile"
            ].__setitem__("contentHash", f"sha256:{'2' * 64}"),
            "profile composition": lambda request: request["repositoryBinding"][
                "resolvedProfile"
            ]["profiles"].pop(),
            "effective policy": lambda request: request["effectivePolicy"].__setitem__(
                "projectManifestHash", f"sha256:{'3' * 64}"
            ),
            "agent definition": lambda request: request["agent"]["definition"].__setitem__(
                "contentHash", f"sha256:{'4' * 64}"
            ),
            "capability grants": lambda request: request["capabilityGrants"].clear(),
        }

        for label, mutate in mutations.items():
            with self.subTest(binding=label):
                request = deepcopy(self.request)
                mutate(request)
                request = harness_request.seal_harness_request(request)

                with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
                    harness_request.verify_harness_request(
                        request,
                        self.compiled,
                        self.documents,
                    )

                self.assertTrue(raised.exception.errors)

    def test_workspace_and_ordered_inputs_are_compiler_bound(self) -> None:
        mutations = (
            lambda request: request["workspace"].__setitem__("baseRevision", "b" * 40),
            lambda request: request["workspace"].__setitem__("targetPath", "other"),
            lambda request: request["inputs"].reverse(),
            lambda request: request["inputs"].pop(),
        )

        for mutate in mutations:
            request = deepcopy(self.request)
            mutate(request)
            request = harness_request.seal_harness_request(request)

            with self.assertRaises(harness_request.HarnessRequestFailure):
                harness_request.verify_harness_request(
                    request,
                    self.compiled,
                    self.documents,
                )

    def test_all_execution_limit_maxima_fail_closed(self) -> None:
        invalid_limits = {
            "timeoutSeconds": 86401,
            "maxTurns": 257,
            "maxToolCalls": 2049,
            "maxInputTokens": 2000001,
            "maxOutputTokens": 250001,
            "maxInputBytes": 268435457,
            "maxOutputBytes": 67108865,
            "maxMessageBytes": 4194305,
        }

        for name, value in invalid_limits.items():
            with self.subTest(limit=name):
                request = deepcopy(self.request)
                request["executionLimits"][name] = value
                request = harness_request.seal_harness_request(request)

                with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
                    harness_request.verify_harness_request(
                        request,
                        self.compiled,
                        self.documents,
                    )

                self.assertTrue(
                    any(f"executionLimits.{name}" in error for error in raised.exception.errors)
                )

    def test_phase_ordinal_and_artifact_size_maxima_fail_closed(self) -> None:
        request = deepcopy(self.request)
        request["phase"]["ordinal"] = 4096
        request = harness_request.seal_harness_request(request)
        with self.assertRaises(harness_request.HarnessRequestFailure) as ordinal_error:
            harness_request.verify_harness_request(request, self.compiled, self.documents)
        self.assertTrue(any("phase.ordinal" in error for error in ordinal_error.exception.errors))

        request = deepcopy(self.request)
        request["inputs"][0]["artifact"]["sizeBytes"] = 268435457
        request = harness_request.seal_harness_request(request)
        with self.assertRaises(harness_request.HarnessRequestFailure) as size_error:
            harness_request.verify_harness_request(request, self.compiled, self.documents)
        self.assertTrue(
            any("inputs.0.artifact.sizeBytes" in error for error in size_error.exception.errors)
        )

    def test_declared_input_bytes_cannot_exceed_the_request_budget(self) -> None:
        request = deepcopy(self.request)
        request["executionLimits"]["maxInputBytes"] = 1
        request = harness_request.seal_harness_request(request)

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.verify_harness_request(request, self.compiled, self.documents)

        self.assertIn(
            "Harness request input artifact sizes exceed maxInputBytes",
            raised.exception.errors,
        )

    def test_effective_classification_cannot_understate_supplied_content(self) -> None:
        request = deepcopy(self.request)
        request["effectiveClassification"] = "public"
        request = harness_request.seal_harness_request(request)

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.verify_harness_request(request, self.compiled, self.documents)

        self.assertIn(
            "Harness request effective classification is lower than supplied content",
            raised.exception.errors,
        )

    def test_rehashed_request_cannot_name_a_provider_outside_its_provider_policy(self) -> None:
        request = deepcopy(self.request)
        request["agent"]["providerReference"] = "different-provider"
        request = harness_request.seal_harness_request(request)

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.verify_harness_request(request, self.compiled, self.documents)

        self.assertIn(
            "Harness request agent.providerReference does not match providerPolicy.providerReference",
            raised.exception.errors,
        )

    def test_unknown_fields_and_legacy_profile_shape_are_rejected(self) -> None:
        request = deepcopy(self.request)
        request["profile"] = {
            "id": "legacy-singular-profile",
            "contentHash": f"sha256:{'0' * 64}",
        }
        request = harness_request.seal_harness_request(request)

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.verify_harness_request(request, self.compiled, self.documents)

        self.assertTrue(any("Additional properties" in error for error in raised.exception.errors))

    def test_non_agent_phase_cannot_become_a_harness_request(self) -> None:
        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            self._build_request("accept-intent")

        self.assertEqual(
            ["Compiled phase accept-intent is not an agent phase"],
            raised.exception.errors,
        )

    def test_compiled_binding_hashes_are_verified_before_use(self) -> None:
        compiled = deepcopy(self.compiled)
        compiled["repositoryBinding"]["resolvedProfile"]["capabilities"].append("invented")

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.verify_harness_request(
                self.request,
                compiled,
                self.documents,
            )

        self.assertTrue(any("Compiled workflow content hash mismatch" in error for error in raised.exception.errors))

    def test_canonical_hash_rejects_non_interoperable_values(self) -> None:
        request = deepcopy(self.request)
        request["objective"]["text"] = "bad\ud800value"

        with self.assertRaises(harness_request.HarnessRequestFailure) as raised:
            harness_request.seal_harness_request(request)

        self.assertIn("Factory canonical JSON v1", raised.exception.errors[0])

    def _build_request(self, phase_id: str = "investigate") -> dict:
        phase = next(
            phase
            for phase in self.compiled["orderedPhases"]
            if phase["id"] == phase_id
        )
        inputs = [
            {
                "name": value["name"],
                "artifact": {
                    "kind": "workflow-input",
                    "reference": f"artifact:{value['name']}",
                    "contentHash": f"sha256:{index + 1:064x}",
                    "classification": "internal",
                    "sizeBytes": 16,
                },
                "sanitization": {
                    "status": "applied",
                    "appliedRules": ["remove-credentials"],
                },
            }
            for index, value in enumerate(phase["inputs"])
        ]
        return harness_request.build_harness_request(
            self.documents,
            self.compiled,
            phase_id,
            run_id="11111111-1111-4111-8111-111111111111",
            phase_attempt_id="22222222-2222-4222-8222-222222222222",
            objective={
                "text": "Investigate the reported behavior from supplied evidence.",
                "classification": "internal",
                "redaction": {
                    "status": "applied",
                    "appliedRules": ["remove-identifiers"],
                },
            },
            effective_classification="internal",
            provider_policy={
                "decision": "allow",
                "providerReference": "test-provider",
                "region": "eu-north",
                "retentionMode": "zero-retention",
                "dataUse": "no-training",
                "policyHash": f"sha256:{'f' * 64}",
            },
            checkpoint="immutable-checkpoint",
            harness="test-harness",
            model="test-model",
            reasoning="high",
            execution_limits={
                "timeoutSeconds": min(600, phase["policy"]["timeoutSeconds"]),
                "maxTurns": 32,
                "maxToolCalls": 128,
                "maxInputTokens": 200000,
                "maxOutputTokens": 20000,
                "maxInputBytes": 1048576,
                "maxOutputBytes": 1048576,
                "maxMessageBytes": 262144,
            },
            inputs=inputs,
        )


if __name__ == "__main__":
    unittest.main()
