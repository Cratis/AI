#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Validate the dependency-free Cratis Factory foundation contracts and definitions."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import canonical_json
import artifact_provenance
import operation_result

try:
    from jsonschema import Draft202012Validator, FormatChecker
    from jsonschema.exceptions import SchemaError
    from referencing import Registry, Resource
except ImportError:
    print(
        "Factory validation requires jsonschema. Install Factory/requirements.txt.",
        file=sys.stderr,
    )
    raise


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_ROOT = ROOT / "Contracts"
CONTRACTS = CONTRACTS_ROOT / "v1"
CONTRACTS_V2 = CONTRACTS_ROOT / "v2"
WORKFLOWS = ROOT / "Workflows"
PROFILES = ROOT / "Factory" / "Profiles"
POLICIES = ROOT / "Factory" / "Policies"
CAPABILITIES = ROOT / "Factory" / "Capabilities"
EVALUATIONS = ROOT / "Evaluations" / "Factory"
IDENTIFIER = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
SHELL_OPERATORS = {"|", "||", "&&", ";", ">", ">>", "<", "<<"}
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
SCHEMA_BY_DOCUMENT_KIND = {
    "capability-catalog": "capability-catalog.schema.json",
    "evaluation-catalog": "evaluation-catalog.schema.json",
    "policy": "policy.schema.json",
    "profile": "profile.schema.json",
    "project-manifest": "project-manifest.schema.json",
    "workflow": "workflow.schema.json",
}
V2_DOCUMENT_KINDS = {
    "agent-context",
    "artifact-descriptor",
    "artifact-provenance",
    "artifact-receipt",
    "phase-envelope",
    "run-input-set",
    "sanitization-attestation",
}
DEFINITION_VALIDATION_RESULT_SCHEMA = (
    "https://schemas.cratis.io/factory/v1/definition-validation-result.schema.json"
)


class ValidationFailure(Exception):
    """Raised when one or more factory definitions are invalid."""


class CanonicalDefinitionFailure(ValidationFailure):
    """Raised when a definition cannot participate in canonical request binding."""


class _OperationArgumentParser(argparse.ArgumentParser):
    """Render invocation failures through the shared operation-result protocol."""

    def error(self, message: str) -> None:
        raw_arguments = sys.argv[1:]
        output_format = _requested_output_format(raw_arguments)
        request_hash = _invocation_request_hash(raw_arguments)
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-DEFINITIONS-INVOCATION-INVALID",
            "error",
            _safe_projection_text(message) or "Factory definition validation invocation is invalid",
            "retry-after-correction",
            "Correct the command arguments and run validation again.",
        )
        envelope = operation_result.make_operation_result(
            "validate",
            "invocation-error",
            "Factory definition validation invocation is invalid.",
            request_hash,
            diagnostics=[diagnostic],
            side_effects_occurred=False,
        )
        print(operation_result.render_operation_result(envelope, output_format), end="")
        raise SystemExit(operation_result.exit_code_for_status("invocation-error"))


def load_json(path: Path) -> dict[str, Any]:
    reference = _json_document_reference(path)
    try:
        value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
    except OSError as error:
        raise ValidationFailure(f"{reference}: filesystem access failed") from error
    except ValueError as error:
        raise ValidationFailure(f"{reference}: {error}") from error

    if not isinstance(value, dict):
        raise ValidationFailure(f"{reference}: the document root must be an object")
    return value


def _json_document_reference(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(ROOT.resolve()).as_posix()
    except (OSError, RuntimeError, ValueError):
        return "external-json-document"


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate object key {key}")
        value[key] = item
    return value


def all_json_files() -> Iterable[Path]:
    for directory in (CONTRACTS_ROOT, WORKFLOWS, PROFILES, POLICIES, CAPABILITIES, EVALUATIONS):
        yield from sorted(directory.rglob("*.json"))


def _is_contract_schema(path: Path) -> bool:
    return (
        path.name.endswith(".schema.json")
        and path.parent in {CONTRACTS, CONTRACTS_V2}
    )


def validate_schema_files(documents: dict[Path, dict[str, Any]], errors: list[str]) -> None:
    schema_ids: set[str] = set()
    for path, document in documents.items():
        if not _is_contract_schema(path):
            continue

        schema_id = document.get("$id")
        if document.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            errors.append(f"{path.relative_to(ROOT)}: use JSON Schema draft 2020-12")
        expected_namespace = f"https://schemas.cratis.io/factory/{path.parent.name}/"
        if not isinstance(schema_id, str) or not schema_id.startswith(expected_namespace):
            errors.append(
                f"{path.relative_to(ROOT)}: $id must use the Cratis Factory "
                f"{path.parent.name} schema namespace"
            )
        elif schema_id in schema_ids:
            errors.append(f"{path.relative_to(ROOT)}: duplicate schema id {schema_id}")
        else:
            schema_ids.add(schema_id)

        definitions = document.get("$defs", {})
        for reference in find_values(document, "$ref"):
            if not isinstance(reference, str) or not reference.startswith("#/$defs/"):
                continue
            name = reference.removeprefix("#/$defs/")
            if name not in definitions:
                errors.append(f"{path.relative_to(ROOT)}: unresolved internal reference {reference}")

    for path, document in documents.items():
        if not _is_contract_schema(path):
            continue
        for reference in find_values(document, "$ref"):
            if not isinstance(reference, str) or reference.startswith("#"):
                continue
            schema_identifier = reference.split("#", maxsplit=1)[0]
            if schema_identifier not in schema_ids:
                errors.append(f"{path.relative_to(ROOT)}: unresolved external reference {reference}")


def validate_document_kinds(documents: dict[Path, dict[str, Any]], errors: list[str]) -> None:
    for path, document in documents.items():
        if _is_contract_schema(path):
            continue
        document_kind = document.get("documentKind")
        if document_kind not in SCHEMA_BY_DOCUMENT_KIND and document_kind not in V2_DOCUMENT_KINDS:
            errors.append(
                f"{path.relative_to(ROOT)}: unknown or missing documentKind {document_kind}"
            )


def validate_json_schema_documents(documents: dict[Path, dict[str, Any]], errors: list[str]) -> None:
    schema_documents = {
        path: document
        for path, document in documents.items()
        if _is_contract_schema(path)
    }
    schemas_by_id = {
        schema["$id"]: schema
        for schema in schema_documents.values()
        if isinstance(schema.get("$id"), str)
    }
    v1_schemas_by_name = {
        path.name: schema
        for path, schema in schema_documents.items()
        if path.parent == CONTRACTS
    }
    for path, schema in schema_documents.items():
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as error:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON Schema: {error.message}")

    registry = Registry().with_resources(
        (
            schema["$id"],
            Resource.from_contents(schema),
        )
        for schema in schema_documents.values()
        if isinstance(schema.get("$id"), str)
    )
    format_checker = FormatChecker()
    for path, document in documents.items():
        document_kind = document.get("documentKind")
        if document_kind not in SCHEMA_BY_DOCUMENT_KIND and document_kind not in V2_DOCUMENT_KINDS:
            continue
        declared_schema = document.get("$schema")
        if isinstance(declared_schema, str) and declared_schema in schemas_by_id:
            schema = schemas_by_id[declared_schema]
            schema_name = declared_schema
        else:
            schema_name = SCHEMA_BY_DOCUMENT_KIND.get(document_kind, "")
            schema = v1_schemas_by_name.get(schema_name)
        if schema is None:
            errors.append(f"{path.relative_to(ROOT)}: missing canonical schema {schema_name}")
            continue
        validator = Draft202012Validator(schema, format_checker=format_checker, registry=registry)
        for error in sorted(validator.iter_errors(document), key=lambda item: list(item.absolute_path)):
            json_path = ".".join(str(part) for part in error.absolute_path)
            location = f"{path.relative_to(ROOT)}{'.' + json_path if json_path else ''}"
            errors.append(f"{location}: {error.message}")


def find_values(value: Any, key: str) -> Iterable[Any]:
    if isinstance(value, dict):
        for current_key, current_value in value.items():
            if current_key == key:
                yield current_value
            yield from find_values(current_value, key)
    elif isinstance(value, list):
        for item in value:
            yield from find_values(item, key)


def validate_schema_reference(path: Path, document: dict[str, Any], errors: list[str]) -> None:
    reference = document.get("$schema")
    if not isinstance(reference, str):
        errors.append(f"{path.relative_to(ROOT)}: missing $schema")
        return
    if reference.startswith("https://"):
        return
    resolved = (path.parent / reference).resolve()
    if not resolved.is_relative_to(CONTRACTS_ROOT.resolve()) or not resolved.is_file():
        errors.append(f"{path.relative_to(ROOT)}: unresolved or out-of-contract $schema {reference}")


def require_identifier(value: Any, location: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
        errors.append(f"{location}: expected a kebab-case identifier")


def validate_workflow(
    path: Path,
    workflow: dict[str, Any],
    capabilities: dict[str, dict[str, Any]],
    errors: list[str],
) -> None:
    location = str(path.relative_to(ROOT))
    if workflow.get("schemaVersion") != "1" or workflow.get("documentKind") != "workflow":
        errors.append(f"{location}: expected workflow schemaVersion 1")
    require_identifier(workflow.get("id"), f"{location}.id", errors)

    workflow_inputs = workflow.get("inputs")
    if not isinstance(workflow_inputs, list):
        errors.append(f"{location}.inputs: expected a non-empty array")
        workflow_inputs = []
    workflow_input_ids = [
        item.get("id") for item in workflow_inputs if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    duplicate_inputs = sorted(
        identifier for identifier in set(workflow_input_ids) if workflow_input_ids.count(identifier) > 1
    )
    if duplicate_inputs:
        errors.append(f"{location}.inputs: duplicate ids: {', '.join(duplicate_inputs)}")
    for index, workflow_input in enumerate(workflow_inputs):
        input_location = f"{location}.inputs[{index}]"
        if not isinstance(workflow_input, dict):
            continue
        schema_reference = workflow_input.get("schema")
        if not isinstance(schema_reference, str) or not (path.parent / schema_reference).resolve().is_file():
            errors.append(f"{input_location}.schema: unresolved schema {schema_reference}")

    phases = workflow.get("phases")
    if not isinstance(phases, list) or not phases:
        errors.append(f"{location}: phases must be a non-empty array")
        return

    phase_ids: list[str] = []
    dependencies: dict[str, list[str]] = {}
    gate_ids: list[str] = []
    required_gate_ids: list[str] = []
    for index, phase in enumerate(phases):
        phase_location = f"{location}.phases[{index}]"
        if not isinstance(phase, dict):
            errors.append(f"{phase_location}: phase must be an object")
            continue

        phase_id = phase.get("id")
        require_identifier(phase_id, f"{phase_location}.id", errors)
        if isinstance(phase_id, str):
            phase_ids.append(phase_id)
        needs = phase.get("needs", [])
        if not isinstance(needs, list) or not all(isinstance(item, str) for item in needs):
            errors.append(f"{phase_location}.needs: expected an array of phase identifiers")
            needs = []
        if isinstance(phase_id, str):
            dependencies[phase_id] = needs

        kind = phase.get("kind")
        required_by_kind = {"agent": "role", "code": "capability", "human": "approval"}
        if kind not in required_by_kind:
            errors.append(f"{phase_location}.kind: expected agent, code, or human")
        elif required_by_kind[kind] not in phase:
            errors.append(f"{phase_location}: {kind} phases require {required_by_kind[kind]}")

        output_schema = phase.get("outputSchema")
        if not isinstance(output_schema, str) or not (path.parent / output_schema).resolve().is_file():
            errors.append(f"{phase_location}.outputSchema: unresolved schema {output_schema}")

        inputs = phase.get("inputs")
        if not isinstance(inputs, list):
            errors.append(f"{phase_location}.inputs: expected an array")
        else:
            input_names = [
                item.get("name") for item in inputs if isinstance(item, dict) and isinstance(item.get("name"), str)
            ]
            duplicate_names = sorted(name for name in set(input_names) if input_names.count(name) > 1)
            if duplicate_names:
                errors.append(f"{phase_location}.inputs: duplicate names: {', '.join(duplicate_names)}")

        if kind in {"agent", "code"}:
            validate_capability_reference(
                phase.get("capability"),
                "agent" if kind == "agent" else "phase",
                None,
                f"{phase_location}.capability",
                capabilities,
                errors,
            )

        policy = phase.get("policy")
        if not isinstance(policy, dict):
            errors.append(f"{phase_location}.policy: missing policy")
        else:
            write_scopes = policy.get("writeScopes")
            if not isinstance(write_scopes, list):
                errors.append(f"{phase_location}.policy.writeScopes: expected an array")
            elif kind == "agent" and any(scope in {".", "**", "**/*"} for scope in write_scopes):
                errors.append(f"{phase_location}: agent phases cannot receive repository-wide write scope")
            if kind == "human" and any(policy.get(name) for name in ("writeScopes", "networkScopes", "secretScopes")):
                errors.append(f"{phase_location}: human decisions cannot carry worker capabilities")

        gates = phase.get("gates")
        if not isinstance(gates, list):
            errors.append(f"{phase_location}.gates: expected an array")
            continue
        for gate_index, gate in enumerate(gates):
            if not isinstance(gate, dict):
                errors.append(f"{phase_location}.gates[{gate_index}]: gate must be an object")
                continue
            gate_id = gate.get("id")
            require_identifier(gate_id, f"{phase_location}.gates[{gate_index}].id", errors)
            if isinstance(gate_id, str):
                gate_ids.append(gate_id)
                if gate.get("requiredForAcceptance") is True:
                    required_gate_ids.append(gate_id)
            capability = gate.get("capability")
            if capability is not None:
                validate_capability_reference(
                    capability,
                    "gate",
                    gate.get("kind"),
                    f"{phase_location}.gates[{gate_index}].capability",
                    capabilities,
                    errors,
                )

    duplicate_phases = sorted(identifier for identifier in set(phase_ids) if phase_ids.count(identifier) > 1)
    duplicate_gates = sorted(identifier for identifier in set(gate_ids) if gate_ids.count(identifier) > 1)
    if duplicate_phases:
        errors.append(f"{location}: duplicate phase ids: {', '.join(duplicate_phases)}")
    if duplicate_gates:
        errors.append(f"{location}: duplicate gate ids: {', '.join(duplicate_gates)}")

    known_phases = set(phase_ids)
    for phase_id, needs in dependencies.items():
        unknown = sorted(set(needs) - known_phases)
        if unknown:
            errors.append(f"{location}.{phase_id}: unknown dependencies: {', '.join(unknown)}")
    if has_cycle(dependencies):
        errors.append(f"{location}: phase dependency graph contains a cycle")

    for index, phase in enumerate(phases):
        if not isinstance(phase, dict) or not isinstance(phase.get("id"), str):
            continue
        phase_id = phase["id"]
        phase_location = f"{location}.phases[{index}]"
        for input_index, input_binding in enumerate(phase.get("inputs", [])):
            if not isinstance(input_binding, dict):
                continue
            source = input_binding.get("source")
            if not isinstance(source, dict):
                continue
            source_location = f"{phase_location}.inputs[{input_index}].source"
            if source.get("kind") == "workflow-input":
                source_id = source.get("id")
                if source_id not in workflow_input_ids:
                    errors.append(f"{source_location}: unknown workflow input {source_id}")
            elif source.get("kind") == "phase-output":
                source_phase = source.get("phaseId")
                if source_phase not in known_phases:
                    errors.append(f"{source_location}: unknown producer phase {source_phase}")
                elif source_phase == phase_id or not is_ancestor(source_phase, phase_id, dependencies):
                    errors.append(
                        f"{source_location}: producer {source_phase} is not an ancestor of {phase_id}"
                    )

        correction = phase.get("correction")
        if isinstance(correction, dict):
            target = correction.get("targetPhase")
            if target not in known_phases:
                errors.append(f"{phase_location}.correction.targetPhase: unknown phase {target}")
            elif target != phase_id and not is_ancestor(target, phase_id, dependencies):
                errors.append(
                    f"{phase_location}.correction.targetPhase: {target} must be this phase or one of its ancestors"
                )

    acceptance = workflow.get("acceptance", {}).get("requiredGateIds", [])
    if not isinstance(acceptance, list) or not acceptance:
        errors.append(f"{location}.acceptance.requiredGateIds: expected a non-empty array")
    else:
        missing = sorted(set(acceptance) - set(gate_ids))
        if missing:
            errors.append(f"{location}: acceptance references unknown gates: {', '.join(missing)}")
        omitted = sorted(set(required_gate_ids) - set(acceptance))
        unexpected = sorted(set(acceptance) - set(required_gate_ids))
        if omitted:
            errors.append(f"{location}: acceptance omits required gates: {', '.join(omitted)}")
        if unexpected:
            errors.append(f"{location}: acceptance includes non-required gates: {', '.join(unexpected)}")

    terminal = workflow.get("terminal")
    if isinstance(terminal, dict):
        success_phase = terminal.get("successPhase")
        if success_phase not in known_phases:
            errors.append(f"{location}.terminal.successPhase: unknown phase {success_phase}")
        else:
            dependents = sorted(
                phase_id for phase_id, needs in dependencies.items() if success_phase in needs
            )
            if dependents:
                errors.append(
                    f"{location}.terminal.successPhase: {success_phase} has dependents: {', '.join(dependents)}"
                )
            unreachable = sorted(
                phase_id
                for phase_id in known_phases
                if phase_id != success_phase and not is_ancestor(phase_id, success_phase, dependencies)
            )
            if unreachable:
                errors.append(
                    f"{location}.terminal.successPhase: phases do not lead to success: {', '.join(unreachable)}"
                )


def has_cycle(dependencies: dict[str, list[str]]) -> bool:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(identifier: str) -> bool:
        if identifier in visiting:
            return True
        if identifier in visited:
            return False
        visiting.add(identifier)
        for dependency in dependencies.get(identifier, []):
            if dependency in dependencies and visit(dependency):
                return True
        visiting.remove(identifier)
        visited.add(identifier)
        return False

    return any(visit(identifier) for identifier in dependencies)


def is_ancestor(candidate: Any, phase_id: str, dependencies: dict[str, list[str]]) -> bool:
    if not isinstance(candidate, str):
        return False
    pending = list(dependencies.get(phase_id, []))
    visited: set[str] = set()
    while pending:
        current = pending.pop()
        if current == candidate:
            return True
        if current in visited:
            continue
        visited.add(current)
        pending.extend(dependencies.get(current, []))
    return False


def validate_capability_reference(
    capability: Any,
    usage: str,
    gate_kind: Any,
    location: str,
    capabilities: dict[str, dict[str, Any]],
    errors: list[str],
) -> None:
    if not isinstance(capability, str):
        return
    definition = capabilities.get(capability)
    if definition is None:
        errors.append(f"{location}: unknown capability {capability}")
        return
    if usage not in definition.get("usages", []):
        errors.append(f"{location}: capability {capability} does not support {usage} usage")
    allowed_gate_kinds = definition.get("allowedGateKinds")
    if usage == "gate" and isinstance(allowed_gate_kinds, list) and gate_kind not in allowed_gate_kinds:
        errors.append(f"{location}: capability {capability} does not support {gate_kind} gates")


def validate_profile(
    path: Path,
    profile: dict[str, Any],
    denied_cratis_commands: list[list[str]],
    errors: list[str],
) -> None:
    location = str(path.relative_to(ROOT))
    if profile.get("schemaVersion") != "1" or profile.get("documentKind") != "profile":
        errors.append(f"{location}: expected profile schemaVersion 1")
    require_identifier(profile.get("id"), f"{location}.id", errors)
    commands = profile.get("commands")
    if not isinstance(commands, dict):
        errors.append(f"{location}.commands: expected an object")
        return

    for capability, command in commands.items():
        command_location = f"{location}.commands.{capability}"
        require_identifier(capability, command_location, errors)
        argv = command.get("argv") if isinstance(command, dict) else None
        if not isinstance(argv, list) or not argv or not all(isinstance(argument, str) for argument in argv):
            errors.append(f"{command_location}.argv: expected a non-empty string array")
            continue
        if any(argument in SHELL_OPERATORS for argument in argv):
            errors.append(f"{command_location}.argv: shell operators are forbidden; execute an argv array directly")
        if any(argument in {"--yes", "-y"} for argument in argv):
            errors.append(f"{command_location}.argv: agents cannot receive the CLI confirmation bypass")
        if argv[0] == "cratis" and is_denied_cratis_command(argv[1:], denied_cratis_commands):
            errors.append(f"{command_location}.argv: this Cratis CLI command is owned by the developer")


def validate_profile_recommendations(
    path: Path,
    profile: dict[str, Any],
    workflow_ids: set[str],
    errors: list[str],
) -> None:
    location = str(path.relative_to(ROOT))
    recommendations = profile.get("recommendations")
    if not isinstance(recommendations, dict):
        errors.append(f"{location}.recommendations: expected agents and workflows")
        return

    available_agents = {agent.stem for agent in (ROOT / ".ai" / "agents").glob("*.md")}
    available_skills = {
        skill.parent.name for skill in (ROOT / ".ai" / "skills").glob("*/SKILL.md")
    }
    unknown_skills = sorted(set(profile.get("skills", [])) - available_skills)
    if unknown_skills:
        errors.append(f"{location}.skills: unknown skills: {', '.join(unknown_skills)}")
    for kind, available in (("agents", available_agents), ("workflows", workflow_ids)):
        values = recommendations.get(kind)
        if not isinstance(values, list):
            errors.append(f"{location}.recommendations.{kind}: expected an array")
            continue
        identifiers: list[str] = []
        for index, recommendation in enumerate(values):
            recommendation_location = f"{location}.recommendations.{kind}[{index}]"
            if not isinstance(recommendation, dict):
                errors.append(f"{recommendation_location}: expected an object")
                continue
            identifier = recommendation.get("id")
            require_identifier(identifier, f"{recommendation_location}.id", errors)
            if isinstance(identifier, str):
                identifiers.append(identifier)
                if identifier not in available:
                    errors.append(f"{recommendation_location}: unknown {kind[:-1]} {identifier}")
            purposes = recommendation.get("purposes")
            if not isinstance(purposes, list) or not purposes:
                errors.append(f"{recommendation_location}.purposes: expected a non-empty array")
        duplicates = sorted(identifier for identifier in set(identifiers) if identifiers.count(identifier) > 1)
        if duplicates:
            errors.append(f"{location}.recommendations.{kind}: duplicate ids: {', '.join(duplicates)}")


def is_denied_cratis_command(arguments: list[str], denied: list[list[str]]) -> bool:
    for pattern in denied:
        if len(arguments) < len(pattern):
            continue
        if all(expected == "*" or arguments[index] == expected for index, expected in enumerate(pattern)):
            return True
    return False


def validate_policy(path: Path, policy: dict[str, Any], errors: list[str]) -> None:
    location = str(path.relative_to(ROOT))
    if policy.get("schemaVersion") != "1" or policy.get("documentKind") != "policy":
        errors.append(f"{location}: expected policy schemaVersion 1")
    require_identifier(policy.get("id"), f"{location}.id", errors)
    if policy.get("defaultDecision") != "deny":
        errors.append(f"{location}: defaultDecision must be deny")
    required_protected = {
        ".git/**",
        ".ai/**",
        ".cratis/factory.json",
        ".github/workflows/**",
        "Contracts/**",
        "Evaluations/**",
        "Factory/Capabilities/**",
        "Factory/Policies/**",
        "Factory/Profiles/**",
        "Factory/scripts/**",
        "Workflows/**",
    }
    protected = set(policy.get("protectedPaths", []))
    missing = sorted(required_protected - protected)
    if missing:
        errors.append(f"{location}: missing protected paths: {', '.join(missing)}")


def validate_project_manifest(
    path: Path,
    manifest: dict[str, Any],
    workflows: dict[str, str],
    profiles: set[str],
    policies: set[str],
    policy_capabilities: dict[str, set[str]],
    errors: list[str],
) -> None:
    location = str(path.relative_to(ROOT))
    included_profiles = set(manifest.get("profiles", {}).get("include", []))
    unknown_profiles = sorted(included_profiles - profiles)
    if unknown_profiles:
        errors.append(f"{location}: unknown profiles: {', '.join(unknown_profiles)}")
    for workflow_id, version in manifest.get("workflows", {}).items():
        if workflows.get(workflow_id) != version:
            available = workflows.get(workflow_id)
            available_detail = (
                f"; trusted Factory version is {available}"
                if available is not None
                else "; no trusted Factory workflow with that ID exists"
            )
            errors.append(
                f"{location}: workflow {workflow_id} version {version} is not available"
                + available_detail
            )
    policy_id = manifest.get("policy", {}).get("id")
    if policy_id not in policies:
        errors.append(f"{location}: unknown policy {policy_id}")
    denied_capabilities = set(manifest.get("policy", {}).get("denyCapabilities", []))
    unknown_capabilities = sorted(denied_capabilities - policy_capabilities.get(policy_id, set()))
    if unknown_capabilities:
        errors.append(
            f"{location}: project manifests can only narrow known policy capabilities: {', '.join(unknown_capabilities)}"
        )


def validate_capability_catalogs(
    catalogs: dict[Path, dict[str, Any]],
    errors: list[str],
) -> dict[str, dict[str, Any]]:
    capabilities: dict[str, dict[str, Any]] = {}
    for path, catalog in catalogs.items():
        location = str(path.relative_to(ROOT))
        for index, capability in enumerate(catalog.get("capabilities", [])):
            if not isinstance(capability, dict):
                continue
            capability_id = capability.get("id")
            if not isinstance(capability_id, str):
                continue
            if capability_id in capabilities:
                errors.append(f"{location}.capabilities[{index}]: duplicate capability {capability_id}")
            else:
                capabilities[capability_id] = capability
            output_schema = capability.get("outputSchema")
            usages = capability.get("usages", [])
            if (
                any(usage in {"gate", "phase"} for usage in usages)
                and (
                    not isinstance(output_schema, str)
                    or not (path.parent / output_schema).resolve().is_file()
                )
            ):
                errors.append(
                    f"{location}.capabilities[{index}].outputSchema: unresolved schema {output_schema}"
                )
            if "gate" in usages and not capability.get("allowedGateKinds"):
                errors.append(
                    f"{location}.capabilities[{index}]: gate capabilities require allowedGateKinds"
                )
            if "gate" not in usages and capability.get("allowedGateKinds"):
                errors.append(
                    f"{location}.capabilities[{index}]: non-gate capability cannot declare allowedGateKinds"
                )
    return capabilities


def validate_evaluation_catalog(path: Path, catalog: dict[str, Any], errors: list[str]) -> None:
    location = str(path.relative_to(ROOT))
    cases = catalog.get("cases")
    if not isinstance(cases, list) or len(cases) < 20:
        errors.append(f"{location}: the foundation catalog must contain at least 20 cases")
        return
    identifiers = [case.get("id") for case in cases if isinstance(case, dict)]
    duplicates = sorted(identifier for identifier in set(identifiers) if identifiers.count(identifier) > 1)
    if duplicates:
        errors.append(f"{location}: duplicate evaluation ids: {', '.join(duplicates)}")
    for index, case in enumerate(cases):
        case_location = f"{location}.cases[{index}]"
        if not isinstance(case, dict):
            errors.append(f"{case_location}: case must be an object")
            continue
        require_identifier(case.get("id"), f"{case_location}.id", errors)
        for field in ("expectedInvariants", "forbiddenOutcomes", "requiredEvidence"):
            value = case.get(field)
            if not isinstance(value, list) or not value or not all(isinstance(item, str) and item for item in value):
                errors.append(f"{case_location}.{field}: expected a non-empty string array")


def validate_markdown_links(errors: list[str]) -> None:
    files = [ROOT / "Factory" / "README.md"]
    files.extend(sorted((ROOT / "Documentation" / "Factory").rglob("*.md")))
    files.extend(sorted((ROOT / ".ai" / "skills" / "cratis-software-factory").rglob("*.md")))
    for path in files:
        content = path.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK.finditer(content):
            target = match.group(1).strip("<>").split("#", maxsplit=1)[0]
            if not target or target.startswith(("http://", "https://", "/")):
                continue
            if not (path.parent / target).resolve().exists():
                errors.append(f"{path.relative_to(ROOT)}: unresolved Markdown link {target}")


def validate_documents(documents: dict[Path, dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    validate_document_kinds(documents, errors)
    for path, document in documents.items():
        validate_schema_reference(path, document, errors)
    validate_schema_files(documents, errors)
    validate_json_schema_documents(documents, errors)
    artifact_provenance.validate_v2_documents_integrity_only(documents, errors)

    policy_documents = {
        path: document for path, document in documents.items() if document.get("documentKind") == "policy"
    }
    for path, policy in policy_documents.items():
        validate_policy(path, policy, errors)
    denied_cratis_commands = [
        pattern
        for policy in policy_documents.values()
        for pattern in policy.get("deniedCratisCommands", [])
        if isinstance(pattern, list)
    ]

    workflow_documents = {
        path: document for path, document in documents.items() if document.get("documentKind") == "workflow"
    }
    profile_documents = {
        path: document for path, document in documents.items() if document.get("documentKind") == "profile"
    }
    capability_catalogs = {
        path: document
        for path, document in documents.items()
        if document.get("documentKind") == "capability-catalog"
    }
    capabilities = validate_capability_catalogs(capability_catalogs, errors)
    for path, workflow in workflow_documents.items():
        validate_workflow(path, workflow, capabilities, errors)
    for path, profile in profile_documents.items():
        validate_profile(path, profile, denied_cratis_commands, errors)
        validate_profile_recommendations(
            path,
            profile,
            {document["id"] for document in workflow_documents.values()},
            errors,
        )

    available_workflows = {
        document["id"]: document["version"] for document in workflow_documents.values()
    }
    available_profiles = {document["id"] for document in profile_documents.values()}
    available_policies = {document["id"] for document in policy_documents.values()}
    policy_capabilities = {
        document["id"]: set(document.get("capabilities", {}))
        for document in policy_documents.values()
    }
    for path, document in documents.items():
        if document.get("documentKind") == "project-manifest":
            validate_project_manifest(
                path,
                document,
                available_workflows,
                available_profiles,
                available_policies,
                policy_capabilities,
                errors,
            )
        if document.get("documentKind") == "evaluation-catalog":
            validate_evaluation_catalog(path, document, errors)
    validate_markdown_links(errors)
    return errors


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


def _semantic_invocation_arguments(arguments: list[str]) -> list[str]:
    semantic: list[str] = []
    index = 0
    formats = {"json", "json-compact", "text"}
    while index < len(arguments):
        value = arguments[index]
        if value.startswith("--format=") and value.split("=", maxsplit=1)[1] in formats:
            index += 1
            continue
        if value == "--format" and index + 1 < len(arguments) and arguments[index + 1] in formats:
            index += 2
            continue
        semantic.append(_safe_projection_text(value))
        index += 1
    return semantic


def _invocation_request_hash(arguments: list[str]) -> str:
    return canonical_json.content_hash(
        {
            "operation": "validate",
            "invocationArguments": _semantic_invocation_arguments(arguments),
        }
    )


def _safe_projection_text(value: str) -> str:
    forbidden = set(range(0x00, 0x20)) | set(range(0x7F, 0xA0)) | set(
        range(0x202A, 0x202F)
    ) | set(range(0x2066, 0x206A))
    return "".join(
        "�" if 0xD800 <= ord(character) <= 0xDFFF else " " if ord(character) in forbidden else character
        for character in value
    )[:1000]


def _validation_counts(documents: dict[Path, dict[str, Any]]) -> dict[str, int]:
    return {
        "documents": len(documents),
        "schemas": sum(path.name.endswith(".schema.json") for path in documents),
        "workflows": sum(
            document.get("documentKind") == "workflow" for document in documents.values()
        ),
        "profiles": sum(
            document.get("documentKind") == "profile" for document in documents.values()
        ),
        "policies": sum(
            document.get("documentKind") == "policy" for document in documents.values()
        ),
        "capabilityCatalogs": sum(
            document.get("documentKind") == "capability-catalog"
            for document in documents.values()
        ),
        "evaluationCatalogs": sum(
            document.get("documentKind") == "evaluation-catalog"
            for document in documents.values()
        ),
    }


def _validation_request_hash(documents: dict[Path, dict[str, Any]]) -> str:
    definitions = []
    for path, document in sorted(documents.items()):
        reference = _json_document_reference(path)
        try:
            document_hash = canonical_json.content_hash(document)
        except canonical_json.CanonicalJsonError as error:
            raise CanonicalDefinitionFailure(
                f"{reference}: violates Factory canonical JSON v1: {_safe_projection_text(str(error))}"
            ) from error
        definitions.append({"reference": reference, "contentHash": document_hash})
    return canonical_json.content_hash(
        {
            "operation": "validate",
            "definitions": definitions,
        }
    )


def _validation_envelope(
    documents: dict[Path, dict[str, Any]],
    errors: list[str],
    request_hash: str,
) -> dict[str, Any]:
    counts = _validation_counts(documents)
    safe_errors = [_safe_projection_text(error) for error in errors]
    outcome = "invalid" if safe_errors else "valid"
    value = {
        "$schema": DEFINITION_VALIDATION_RESULT_SCHEMA,
        "protocolVersion": "1",
        "outcome": outcome,
        "counts": counts,
        "errors": safe_errors,
    }
    diagnostics = [
        operation_result.make_diagnostic(
            "FACTORY-DEFINITIONS-INVALID",
            "error",
            error,
            "retry-after-correction",
            "Correct the Factory definition and run validation again.",
        )
        for error in safe_errors
    ]
    if safe_errors:
        summary = (
            f"Factory definition validation found {len(safe_errors)} errors across "
            f"{counts['documents']} documents."
        )
    else:
        summary = (
            "Factory definition validation passed: "
            f"{counts['schemas']} schemas, {counts['workflows']} workflows, "
            f"{counts['profiles']} profiles, {counts['policies']} policies, "
            f"{counts['capabilityCatalogs']} capability catalogs, and "
            f"{counts['evaluationCatalogs']} evaluation catalogs."
        )
    return operation_result.make_operation_result(
        "validate",
        "invalid" if safe_errors else "success",
        summary,
        request_hash,
        diagnostics=diagnostics,
        result=operation_result.make_typed_result(DEFINITION_VALIDATION_RESULT_SCHEMA, value),
        side_effects_occurred=False,
    )


def _validation_failure_envelope(request_hash: str, error: Exception) -> dict[str, Any]:
    if isinstance(error, CanonicalDefinitionFailure):
        status = "invalid"
        code = "FACTORY-DEFINITIONS-CANONICAL-INVALID"
        retry_disposition = "retry-after-correction"
        retry_reason = "Replace non-canonical values and run validation again."
        detail = _safe_projection_text(str(error))
    elif isinstance(error, ValidationFailure):
        status = "invalid"
        code = "FACTORY-DEFINITIONS-LOAD-INVALID"
        retry_disposition = "retry-after-correction"
        retry_reason = "Correct the unreadable or malformed Factory definition and run validation again."
        detail = _safe_projection_text(str(error))
    else:
        status = "unexpected"
        code = "FACTORY-DEFINITIONS-UNEXPECTED"
        retry_disposition = "not-retryable"
        retry_reason = "Inspect the diagnostic and contact a Factory maintainer."
        detail = "An unexpected internal failure prevented Factory definition validation."
    diagnostic = operation_result.make_diagnostic(
        code,
        "error",
        detail or "Factory definition validation failed",
        retry_disposition,
        retry_reason,
    )
    return operation_result.make_operation_result(
        "validate",
        status,
        "Factory definition validation did not produce a usable result.",
        request_hash,
        diagnostics=[diagnostic],
        side_effects_occurred=False,
    )


def main() -> int:
    parser = _OperationArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=("json", "json-compact", "text"), default="text")
    arguments = parser.parse_args()
    request_hash = _invocation_request_hash(sys.argv[1:])
    try:
        documents = {path: load_json(path) for path in all_json_files()}
        request_hash = _validation_request_hash(documents)
        envelope = _validation_envelope(documents, validate_documents(documents), request_hash)
    except Exception as error:
        envelope = _validation_failure_envelope(request_hash, error)

    print(operation_result.render_operation_result(envelope, arguments.format), end="")
    return operation_result.exit_code_for_status(envelope["status"])


if __name__ == "__main__":
    raise SystemExit(main())
