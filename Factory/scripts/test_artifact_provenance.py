#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Adversarial specifications for deterministic Factory v2 integrity helpers."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

import artifact_provenance
import canonical_json
import resolve_factory
import validate_factory


class ArtifactProvenanceIntegrityOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.documents = {
            path: deepcopy(validate_factory.load_json(path))
            for path in validate_factory.all_json_files()
        }
        cls.examples = validate_factory.ROOT / "Contracts" / "v2" / "examples"

    def example(self, name: str) -> dict:
        return deepcopy(validate_factory.load_json(self.examples / f"{name}.json"))

    def test_canonical_example_chain_has_exact_integrity(self) -> None:
        context = self.example("agent-context")
        descriptor = self.example("artifact-descriptor")
        receipt = self.example("artifact-receipt")
        attestation = self.example("sanitization-attestation")
        provenance = self.example("artifact-provenance")
        input_set = self.example("run-input-set")
        envelope = self.example("phase-envelope")

        artifact_provenance.verify_artifact_descriptor_integrity_only(
            descriptor, context, self.documents
        )
        artifact_provenance.verify_artifact_receipt_integrity_only(
            receipt,
            descriptor,
            expected_run_id=receipt["runId"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )
        artifact_provenance.verify_sanitization_attestation_integrity_only(
            attestation,
            descriptor,
            descriptor,
            expected_run_id=receipt["runId"],
            expected_phase_attempt_id=provenance["phaseAttemptId"],
            expected_harness_request_hash=attestation["harnessRequestHash"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )
        artifact_provenance.verify_artifact_provenance_integrity_only(
            provenance,
            receipt,
            attestation,
            expected_source=provenance["source"],
            expected_run_id=receipt["runId"],
            expected_phase_attempt_id=provenance["phaseAttemptId"],
            expected_harness_request_hash=attestation["harnessRequestHash"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )
        artifact_provenance.verify_run_input_set_integrity_only(
            input_set,
            expected_run_id=receipt["runId"],
            expected_compiled_workflow_hash=input_set["compiledWorkflowHash"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )
        artifact_provenance.verify_phase_envelope_integrity_only(
            envelope,
            expected_run_id=receipt["runId"],
            expected_phase_id=envelope["phaseId"],
            expected_phase_attempt_id=provenance["phaseAttemptId"],
            expected_harness_request_hash=envelope["harnessRequestHash"],
            expected_compiled_workflow_hash=envelope["compiledWorkflowHash"],
            expected_input_provenance_hash=envelope["inputProvenanceHash"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )

    def test_canonical_vectors_bind_exact_fixture_bytes(self) -> None:
        vectors_path = (
            validate_factory.ROOT
            / "Factory"
            / "Fixtures"
            / "Contracts"
            / "v2"
            / "canonical-vectors.json"
        )
        vectors = json.loads(vectors_path.read_text(encoding="utf-8"))
        self.assertEqual("2", vectors["protocolVersion"])
        self.assertEqual(7, len(vectors["vectors"]))
        for vector in vectors["vectors"]:
            fixture = validate_factory.load_json(validate_factory.ROOT / vector["fixture"])
            self.assertEqual(vector["canonicalHash"], canonical_json.content_hash(fixture))

    def test_descriptor_reference_must_equal_declared_hash(self) -> None:
        descriptor = self.example("artifact-descriptor")
        descriptor["reference"] = f"artifact:sha256:{'0' * 64}"
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.verify_artifact_descriptor_reference_integrity_only(
                descriptor, self.documents
            )
        self.assertIn("reference", " ".join(context.exception.errors).lower())

    def test_descriptor_binds_exact_schema_closure(self) -> None:
        descriptor = self.example("artifact-descriptor")
        descriptor["schema"]["contentHash"] = f"sha256:{'0' * 64}"
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.verify_artifact_descriptor_reference_integrity_only(
                descriptor, self.documents
            )
        self.assertIn("schema reference", " ".join(context.exception.errors).lower())

    def test_descriptor_rejects_path_url_and_customer_identifier_fields(self) -> None:
        for field, value in (
            ("path", "/customers/acme/payload.json"),
            ("url", "https://customer.example/artifact"),
            ("customerIdentifier", "acme-customer-42"),
        ):
            with self.subTest(field=field):
                descriptor = self.example("artifact-descriptor")
                descriptor[field] = value
                with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
                    artifact_provenance.verify_artifact_descriptor_reference_integrity_only(
                        descriptor, self.documents
                    )

    def test_agent_context_is_exact_allowlist_projection_of_trusted_resolution(self) -> None:
        resolved, workflow_reference, agent_reference = self._trusted_route()
        context = artifact_provenance.generate_agent_context_integrity_only(
            resolved,
            workflow_reference,
            phase_id="investigate",
            purpose="investigate",
            agent_reference=agent_reference,
            documents=self.documents,
        )
        artifact_provenance.verify_agent_context_integrity_only(
            context,
            resolved,
            workflow_reference,
            phase_id="investigate",
            purpose="investigate",
            agent_reference=agent_reference,
            documents=self.documents,
        )
        self.assertEqual(
            {
                "$schema",
                "protocolVersion",
                "documentKind",
                "sourceResolvedProfileHash",
                "repository",
                "composition",
                "route",
                "generator",
                "allowlistHash",
                "contentHash",
            },
            set(context),
        )
        projection = canonical_json.canonical_json(context).lower()
        for forbidden in (
            "evidence",
            "matches",
            "warnings",
            "blockedreasons",
            "repositoryidentity",
            "dependencies",
            "rationale",
            "reason",
            "remote",
            "manifest",
            "targetpath",
            "https://github.com",
        ):
            self.assertNotIn(forbidden, projection)

    def test_context_rejects_unresolved_customer_specific_route(self) -> None:
        resolved, workflow_reference, agent_reference = self._trusted_route()
        agent_reference["id"] = "customer-acme-agent"
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.generate_agent_context_integrity_only(
                resolved,
                workflow_reference,
                phase_id="investigate",
                purpose="investigate",
                agent_reference=agent_reference,
                documents=self.documents,
            )
        self.assertIn("exact resolved agent", " ".join(context.exception.errors))

    def test_context_rejects_full_resolved_profile_disguise(self) -> None:
        resolved, workflow_reference, agent_reference = self._trusted_route()
        disguised = deepcopy(resolved)
        disguised.update(
            {
                "$schema": "https://schemas.cratis.io/factory/v2/agent-context.schema.json",
                "protocolVersion": "2",
                "documentKind": "agent-context",
            }
        )
        disguised["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in disguised.items() if key != "contentHash"}
        )
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_agent_context_integrity_only(
                disguised,
                resolved,
                workflow_reference,
                phase_id="investigate",
                purpose="investigate",
                agent_reference=agent_reference,
                documents=self.documents,
            )

    def test_context_rejects_any_extra_path_url_or_customer_field(self) -> None:
        resolved, workflow_reference, agent_reference = self._trusted_route()
        generated = artifact_provenance.generate_agent_context_integrity_only(
            resolved,
            workflow_reference,
            phase_id="investigate",
            purpose="investigate",
            agent_reference=agent_reference,
            documents=self.documents,
        )
        for field, value in (
            ("path", "/customers/acme/repository"),
            ("url", "https://customer.example/repository"),
            ("customerIdentifier", "acme-customer-42"),
        ):
            with self.subTest(field=field):
                context = deepcopy(generated)
                context[field] = value
                self._reseal(context)
                with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
                    artifact_provenance.verify_agent_context_integrity_only(
                        context,
                        resolved,
                        workflow_reference,
                        phase_id="investigate",
                        purpose="investigate",
                        agent_reference=agent_reference,
                        documents=self.documents,
                    )

    def test_receipt_cross_run_and_security_domain_substitutions_fail(self) -> None:
        descriptor = self.example("artifact-descriptor")
        original = self.example("artifact-receipt")
        for field, value in (
            ("runId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
            ("securityDomain", f"security-domain:sha256:{'f' * 64}"),
        ):
            with self.subTest(field=field):
                receipt = deepcopy(original)
                receipt[field] = value
                self._reseal(receipt)
                with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
                    artifact_provenance.verify_artifact_receipt_integrity_only(
                        receipt,
                        descriptor,
                        expected_run_id=original["runId"],
                        expected_security_domain=original["securityDomain"],
                        documents=self.documents,
                    )

    def test_prior_phase_provenance_cannot_cross_runs(self) -> None:
        provenance = self.example("artifact-provenance")
        receipt = self.example("artifact-receipt")
        attestation = self.example("sanitization-attestation")
        provenance["source"] = {
            "kind": "phase-output",
            "producerRunId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "producerPhaseId": "prior-phase",
            "producerPhaseAttemptId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "producerRequestHash": f"sha256:{'c' * 64}",
            "phaseResultReceiptHash": f"sha256:{'d' * 64}",
        }
        self._reseal(provenance)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.verify_artifact_provenance_integrity_only(
                provenance,
                receipt,
                attestation,
                expected_source=provenance["source"],
                expected_run_id=receipt["runId"],
                expected_phase_attempt_id=provenance["phaseAttemptId"],
                expected_harness_request_hash=attestation["harnessRequestHash"],
                expected_security_domain=receipt["securityDomain"],
                documents=self.documents,
            )
        self.assertIn("cross run", " ".join(context.exception.errors).lower())

    def test_rehashed_provenance_cannot_substitute_expected_source(self) -> None:
        provenance = self.example("artifact-provenance")
        expected_source = deepcopy(provenance["source"])
        provenance["source"]["compiledWorkflowHash"] = f"sha256:{'f' * 64}"
        self._reseal(provenance)
        receipt = self.example("artifact-receipt")
        attestation = self.example("sanitization-attestation")
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.verify_artifact_provenance_integrity_only(
                provenance,
                receipt,
                attestation,
                expected_source=expected_source,
                expected_run_id=receipt["runId"],
                expected_phase_attempt_id=provenance["phaseAttemptId"],
                expected_harness_request_hash=attestation["harnessRequestHash"],
                expected_security_domain=receipt["securityDomain"],
                documents=self.documents,
            )
        self.assertIn("expected source", " ".join(context.exception.errors).lower())

    def test_direct_composite_verifier_rejects_nested_descriptor_substitution(self) -> None:
        envelope = self.example("phase-envelope")
        envelope["outputArtifact"]["reference"] = f"artifact:sha256:{'0' * 64}"
        self._reseal(envelope)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure) as context:
            artifact_provenance.verify_phase_envelope_integrity_only(
                envelope,
                expected_run_id=envelope["runId"],
                expected_phase_id=envelope["phaseId"],
                expected_phase_attempt_id=envelope["phaseAttemptId"],
                expected_harness_request_hash=envelope["harnessRequestHash"],
                expected_compiled_workflow_hash=envelope["compiledWorkflowHash"],
                expected_input_provenance_hash=envelope["inputProvenanceHash"],
                expected_security_domain=envelope["securityDomain"],
                documents=self.documents,
            )
        self.assertIn("artifact reference", " ".join(context.exception.errors).lower())

    def test_every_other_composite_verifier_checks_nested_descriptor_integrity(self) -> None:
        receipt = self.example("artifact-receipt")
        receipt["artifact"]["reference"] = f"artifact:sha256:{'0' * 64}"
        self._reseal(receipt)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_artifact_receipt_integrity_only(
                receipt,
                receipt["artifact"],
                expected_run_id=receipt["runId"],
                expected_security_domain=receipt["securityDomain"],
                documents=self.documents,
            )

        attestation = self.example("sanitization-attestation")
        attestation["sourceArtifact"]["reference"] = f"artifact:sha256:{'0' * 64}"
        self._reseal(attestation)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_sanitization_attestation_integrity_only(
                attestation,
                attestation["sourceArtifact"],
                attestation["deliveredArtifact"],
                expected_run_id=attestation["runId"],
                expected_phase_attempt_id=attestation["phaseAttemptId"],
                expected_harness_request_hash=attestation["harnessRequestHash"],
                expected_security_domain=attestation["securityDomain"],
                documents=self.documents,
            )

        provenance = self.example("artifact-provenance")
        provenance["sourceArtifact"]["reference"] = f"artifact:sha256:{'0' * 64}"
        self._reseal(provenance)
        canonical_receipt = self.example("artifact-receipt")
        canonical_attestation = self.example("sanitization-attestation")
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_artifact_provenance_integrity_only(
                provenance,
                canonical_receipt,
                canonical_attestation,
                expected_source=provenance["source"],
                expected_run_id=provenance["runId"],
                expected_phase_attempt_id=provenance["phaseAttemptId"],
                expected_harness_request_hash=canonical_attestation["harnessRequestHash"],
                expected_security_domain=provenance["securityDomain"],
                documents=self.documents,
            )

        input_set = self.example("run-input-set")
        input_set["inputs"][0]["artifact"]["reference"] = (
            f"artifact:sha256:{'0' * 64}"
        )
        self._reseal(input_set)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_run_input_set_integrity_only(
                input_set,
                expected_run_id=input_set["runId"],
                expected_compiled_workflow_hash=input_set["compiledWorkflowHash"],
                expected_security_domain=input_set["securityDomain"],
                documents=self.documents,
            )

    def test_phase_envelope_cross_run_substitution_fails_even_when_rehashed(self) -> None:
        envelope = self.example("phase-envelope")
        expected_run_id = envelope["runId"]
        envelope["runId"] = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        self._reseal(envelope)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_phase_envelope_integrity_only(
                envelope,
                expected_run_id=expected_run_id,
                expected_phase_id=envelope["phaseId"],
                expected_phase_attempt_id=envelope["phaseAttemptId"],
                expected_harness_request_hash=envelope["harnessRequestHash"],
                expected_compiled_workflow_hash=envelope["compiledWorkflowHash"],
                expected_input_provenance_hash=envelope["inputProvenanceHash"],
                expected_security_domain=envelope["securityDomain"],
                documents=self.documents,
            )

    def test_v2_verifier_does_not_auto_upgrade_protocol_v1(self) -> None:
        envelope = self.example("phase-envelope")
        envelope["protocolVersion"] = "1"
        envelope["$schema"] = "https://schemas.cratis.io/factory/v1/phase-envelope.schema.json"
        self._reseal(envelope)
        with self.assertRaises(artifact_provenance.IntegrityOnlyFailure):
            artifact_provenance.verify_phase_envelope_integrity_only(
                envelope,
                expected_run_id=envelope["runId"],
                expected_phase_id=envelope["phaseId"],
                expected_phase_attempt_id=envelope["phaseAttemptId"],
                expected_harness_request_hash=envelope["harnessRequestHash"],
                expected_compiled_workflow_hash=envelope["compiledWorkflowHash"],
                expected_input_provenance_hash=envelope["inputProvenanceHash"],
                expected_security_domain=envelope["securityDomain"],
                documents=self.documents,
            )

        semantic_errors: list[str] = []
        artifact_provenance.validate_v2_documents_integrity_only(
            {Path("synthetic-v1-phase-envelope.json"): envelope}, semantic_errors
        )
        self.assertEqual([], semantic_errors)

    def test_validator_discovers_both_contract_versions_and_v2_semantics(self) -> None:
        schema_parents = {
            path.parent.name
            for path in validate_factory.all_json_files()
            if path.name.endswith(".schema.json")
        }
        self.assertEqual({"v1", "v2"}, schema_parents)
        self.assertEqual([], validate_factory.validate_documents(deepcopy(self.documents)))

        tampered = deepcopy(self.documents)
        context_path = self.examples / "agent-context.json"
        tampered[context_path]["allowlistHash"] = f"sha256:{'0' * 64}"
        self._reseal(tampered[context_path])
        errors = validate_factory.validate_documents(tampered)
        self.assertTrue(any("allowlist hash" in error.lower() for error in errors))

    def test_validator_rejects_rehashed_nested_descriptor_reference_mismatch(self) -> None:
        tampered = deepcopy(self.documents)
        receipt_path = self.examples / "artifact-receipt.json"
        tampered[receipt_path]["artifact"]["reference"] = f"artifact:sha256:{'0' * 64}"
        self._reseal(tampered[receipt_path])
        errors = validate_factory.validate_documents(tampered)
        self.assertTrue(any("artifact reference" in error.lower() for error in errors))

    def test_integrity_only_receipt_does_not_claim_signature_authority(self) -> None:
        receipt = self.example("artifact-receipt")
        artifact_provenance.verify_artifact_receipt_integrity_only(
            receipt,
            self.example("artifact-descriptor"),
            expected_run_id=receipt["runId"],
            expected_security_domain=receipt["securityDomain"],
            documents=self.documents,
        )
        self.assertEqual("A" * 86, receipt["authority"]["signature"])

    def _trusted_route(self) -> tuple[dict, dict, dict]:
        repository = (
            validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        )
        resolved = resolve_factory.resolve_repository(
            repository, ".", "investigate", self.documents
        )
        workflow = next(
            document
            for document in self.documents.values()
            if document.get("documentKind") == "workflow"
            and document.get("id") == resolved["workflows"][0]["id"]
        )
        workflow_reference = {
            "id": workflow["id"],
            "version": workflow["version"],
            "contentHash": canonical_json.content_hash(workflow),
        }
        agent_reference = {
            "id": resolved["agents"][0]["id"],
            "contentHash": resolved["agents"][0]["contentHash"],
        }
        return resolved, workflow_reference, agent_reference

    @staticmethod
    def _reseal(document: dict) -> None:
        document["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in document.items() if key != "contentHash"}
        )


if __name__ == "__main__":
    unittest.main()
