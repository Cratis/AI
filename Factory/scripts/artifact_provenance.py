#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Deterministic integrity-only helpers for Factory v2 artifact provenance.

These helpers do not issue or trust signatures, receipts, storage claims, provider
decisions, run state, or dispatch authority. A future broker must establish those
facts independently before execution.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_ROOT = ROOT / "Contracts"
V2_SCHEMA_PREFIX = "https://schemas.cratis.io/factory/v2/"
V2_INTEGRITY_DOCUMENT_KINDS = {
    "agent-context",
    "artifact-descriptor",
    "artifact-provenance",
    "artifact-receipt",
    "phase-envelope",
    "run-input-set",
    "sanitization-attestation",
}
CLASSIFICATION_RANK = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "restricted": 3,
}
AGENT_CONTEXT_ALLOWLIST = (
    "/sourceResolvedProfileHash",
    "/repository/mode",
    "/composition/profiles",
    "/composition/skills",
    "/composition/capabilities",
    "/route/workflow",
    "/route/phaseId",
    "/route/purpose",
    "/route/agent",
)
AGENT_CONTEXT_ALLOWLIST_HASH = canonical_json.content_hash(
    {"id": "factory-agent-context-v2", "fields": list(AGENT_CONTEXT_ALLOWLIST)}
)
_GENERATOR_SPEC = {
    "id": "factory-agent-context-generator",
    "version": "1.0.0",
    "algorithm": "explicit-field-projection-v1",
    "allowlistHash": AGENT_CONTEXT_ALLOWLIST_HASH,
}
AGENT_CONTEXT_GENERATOR = {
    "id": _GENERATOR_SPEC["id"],
    "version": _GENERATOR_SPEC["version"],
    "contentHash": canonical_json.content_hash(_GENERATOR_SPEC),
}


class IntegrityOnlyFailure(ValueError):
    """Raised when deterministic structure, hash, or supplied binding integrity fails."""

    def __init__(self, errors: list[str]) -> None:
        super().__init__("Factory v2 integrity-only verification failed")
        self.errors = errors


def schema_closure_reference_integrity_only(
    schema_id: str,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, str]:
    """Hash an exact schema and its reachable external Factory schema closure."""
    schemas = {
        document["$id"]: document
        for path, document in documents.items()
        if path.name.endswith(".schema.json") and isinstance(document.get("$id"), str)
    }
    root = schemas.get(schema_id)
    if root is None:
        raise IntegrityOnlyFailure([f"Trusted schema is unavailable: {schema_id}"])
    pending = [root]
    closure: dict[str, dict[str, Any]] = {}
    while pending:
        document = pending.pop()
        identifier = document["$id"]
        if identifier in closure:
            continue
        closure[identifier] = document
        for reference in _find_values(document, "$ref"):
            if not isinstance(reference, str) or reference.startswith("#"):
                continue
            referenced_id = reference.split("#", maxsplit=1)[0]
            referenced = schemas.get(referenced_id)
            if referenced is None:
                raise IntegrityOnlyFailure(
                    [f"Schema closure contains an unavailable reference: {referenced_id}"]
                )
            pending.append(referenced)
    return {
        "id": schema_id,
        "contentHash": canonical_json.content_hash(
            {"root": schema_id, "schemas": closure}
        ),
    }


def make_artifact_descriptor_integrity_only(
    kind: str,
    payload: Any,
    *,
    media_type: str,
    schema_id: str,
    classification: str,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any]:
    """Describe supplied bytes without storing them or claiming a durable receipt."""
    payload_bytes = _payload_bytes(payload, media_type)
    content_hash = canonical_json.bytes_content_hash(payload_bytes)
    descriptor = {
        "$schema": f"{V2_SCHEMA_PREFIX}artifact-descriptor.schema.json",
        "protocolVersion": "2",
        "documentKind": "artifact-descriptor",
        "kind": kind,
        "reference": f"artifact:{content_hash}",
        "contentHash": content_hash,
        "sizeBytes": len(payload_bytes),
        "mediaType": media_type,
        "schema": schema_closure_reference_integrity_only(schema_id, documents),
        "classification": classification,
    }
    verify_artifact_descriptor_integrity_only(descriptor, payload, documents)
    return descriptor


def verify_artifact_descriptor_integrity_only(
    descriptor: dict[str, Any],
    payload: Any,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify exact bytes, reference, size, schema closure, and JSON schema conformance."""
    verify_artifact_descriptor_reference_integrity_only(descriptor, documents)
    errors: list[str] = []
    payload_bytes = _payload_bytes(payload, descriptor["mediaType"])
    actual_hash = canonical_json.bytes_content_hash(payload_bytes)
    if descriptor["contentHash"] != actual_hash:
        errors.append(
            f"Artifact content hash mismatch: expected {descriptor['contentHash']}, calculated {actual_hash}"
        )
    if descriptor["sizeBytes"] != len(payload_bytes):
        errors.append("Artifact size does not match the exact supplied bytes")
    if descriptor["mediaType"] == "application/json":
        _validate_schema_id(payload, descriptor["schema"]["id"], documents, errors)
    if errors:
        raise IntegrityOnlyFailure(errors)


def verify_artifact_descriptor_reference_integrity_only(
    descriptor: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify the descriptor's self-addressed reference and exact trusted schema closure."""
    _validate_v2_document(descriptor, "artifact-descriptor.schema.json", documents)
    errors: list[str] = []
    expected_reference = f"artifact:{descriptor['contentHash']}"
    if descriptor["reference"] != expected_reference:
        errors.append("Artifact reference does not equal artifact plus the declared content hash")
    expected_schema = schema_closure_reference_integrity_only(
        descriptor["schema"]["id"], documents
    )
    if descriptor["schema"] != expected_schema:
        errors.append("Artifact schema reference does not match the exact trusted schema closure")
    if errors:
        raise IntegrityOnlyFailure(errors)


def generate_agent_context_integrity_only(
    resolved_profile: dict[str, Any],
    workflow_reference: dict[str, Any],
    *,
    phase_id: str,
    purpose: str,
    agent_reference: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any]:
    """Generate only the fixed agent-context allowlist from a self-addressed resolution."""
    if not isinstance(workflow_reference, dict) or not isinstance(agent_reference, dict):
        raise IntegrityOnlyFailure(["Agent context route references must be objects"])
    _validate_schema_id(
        resolved_profile,
        "https://schemas.cratis.io/factory/v1/resolved-profile.schema.json",
        documents,
        [],
    )
    _verify_self_hash(resolved_profile, "Resolved profile")
    mode = resolved_profile.get("repositoryMode")
    if mode not in {"application", "framework", "modeling", "operations"}:
        raise IntegrityOnlyFailure(["Agent context requires a known repository mode"])
    if resolved_profile.get("purpose") != purpose:
        raise IntegrityOnlyFailure(["Agent context purpose is not the resolved purpose"])
    matching_workflows = [
        workflow
        for workflow in resolved_profile.get("workflows", [])
        if workflow.get("id") == workflow_reference.get("id")
        and workflow.get("contentHash") == workflow_reference.get("contentHash")
    ]
    trusted_workflows = [
        workflow
        for workflow in documents.values()
        if workflow.get("documentKind") == "workflow"
        and workflow.get("id") == workflow_reference.get("id")
        and workflow.get("version") == workflow_reference.get("version")
        and canonical_json.content_hash(workflow) == workflow_reference.get("contentHash")
    ]
    if len(matching_workflows) != 1 or len(trusted_workflows) != 1:
        raise IntegrityOnlyFailure(
            ["Agent context workflow is not the exact resolved trusted workflow"]
        )
    if phase_id not in {phase["id"] for phase in trusted_workflows[0]["phases"]}:
        raise IntegrityOnlyFailure(["Agent context phase is not defined by the trusted workflow"])
    matching_agents = [
        agent
        for agent in resolved_profile.get("agents", [])
        if agent.get("id") == agent_reference.get("id")
        and agent.get("contentHash") == agent_reference.get("contentHash")
        and agent.get("purpose") == purpose
    ]
    if len(matching_agents) != 1:
        raise IntegrityOnlyFailure(["Agent context agent is not the exact resolved agent"])
    context = {
        "$schema": f"{V2_SCHEMA_PREFIX}agent-context.schema.json",
        "protocolVersion": "2",
        "documentKind": "agent-context",
        "sourceResolvedProfileHash": resolved_profile["contentHash"],
        "repository": {"mode": mode},
        "composition": {
            "profiles": sorted(
                deepcopy(resolved_profile["profiles"]), key=lambda item: item["id"]
            ),
            "skills": sorted(
                deepcopy(resolved_profile["skills"]), key=lambda item: item["id"]
            ),
            "capabilities": sorted(resolved_profile["capabilities"]),
        },
        "route": {
            "workflow": deepcopy(workflow_reference),
            "phaseId": phase_id,
            "purpose": purpose,
            "agent": deepcopy(agent_reference),
        },
        "generator": deepcopy(AGENT_CONTEXT_GENERATOR),
        "allowlistHash": AGENT_CONTEXT_ALLOWLIST_HASH,
    }
    context["contentHash"] = canonical_json.content_hash(context)
    _validate_v2_document(context, "agent-context.schema.json", documents)
    return context


def verify_agent_context_integrity_only(
    context: dict[str, Any],
    resolved_profile: dict[str, Any],
    workflow_reference: dict[str, Any],
    *,
    phase_id: str,
    purpose: str,
    agent_reference: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Reject any context that is not the exact allowlisted deterministic projection."""
    _validate_v2_document(context, "agent-context.schema.json", documents)
    _verify_self_hash(context, "Agent context")
    expected = generate_agent_context_integrity_only(
        resolved_profile,
        workflow_reference,
        phase_id=phase_id,
        purpose=purpose,
        agent_reference=agent_reference,
        documents=documents,
    )
    if context != expected:
        raise IntegrityOnlyFailure(
            ["Agent context differs from the exact allowlisted resolved-profile projection"]
        )


def verify_artifact_receipt_integrity_only(
    receipt: dict[str, Any],
    descriptor: dict[str, Any],
    *,
    expected_run_id: str,
    expected_security_domain: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify supplied receipt structure/bindings; never treat its signature as trusted."""
    _validate_v2_document(receipt, "artifact-receipt.schema.json", documents)
    _verify_nested_artifact_descriptors_integrity_only(receipt, documents)
    _verify_self_hash(receipt, "Artifact receipt")
    errors = []
    if receipt["artifact"] != descriptor:
        errors.append("Artifact receipt does not bind the exact delivered descriptor")
    if receipt["runId"] != expected_run_id:
        errors.append("Artifact receipt belongs to a different run")
    if receipt["securityDomain"] != expected_security_domain:
        errors.append("Artifact receipt belongs to a different security domain")
    if receipt["issuedAt"] >= receipt["retentionUntil"]:
        errors.append("Artifact receipt retention must end after issuance")
    if errors:
        raise IntegrityOnlyFailure(errors)


def verify_sanitization_attestation_integrity_only(
    attestation: dict[str, Any],
    source_artifact: dict[str, Any],
    delivered_artifact: dict[str, Any],
    *,
    expected_run_id: str,
    expected_phase_attempt_id: str,
    expected_harness_request_hash: str,
    expected_security_domain: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify supplied attestation bindings without verifying signer trust or sanitizer work."""
    _validate_v2_document(attestation, "sanitization-attestation.schema.json", documents)
    _verify_nested_artifact_descriptors_integrity_only(attestation, documents)
    _verify_self_hash(attestation, "Sanitization attestation")
    errors = []
    for name, actual, expected in (
        ("run", attestation["runId"], expected_run_id),
        ("phase attempt", attestation["phaseAttemptId"], expected_phase_attempt_id),
        (
            "harness request",
            attestation["harnessRequestHash"],
            expected_harness_request_hash,
        ),
        ("security domain", attestation["securityDomain"], expected_security_domain),
    ):
        if actual != expected:
            errors.append(f"Sanitization attestation belongs to a different {name}")
    if attestation["sourceArtifact"] != source_artifact:
        errors.append("Sanitization attestation source artifact does not match provenance")
    if attestation["deliveredArtifact"] != delivered_artifact:
        errors.append("Sanitization attestation delivered artifact does not match provenance")
    if attestation["issuedAt"] >= attestation["validUntil"]:
        errors.append("Sanitization attestation must expire after issuance")
    for field in ("kind", "mediaType", "schema"):
        if source_artifact[field] != delivered_artifact[field]:
            errors.append(f"Sanitization cannot change artifact {field}")
    if attestation["decision"] == "pass-through":
        if source_artifact != delivered_artifact:
            errors.append("Pass-through sanitization must preserve the exact artifact descriptor")
    elif (
        CLASSIFICATION_RANK[delivered_artifact["classification"]]
        > CLASSIFICATION_RANK[source_artifact["classification"]]
    ):
        errors.append("Sanitization cannot raise the delivered classification")
    if errors:
        raise IntegrityOnlyFailure(errors)


def verify_artifact_provenance_integrity_only(
    provenance: dict[str, Any],
    receipt: dict[str, Any],
    attestation: dict[str, Any],
    *,
    expected_source: dict[str, Any],
    expected_run_id: str,
    expected_phase_attempt_id: str,
    expected_harness_request_hash: str,
    expected_security_domain: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify a supplied provenance chain without claiming broker/run/store authority."""
    _validate_v2_document(provenance, "artifact-provenance.schema.json", documents)
    _verify_nested_artifact_descriptors_integrity_only(provenance, documents)
    _verify_self_hash(provenance, "Artifact provenance")
    errors = []
    for name, actual, expected in (
        ("run", provenance["runId"], expected_run_id),
        ("phase attempt", provenance["phaseAttemptId"], expected_phase_attempt_id),
        ("security domain", provenance["securityDomain"], expected_security_domain),
    ):
        if actual != expected:
            errors.append(f"Artifact provenance belongs to a different {name}")
    source = provenance["source"]
    if source != expected_source:
        errors.append("Artifact provenance source does not match the exact expected source")
    if source["kind"] == "phase-output" and source["producerRunId"] != expected_run_id:
        errors.append("Prior-phase provenance cannot cross run boundaries")
    if provenance["artifactReceiptHash"] != receipt["contentHash"]:
        errors.append("Artifact provenance receipt hash does not match the supplied receipt")
    if provenance["sanitizationAttestationHash"] != attestation["contentHash"]:
        errors.append("Artifact provenance attestation hash does not match the supplied attestation")
    if errors:
        raise IntegrityOnlyFailure(errors)
    verify_artifact_receipt_integrity_only(
        receipt,
        provenance["deliveredArtifact"],
        expected_run_id=expected_run_id,
        expected_security_domain=expected_security_domain,
        documents=documents,
    )
    verify_sanitization_attestation_integrity_only(
        attestation,
        provenance["sourceArtifact"],
        provenance["deliveredArtifact"],
        expected_run_id=expected_run_id,
        expected_phase_attempt_id=expected_phase_attempt_id,
        expected_harness_request_hash=expected_harness_request_hash,
        expected_security_domain=expected_security_domain,
        documents=documents,
    )


def verify_run_input_set_integrity_only(
    input_set: dict[str, Any],
    *,
    expected_run_id: str,
    expected_compiled_workflow_hash: str,
    expected_security_domain: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify deterministic input-set structure; signer and run authority remain external."""
    _validate_v2_document(input_set, "run-input-set.schema.json", documents)
    _verify_nested_artifact_descriptors_integrity_only(input_set, documents)
    _verify_self_hash(input_set, "Run input set")
    errors = []
    identifiers = [item["id"] for item in input_set["inputs"]]
    if len(identifiers) != len(set(identifiers)):
        errors.append("Run input set contains duplicate workflow input IDs")
    if input_set["runId"] != expected_run_id:
        errors.append("Run input set belongs to a different run")
    if input_set["compiledWorkflowHash"] != expected_compiled_workflow_hash:
        errors.append("Run input set belongs to a different compiled workflow")
    if input_set["securityDomain"] != expected_security_domain:
        errors.append("Run input set belongs to a different security domain")
    if errors:
        raise IntegrityOnlyFailure(errors)


def verify_phase_envelope_integrity_only(
    envelope: dict[str, Any],
    *,
    expected_run_id: str,
    expected_phase_id: str,
    expected_phase_attempt_id: str,
    expected_harness_request_hash: str,
    expected_compiled_workflow_hash: str,
    expected_input_provenance_hash: str,
    expected_security_domain: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify supplied result-receipt bindings without claiming issuer or ledger authority."""
    _validate_v2_document(envelope, "phase-envelope.schema.json", documents)
    _verify_nested_artifact_descriptors_integrity_only(envelope, documents)
    _verify_self_hash(envelope, "Phase envelope")
    errors = []
    for name, actual, expected in (
        ("run", envelope["runId"], expected_run_id),
        ("phase", envelope["phaseId"], expected_phase_id),
        ("phase attempt", envelope["phaseAttemptId"], expected_phase_attempt_id),
        ("harness request", envelope["harnessRequestHash"], expected_harness_request_hash),
        (
            "compiled workflow",
            envelope["compiledWorkflowHash"],
            expected_compiled_workflow_hash,
        ),
        (
            "input provenance",
            envelope["inputProvenanceHash"],
            expected_input_provenance_hash,
        ),
        ("security domain", envelope["securityDomain"], expected_security_domain),
    ):
        if actual != expected:
            errors.append(f"Phase envelope belongs to a different {name}")
    if (
        envelope["outputArtifact"] is not None
        and envelope["outputArtifact"]["schema"] != envelope["outputSchema"]
    ):
        errors.append("Phase output artifact does not match the declared output schema")
    if errors:
        raise IntegrityOnlyFailure(errors)


def validate_v2_documents_integrity_only(
    documents: dict[Path, dict[str, Any]],
    errors: list[str],
) -> None:
    """Apply deterministic v2 checks while making no authority or signature claim."""
    for path, document in documents.items():
        schema_id = document.get("$schema")
        if not isinstance(schema_id, str) or not schema_id.startswith(V2_SCHEMA_PREFIX):
            continue
        kind = document.get("documentKind")
        try:
            if kind == "artifact-descriptor":
                verify_artifact_descriptor_reference_integrity_only(document, documents)
            elif kind == "agent-context":
                _verify_self_hash(document, "Agent context")
                if document.get("generator") != AGENT_CONTEXT_GENERATOR:
                    raise IntegrityOnlyFailure(
                        ["Agent context generator is not the exact deterministic Phase A generator"]
                    )
                if document.get("allowlistHash") != AGENT_CONTEXT_ALLOWLIST_HASH:
                    raise IntegrityOnlyFailure(
                        ["Agent context allowlist hash does not match the fixed Phase A allowlist"]
                    )
            elif kind == "artifact-receipt":
                verify_artifact_receipt_integrity_only(
                    document,
                    document["artifact"],
                    expected_run_id=document["runId"],
                    expected_security_domain=document["securityDomain"],
                    documents=documents,
                )
            elif kind == "sanitization-attestation":
                verify_sanitization_attestation_integrity_only(
                    document,
                    document["sourceArtifact"],
                    document["deliveredArtifact"],
                    expected_run_id=document["runId"],
                    expected_phase_attempt_id=document["phaseAttemptId"],
                    expected_harness_request_hash=document["harnessRequestHash"],
                    expected_security_domain=document["securityDomain"],
                    documents=documents,
                )
            elif kind == "run-input-set":
                verify_run_input_set_integrity_only(
                    document,
                    expected_run_id=document["runId"],
                    expected_compiled_workflow_hash=document["compiledWorkflowHash"],
                    expected_security_domain=document["securityDomain"],
                    documents=documents,
                )
            elif kind == "phase-envelope":
                verify_phase_envelope_integrity_only(
                    document,
                    expected_run_id=document["runId"],
                    expected_phase_id=document["phaseId"],
                    expected_phase_attempt_id=document["phaseAttemptId"],
                    expected_harness_request_hash=document["harnessRequestHash"],
                    expected_compiled_workflow_hash=document["compiledWorkflowHash"],
                    expected_input_provenance_hash=document["inputProvenanceHash"],
                    expected_security_domain=document["securityDomain"],
                    documents=documents,
                )
            elif kind == "artifact-provenance":
                _verify_self_hash(document, kind.replace("-", " ").title())
                if (
                    document.get("source", {}).get("kind") == "phase-output"
                    and document["source"].get("producerRunId") != document.get("runId")
                ):
                    raise IntegrityOnlyFailure(
                        ["Prior-phase provenance cannot cross run boundaries"]
                    )
            if kind in V2_INTEGRITY_DOCUMENT_KINDS:
                for descriptor in _nested_artifact_descriptors(document):
                    verify_artifact_descriptor_reference_integrity_only(
                        descriptor, documents
                    )
        except (
            IntegrityOnlyFailure,
            canonical_json.CanonicalJsonError,
            KeyError,
            TypeError,
        ) as error:
            details = (
                error.errors
                if isinstance(error, IntegrityOnlyFailure)
                else ["v2 integrity document is structurally incomplete"]
            )
            errors.extend(f"{_safe_document_reference(path)}: {detail}" for detail in details)


def _payload_bytes(payload: Any, media_type: str) -> bytes:
    if media_type == "application/json":
        try:
            return canonical_json.canonical_json(payload).encode("utf-8")
        except canonical_json.CanonicalJsonError as error:
            raise IntegrityOnlyFailure(["JSON artifact is outside Factory canonical JSON"])
    if not isinstance(payload, bytes):
        raise IntegrityOnlyFailure(["Non-JSON artifact payload must be exact bytes"])
    return payload


def _verify_self_hash(document: dict[str, Any], label: str) -> None:
    expected = document.get("contentHash")
    try:
        actual = canonical_json.content_hash(
            {key: value for key, value in document.items() if key != "contentHash"}
        )
    except canonical_json.CanonicalJsonError as error:
        raise IntegrityOnlyFailure(
            [f"{label} is outside Factory canonical JSON"]
        ) from error
    if expected != actual:
        raise IntegrityOnlyFailure(
            [f"{label} content hash mismatch: expected {expected}, calculated {actual}"]
        )


def _validate_v2_document(
    document: dict[str, Any],
    schema_name: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    _validate_schema_id(document, f"{V2_SCHEMA_PREFIX}{schema_name}", documents, [])


def _validate_schema_id(
    document: Any,
    schema_id: str,
    documents: dict[Path, dict[str, Any]],
    errors: list[str],
) -> None:
    schemas = {
        value["$id"]: value
        for path, value in documents.items()
        if path.name.endswith(".schema.json") and isinstance(value.get("$id"), str)
    }
    schema = schemas.get(schema_id)
    if schema is None:
        raise IntegrityOnlyFailure([f"Trusted schema is unavailable: {schema_id}"])
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(value))
        for identifier, value in schemas.items()
    )
    validator = Draft202012Validator(
        schema,
        format_checker=FormatChecker(),
        registry=registry,
    )
    schema_errors = sorted(
        validator.iter_errors(document),
        key=lambda error: (tuple(str(part) for part in error.absolute_path), error.message),
    )
    if schema_errors:
        details = []
        for error in schema_errors:
            location = ".".join(str(part) for part in error.absolute_path)
            details.append(f"{schema_id}{'.' + location if location else ''}: {error.message}")
        if errors is not None:
            errors.extend(details)
        raise IntegrityOnlyFailure(details)


def _find_values(value: Any, key: str):
    if isinstance(value, dict):
        for current_key, current_value in value.items():
            if current_key == key:
                yield current_value
            yield from _find_values(current_value, key)
    elif isinstance(value, list):
        for item in value:
            yield from _find_values(item, key)


def _nested_artifact_descriptors(value: Any):
    if isinstance(value, dict):
        if value.get("documentKind") == "artifact-descriptor":
            yield value
            return
        for item in value.values():
            yield from _nested_artifact_descriptors(item)
    elif isinstance(value, list):
        for item in value:
            yield from _nested_artifact_descriptors(item)


def _verify_nested_artifact_descriptors_integrity_only(
    document: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    for descriptor in _nested_artifact_descriptors(document):
        verify_artifact_descriptor_reference_integrity_only(descriptor, documents)


def _safe_document_reference(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(ROOT.resolve()).as_posix()
    except (OSError, RuntimeError, ValueError):
        return "external-v2-document"
