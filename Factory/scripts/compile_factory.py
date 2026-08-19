#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Compile validated Factory definitions into an immutable, harness-neutral workflow plan."""

from __future__ import annotations

import argparse
from copy import deepcopy
from fnmatch import fnmatchcase
from functools import lru_cache
import heapq
import json
from pathlib import Path
import sys
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json
import operation_result
import validate_factory


COMPILER_VERSION = "0.3.0"
WRITE_EFFECTS = frozenset({"write", "destructive"})
MAXIMUM_WRITE_SCOPE_SEGMENTS = 64
_UNSAFE_SCOPE_SEGMENTS = frozenset({"", ".", ".."})
_SCOPE_WILDCARDS = "*?["
COMPILED_WORKFLOW_SCHEMA = "https://schemas.cratis.io/factory/v1/compiled-workflow.schema.json"
# The shared character class lives in
# operation_result.PROJECTION_CONTROL_CHARACTERS so this sanitizer cannot
# drift from it independently again.
_TERMINAL_CONTROL = operation_result.PROJECTION_CONTROL_CHARACTERS


class CompilationFailure(Exception):
    """Raised when Factory definitions cannot be compiled safely."""

    def __init__(self, errors: list[str]) -> None:
        super().__init__("Factory compilation failed")
        self.errors = errors


class CompilationCanonicalFailure(CompilationFailure):
    """Raised when compiler input cannot participate in canonical cross-runtime hashing."""


class CompilationIntegrityFailure(CompilationFailure):
    """Raised when a supplied compiled plan fails content or deterministic integrity."""


class CompilationHashFailure(CompilationIntegrityFailure):
    """Raised when a supplied document does not match its declared content hash."""


class DirectCompilationDisabled(CompilationFailure):
    """Raised when the public command is invoked without integrity-only verification."""


class _OperationArgumentParser(argparse.ArgumentParser):
    """Render invocation failures through the shared operation-result contract."""

    def error(self, message: str) -> None:
        raw_arguments = sys.argv[1:]
        output_format = _requested_output_format(raw_arguments)
        request_hash = _invocation_request_hash(raw_arguments)
        action = _correct_plan_action(
            "correct-compiler-invocation",
            "Correct the compiler verification invocation",
            "Supply exactly one compiled workflow with --verify-plan and a supported output format.",
        )
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-COMPILER-INVOCATION-INVALID",
            "error",
            (
                "Factory compiler verification invocation is invalid; supply one plan with "
                "--verify-plan and choose text, json, or json-compact output."
            ),
            "retry-after-correction",
            "Correct the command arguments and run verification again.",
            related_action_ids=[action["id"]],
        )
        envelope = operation_result.make_operation_result(
            "verify",
            "invocation-error",
            "Factory compiler verification invocation is invalid.",
            request_hash,
            diagnostics=[diagnostic],
            next_actions=[action],
            side_effects_occurred=False,
        )
        print(operation_result.render_operation_result(envelope, output_format), end="")
        raise SystemExit(operation_result.exit_code_for_status("invocation-error"))


def compile_documents(
    documents: dict[Path, dict[str, Any]],
    workflow_id: str,
    resolved_profile: dict[str, Any],
    repository_snapshot: dict[str, Any],
    policy_id: str,
    denied_capabilities: list[str] | None = None,
    project_manifest_hash: str | None = None,
) -> dict[str, Any]:
    """Compile an immutable preflight plan from exact repository resolution facts."""
    errors = validate_factory.validate_documents(documents)
    if errors:
        raise CompilationFailure(errors)

    workflow_path, workflow = _find_document(documents, "workflow", workflow_id)
    _, policy = _find_document(documents, "policy", policy_id)
    catalog_documents = {
        path: document
        for path, document in documents.items()
        if document.get("documentKind") == "capability-catalog"
    }
    capabilities = validate_factory.validate_capability_catalogs(catalog_documents, [])
    _validate_runtime_document(
        resolved_profile,
        "https://schemas.cratis.io/factory/v1/resolved-profile.schema.json",
        "resolved-profile",
        documents,
    )
    _validate_runtime_document(
        repository_snapshot,
        "https://schemas.cratis.io/factory/v1/repository-snapshot.schema.json",
        "repository-snapshot",
        documents,
    )
    verify_resolved_profile_hash(resolved_profile)
    verify_repository_snapshot_hash(repository_snapshot)
    if repository_snapshot["dirty"]:
        raise CompilationFailure(
            ["Dirty repository snapshots cannot be compiled into an executable preflight plan"]
        )

    profiles = _resolved_profile_documents(resolved_profile, documents)
    _validate_resolution_references(resolved_profile, profiles, documents)
    if repository_snapshot["targetPath"] != resolved_profile["targetPath"]:
        raise CompilationFailure(
            [
                "Repository snapshot targetPath does not match the resolved profile targetPath: "
                f"{repository_snapshot['targetPath']} != {resolved_profile['targetPath']}"
            ]
        )
    if resolved_profile["blockedReasons"]:
        raise CompilationFailure(
            [f"Resolved profile is blocked: {reason}" for reason in resolved_profile["blockedReasons"]]
        )

    workflow_reference = next(
        (
            reference
            for reference in resolved_profile["workflows"]
            if reference["id"] == workflow_id
            and reference["purpose"] == resolved_profile["purpose"]
            and reference["contentHash"] == canonical_json.content_hash(workflow)
        ),
        None,
    )
    if workflow_reference is None:
        raise CompilationFailure(
            [
                f"Workflow {workflow_id} is not an exact eligible workflow in resolved profile "
                f"{resolved_profile['contentHash']}"
            ]
        )

    missing_profile_capabilities = sorted(
        set(workflow["profileRequirements"]["allOf"]) - set(resolved_profile["capabilities"])
    )
    if missing_profile_capabilities:
        raise CompilationFailure(
            [
                f"Workflows/{workflow_id}: resolved profiles do not provide: "
                f"{', '.join(missing_profile_capabilities)}"
            ]
        )

    effective_policy = _effective_policy(
        policy,
        denied_capabilities or [],
        project_manifest_hash,
    )

    ordered_phases = []
    phases_by_id = {phase["id"]: phase for phase in workflow["phases"]}
    for ordinal, phase_id in enumerate(_topological_order(workflow["phases"])):
        phase = phases_by_id[phase_id]
        grants = _capability_grants(
            phase,
            capabilities,
            policy,
            set(effective_policy["deniedCapabilities"]),
        )
        _evaluate_phase_scopes(phase, grants, policy)
        compiled_phase: dict[str, Any] = {
            "id": phase_id,
            "ordinal": ordinal,
            "kind": phase["kind"],
            "needs": sorted(phase["needs"]),
            "inputs": deepcopy(phase["inputs"]),
            "outputSchema": _schema_reference(workflow_path, phase["outputSchema"], documents),
            "execution": _execution(profiles, phase),
            "policy": deepcopy(phase["policy"]),
            "capabilities": grants,
            "gates": deepcopy(phase["gates"]),
        }
        if "correction" in phase:
            compiled_phase["correction"] = deepcopy(phase["correction"])
        ordered_phases.append(compiled_phase)

    compiled: dict[str, Any] = {
        "$schema": "https://schemas.cratis.io/factory/v1/compiled-workflow.schema.json",
        "protocolVersion": "1",
        "documentKind": "compiled-workflow",
        "compilerVersion": COMPILER_VERSION,
        "workflow": _versioned_reference(workflow),
        "repositoryBinding": {
            "repositorySnapshot": deepcopy(repository_snapshot),
            "resolvedProfile": deepcopy(resolved_profile),
        },
        "effectivePolicy": effective_policy,
        "capabilityCatalogs": [
            _versioned_reference(catalog)
            for path, catalog in sorted(catalog_documents.items(), key=lambda item: item[1]["id"])
        ],
        "workflowInputs": [
            {
                "id": workflow_input["id"],
                "schema": _schema_reference(workflow_path, workflow_input["schema"], documents),
                "binding": _workflow_input_binding(
                    workflow_input,
                    resolved_profile,
                    repository_snapshot,
                ),
            }
            for workflow_input in workflow["inputs"]
        ],
        "orderedPhases": ordered_phases,
        "requiredGateIds": sorted(workflow["acceptance"]["requiredGateIds"]),
        "terminal": deepcopy(workflow["terminal"]),
    }
    compiled["contentHash"] = canonical_json.content_hash(compiled)
    _validate_compiled_workflow(compiled, documents)
    verify_compiled_workflow_hash(compiled)
    return compiled


def _validate_runtime_document(
    document: dict[str, Any],
    schema_id: str,
    label: str,
    documents: dict[Path, dict[str, Any]],
) -> None:
    schemas = {
        value["$id"]: value
        for path, value in documents.items()
        if path.parent == validate_factory.CONTRACTS and path.name.endswith(".schema.json")
    }
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(value)) for identifier, value in schemas.items()
    )
    validator = Draft202012Validator(
        schemas[schema_id],
        format_checker=FormatChecker(),
        registry=registry,
    )
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    if errors:
        diagnostics = []
        for error in errors:
            json_path = ".".join(str(part) for part in error.absolute_path)
            diagnostics.append(f"{label}{'.' + json_path if json_path else ''}: {error.message}")
        raise CompilationFailure(diagnostics)


def _verify_self_hash(document: dict[str, Any], label: str) -> None:
    expected_hash = document.get("contentHash")
    unhashed = {key: value for key, value in document.items() if key != "contentHash"}
    try:
        actual_hash = canonical_json.content_hash(unhashed)
    except canonical_json.CanonicalJsonError as error:
        raise CompilationCanonicalFailure(
            [f"{label} contains a value outside Factory canonical JSON v1"]
        ) from error
    if expected_hash != actual_hash:
        raise CompilationHashFailure(
            [f"{label} content hash mismatch: expected {expected_hash}, calculated {actual_hash}"]
        )


def verify_resolved_profile_hash(resolved_profile: dict[str, Any]) -> None:
    """Verify the self-addressed repository resolution artifact."""
    _verify_self_hash(resolved_profile, "Resolved profile")


def verify_repository_snapshot_hash(repository_snapshot: dict[str, Any]) -> None:
    """Verify the self-addressed immutable repository snapshot artifact."""
    _verify_self_hash(repository_snapshot, "Repository snapshot")


def verify_effective_policy_hash(effective_policy: dict[str, Any]) -> None:
    """Verify the self-addressed effective policy binding."""
    _verify_self_hash(effective_policy, "Effective policy")


def _resolved_profile_documents(
    resolved_profile: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> list[dict[str, Any]]:
    references = resolved_profile["profiles"]
    identifiers = [reference["id"] for reference in references]
    if len(identifiers) != len(set(identifiers)):
        raise CompilationFailure(["Resolved profile contains duplicate profile references"])

    profiles: list[dict[str, Any]] = []
    for reference in references:
        _, profile = _find_document(documents, "profile", reference["id"])
        expected = _versioned_reference(profile)
        if reference != expected:
            raise CompilationFailure(
                [
                    f"Resolved profile reference {reference['id']} does not match trusted profile bytes: "
                    f"expected {expected}, received {reference}"
                ]
            )
        profiles.append(profile)

    selected_ids = set(identifiers)
    conflicts = sorted(
        {
            f"{profile['id']} excludes {excluded}"
            for profile in profiles
            for excluded in profile["excludes"]
            if excluded in selected_ids
        }
    )
    if conflicts:
        raise CompilationFailure([f"Resolved profile conflict: {conflict}" for conflict in conflicts])
    return sorted(profiles, key=lambda profile: profile["id"])


def _rank_recommendations(
    profiles: list[dict[str, Any]],
    kind: str,
    purpose: str,
    documents: dict[Path, dict[str, Any]],
) -> list[dict[str, Any]]:
    recommendations: dict[str, dict[str, Any]] = {}
    for profile in sorted(profiles, key=lambda item: item["id"]):
        for recommendation in profile["recommendations"][kind]:
            if purpose not in recommendation["purposes"]:
                continue
            existing = recommendations.get(recommendation["id"])
            if existing is None or recommendation["priority"] > existing["priority"]:
                recommendations[recommendation["id"]] = recommendation

    ranked: list[dict[str, Any]] = []
    for identifier, recommendation in recommendations.items():
        if kind == "agents":
            content_hash = canonical_json.bytes_content_hash(
                (validate_factory.ROOT / ".ai" / "agents" / f"{identifier}.md").read_bytes()
            )
        else:
            _, workflow = _find_document(documents, "workflow", identifier)
            content_hash = canonical_json.content_hash(workflow)
        ranked.append(
            {
                "id": identifier,
                "purpose": purpose,
                "priority": recommendation["priority"],
                "rationale": recommendation["rationale"],
                "contentHash": content_hash,
            }
        )
    return sorted(ranked, key=lambda item: (-item["priority"], item["id"]))


def _validate_resolution_references(
    resolved_profile: dict[str, Any],
    profiles: list[dict[str, Any]],
    documents: dict[Path, dict[str, Any]],
) -> None:
    expected_capabilities = sorted(
        {capability for profile in profiles for capability in profile["provides"]}
    )
    if resolved_profile["capabilities"] != expected_capabilities:
        raise CompilationFailure(
            [
                "Resolved capabilities do not equal the exact selected-profile union: "
                f"expected {expected_capabilities}, received {resolved_profile['capabilities']}"
            ]
        )

    expected_skills = sorted(
        (
            {
                "id": skill_id,
                "contentHash": canonical_json.bytes_content_hash(
                    (validate_factory.ROOT / ".ai" / "skills" / skill_id / "SKILL.md").read_bytes()
                ),
            }
            for skill_id in {skill for profile in profiles for skill in profile["skills"]}
        ),
        key=lambda item: item["id"],
    )
    if resolved_profile["skills"] != expected_skills:
        raise CompilationFailure(["Resolved skills do not match the exact selected profile skill bytes"])

    for reference in resolved_profile["agents"]:
        candidates = _rank_recommendations(profiles, "agents", reference["purpose"], documents)
        if reference not in candidates:
            raise CompilationFailure(
                [
                    f"Resolved agent {reference['id']} is not an exact eligible recommendation "
                    f"for purpose {reference['purpose']}"
                ]
            )

    for reference in resolved_profile["workflows"]:
        candidates = _rank_recommendations(profiles, "workflows", reference["purpose"], documents)
        if reference not in candidates:
            raise CompilationFailure(
                [
                    f"Resolved workflow {reference['id']} is not an exact profile recommendation "
                    f"for purpose {reference['purpose']}"
                ]
            )
        _, workflow = _find_document(documents, "workflow", reference["id"])
        missing = sorted(
            set(workflow["profileRequirements"]["allOf"])
            - set(resolved_profile["capabilities"])
        )
        if missing:
            raise CompilationFailure(
                [
                    f"Resolved workflow {reference['id']} is not eligible; missing capabilities: "
                    f"{', '.join(missing)}"
                ]
            )


def _effective_policy(
    policy: dict[str, Any],
    denied_capabilities: list[str],
    project_manifest_hash: str | None,
) -> dict[str, Any]:
    denied = sorted(set(denied_capabilities))
    unknown = sorted(set(denied) - set(policy["capabilities"]))
    if unknown:
        raise CompilationFailure(
            [
                "Project policy can only narrow known base-policy capabilities: "
                f"{', '.join(unknown)}"
            ]
        )
    effective: dict[str, Any] = {
        "base": _versioned_reference(policy),
        "projectManifestHash": project_manifest_hash,
        "deniedCapabilities": denied,
    }
    effective["contentHash"] = canonical_json.content_hash(effective)
    return effective


def _workflow_input_binding(
    workflow_input: dict[str, Any],
    resolved_profile: dict[str, Any],
    repository_snapshot: dict[str, Any],
) -> dict[str, Any]:
    if workflow_input["source"] == "request":
        return {"kind": "request"}
    values = {
        "repository-snapshot": repository_snapshot,
        "resolved-profile": resolved_profile,
    }
    value_id = workflow_input["preflightValue"]
    expected_schema = f"../Contracts/v1/{value_id}.schema.json"
    if workflow_input["schema"] != expected_schema:
        raise CompilationFailure(
            [
                f"Preflight workflow input {workflow_input['id']} binds {value_id} but declares "
                f"schema {workflow_input['schema']}; expected {expected_schema}"
            ]
        )
    value = values[value_id]
    return {
        "kind": "preflight",
        "value": value_id,
        "contentHash": value["contentHash"],
    }


def _find_document(
    documents: dict[Path, dict[str, Any]],
    document_kind: str,
    identifier: str,
) -> tuple[Path, dict[str, Any]]:
    matches = [
        (path, document)
        for path, document in documents.items()
        if document.get("documentKind") == document_kind and document.get("id") == identifier
    ]
    if len(matches) != 1:
        raise CompilationFailure(
            [f"Expected exactly one {document_kind} with id {identifier}; found {len(matches)}"]
        )
    return matches[0]


def _topological_order(phases: list[dict[str, Any]]) -> list[str]:
    dependencies = {phase["id"]: set(phase["needs"]) for phase in phases}
    dependents: dict[str, list[str]] = {phase["id"]: [] for phase in phases}
    for phase_id, needs in dependencies.items():
        for dependency in needs:
            dependents[dependency].append(phase_id)

    ready = [phase_id for phase_id, needs in dependencies.items() if not needs]
    heapq.heapify(ready)
    ordered: list[str] = []
    while ready:
        phase_id = heapq.heappop(ready)
        ordered.append(phase_id)
        for dependent in sorted(dependents[phase_id]):
            dependencies[dependent].remove(phase_id)
            if not dependencies[dependent]:
                heapq.heappush(ready, dependent)
    if len(ordered) != len(phases):
        raise CompilationFailure(["Workflow dependency graph contains a cycle"])
    return ordered


def _capability_uses(phase: dict[str, Any]) -> list[tuple[str, str, str]]:
    uses: list[tuple[str, str, str]] = []
    if phase["kind"] in {"agent", "code"}:
        usage = "agent" if phase["kind"] == "agent" else "phase"
        uses.append((phase["capability"], usage, phase["id"]))
    for gate in phase["gates"]:
        if "capability" in gate:
            uses.append((gate["capability"], "gate", gate["id"]))
    return sorted(uses, key=lambda item: (item[1], item[2], item[0]))


def required_policy_capabilities(
    workflow: dict[str, Any],
    capabilities: dict[str, dict[str, Any]],
) -> list[str]:
    """Return the exact base-policy capabilities used by workflow phases and gates."""
    return sorted(
        {
            capabilities[capability_id]["policyCapability"]
            for phase in workflow["phases"]
            for capability_id, _, _ in _capability_uses(phase)
        }
    )


def _evaluate_phase_scopes(
    phase: dict[str, Any],
    grants: list[dict[str, str]],
    policy: dict[str, Any],
) -> None:
    """Decide whether a phase's requested scopes are permitted by the policy it compiles under."""
    unsupported = [
        name for name in ("networkScopes", "secretScopes") if phase["policy"][name]
    ]
    if unsupported:
        raise CompilationFailure(
            [
                f"Phase {phase['id']} requests {', '.join(unsupported)}, but policy "
                f"{policy['id']} declares no network or secret vocabulary to evaluate them against"
            ]
        )
    write_scopes = phase["policy"]["writeScopes"]
    if not write_scopes:
        return
    if not any(grant["effect"] in WRITE_EFFECTS for grant in grants):
        raise CompilationFailure(
            [
                f"Phase {phase['id']} requests writeScopes, but holds no granted capability "
                "whose effect permits writing"
            ]
        )
    for scope in sorted(write_scopes):
        defect = _write_scope_defect(scope)
        if defect is not None:
            raise CompilationFailure(
                [f"Phase {phase['id']} declares an unusable write scope: {defect}"]
            )
        intersected = sorted(
            pattern
            for pattern in policy["protectedPaths"]
            if _globs_can_intersect(_scope_segments(scope), _scope_segments(pattern))
        )
        if intersected:
            raise CompilationFailure(
                [
                    f"Phase {phase['id']} write scope {scope} can reach policy "
                    f"{policy['id']} protected path {intersected[0]}"
                ]
            )


def _write_scope_defect(scope: str) -> str | None:
    if not scope:
        return "an empty write scope names no repository path"
    if _TERMINAL_CONTROL.search(scope):
        return "a write scope cannot contain control characters"
    if "\\" in scope:
        return f"write scope {scope} must separate segments with forward slashes"
    if ":" in scope:
        return f"write scope {scope} cannot carry a drive or scheme separator"
    if scope.startswith("~"):
        return f"write scope {scope} cannot be resolved against a home directory"
    if scope.startswith("/"):
        return f"write scope {scope} must be repository-relative"
    segments = _scope_segments(scope)
    if any(segment in _UNSAFE_SCOPE_SEGMENTS for segment in segments):
        return f"write scope {scope} must be a normalized repository-relative path"
    if len(segments) > MAXIMUM_WRITE_SCOPE_SEGMENTS:
        return f"write scope {scope} exceeds {MAXIMUM_WRITE_SCOPE_SEGMENTS} path segments"
    return None


def _scope_segments(pattern: str) -> tuple[str, ...]:
    return tuple(segment.casefold() for segment in pattern.split("/"))


@lru_cache(maxsize=4096)
def _globs_can_intersect(left: tuple[str, ...], right: tuple[str, ...]) -> bool:
    if not left or not right:
        return all(segment == "**" for segment in left + right)
    if left[0] == "**" or right[0] == "**":
        return (
            _globs_can_intersect(left[1:], right)
            or _globs_can_intersect(left, right[1:])
            or _globs_can_intersect(left[1:], right[1:])
        )
    if not _segments_can_intersect(left[0], right[0]):
        return False
    return _globs_can_intersect(left[1:], right[1:])


def _segments_can_intersect(left: str, right: str) -> bool:
    left_is_pattern = any(wildcard in left for wildcard in _SCOPE_WILDCARDS)
    right_is_pattern = any(wildcard in right for wildcard in _SCOPE_WILDCARDS)
    if left_is_pattern and right_is_pattern:
        return True
    if left_is_pattern:
        return fnmatchcase(right, left)
    if right_is_pattern:
        return fnmatchcase(left, right)
    return left == right


def _validate_stage_zero_phase_scopes(phase: dict[str, Any]) -> None:
    """Definition-level parity check; the compile path uses the policy-aware evaluator above."""
    unsupported = [
        name
        for name in ("writeScopes", "networkScopes", "secretScopes")
        if phase["policy"][name]
    ]
    if unsupported:
        raise CompilationFailure(
            [
                f"Phase {phase['id']} requests {', '.join(unsupported)}, but Stage 0 has no "
                "trusted scope-to-capability policy evaluator; non-empty scopes remain blocked"
            ]
        )


def _capability_grants(
    phase: dict[str, Any],
    capabilities: dict[str, dict[str, Any]],
    policy: dict[str, Any],
    denied_capabilities: set[str],
) -> list[dict[str, str]]:
    grants: list[dict[str, str]] = []
    for capability_id, usage, source_id in _capability_uses(phase):
        definition = capabilities[capability_id]
        policy_capability = definition["policyCapability"]
        decision = (
            "deny"
            if policy_capability in denied_capabilities
            else policy["capabilities"].get(policy_capability, policy["defaultDecision"])
        )
        if decision != "allow":
            raise CompilationFailure(
                [
                    f"Phase {phase['id']} cannot use {capability_id}: policy capability "
                    f"{policy_capability} resolves to {decision}"
                ]
            )
        grants.append(
            {
                "id": capability_id,
                "usage": usage,
                "sourceId": source_id,
                "effect": definition["effect"],
                "policyCapability": policy_capability,
                "decision": decision,
            }
        )
    return grants


def _execution(profiles: list[dict[str, Any]], phase: dict[str, Any]) -> dict[str, Any]:
    if phase["kind"] == "agent":
        return _select_agent(profiles, phase)
    if phase["kind"] == "code":
        return {
            "kind": "code",
            "capability": phase["capability"],
        }
    return {
        "kind": "human",
        "approval": deepcopy(phase["approval"]),
    }


def _select_agent(profiles: list[dict[str, Any]], phase: dict[str, Any]) -> dict[str, Any]:
    purpose = phase["purpose"]
    candidates: dict[str, dict[str, Any]] = {}
    for profile in sorted(profiles, key=lambda item: item["id"]):
        for recommendation in profile["recommendations"]["agents"]:
            if purpose not in recommendation["purposes"]:
                continue
            existing = candidates.get(recommendation["id"])
            if existing is None or recommendation["priority"] > existing["priority"]:
                candidates[recommendation["id"]] = recommendation
    if not candidates:
        raise CompilationFailure(
            [
                f"Phase {phase['id']} has no agent recommendation for purpose {purpose} "
                f"in resolved profiles {', '.join(profile['id'] for profile in profiles)}"
            ]
        )
    selected = sorted(candidates.values(), key=lambda item: (-item["priority"], item["id"]))[0]
    selected_from_profiles = sorted(
        profile["id"]
        for profile in profiles
        if any(
            recommendation["id"] == selected["id"] and purpose in recommendation["purposes"]
            for recommendation in profile["recommendations"]["agents"]
        )
    )
    agent_path = validate_factory.ROOT / ".ai" / "agents" / f"{selected['id']}.md"
    return {
        "kind": "agent",
        "id": selected["id"],
        "role": phase["role"],
        "purpose": purpose,
        "capability": phase["capability"],
        "priority": selected["priority"],
        "rationale": selected["rationale"],
        "contentHash": canonical_json.bytes_content_hash(agent_path.read_bytes()),
        "selectedFromProfiles": selected_from_profiles,
    }


def _versioned_reference(document: dict[str, Any]) -> dict[str, str]:
    return {
        "id": document["id"],
        "version": document["version"],
        "contentHash": canonical_json.content_hash(document),
    }


def _schema_reference(
    owner_path: Path,
    reference: str,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, str]:
    schema_path = (owner_path.parent / reference).resolve()
    return {
        "reference": str(schema_path.relative_to(validate_factory.ROOT)),
        "contentHash": _schema_closure_hash(schema_path, documents),
    }


def _schema_closure_hash(
    root_schema_path: Path,
    documents: dict[Path, dict[str, Any]],
) -> str:
    schemas_by_id = {
        document["$id"]: (path, document)
        for path, document in documents.items()
        if path.parent == validate_factory.CONTRACTS and path.name.endswith(".schema.json")
    }
    root_document = documents[root_schema_path]
    pending = [root_document]
    closure: dict[str, dict[str, Any]] = {}
    while pending:
        document = pending.pop()
        identifier = document["$id"]
        if identifier in closure:
            continue
        closure[identifier] = document
        for reference in validate_factory.find_values(document, "$ref"):
            if not isinstance(reference, str) or reference.startswith("#"):
                continue
            referenced_identifier = reference.split("#", maxsplit=1)[0]
            referenced = schemas_by_id.get(referenced_identifier)
            if referenced is not None:
                pending.append(referenced[1])
    return canonical_json.content_hash(
        {
            "root": root_document["$id"],
            "schemas": closure,
        }
    )


def verify_compiled_workflow_hash(compiled: dict[str, Any]) -> None:
    _reject_unsafe_compiled_ordinals(compiled)
    expected_hash = compiled.get("contentHash")
    unhashed = {key: value for key, value in compiled.items() if key != "contentHash"}
    try:
        actual_hash = canonical_json.content_hash(unhashed)
    except canonical_json.CanonicalJsonError as error:
        raise CompilationCanonicalFailure(
            ["Compiled workflow contains a value outside Factory canonical JSON v1"]
        ) from error
    if expected_hash != actual_hash:
        raise CompilationHashFailure(
            [f"Compiled workflow content hash mismatch: expected {expected_hash}, calculated {actual_hash}"]
        )


def verify_compiled_workflow_integrity(
    compiled: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Verify plan integrity against definitions, without asserting repository authority."""
    _validate_compiled_workflow(compiled, documents)
    verify_compiled_workflow_hash(compiled)
    repository_binding = compiled["repositoryBinding"]
    verify_repository_snapshot_hash(repository_binding["repositorySnapshot"])
    verify_resolved_profile_hash(repository_binding["resolvedProfile"])
    verify_effective_policy_hash(compiled["effectivePolicy"])

    expected = compile_documents(
        documents,
        compiled["workflow"]["id"],
        repository_binding["resolvedProfile"],
        repository_binding["repositorySnapshot"],
        compiled["effectivePolicy"]["base"]["id"],
        compiled["effectivePolicy"]["deniedCapabilities"],
        compiled["effectivePolicy"]["projectManifestHash"],
    )
    if expected != compiled:
        raise CompilationIntegrityFailure(
            [
                "Compiled workflow differs from deterministic recompilation of its trusted "
                "repository, profile, workflow, agent, capability, and policy references"
            ]
        )


def _reject_unsafe_compiled_ordinals(compiled: dict[str, Any]) -> None:
    """Reject unsafe ordinals before any caller can pass the plan to canonical hashing."""
    phases = compiled.get("orderedPhases")
    if not isinstance(phases, list):
        return
    for index, phase in enumerate(phases):
        if not isinstance(phase, dict):
            continue
        ordinal = phase.get("ordinal")
        if (
            isinstance(ordinal, int)
            and not isinstance(ordinal, bool)
            and ordinal > canonical_json.MAXIMUM_SAFE_INTEGER
        ):
            raise CompilationCanonicalFailure(
                [
                    f"compiled-workflow.orderedPhases.{index}.ordinal exceeds the "
                    "cross-runtime safe integer maximum"
                ]
            )


def verify_compiled_workflow(
    compiled: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    """Backward-compatible integrity-only verifier; use preflight authority before execution."""
    verify_compiled_workflow_integrity(compiled, documents)


def _validate_compiled_workflow(
    compiled: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    _reject_unsafe_compiled_ordinals(compiled)
    schemas = {
        document["$id"]: document
        for path, document in documents.items()
        if path.parent == validate_factory.CONTRACTS and path.name.endswith(".schema.json")
    }
    schema = schemas["https://schemas.cratis.io/factory/v1/compiled-workflow.schema.json"]
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document)) for identifier, document in schemas.items()
    )
    validator = Draft202012Validator(schema, format_checker=FormatChecker(), registry=registry)
    errors = sorted(validator.iter_errors(compiled), key=lambda error: list(error.absolute_path))
    if errors:
        diagnostics = []
        for error in errors:
            json_path = ".".join(str(part) for part in error.absolute_path)
            diagnostics.append(f"compiled-workflow{'.' + json_path if json_path else ''}: {error.message}")
        raise CompilationFailure(diagnostics)


def _requested_output_format(arguments: list[str]) -> str:
    output_format = "text"
    for index, value in enumerate(arguments):
        candidate = None
        if value.startswith("--format="):
            candidate = value.split("=", maxsplit=1)[1]
        elif value == "--format" and index + 1 < len(arguments):
            candidate = arguments[index + 1]
        if candidate in {"json", "json-compact", "text"}:
            output_format = candidate
    return output_format


def _invocation_request_hash(arguments: list[str]) -> str:
    semantic_arguments: list[str] = []
    skip_next = False
    for value in arguments:
        if skip_next:
            skip_next = False
            continue
        if value == "--format":
            skip_next = True
            continue
        if value.startswith("--format="):
            continue
        semantic_arguments.append(_safe_projection_text(value))
    return canonical_json.content_hash(
        {"operation": "verify", "invocationArguments": semantic_arguments}
    )


def _verification_request_hash(plan_bytes: bytes) -> str:
    return canonical_json.content_hash(
        {
            "operation": "verify",
            "planBytesHash": canonical_json.bytes_content_hash(plan_bytes),
        }
    )


def _read_plan_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise validate_factory.ValidationFailure(
            "external-json-document: filesystem access failed"
        ) from error


def _parse_plan_bytes(value: bytes) -> dict[str, Any]:
    try:
        document = json.loads(
            value.decode("utf-8"),
            object_pairs_hook=_unique_object,
        )
    except (UnicodeDecodeError, ValueError) as error:
        raise validate_factory.ValidationFailure(
            "external-json-document: malformed JSON"
        ) from error
    if not isinstance(document, dict):
        raise validate_factory.ValidationFailure(
            "external-json-document: the document root must be an object"
        )
    return document


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate object key")
        value[key] = item
    return value


def _safe_projection_text(value: str) -> str:
    safe = _TERMINAL_CONTROL.sub(" ", value)
    safe = "".join(
        "�" if 0xD800 <= ord(character) <= 0xDFFF else character
        for character in safe
    )
    return safe.replace(str(validate_factory.ROOT), "factory-root")[:1000]


def _correct_plan_action(identifier: str, title: str, expected: str) -> dict[str, Any]:
    return {
        "$schema": operation_result.NEXT_ACTION_SCHEMA,
        "protocolVersion": "1",
        "id": identifier,
        "kind": "correct-input",
        "title": title,
        "description": (
            "Replace the verification input with an immutable compiled workflow produced by "
            "the authoritative preflight operation."
        ),
        "automation": "requires-confirmation",
        "location": {"kind": "argument", "reference": "--verify-plan"},
        "expected": expected,
    }


def _compiler_failure_envelope(request_hash: str, error: Exception) -> dict[str, Any]:
    if isinstance(error, DirectCompilationDisabled):
        status = "invalid"
        code = "FACTORY-COMPILER-DIRECT-DISABLED"
        message = "Direct compilation is disabled; only integrity verification is supported."
        retry_reason = "Create the plan with preflight_factory.py, then verify that compiled workflow."
        action = _correct_plan_action(
            "use-authoritative-preflight",
            "Create an authoritative preflight plan",
            "A compiled workflow produced by preflight_factory.py and supplied with --verify-plan.",
        )
    elif isinstance(error, (CompilationCanonicalFailure, canonical_json.CanonicalJsonError)):
        status = "invalid"
        code = "FACTORY-COMPILER-CANONICAL-INVALID"
        message = "The compiled workflow contains a value outside Factory canonical JSON v1."
        retry_reason = "Replace non-canonical values and verify the corrected compiled workflow."
        action = _correct_plan_action(
            "correct-noncanonical-plan",
            "Correct the non-canonical compiled workflow",
            "A schema-valid compiled workflow whose integers and Unicode are canonical JSON v1 values.",
        )
    elif isinstance(error, CompilationHashFailure):
        status = "integrity-error"
        code = "FACTORY-COMPILER-HASH-MISMATCH"
        message = "The compiled workflow or one of its bound inputs failed content-hash verification."
        retry_reason = "Supply an untampered compiled workflow produced by authoritative preflight."
        action = _correct_plan_action(
            "supply-untampered-compiled-plan",
            "Supply an untampered compiled workflow",
            "A schema-valid compiled workflow whose nested and document hashes verify exactly.",
        )
    elif isinstance(error, CompilationIntegrityFailure):
        status = "integrity-error"
        code = "FACTORY-COMPILER-INTEGRITY-INVALID"
        message = "The compiled workflow differs from deterministic recompilation of its bound inputs."
        retry_reason = "Supply the exact deterministic plan produced by authoritative preflight."
        action = _correct_plan_action(
            "supply-deterministic-compiled-plan",
            "Supply the deterministic compiled workflow",
            "The exact compiled workflow deterministically produced from its bound definitions and inputs.",
        )
    elif isinstance(error, (CompilationFailure, validate_factory.ValidationFailure)):
        status = "invalid"
        code = "FACTORY-COMPILER-INPUT-INVALID"
        message = "The compiled workflow or Factory definitions are invalid for verification."
        retry_reason = "Correct the invalid input and run compiler verification again."
        action = _correct_plan_action(
            "correct-invalid-compiled-plan",
            "Correct the invalid compiled workflow",
            "A readable schema-valid compiled workflow produced by authoritative preflight.",
        )
    else:
        status = "unexpected"
        code = "FACTORY-COMPILER-UNEXPECTED"
        message = "An unexpected internal failure prevented compiler verification."
        retry_reason = "Inspect the diagnostic and contact a Factory maintainer."
        action = {
            "$schema": operation_result.NEXT_ACTION_SCHEMA,
            "protocolVersion": "1",
            "id": "contact-factory-maintainer",
            "kind": "contact-maintainer",
            "title": "Contact a Factory maintainer",
            "description": "Report the stable diagnostic code without attaching private plan content.",
            "automation": "human-only",
            "reference": "FACTORY-COMPILER-UNEXPECTED",
        }
    diagnostic = operation_result.make_diagnostic(
        code,
        "error",
        message,
        "retry-after-correction" if status != "unexpected" else "not-retryable",
        retry_reason,
        related_action_ids=[action["id"]],
    )
    return operation_result.make_operation_result(
        "verify",
        status,
        "Factory compiler verification did not produce a usable integrity result.",
        request_hash,
        diagnostics=[diagnostic],
        next_actions=[action],
        side_effects_occurred=False,
    )


def main() -> int:
    parser = _OperationArgumentParser(description=__doc__)
    parser.add_argument("--verify-plan", help="Verify an existing compiled plan and exit")
    parser.add_argument("--format", choices=("json", "json-compact", "text"), default="text")
    arguments = parser.parse_args()
    request_hash = _invocation_request_hash(sys.argv[1:])
    if not arguments.verify_plan:
        envelope = _compiler_failure_envelope(
            request_hash,
            DirectCompilationDisabled(
                [
                    "Direct compilation is disabled because caller-supplied resolution is not "
                    "repository authority; use preflight_factory.py"
                ]
            ),
        )
        print(operation_result.render_operation_result(envelope, arguments.format), end="")
        return operation_result.exit_code_for_status(envelope["status"])
    try:
        plan_bytes = _read_plan_bytes(Path(arguments.verify_plan))
        request_hash = _verification_request_hash(plan_bytes)
        compiled = _parse_plan_bytes(plan_bytes)
        documents = {
            path: validate_factory.load_json(path)
            for path in validate_factory.all_json_files()
        }
        verify_compiled_workflow_integrity(compiled, documents)
        envelope = operation_result.make_operation_result(
            "verify",
            "success",
            (
                "Factory compiled workflow integrity verified; current repository authority "
                "was not checked."
            ),
            request_hash,
            result=operation_result.make_typed_result(COMPILED_WORKFLOW_SCHEMA, compiled),
            side_effects_occurred=False,
        )
    except Exception as error:
        envelope = _compiler_failure_envelope(request_hash, error)

    print(operation_result.render_operation_result(envelope, arguments.format), end="")
    return operation_result.exit_code_for_status(envelope["status"])


if __name__ == "__main__":
    raise SystemExit(main())
