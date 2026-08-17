#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Run immutable, deterministic Stage 0 Cratis Factory evaluations."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import stat
import subprocess
import sys
import tempfile
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json
import compile_factory
import operation_result
import preflight_factory
import resolve_factory
import trusted_git
import validate_factory


RUNNER_VERSION = "0.2.0"
MAXIMUM_FIXTURE_FILES = 1_000
MAXIMUM_FIXTURE_BYTES = 20_000_000
MAXIMUM_FIXTURE_DEPTH = 64
EXCLUDED_FIXTURE_DIRECTORIES = frozenset({"bin", "obj", "__pycache__", "node_modules"})
PLACEHOLDER_VALUES = {"placeholder", "tbd", "todo", "implement-me", "not-implemented"}
EVALUATION_RESULT_SCHEMA = "https://schemas.cratis.io/factory/v1/evaluation-result.schema.json"


class EvaluationFailure(Exception):
    """Raised when an evaluation definition or immutable input is invalid."""


class EvaluationOutputFailure(Exception):
    """Raised when an evaluation projection cannot be published safely."""

    def __init__(
        self,
        message: str,
        *,
        status: str = "unexpected",
        output_published: bool = False,
        temporary_artifact_may_remain: bool = False,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.output_published = output_published
        self.temporary_artifact_may_remain = temporary_artifact_may_remain


@dataclass(frozen=True)
class FixtureFile:
    """One exact regular file captured from a fixture tree."""

    path: str
    content: bytes
    executable: bool


@dataclass(frozen=True)
class FixtureSnapshot:
    """An immutable in-memory fixture tree used by every evaluation operation."""

    tree_hash: str
    files: tuple[FixtureFile, ...]


@dataclass(frozen=True)
class OutputDestination:
    """One outside output entry bound to its existing parent directory identity."""

    parent: Path
    name: str
    parent_device: int
    parent_inode: int


class _OperationArgumentParser(argparse.ArgumentParser):
    """Render invocation failures through the shared operation-result protocol."""

    def error(self, message: str) -> None:
        raw_arguments = sys.argv[1:]
        operation = "verify-evaluation-result" if any(
            value == "--verify-result" or value.startswith("--verify-result=")
            for value in raw_arguments
        ) else "evaluate"
        output_format = _requested_output_format(raw_arguments)
        request_hash = _canonical_hash(
            {
                "operation": operation,
                "invocationArguments": [_safe_text(value) for value in raw_arguments],
            },
            "Evaluation invocation",
        )
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-EVALUATION-INVOCATION-INVALID",
            "error",
            _safe_text(message) or "Factory evaluation invocation is invalid",
            "retry-after-correction",
            "Correct the command arguments and run the operation again.",
        )
        envelope = operation_result.make_operation_result(
            operation,
            "invocation-error",
            "Factory evaluation invocation is invalid.",
            request_hash,
            diagnostics=[diagnostic],
            side_effects_occurred=False,
        )
        print(operation_result.render_operation_result(envelope, output_format), end="")
        raise SystemExit(operation_result.exit_code_for_status("invocation-error"))


def run_evaluations(
    documents: dict[Path, dict[str, Any]],
    catalog: dict[str, Any],
    selected_case_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Execute selected catalog cases and return one self-addressed deterministic result."""
    _ensure_canonical_value(catalog, "Evaluation catalog")
    _validate_runtime_document(
        catalog,
        "https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json",
        "evaluation-catalog",
        documents,
    )
    snapshots = _validate_executable_catalog(catalog, documents)
    executions = catalog["executions"]
    if selected_case_ids is not None:
        if len(selected_case_ids) != len(set(selected_case_ids)):
            raise EvaluationFailure("Selected evaluation case identifiers must be unique")
        requested = set(selected_case_ids)
        available = {execution["caseId"] for execution in executions}
        unknown = sorted(requested - available)
        if unknown:
            raise EvaluationFailure(
                "Unknown or non-executable evaluation cases: " + ", ".join(unknown)
            )
        executions = [execution for execution in executions if execution["caseId"] in requested]
    if not executions:
        raise EvaluationFailure("At least one executable evaluation case must be selected")

    fixtures = {fixture["id"]: fixture for fixture in catalog["fixtures"]}
    case_results = [
        _run_execution(
            execution,
            fixtures[execution["fixtureId"]],
            snapshots[execution["fixtureId"]],
            documents,
        )
        for execution in executions
    ]
    summary = {
        "total": len(case_results),
        "passed": sum(case["outcome"] == "pass" for case in case_results),
        "failed": sum(case["outcome"] == "fail" for case in case_results),
        "blocked": sum(case["outcome"] == "blocked" for case in case_results),
    }
    outcome = "blocked" if summary["blocked"] else "fail" if summary["failed"] else "pass"
    result: dict[str, Any] = {
        "$schema": "https://schemas.cratis.io/factory/v1/evaluation-result.schema.json",
        "protocolVersion": "1",
        "runnerVersion": RUNNER_VERSION,
        "catalog": {
            "version": catalog["version"],
            "contentHash": _canonical_hash(catalog, "Evaluation catalog"),
        },
        "coverage": _coverage(catalog, executions),
        "outcome": outcome,
        "summary": summary,
        "cases": case_results,
    }
    result["contentHash"] = _canonical_hash(result, "Evaluation result")
    _verify_evaluation_result_integrity(result, documents, catalog)
    return result


def verify_evaluation_result(
    result: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
    catalog: dict[str, Any] | None = None,
) -> None:
    """Rerun exact catalog-bound executions and require the saved result to match."""
    if catalog is None:
        _ensure_canonical_value(result, "Evaluation result")
        _validate_runtime_document(
            result,
            EVALUATION_RESULT_SCHEMA,
            "evaluation-result",
            documents,
        )
    trusted_catalog = catalog or _find_result_catalog(result, documents)
    _verify_evaluation_result_integrity(result, documents, trusted_catalog)
    authoritative = run_evaluations(
        documents,
        trusted_catalog,
        list(result["coverage"]["selectedCaseIds"]),
    )
    if authoritative != result:
        raise EvaluationFailure(
            "Evaluation result does not match an authoritative rerun of its exact catalog-bound executions"
        )


def _verify_evaluation_result_integrity(
    result: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
    trusted_catalog: dict[str, Any],
) -> None:
    """Verify canonical integrity, coverage, bindings, and assertion semantics."""
    _ensure_canonical_value(result, "Evaluation result")
    _validate_runtime_document(
        result,
        EVALUATION_RESULT_SCHEMA,
        "evaluation-result",
        documents,
    )
    expected_hash = result["contentHash"]
    actual_hash = _canonical_hash(
        {key: value for key, value in result.items() if key != "contentHash"},
        "Evaluation result",
    )
    if expected_hash != actual_hash:
        raise EvaluationFailure(
            f"Evaluation result content hash mismatch: expected {expected_hash}, calculated {actual_hash}"
        )
    _ensure_canonical_value(trusted_catalog, "Evaluation catalog")
    _validate_runtime_document(
        trusted_catalog,
        "https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json",
        "evaluation-catalog",
        documents,
    )
    if result["catalog"] != {
        "version": trusted_catalog["version"],
        "contentHash": _canonical_hash(trusted_catalog, "Evaluation catalog"),
    }:
        raise EvaluationFailure("Evaluation result is not bound to the trusted catalog")
    _verify_coverage(result, trusted_catalog)
    _verify_result_case_bindings(result, trusted_catalog)
    expected_summary = {
        "total": len(result["cases"]),
        "passed": sum(case["outcome"] == "pass" for case in result["cases"]),
        "failed": sum(case["outcome"] == "fail" for case in result["cases"]),
        "blocked": sum(case["outcome"] == "blocked" for case in result["cases"]),
    }
    if result["summary"] != expected_summary:
        raise EvaluationFailure(
            f"Evaluation result summary mismatch: expected {expected_summary}, received {result['summary']}"
        )
    expected_outcome = (
        "blocked"
        if expected_summary["blocked"]
        else "fail"
        if expected_summary["failed"]
        else "pass"
    )
    if result["outcome"] != expected_outcome:
        raise EvaluationFailure(
            f"Evaluation result outcome mismatch: expected {expected_outcome}, received {result['outcome']}"
        )


def _find_result_catalog(
    result: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any]:
    matches = [
        document
        for document in documents.values()
        if document.get("documentKind") == "evaluation-catalog"
        and document.get("version") == result["catalog"]["version"]
        and _canonical_hash(document, "Evaluation catalog") == result["catalog"]["contentHash"]
    ]
    if len(matches) != 1:
        raise EvaluationFailure(
            "Evaluation result verification requires exactly one current trusted catalog match"
        )
    return matches[0]


def _coverage(
    catalog: dict[str, Any],
    selected_executions: list[dict[str, Any]],
) -> dict[str, Any]:
    catalog_case_ids = [case["id"] for case in catalog["cases"]]
    executable_case_ids = [execution["caseId"] for execution in catalog["executions"]]
    selected_case_ids = [execution["caseId"] for execution in selected_executions]
    if (
        len(selected_case_ids) == len(catalog_case_ids)
        and set(selected_case_ids) == set(catalog_case_ids)
        and len(executable_case_ids) == len(catalog_case_ids)
        and set(executable_case_ids) == set(catalog_case_ids)
    ):
        scope = "full-catalog"
    elif selected_case_ids == executable_case_ids:
        scope = "full-executable-catalog"
    else:
        scope = "selected-executable-cases"
    return {
        "scope": scope,
        "catalogCaseCount": len(catalog_case_ids),
        "catalogCaseIds": catalog_case_ids,
        "executableCaseCount": len(executable_case_ids),
        "executableCaseIds": executable_case_ids,
        "selectedCaseCount": len(selected_case_ids),
        "selectedCaseIds": selected_case_ids,
    }


def _verify_coverage(result: dict[str, Any], catalog: dict[str, Any]) -> None:
    executions_by_case = {
        execution["caseId"]: execution for execution in catalog["executions"]
    }
    selected_case_ids = result["coverage"]["selectedCaseIds"]
    if any(case_id not in executions_by_case for case_id in selected_case_ids):
        raise EvaluationFailure("Evaluation result coverage selects a non-executable case")
    expected = _coverage(
        catalog,
        [executions_by_case[case_id] for case_id in selected_case_ids],
    )
    if result["coverage"] != expected:
        raise EvaluationFailure(
            "Evaluation result coverage does not match catalog and selected execution facts"
        )
    result_case_ids = [case["caseId"] for case in result["cases"]]
    if result_case_ids != selected_case_ids:
        raise EvaluationFailure(
            "Evaluation result case order does not match its explicit coverage selection"
        )


def _verify_result_case_bindings(
    result: dict[str, Any],
    catalog: dict[str, Any],
) -> None:
    executions = {execution["id"]: execution for execution in catalog["executions"]}
    fixtures = {fixture["id"]: fixture for fixture in catalog["fixtures"]}
    result_execution_ids = [case["executionId"] for case in result["cases"]]
    if len(result_execution_ids) != len(set(result_execution_ids)):
        raise EvaluationFailure("Evaluation result contains duplicate executions")
    for case in result["cases"]:
        execution = executions.get(case["executionId"])
        if execution is None:
            raise EvaluationFailure(
                f"Evaluation result references unknown execution {case['executionId']}"
            )
        fixture = fixtures[execution["fixtureId"]]
        binding = {
            "caseId": execution["caseId"],
            "executionHash": execution["contentHash"],
            "fixtureId": fixture["id"],
            "fixtureTreeHash": fixture["treeHash"],
            "operation": execution["kind"],
        }
        for field, expected in binding.items():
            if case[field] != expected:
                raise EvaluationFailure(
                    f"Evaluation result {case['executionId']} {field} is not catalog-bound"
                )
        expected_assertions = {
            assertion["id"]: assertion for assertion in execution["assertions"]
        }
        actual_assertion_ids = [assertion["id"] for assertion in case["assertions"]]
        if set(actual_assertion_ids) != set(expected_assertions) or len(actual_assertion_ids) != len(
            set(actual_assertion_ids)
        ):
            raise EvaluationFailure(
                f"Evaluation result {case['executionId']} assertions do not match the catalog"
            )
        for assertion in case["assertions"]:
            expected = expected_assertions[assertion["id"]]
            for field in ("path", "operator"):
                if assertion[field] != expected[field]:
                    raise EvaluationFailure(
                        f"Evaluation result {case['executionId']} assertion "
                        f"{assertion['id']} {field} is not catalog-bound"
                    )
            if not _json_equal(assertion["expected"], expected["expected"]):
                raise EvaluationFailure(
                    f"Evaluation result {case['executionId']} assertion "
                    f"{assertion['id']} expected is not catalog-bound"
                )
        assertion_outcomes = [assertion["outcome"] for assertion in case["assertions"]]
        if case["outcome"] == "blocked":
            if case["operationHash"] is not None or set(assertion_outcomes) != {"blocked"}:
                raise EvaluationFailure(
                    f"Blocked evaluation result {case['executionId']} has inconsistent evidence"
                )
            if any(
                assertion["actualAvailable"]
                or assertion["actual"] is not None
                or assertion["diagnosticCode"] != "operation-blocked"
                for assertion in case["assertions"]
            ):
                raise EvaluationFailure(
                    f"Blocked evaluation result {case['executionId']} contains invented assertion evidence"
                )
        else:
            if case["operationHash"] is None or "blocked" in assertion_outcomes:
                raise EvaluationFailure(
                    f"Completed evaluation result {case['executionId']} has inconsistent evidence"
                )
            for assertion in case["assertions"]:
                expected_assertion = expected_assertions[assertion["id"]]
                expected_outcome, expected_diagnostic = _assertion_semantics_from_actual(
                    expected_assertion,
                    assertion["actual"],
                    assertion["actualAvailable"],
                )
                if (
                    assertion["outcome"] != expected_outcome
                    or assertion["diagnosticCode"] != expected_diagnostic
                ):
                    raise EvaluationFailure(
                        f"Evaluation result {case['executionId']} assertion "
                        f"{assertion['id']} outcome or diagnostic is not derived from actual evidence"
                    )
            expected_case_outcome = (
                "pass" if set(assertion_outcomes) == {"pass"} else "fail"
            )
            if case["outcome"] != expected_case_outcome:
                raise EvaluationFailure(
                    f"Evaluation result {case['executionId']} outcome does not match its assertions"
                )


def fixture_tree_hash(root: Path) -> str:
    """Capture and hash exact fixture paths, bytes, and executable bits."""
    return _capture_fixture_snapshot(root).tree_hash


def _capture_fixture_snapshot(root: Path) -> FixtureSnapshot:
    declared_root = root.absolute()
    if declared_root.is_symlink():
        raise EvaluationFailure(f"Evaluation fixture root must not be a symbolic link: {declared_root}")
    try:
        resolved_root = declared_root.resolve(strict=True)
    except OSError as error:
        raise EvaluationFailure(f"Evaluation fixture directory does not exist: {declared_root}") from error
    if not resolved_root.is_dir():
        raise EvaluationFailure(f"Evaluation fixture directory does not exist: {declared_root}")
    if not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
        raise EvaluationFailure("Secure descriptor-relative fixture capture is unavailable")
    root_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    try:
        root_descriptor = os.open(resolved_root, root_flags)
    except OSError as error:
        raise EvaluationFailure("Evaluation fixture root changed while being captured") from error
    try:
        if not stat.S_ISDIR(os.fstat(root_descriptor).st_mode):
            raise EvaluationFailure("Evaluation fixture root is not a directory")
        files, hash_entries = _capture_fixture_directory(root_descriptor)
    finally:
        os.close(root_descriptor)
    if not files:
        raise EvaluationFailure(f"Evaluation fixture is empty: {declared_root}")
    return FixtureSnapshot(
        _canonical_hash({"files": hash_entries}, "Evaluation fixture tree"),
        tuple(files),
    )


def _capture_fixture_directory(
    root_descriptor: int,
) -> tuple[list[FixtureFile], list[dict[str, Any]]]:
    """Walk one fixture using no-follow descriptor-relative access for every component.

    Directories named in EXCLUDED_FIXTURE_DIRECTORIES are skipped so that build output a
    local toolchain deposits inside a fixture - obj/ and bin/ from MSBuild, __pycache__ from
    Python, node_modules from a package manager - can never change a content-addressed
    fixture's tree hash. Fixtures declare source only; the same directories are already
    ignored by repository resolution.
    """
    files: list[FixtureFile] = []
    hash_entries: list[dict[str, Any]] = []
    total_bytes = 0
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    file_flags = (
        os.O_RDONLY
        | os.O_NOFOLLOW
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NONBLOCK", 0)
    )
    stable_fields = ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns")

    def capture(directory_descriptor: int, prefix: tuple[str, ...], depth: int) -> None:
        nonlocal total_bytes
        if depth > MAXIMUM_FIXTURE_DEPTH:
            raise EvaluationFailure(
                f"Evaluation fixture exceeds the {MAXIMUM_FIXTURE_DEPTH} directory depth limit"
            )
        try:
            names = sorted(os.listdir(directory_descriptor))
        except OSError as error:
            location = "/".join(prefix) or "."
            raise EvaluationFailure(
                f"Evaluation fixture directory changed while being captured: {location}"
            ) from error
        for name in names:
            relative_parts = (*prefix, name)
            relative_path = "/".join(relative_parts)
            if name.casefold() == ".git":
                raise EvaluationFailure(
                    f"Evaluation fixture contains forbidden Git metadata: {relative_path}"
                )
            try:
                before_path = os.stat(name, dir_fd=directory_descriptor, follow_symlinks=False)
            except OSError as error:
                raise EvaluationFailure(
                    f"Evaluation fixture entry changed while being captured: {relative_path}"
                ) from error
            if stat.S_ISLNK(before_path.st_mode):
                raise EvaluationFailure(
                    f"Evaluation fixture contains a forbidden symbolic link: {relative_path}"
                )
            if stat.S_ISDIR(before_path.st_mode):
                if name.casefold() in EXCLUDED_FIXTURE_DIRECTORIES:
                    continue
                try:
                    child_descriptor = os.open(
                        name,
                        directory_flags,
                        dir_fd=directory_descriptor,
                    )
                except OSError as error:
                    raise EvaluationFailure(
                        f"Evaluation fixture entry changed while being captured: {relative_path}"
                    ) from error
                try:
                    opened = os.fstat(child_descriptor)
                    if any(
                        getattr(before_path, field) != getattr(opened, field)
                        for field in ("st_dev", "st_ino", "st_mode")
                    ):
                        raise EvaluationFailure(
                            f"Evaluation fixture entry changed while being captured: {relative_path}"
                        )
                    capture(child_descriptor, relative_parts, depth + 1)
                finally:
                    os.close(child_descriptor)
                continue
            if not stat.S_ISREG(before_path.st_mode):
                raise EvaluationFailure(
                    f"Evaluation fixture contains an unsupported entry: {relative_path}"
                )
            if len(files) >= MAXIMUM_FIXTURE_FILES:
                raise EvaluationFailure(
                    f"Evaluation fixture exceeds the {MAXIMUM_FIXTURE_FILES} file limit"
                )
            try:
                descriptor = os.open(name, file_flags, dir_fd=directory_descriptor)
            except OSError as error:
                raise EvaluationFailure(
                    f"Evaluation fixture entry changed while being captured: {relative_path}"
                ) from error
            try:
                before_read = os.fstat(descriptor)
                if not stat.S_ISREG(before_read.st_mode):
                    raise EvaluationFailure(
                        f"Evaluation fixture contains an unsupported entry: {relative_path}"
                    )
                chunks: list[bytes] = []
                file_bytes = 0
                while True:
                    chunk = os.read(
                        descriptor,
                        min(64 * 1024, MAXIMUM_FIXTURE_BYTES + 1 - file_bytes),
                    )
                    if not chunk:
                        break
                    chunks.append(chunk)
                    file_bytes += len(chunk)
                    if total_bytes + file_bytes > MAXIMUM_FIXTURE_BYTES:
                        raise EvaluationFailure(
                            f"Evaluation fixture exceeds the {MAXIMUM_FIXTURE_BYTES} byte limit"
                        )
                after_read = os.fstat(descriptor)
            finally:
                os.close(descriptor)
            if any(
                getattr(before_path, field) != getattr(before_read, field)
                or getattr(before_read, field) != getattr(after_read, field)
                for field in stable_fields
            ):
                raise EvaluationFailure(
                    f"Evaluation fixture entry changed while being captured: {relative_path}"
                )
            content = b"".join(chunks)
            total_bytes += len(content)
            executable = bool(before_read.st_mode & 0o111)
            files.append(FixtureFile(relative_path, content, executable))
            hash_entries.append(
                {
                    "path": relative_path,
                    "contentHash": canonical_json.bytes_content_hash(content),
                    "executable": executable,
                }
            )

    capture(root_descriptor, (), 0)
    return files, hash_entries


def _validate_executable_catalog(
    catalog: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> dict[str, FixtureSnapshot]:
    case_id_values = [case["id"] for case in catalog["cases"]]
    if len(case_id_values) != len(set(case_id_values)):
        raise EvaluationFailure("Evaluation case identifiers must be unique")
    case_ids = set(case_id_values)
    profile_ids = {
        document["id"]
        for document in documents.values()
        if document.get("documentKind") == "profile"
    }
    fixtures = {fixture["id"]: fixture for fixture in catalog["fixtures"]}
    if len(fixtures) != len(catalog["fixtures"]):
        raise EvaluationFailure("Evaluation fixture identifiers must be unique")
    fixture_paths = [fixture["path"] for fixture in catalog["fixtures"]]
    if len(fixture_paths) != len(set(fixture_paths)):
        raise EvaluationFailure("Evaluation fixture paths must be unique")
    execution_ids = [execution["id"] for execution in catalog["executions"]]
    if len(execution_ids) != len(set(execution_ids)):
        raise EvaluationFailure("Evaluation execution identifiers must be unique")
    execution_case_ids = [execution["caseId"] for execution in catalog["executions"]]
    if len(execution_case_ids) != len(set(execution_case_ids)):
        raise EvaluationFailure("Each executable evaluation case must have exactly one execution")

    snapshots: dict[str, FixtureSnapshot] = {}
    for fixture in catalog["fixtures"]:
        _verify_self_hash(fixture, f"Evaluation fixture {fixture['id']}")
        declared_root = validate_factory.ROOT / fixture["path"]
        if any(
            (validate_factory.ROOT.joinpath(*Path(fixture["path"]).parts[:index])).is_symlink()
            for index in range(1, len(Path(fixture["path"]).parts) + 1)
        ):
            raise EvaluationFailure(
                f"Evaluation fixture {fixture['id']} path contains a symbolic link"
            )
        root = declared_root.resolve()
        if not root.is_relative_to(validate_factory.ROOT.resolve()):
            raise EvaluationFailure(f"Evaluation fixture {fixture['id']} escapes the repository root")
        snapshot = _capture_fixture_snapshot(declared_root)
        if fixture["treeHash"] != snapshot.tree_hash:
            raise EvaluationFailure(
                f"Evaluation fixture {fixture['id']} tree hash mismatch: expected "
                f"{fixture['treeHash']}, calculated {snapshot.tree_hash}"
            )
        snapshots[fixture["id"]] = snapshot

    cases_by_id = {case["id"]: case for case in catalog["cases"]}
    for execution in catalog["executions"]:
        _verify_self_hash(execution, f"Evaluation execution {execution['id']}")
        if execution["caseId"] not in case_ids:
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} references unknown case {execution['caseId']}"
            )
        if execution["fixtureId"] not in fixtures:
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} references missing fixture {execution['fixtureId']}"
            )
        unknown_profiles = sorted(set(execution["expectedProfileIds"]) - profile_ids)
        if len(execution["expectedProfileIds"]) != len(set(execution["expectedProfileIds"])):
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} expected profile references must be unique"
            )
        if unknown_profiles:
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} expects unknown profiles: "
                + ", ".join(unknown_profiles)
            )
        expected_case_profile = (
            "none"
            if not execution["expectedProfileIds"]
            else execution["expectedProfileIds"][0]
            if len(execution["expectedProfileIds"]) == 1
            else "composed"
        )
        if cases_by_id[execution["caseId"]]["profile"] != expected_case_profile:
            raise EvaluationFailure(
                f"Executable case {execution['caseId']} profile must be {expected_case_profile}"
            )
        assertions = execution["assertions"]
        assertion_ids = [assertion["id"] for assertion in assertions]
        if len(assertion_ids) != len(set(assertion_ids)):
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} assertion identifiers must be unique"
            )
        if _contains_placeholder(execution):
            raise EvaluationFailure(
                f"Evaluation execution {execution['id']} contains a placeholder value"
            )
        _validate_profile_assertion(execution)
        if execution["kind"] == "resolve" and any(
            key in execution["request"] for key in ("workflow", "policy")
        ):
            raise EvaluationFailure(
                f"Resolve evaluation {execution['id']} cannot declare workflow or policy"
            )
        if execution["kind"] == "preflight" and "policy" not in execution["request"]:
            raise EvaluationFailure(
                f"Preflight evaluation {execution['id']} requires an explicit baseline policy"
            )
    return snapshots


def _validate_profile_assertion(execution: dict[str, Any]) -> None:
    path = (
        "/profiles"
        if execution["kind"] == "resolve"
        else "/repositoryBinding/resolvedProfile/profiles"
    )
    required = {
        "path": path,
        "operator": "project-set-equals",
        "field": "id",
        "expected": sorted(execution["expectedProfileIds"]),
    }
    if not any(all(assertion.get(key) == value for key, value in required.items()) for assertion in execution["assertions"]):
        raise EvaluationFailure(
            f"Evaluation execution {execution['id']} must contain an exact machine profile assertion"
        )


def _contains_placeholder(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in PLACEHOLDER_VALUES
    if isinstance(value, list):
        return any(_contains_placeholder(item) for item in value)
    if isinstance(value, dict):
        return any(_contains_placeholder(item) for item in value.values())
    return False


def _run_execution(
    execution: dict[str, Any],
    fixture: dict[str, Any],
    snapshot: FixtureSnapshot,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any]:
    try:
        with _materialize_fixture_snapshot(snapshot) as fixture_root:
            if execution["kind"] == "resolve":
                operation_value = resolve_factory.resolve_repository(
                    fixture_root,
                    execution["request"]["targetPath"],
                    execution["request"]["purpose"],
                    documents,
                )
            else:
                operation_value = _run_preflight(execution, fixture_root, snapshot, documents)
    except (
        EvaluationFailure,
        OSError,
        compile_factory.CompilationFailure,
        preflight_factory.PreflightFailure,
        resolve_factory.ResolutionFailure,
        validate_factory.ValidationFailure,
    ):
        return {
            "caseId": execution["caseId"],
            "executionId": execution["id"],
            "executionHash": execution["contentHash"],
            "fixtureId": fixture["id"],
            "fixtureTreeHash": fixture["treeHash"],
            "operation": execution["kind"],
            "operationHash": None,
            "outcome": "blocked",
            "assertions": [
                {
                    "id": assertion["id"],
                    "path": assertion["path"],
                    "operator": assertion["operator"],
                    "expected": deepcopy(assertion["expected"]),
                    "actual": None,
                    "actualAvailable": False,
                    "outcome": "blocked",
                    "diagnosticCode": "operation-blocked",
                }
                for assertion in execution["assertions"]
            ],
        }

    assertion_results = [
        _evaluate_assertion(assertion, operation_value)
        for assertion in execution["assertions"]
    ]
    return {
        "caseId": execution["caseId"],
        "executionId": execution["id"],
        "executionHash": execution["contentHash"],
        "fixtureId": fixture["id"],
        "fixtureTreeHash": fixture["treeHash"],
        "operation": execution["kind"],
        "operationHash": operation_value["contentHash"],
        "outcome": "pass" if all(result["outcome"] == "pass" for result in assertion_results) else "fail",
        "assertions": assertion_results,
    }


@contextmanager
def _materialize_fixture_snapshot(snapshot: FixtureSnapshot):
    with tempfile.TemporaryDirectory() as temporary_directory:
        root = Path(temporary_directory) / "repository"
        root.mkdir()
        for file in snapshot.files:
            relative = PurePosixPath(file.path)
            if (
                not file.path
                or relative.is_absolute()
                or any(part in {"", ".", ".."} or part.casefold() == ".git" for part in relative.parts)
            ):
                raise EvaluationFailure("Evaluation snapshot contains an unsafe fixture path")
            target = root.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file.content)
            os.chmod(target, 0o755 if file.executable else 0o644)
        yield root


def _run_preflight(
    execution: dict[str, Any],
    fixture_root: Path,
    snapshot: FixtureSnapshot,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any]:
    _initialize_deterministic_git_repository(fixture_root, snapshot)
    return preflight_factory.preflight_repository(
        documents,
        fixture_root,
        execution["request"]["targetPath"],
        execution["request"]["purpose"],
        execution["request"].get("workflow"),
        execution["request"]["policy"],
    )


def _initialize_deterministic_git_repository(
    repository: Path,
    expected_snapshot: FixtureSnapshot | None = None,
) -> None:
    environment = {
        "GIT_DEFAULT_HASH": "sha1",
        "GIT_AUTHOR_NAME": "Factory Evaluation",
        "GIT_AUTHOR_EMAIL": "factory-evaluation@example.invalid",
        "GIT_AUTHOR_DATE": "2000-01-01T00:00:00+00:00",
        "GIT_COMMITTER_NAME": "Factory Evaluation",
        "GIT_COMMITTER_EMAIL": "factory-evaluation@example.invalid",
        "GIT_COMMITTER_DATE": "2000-01-01T00:00:00+00:00",
    }
    commands = [
        ["init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template="],
        ["config", "--local", "core.filemode", "true"],
        ["add", "--force", "--all", "--"],
        [
            "commit",
            "--quiet",
            "--no-gpg-sign",
            "--no-verify",
            "-m",
            "immutable evaluation fixture",
        ],
    ]
    for command in commands:
        try:
            process = trusted_git.run(
                command,
                cwd=repository,
                timeout=10,
                environment_overrides=environment,
            )
        except trusted_git.TrustedGitError as error:
            raise EvaluationFailure("Hermetic trusted Git initialization failed") from error
        if process.returncode != 0:
            raise EvaluationFailure(f"Hermetic trusted Git {command[0]} command failed")
    if expected_snapshot is not None:
        _verify_git_snapshot(repository, expected_snapshot, environment)


def _verify_git_snapshot(
    repository: Path,
    snapshot: FixtureSnapshot,
    environment: dict[str, str],
) -> None:
    try:
        process = trusted_git.run(
            ["ls-tree", "-r", "-z", "--full-tree", "HEAD"],
            cwd=repository,
            text=False,
            timeout=10,
            environment_overrides=environment,
        )
    except trusted_git.TrustedGitError as error:
        raise EvaluationFailure("Could not verify the hermetic trusted Git tree") from error
    if process.returncode != 0:
        raise EvaluationFailure("Hermetic trusted Git tree verification failed")
    actual: dict[str, tuple[str, str]] = {}
    for record in process.stdout.split(b"\0"):
        if not record:
            continue
        try:
            header, encoded_path = record.split(b"\t", maxsplit=1)
            mode, object_type, object_id = header.decode("ascii").split(" ")
            path = encoded_path.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise EvaluationFailure("Hermetic Git tree contains an invalid entry") from error
        if object_type != "blob" or path in actual:
            raise EvaluationFailure("Hermetic Git tree contains an unsupported or duplicate entry")
        actual[path] = (mode, object_id)
    expected = {
        file.path: (
            "100755" if file.executable else "100644",
            _sha1_git_blob_id(file.content),
        )
        for file in snapshot.files
    }
    if actual != expected:
        raise EvaluationFailure(
            "Hermetic Git commit does not exactly match the captured fixture paths, bytes, and modes"
        )


def _sha1_git_blob_id(content: bytes) -> str:
    digest = hashlib.sha1()
    digest.update(f"blob {len(content)}\0".encode("ascii"))
    digest.update(content)
    return digest.hexdigest()


def _evaluate_assertion(assertion: dict[str, Any], operation_result: dict[str, Any]) -> dict[str, Any]:
    try:
        actual = _json_pointer(operation_result, assertion["path"])
    except (KeyError, IndexError, TypeError, ValueError):
        actual = None
        actual_available = False
    else:
        actual_available = True
    outcome, diagnostic_code = _assertion_semantics_from_actual(
        assertion,
        actual,
        actual_available,
    )
    return {
        "id": assertion["id"],
        "path": assertion["path"],
        "operator": assertion["operator"],
        "expected": deepcopy(assertion["expected"]),
        "actual": deepcopy(actual),
        "actualAvailable": actual_available,
        "outcome": outcome,
        "diagnosticCode": diagnostic_code,
    }


def _assertion_semantics_from_actual(
    assertion: dict[str, Any],
    actual: Any,
    actual_available: bool,
) -> tuple[str, str]:
    if not actual_available:
        return "fail", "assertion-path-invalid"
    try:
        passed = _apply_operator(assertion, actual)
    except (KeyError, IndexError, TypeError, ValueError):
        return "fail", "assertion-actual-invalid"
    return (
        ("pass", "assertion-passed")
        if passed
        else ("fail", "assertion-failed")
    )


def _json_pointer(document: Any, pointer: str) -> Any:
    current = document
    for encoded_part in pointer.split("/")[1:]:
        part = encoded_part.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            if not part.isdigit():
                raise TypeError("Array JSON Pointer parts must be non-negative integers")
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current[part]
        else:
            raise TypeError("JSON Pointer traversed a scalar")
    return current


def _apply_operator(assertion: dict[str, Any], actual: Any) -> bool:
    operator = assertion["operator"]
    expected = assertion["expected"]
    if operator == "equals":
        return _json_equal(actual, expected)
    if operator == "contains":
        if not isinstance(actual, list):
            raise TypeError("contains requires an array")
        return any(_json_equal(item, expected) for item in actual)
    if operator == "not-contains":
        if not isinstance(actual, list):
            raise TypeError("not-contains requires an array")
        return not any(_json_equal(item, expected) for item in actual)
    if not isinstance(actual, list) or not all(isinstance(item, dict) for item in actual):
        raise TypeError("project operators require an array of objects")
    field = assertion["field"]
    projected = [item[field] for item in actual]
    if operator == "project-contains":
        return any(_json_equal(item, expected) for item in projected)
    if operator == "project-set-equals":
        if not isinstance(expected, list):
            raise TypeError("project-set-equals requires an expected array")
        projected_values = sorted(canonical_json.canonical_json(item) for item in projected)
        expected_values = sorted(canonical_json.canonical_json(item) for item in expected)
        return projected_values == expected_values
    raise ValueError(f"Unsupported assertion operator {operator}")


def _verify_self_hash(document: dict[str, Any], label: str) -> None:
    expected = document["contentHash"]
    actual = _canonical_hash(
        {key: value for key, value in document.items() if key != "contentHash"},
        label,
    )
    if expected != actual:
        raise EvaluationFailure(f"{label} content hash mismatch: expected {expected}, calculated {actual}")


def _json_equal(left: Any, right: Any) -> bool:
    """Compare JSON values with canonical type semantics (`true` is not `1`)."""
    return canonical_json.canonical_json(left) == canonical_json.canonical_json(right)


def _ensure_canonical_value(value: Any, label: str) -> None:
    try:
        canonical_json.canonical_json(value)
    except canonical_json.CanonicalJsonError as error:
        raise EvaluationFailure(f"{label} violates Factory canonical JSON v1: {error}") from error


def _canonical_hash(value: Any, label: str) -> str:
    try:
        return canonical_json.content_hash(value)
    except canonical_json.CanonicalJsonError as error:
        raise EvaluationFailure(f"{label} violates Factory canonical JSON v1: {error}") from error


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
        raise EvaluationFailure("; ".join(diagnostics))


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


def _safe_text(value: str) -> str:
    forbidden = set(range(0x00, 0x20)) | set(range(0x7F, 0xA0)) | set(
        range(0x202A, 0x202F)
    ) | set(range(0x2066, 0x206A))
    return "".join(
        "�" if 0xD800 <= ord(character) <= 0xDFFF else " " if ord(character) in forbidden else character
        for character in value
    )[:1000]


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate object key {key}")
        value[key] = item
    return value


def _load_json_document(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_unique_json_object,
        )
    except OSError as error:
        raise EvaluationFailure(f"{label} could not be loaded: filesystem access failed") from error
    except ValueError as error:
        raise EvaluationFailure(f"{label} could not be loaded: {_safe_text(str(error))}") from error
    if not isinstance(value, dict):
        raise EvaluationFailure(f"{label} root must be an object")
    _ensure_canonical_value(value, label)
    return value


def _load_evaluation_result(path: Path) -> dict[str, Any]:
    document = _load_json_document(path, "Evaluation result")
    if document.get("documentKind") != "operation-result":
        return document
    try:
        operation_result.verify_operation_result_hash(document)
    except operation_result.OperationResultError as error:
        raise EvaluationFailure(f"Evaluation operation result is invalid: {error}") from error
    typed = document.get("result")
    if not isinstance(typed, dict) or typed.get("schemaId") != EVALUATION_RESULT_SCHEMA:
        raise EvaluationFailure("Operation result does not contain a typed evaluation result")
    return typed["value"]


def _bind_output_destination(
    output: str,
    repository_root: Path,
) -> OutputDestination:
    """Resolve and bind an existing outside parent without inspecting the final entry."""
    requested = Path(output)
    if not requested.name:
        raise EvaluationOutputFailure(
            "Evaluation output must name a file in an existing outside directory.",
            status="invalid",
        )
    absolute_output = requested if requested.is_absolute() else Path.cwd() / requested
    try:
        resolved_parent = absolute_output.parent.resolve(strict=True)
        parent_state = resolved_parent.stat(follow_symlinks=False)
        resolved_repository = repository_root.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise EvaluationOutputFailure(
            "Evaluation output parent must be an existing directory.",
            status="invalid",
        ) from error
    if not stat.S_ISDIR(parent_state.st_mode):
        raise EvaluationOutputFailure(
            "Evaluation output parent must be an existing directory.",
            status="invalid",
        )
    if resolved_parent == resolved_repository or resolved_parent.is_relative_to(
        resolved_repository
    ):
        raise EvaluationOutputFailure(
            "Evaluation output must be standard output or a path outside the source repository.",
            status="invalid",
        )
    return OutputDestination(
        resolved_parent,
        requested.name,
        parent_state.st_dev,
        parent_state.st_ino,
    )


def _open_output_directory_nofollow(path: Path) -> int:
    if not path.is_absolute() or not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
        raise EvaluationOutputFailure("Secure evaluation output publication is unavailable.")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    try:
        descriptor = os.open(path.anchor, flags)
        for part in path.parts[1:]:
            try:
                child = os.open(part, flags, dir_fd=descriptor)
            except OSError:
                os.close(descriptor)
                raise
            os.close(descriptor)
            descriptor = child
        return descriptor
    except OSError as error:
        raise EvaluationOutputFailure(
            "Evaluation output parent changed or contains an unsafe link."
        ) from error


def _output_parent_matches(descriptor: int, destination: OutputDestination) -> bool:
    state = os.fstat(descriptor)
    return (
        stat.S_ISDIR(state.st_mode)
        and state.st_dev == destination.parent_device
        and state.st_ino == destination.parent_inode
    )


def _publish_output_safely(destination: OutputDestination, content: str) -> None:
    """Atomically replace one entry without opening or truncating its prior inode."""
    parent_descriptor = _open_output_directory_nofollow(destination.parent)
    temporary_name: str | None = None
    output_descriptor: int | None = None
    output_published = False
    failure: EvaluationOutputFailure | None = None
    try:
        if not _output_parent_matches(parent_descriptor, destination):
            raise EvaluationOutputFailure("Evaluation output parent changed before publication.")
        flags = (
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | os.O_NOFOLLOW
            | getattr(os, "O_CLOEXEC", 0)
        )
        for _ in range(32):
            candidate = f".cratis-evaluation-{secrets.token_hex(16)}.tmp"
            try:
                output_descriptor = os.open(
                    candidate,
                    flags,
                    0o600,
                    dir_fd=parent_descriptor,
                )
                temporary_name = candidate
                break
            except FileExistsError:
                continue
            except OSError as error:
                raise EvaluationOutputFailure(
                    "Evaluation output temporary file could not be created safely."
                ) from error
        else:
            raise EvaluationOutputFailure(
                "Evaluation output temporary name could not be allocated safely."
            )

        encoded = content.encode("utf-8")
        written = 0
        while written < len(encoded):
            count = os.write(output_descriptor, encoded[written:])
            if count <= 0:
                raise EvaluationOutputFailure("Evaluation output write made no progress.")
            written += count
        os.fchmod(output_descriptor, 0o644)
        os.fsync(output_descriptor)
        descriptor_to_close = output_descriptor
        output_descriptor = None
        os.close(descriptor_to_close)

        current_parent = _open_output_directory_nofollow(destination.parent)
        try:
            if not _output_parent_matches(current_parent, destination):
                raise EvaluationOutputFailure(
                    "Evaluation output parent changed before atomic publication."
                )
        finally:
            os.close(current_parent)
        try:
            os.replace(
                temporary_name,
                destination.name,
                src_dir_fd=parent_descriptor,
                dst_dir_fd=parent_descriptor,
            )
            temporary_name = None
            output_published = True
        except OSError as error:
            raise EvaluationOutputFailure(
                "Evaluation output could not be published atomically."
            ) from error
    except EvaluationOutputFailure as error:
        failure = error
    except OSError as error:
        failure = EvaluationOutputFailure(
            "Evaluation output publication did not finalize safely."
        )
    finally:
        if output_descriptor is not None:
            try:
                os.close(output_descriptor)
            except OSError:
                if failure is None:
                    failure = EvaluationOutputFailure(
                        "Evaluation output descriptor could not be finalized safely."
                    )
        temporary_artifact_may_remain = False
        if temporary_name is not None:
            try:
                os.unlink(temporary_name, dir_fd=parent_descriptor)
            except OSError:
                temporary_artifact_may_remain = True
                if failure is None:
                    failure = EvaluationOutputFailure(
                        "Evaluation output temporary artifact could not be removed safely."
                    )
        try:
            os.close(parent_descriptor)
        except OSError:
            if failure is None:
                failure = EvaluationOutputFailure(
                    "Evaluation output parent descriptor could not be finalized safely."
                )
    if failure is not None:
        raise EvaluationOutputFailure(
            str(failure),
            status=failure.status,
            output_published=output_published,
            temporary_artifact_may_remain=temporary_artifact_may_remain,
        ) from failure


def _request_hash(
    operation: str,
    catalog: dict[str, Any] | None,
    selected_case_ids: list[str] | None,
    verified_result_hash: str | None,
    arguments: argparse.Namespace,
) -> str:
    return _canonical_hash(
        {
            "operation": operation,
            "catalogPath": _safe_text(
                str((validate_factory.ROOT / arguments.catalog).resolve())
            ),
            "catalogHash": _canonical_hash(catalog, "Evaluation catalog") if catalog else None,
            "selectedCaseIds": (
                [_safe_text(case_id) for case_id in selected_case_ids]
                if selected_case_ids is not None
                else None
            ),
            "verifiedResultHash": _safe_text(verified_result_hash) if verified_result_hash else None,
            "verifyResultPath": (
                _safe_text(str(Path(arguments.verify_result).resolve()))
                if arguments.verify_result
                else None
            ),
        },
        "Evaluation request",
    )


def _result_envelope(
    result: dict[str, Any],
    operation: str,
    request_hash: str,
    *,
    side_effects_occurred: bool,
) -> dict[str, Any]:
    coverage = result["coverage"]
    summary = (
        f"Evaluation outcome {result['outcome']}: {coverage['selectedCaseCount']} selected of "
        f"{coverage['executableCaseCount']} executable and {coverage['catalogCaseCount']} catalog cases."
    )
    diagnostics = []
    status = "success"
    if operation == "evaluate" and result["outcome"] != "pass":
        status = "invalid"
        code = (
            "FACTORY-EVALUATION-EXECUTION-BLOCKED"
            if result["outcome"] == "blocked"
            else "FACTORY-EVALUATION-ASSERTIONS-FAILED"
        )
        diagnostics = [
            operation_result.make_diagnostic(
                code,
                "error",
                summary,
                "retry-after-correction",
                "Correct the evaluated implementation or deterministic blocker before rerunning.",
            )
        ]
    return operation_result.make_operation_result(
        operation,
        status,
        summary,
        request_hash,
        diagnostics=diagnostics,
        result=operation_result.make_typed_result(EVALUATION_RESULT_SCHEMA, result),
        side_effects_occurred=side_effects_occurred,
    )


def _failure_envelope(
    operation: str,
    request_hash: str,
    error: Exception,
    *,
    side_effects_occurred: bool,
) -> dict[str, Any]:
    if isinstance(error, EvaluationOutputFailure):
        status = error.status
        code = "FACTORY-EVALUATION-OUTPUT-PUBLICATION-FAILED"
        retry = "Select a writable file in an existing directory outside the source repository."
    elif isinstance(error, OSError):
        status = "unexpected"
        code = "FACTORY-EVALUATION-UNEXPECTED"
        retry = "Inspect the diagnostic and contact a Factory maintainer."
    elif operation == "verify-evaluation-result":
        status = "integrity-error"
        code = "FACTORY-EVALUATION-VERIFY-INTEGRITY"
        retry = "Supply an untampered result produced from the exact current catalog and fixtures."
    elif isinstance(error, (EvaluationFailure, validate_factory.ValidationFailure)):
        status = "invalid"
        code = "FACTORY-EVALUATION-INPUT-INVALID"
        retry = "Correct the catalog, fixture, selection, or assertion definition before rerunning."
    else:
        status = "unexpected"
        code = "FACTORY-EVALUATION-UNEXPECTED"
        retry = "Inspect the diagnostic and contact a Factory maintainer."
    detail = (
        "Evaluation output was published, but output finalization did not complete."
        if isinstance(error, EvaluationOutputFailure) and error.output_published
        else "Evaluation output was not published; a temporary projection artifact may remain."
        if isinstance(error, EvaluationOutputFailure) and error.temporary_artifact_may_remain
        else "Evaluation output was not published."
        if isinstance(error, EvaluationOutputFailure)
        else "A filesystem operation failed without producing an evaluation result."
        if isinstance(error, OSError)
        else _safe_text(str(error)) or "Factory evaluation failed"
    )
    diagnostic = operation_result.make_diagnostic(
        code,
        "error",
        detail,
        "retry-after-correction" if status != "unexpected" else "not-retryable",
        retry,
    )
    return operation_result.make_operation_result(
        operation,
        status,
        "Factory evaluation did not produce a usable authoritative result.",
        request_hash,
        diagnostics=[diagnostic],
        side_effects_occurred=side_effects_occurred,
    )


def main() -> int:
    parser = _OperationArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        default="Evaluations/Factory/foundation.catalog.json",
    )
    parser.add_argument("--case", action="append", dest="cases")
    parser.add_argument("--format", choices=("json", "json-compact", "text"), default="text")
    parser.add_argument("--output", default="-")
    parser.add_argument("--verify-result")
    arguments = parser.parse_args()
    if arguments.verify_result and arguments.cases:
        parser.error("--case cannot be combined with --verify-result")
    operation = "verify-evaluation-result" if arguments.verify_result else "evaluate"
    request_hash = _request_hash(operation, None, arguments.cases, None, arguments)
    destination: OutputDestination | None = None

    try:
        if arguments.output != "-":
            destination = _bind_output_destination(arguments.output, validate_factory.ROOT)
        documents = {
            path: validate_factory.load_json(path)
            for path in validate_factory.all_json_files()
        }
        catalog_path = (validate_factory.ROOT / arguments.catalog).resolve()
        if not catalog_path.is_relative_to(validate_factory.ROOT.resolve()):
            raise EvaluationFailure("Evaluation catalog must be inside the AI repository")
        catalog = _load_json_document(catalog_path, "Evaluation catalog")
        if arguments.verify_result:
            result = _load_evaluation_result(Path(arguments.verify_result).resolve())
            coverage_value = result.get("coverage")
            selected_value = (
                coverage_value.get("selectedCaseIds")
                if isinstance(coverage_value, dict)
                else None
            )
            selected_ids = (
                list(selected_value)
                if isinstance(selected_value, list)
                and all(isinstance(item, str) for item in selected_value)
                else None
            )
            result_hash = result.get("contentHash")
            request_hash = _request_hash(
                operation,
                catalog,
                selected_ids,
                result_hash if isinstance(result_hash, str) else None,
                arguments,
            )
            verify_evaluation_result(result, documents, catalog)
        else:
            result = run_evaluations(documents, catalog, arguments.cases)
            request_hash = _request_hash(
                operation,
                catalog,
                list(result["coverage"]["selectedCaseIds"]),
                None,
                arguments,
            )
        envelope = _result_envelope(
            result,
            operation,
            request_hash,
            side_effects_occurred=destination is not None,
        )
    except (
        EvaluationFailure,
        EvaluationOutputFailure,
        OSError,
        operation_result.OperationResultError,
        validate_factory.ValidationFailure,
    ) as error:
        envelope = _failure_envelope(
            operation,
            request_hash,
            error,
            side_effects_occurred=destination is not None,
        )

    output = operation_result.render_operation_result(envelope, arguments.format)
    try:
        if destination is None:
            print(output, end="")
        else:
            _publish_output_safely(destination, output)
    except (EvaluationOutputFailure, OSError) as error:
        side_effects_occurred = (
            error.output_published or error.temporary_artifact_may_remain
            if isinstance(error, EvaluationOutputFailure)
            else False
        )
        envelope = _failure_envelope(
            operation,
            request_hash,
            error,
            side_effects_occurred=side_effects_occurred,
        )
        print(
            operation_result.render_operation_result(envelope, arguments.format),
            end="",
        )
    return operation_result.exit_code_for_status(envelope["status"])


if __name__ == "__main__":
    raise SystemExit(main())
