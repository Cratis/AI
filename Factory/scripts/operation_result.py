#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Shared, side-effect-free rendering and exit semantics for Factory operations."""

from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
import re
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError
from referencing import Registry, Resource

import canonical_json


OPERATION_RESULT_SCHEMA = "https://schemas.cratis.io/factory/v1/operation-result.schema.json"
DIAGNOSTIC_SCHEMA = "https://schemas.cratis.io/factory/v1/diagnostic.schema.json"
NEXT_ACTION_SCHEMA = "https://schemas.cratis.io/factory/v1/next-action.schema.json"
OPERATIONS = (
    "inspect",
    "preflight",
    "validate",
    "verify",
    "evaluate",
    "verify-evaluation-result",
)
STATUSES = (
    "success",
    "blocked",
    "approval-required",
    "denied",
    "invocation-error",
    "invalid",
    "integrity-error",
    "unexpected",
)
SEVERITIES = ("information", "warning", "error")
RETRY_DISPOSITIONS = (
    "not-retryable",
    "retry-after-correction",
    "retry-immediately",
    "retry-later",
)
EXIT_CODES = {
    "success": 0,
    "invocation-error": 2,
    "blocked": 3,
    "invalid": 4,
    "integrity-error": 5,
    "approval-required": 6,
    "denied": 7,
    "unexpected": 70,
}

_ROOT = Path(__file__).resolve().parents[2]
_CONTRACTS = _ROOT / "Contracts" / "v1"
_CONTENT_HASH = re.compile(r"^sha256:[a-f0-9]{64}$")
_DIAGNOSTIC_CODE = re.compile(r"^FACTORY-[A-Z0-9]+(?:-[A-Z0-9]+)*$")
_IDENTIFIER = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
# Unicode code points beyond the C0/C1 control blocks that a Factory
# projection must also reject: the full Bidi_Control set (U+061C,
# U+200E-U+200F, U+202A-U+202E, U+2066-U+2069), the zero-width format
# characters adjacent to the Bidi marks (U+200B-U+200D ZERO WIDTH
# SPACE/NON-JOINER/JOINER) and the byte-order mark (U+FEFF ZERO WIDTH
# NO-BREAK SPACE), and the Unicode line/paragraph separators
# (U+2028-U+2029). The separators are general category Zl/Zp, not
# category C, so a unicodedata.category(...).startswith("C") sweep never
# catches them; they are named here explicitly instead. Defined once so
# every guard in this module -- and every sanitizer elsewhere in
# Factory/scripts that reuses PROJECTION_CONTROL_CHARACTERS below --
# derives from this single fragment instead of maintaining an
# independent copy that can silently drift out of sync with it.
_NON_ASCII_PROJECTION_CONTROLS = (
    r"\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff"
)
_TERMINAL_CONTROL = re.compile(rf"[\x00-\x1f\x7f-\x9f{_NON_ASCII_PROJECTION_CONTROLS}]")
_TYPED_VALUE_CONTROL = re.compile(
    rf"[\x00-\x09\x0b-\x1f\x7f-\x9f{_NON_ASCII_PROJECTION_CONTROLS}]"
)

# Public surface for every other Factory/scripts sanitizer (validate_factory,
# preflight_factory, evaluate_factory, compile_factory) to build its own
# projection-safe text helper on, instead of hand-copying the character
# ranges above -- the drift between such a copy and this module is exactly
# what let U+061C/U+200E/U+200F reach make_diagnostic() uncaught.
PROJECTION_CONTROL_CHARACTERS = _TERMINAL_CONTROL

# General categories that are Unicode line/paragraph separators (Zl, Zp).
# Not part of category "C", so a category-sweep guard built on
# unicodedata.category(...).startswith("C") -- such as
# resolve_factory._sanitize_terminal_text -- must test membership in this
# set explicitly to also reject U+2028/U+2029.
LINE_AND_PARAGRAPH_SEPARATOR_CATEGORIES = frozenset({"Zl", "Zp"})


class OperationResultError(ValueError):
    """Raised when an operation result cannot be represented safely."""


def make_diagnostic(
    code: str,
    severity: str,
    message: str,
    retry_disposition: str,
    retry_reason: str,
    *,
    locations: list[dict[str, Any]] | None = None,
    evidence: list[dict[str, Any]] | None = None,
    related_action_ids: list[str] | None = None,
    retry_after_seconds: int | None = None,
) -> dict[str, Any]:
    """Build a versioned diagnostic without writing or printing anything."""
    if not isinstance(code, str) or not _DIAGNOSTIC_CODE.fullmatch(code):
        raise OperationResultError(f"Invalid diagnostic code: {_safe_error(str(code))}")
    if severity not in SEVERITIES:
        raise OperationResultError(f"Unknown diagnostic severity: {_safe_error(str(severity))}")
    if not message:
        raise OperationResultError("Diagnostic message cannot be empty")
    if retry_disposition not in RETRY_DISPOSITIONS:
        raise OperationResultError(
            f"Unknown retry disposition: {_safe_error(str(retry_disposition))}"
        )
    if not retry_reason:
        raise OperationResultError("Retry guidance must include a reason")
    if retry_disposition == "retry-later":
        if (
            not isinstance(retry_after_seconds, int)
            or isinstance(retry_after_seconds, bool)
            or retry_after_seconds < 1
            or retry_after_seconds > 86400
        ):
            raise OperationResultError("retry-later requires retryAfterSeconds between 1 and 86400")
    elif retry_after_seconds is not None:
        raise OperationResultError("retryAfterSeconds is only valid for retry-later")

    action_ids = list(related_action_ids or [])
    if any(
        not isinstance(item, str) or not _IDENTIFIER.fullmatch(item)
        for item in action_ids
    ) or len(action_ids) != len(set(action_ids)):
        raise OperationResultError("Diagnostic related action IDs must be unique kebab-case identifiers")

    retry: dict[str, Any] = {
        "disposition": retry_disposition,
        "reason": retry_reason,
    }
    if retry_after_seconds is not None:
        retry["retryAfterSeconds"] = retry_after_seconds
    diagnostic = {
        "$schema": DIAGNOSTIC_SCHEMA,
        "protocolVersion": "1",
        "code": code,
        "severity": severity,
        "message": message,
        "locations": deepcopy(locations or []),
        "evidence": deepcopy(evidence or []),
        "retry": retry,
        "relatedActionIds": action_ids,
    }
    _reject_projection_controls(diagnostic, "diagnostic")
    _validate_contract(diagnostic, DIAGNOSTIC_SCHEMA, "Diagnostic")
    return diagnostic


def make_typed_result(schema_id: str, value: Any) -> dict[str, Any]:
    """Bind a result value to its schema identity and canonical content hash."""
    if not isinstance(schema_id, str) or not schema_id:
        raise OperationResultError("Typed results require a schema ID")
    result_value = deepcopy(value)
    _validate_contract(result_value, schema_id, "Typed result value")
    _reject_typed_value_controls(result_value, schema_id)
    return {
        "schemaId": schema_id,
        "contentHash": _canonical_content_hash(result_value, "Typed result value"),
        "value": result_value,
    }


def make_operation_result(
    operation: str,
    status: str,
    summary: str,
    request_hash: str,
    *,
    diagnostics: list[dict[str, Any]] | None = None,
    next_actions: list[dict[str, Any]] | None = None,
    result: dict[str, Any] | None = None,
    side_effects_occurred: bool = False,
) -> dict[str, Any]:
    """Build an immutable operation result from facts shared by all projections."""
    if not isinstance(operation, str) or operation not in OPERATIONS:
        raise OperationResultError(f"Unknown operation: {_safe_error(str(operation))}")
    if not isinstance(status, str) or status not in STATUSES:
        raise OperationResultError(f"Unknown status: {_safe_error(str(status))}")
    if not isinstance(summary, str) or not summary:
        raise OperationResultError("Operation summary cannot be empty")
    if not isinstance(request_hash, str) or not _CONTENT_HASH.fullmatch(request_hash):
        raise OperationResultError("Request hash must be a sha256 content identifier")
    if not isinstance(side_effects_occurred, bool):
        raise OperationResultError("sideEffectsOccurred must be a boolean")

    diagnostic_values = deepcopy(diagnostics or [])
    action_values = deepcopy(next_actions or [])
    if not isinstance(diagnostic_values, list):
        raise OperationResultError("Operation result diagnostics must be an array")
    if not isinstance(action_values, list):
        raise OperationResultError("Operation result nextActions must be an array")
    _reject_projection_controls(summary, "operation-result.summary")
    _reject_projection_controls(diagnostic_values, "operation-result.diagnostics")
    _reject_projection_controls(action_values, "operation-result.nextActions")
    for diagnostic in diagnostic_values:
        _validate_contract(diagnostic, DIAGNOSTIC_SCHEMA, "Diagnostic")
    for action in action_values:
        _validate_contract(action, NEXT_ACTION_SCHEMA, "Next action")
    _validate_status_semantics(status, diagnostic_values, action_values)
    _validate_action_references(diagnostic_values, action_values)

    envelope: dict[str, Any] = {
        "$schema": OPERATION_RESULT_SCHEMA,
        "protocolVersion": "1",
        "documentKind": "operation-result",
        "operation": operation,
        "status": status,
        "summary": summary,
        "requestHash": request_hash,
        "sideEffectsOccurred": side_effects_occurred,
        "diagnostics": diagnostic_values,
        "nextActions": action_values,
    }
    if result is not None:
        _reject_projection_controls(
            {"result": result},
            "operation-result",
            skip_typed_value=True,
        )
        _verify_typed_result(result)
        envelope["result"] = deepcopy(result)
    envelope["contentHash"] = _canonical_content_hash(envelope, "Operation result")
    _reject_projection_controls(envelope, "operation-result", skip_typed_value=True)
    _validate_contract(envelope, OPERATION_RESULT_SCHEMA, "Operation result")
    return envelope


def verify_operation_result_hash(envelope: dict[str, Any]) -> None:
    """Reject a result whose envelope or typed payload no longer matches its hash."""
    if not isinstance(envelope, dict):
        raise OperationResultError("Operation result must be an object")
    _reject_projection_controls(envelope, "operation-result", skip_typed_value=True)
    _validate_contract(envelope, OPERATION_RESULT_SCHEMA, "Operation result")
    expected = envelope.get("contentHash")
    unhashed = {key: value for key, value in envelope.items() if key != "contentHash"}
    actual = _canonical_content_hash(unhashed, "Operation result")
    if expected != actual:
        raise OperationResultError(
            "Operation result content hash mismatch: "
            f"expected {_safe_error(str(expected))}, calculated {actual}"
        )
    if "result" in envelope:
        _verify_typed_result(envelope["result"])


def exit_code_for_status(status: str) -> int:
    """Return the stable process exit code for an operation status."""
    if not isinstance(status, str):
        raise OperationResultError(f"Unknown status: {_safe_error(str(status))}")
    try:
        return EXIT_CODES[status]
    except KeyError as error:
        raise OperationResultError(f"Unknown status: {_safe_error(status)}") from error


def render_operation_result(envelope: dict[str, Any], output_format: str) -> str:
    """Render one verified envelope; machine formats contain JSON and no decorations."""
    verify_operation_result_hash(envelope)
    if output_format == "json-compact":
        return canonical_json.canonical_json(envelope) + "\n"
    if output_format == "json":
        return json.dumps(envelope, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output_format == "text":
        return _render_text(envelope)
    raise OperationResultError(
        f"Unknown output format: {_safe_error(str(output_format))}"
    )


def _validate_status_semantics(
    status: str,
    diagnostics: list[dict[str, Any]],
    next_actions: list[dict[str, Any]],
) -> None:
    if status != "success" and not diagnostics:
        raise OperationResultError(f"Status {status} requires at least one diagnostic")
    if status in {"blocked", "approval-required"} and not next_actions:
        raise OperationResultError(f"Status {status} requires at least one next action")
    severities = {diagnostic.get("severity") for diagnostic in diagnostics}
    if status in {"blocked", "approval-required"} and not severities.intersection({"warning", "error"}):
        raise OperationResultError(f"Status {status} requires a warning or error diagnostic")
    if status == "success" and "error" in severities:
        raise OperationResultError("Successful results cannot contain error diagnostics")
    if status in {"denied", "invocation-error", "invalid", "integrity-error", "unexpected"} and "error" not in severities:
        raise OperationResultError(f"Status {status} requires an error diagnostic")


def _validate_action_references(
    diagnostics: list[dict[str, Any]],
    next_actions: list[dict[str, Any]],
) -> None:
    action_ids = [action.get("id") for action in next_actions]
    if any(not isinstance(identifier, str) or not _IDENTIFIER.fullmatch(identifier) for identifier in action_ids):
        raise OperationResultError("Next action IDs must be kebab-case identifiers")
    if len(action_ids) != len(set(action_ids)):
        raise OperationResultError("Next action IDs must be unique")
    unknown_references = sorted(
        {
            action_id
            for diagnostic in diagnostics
            for action_id in diagnostic.get("relatedActionIds", [])
            if action_id not in action_ids
        }
    )
    if unknown_references:
        raise OperationResultError(
            f"Diagnostics reference unknown next actions: {', '.join(unknown_references)}"
        )


def _verify_typed_result(result: dict[str, Any]) -> None:
    if not isinstance(result, dict) or set(result) != {"schemaId", "contentHash", "value"}:
        raise OperationResultError("Typed result must contain only schemaId, contentHash, and value")
    if not isinstance(result["schemaId"], str) or not result["schemaId"]:
        raise OperationResultError("Typed result schemaId cannot be empty")
    _validate_contract(result["value"], result["schemaId"], "Typed result value")
    _reject_typed_value_controls(result["value"], result["schemaId"])
    actual = _canonical_content_hash(result["value"], "Typed result value")
    if result["contentHash"] != actual:
        raise OperationResultError(
            "Typed result content hash mismatch: "
            f"expected {_safe_error(str(result['contentHash']))}, calculated {actual}"
        )


def _render_text(envelope: dict[str, Any]) -> str:
    lines = [
        f"Operation: {envelope['operation']}",
        f"Status: {envelope['status']}",
        envelope["summary"],
    ]
    for diagnostic in envelope["diagnostics"]:
        lines.append(f"Diagnostic [{diagnostic['code']}] {diagnostic['severity']}: {diagnostic['message']}")
        for location in diagnostic["locations"]:
            detail = location["reference"] + location.get("pointer", "")
            coordinates = []
            if "line" in location:
                coordinates.append(f"line {location['line']}")
            if "column" in location:
                coordinates.append(f"column {location['column']}")
            if coordinates:
                detail += f" [{', '.join(coordinates)}]"
            lines.append(f"  Location ({location['kind']}): {detail}")
        if diagnostic["evidence"]:
            for evidence in diagnostic["evidence"]:
                lines.append(
                    f"  Evidence ({evidence['classification']}): {evidence['reference']} "
                    f"[{evidence['contentHash']}]"
                )
        else:
            lines.append("  Evidence: none")
        retry = diagnostic["retry"]
        delay = (
            f" after {retry['retryAfterSeconds']} seconds"
            if "retryAfterSeconds" in retry
            else ""
        )
        lines.append(f"  Retry: {retry['disposition']}{delay} — {retry['reason']}")
        if diagnostic["relatedActionIds"]:
            lines.append(f"  Related actions: {', '.join(diagnostic['relatedActionIds'])}")
    for action in envelope["nextActions"]:
        lines.append(f"Next action [{action['id']}] ({action['kind']}): {action['title']}")
        lines.append(f"  {action['description']}")
        lines.append(f"  Automation: {action['automation']}")
        _render_action_details(lines, action)
    if "result" in envelope:
        lines.append(f"Result schema: {envelope['result']['schemaId']}")
        lines.append(f"Result hash: {envelope['result']['contentHash']}")
        _render_typed_result_details(lines, envelope["result"])
    lines.extend(
        [
            f"Side effects occurred: {'yes' if envelope['sideEffectsOccurred'] else 'no'}",
            f"Request hash: {envelope['requestHash']}",
            f"Content hash: {envelope['contentHash']}",
        ]
    )
    return "\n".join(lines) + "\n"


def _render_typed_result_details(lines: list[str], result: dict[str, Any]) -> None:
    """Render material facts for known typed values without changing their evidence."""
    if result["schemaId"] != "https://schemas.cratis.io/factory/v1/evaluation-result.schema.json":
        return
    value = result["value"]
    coverage = value["coverage"]
    executed_case_ids = [case["caseId"] for case in value["cases"]]
    lines.extend(
        [
            f"Coverage scope: {coverage['scope']}",
            "Catalog case IDs: " + ", ".join(coverage["catalogCaseIds"]),
            "Executable case IDs: " + ", ".join(coverage["executableCaseIds"]),
            "Selected case IDs: " + ", ".join(coverage["selectedCaseIds"]),
            "Executed case IDs: " + ", ".join(executed_case_ids),
        ]
    )


def _render_action_details(lines: list[str], action: dict[str, Any]) -> None:
    kind = action["kind"]
    if kind == "run-command":
        lines.extend(
            [
                f"  Capability: {action['capabilityId']}",
                f"  Declared effect: {action['declaredEffect']}",
                f"  Approval required: {'yes' if action['requiresApproval'] else 'no'}",
                f"  Working directory: {action['workingDirectory']}",
                f"  Arguments: {json.dumps(action['argv'], ensure_ascii=False)}",
            ]
        )
    elif kind == "retry-operation":
        lines.append(f"  Operation: {action['operation']}")
        if "retryAfterSeconds" in action:
            lines.append(f"  Retry after: {action['retryAfterSeconds']} seconds")
    elif kind in {"supply-input", "select-option"}:
        lines.append(f"  Input: {action['inputId']}")
        if "expected" in action:
            lines.append(f"  Expected: {action['expected']}")
        for option in action.get("options", []):
            lines.append(f"  Option [{option['id']}]: {option['label']} — {option['description']}")
    elif kind == "correct-input":
        location = action["location"]
        lines.append(f"  Location ({location['kind']}): {location['reference']}{location.get('pointer', '')}")
        lines.append(f"  Expected: {action['expected']}")
    elif kind == "inspect-details":
        lines.append(f"  Detail: {action['operation']} / {action['detailLevel']}")
    elif kind == "contact-maintainer":
        lines.append(f"  Reference: {action['reference']}")


@lru_cache(maxsize=1)
def _trusted_contracts() -> tuple[dict[str, dict[str, Any]], Registry]:
    schemas: dict[str, dict[str, Any]] = {}
    for path in sorted(_CONTRACTS.glob("*.schema.json")):
        try:
            document = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_json_object)
        except (OSError, ValueError) as error:
            raise OperationResultError(f"Could not load trusted schema {path.name}: {_safe_error(str(error))}") from error
        identifier = document.get("$id")
        if not isinstance(identifier, str):
            raise OperationResultError(f"Trusted schema {path.name} has no $id")
        try:
            Draft202012Validator.check_schema(document)
        except SchemaError as error:
            raise OperationResultError(
                f"Trusted schema {path.name} is invalid: {_safe_error(error.message)}"
            ) from error
        if identifier in schemas:
            raise OperationResultError(f"Trusted schema ID is duplicated: {_safe_error(identifier)}")
        schemas[identifier] = document
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document))
        for identifier, document in schemas.items()
    )
    return schemas, registry


def _validate_contract(value: Any, schema_id: str, label: str) -> None:
    schemas, registry = _trusted_contracts()
    schema = schemas.get(schema_id)
    if schema is None:
        raise OperationResultError(f"{label} references an untrusted schema ID: {_safe_error(schema_id)}")
    validator = Draft202012Validator(schema, format_checker=FormatChecker(), registry=registry)
    errors = sorted(
        validator.iter_errors(value),
        key=lambda error: (
            tuple(str(part) for part in error.absolute_path),
            error.message,
        ),
    )
    if errors:
        diagnostics = []
        for error in errors[:10]:
            pointer = "".join(f"/{str(part).replace('~', '~0').replace('/', '~1')}" for part in error.absolute_path)
            diagnostics.append(f"{pointer or '/'}: {_safe_error(error.message)}")
        if len(errors) > 10:
            diagnostics.append(f"... {len(errors) - 10} additional validation errors")
        raise OperationResultError(f"{label} does not conform to {schema_id}: {'; '.join(diagnostics)}")


def _reject_projection_controls(value: Any, location: str, *, skip_typed_value: bool = False) -> None:
    if isinstance(value, str):
        if _TERMINAL_CONTROL.search(value):
            raise OperationResultError(f"{location} contains terminal control characters")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _reject_projection_controls(item, f"{location}[{index}]", skip_typed_value=skip_typed_value)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _reject_projection_controls(key, f"{location}.<key>")
            if skip_typed_value and location == "operation-result.result" and key == "value":
                continue
            _reject_projection_controls(
                item,
                f"{location}.{key}",
                skip_typed_value=skip_typed_value,
            )


def _reject_typed_value_controls(value: Any, schema_id: str) -> None:
    """Reject durable projection controls, allowing only contract-annotated newlines."""

    def visit(current: Any, path: tuple[str | int, ...]) -> None:
        if isinstance(current, str):
            if _TYPED_VALUE_CONTROL.search(current):
                raise OperationResultError(
                    f"typed-result.value{_json_pointer(path)} contains terminal control characters"
                )
            if "\n" in current and not _schema_path_allows_multiline(schema_id, path):
                raise OperationResultError(
                    f"typed-result.value{_json_pointer(path)} contains a newline not explicitly permitted by its contract"
                )
            return
        if isinstance(current, list):
            for index, item in enumerate(current):
                visit(item, (*path, index))
            return
        if isinstance(current, dict):
            for key, item in current.items():
                if not isinstance(key, str) or _TERMINAL_CONTROL.search(key):
                    raise OperationResultError(
                        f"typed-result.value{_json_pointer(path)} contains an unsafe object key"
                    )
                visit(item, (*path, key))

    visit(value, ())


def _schema_path_allows_multiline(
    schema_id: str,
    path: tuple[str | int, ...],
) -> bool:
    schemas, _ = _trusted_contracts()
    root = schemas.get(schema_id)
    if root is None:
        return False
    visited: set[tuple[int, str, tuple[str | int, ...]]] = set()

    def search(
        schema: Any,
        current_schema_id: str,
        remaining: tuple[str | int, ...],
    ) -> bool:
        if not isinstance(schema, dict):
            return False
        marker = (id(schema), current_schema_id, remaining)
        if marker in visited:
            return False
        visited.add(marker)
        reference = schema.get("$ref")
        if isinstance(reference, str):
            resolved = _resolve_schema_reference(schemas, current_schema_id, reference)
            if resolved is not None and search(resolved[0], resolved[1], remaining):
                return True
        if not remaining:
            if schema.get("x-cratis-multiline") is True:
                return True
            return any(
                search(branch, current_schema_id, remaining)
                for keyword in ("allOf", "anyOf", "oneOf")
                for branch in schema.get(keyword, [])
            )
        token, *tail = remaining
        next_path = tuple(tail)
        if isinstance(token, str):
            properties = schema.get("properties")
            if isinstance(properties, dict) and token in properties:
                if search(properties[token], current_schema_id, next_path):
                    return True
        elif isinstance(token, int):
            items = schema.get("items")
            if isinstance(items, dict) and search(items, current_schema_id, next_path):
                return True
        return any(
            search(branch, current_schema_id, remaining)
            for keyword in ("allOf", "anyOf", "oneOf")
            for branch in schema.get(keyword, [])
        )

    return search(root, schema_id, path)


def _resolve_schema_reference(
    schemas: dict[str, dict[str, Any]],
    current_schema_id: str,
    reference: str,
) -> tuple[Any, str] | None:
    base, separator, fragment = reference.partition("#")
    target_id = base or current_schema_id
    target: Any = schemas.get(target_id)
    if target is None:
        return None
    if separator and fragment:
        if not fragment.startswith("/"):
            return None
        for encoded_part in fragment[1:].split("/"):
            part = encoded_part.replace("~1", "/").replace("~0", "~")
            if not isinstance(target, dict) or part not in target:
                return None
            target = target[part]
    return target, target_id


def _json_pointer(path: tuple[str | int, ...]) -> str:
    if not path:
        return ""
    return "".join(
        "/" + str(part).replace("~", "~0").replace("/", "~1")
        for part in path
    )


def _safe_error(value: str) -> str:
    escaped = "".join(
        f"\\u{ord(character):04x}" if _TERMINAL_CONTROL.fullmatch(character) else character
        for character in value
    )
    return escaped[:1000]


def _canonical_content_hash(value: Any, label: str) -> str:
    try:
        return canonical_json.content_hash(value)
    except canonical_json.CanonicalJsonError as error:
        raise OperationResultError(
            f"{label} cannot be represented by canonical JSON: {_safe_error(str(error))}"
        ) from error


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate object key {key}")
        value[key] = item
    return value
