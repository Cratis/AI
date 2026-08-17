#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Resolve an explainable Cratis Factory profile from repository evidence."""

from __future__ import annotations

import argparse
from fnmatch import fnmatch
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
import unicodedata
from urllib.parse import urlsplit
import xml.etree.ElementTree as ElementTree

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

import canonical_json
import compile_factory
import operation_result
import trusted_git
import validate_factory


IGNORED_DIRECTORIES = {
    ".claude",
    ".factory",
    ".git",
    ".yarn",
    ".worktrees",
    "TestResults",
    "artifacts",
    "bin",
    "coverage",
    "dist",
    "node_modules",
    "obj",
}
MAXIMUM_FILES = 50_000
MAXIMUM_MANIFEST_BYTES = 2_000_000
MAXIMUM_JSON_DEPTH = 64
MAXIMUM_JSON_STRUCTURAL_TOKENS = 100_000
REDACTED_PACKAGE_IDENTIFIER = "unsafe-package-identifier-redacted"
REDACTED_PACKAGE_VERSION = "unsafe-package-reference-redacted"
_TRUSTED_PACKAGE_IDENTIFIERS = {
    "npm": {
        "@cratis/arc.react",
        "@cratis/arc.react.mvvm",
        "@cratis/chronicle",
        "@cratis/chronicle.contracts",
        "@cratis/components",
        "primereact",
        "react",
        "react-dom",
    },
    "nuget": {
        "Cratis",
        "Cratis.Arc",
        "Cratis.Arc.Chronicle",
        "Cratis.Arc.Core",
        "Cratis.Chronicle",
        "Cratis.Chronicle.AspNetCore",
        "Cratis.Chronicle.Contracts",
    },
    "maven": {
        "io.cratis:chronicle",
        "io.cratis:chronicle-contracts",
    },
    "hex": {
        "cratis_chronicle",
        "cratis_chronicle_contracts",
    },
}
_MAXIMUM_PACKAGE_IDENTIFIER_LENGTH = 256
_MAXIMUM_PACKAGE_VERSION_LENGTH = 256
_PACKAGE_IDENTIFIER_PATTERNS = {
    "npm": re.compile(r"^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$"),
    "nuget": re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$"),
    "maven": re.compile(
        r"^[A-Za-z0-9][A-Za-z0-9_.-]*:[A-Za-z0-9][A-Za-z0-9_.-]*$"
    ),
    "hex": re.compile(r"^[a-z][a-z0-9_]*$"),
}
_SEMVER_CORE = r"(?:0|[1-9][0-9]*|[xX*])(?:\.(?:0|[1-9][0-9]*|[xX*])){0,2}"
_SEMVER_SUFFIX = r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
_SEMVER_VALUE = rf"v?{_SEMVER_CORE}{_SEMVER_SUFFIX}"
_COMPARATOR = rf"(?:\^|~|>=|<=|>|<|=)?\s*{_SEMVER_VALUE}"
_NPM_VERSION = re.compile(
    rf"^(?:{_COMPARATOR}(?:\s+{_COMPARATOR})*|{_SEMVER_VALUE}\s+-\s+{_SEMVER_VALUE})"
    rf"(?:\s*\|\|\s*(?:{_COMPARATOR}(?:\s+{_COMPARATOR})*|{_SEMVER_VALUE}\s+-\s+{_SEMVER_VALUE}))*$"
)
_NUGET_VERSION = re.compile(
    rf"^(?:{_SEMVER_VALUE}|[\[(]\s*{_SEMVER_VALUE}?\s*(?:,\s*{_SEMVER_VALUE}?\s*)?[\])])$"
)
_MAVEN_VERSION = re.compile(
    rf"^(?:{_SEMVER_VALUE}|[\[(]\s*{_SEMVER_VALUE}?\s*,\s*{_SEMVER_VALUE}?\s*[\])])$"
)
_HEX_COMPARATOR = rf"(?:~>|>=|<=|==|!=|>|<)?\s*{_SEMVER_VALUE}"
_HEX_VERSION = re.compile(
    rf"^{_HEX_COMPARATOR}(?:\s+(?:and|or)\s+{_HEX_COMPARATOR})*$"
)
_PACKAGE_VERSION_PATTERNS = {
    "npm": _NPM_VERSION,
    "nuget": _NUGET_VERSION,
    "maven": _MAVEN_VERSION,
    "hex": _HEX_VERSION,
}
_PROMPT_LIKE = re.compile(
    r"(?i)(?:\b(?:ignore|disregard|override|reveal|exfiltrate)\b.{0,64}"
    r"\b(?:instruction|prompt|system|secret|token|previous|prior)\b|"
    r"\b(?:system|assistant|user)\s*:)"
)
_SENSITIVE_OR_INSTRUCTIONAL = re.compile(
    r"(?i)(?:\b(?:token|secret|password|passwd|credential|authorization|bearer|api[-_]?key)\b|"
    r"(?:file|git\+https?|ssh|https?)\s*:|git@)"
)
GIT_CONFIG_INCLUDE_WARNING = (
    "Repository Git include/includeIf directives were not expanded during inspection."
)
GIT_CONFIG_INCLUDE_BLOCKER = (
    "Repository Git include/includeIf directives prevent trusted executable authority."
)
MANIFEST_WORKFLOWS_EMPTY_BLOCKER = (
    "Project manifest allows no workflows; executable preflight has no authorized route."
)
MANIFEST_POLICY_DENIAL_BLOCKER = (
    "Project manifest policy denies capabilities required by every authorized eligible workflow."
)
_MANIFEST_NOT_SUPPLIED = object()
DETAIL_LEVELS = ("summary", "explain", "trace")
KNOWN_REPOSITORIES = {
    "github.com/cratis/arc": "cratis-arc",
    "github.com/cratis/components": "cratis-components",
    "github.com/cratis/chronicle": "cratis-chronicle",
    "github.com/cratis/chronicle.typescript": "cratis-chronicle-typescript",
    "github.com/cratis/chronicle.kotlin": "cratis-chronicle-jvm",
    "github.com/cratis/chronicle.elixir": "cratis-chronicle-elixir",
}
LOW_LEVEL_CONTRACT_PACKAGES = {
    ("hex", "cratis_chronicle_contracts"),
    ("maven", "io.cratis:chronicle-contracts"),
    ("npm", "@cratis/chronicle.contracts"),
    ("nuget", "Cratis.Chronicle.Contracts"),
}


class ResolutionFailure(Exception):
    """Raised when repository evidence cannot be resolved safely."""


class _OperationArgumentParser(argparse.ArgumentParser):
    """Render invocation failures through the shared operation-result protocol."""

    def error(self, message: str) -> None:
        raw_arguments = sys.argv[1:]
        output_format = _requested_output_format(raw_arguments)
        request_hash = _invocation_request_hash(raw_arguments)
        diagnostic = operation_result.make_diagnostic(
            "FACTORY-RESOLVE-INVOCATION-INVALID",
            "error",
            _safe_projection_text(message) or "Factory inspection invocation is invalid",
            "retry-after-correction",
            "Correct the command arguments and run the inspection again.",
        )
        envelope = operation_result.make_operation_result(
            "inspect",
            "invocation-error",
            "Factory inspection invocation is invalid.",
            request_hash,
            diagnostics=[diagnostic],
            side_effects_occurred=False,
        )
        print(operation_result.render_operation_result(envelope, output_format), end="")
        raise SystemExit(operation_result.exit_code_for_status("invocation-error"))


def resolve_repository(
    repository_root: Path,
    target_path: str,
    purpose: str,
    documents: dict[Path, dict[str, Any]],
    *,
    _validated_manifest: dict[str, Any] | None | object = _MANIFEST_NOT_SUPPLIED,
    baseline_policy_id: str = "local-development",
) -> dict[str, Any]:
    """Resolve profiles, capabilities, agents, and workflows for one repository target."""
    repository_root = repository_root.resolve()
    target = (repository_root / target_path).resolve()
    if not target.is_relative_to(repository_root) or not target.is_dir():
        raise ResolutionFailure("Target path must be a directory inside the repository root")

    manifest_was_supplied = _validated_manifest is not _MANIFEST_NOT_SUPPLIED
    manifest = (
        _validated_manifest
        if manifest_was_supplied
        else _load_project_manifest(repository_root, documents)
    )
    if manifest is not None and not isinstance(manifest, dict):
        raise ResolutionFailure("Validated project manifest binding must be an object or null")
    if manifest_was_supplied and manifest is not None:
        _validate_project_manifest(manifest, documents)
    if manifest is not None and manifest["policy"]["id"] != baseline_policy_id:
        raise ResolutionFailure(
            f"Project manifest policy {manifest['policy']['id']} cannot replace trusted baseline "
            f"policy {baseline_policy_id}; project policy may only narrow the baseline"
        )
    repository_includes_block_authority = False
    try:
        trusted_git.ensure_repository_config_safe(repository_root)
    except trusted_git.RepositoryConfigIncludesError:
        repository_includes_block_authority = True
    except trusted_git.TrustedGitError:
        pass
    collected = _collect_evidence(repository_root, target)
    repository_identity_candidates = _repository_identity_candidates(repository_root)
    repository_identity = _repository_identity(repository_root, repository_identity_candidates)
    repository_identity_source = next(
        (
            candidate["source"]
            for candidate in repository_identity_candidates
            if candidate["identity"] == repository_identity
        ),
        None,
    )
    repository_mode = _repository_mode(collected, manifest, repository_identity)
    explicit_profiles = set(manifest.get("profiles", {}).get("include", [])) if manifest else set()
    excluded_profiles = set(manifest.get("profiles", {}).get("exclude", [])) if manifest else set()

    profiles = [
        (path, document)
        for path, document in documents.items()
        if document.get("documentKind") == "profile"
    ]
    selected: list[tuple[Path, dict[str, Any]]] = []
    matches: list[dict[str, Any]] = []
    for path, profile in sorted(profiles, key=lambda item: item[1]["id"]):
        profile_id = profile["id"]
        reasons: list[str] = []
        matched = True
        if profile_id in excluded_profiles:
            matched = False
            reasons.append("excluded by .cratis/factory.json")
        elif profile["activation"] == "explicit" and profile_id not in explicit_profiles:
            matched = False
            reasons.append("requires explicit profile activation")
        elif repository_mode not in profile["repositoryModes"]:
            matched = False
            reasons.append(
                f"repository mode {repository_mode} is not one of {', '.join(profile['repositoryModes'])}"
            )
        else:
            matched, condition_reasons = _matches_condition(
                profile["detect"],
                collected,
                repository_identity,
            )
            reasons.extend(condition_reasons)
        if matched:
            selected.append((path, profile))
        matches.append(
            {
                "profileId": profile_id,
                "matched": matched,
                "reasons": reasons or ["profile matched"],
            }
        )

    capabilities = sorted(
        {
            capability
            for _, profile in selected
            for capability in profile["provides"]
        }
    )
    warnings = list(collected["warnings"])
    blocked_reasons: list[str] = []
    negative_capabilities: list[dict[str, Any]] = []
    if repository_includes_block_authority:
        warnings.append(GIT_CONFIG_INCLUDE_WARNING)
        blocked_reasons.append(GIT_CONFIG_INCLUDE_BLOCKER)
    if repository_mode == "unknown":
        blocked_reasons.append("Repository mode is unknown; no agent or workflow can execute safely.")
        negative_capabilities.append(
            {
                "id": "repository-known",
                "reason": "not-detected",
                "requiredBy": purpose,
                "evidence": ["No explicit manifest, canonical Cratis remote, or supported consumer dependency was found."],
            }
        )

    contract_only = sorted(
        f"{ecosystem}:{name}"
        for ecosystem, name in LOW_LEVEL_CONTRACT_PACKAGES
        if _has_dependency(collected, ecosystem, name)
    )
    idiomatic_clients = {
        "chronicle-client-dotnet",
        "chronicle-client-elixir",
        "chronicle-client-jvm",
        "chronicle-client-typescript",
    }
    if contract_only and not idiomatic_clients.intersection(capabilities):
        warnings.append("Only generated Chronicle transport contracts were detected; no idiomatic client was selected.")
        negative_capabilities.append(
            {
                "id": "chronicle-idiomatic-client",
                "reason": "low-level-contracts-only",
                "requiredBy": purpose,
                "evidence": contract_only,
            }
        )

    if _has_dependency(collected, "npm", "@cratis/components"):
        missing_peers = [
            package
            for package in ("react", "@cratis/arc.react")
            if not _has_dependency(collected, "npm", package)
        ]
        if missing_peers:
            negative_capabilities.append(
                {
                    "id": "cratis-components",
                    "reason": "required-peer-missing",
                    "requiredBy": purpose,
                    "evidence": [f"Missing npm peer evidence: {', '.join(missing_peers)}"],
                }
            )
            warnings.append("Cratis Components was detected without all required React and Arc.React peers.")

    agents = _rank_recommendations(selected, "agents", purpose, documents)
    workflows = _eligible_workflows(selected, purpose, capabilities, documents, negative_capabilities)
    workflows = _apply_project_manifest_routing(
        workflows,
        manifest,
        documents,
        negative_capabilities,
        blocked_reasons,
    )
    if repository_mode != "unknown" and not agents:
        blocked_reasons.append(f"No eligible agent is defined for purpose {purpose}.")
    if repository_mode != "unknown" and not workflows:
        blocked_reasons.append(f"No eligible workflow is defined for purpose {purpose}.")

    result: dict[str, Any] = {
        "$schema": "https://schemas.cratis.io/factory/v1/resolved-profile.schema.json",
        "protocolVersion": "1",
        "targetPath": str(target.relative_to(repository_root)) or ".",
        "purpose": purpose,
        "repositoryMode": repository_mode,
        "repositoryIdentity": repository_identity,
        "evidence": _public_evidence(
            collected,
            manifest,
            repository_identity,
            repository_identity_source,
        ),
        "matches": matches,
        "profiles": [
            {
                "id": profile["id"],
                "version": profile["version"],
                "contentHash": canonical_json.content_hash(profile),
            }
            for _, profile in sorted(selected, key=lambda item: (-item[1]["priority"], item[1]["id"]))
        ],
        "capabilities": capabilities,
        "negativeCapabilities": sorted(
            negative_capabilities,
            key=lambda item: (item["requiredBy"], item["id"], item["reason"]),
        ),
        "skills": _resolved_skills(selected),
        "agents": agents,
        "workflows": workflows,
        "warnings": sorted(set(warnings)),
        "blockedReasons": sorted(set(blocked_reasons)),
    }
    result["contentHash"] = canonical_json.content_hash(result)
    _validate_result(result, documents)
    return result


def _collect_evidence(repository_root: Path, target: Path) -> dict[str, Any]:
    files: set[str] = set()
    file_source_ids: dict[str, str] = {}
    evidence_files: list[dict[str, str]] = []
    dependencies: list[dict[str, str]] = []
    repository_packages: list[dict[str, str]] = []
    warnings: list[str] = []
    file_count = 0
    for current_root, directory_names, file_names in os.walk(target, followlinks=False):
        directory_names[:] = sorted(
            name
            for name in directory_names
            if name not in IGNORED_DIRECTORIES and not (Path(current_root) / name).is_symlink()
        )
        for file_name in sorted(file_names):
            path = Path(current_root) / file_name
            if path.is_symlink():
                continue
            file_count += 1
            if file_count > MAXIMUM_FILES:
                raise ResolutionFailure(f"Repository target exceeds the {MAXIMUM_FILES} file discovery limit")
            target_relative = path.relative_to(target).as_posix()
            source_id = f"repository-file:{file_count:06d}"
            files.add(target_relative)
            file_source_ids[target_relative] = source_id
            if _is_manifest(path):
                evidence_files.append({"kind": "file", "source": source_id, "value": file_name})
                try:
                    _collect_manifest(path, source_id, dependencies, repository_packages)
                except (OSError, ValueError, RecursionError, ElementTree.ParseError) as error:
                    warnings.append(
                        f"Could not parse {source_id}: {_safe_error_detail(error)}"
                    )
    return {
        "files": files,
        "fileSourceIds": file_source_ids,
        "fileEvidence": evidence_files,
        "dependencies": dependencies,
        "repositoryPackages": repository_packages,
        "warnings": warnings,
    }


def _is_manifest(path: Path) -> bool:
    return (
        path.name in {"Directory.Packages.props", "build.gradle", "build.gradle.kts", "mix.exs", "package.json", "pom.xml"}
        or path.suffix == ".csproj"
    )


def _collect_manifest(
    path: Path,
    source: str,
    dependencies: list[dict[str, str]],
    repository_packages: list[dict[str, str]],
) -> None:
    if path.stat().st_size > MAXIMUM_MANIFEST_BYTES:
        raise ValueError(f"manifest exceeds {MAXIMUM_MANIFEST_BYTES} bytes")
    if path.name == "package.json":
        _collect_npm(path, source, dependencies, repository_packages)
    elif path.suffix == ".csproj" or path.name == "Directory.Packages.props":
        _collect_nuget(path, source, dependencies, repository_packages)
    elif path.name == "pom.xml":
        _collect_maven(path, source, dependencies, repository_packages)
    elif path.name in {"build.gradle", "build.gradle.kts"}:
        _collect_gradle(path, source, dependencies)
    elif path.name == "mix.exs":
        _collect_hex(path, source, dependencies, repository_packages)


def _collect_npm(
    path: Path,
    source: str,
    dependencies: list[dict[str, str]],
    repository_packages: list[dict[str, str]],
) -> None:
    document = _parse_bounded_json(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("document root must be an object")
    package_name = document.get("name")
    if isinstance(package_name, str):
        _append_package(repository_packages, "npm", package_name, str(document.get("version", "unknown")), source)
    for section in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        values = document.get(section, {})
        if not isinstance(values, dict):
            continue
        for name, version in values.items():
            if isinstance(name, str) and isinstance(version, str):
                _append_package(dependencies, "npm", name, version, source)


def _collect_nuget(
    path: Path,
    source: str,
    dependencies: list[dict[str, str]],
    repository_packages: list[dict[str, str]],
) -> None:
    root = ElementTree.parse(path).getroot()
    for element in root.iter():
        name = _xml_name(element.tag)
        if name == "PackageReference":
            package = element.attrib.get("Include") or element.attrib.get("Update")
            version = element.attrib.get("Version") or _child_text(element, "Version") or "unknown"
            if package:
                _append_package(dependencies, "nuget", package, version, source)
    package_id = next(
        (element.text for element in root.iter() if _xml_name(element.tag) == "PackageId" and element.text),
        None,
    )
    if package_id:
        version = next(
            (element.text for element in root.iter() if _xml_name(element.tag) == "Version" and element.text),
            "unknown",
        )
        _append_package(repository_packages, "nuget", package_id, version, source)


def _collect_maven(
    path: Path,
    source: str,
    dependencies: list[dict[str, str]],
    repository_packages: list[dict[str, str]],
) -> None:
    root = ElementTree.parse(path).getroot()
    group = _child_text(root, "groupId")
    artifact = _child_text(root, "artifactId")
    version = _child_text(root, "version") or "unknown"
    if group and artifact:
        _append_package(repository_packages, "maven", f"{group}:{artifact}", version, source)
    for element in root.iter():
        if _xml_name(element.tag) != "dependency":
            continue
        dependency_group = _child_text(element, "groupId")
        dependency_artifact = _child_text(element, "artifactId")
        dependency_version = _child_text(element, "version") or "unknown"
        if dependency_group and dependency_artifact:
            _append_package(
                dependencies,
                "maven",
                f"{dependency_group}:{dependency_artifact}",
                dependency_version,
                source,
            )


def _collect_gradle(path: Path, source: str, dependencies: list[dict[str, str]]) -> None:
    content = path.read_text(encoding="utf-8")
    for group, artifact, version in re.findall(r"['\"]([\w.-]+):([\w.-]+):([^'\"]+)['\"]", content):
        _append_package(dependencies, "maven", f"{group}:{artifact}", version, source)


def _collect_hex(
    path: Path,
    source: str,
    dependencies: list[dict[str, str]],
    repository_packages: list[dict[str, str]],
) -> None:
    content = path.read_text(encoding="utf-8")
    application = re.search(r"app:\s*:([a-zA-Z0-9_]+)", content)
    version_match = re.search(r"version:\s*['\"]([^'\"]+)['\"]", content)
    if application:
        _append_package(
            repository_packages,
            "hex",
            application.group(1),
            version_match.group(1) if version_match else "unknown",
            source,
        )
    for name, version in re.findall(r"\{:\s*([a-zA-Z0-9_]+)\s*,\s*['\"]([^'\"]+)['\"]", content):
        _append_package(dependencies, "hex", name, version, source)


def _append_package(
    collection: list[dict[str, str]],
    ecosystem: str,
    name: str,
    version: str,
    source: str,
) -> None:
    value = {
        "ecosystem": ecosystem,
        "name": _normalize_package_identifier(ecosystem, name),
        "version": _normalize_package_version(ecosystem, version),
        "source": source,
    }
    if value not in collection:
        collection.append(value)


def _normalize_package_identifier(ecosystem: str, value: str) -> str:
    """Return only a published-package identifier or one constant redaction class."""
    candidate = value.strip()
    pattern = _PACKAGE_IDENTIFIER_PATTERNS.get(ecosystem)
    trusted = _TRUSTED_PACKAGE_IDENTIFIERS.get(ecosystem, set())
    canonical = (
        next(
            (
                identifier
                for identifier in trusted
                if identifier.casefold() == candidate.casefold()
            ),
            None,
        )
        if ecosystem == "nuget"
        else candidate if candidate in trusted else None
    )
    if (
        pattern is None
        or not candidate
        or len(candidate) > _MAXIMUM_PACKAGE_IDENTIFIER_LENGTH
        or any(unicodedata.category(character).startswith("C") for character in candidate)
        or _PROMPT_LIKE.search(candidate) is not None
        or pattern.fullmatch(candidate) is None
        or canonical is None
    ):
        return REDACTED_PACKAGE_IDENTIFIER
    return canonical


def _normalize_package_version(ecosystem: str, value: str) -> str:
    """Preserve safe published semver/ranges without reflecting repository references."""
    candidate = value.strip()
    if candidate == "unknown":
        return candidate
    if (
        not candidate
        or len(candidate) > _MAXIMUM_PACKAGE_VERSION_LENGTH
        or _contains_private_or_instructional_package_text(candidate)
    ):
        return REDACTED_PACKAGE_VERSION
    candidate = " ".join(candidate.split())
    pattern = _PACKAGE_VERSION_PATTERNS.get(ecosystem)
    if pattern is None or pattern.fullmatch(candidate) is None:
        return REDACTED_PACKAGE_VERSION
    return candidate


def _contains_private_or_instructional_package_text(value: str) -> bool:
    if any(unicodedata.category(character).startswith("C") for character in value):
        return True
    if any(marker in value for marker in ("/", "\\", "?", "#", "%", "${", "$(")):
        return True
    return (
        _SENSITIVE_OR_INSTRUCTIONAL.search(value) is not None
        or _PROMPT_LIKE.search(value) is not None
    )


def _xml_name(tag: str) -> str:
    return tag.rsplit("}", maxsplit=1)[-1]


def _child_text(element: ElementTree.Element, name: str) -> str | None:
    return next(
        (child.text for child in element if _xml_name(child.tag) == name and child.text),
        None,
    )


def _load_project_manifest(
    repository_root: Path,
    documents: dict[Path, dict[str, Any]],
) -> dict[str, Any] | None:
    repository_root = repository_root.resolve()
    path = repository_root / ".cratis" / "factory.json"
    if path.is_symlink():
        raise ResolutionFailure(".cratis/factory.json: manifest must not be a symlink")
    if not path.is_file():
        return None
    try:
        if not path.resolve(strict=True).is_relative_to(repository_root):
            raise ValueError("manifest path must remain inside the repository root")
        if path.stat().st_size > MAXIMUM_MANIFEST_BYTES:
            raise ValueError(f"manifest exceeds {MAXIMUM_MANIFEST_BYTES} bytes")
        manifest = _parse_bounded_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError) as error:
        raise ResolutionFailure(
            f".cratis/factory.json: {_safe_error_detail(error)}"
        ) from error
    if not isinstance(manifest, dict):
        raise ResolutionFailure(".cratis/factory.json: the document root must be an object")

    _validate_project_manifest(manifest, documents)
    return manifest


def _parse_bounded_json(content: str) -> Any:
    """Bound JSON depth and structural complexity before allocating its object graph."""
    depth = 0
    structural_tokens = 0
    in_string = False
    escaped = False
    for character in content:
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
            continue
        if character in "{[":
            depth += 1
            structural_tokens += 1
            if depth > MAXIMUM_JSON_DEPTH:
                raise ValueError(f"JSON nesting exceeds {MAXIMUM_JSON_DEPTH} levels")
        elif character in "}]":
            depth -= 1
            structural_tokens += 1
        elif character in ",:":
            structural_tokens += 1
        if structural_tokens > MAXIMUM_JSON_STRUCTURAL_TOKENS:
            raise ValueError(
                f"JSON structure exceeds {MAXIMUM_JSON_STRUCTURAL_TOKENS} tokens"
            )
    return json.loads(content, object_pairs_hook=_unique_json_object)


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate object key {key}")
        value[key] = item
    return value


def _validate_project_manifest(
    manifest: dict[str, Any],
    documents: dict[Path, dict[str, Any]],
) -> None:
    schema_path = validate_factory.CONTRACTS / "project-manifest.schema.json"
    schema = documents.get(schema_path)
    if schema is None:
        raise ResolutionFailure("Canonical project-manifest schema is unavailable")

    schemas = {
        document["$id"]: document
        for path, document in documents.items()
        if path.parent == validate_factory.CONTRACTS
        and path.name.endswith(".schema.json")
        and isinstance(document.get("$id"), str)
    }
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document))
        for identifier, document in schemas.items()
    )
    validator = Draft202012Validator(schema, format_checker=FormatChecker(), registry=registry)
    schema_errors = sorted(
        validator.iter_errors(manifest),
        key=lambda error: (tuple(str(part) for part in error.absolute_path), error.message),
    )
    if schema_errors:
        diagnostics = [
            f"{_manifest_error_location(error.absolute_path)}: {error.message}"
            for error in schema_errors
        ]
        raise ResolutionFailure(
            "Invalid project manifest: "
            + _sanitize_terminal_text("; ".join(diagnostics))
        )

    workflows = {
        document["id"]: document["version"]
        for document in documents.values()
        if document.get("documentKind") == "workflow"
    }
    profiles = {
        document["id"]
        for document in documents.values()
        if document.get("documentKind") == "profile"
    }
    policies = {
        document["id"]
        for document in documents.values()
        if document.get("documentKind") == "policy"
    }
    policy_capabilities = {
        document["id"]: set(document.get("capabilities", {}))
        for document in documents.values()
        if document.get("documentKind") == "policy"
    }
    semantic_errors: list[str] = []
    validate_factory.validate_project_manifest(
        validate_factory.ROOT / ".cratis" / "factory.json",
        manifest,
        workflows,
        profiles,
        policies,
        policy_capabilities,
        semantic_errors,
    )
    excluded_profiles = set(manifest["profiles"]["exclude"])
    unknown_excluded_profiles = sorted(excluded_profiles - profiles)
    if unknown_excluded_profiles:
        semantic_errors.append(
            ".cratis/factory.json: unknown excluded profiles: "
            + ", ".join(unknown_excluded_profiles)
        )
    overlapping_profiles = sorted(set(manifest["profiles"]["include"]) & excluded_profiles)
    if overlapping_profiles:
        semantic_errors.append(
            ".cratis/factory.json: profiles cannot be both included and excluded: "
            + ", ".join(overlapping_profiles)
        )
    if semantic_errors:
        raise ResolutionFailure(
            "Invalid project manifest: "
            + _sanitize_terminal_text("; ".join(semantic_errors))
        )


def _manifest_error_location(path: Any) -> str:
    location = ".cratis/factory.json"
    for part in path:
        if isinstance(part, int):
            location += f"[{part}]"
        else:
            location += f".{part}"
    return location


def _repository_identity_candidates(repository_root: Path) -> list[dict[str, str]]:
    try:
        process = trusted_git.run(
            ["rev-parse", "--show-toplevel"],
            cwd=repository_root,
            timeout=3,
        )
    except trusted_git.TrustedGitError:
        return []
    if process.returncode != 0:
        return []
    try:
        git_root = Path(process.stdout.strip()).resolve(strict=True)
    except (OSError, ValueError):
        return []
    if git_root != repository_root:
        return []

    candidates: list[dict[str, str]] = []
    for remote_name in ("origin", "upstream"):
        try:
            remote = trusted_git.raw_local_config(
                repository_root,
                f"remote.{remote_name}.url",
            )
        except trusted_git.TrustedGitError:
            continue
        if remote is None:
            continue
        normalized = _normalize_remote(remote)
        if normalized is None:
            continue
        identity = KNOWN_REPOSITORIES.get(normalized)
        if identity is not None:
            candidates.append(
                {
                    "identity": identity,
                    "source": f"git:{remote_name}",
                    "normalizedRemote": normalized,
                }
            )
    return candidates


def _repository_identity(
    repository_root: Path,
    candidates: list[dict[str, str]] | None = None,
) -> str | None:
    resolved_candidates = candidates if candidates is not None else _repository_identity_candidates(repository_root)
    identities = {candidate["identity"] for candidate in resolved_candidates}
    if len(identities) > 1:
        evidence = ", ".join(
            f"{candidate['source']}={candidate['identity']}"
            for candidate in resolved_candidates
        )
        raise ResolutionFailure(f"Ambiguous canonical repository identity: {evidence}")
    return resolved_candidates[0]["identity"] if resolved_candidates else None


def _normalize_remote(remote: str) -> str | None:
    value = remote.strip()
    if not value or any(unicodedata.category(character).startswith("C") for character in value):
        return None

    scp_match = re.fullmatch(r"git@([A-Za-z0-9.-]+):([^?#]+)", value)
    if scp_match is not None:
        host = scp_match.group(1)
        path = scp_match.group(2)
    else:
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {"https", "ssh", "git"}:
            return None
        if parsed.query or parsed.fragment or parsed.password is not None:
            return None
        if parsed.scheme.lower() != "ssh" and parsed.username is not None:
            return None
        if parsed.scheme.lower() == "ssh" and parsed.username not in {None, "git"}:
            return None
        try:
            port = parsed.port
        except ValueError:
            return None
        allowed_port = {"https": 443, "ssh": 22, "git": 9418}[parsed.scheme.lower()]
        if port is not None and port != allowed_port:
            return None
        host = parsed.hostname or ""
        path = parsed.path

    normalized_path = path.strip("/").lower()
    if normalized_path.endswith(".git"):
        normalized_path = normalized_path[:-4]
    if not host or not normalized_path:
        return None
    return f"{host.lower()}/{normalized_path}"


def _repository_mode(
    collected: dict[str, Any],
    manifest: dict[str, Any] | None,
    repository_identity: str | None,
) -> str:
    manifest_mode = manifest.get("repositoryMode") if manifest else None
    if manifest_mode in {"application", "framework", "modeling", "operations"}:
        return manifest_mode
    if repository_identity is not None:
        return "framework"
    supported_dependency = any(
        _is_supported_consumer_dependency(item["ecosystem"], item["name"])
        for item in collected["dependencies"]
    )
    return "application" if supported_dependency else "unknown"


def _is_supported_consumer_dependency(ecosystem: str, name: str) -> bool:
    if (ecosystem, name) in LOW_LEVEL_CONTRACT_PACKAGES:
        return False
    return (
        (ecosystem == "nuget" and (name == "Cratis" or name.startswith("Cratis.Arc") or name.startswith("Cratis.Chronicle")))
        or (ecosystem == "npm" and name.startswith("@cratis/"))
        or (ecosystem == "maven" and name == "io.cratis:chronicle")
        or (ecosystem == "hex" and name == "cratis_chronicle")
    )


def _matches_condition(
    condition: dict[str, Any],
    collected: dict[str, Any],
    repository_identity: str | None,
) -> tuple[bool, list[str]]:
    if "allOf" in condition:
        results = [_matches_condition(item, collected, repository_identity) for item in condition["allOf"]]
        return all(result[0] for result in results), [reason for result in results for reason in result[1]]
    if "anyOf" in condition:
        results = [_matches_condition(item, collected, repository_identity) for item in condition["anyOf"]]
        matched = [result for result in results if result[0]]
        if matched:
            return True, [reason for result in matched for reason in result[1]]
        return False, [reason for result in results for reason in result[1]]

    kind = condition["kind"]
    if kind == "file":
        pattern = condition["pattern"]
        matched_files = sorted(path for path in collected["files"] if _matches_path(path, pattern))
        matched_source = (
            collected["fileSourceIds"][matched_files[0]]
            if matched_files
            else None
        )
        return (
            bool(matched_files),
            [f"file {pattern}: {matched_source}"] if matched_files else [f"file {pattern}: not found"],
        )
    if kind == "dependency":
        matched = _packages_matching(collected["dependencies"], condition["ecosystem"], condition["name"])
        return (
            bool(matched),
            [
                f"dependency {condition['ecosystem']}:{condition['name']}: "
                f"{item['source']} ({_sanitize_terminal_text(item['version'])})"
                for item in matched
            ]
            or [f"dependency {condition['ecosystem']}:{condition['name']}: not found"],
        )
    if kind == "repository-package":
        matched = _packages_matching(collected["repositoryPackages"], condition["ecosystem"], condition["name"])
        return (
            bool(matched),
            [f"repository package {condition['ecosystem']}:{condition['name']}: {item['source']}" for item in matched]
            or [f"repository package {condition['ecosystem']}:{condition['name']}: not found"],
        )
    matched = repository_identity == condition["id"]
    return matched, [f"repository identity {condition['id']}: {'matched' if matched else 'not matched'}"]


def _matches_path(path: str, pattern: str) -> bool:
    return fnmatch(path, pattern) or (pattern.startswith("**/") and fnmatch(path, pattern[3:]))


def _packages_matching(packages: list[dict[str, str]], ecosystem: str, name: str) -> list[dict[str, str]]:
    return [
        package
        for package in packages
        if package["ecosystem"] == ecosystem and _package_name_equal(ecosystem, package["name"], name)
    ]


def _package_name_equal(ecosystem: str, actual: str, expected: str) -> bool:
    return actual.lower() == expected.lower() if ecosystem == "nuget" else actual == expected


def _has_dependency(collected: dict[str, Any], ecosystem: str, name: str) -> bool:
    return bool(_packages_matching(collected["dependencies"], ecosystem, name))


def _rank_recommendations(
    selected: list[tuple[Path, dict[str, Any]]],
    kind: str,
    purpose: str,
    documents: dict[Path, dict[str, Any]],
) -> list[dict[str, Any]]:
    recommendations: dict[str, dict[str, Any]] = {}
    for _, profile in selected:
        for recommendation in profile["recommendations"][kind]:
            if purpose not in recommendation["purposes"]:
                continue
            existing = recommendations.get(recommendation["id"])
            if existing is None or recommendation["priority"] > existing["priority"]:
                recommendations[recommendation["id"]] = recommendation
    ranked = []
    for identifier, recommendation in recommendations.items():
        if kind == "agents":
            path = validate_factory.ROOT / ".ai" / "agents" / f"{identifier}.md"
            item_hash = canonical_json.bytes_content_hash(path.read_bytes())
        else:
            workflow = next(
                document
                for document in documents.values()
                if document.get("documentKind") == "workflow" and document.get("id") == identifier
            )
            item_hash = canonical_json.content_hash(workflow)
        ranked.append(
            {
                "id": identifier,
                "purpose": purpose,
                "priority": recommendation["priority"],
                "rationale": recommendation["rationale"],
                "contentHash": item_hash,
            }
        )
    return sorted(ranked, key=lambda item: (-item["priority"], item["id"]))


def _eligible_workflows(
    selected: list[tuple[Path, dict[str, Any]]],
    purpose: str,
    capabilities: list[str],
    documents: dict[Path, dict[str, Any]],
    negative_capabilities: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    candidates = _rank_recommendations(selected, "workflows", purpose, documents)
    workflows_by_id = {
        document["id"]: document
        for document in documents.values()
        if document.get("documentKind") == "workflow"
    }
    eligible = []
    for candidate in candidates:
        missing = sorted(
            set(workflows_by_id[candidate["id"]]["profileRequirements"]["allOf"]) - set(capabilities)
        )
        if missing:
            for capability in missing:
                negative_capabilities.append(
                    {
                        "id": capability,
                        "reason": "not-detected",
                        "requiredBy": candidate["id"],
                        "evidence": ["No selected profile provides this workflow requirement."],
                    }
                )
        else:
            eligible.append(candidate)
    return eligible


def _apply_project_manifest_routing(
    eligible_workflows: list[dict[str, Any]],
    manifest: dict[str, Any] | None,
    documents: dict[Path, dict[str, Any]],
    negative_capabilities: list[dict[str, Any]],
    blocked_reasons: list[str],
) -> list[dict[str, Any]]:
    """Narrow informational routes to the exact authority executable preflight will honor."""
    if manifest is None:
        return eligible_workflows

    pinned_workflows = manifest["workflows"]
    if not pinned_workflows:
        blocked_reasons.append(MANIFEST_WORKFLOWS_EMPTY_BLOCKER)
        return []

    workflows_by_id = {
        document["id"]: document
        for document in documents.values()
        if document.get("documentKind") == "workflow"
    }
    capability_errors: list[str] = []
    capability_definitions = validate_factory.validate_capability_catalogs(
        {
            path: document
            for path, document in documents.items()
            if document.get("documentKind") == "capability-catalog"
        },
        capability_errors,
    )
    if capability_errors:
        raise ResolutionFailure(
            "Factory capability definitions are invalid: "
            + _sanitize_terminal_text("; ".join(capability_errors))
        )

    denied = set(manifest["policy"]["denyCapabilities"])
    narrowed: list[dict[str, Any]] = []
    eligible_ids = {reference["id"] for reference in eligible_workflows}
    for reference in eligible_workflows:
        workflow_id = reference["id"]
        pinned_version = pinned_workflows.get(workflow_id)
        if pinned_version is None:
            continue
        workflow = workflows_by_id[workflow_id]
        available_version = workflow["version"]
        if pinned_version != available_version:
            negative_capabilities.append(
                {
                    "id": "workflow-version",
                    "reason": "version-incompatible",
                    "requiredBy": workflow_id,
                    "evidence": [
                        f"Manifest pins {pinned_version}; trusted Factory definition is {available_version}."
                    ],
                }
            )
            blocked_reasons.append(
                f"Project manifest workflow {workflow_id} pins version {pinned_version}, "
                f"but trusted Factory definitions provide {available_version}."
            )
            continue
        required = set(
            compile_factory.required_policy_capabilities(workflow, capability_definitions)
        )
        denied_required = sorted(required & denied)
        if denied_required:
            for capability in denied_required:
                negative_capabilities.append(
                    {
                        "id": capability,
                        "reason": "explicitly-denied",
                        "requiredBy": workflow_id,
                        "evidence": [
                            "The validated project manifest narrows the trusted baseline policy."
                        ],
                    }
                )
            continue
        narrowed.append(reference)

    ineligible_pins = sorted(set(pinned_workflows) - eligible_ids)
    if ineligible_pins and not narrowed:
        blocked_reasons.append(
            "Project manifest pins workflows that are not eligible for the resolved profiles "
            f"and purpose: {', '.join(ineligible_pins)}."
        )
    if any(item["reason"] == "explicitly-denied" for item in negative_capabilities) and not narrowed:
        blocked_reasons.append(MANIFEST_POLICY_DENIAL_BLOCKER)
    return narrowed


def _resolved_skills(selected: list[tuple[Path, dict[str, Any]]]) -> list[dict[str, str]]:
    skill_ids = sorted({skill for _, profile in selected for skill in profile["skills"]})
    return [
        {
            "id": skill_id,
            "contentHash": canonical_json.bytes_content_hash(
                (validate_factory.ROOT / ".ai" / "skills" / skill_id / "SKILL.md").read_bytes()
            ),
        }
        for skill_id in skill_ids
    ]


def _public_evidence(
    collected: dict[str, Any],
    manifest: dict[str, Any] | None,
    repository_identity: str | None,
    repository_identity_source: str | None,
) -> list[dict[str, str]]:
    evidence: list[dict[str, str]] = []
    evidence.extend(
        {
            "kind": "dependency",
            "source": package["source"],
            "value": _sanitize_terminal_text(package["name"]),
            "ecosystem": package["ecosystem"],
            "version": _sanitize_terminal_text(package["version"]),
        }
        for package in collected["dependencies"]
        if _is_relevant_evidence_package(package["ecosystem"], package["name"])
    )
    evidence.extend(
        {
            "kind": "repository-package",
            "source": package["source"],
            "value": _sanitize_terminal_text(package["name"]),
            "ecosystem": package["ecosystem"],
            "version": _sanitize_terminal_text(package["version"]),
        }
        for package in collected["repositoryPackages"]
        if _is_relevant_evidence_package(package["ecosystem"], package["name"])
    )
    if repository_identity:
        evidence.append(
            {
                "kind": "repository",
                "source": repository_identity_source or "git:remote",
                "value": repository_identity,
            }
        )
    if manifest:
        evidence.append(
            {
                "kind": "manifest",
                "source": "project-manifest",
                "value": canonical_json.content_hash(manifest),
            }
        )
    return sorted(evidence, key=lambda item: (item["kind"], item["source"], item["value"]))


def _is_relevant_evidence_package(ecosystem: str, name: str) -> bool:
    return (
        _is_supported_consumer_dependency(ecosystem, name)
        or (ecosystem, name) in LOW_LEVEL_CONTRACT_PACKAGES
        or (ecosystem == "npm" and name in {"react", "react-dom", "primereact"})
        or (ecosystem == "nuget" and name.startswith("Cratis."))
        or (ecosystem == "maven" and name.startswith("io.cratis:"))
        or (ecosystem == "hex" and name.startswith("cratis_"))
    )


def _validate_result(result: dict[str, Any], documents: dict[Path, dict[str, Any]]) -> None:
    schemas = {
        document["$id"]: document
        for path, document in documents.items()
        if path.parent == validate_factory.CONTRACTS and path.name.endswith(".schema.json")
    }
    schema = schemas["https://schemas.cratis.io/factory/v1/resolved-profile.schema.json"]
    registry = Registry().with_resources(
        (identifier, Resource.from_contents(document)) for identifier, document in schemas.items()
    )
    validator = Draft202012Validator(schema, format_checker=FormatChecker(), registry=registry)
    errors = sorted(validator.iter_errors(result), key=lambda error: list(error.absolute_path))
    if errors:
        raise ResolutionFailure(
            _sanitize_terminal_text("; ".join(error.message for error in errors))
        )


def _sanitize_terminal_text(value: str) -> str:
    """Escape terminal and invisible control characters in one human-facing value."""
    sanitized: list[str] = []
    for character in value:
        if unicodedata.category(character).startswith("C"):
            codepoint = ord(character)
            sanitized.append(
                f"\\u{codepoint:04x}" if codepoint <= 0xFFFF else f"\\U{codepoint:08x}"
            )
        else:
            sanitized.append(character)
    return "".join(sanitized)


def _safe_error_detail(error: BaseException) -> str:
    if isinstance(error, OSError):
        return f"{type(error).__name__}: filesystem access failed"
    if isinstance(error, json.JSONDecodeError):
        return "JSONDecodeError: invalid JSON syntax"
    if isinstance(error, ElementTree.ParseError):
        return "ParseError: invalid XML syntax"
    if isinstance(error, UnicodeError):
        return f"{type(error).__name__}: invalid text encoding"
    if isinstance(error, RecursionError):
        return "RecursionError: manifest nesting limit exceeded"
    detail = str(error)
    fixed_prefixes = (
        "manifest exceeds ",
        "JSON nesting exceeds ",
        "JSON structure exceeds ",
        "document root must be an object",
    )
    if any(detail.startswith(prefix) for prefix in fixed_prefixes):
        return _sanitize_terminal_text(detail)
    if detail.startswith("duplicate object key "):
        return "ValueError: JSON contains a duplicate object key"
    return f"{type(error).__name__}: invalid manifest content"


def _render_text(result: dict[str, Any]) -> str:
    def safe(value: Any) -> str:
        return _sanitize_terminal_text(str(value))

    lines = [
        f"Repository mode: {safe(result['repositoryMode'])}",
        f"Repository identity: {safe(result['repositoryIdentity'] or 'unrecognized')}",
        f"Target: {safe(result['targetPath'])}",
        f"Purpose: {safe(result['purpose'])}",
        f"Profiles: {safe(', '.join(profile['id'] for profile in result['profiles']) or 'none')}",
        f"Capabilities: {safe(', '.join(result['capabilities']) or 'none')}",
        f"Agents: {safe(', '.join(agent['id'] for agent in result['agents']) or 'none')}",
        f"Workflows: {safe(', '.join(workflow['id'] for workflow in result['workflows']) or 'none')}",
    ]
    lines.extend(f"Warning: {safe(warning)}" for warning in result["warnings"])
    lines.extend(f"Blocked: {safe(reason)}" for reason in result["blockedReasons"])
    lines.append(f"Content hash: {safe(result['contentHash'])}")
    return "\n".join(lines) + "\n"


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
    """Identify invalid invocation shape without hashing private argument values."""
    return sorted(
        value.split("=", maxsplit=1)[0]
        for value in arguments
        if value.startswith("--") and not value.startswith(("--format", "--detail"))
    )


def _invocation_request_hash(arguments: list[str]) -> str:
    return canonical_json.content_hash(
        {
            "operation": "inspect",
            "invocationArguments": _semantic_invocation_arguments(arguments),
        }
    )


def _safe_projection_text(value: str) -> str:
    return _sanitize_terminal_text(value)[:1000]


def _resolution_request_hash(repository: Path, result: dict[str, Any]) -> str:
    return canonical_json.content_hash(
        {
            "operation": "inspect",
            "repositoryRevision": _repository_revision(repository),
            "targetPath": result["targetPath"],
            "purpose": result["purpose"],
            "resolvedProfileHash": result["contentHash"],
        }
    )


def _repository_revision(repository: Path) -> str | None:
    """Return an exact Git revision only when the requested root owns that repository."""
    root = repository.resolve()
    try:
        top_level = trusted_git.run(
            ["rev-parse", "--show-toplevel"],
            cwd=root,
            timeout=3,
        )
        if top_level.returncode != 0 or Path(top_level.stdout.strip()).resolve() != root:
            return None
        revision = trusted_git.run(
            ["rev-parse", "--verify", "HEAD^{commit}"],
            cwd=root,
            timeout=3,
        )
    except (OSError, trusted_git.TrustedGitError):
        return None
    value = revision.stdout.strip()
    return value if revision.returncode == 0 and re.fullmatch(r"[a-f0-9]{40}|[a-f0-9]{64}", value) else None


def _action(
    identifier: str,
    kind: str,
    title: str,
    description: str,
    **values: Any,
) -> dict[str, Any]:
    return {
        "$schema": operation_result.NEXT_ACTION_SCHEMA,
        "protocolVersion": "1",
        "id": identifier,
        "kind": kind,
        "title": title,
        "description": description,
        **values,
    }


def _resolution_envelope(result: dict[str, Any], request_hash: str) -> dict[str, Any]:
    target_path = _safe_projection_text(str(result["targetPath"]))
    summary = (
        f"Factory inspection resolved target {target_path} in {result['repositoryMode']} mode "
        f"for purpose {result['purpose']}."
    )
    diagnostics: list[dict[str, Any]] = []
    actions: list[dict[str, Any]] = []
    negative_reasons = {
        (item["id"], item["reason"])
        for item in result["negativeCapabilities"]
    }
    policy_denied = any(reason == "explicitly-denied" for _, reason in negative_reasons)
    manifest_route_blocked = MANIFEST_WORKFLOWS_EMPTY_BLOCKER in result["blockedReasons"]

    if policy_denied and not result["workflows"]:
        action_id = "contact-project-policy-maintainer"
        actions.append(
            _action(
                action_id,
                "contact-maintainer",
                "Request an authorized policy decision",
                "Ask the project policy owner to select an allowed workflow or review the manifest denial; do not weaken policy automatically.",
                automation="human-only",
                reference="Project policy owner for .cratis/factory.json",
            )
        )
        denied_names = ", ".join(
            sorted(
                item["id"]
                for item in result["negativeCapabilities"]
                if item["reason"] == "explicitly-denied"
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-POLICY-DENIED",
                "error",
                f"Project manifest policy denies workflow-required capabilities: {denied_names}.",
                "retry-after-correction",
                "An authorized policy owner must select a permitted workflow or revise the manifest policy.",
                locations=[
                    {
                        "kind": "document",
                        "reference": ".cratis/factory.json",
                        "pointer": "/policy/denyCapabilities",
                    }
                ],
                related_action_ids=[action_id],
            )
        )

    if manifest_route_blocked:
        action_id = "authorize-project-workflow"
        actions.append(
            _action(
                action_id,
                "correct-input",
                "Pin an authorized project workflow",
                "Have a project maintainer pin an eligible trusted Factory workflow version in the project manifest.",
                automation="human-only",
                location={
                    "kind": "document",
                    "reference": ".cratis/factory.json",
                    "pointer": "/workflows",
                },
                expected="At least one eligible workflow ID mapped to its exact trusted Factory version.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-WORKFLOW-NOT-AUTHORIZED",
                "warning",
                MANIFEST_WORKFLOWS_EMPTY_BLOCKER,
                "retry-after-correction",
                "An authorized project maintainer must pin an eligible workflow before preflight.",
                locations=[
                    {
                        "kind": "document",
                        "reference": ".cratis/factory.json",
                        "pointer": "/workflows",
                    }
                ],
                related_action_ids=[action_id],
            )
        )

    if GIT_CONFIG_INCLUDE_BLOCKER in result["blockedReasons"]:
        action_id = "remove-repository-git-includes"
        actions.append(
            _action(
                action_id,
                "correct-input",
                "Remove repository Git includes",
                "Remove local and worktree include/includeIf directives before executable preflight.",
                automation="requires-confirmation",
                location={"kind": "repository", "reference": "git-config"},
                expected="Repository-local and worktree Git configuration contains no include or includeIf directive.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-GIT-CONFIG-BLOCKED",
                "warning",
                GIT_CONFIG_INCLUDE_BLOCKER,
                "retry-after-correction",
                "Remove repository Git includes before requesting executable authority.",
                locations=[{"kind": "repository", "reference": "git-config"}],
                related_action_ids=[action_id],
            )
        )

    if ("repository-known", "not-detected") in negative_reasons:
        action_id = "supply-project-manifest"
        actions.append(
            _action(
                action_id,
                "supply-input",
                "Declare the repository mode",
                "Provide a valid .cratis/factory.json project manifest with an explicit repository mode.",
                automation="requires-confirmation",
                inputId="project-manifest",
                expected="A valid project manifest declaring repositoryMode as application, framework, modeling, or operations.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-UNKNOWN-REPOSITORY",
                "warning",
                "Repository mode could not be established from a project manifest, canonical remote, or supported dependency.",
                "retry-after-correction",
                "Supply explicit trusted repository metadata before retrying inspection.",
                related_action_ids=[action_id],
            )
        )

    if ("chronicle-idiomatic-client", "low-level-contracts-only") in negative_reasons:
        action_id = "supply-chronicle-client"
        actions.append(
            _action(
                action_id,
                "supply-input",
                "Add an idiomatic Chronicle client",
                "Add the supported Chronicle client for the repository language instead of relying only on generated transport contracts.",
                automation="requires-confirmation",
                inputId="chronicle-client-dependency",
                expected="A supported Chronicle .NET, TypeScript, JVM, or Elixir client dependency.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-CONTRACTS-ONLY",
                "warning",
                "Only generated Chronicle transport contracts were detected; they do not establish an executable client route.",
                "retry-after-correction",
                "Add an idiomatic Chronicle client dependency before retrying inspection.",
                related_action_ids=[action_id],
            )
        )

    if ("cratis-components", "required-peer-missing") in negative_reasons:
        action_id = "supply-components-peers"
        actions.append(
            _action(
                action_id,
                "supply-input",
                "Add required Components peers",
                "Add React and Arc.React peer dependencies required by Cratis Components.",
                automation="requires-confirmation",
                inputId="components-peer-dependencies",
                expected="Both react and @cratis/arc.react dependencies are present in the inspected repository.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-REQUIRED-PEER-MISSING",
                "warning",
                "Cratis Components was detected without all required React and Arc.React peers.",
                "retry-after-correction",
                "Add the missing peer dependencies before retrying inspection.",
                related_action_ids=[action_id],
            )
        )

    specialized_route_blocker = manifest_route_blocked or policy_denied or any(
        reason in {"low-level-contracts-only", "required-peer-missing"}
        for _, reason in negative_reasons
    )
    if (
        result["repositoryMode"] != "unknown"
        and (not result["agents"] or not result["workflows"])
        and not specialized_route_blocker
    ):
        action_id = "correct-inspection-purpose"
        actions.append(
            _action(
                action_id,
                "correct-input",
                "Choose a supported purpose",
                "Use a purpose for which the selected profiles define both an agent and a workflow route.",
                automation="requires-confirmation",
                location={"kind": "argument", "reference": "--purpose"},
                expected="A supported purpose such as investigate, or Factory definitions that explicitly provide the requested route.",
            )
        )
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-NO-ROUTE",
                "warning",
                f"No complete agent and workflow route is defined for purpose {result['purpose']}.",
                "retry-after-correction",
                "Correct the purpose or add an explicitly defined route before retrying inspection.",
                locations=[{"kind": "argument", "reference": "--purpose"}],
                related_action_ids=[action_id],
            )
        )

    represented_warnings = {
        "Only generated Chronicle transport contracts were detected; no idiomatic client was selected.",
        "Cratis Components was detected without all required React and Arc.React peers.",
        GIT_CONFIG_INCLUDE_WARNING,
    }
    for warning in result["warnings"]:
        if warning in represented_warnings:
            continue
        diagnostics.append(
            operation_result.make_diagnostic(
                "FACTORY-RESOLVE-WARNING",
                "warning",
                _safe_projection_text(warning),
                "not-retryable",
                "The warning is informational for this inspection result.",
            )
        )

    status = (
        "denied"
        if policy_denied and not result["workflows"]
        else "blocked"
        if result["blockedReasons"]
        else "success"
    )
    return operation_result.make_operation_result(
        "inspect",
        status,
        summary,
        request_hash,
        diagnostics=diagnostics,
        next_actions=actions,
        result=operation_result.make_typed_result(result["$schema"], result),
        side_effects_occurred=False,
    )


def _surface_name(ecosystem: str, package: str) -> str:
    normalized = package.casefold()
    if normalized == "@cratis/components":
        return "Components"
    if normalized in {"@cratis/arc.react", "@cratis/arc.react.mvvm"}:
        return "Arc React"
    if ecosystem == "nuget" and normalized.startswith("cratis.arc"):
        return "Arc .NET"
    if ecosystem == "nuget" and normalized.startswith("cratis.chronicle"):
        return "Chronicle contracts" if "contracts" in normalized else "Chronicle .NET"
    if normalized == "@cratis/chronicle":
        return "Chronicle TypeScript"
    if normalized == "@cratis/chronicle.contracts":
        return "Chronicle contracts"
    if ecosystem == "maven" and normalized == "io.cratis:chronicle":
        return "Chronicle JVM"
    if ecosystem == "maven" and normalized == "io.cratis:chronicle-contracts":
        return "Chronicle contracts"
    if ecosystem == "hex" and normalized == "cratis_chronicle":
        return "Chronicle Elixir"
    if ecosystem == "hex" and normalized == "cratis_chronicle_contracts":
        return "Chronicle contracts"
    if normalized == "react":
        return "React"
    return package


def _detected_surface_text(result: dict[str, Any]) -> str:
    surfaces = []
    for evidence in result["evidence"]:
        if evidence["kind"] == "repository":
            repository = _safe_projection_text(str(evidence["value"]))
            label = {
                "cratis-arc": "Arc framework repository",
                "cratis-components": "Components framework repository",
                "cratis-chronicle": "Chronicle framework repository",
                "cratis-chronicle-typescript": "Chronicle TypeScript client repository",
                "cratis-chronicle-jvm": "Chronicle JVM client repository",
                "cratis-chronicle-elixir": "Chronicle Elixir client repository",
            }.get(repository, "Cratis repository")
            surfaces.append(f"{label} ({repository}; version not declared)")
            continue
        if evidence["kind"] not in {"dependency", "repository-package"}:
            continue
        ecosystem = _safe_projection_text(str(evidence.get("ecosystem") or "unknown"))
        package = _safe_projection_text(str(evidence["value"]))
        version = _safe_projection_text(str(evidence.get("version") or "version unknown"))
        label = _safe_projection_text(_surface_name(ecosystem, package))
        provenance = " repository package" if evidence["kind"] == "repository-package" else ""
        surfaces.append(f"{label} {version}{provenance}")
    return "; ".join(surfaces) or "none"


def _language_text(result: dict[str, Any]) -> str:
    capabilities = set(result["capabilities"])
    labels = []
    for capability, label in (
        ("dotnet", ".NET/C#"),
        ("typescript", "TypeScript"),
        ("jvm", "Java/Kotlin"),
        ("elixir", "Elixir"),
        ("react", "React UI"),
    ):
        if capability in capabilities:
            labels.append(label)
    return ", ".join(labels) or "not inferred"


def _dependency_reason(reason: str, *, present: bool) -> str | None:
    prefix = "dependency "
    if not reason.startswith(prefix):
        return None
    value = reason.removeprefix(prefix)
    if not present:
        if not value.endswith(": not found"):
            return None
        return _safe_projection_text(
            f"no matching {value.removesuffix(': not found')} dependency was found"
        )
    marker = ": repository-file:"
    if marker not in value:
        return None
    package, source_and_version = value.split(marker, maxsplit=1)
    version_match = re.search(r" \((.*)\)$", source_and_version)
    version = f" {version_match.group(1)}" if version_match else ""
    return _safe_projection_text(f"matched {package}{version}")


def _selected_profile_reason(match: dict[str, Any] | None) -> str:
    if match is None or not match["matched"]:
        return "selected by explicit trusted profile composition"
    dependency_set_reasons = {
        "application-arc-dotnet": "the Arc .NET dependency matched",
        "application-arc-react": "the React and Arc.React dependency set matched",
        "application-chronicle-dotnet": "the Chronicle .NET dependency matched",
        "application-chronicle-elixir": "the Chronicle Elixir client dependency matched",
        "application-chronicle-jvm": "the Chronicle Java/Kotlin client dependency matched",
        "application-chronicle-typescript": "the Chronicle TypeScript client dependency matched",
        "application-cratis-components": "the React, Arc.React, and Components dependency set matched",
    }
    known_reason = dependency_set_reasons.get(match["profileId"])
    if known_reason is not None:
        return known_reason
    dependency_reasons = [
        parsed
        for reason in match["reasons"]
        if (parsed := _dependency_reason(reason, present=True)) is not None
    ]
    if dependency_reasons:
        return ", ".join(dependency_reasons)
    return _safe_projection_text(match["reasons"][0] if match["reasons"] else "matched profile rules")


def _compact_selected_profile_reason(profile_id: str) -> str:
    reasons = {
        "application-arc-dotnet": "Arc .NET matched",
        "application-arc-react": "React + Arc.React matched",
        "application-chronicle-dotnet": "Chronicle .NET matched",
        "application-chronicle-elixir": "Chronicle Elixir matched",
        "application-chronicle-jvm": "Chronicle JVM matched",
        "application-chronicle-typescript": "Chronicle TypeScript matched",
        "application-cratis-components": "React + Arc.React + Components matched",
        "framework-arc": "Arc repository matched",
        "framework-chronicle": "Chronicle repository matched",
        "framework-chronicle-elixir": "Chronicle Elixir repository matched",
        "framework-chronicle-jvm": "Chronicle JVM repository matched",
        "framework-chronicle-typescript": "Chronicle TypeScript repository matched",
        "framework-components": "Components repository matched",
    }
    return reasons.get(profile_id, "trusted profile rules matched")


def _excluded_profile_reason(match: dict[str, Any]) -> str:
    for reason in match["reasons"]:
        if "repository mode " in reason or reason == "requires explicit profile activation":
            return _safe_projection_text(reason)
    dependency_set_reasons = {
        "application-arc-dotnet": "no supported Arc .NET dependency was found",
        "application-arc-react": "the React and Arc.React dependency set did not match",
        "application-chronicle-dotnet": "no supported Chronicle .NET dependency was found",
        "application-chronicle-elixir": "the Chronicle Elixir client dependency was not found",
        "application-chronicle-jvm": "the Chronicle Java/Kotlin client dependency was not found",
        "application-chronicle-typescript": "the Chronicle TypeScript client dependency was not found",
        "application-cratis-components": "the React, Arc.React, and Components dependency set did not match",
    }
    if any(_dependency_reason(reason, present=False) is not None for reason in match["reasons"]):
        known_reason = dependency_set_reasons.get(match["profileId"])
        if known_reason is not None:
            return known_reason
    for reason in match["reasons"]:
        parsed = _dependency_reason(reason, present=False)
        if parsed is not None:
            return parsed
    return _safe_projection_text(match["reasons"][0] if match["reasons"] else "profile rules did not match")


def _exclusion_lines(result: dict[str, Any]) -> list[str]:
    selected_ids = {profile["id"] for profile in result["profiles"]}
    categories = (
        ("application", lambda identifier: identifier.startswith("application-")),
        ("framework", lambda identifier: identifier.startswith("framework-")),
        ("explicit", lambda identifier: not identifier.startswith(("application-", "framework-"))),
    )
    lines = []
    for category, predicate in categories:
        grouped: dict[str, list[str]] = {}
        category_has_selection = any(
            predicate(identifier) for identifier in selected_ids
        )
        for match in result["matches"]:
            identifier = match["profileId"]
            if identifier in selected_ids or not predicate(identifier):
                continue
            grouped.setdefault(_excluded_profile_reason(match), []).append(identifier)
        for reason, identifiers in grouped.items():
            identifiers_text = ", ".join(identifiers)
            if category in {"application", "framework"} and len(identifiers) > 3:
                qualifier = "remaining" if category_has_selection else "all"
                identifiers_text = f"{qualifier} {category} profiles"
            lines.append(
                f"Not selected ({category}): {identifiers_text} — {reason}."
            )
    return lines or ["Not selected: none."]


def _summary_exclusion_line(result: dict[str, Any]) -> str:
    selected_ids = {profile["id"] for profile in result["profiles"]}
    excluded_ids = {
        match["profileId"]
        for match in result["matches"]
        if match["profileId"] not in selected_ids
    }
    if not excluded_ids:
        return "Important exclusions: none."

    parts: list[str] = []
    mode = result["repositoryMode"]
    application_ids = {
        identifier for identifier in excluded_ids if identifier.startswith("application-")
    }
    framework_ids = {
        identifier for identifier in excluded_ids if identifier.startswith("framework-")
    }

    components_detected = any(
        evidence["kind"] in {"dependency", "repository-package"}
        and str(evidence["value"]).lower() == "@cratis/components"
        for evidence in result["evidence"]
    )
    if "application-cratis-components" in application_ids and components_detected:
        parts.append(
            "application-cratis-components (React + Arc.React peers missing)"
        )
        application_ids.remove("application-cratis-components")

    if application_ids:
        reason = (
            f"repository mode is {mode}"
            if mode != "application"
            else "required dependencies missing"
        )
        qualifier = "other " if parts else ""
        parts.append(f"{qualifier}application profiles ({reason})")
    if framework_ids:
        reason = (
            f"repository mode is {mode}"
            if mode != "framework"
            else "required repository evidence missing"
        )
        parts.append(f"framework profiles ({reason})")

    explicit_ids = sorted(
        identifier
        for identifier in excluded_ids
        if not identifier.startswith(("application-", "framework-"))
    )
    if explicit_ids:
        parts.append(
            f"{', '.join(explicit_ids)} (explicit activation required)"
        )
    return "Important exclusions: " + "; ".join(parts) + "."


def _resolution_projection_lines(
    envelope: dict[str, Any],
    result: dict[str, Any],
    detail_level: str,
) -> list[str]:
    matches = {match["profileId"]: match for match in result["matches"]}
    lines = [
        f"Detected surfaces: {_detected_surface_text(result)}.",
        f"Languages/UI: {_language_text(result)}.",
    ]
    if detail_level == "summary":
        if result["profiles"]:
            selections = "; ".join(
                f"{profile['id']} ({_compact_selected_profile_reason(profile['id'])})"
                for profile in result["profiles"]
            )
            lines.append(f"Selected: {selections}.")
        else:
            lines.append("Selected: none — no trusted profile rules matched.")
        lines.append(_summary_exclusion_line(result))
        if result["agents"] and result["workflows"]:
            agent = result["agents"][0]
            workflow = result["workflows"][0]
            lines.append(
                f"Route: agent {agent['id']} — {_safe_projection_text(agent['rationale'])}; "
                f"workflow {workflow['id']} — {_safe_projection_text(workflow['rationale'])}"
            )
        else:
            lines.append("Route: no agent or workflow selected.")
    else:
        if result["profiles"]:
            lines.extend(
                f"Selected profile: {profile['id']} — {_selected_profile_reason(matches.get(profile['id']))}."
                for profile in result["profiles"]
            )
        else:
            lines.append("Selected profiles: none.")
        lines.extend(_exclusion_lines(result))
        if result["agents"]:
            lines.extend(
                f"Agent: {agent['id']} — {_safe_projection_text(agent['rationale'])}"
                for agent in result["agents"]
            )
        else:
            lines.append("Agent: none selected.")
        if result["workflows"]:
            lines.extend(
                f"Workflow: {workflow['id']} — {_safe_projection_text(workflow['rationale'])}"
                for workflow in result["workflows"]
            )
        else:
            lines.append("Workflow: none selected.")
        lines.extend(
            f"Blocker: {_safe_projection_text(reason)}"
            for reason in result["blockedReasons"]
        )
    if not envelope["nextActions"] and result["workflows"]:
        lines.append(
            "Next: preflight target "
            f"{_safe_projection_text(result['targetPath'])} for purpose "
            f"{_safe_projection_text(result['purpose'])} with workflow "
            f"{_safe_projection_text(result['workflows'][0]['id'])}."
        )
    elif not envelope["nextActions"]:
        lines.append("Next: no executable route is available; inspect the blockers before continuing.")

    if detail_level in {"explain", "trace"}:
        lines.append("Complete profile match rationale:")
        for match in result["matches"]:
            outcome = "selected" if match["profileId"] in {item["id"] for item in result["profiles"]} else "excluded"
            reasons = "; ".join(_safe_projection_text(reason) for reason in match["reasons"])
            lines.append(f"  {match['profileId']} [{outcome}] — {reasons}")

    if detail_level == "trace":
        lines.append("Evidence trace:")
        for evidence in result["evidence"]:
            fields = [
                f"kind={_safe_projection_text(str(evidence['kind']))}",
                f"source={_safe_projection_text(str(evidence['source']))}",
                f"value={_safe_projection_text(str(evidence['value']))}",
            ]
            if "ecosystem" in evidence:
                fields.append(f"ecosystem={_safe_projection_text(str(evidence['ecosystem']))}")
            if "version" in evidence:
                fields.append(f"version={_safe_projection_text(str(evidence['version']))}")
            lines.append("  " + "; ".join(fields))
        lines.extend(
            f"Selected profile hash [{profile['id']}]: {profile['contentHash']}"
            for profile in result["profiles"]
        )
        lines.extend(
            f"Agent hash [{agent['id']}]: {agent['contentHash']}"
            for agent in result["agents"]
        )
        lines.extend(
            f"Workflow hash [{workflow['id']}]: {workflow['contentHash']}"
            for workflow in result["workflows"]
        )
        lines.append(f"Resolved profile hash: {result['contentHash']}")
    return lines


def _render_inspection_text(envelope: dict[str, Any], detail_level: str) -> str:
    operation_result.verify_operation_result_hash(envelope)
    lines = [
        f"Operation: {envelope['operation']}",
        f"Status: {envelope['status']}",
        envelope["summary"],
    ]
    if "result" in envelope:
        lines.extend(
            _resolution_projection_lines(envelope, envelope["result"]["value"], detail_level)
        )
    for diagnostic in envelope["diagnostics"]:
        if detail_level == "summary":
            lines.append(
                f"Blocker [{diagnostic['code']}]: {diagnostic['message']}"
            )
            continue
        lines.append(
            f"Diagnostic [{diagnostic['code']}] {diagnostic['severity']}: {diagnostic['message']}"
        )
        for location in diagnostic["locations"]:
            detail = location["reference"] + location.get("pointer", "")
            lines.append(f"  Location ({location['kind']}): {detail}")
        for evidence in diagnostic["evidence"]:
            rendered_hash = f" [{evidence['contentHash']}]" if detail_level == "trace" else ""
            lines.append(
                f"  Evidence ({evidence['classification']}): {evidence['reference']}{rendered_hash}"
            )
        retry = diagnostic["retry"]
        delay = (
            f" after {retry['retryAfterSeconds']} seconds"
            if "retryAfterSeconds" in retry
            else ""
        )
        lines.append(f"  Retry: {retry['disposition']}{delay} — {retry['reason']}")
    for action in envelope["nextActions"]:
        if detail_level == "summary":
            action_detail = ""
            if action["kind"] in {"supply-input", "select-option"}:
                action_detail = f" Input: {action['inputId']}."
            elif action["kind"] == "correct-input":
                location = action["location"]
                action_detail = (
                    f" Correct: {location['reference']}"
                    f"{location.get('pointer', '')}."
                )
            lines.append(
                f"Next [{action['id']}; {action['kind']}; {action['automation']}]: "
                f"{action['title']} — "
                f"{action['description']}{action_detail}"
            )
            continue
        lines.append(
            f"Next action [{action['id']}] ({action['kind']}, {action['automation']}): "
            f"{action['title']} — {action['description']}"
        )
        if action["kind"] in {"supply-input", "select-option"}:
            details = f"input {action['inputId']}"
            if "expected" in action:
                details += f"; expected {action['expected']}"
            lines.append(f"  {details}")
        elif action["kind"] == "correct-input":
            location = action["location"]
            lines.append(
                f"  correct {location['reference']}{location.get('pointer', '')}; "
                f"expected {action['expected']}"
            )
    lines.append(f"Side effects occurred: {'yes' if envelope['sideEffectsOccurred'] else 'no'}")
    if detail_level == "trace":
        if "result" in envelope:
            lines.append(f"Result schema: {envelope['result']['schemaId']}")
            lines.append(f"Result hash: {envelope['result']['contentHash']}")
        lines.append(f"Request hash: {envelope['requestHash']}")
        lines.append(f"Content hash: {envelope['contentHash']}")
    return "\n".join(lines) + "\n"


def _failure_envelope(request_hash: str, error: Exception) -> dict[str, Any]:
    if isinstance(error, (ResolutionFailure, validate_factory.ValidationFailure)):
        status = "invalid"
        code = "FACTORY-RESOLVE-INPUT-INVALID"
        retry_disposition = "retry-after-correction"
        retry_reason = "Correct the repository request or Factory definitions before retrying inspection."
    else:
        status = "unexpected"
        code = "FACTORY-RESOLVE-UNEXPECTED"
        retry_disposition = "not-retryable"
        retry_reason = "Inspect the diagnostic and contact a Factory maintainer."
    detail = (
        _safe_projection_text(str(error))
        if isinstance(error, (ResolutionFailure, validate_factory.ValidationFailure))
        else "An unexpected internal failure prevented Factory inspection."
    )
    diagnostic = operation_result.make_diagnostic(
        code,
        "error",
        detail or "Factory inspection failed",
        retry_disposition,
        retry_reason,
    )
    return operation_result.make_operation_result(
        "inspect",
        status,
        "Factory inspection did not produce a usable resolved profile.",
        request_hash,
        diagnostics=[diagnostic],
        side_effects_occurred=False,
    )


def main() -> int:
    parser = _OperationArgumentParser(description=__doc__)
    parser.add_argument("--repository", default=".")
    parser.add_argument("--target", default=".")
    parser.add_argument("--purpose", default="investigate")
    parser.add_argument("--format", choices=("json", "json-compact", "text"), default="text")
    parser.add_argument(
        "--detail",
        choices=DETAIL_LEVELS,
        default="summary",
        help="Text projection detail; machine formats always contain the full canonical result",
    )
    arguments = parser.parse_args()
    request_hash = _invocation_request_hash(sys.argv[1:])
    try:
        documents = {
            path: validate_factory.load_json(path)
            for path in validate_factory.all_json_files()
        }
        validation_errors = validate_factory.validate_documents(documents)
        if validation_errors:
            raise ResolutionFailure("Factory definitions are invalid: " + "; ".join(validation_errors))
        result = resolve_repository(
            Path(arguments.repository),
            arguments.target,
            arguments.purpose,
            documents,
        )
        request_hash = _resolution_request_hash(Path(arguments.repository), result)
        envelope = _resolution_envelope(result, request_hash)
    except Exception as error:
        envelope = _failure_envelope(request_hash, error)

    output = (
        _render_inspection_text(envelope, arguments.detail)
        if arguments.format == "text"
        else operation_result.render_operation_result(envelope, arguments.format)
    )
    print(output, end="")
    return operation_result.exit_code_for_status(envelope["status"])


if __name__ == "__main__":
    raise SystemExit(main())
