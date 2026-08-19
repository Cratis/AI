#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Build and verify phase-scoped Factory harness requests without starting a worker."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json


HARNESS_REQUEST_SCHEMA = "https://schemas.cratis.io/factory/v1/harness-request.schema.json"
CLASSIFICATION_RANK = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "restricted": 3,
}


class HarnessRequestFailure(ValueError):
    """Raised when a harness request is not schema-valid or exactly compiler-bound."""

    def __init__(self, errors: list[str]) -> None:
        super().__init__("Factory harness request validation failed")
        self.errors = errors


def harness_request_hash(request: dict[str, Any]) -> str:
    """Hash one request using Factory canonical JSON v1 with requestHash omitted."""
    if not isinstance(request, dict):
        raise HarnessRequestFailure(["Harness request must be an object"])
    unhashed = {key: value for key, value in request.items() if key != "requestHash"}
    try:
        return canonical_json.content_hash(unhashed)
    except canonical_json.CanonicalJsonError as error:
        raise HarnessRequestFailure(
            [f"Harness request violates Factory canonical JSON v1: {error}"]
        ) from error


def seal_harness_request(request: dict[str, Any]) -> dict[str, Any]:
    """Return a detached request with its canonical self hash set."""
    sealed = deepcopy(request)
    sealed.pop("requestHash", None)
    sealed["requestHash"] = harness_request_hash(sealed)
    return sealed


def build_harness_request(
    documents: dict[Path, dict[str, Any]],
    compiled_workflow: dict[str, Any],
    phase_id: str,
    *,
    run_id: str,
    phase_attempt_id: str,
    objective: dict[str, Any],
    effective_classification: str,
    provider_policy: dict[str, Any],
    checkpoint: str,
    harness: str,
    model: str,
    reasoning: str,
    execution_limits: dict[str, Any],
    inputs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Derive every authority field from one compiled agent phase and seal the request."""
    _verify_compiled_hashes(compiled_workflow)
    phase = _find_agent_phase(compiled_workflow, phase_id)
    snapshot = compiled_workflow["repositoryBinding"]["repositorySnapshot"]
    resolved_profile = compiled_workflow["repositoryBinding"]["resolvedProfile"]
    execution = phase["execution"]

    request = {
        "$schema": HARNESS_REQUEST_SCHEMA,
        "protocolVersion": "1",
        "runId": run_id,
        "phaseAttemptId": phase_attempt_id,
        "compiledWorkflow": _compiled_workflow_binding(compiled_workflow),
        "phase": _phase_binding(phase),
        "repositoryBinding": _repository_binding(snapshot, resolved_profile),
        "effectivePolicy": deepcopy(compiled_workflow["effectivePolicy"]),
        "agent": {
            "definition": {
                "id": execution["id"],
                "contentHash": execution["contentHash"],
            },
            "role": execution["role"],
            "purpose": execution["purpose"],
            "capability": execution["capability"],
            "selectedFromProfiles": deepcopy(execution["selectedFromProfiles"]),
            "harness": harness,
            "providerReference": provider_policy["providerReference"],
            "model": model,
            "reasoning": reasoning,
        },
        "capabilityGrants": deepcopy(phase["capabilities"]),
        "objective": deepcopy(objective),
        "effectiveClassification": effective_classification,
        "providerPolicy": deepcopy(provider_policy),
        "workspace": {
            "repository": snapshot["repository"],
            "baseRevision": snapshot["revision"],
            "targetPath": snapshot["targetPath"],
            "checkpoint": checkpoint,
        },
        "executionLimits": deepcopy(execution_limits),
        "inputs": deepcopy(inputs),
        "outputSchema": deepcopy(phase["outputSchema"]),
    }
    sealed = seal_harness_request(request)
    verify_harness_request(sealed, compiled_workflow, documents)
    return sealed


def verify_harness_request(
    request: dict[str, Any],
    compiled_workflow: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify schema, self hash, and every binding to the supplied compiled workflow."""
    _validate_schema(request, documents)
    actual_hash = harness_request_hash(request)
    if request["requestHash"] != actual_hash:
        raise HarnessRequestFailure(
            [
                "Harness request content hash mismatch: "
                f"expected {request['requestHash']}, calculated {actual_hash}"
            ]
        )

    _verify_compiled_hashes(compiled_workflow)
    phase = _find_agent_phase(compiled_workflow, request["phase"]["id"])
    snapshot = compiled_workflow["repositoryBinding"]["repositorySnapshot"]
    resolved_profile = compiled_workflow["repositoryBinding"]["resolvedProfile"]
    execution = phase["execution"]

    expected_values = {
        "compiledWorkflow": _compiled_workflow_binding(compiled_workflow),
        "phase": _phase_binding(phase),
        "repositoryBinding": _repository_binding(snapshot, resolved_profile),
        "effectivePolicy": compiled_workflow["effectivePolicy"],
        "capabilityGrants": phase["capabilities"],
        "outputSchema": phase["outputSchema"],
    }
    errors = [
        f"Harness request {name} does not match the exact compiled workflow binding"
        for name, expected in expected_values.items()
        if request[name] != expected
    ]

    expected_agent = {
        "definition": {
            "id": execution["id"],
            "contentHash": execution["contentHash"],
        },
        "role": execution["role"],
        "purpose": execution["purpose"],
        "capability": execution["capability"],
        "selectedFromProfiles": execution["selectedFromProfiles"],
    }
    for name, expected in expected_agent.items():
        if request["agent"][name] != expected:
            errors.append(f"Harness request agent.{name} does not match the compiled agent phase")

    if request["agent"]["providerReference"] != request["providerPolicy"]["providerReference"]:
        errors.append(
            "Harness request agent.providerReference does not match "
            "providerPolicy.providerReference"
        )

    expected_workspace = {
        "repository": snapshot["repository"],
        "baseRevision": snapshot["revision"],
        "targetPath": snapshot["targetPath"],
    }
    for name, expected in expected_workspace.items():
        if request["workspace"][name] != expected:
            errors.append(f"Harness request workspace.{name} does not match the repository snapshot")

    if request["executionLimits"]["timeoutSeconds"] > phase["policy"]["timeoutSeconds"]:
        errors.append("Harness request timeout exceeds the compiled phase timeout")

    expected_input_names = [value["name"] for value in phase["inputs"]]
    actual_input_names = [value["name"] for value in request["inputs"]]
    if actual_input_names != expected_input_names:
        errors.append("Harness request inputs do not match the ordered compiled phase inputs")

    declared_input_bytes = sum(value["artifact"]["sizeBytes"] for value in request["inputs"])
    if declared_input_bytes > request["executionLimits"]["maxInputBytes"]:
        errors.append("Harness request input artifact sizes exceed maxInputBytes")

    classifications = [request["objective"]["classification"]]
    classifications.extend(value["artifact"]["classification"] for value in request["inputs"])
    required_classification = max(classifications, key=CLASSIFICATION_RANK.__getitem__)
    if CLASSIFICATION_RANK[request["effectiveClassification"]] < CLASSIFICATION_RANK[required_classification]:
        errors.append("Harness request effective classification is lower than supplied content")

    if errors:
        raise HarnessRequestFailure(errors)


def _validate_schema(
    request: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    if not isinstance(request, dict):
        raise HarnessRequestFailure(["Harness request must be an object"])
    schemas = {
        document["$id"]: document
        for document in documents.values()
        if isinstance(document.get("$id"), str) and document.get("$schema") == "https://json-schema.org/draft/2020-12/schema"
    }
    schema = schemas.get(HARNESS_REQUEST_SCHEMA)
    if schema is None:
        raise HarnessRequestFailure(["Trusted harness-request schema is unavailable"])
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document))
        for identifier, document in schemas.items()
    )
    validator = Draft202012Validator(
        schema,
        format_checker=FormatChecker(),
        registry=registry,
    )
    schema_errors = sorted(
        validator.iter_errors(request),
        key=lambda error: (tuple(str(part) for part in error.absolute_path), error.message),
    )
    if schema_errors:
        details = []
        for error in schema_errors:
            location = ".".join(str(part) for part in error.absolute_path)
            details.append(f"harness-request{'.' + location if location else ''}: {error.message}")
        raise HarnessRequestFailure(details)


def _verify_compiled_hashes(compiled_workflow: dict[str, Any]) -> None:
    if not isinstance(compiled_workflow, dict):
        raise HarnessRequestFailure(["Compiled workflow must be an object"])
    _verify_self_hash(compiled_workflow, "Compiled workflow")
    try:
        repository_binding = compiled_workflow["repositoryBinding"]
        _verify_self_hash(repository_binding["repositorySnapshot"], "Repository snapshot")
        _verify_self_hash(repository_binding["resolvedProfile"], "Resolved profile")
        _verify_self_hash(compiled_workflow["effectivePolicy"], "Effective policy")
    except (KeyError, TypeError) as error:
        raise HarnessRequestFailure(["Compiled workflow is missing a required authority binding"]) from error


def _verify_self_hash(document: dict[str, Any], label: str) -> None:
    if not isinstance(document, dict):
        raise HarnessRequestFailure([f"{label} must be an object"])
    expected_hash = document.get("contentHash")
    unhashed = {key: value for key, value in document.items() if key != "contentHash"}
    try:
        actual_hash = canonical_json.content_hash(unhashed)
    except canonical_json.CanonicalJsonError as error:
        raise HarnessRequestFailure([f"{label} violates Factory canonical JSON v1: {error}"]) from error
    if expected_hash != actual_hash:
        raise HarnessRequestFailure(
            [f"{label} content hash mismatch: expected {expected_hash}, calculated {actual_hash}"]
        )


def _find_agent_phase(compiled_workflow: dict[str, Any], phase_id: str) -> dict[str, Any]:
    try:
        matches = [phase for phase in compiled_workflow["orderedPhases"] if phase["id"] == phase_id]
    except (KeyError, TypeError) as error:
        raise HarnessRequestFailure(["Compiled workflow has no usable ordered phases"]) from error
    if len(matches) != 1:
        raise HarnessRequestFailure(
            [f"Expected exactly one compiled phase {phase_id}; found {len(matches)}"]
        )
    phase = matches[0]
    if phase.get("kind") != "agent" or phase.get("execution", {}).get("kind") != "agent":
        raise HarnessRequestFailure([f"Compiled phase {phase_id} is not an agent phase"])
    _verify_agent_capability_grant(phase)
    return phase


def _verify_agent_capability_grant(phase: dict[str, Any]) -> None:
    """Require one exact allow grant for the agent capability declared by compilation."""
    try:
        capability = phase["execution"]["capability"]
        grants = phase["capabilities"]
    except (KeyError, TypeError) as error:
        raise HarnessRequestFailure(
            ["Compiled agent phase is missing its explicit capability authority"]
        ) from error
    expected = [
        grant
        for grant in grants
        if grant.get("usage") == "agent" and grant.get("sourceId") == phase.get("id")
    ]
    if len(expected) != 1 or expected[0].get("id") != capability or expected[0].get("decision") != "allow":
        raise HarnessRequestFailure(
            [
                f"Compiled agent phase {phase.get('id', 'unknown')} does not contain one exact "
                f"allow grant for declared capability {capability}"
            ]
        )


def _compiled_workflow_binding(compiled_workflow: dict[str, Any]) -> dict[str, Any]:
    return {
        "compilerVersion": compiled_workflow["compilerVersion"],
        "workflow": deepcopy(compiled_workflow["workflow"]),
        "contentHash": compiled_workflow["contentHash"],
    }


def _phase_binding(phase: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": phase["id"],
        "ordinal": phase["ordinal"],
        "policy": deepcopy(phase["policy"]),
    }


def _repository_binding(
    snapshot: dict[str, Any],
    resolved_profile: dict[str, Any],
) -> dict[str, Any]:
    return {
        "repositorySnapshot": {
            "contentHash": snapshot["contentHash"],
        },
        "resolvedProfile": {
            "contentHash": resolved_profile["contentHash"],
            "profiles": deepcopy(resolved_profile["profiles"]),
            "skills": deepcopy(resolved_profile["skills"]),
            "capabilities": deepcopy(resolved_profile["capabilities"]),
        },
    }
