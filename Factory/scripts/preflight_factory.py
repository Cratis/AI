#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Resolve and compile one immutable, execution-neutral Cratis Factory preflight plan."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import io
import os
from pathlib import Path
from pathlib import PurePosixPath
import re
import selectors
import secrets
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
from typing import Any

import canonical_json
import compile_factory
import operation_result
import resolve_factory
import trusted_git
import validate_factory


COMPILED_WORKFLOW_SCHEMA = "https://schemas.cratis.io/factory/v1/compiled-workflow.schema.json"
MAXIMUM_ARCHIVE_BYTES = 256_000_000
MAXIMUM_ARCHIVE_ENTRIES = 100_000


class PreflightFailure(Exception):
    """Raised when repository preflight cannot establish immutable safe inputs."""


class PreflightIntegrityFailure(PreflightFailure):
    """Raised when a supplied plan fails integrity or current-authority verification."""


class PreflightAuthorityBlocked(PreflightFailure):
    """Raised when repository configuration prevents trusted authority capture."""


class PreflightPolicyDenied(PreflightFailure):
    """Raised when the project manifest narrows away required workflow capability."""


class PreflightRouteBlocked(PreflightFailure):
    """Raised when validated project authority provides no executable workflow route."""


@dataclass(frozen=True)
class GitState:
    """Authority-bearing Git facts captured from the requested repository."""

    revision: str
    status: str
    special_index_entries: tuple[str, ...]
    remotes: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class OutputDestination:
    """One validated outside-repository output directory entry."""

    parent: Path
    name: str
    parent_device: int
    parent_inode: int


class _OperationArgumentParser(argparse.ArgumentParser):
    """Render invocation failures through the same operation contract as runtime failures."""

    def error(self, message: str) -> None:
        raw_arguments = sys.argv[1:]
        operation = "verify" if any(
            value == "--verify-plan" or value.startswith("--verify-plan=")
            for value in raw_arguments
        ) else "preflight"
        output_format = "text"
        for index, value in enumerate(raw_arguments):
            candidate = None
            if value.startswith("--format="):
                candidate = value.split("=", maxsplit=1)[1]
            elif value == "--format" and index + 1 < len(raw_arguments):
                candidate = raw_arguments[index + 1]
            if candidate in {"json", "json-compact", "text"}:
                output_format = candidate
        request_hash = canonical_json.content_hash(
            {
                "operation": operation,
                "invalidInvocationOptions": sorted(
                    value.split("=", maxsplit=1)[0]
                    for value in raw_arguments
                    if value.startswith("--") and not value.startswith("--format")
                ),
            }
        )
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-PREFLIGHT-INVOCATION-INVALID",
            "error",
            _safe_message(message) or "Factory preflight invocation is invalid",
            "retry-after-correction",
            "Correct the command arguments and run the operation again.",
        )
        envelope = operation_result.make_operation_result(
            operation,
            "invocation-error",
            "Factory preflight invocation is invalid.",
            request_hash,
            diagnostics=[diagnostic],
            side_effects_occurred=False,
        )
        print(operation_result.render_operation_result(envelope, output_format), end="")
        raise SystemExit(operation_result.exit_code_for_status("invocation-error"))


def preflight_repository(
    documents: dict[Path, dict[str, Any]],
    repository_root: Path,
    target_path: str,
    purpose: str,
    requested_workflow: str | None,
    baseline_policy_id: str,
) -> dict[str, Any]:
    """Resolve and compile only evidence materialized from one exact clean Git revision."""
    repository_root = repository_root.resolve()
    before = _capture_git_state(repository_root)
    with _materialized_repository(repository_root, before) as materialized_repository:
        manifest = resolve_factory._load_project_manifest(materialized_repository, documents)
        resolved_profile = resolve_factory.resolve_repository(
            materialized_repository,
            target_path,
            purpose,
            documents,
            _validated_manifest=manifest,
            baseline_policy_id=baseline_policy_id,
        )
    after = _capture_git_state(repository_root)
    if before != after:
        raise PreflightFailure("Repository revision or worktree state changed during profile resolution")

    workflow_id = _select_workflow(resolved_profile, requested_workflow, manifest)
    denied_capabilities: list[str] = []
    project_manifest_hash: str | None = None
    if manifest is not None:
        denied_capabilities = manifest["policy"]["denyCapabilities"]
        project_manifest_hash = canonical_json.content_hash(manifest)
    identity = resolved_profile["repositoryIdentity"]
    if isinstance(identity, dict):
        repository_reference = str(identity.get("id", "unidentified-git-repository"))
    else:
        repository_reference = identity or "unidentified-git-repository"
    repository_snapshot: dict[str, Any] = {
        "$schema": "https://schemas.cratis.io/factory/v1/repository-snapshot.schema.json",
        "protocolVersion": "1",
        "repository": repository_reference,
        "revision": before.revision,
        "targetPath": resolved_profile["targetPath"],
        "dirty": False,
    }
    repository_snapshot["contentHash"] = canonical_json.content_hash(repository_snapshot)

    compiled = compile_factory.compile_documents(
        documents,
        workflow_id,
        resolved_profile,
        repository_snapshot,
        baseline_policy_id,
        denied_capabilities,
        project_manifest_hash,
    )
    final = _capture_git_state(repository_root)
    if before != final:
        raise PreflightFailure("Repository revision or worktree state changed during preflight compilation")
    return compiled


def _capture_git_state(repository_root: Path) -> GitState:
    top_level = Path(_git(repository_root, ["rev-parse", "--show-toplevel"])).resolve()
    if top_level != repository_root:
        raise PreflightFailure("Repository path must be the exact Git top level")
    _reject_external_object_sources(repository_root)
    revision = _git(repository_root, ["rev-parse", "--verify", "HEAD^{commit}"])
    untracked_files = _untracked_files(repository_root)
    if untracked_files:
        raise PreflightFailure(
            "Executable preflight requires a clean tracked and untracked worktree; "
            "dirty repository resolution remains informational only"
        )
    special_index_entries = _special_index_entries(repository_root)
    if special_index_entries:
        raise PreflightFailure(
            "Executable preflight rejects assume-unchanged and skip-worktree index entries: "
            + ", ".join(special_index_entries[:10])
        )
    _verify_index_and_worktree(repository_root, revision)
    remotes = tuple(
        (name, value)
        for name in ("origin", "upstream")
        if (value := _raw_remote(repository_root, name)) is not None
    )
    return GitState(revision, "", special_index_entries, remotes)


def _special_index_entries(repository_root: Path) -> tuple[str, ...]:
    tagged = _git(repository_root, ["ls-files", "-v", "-z"], strip=False)
    entries: list[str] = []
    for record in tagged.split("\0"):
        if not record:
            continue
        if len(record) < 3 or record[1] != " ":
            raise PreflightFailure("Git returned an invalid index entry while checking hidden flags")
        tag = record[0]
        if tag == "S" or tag.islower():
            entries.append(record[2:])
    return tuple(
        _repository_path_source_id(index)
        for index, _ in enumerate(sorted(entries), start=1)
    )


def _untracked_files(repository_root: Path) -> tuple[str, ...]:
    raw = _git_bytes(
        repository_root,
        ["ls-files", "--others", "--exclude-standard", "-z"],
    )
    try:
        paths = tuple(
            sorted(
                record.decode("utf-8")
                for record in raw.split(b"\0")
                if record
            )
        )
    except UnicodeDecodeError as error:
        raise PreflightFailure("Git returned an invalid untracked worktree path") from error
    return paths


def _raw_remote(repository_root: Path, name: str) -> str | None:
    try:
        return trusted_git.raw_local_config(repository_root, f"remote.{name}.url")
    except trusted_git.TrustedGitError as error:
        raise PreflightFailure("Could not read trusted Git repository metadata") from error


def _reject_external_object_sources(repository_root: Path) -> None:
    try:
        partial_clone_keys = trusted_git.raw_local_config_names(
            repository_root,
            r"^(extensions\.partialclone|remote\..*\.(promisor|partialclonefilter))$",
        )
    except trusted_git.TrustedGitError as error:
        raise PreflightFailure("Could not inspect trusted Git object configuration") from error
    if partial_clone_keys:
        raise PreflightFailure(
            "Executable preflight rejects partial-clone object retrieval"
        )
    alternates_value = _git(
        repository_root,
        ["rev-parse", "--git-path", "objects/info/alternates"],
    )
    alternates = Path(alternates_value)
    if not alternates.is_absolute():
        alternates = repository_root / alternates
    try:
        if alternates.exists():
            raise PreflightFailure(
                "Executable preflight rejects alternate Git object databases"
            )
    except OSError as error:
        raise PreflightFailure("Could not inspect trusted Git object storage") from error


def _verify_index_and_worktree(repository_root: Path, revision: str) -> None:
    """Compare the index and worktree bytes directly with the committed tree."""
    committed = _tracked_files(repository_root, revision)
    raw_index = _git_bytes(repository_root, ["ls-files", "--stage", "-z"])
    indexed: dict[str, tuple[bool, str]] = {}
    for record in raw_index.split(b"\0"):
        if not record:
            continue
        try:
            header, encoded_path = record.split(b"\t", maxsplit=1)
            mode, object_id, stage = header.decode("ascii").split(" ")
            path = encoded_path.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise PreflightFailure("Git returned an invalid staged index entry") from error
        if stage != "0" or mode not in {"100644", "100755"} or path in indexed:
            raise PreflightFailure("Git index contains a conflicted or unsupported entry")
        indexed[path] = (mode == "100755", object_id)
    if indexed != committed:
        raise PreflightFailure("Git index does not match the exact committed tree")

    no_follow = getattr(os, "O_NOFOLLOW", None)
    directory_flag = getattr(os, "O_DIRECTORY", None)
    if no_follow is None or directory_flag is None:
        raise PreflightFailure("Secure descriptor-relative worktree verification is unavailable")
    try:
        root_descriptor = os.open(repository_root, os.O_RDONLY | directory_flag | no_follow)
    except OSError as error:
        raise PreflightFailure("Could not open the repository for secure worktree verification") from error
    total_size = 0
    try:
        source_ids = _repository_path_source_ids(committed)
        for path, (expected_executable, expected_object_id) in committed.items():
            source_id = source_ids[path]
            descriptor = os.dup(root_descriptor)
            try:
                parts = PurePosixPath(path).parts
                for part in parts[:-1]:
                    child = os.open(
                        part,
                        os.O_RDONLY | directory_flag | no_follow,
                        dir_fd=descriptor,
                    )
                    os.close(descriptor)
                    descriptor = child
                file_descriptor = os.open(
                    parts[-1],
                    os.O_RDONLY | no_follow,
                    dir_fd=descriptor,
                )
                try:
                    metadata = os.fstat(file_descriptor)
                    if not stat.S_ISREG(metadata.st_mode):
                        raise PreflightFailure(
                            f"Tracked worktree entry {source_id} is not a regular file"
                        )
                    if bool(metadata.st_mode & 0o111) != expected_executable:
                        raise PreflightFailure(
                            f"Tracked worktree entry {source_id} executable mode differs from HEAD"
                        )
                    total_size += metadata.st_size
                    if total_size > MAXIMUM_ARCHIVE_BYTES:
                        raise PreflightFailure(
                            "Tracked worktree contents exceed Stage 0 verification limits"
                        )
                    chunks: list[bytes] = []
                    remaining = metadata.st_size
                    while remaining:
                        chunk = os.read(file_descriptor, min(64 * 1024, remaining))
                        if not chunk:
                            raise PreflightFailure(
                                f"Tracked worktree entry {source_id} changed while being read"
                            )
                        chunks.append(chunk)
                        remaining -= len(chunk)
                    if os.read(file_descriptor, 1):
                        raise PreflightFailure(
                            f"Tracked worktree entry {source_id} changed while being read"
                        )
                    if _git_blob_id(b"".join(chunks), expected_object_id) != expected_object_id:
                        raise PreflightFailure(
                            f"Tracked worktree entry {source_id} content differs from HEAD"
                        )
                finally:
                    os.close(file_descriptor)
            except OSError as error:
                raise PreflightFailure(
                    f"Tracked worktree entry {source_id} could not be verified without following links"
                ) from error
            finally:
                os.close(descriptor)
    finally:
        os.close(root_descriptor)


@contextmanager
def _materialized_repository(repository_root: Path, state: GitState):
    tracked_files = _tracked_files(repository_root, state.revision)
    archive = _git_bytes(repository_root, ["archive", "--format=tar", state.revision])
    if len(archive) > MAXIMUM_ARCHIVE_BYTES:
        raise PreflightFailure(
            f"Tracked repository archive exceeds the {MAXIMUM_ARCHIVE_BYTES} byte Stage 0 limit"
        )
    with tempfile.TemporaryDirectory() as temporary_directory:
        materialized = Path(temporary_directory) / "repository"
        materialized.mkdir()
        _extract_tracked_archive(archive, materialized, tracked_files)
        _git(materialized, ["init", "--quiet"])
        for name, remote in state.remotes:
            _git(materialized, ["remote", "add", name, remote])
        yield materialized


def _tracked_files(repository_root: Path, revision: str) -> dict[str, tuple[bool, str]]:
    raw = _git_bytes(repository_root, ["ls-tree", "-r", "-z", "--full-tree", revision])
    tracked: dict[str, tuple[bool, str]] = {}
    for record in raw.split(b"\0"):
        if not record:
            continue
        try:
            header, encoded_path = record.split(b"\t", maxsplit=1)
            mode, object_type, object_id = header.decode("ascii").split(" ")
            path = encoded_path.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise PreflightFailure("Tracked repository tree contains an invalid entry") from error
        relative = PurePosixPath(path)
        if (
            not path
            or relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or path in tracked
        ):
            raise PreflightFailure("Tracked repository tree contains an unsafe or duplicate path")
        if object_type != "blob" or mode not in {"100644", "100755"}:
            source_id = _repository_path_source_id(len(tracked) + 1)
            raise PreflightFailure(
                f"Tracked repository entry {source_id} has unsupported mode {mode}; "
                "only regular non-linked files can be executable preflight evidence"
            )
        tracked[path] = (mode == "100755", object_id)
    if len(tracked) > resolve_factory.MAXIMUM_FILES:
        raise PreflightFailure("Tracked repository tree exceeds the Stage 0 file limit")
    return tracked


def _extract_tracked_archive(
    archive: bytes,
    destination: Path,
    tracked_files: dict[str, tuple[bool, str]],
) -> None:
    seen: set[str] = set()
    extracted_files: set[str] = set()
    file_count = 0
    total_size = 0
    try:
        opened = tarfile.open(fileobj=io.BytesIO(archive), mode="r:")
    except tarfile.TarError as error:
        raise PreflightFailure("Git produced an invalid repository archive") from error
    source_ids = _repository_path_source_ids(tracked_files)
    with opened:
        members = opened.getmembers()
        if len(members) > MAXIMUM_ARCHIVE_ENTRIES:
            raise PreflightFailure(
                f"Tracked repository archive exceeds the {MAXIMUM_ARCHIVE_ENTRIES} entry limit"
            )
        for member in members:
            source_id = source_ids.get(
                member.name,
                _repository_path_source_id(len(seen) + 1),
            )
            relative = PurePosixPath(member.name)
            if (
                not member.name
                or relative.is_absolute()
                or any(part in {"", ".", ".."} for part in relative.parts)
                or member.name in seen
            ):
                raise PreflightFailure("Tracked repository archive contains an unsafe or duplicate path")
            seen.add(member.name)
            target = destination.joinpath(*relative.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                raise PreflightFailure(
                    f"Tracked repository entry {source_id} is not a regular file; "
                    "links and special files are forbidden in executable preflight"
                )
            expected = tracked_files.get(member.name)
            if expected is None:
                raise PreflightFailure(
                    f"Materialized repository archive contains untracked file {source_id}"
                )
            file_count += 1
            total_size += member.size
            if file_count > resolve_factory.MAXIMUM_FILES or total_size > MAXIMUM_ARCHIVE_BYTES:
                raise PreflightFailure("Tracked repository contents exceed Stage 0 materialization limits")
            source = opened.extractfile(member)
            if source is None:
                raise PreflightFailure(f"Could not materialize tracked repository entry {source_id}")
            content = source.read(MAXIMUM_ARCHIVE_BYTES + 1)
            if len(content) != member.size:
                raise PreflightFailure(f"Tracked repository entry {source_id} has an invalid size")
            expected_executable, expected_object_id = expected
            if bool(member.mode & 0o111) != expected_executable:
                raise PreflightFailure(
                    f"Tracked repository entry {source_id} executable mode changed during materialization"
                )
            if _git_blob_id(content, expected_object_id) != expected_object_id:
                raise PreflightFailure(
                    f"Tracked repository entry {source_id} content changed during materialization"
                )
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            os.chmod(target, 0o755 if expected_executable else 0o644)
            extracted_files.add(member.name)
    missing = sorted(set(tracked_files) - extracted_files)
    if missing:
        raise PreflightFailure(
            "Tracked repository archive omitted committed files: "
            + ", ".join(source_ids[path] for path in missing[:10])
        )


def _repository_path_source_id(index: int) -> str:
    return f"repository-path:{index:06d}"


def _repository_path_source_ids(paths: Any) -> dict[str, str]:
    return {
        path: _repository_path_source_id(index)
        for index, path in enumerate(sorted(paths), start=1)
    }


def _git_blob_id(content: bytes, expected_object_id: str) -> str:
    algorithm = "sha1" if len(expected_object_id) == 40 else "sha256" if len(expected_object_id) == 64 else None
    if algorithm is None:
        raise PreflightFailure("Tracked repository uses an unsupported Git object format")
    digest = hashlib.new(algorithm)
    digest.update(f"blob {len(content)}\0".encode("ascii"))
    digest.update(content)
    return digest.hexdigest()


def _git(repository_root: Path, arguments: list[str], strip: bool = True) -> str:
    try:
        process = trusted_git.run(arguments, cwd=repository_root, timeout=5)
    except trusted_git.RepositoryConfigIncludesError as error:
        raise PreflightAuthorityBlocked(
            "Repository Git include/includeIf directives prevent trusted preflight authority"
        ) from error
    except trusted_git.TrustedGitError as error:
        raise PreflightFailure("Could not inspect the repository with trusted Git") from error
    if process.returncode != 0:
        raise PreflightFailure(f"Trusted Git {arguments[0]} command failed")
    return process.stdout.strip() if strip else process.stdout


def _git_bytes(repository_root: Path, arguments: list[str]) -> bytes:
    try:
        process = trusted_git.popen(arguments, cwd=repository_root)
    except trusted_git.RepositoryConfigIncludesError as error:
        raise PreflightAuthorityBlocked(
            "Repository Git include/includeIf directives prevent trusted preflight authority"
        ) from error
    except trusted_git.TrustedGitError as error:
        raise PreflightFailure("Could not materialize the repository with trusted Git") from error
    assert process.stdout is not None
    assert process.stderr is not None
    output: list[bytes] = []
    output_size = 0
    error_output = bytearray()
    deadline = time.monotonic() + 30
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ, "stdout")
    selector.register(process.stderr, selectors.EVENT_READ, "stderr")
    try:
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(trusted_git.command(arguments), 30)
            events = selector.select(remaining)
            if not events:
                raise subprocess.TimeoutExpired(trusted_git.command(arguments), 30)
            for key, _ in events:
                chunk = os.read(key.fileobj.fileno(), 64 * 1024)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                if key.data == "stdout":
                    output_size += len(chunk)
                    if output_size > MAXIMUM_ARCHIVE_BYTES:
                        raise PreflightFailure(
                            f"Git output exceeds the {MAXIMUM_ARCHIVE_BYTES} byte Stage 0 limit"
                        )
                    output.append(chunk)
                elif len(error_output) < 64 * 1024:
                    error_output.extend(chunk[: 64 * 1024 - len(error_output)])
        remaining = max(0.1, deadline - time.monotonic())
        return_code = process.wait(timeout=remaining)
    except (PreflightFailure, subprocess.TimeoutExpired) as error:
        process.kill()
        process.wait(timeout=5)
        if isinstance(error, PreflightFailure):
            raise
        raise PreflightFailure(
            "Trusted Git materialization did not complete within execution bounds"
        ) from error
    finally:
        selector.close()
        process.stdout.close()
        process.stderr.close()
    if return_code != 0:
        raise PreflightFailure(f"Trusted Git {arguments[0]} command failed")
    return b"".join(output)


def verify_preflight_authority(
    compiled: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
    repository_root: Path,
    target_path: str,
    purpose: str,
    requested_workflow: str | None,
    baseline_policy_id: str,
) -> None:
    """Verify integrity and rebind a plan to an explicit current trusted repository request."""
    try:
        compile_factory.verify_compiled_workflow(compiled, documents)
    except compile_factory.CompilationFailure as error:
        raise PreflightIntegrityFailure("; ".join(error.errors)) from error
    authoritative = preflight_repository(
        documents,
        repository_root,
        target_path,
        purpose,
        requested_workflow,
        baseline_policy_id,
    )
    if authoritative != compiled:
        raise PreflightIntegrityFailure(
            "Compiled workflow does not match authoritative preflight for the current "
            "repository, manifest, target, purpose, workflow, and baseline policy"
        )


def _select_workflow(
    resolved_profile: dict[str, Any],
    requested_workflow: str | None,
    manifest: dict[str, Any] | None,
) -> str:
    workflows = resolved_profile["workflows"]
    if requested_workflow is not None:
        if manifest is not None and requested_workflow not in manifest["workflows"]:
            raise PreflightRouteBlocked(
                f"Requested workflow {requested_workflow} is not pinned by the project manifest"
            )
        if not any(reference["id"] == requested_workflow for reference in workflows):
            denied = sorted(
                item["id"]
                for item in resolved_profile["negativeCapabilities"]
                if item["requiredBy"] == requested_workflow
                and item["reason"] == "explicitly-denied"
            )
            if denied:
                raise PreflightPolicyDenied(
                    f"Project manifest policy denies capabilities required by workflow "
                    f"{requested_workflow}: {', '.join(denied)}"
                )
            raise PreflightFailure(
                f"Requested workflow {requested_workflow} is not eligible for this repository and purpose"
            )
        return requested_workflow
    if not workflows:
        denied = sorted(
            {
                item["id"]
                for item in resolved_profile["negativeCapabilities"]
                if item["reason"] == "explicitly-denied"
            }
        )
        if denied:
            raise PreflightPolicyDenied(
                "Project manifest policy denies capabilities required by every authorized "
                f"eligible workflow: {', '.join(denied)}"
            )
        blockers = "; ".join(resolved_profile["blockedReasons"]) or "no eligible workflow"
        raise PreflightRouteBlocked(blockers)
    top_priority = workflows[0]["priority"]
    top = [reference for reference in workflows if reference["priority"] == top_priority]
    if len(top) != 1:
        raise PreflightFailure(
            "Multiple workflows have equal highest priority; request one explicitly: "
            + ", ".join(reference["id"] for reference in top)
        )
    return top[0]["id"]


def _validate_output_path(
    repository_root: Path,
    output_path: str,
) -> OutputDestination | None:
    if output_path == "-":
        return None
    absolute_output = Path(os.path.abspath(output_path))
    if absolute_output.name in {"", ".", ".."}:
        raise PreflightFailure("Preflight output must name a file outside the source repository")
    try:
        resolved_parent = absolute_output.parent.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise PreflightFailure("Preflight output parent must be an existing directory") from error
    if not resolved_parent.is_dir():
        raise PreflightFailure("Preflight output parent must be an existing directory")
    resolved_repository = repository_root.resolve()
    try:
        resolved_output = (resolved_parent / absolute_output.name).resolve(strict=False)
    except (OSError, RuntimeError) as error:
        raise PreflightFailure("Preflight output entry could not be resolved safely") from error
    if (
        resolved_parent.is_relative_to(resolved_repository)
        or resolved_output.is_relative_to(resolved_repository)
    ):
        raise PreflightFailure(
            "Preflight output must be standard output or a path outside the source repository"
        )
    try:
        parent_state = resolved_parent.stat(follow_symlinks=False)
    except OSError as error:
        raise PreflightFailure("Preflight output parent could not be bound safely") from error
    if not stat.S_ISDIR(parent_state.st_mode):
        raise PreflightFailure("Preflight output parent must be a directory")
    return OutputDestination(
        resolved_parent,
        absolute_output.name,
        parent_state.st_dev,
        parent_state.st_ino,
    )


def _open_directory_nofollow(path: Path) -> int:
    if not path.is_absolute() or not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
        raise PreflightFailure("Secure output directory traversal is unavailable")
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
        raise PreflightFailure("Preflight output parent changed or contains a symbolic link") from error


def _output_parent_matches(descriptor: int, destination: OutputDestination) -> bool:
    state = os.fstat(descriptor)
    return (
        stat.S_ISDIR(state.st_mode)
        and state.st_dev == destination.parent_device
        and state.st_ino == destination.parent_inode
    )


def _write_output_safely(destination: OutputDestination, content: str) -> None:
    """Atomically replace one outside entry without following its prior inode or parent links."""
    parent_descriptor = _open_directory_nofollow(destination.parent)
    temporary_name: str | None = None
    try:
        if not _output_parent_matches(parent_descriptor, destination):
            raise PreflightFailure("Preflight output parent changed after request validation")
        flags = (
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | os.O_NOFOLLOW
            | getattr(os, "O_CLOEXEC", 0)
        )
        for _ in range(32):
            candidate = f".cratis-preflight-{secrets.token_hex(16)}.tmp"
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
                raise PreflightFailure("Preflight output temporary file could not be created safely") from error
        else:
            raise PreflightFailure("Preflight output temporary name could not be allocated safely")
        try:
            encoded = content.encode("utf-8")
            written = 0
            while written < len(encoded):
                count = os.write(output_descriptor, encoded[written:])
                if count <= 0:
                    raise PreflightFailure("Preflight output write made no progress")
                written += count
            os.fchmod(output_descriptor, 0o644)
            os.fsync(output_descriptor)
        except OSError as error:
            raise PreflightFailure("Preflight output could not be written safely") from error
        finally:
            os.close(output_descriptor)

        current_parent = _open_directory_nofollow(destination.parent)
        try:
            if not _output_parent_matches(current_parent, destination):
                raise PreflightFailure("Preflight output parent changed before atomic publication")
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
        except OSError as error:
            raise PreflightFailure("Preflight output could not be published atomically") from error
    finally:
        if temporary_name is not None:
            try:
                os.unlink(temporary_name, dir_fd=parent_descriptor)
            except OSError:
                pass
        os.close(parent_descriptor)


def _request_hash(
    arguments: argparse.Namespace,
    operation: str,
    compiled_plan_hash: str | None = None,
) -> str:
    request = {
        "operation": operation,
        "targetPath": _semantic_target(arguments.target),
        "purpose": _semantic_identifier(arguments.purpose),
        "workflow": _semantic_identifier(arguments.workflow),
        "baselinePolicy": _semantic_identifier(arguments.policy),
        "compiledPlanHash": compiled_plan_hash,
    }
    return canonical_json.content_hash(request)


def _semantic_target(value: str) -> str:
    candidate = PurePosixPath(value)
    if (
        candidate.is_absolute()
        or any(part in {"", ".", ".."} for part in candidate.parts if part != ".")
        or any(ord(character) < 0x20 for character in value)
        or any(marker in value for marker in ("\\", ":", "?", "#"))
    ):
        return "invalid-target"
    normalized = candidate.as_posix()
    return normalized if normalized else "."


def _semantic_identifier(value: str | None) -> str | None:
    if value is None:
        return None
    return value if re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", value) else "invalid-identifier"


def _load_compiled_plan(path: Path) -> dict[str, Any]:
    document = validate_factory.load_json(path)
    if document.get("documentKind") != "operation-result":
        return document
    try:
        operation_result.verify_operation_result_hash(document)
    except operation_result.OperationResultError as error:
        raise PreflightIntegrityFailure(
            "Saved operation result failed integrity verification"
        ) from error
    if document["status"] != "success" or "result" not in document:
        raise PreflightFailure("Only a successful operation result can supply a compiled plan")
    typed = document["result"]
    if typed["schemaId"] != COMPILED_WORKFLOW_SCHEMA:
        raise PreflightFailure("Operation result does not contain a compiled workflow")
    return typed["value"]


def _failure_envelope(
    operation: str,
    request_hash: str,
    error: Exception,
) -> dict[str, Any]:
    actions: list[dict[str, Any]] = []
    related_action_ids: list[str] = []
    if isinstance(error, PreflightIntegrityFailure):
        details = str(error)
        code = "FACTORY-PREFLIGHT-VERIFY-INTEGRITY"
        status = "integrity-error"
        retry_disposition = "retry-after-correction"
        retry_reason = (
            "Supply an untampered plan produced for the exact current repository request."
        )
        action_id = "supply-untampered-preflight-plan"
        actions.append(
            {
                "$schema": operation_result.NEXT_ACTION_SCHEMA,
                "protocolVersion": "1",
                "id": action_id,
                "kind": "correct-input",
                "title": "Supply an authoritative preflight plan",
                "description": (
                    "Replace the verification input with an untampered preflight result "
                    "created for the exact current repository request."
                ),
                "automation": "requires-confirmation",
                "location": {"kind": "argument", "reference": "--verify-plan"},
                "expected": (
                    "A successful preflight operation result or compiled workflow whose "
                    "integrity and current repository authority both verify."
                ),
            }
        )
        related_action_ids.append(action_id)
    elif isinstance(error, PreflightAuthorityBlocked):
        details = str(error)
        code = "FACTORY-PREFLIGHT-GIT-CONFIG-BLOCKED"
        status = "blocked"
        retry_disposition = "retry-after-correction"
        retry_reason = (
            "Remove repository-local and worktree include/includeIf directives before retrying."
        )
        action_id = "remove-repository-git-includes"
        actions.append(
            {
                "$schema": operation_result.NEXT_ACTION_SCHEMA,
                "protocolVersion": "1",
                "id": action_id,
                "kind": "correct-input",
                "title": "Remove repository Git includes",
                "description": (
                    "Remove local and worktree include/includeIf directives so trusted Git "
                    "commands cannot expand external configuration."
                ),
                "automation": "requires-confirmation",
                "location": {"kind": "repository", "reference": "git-config"},
                "expected": (
                    "Repository-local and worktree Git configuration contains no include or "
                    "includeIf directive."
                ),
            }
        )
        related_action_ids.append(action_id)
    elif isinstance(error, PreflightPolicyDenied):
        details = str(error)
        code = "FACTORY-PREFLIGHT-POLICY-DENIED"
        status = "denied"
        retry_disposition = "retry-after-correction"
        retry_reason = (
            "An authorized policy owner must select a permitted workflow or revise the manifest policy."
        )
        action_id = "contact-project-policy-maintainer"
        actions.append(
            {
                "$schema": operation_result.NEXT_ACTION_SCHEMA,
                "protocolVersion": "1",
                "id": action_id,
                "kind": "contact-maintainer",
                "title": "Request an authorized policy decision",
                "description": (
                    "Ask the project policy owner to select an allowed workflow or review the "
                    "manifest denial; do not weaken policy automatically."
                ),
                "automation": "human-only",
                "reference": "Project policy owner for .cratis/factory.json",
            }
        )
        related_action_ids.append(action_id)
    elif isinstance(error, PreflightRouteBlocked):
        details = str(error)
        code = "FACTORY-PREFLIGHT-WORKFLOW-BLOCKED"
        status = "blocked"
        retry_disposition = "retry-after-correction"
        retry_reason = (
            "An authorized project maintainer must pin an eligible trusted workflow before retrying."
        )
        action_id = "authorize-project-workflow"
        actions.append(
            {
                "$schema": operation_result.NEXT_ACTION_SCHEMA,
                "protocolVersion": "1",
                "id": action_id,
                "kind": "correct-input",
                "title": "Pin an authorized project workflow",
                "description": (
                    "Have a project maintainer pin an eligible trusted Factory workflow version "
                    "in the project manifest."
                ),
                "automation": "human-only",
                "location": {
                    "kind": "document",
                    "reference": ".cratis/factory.json",
                    "pointer": "/workflows",
                },
                "expected": (
                    "At least one eligible workflow ID mapped to its exact trusted Factory version."
                ),
            }
        )
        related_action_ids.append(action_id)
    elif isinstance(error, compile_factory.CompilationFailure):
        details = "; ".join(error.errors)
        code = "FACTORY-PREFLIGHT-COMPILATION-INVALID"
    elif isinstance(error, validate_factory.ValidationFailure):
        details = str(error)
        code = "FACTORY-PREFLIGHT-DEFINITION-INVALID"
    elif isinstance(error, resolve_factory.ResolutionFailure):
        details = str(error)
        code = "FACTORY-PREFLIGHT-RESOLUTION-INVALID"
    elif isinstance(error, PreflightFailure):
        details = str(error)
        code = "FACTORY-PREFLIGHT-INPUT-INVALID"
    elif isinstance(error, OSError):
        details = "A filesystem operation failed without exposing path details"
        code = "FACTORY-PREFLIGHT-UNEXPECTED"
    else:
        details = "An unexpected internal failure prevented Factory preflight"
        code = "FACTORY-PREFLIGHT-UNEXPECTED"
    if not isinstance(
        error,
        (
            PreflightIntegrityFailure,
            PreflightAuthorityBlocked,
            PreflightPolicyDenied,
            PreflightRouteBlocked,
        ),
    ):
        status = "invalid" if code != "FACTORY-PREFLIGHT-UNEXPECTED" else "unexpected"
        retry_disposition = (
            "retry-after-correction" if code != "FACTORY-PREFLIGHT-UNEXPECTED" else "not-retryable"
        )
        retry_reason = (
            "Correct the repository or request facts and run preflight again."
            if code != "FACTORY-PREFLIGHT-UNEXPECTED"
            else "Inspect the diagnostic and contact a Factory maintainer."
        )
    message = _safe_message(details) or "Factory preflight could not establish authoritative inputs"
    diagnostic = operation_result.make_diagnostic(
        code,
        "error",
        message,
        retry_disposition,
        retry_reason,
        related_action_ids=related_action_ids,
    )
    return operation_result.make_operation_result(
        operation,
        status,
        (
            "Factory rejected a preflight plan that failed integrity or current-authority verification."
            if status == "integrity-error"
            else "Factory preflight is blocked because no authorized workflow route is available."
            if isinstance(error, PreflightRouteBlocked)
            else "Factory preflight is blocked by repository Git configuration."
            if status == "blocked"
            else "Factory preflight is denied by the effective project policy."
            if status == "denied"
            else "Factory preflight did not produce an authoritative compiled workflow."
        ),
        request_hash,
        diagnostics=[diagnostic],
        next_actions=actions,
        side_effects_occurred=False,
    )


def _safe_message(value: str) -> str:
    """Replace forbidden characters; the shared character class lives in
    operation_result.PROJECTION_CONTROL_CHARACTERS so this sanitizer cannot
    drift from it independently again."""
    return "".join(
        " " if operation_result.PROJECTION_CONTROL_CHARACTERS.match(character) else character
        for character in value
    )[:1000]


def _phase_execution_label(phase: dict[str, Any]) -> str:
    execution = phase["execution"]
    kind = execution["kind"]
    if kind == "agent":
        return f"agent:{_safe_message(execution['id'])}"
    if kind == "code":
        return f"code:{_safe_message(execution['capability'])}"
    return f"human:{_safe_message(execution['approval']['decision'])}"


def _compiled_workflow_text_details(compiled: dict[str, Any]) -> list[str]:
    snapshot = compiled["repositoryBinding"]["repositorySnapshot"]
    workflow = compiled["workflow"]
    policy = compiled["effectivePolicy"]
    phases = compiled["orderedPhases"]
    lines = [
        "Repository: "
        f"{_safe_message(snapshot['repository'])}; revision {_safe_message(snapshot['revision'])}; "
        f"target [{_safe_message(snapshot['targetPath'])}].",
        "Workflow: "
        f"{_safe_message(workflow['id'])} v{_safe_message(workflow['version'])}.",
        "Policy: "
        f"{_safe_message(policy['base']['id'])} v{_safe_message(policy['base']['version'])}; "
        "denied capabilities "
        f"{_safe_message(', '.join(policy['deniedCapabilities']) or 'none')}.",
        "Phases: "
        + " -> ".join(
            f"{phase['ordinal']} {_safe_message(phase['id'])} [{_phase_execution_label(phase)}]"
            for phase in phases
        )
        + ".",
    ]
    agent_phases = [
        f"{_safe_message(phase['id'])} -> {_safe_message(phase['execution']['id'])}"
        for phase in phases
        if phase["execution"]["kind"] == "agent"
    ]
    lines.append(f"Agent phases: {', '.join(agent_phases) or 'none'}.")

    scope_labels = (
        ("write", "writeScopes"),
        ("network", "networkScopes"),
        ("secret", "secretScopes"),
    )
    scope_parts = []
    for label, key in scope_labels:
        values = sorted(
            {
                scope
                for phase in phases
                for scope in phase["policy"][key]
            }
        )
        scope_parts.append(f"{label} {_safe_message(', '.join(values) or 'none')}")
    lines.append("Scopes: " + "; ".join(scope_parts) + ".")
    lines.append(
        "Budgets: "
        + "; ".join(
            f"{_safe_message(phase['id'])} {phase['policy']['timeoutSeconds']}s/"
            f"{phase['policy']['maxAttempts']} attempt"
            f"{'s' if phase['policy']['maxAttempts'] != 1 else ''}"
            for phase in phases
        )
        + "."
    )
    lines.append(
        "Required gates: "
        f"{_safe_message(', '.join(compiled['requiredGateIds']) or 'none')}."
    )
    approvals = [
        f"{_safe_message(phase['id'])} -> {_safe_message(phase['execution']['approval']['decision'])}"
        for phase in phases
        if phase["execution"]["kind"] == "human"
    ]
    lines.append(f"Approvals: {', '.join(approvals) or 'none'}.")
    first_phase = phases[0]
    if first_phase["execution"]["kind"] == "human":
        lines.append(
            "Next legal action: obtain human approval "
            f"{_safe_message(first_phase['execution']['approval']['decision'])} for phase "
            f"{_safe_message(first_phase['id'])}; no workflow phase has executed."
        )
    else:
        lines.append(
            f"Next legal action: begin phase {_safe_message(first_phase['id'])}; "
            "no workflow phase has executed."
        )
    return lines


def _render_preflight_result(envelope: dict[str, Any], output_format: str) -> str:
    if output_format != "text" or "result" not in envelope:
        return operation_result.render_operation_result(envelope, output_format)
    rendered = operation_result.render_operation_result(envelope, "text").splitlines()
    details = _compiled_workflow_text_details(envelope["result"]["value"])
    return "\n".join([*rendered[:3], *details, *rendered[3:]]) + "\n"


def main() -> int:
    parser = _OperationArgumentParser(description=__doc__)
    parser.add_argument("--repository", default=".")
    parser.add_argument("--target", default=".")
    parser.add_argument("--purpose", default="investigate")
    parser.add_argument("--workflow")
    parser.add_argument("--policy", default="local-development")
    parser.add_argument(
        "--verify-plan",
        help="Verify a compiled plan against the explicit current repository request",
    )
    parser.add_argument("--format", choices=("json", "json-compact", "text"), default="text")
    parser.add_argument("--output", default="-", help="Output path or - for standard output")
    arguments = parser.parse_args()
    operation = "verify" if arguments.verify_plan else "preflight"
    request_hash = _request_hash(arguments, operation)

    try:
        documents = {
            path: validate_factory.load_json(path)
            for path in validate_factory.all_json_files()
        }
        repository = Path(arguments.repository).resolve()
        output_destination = _validate_output_path(repository, arguments.output)
        if arguments.verify_plan:
            compiled = _load_compiled_plan(Path(arguments.verify_plan).resolve())
            request_hash = _request_hash(arguments, operation, compiled.get("contentHash"))
            verify_preflight_authority(
                compiled,
                documents,
                repository,
                arguments.target,
                arguments.purpose,
                arguments.workflow,
                arguments.policy,
            )
            summary = "Factory compiled workflow authority verified against the current repository request."
        else:
            compiled = preflight_repository(
                documents,
                repository,
                arguments.target,
                arguments.purpose,
                arguments.workflow,
                arguments.policy,
            )
            summary = "Factory preflight produced an authoritative compiled workflow."
        request_hash = _request_hash(arguments, operation, compiled.get("contentHash"))
        envelope = operation_result.make_operation_result(
            operation,
            "success",
            summary,
            request_hash,
            result=operation_result.make_typed_result(COMPILED_WORKFLOW_SCHEMA, compiled),
            side_effects_occurred=False,
        )
        output = _render_preflight_result(envelope, arguments.format)
        if output_destination is None:
            print(output, end="")
        else:
            _write_output_safely(output_destination, output)
    except (
        OSError,
        PreflightFailure,
        compile_factory.CompilationFailure,
        operation_result.OperationResultError,
        resolve_factory.ResolutionFailure,
        validate_factory.ValidationFailure,
    ) as error:
        envelope = _failure_envelope(operation, request_hash, error)
        print(_render_preflight_result(envelope, arguments.format), end="")
        return operation_result.exit_code_for_status(envelope["status"])

    return operation_result.exit_code_for_status(envelope["status"])


if __name__ == "__main__":
    raise SystemExit(main())
