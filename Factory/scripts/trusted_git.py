#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Fail-closed Git execution boundary for Factory authority decisions."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import shutil
import stat
import subprocess
from typing import Any


class TrustedGitError(Exception):
    """Raised when a trusted Git executable or environment cannot be established."""


class RepositoryConfigIncludesError(TrustedGitError):
    """Raised when repository configuration can expand an untrusted include."""


@dataclass(frozen=True)
class GitAttestation:
    """Identity of the resolved executable used for every Factory Git invocation."""

    path: Path
    device: int
    inode: int
    size: int
    modified_ns: int
    sha256: str


_ATTESTATION: GitAttestation | None = None
_ALLOWED_ENVIRONMENT_OVERRIDES = {
    "GIT_DEFAULT_HASH",
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_AUTHOR_DATE",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
    "GIT_COMMITTER_DATE",
}
_CONFIG_OVERRIDES = (
    "core.fsmonitor=false",
    "core.untrackedCache=false",
    "core.preloadIndex=false",
    "core.autocrlf=false",
    "core.safecrlf=false",
    f"core.hooksPath={os.devnull}",
    f"core.attributesFile={os.devnull}",
    f"core.excludesFile={os.devnull}",
    "credential.helper=",
    "commit.gpgSign=false",
    "tag.gpgSign=false",
    "maintenance.auto=false",
    "gc.auto=0",
    "color.ui=false",
)
_INCLUDE_KEY_PATTERN = r"^include(if)?\."


def attestation() -> GitAttestation:
    """Resolve Git outside ambient PATH and attest the executable as a regular file."""
    global _ATTESTATION
    if _ATTESTATION is None:
        candidate = shutil.which("git", path=os.defpath)
        if candidate is None:
            raise TrustedGitError("A trusted Git executable is unavailable on the system path")
        try:
            resolved = Path(candidate).resolve(strict=True)
            metadata = resolved.stat()
            if not stat.S_ISREG(metadata.st_mode) or not os.access(resolved, os.X_OK):
                raise TrustedGitError("The resolved Git executable is not a regular executable file")
            digest = hashlib.sha256(resolved.read_bytes()).hexdigest()
        except OSError as error:
            raise TrustedGitError("The trusted Git executable could not be attested") from error
        _ATTESTATION = GitAttestation(
            resolved,
            metadata.st_dev,
            metadata.st_ino,
            metadata.st_size,
            metadata.st_mtime_ns,
            digest,
        )
    _verify_attestation(_ATTESTATION)
    return _ATTESTATION


def _verify_attestation(value: GitAttestation) -> None:
    try:
        metadata = value.path.stat()
        digest = hashlib.sha256(value.path.read_bytes()).hexdigest()
    except OSError as error:
        raise TrustedGitError("The attested Git executable is no longer available") from error
    observed = (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
    )
    expected = (value.device, value.inode, value.size, value.modified_ns)
    if (
        observed != expected
        or digest != value.sha256
        or not stat.S_ISREG(metadata.st_mode)
        or not os.access(value.path, os.X_OK)
    ):
        raise TrustedGitError("The attested Git executable changed during Factory execution")


def environment(overrides: dict[str, str] | None = None) -> dict[str, str]:
    """Return a minimal Git environment with no inherited config or helper authority."""
    executable = attestation().path
    values = {
        "PATH": str(executable.parent),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_SYSTEM": os.devnull,
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_ATTR_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_OPTIONAL_LOCKS": "0",
        "GIT_ASKPASS": "",
        "SSH_ASKPASS": "",
        "LC_ALL": "C",
        "LANG": "C",
        "TZ": "UTC",
    }
    if overrides:
        unsupported = sorted(set(overrides) - _ALLOWED_ENVIRONMENT_OVERRIDES)
        if unsupported:
            raise TrustedGitError(
                "Untrusted Git environment override requested: " + ", ".join(unsupported)
            )
        values.update(overrides)
    return values


def command(arguments: list[str]) -> list[str]:
    """Build one absolute Git command with authority-affecting config disabled."""
    if not arguments or arguments[0].startswith("-"):
        raise TrustedGitError("Trusted Git requires an explicit built-in subcommand")
    executable = attestation().path
    prefix = [str(executable), "--no-replace-objects"]
    for override in _CONFIG_OVERRIDES:
        prefix.extend(("-c", override))
    return [*prefix, *arguments]


def run(
    arguments: list[str],
    *,
    cwd: Path,
    text: bool = True,
    timeout: float = 5,
    environment_overrides: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[Any]:
    """Run Git without inheriting PATH, config, hooks, helpers, prompts, or locks."""
    if not arguments or arguments[0] != "init":
        ensure_repository_config_safe(cwd)
    return _run_direct(
        arguments,
        cwd=cwd,
        text=text,
        timeout=timeout,
        environment_overrides=environment_overrides,
    )


def _run_direct(
    arguments: list[str],
    *,
    cwd: Path,
    text: bool = True,
    timeout: float = 5,
    environment_overrides: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[Any]:
    """Run one command after its caller has disabled or rejected config includes."""
    try:
        return subprocess.run(
            command(arguments),
            cwd=cwd,
            env=environment(environment_overrides),
            check=False,
            capture_output=True,
            text=text,
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise TrustedGitError("Trusted Git execution failed") from error


def popen(arguments: list[str], *, cwd: Path) -> subprocess.Popen[bytes]:
    """Start a bounded binary Git stream under the same trusted boundary."""
    ensure_repository_config_safe(cwd)
    try:
        return subprocess.Popen(
            command(arguments),
            cwd=cwd,
            env=environment(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError as error:
        raise TrustedGitError("Trusted Git execution failed") from error


def raw_local_config(repository: Path, key: str) -> str | None:
    """Read one exact local config value without includes or URL rewriting."""
    process = _run_direct(
        ["config", "--local", "--no-includes", "--get", key],
        cwd=repository,
    )
    if process.returncode == 1:
        return None
    if process.returncode != 0:
        raise TrustedGitError("Trusted Git could not read local repository configuration")
    return process.stdout.strip()


def raw_local_config_names(repository: Path, pattern: str) -> tuple[str, ...]:
    """List exact local config keys without evaluating include files."""
    process = _run_direct(
        ["config", "--local", "--no-includes", "--name-only", "--get-regexp", pattern],
        cwd=repository,
    )
    if process.returncode == 1:
        return ()
    if process.returncode != 0:
        raise TrustedGitError("Trusted Git could not inspect local repository configuration")
    return tuple(sorted(line for line in process.stdout.splitlines() if line))


def ensure_repository_config_safe(repository: Path) -> None:
    """Fail before a general Git command can expand local include/includeIf content."""
    local_includes = _config_names_without_includes(repository, "--local", _INCLUDE_KEY_PATTERN)
    if local_includes:
        raise RepositoryConfigIncludesError(
            "Repository-local Git include/includeIf directives are not allowed for trusted execution"
        )

    worktree_enabled = _run_direct(
        [
            "config",
            "--local",
            "--no-includes",
            "--bool",
            "--get",
            "extensions.worktreeConfig",
        ],
        cwd=repository,
    )
    if worktree_enabled.returncode == 1:
        return
    if worktree_enabled.returncode != 0:
        raise TrustedGitError("Trusted Git could not inspect worktree configuration authority")
    if worktree_enabled.stdout.strip() != "true":
        return
    worktree_includes = _config_names_without_includes(
        repository,
        "--worktree",
        _INCLUDE_KEY_PATTERN,
    )
    if worktree_includes:
        raise RepositoryConfigIncludesError(
            "Repository worktree Git include/includeIf directives are not allowed for trusted execution"
        )


def _config_names_without_includes(
    repository: Path,
    scope: str,
    pattern: str,
) -> tuple[str, ...]:
    process = _run_direct(
        ["config", scope, "--no-includes", "--name-only", "--get-regexp", pattern],
        cwd=repository,
    )
    if process.returncode == 1:
        return ()
    if process.returncode != 0:
        raise TrustedGitError("Trusted Git could not inspect repository configuration authority")
    return tuple(sorted(line for line in process.stdout.splitlines() if line))
