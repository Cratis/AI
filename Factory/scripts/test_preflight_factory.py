#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Adversarial specifications for immutable Factory preflight compilation."""

from __future__ import annotations

import argparse
from copy import deepcopy
import io
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest import mock

import canonical_json
import compile_factory
import operation_result
import preflight_factory
import resolve_factory
import validate_factory


class FactoryPreflightTests(unittest.TestCase):
    def test_request_hash_is_clone_and_output_path_independent_but_plan_bound(self) -> None:
        first = argparse.Namespace(
            repository="/private/customer-one/repository",
            target=".",
            purpose="investigate",
            workflow=None,
            policy="local-development",
            verify_plan="/private/customer-one/plan.json",
            output="/private/customer-one/result.json",
        )
        second = argparse.Namespace(
            repository="/private/customer-two/repository",
            target=".",
            purpose="investigate",
            workflow=None,
            policy="local-development",
            verify_plan="/private/customer-two/plan.json",
            output="/private/customer-two/result.json",
        )
        plan_hash = f"sha256:{'1' * 64}"

        first_hash = preflight_factory._request_hash(first, "verify", plan_hash)
        second_hash = preflight_factory._request_hash(second, "verify", plan_hash)
        changed_hash = preflight_factory._request_hash(
            second,
            "verify",
            f"sha256:{'2' * 64}",
        )

        self.assertEqual(first_hash, second_hash)
        self.assertNotEqual(first_hash, changed_hash)

    def test_exact_root_and_tracked_entry_failures_use_only_opaque_source_ids(self) -> None:
        identifying_root = Path("/private/customer-alice/repository")
        with mock.patch.object(
            preflight_factory,
            "_git",
            return_value="/private/customer-alice",
        ):
            with self.assertRaises(preflight_factory.PreflightFailure) as root_context:
                preflight_factory._capture_git_state(identifying_root)
        self.assertNotIn("customer-alice", str(root_context.exception))

        private_path = "customers/alice@example.invalid/profile.json"
        special_record = f"h {private_path}\0"
        with mock.patch.object(preflight_factory, "_git", return_value=special_record):
            special = preflight_factory._special_index_entries(Path("."))
        self.assertEqual(("repository-path:000001",), special)
        self.assertNotIn("alice", str(special))

        tree_record = (
            f"120000 blob {'0' * 40}\t{private_path}\0".encode("utf-8")
        )
        with mock.patch.object(preflight_factory, "_git_bytes", return_value=tree_record):
            with self.assertRaises(preflight_factory.PreflightFailure) as tree_context:
                preflight_factory._tracked_files(Path("."), "0" * 40)
        tree_error = str(tree_context.exception)
        self.assertIn("repository-path:000001", tree_error)
        self.assertNotIn("alice", tree_error)
        self.assertNotIn("example.invalid", tree_error)

    def test_archive_and_unexpected_failures_are_path_opaque_in_text_and_json(self) -> None:
        private_path = "customers/alice@example.invalid/profile.json"
        archive_buffer = io.BytesIO()
        with tarfile.open(fileobj=archive_buffer, mode="w:") as archive:
            member = tarfile.TarInfo(private_path)
            member.size = 1
            archive.addfile(member, io.BytesIO(b"x"))

        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaises(preflight_factory.PreflightFailure) as archive_context:
                preflight_factory._extract_tracked_archive(
                    archive_buffer.getvalue(),
                    Path(temporary_directory),
                    {},
                )

        self.assertEqual(
            "Materialized repository archive contains untracked file repository-path:000001",
            str(archive_context.exception),
        )
        request_hash = f"sha256:{'1' * 64}"
        archive_envelope = preflight_factory._failure_envelope(
            "preflight",
            request_hash,
            archive_context.exception,
        )
        unexpected_envelope = preflight_factory._failure_envelope(
            "preflight",
            request_hash,
            OSError(2, "not found", "/private/customer-alice/secret.txt"),
        )
        for envelope in (archive_envelope, unexpected_envelope):
            for output_format in ("text", "json-compact"):
                rendered = operation_result.render_operation_result(envelope, output_format)
                self.assertNotIn("alice", rendered)
                self.assertNotIn("example.invalid", rendered)
                self.assertNotIn("secret.txt", rendered)
                self.assertNotIn("/private", rendered)
        self.assertEqual(
            "A filesystem operation failed without exposing path details",
            unexpected_envelope["diagnostics"][0]["message"],
        )

    def test_composed_resolution_and_mode_aware_agents_are_immutably_bound(self) -> None:
        documents = load_documents()
        resolved_profile = resolve_golden(documents)

        compiled = compile_resolved(documents, resolved_profile)

        self.assertEqual(
            {
                "application-arc-dotnet",
                "application-arc-react",
                "application-chronicle-dotnet",
                "application-cratis-components",
            },
            {reference["id"] for reference in compiled["repositoryBinding"]["resolvedProfile"]["profiles"]},
        )
        self.assertEqual(resolved_profile, compiled["repositoryBinding"]["resolvedProfile"])
        agent_phases = {
            phase["id"]: phase["execution"]
            for phase in compiled["orderedPhases"]
            if phase["execution"]["kind"] == "agent"
        }
        self.assertEqual("repository-investigator", agent_phases["investigate"]["id"])
        self.assertEqual("repository-investigation-reviewer", agent_phases["review"]["id"])
        self.assertNotEqual(
            agent_phases["investigate"]["contentHash"],
            agent_phases["review"]["contentHash"],
        )
        self.assertTrue(agent_phases["review"]["selectedFromProfiles"])

    def test_preflight_inputs_cannot_be_replaced_by_run_request(self) -> None:
        documents = load_documents()
        compiled = compile_resolved(documents, resolve_golden(documents))
        inputs = {item["id"]: item["binding"] for item in compiled["workflowInputs"]}

        self.assertEqual({"kind": "request"}, inputs["objective"])
        self.assertEqual("preflight", inputs["repository-snapshot"]["kind"])
        self.assertEqual("repository-snapshot", inputs["repository-snapshot"]["value"])
        self.assertEqual(
            compiled["repositoryBinding"]["repositorySnapshot"]["contentHash"],
            inputs["repository-snapshot"]["contentHash"],
        )
        self.assertEqual("preflight", inputs["resolved-profile"]["kind"])
        self.assertEqual(
            compiled["repositoryBinding"]["resolvedProfile"]["contentHash"],
            inputs["resolved-profile"]["contentHash"],
        )

    def test_project_policy_denial_is_applied_before_capability_grants(self) -> None:
        documents = load_documents()

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_resolved(
                documents,
                resolve_golden(documents),
                denied_capabilities=["run-quality-gates"],
            )

        self.assertTrue(any("resolves to deny" in error for error in context.exception.errors))

    def test_agent_capability_and_exact_grant_are_bound_and_tampering_fails_integrity(self) -> None:
        documents = load_documents()
        compiled = compile_resolved(documents, resolve_golden(documents))
        investigation = next(
            phase for phase in compiled["orderedPhases"] if phase["id"] == "investigate"
        )
        self.assertEqual("read-repository", investigation["execution"]["capability"])
        self.assertIn(
            {
                "id": "read-repository",
                "usage": "agent",
                "sourceId": "investigate",
                "effect": "read",
                "policyCapability": "read-repository",
                "decision": "allow",
            },
            investigation["capabilities"],
        )

        for label, mutate in (
            (
                "declaration",
                lambda phase: phase["execution"].pop("capability"),
            ),
            (
                "grant",
                lambda phase: phase["capabilities"].__setitem__(
                    slice(None),
                    [grant for grant in phase["capabilities"] if grant["usage"] != "agent"],
                ),
            ),
        ):
            with self.subTest(binding=label):
                tampered = deepcopy(compiled)
                tampered_phase = next(
                    phase
                    for phase in tampered["orderedPhases"]
                    if phase["id"] == "investigate"
                )
                mutate(tampered_phase)
                tampered["contentHash"] = canonical_json.content_hash(
                    {key: value for key, value in tampered.items() if key != "contentHash"}
                )
                with self.assertRaises(compile_factory.CompilationFailure):
                    compile_factory.verify_compiled_workflow(tampered, documents)

    def test_non_empty_phase_scopes_stay_blocked_without_a_trusted_policy_evaluator(self) -> None:
        documents = load_documents()
        workflow = documents[
            validate_factory.ROOT / "Workflows" / "investigate-cratis-issue.factory.json"
        ]
        investigation = next(phase for phase in workflow["phases"] if phase["id"] == "investigate")
        investigation["policy"]["networkScopes"] = ["api.example.invalid"]
        resolved_profile = resolve_golden(documents)

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_resolved(documents, resolved_profile)

        self.assertTrue(any("scope-to-capability policy evaluator" in error for error in context.exception.errors))

    def test_tampered_nested_resolution_hash_is_rejected(self) -> None:
        documents = load_documents()
        resolved_profile = resolve_golden(documents)
        resolved_profile["targetPath"] = "changed"

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_resolved(documents, resolved_profile)

        self.assertTrue(any("Resolved profile content hash mismatch" in error for error in context.exception.errors))

    def test_dirty_snapshot_is_rejected_even_when_self_hash_is_valid(self) -> None:
        documents = load_documents()
        resolved_profile = resolve_golden(documents)
        snapshot = repository_snapshot(resolved_profile)
        snapshot["dirty"] = True
        snapshot["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in snapshot.items() if key != "contentHash"}
        )

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_factory.compile_documents(
                documents,
                "investigate-cratis-issue",
                resolved_profile,
                snapshot,
                "local-development",
            )

        self.assertTrue(any("Dirty repository snapshots" in error for error in context.exception.errors))

    def test_recomputed_outer_hash_does_not_authorize_semantic_plan_tampering(self) -> None:
        documents = load_documents()
        compiled = compile_resolved(documents, resolve_golden(documents))
        review = next(phase for phase in compiled["orderedPhases"] if phase["id"] == "review")
        review["execution"]["id"] = "repository-investigator"
        review["execution"]["contentHash"] = canonical_json.bytes_content_hash(
            (validate_factory.ROOT / ".ai" / "agents" / "repository-investigator.md").read_bytes()
        )
        compiled["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in compiled.items() if key != "contentHash"}
        )

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_factory.verify_compiled_workflow(compiled, documents)

        self.assertTrue(any("deterministic recompilation" in error for error in context.exception.errors))

    def test_rehashed_stale_workflow_reference_is_rejected(self) -> None:
        documents = load_documents()
        resolved_profile = resolve_golden(documents)
        resolved_profile["workflows"][0]["contentHash"] = f"sha256:{'0' * 64}"
        resolved_profile["contentHash"] = canonical_json.content_hash(
            {key: value for key, value in resolved_profile.items() if key != "contentHash"}
        )

        with self.assertRaises(compile_factory.CompilationFailure):
            compile_resolved(documents, resolved_profile)

    def test_selected_profile_exclusion_conflict_fails_closed(self) -> None:
        documents = load_documents()
        arc_profile = documents[
            validate_factory.ROOT / "Factory" / "Profiles" / "application-arc-dotnet.profile.json"
        ]
        arc_profile["excludes"] = ["application-arc-react"]
        resolved_profile = resolve_golden(documents)

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_resolved(documents, resolved_profile)

        self.assertTrue(any("excludes application-arc-react" in error for error in context.exception.errors))

    def test_missing_exact_phase_purpose_agent_fails_without_fallback(self) -> None:
        documents = load_documents()
        for document in documents.values():
            if document.get("documentKind") != "profile":
                continue
            document["recommendations"]["agents"] = [
                recommendation
                for recommendation in document["recommendations"]["agents"]
                if "review" not in recommendation["purposes"]
            ]
        resolved_profile = resolve_golden(documents)

        with self.assertRaises(compile_factory.CompilationFailure) as context:
            compile_resolved(documents, resolved_profile)

        self.assertTrue(any("no agent recommendation for purpose review" in error for error in context.exception.errors))

    def test_atomic_preflight_accepts_a_clean_exact_git_root(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            with mock.patch.object(
                resolve_factory,
                "_load_project_manifest",
                wraps=resolve_factory._load_project_manifest,
            ) as load_manifest:
                compiled = preflight_factory.preflight_repository(
                    documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )

            self.assertEqual(1, load_manifest.call_count)

        compile_factory.verify_compiled_workflow(compiled, documents)
        self.assertFalse(compiled["repositoryBinding"]["repositorySnapshot"]["dirty"])

    def test_atomic_preflight_rejects_dirty_inputs(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / "untracked.txt").write_text("untracked", encoding="utf-8")
            with self.assertRaises(preflight_factory.PreflightFailure) as dirty_context:
                preflight_factory.preflight_repository(
                    documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )
            self.assertIn("clean tracked and untracked worktree", str(dirty_context.exception))

    def test_valid_manifest_can_only_narrow_policy_and_pin_workflow(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            manifest_directory = repository / ".cratis"
            manifest_directory.mkdir()
            manifest = {
                "$schema": "https://schemas.cratis.io/factory/v1/project-manifest.schema.json",
                "schemaVersion": "1",
                "documentKind": "project-manifest",
                "repositoryMode": "application",
                "profiles": {
                    "include": ["cratis-dotnet-react"],
                    "exclude": [],
                },
                "workflows": {
                    "investigate-cratis-issue": "1.0.0",
                },
                "policy": {
                    "id": "local-development",
                    "denyCapabilities": ["create-pull-request"],
                },
            }
            manifest_path = manifest_directory / "factory.json"
            manifest_path.write_text(canonical_json.canonical_json(manifest), encoding="utf-8")
            run_git(repository, ["add", ".cratis/factory.json"])
            run_git(
                repository,
                [
                    "-c",
                    "user.name=Factory Test",
                    "-c",
                    "user.email=factory-test@example.invalid",
                    "commit",
                    "--quiet",
                    "-m",
                    "manifest",
                ],
            )

            with mock.patch.object(
                resolve_factory,
                "_load_project_manifest",
                wraps=resolve_factory._load_project_manifest,
            ) as load_manifest:
                compiled = preflight_factory.preflight_repository(
                    documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )

            self.assertEqual(1, load_manifest.call_count)

        self.assertEqual(
            ["create-pull-request"],
            compiled["effectivePolicy"]["deniedCapabilities"],
        )
        self.assertEqual(
            canonical_json.content_hash(manifest),
            compiled["effectivePolicy"]["projectManifestHash"],
        )
        manifest_evidence = next(
            item
            for item in compiled["repositoryBinding"]["resolvedProfile"]["evidence"]
            if item["kind"] == "manifest"
        )
        self.assertEqual(
            compiled["effectivePolicy"]["projectManifestHash"],
            manifest_evidence["value"],
        )


def load_documents() -> dict[Path, dict]:
    return {
        path: deepcopy(validate_factory.load_json(path))
        for path in validate_factory.all_json_files()
    }


def resolve_golden(documents: dict[Path, dict]) -> dict:
    repository = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
    return resolve_factory.resolve_repository(repository, ".", "investigate", documents)


def repository_snapshot(resolved_profile: dict) -> dict:
    snapshot = {
        "protocolVersion": "1",
        "repository": "preflight-unit-fixture",
        "revision": "1" * 40,
        "targetPath": resolved_profile["targetPath"],
        "dirty": False,
    }
    snapshot["contentHash"] = canonical_json.content_hash(snapshot)
    return snapshot


def compile_resolved(
    documents: dict[Path, dict],
    resolved_profile: dict,
    denied_capabilities: list[str] | None = None,
) -> dict:
    return compile_factory.compile_documents(
        documents,
        "investigate-cratis-issue",
        resolved_profile,
        repository_snapshot(resolved_profile),
        "local-development",
        denied_capabilities,
    )


class clean_golden_repository:
    """Context manager that prepares a clean temporary Git copy of the golden fixture."""

    def __init__(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.path = Path(self._temporary_directory.name) / "repository"

    def __enter__(self) -> Path:
        source = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        shutil.copytree(source, self.path)
        run_git(self.path, ["init", "--quiet"])
        run_git(self.path, ["add", "."])
        run_git(
            self.path,
            [
                "-c",
                "user.name=Factory Test",
                "-c",
                "user.email=factory-test@example.invalid",
                "commit",
                "--quiet",
                "-m",
                "fixture",
            ],
        )
        return self.path

    def __exit__(self, exception_type, exception, traceback) -> None:
        self._temporary_directory.cleanup()


def run_git(repository: Path, arguments: list[str]) -> None:
    subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )


if __name__ == "__main__":
    unittest.main()
