#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Adversarial specifications for repository-authoritative Factory preflight."""

from __future__ import annotations

from copy import deepcopy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import canonical_json
import compile_factory
import operation_result
import preflight_factory
import resolve_factory
import validate_factory


class FactoryPreflightAuthorityTests(unittest.TestCase):
    def test_current_repository_authority_accepts_the_exact_preflight_plan(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            compiled = preflight(repository, documents)

            preflight_factory.verify_preflight_authority(
                compiled,
                documents,
                repository,
                ".",
                "investigate",
                None,
                "local-development",
            )

    def test_manifest_denial_cannot_be_removed_and_rehashed_under_authority_verification(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            commit_manifest(repository, ["create-pull-request"])
            compiled = preflight(repository, documents)
            compiled["effectivePolicy"]["deniedCapabilities"] = []
            rehash(compiled["effectivePolicy"])
            rehash(compiled)

            compile_factory.verify_compiled_workflow_integrity(compiled, documents)
            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight_factory.verify_preflight_authority(
                    compiled,
                    documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )

        self.assertIn("does not match authoritative preflight", str(context.exception))

    def test_invented_revision_target_and_mode_can_have_integrity_but_not_authority(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            compiled = preflight(repository, documents)
            snapshot = compiled["repositoryBinding"]["repositorySnapshot"]
            resolution = compiled["repositoryBinding"]["resolvedProfile"]
            snapshot["revision"] = "0" * 40
            snapshot["targetPath"] = "invented"
            resolution["targetPath"] = "invented"
            resolution["repositoryMode"] = "framework"
            rehash(snapshot)
            rehash(resolution)
            bindings = {
                item["id"]: item["binding"] for item in compiled["workflowInputs"]
            }
            bindings["repository-snapshot"]["contentHash"] = snapshot["contentHash"]
            bindings["resolved-profile"]["contentHash"] = resolution["contentHash"]
            rehash(compiled)

            compile_factory.verify_compiled_workflow_integrity(compiled, documents)
            with self.assertRaises(preflight_factory.PreflightFailure):
                preflight_factory.verify_preflight_authority(
                    compiled,
                    documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )

    def test_assume_unchanged_tracked_input_is_rejected_even_when_status_is_clean(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            run_git(repository, ["update-index", "--assume-unchanged", "package.json"])
            (repository / "package.json").write_text("{}\n", encoding="utf-8")
            self.assertEqual("", git_output(repository, ["status", "--porcelain=v1"]))

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("assume-unchanged", str(context.exception))

    def test_fake_path_git_cannot_intercept_preflight_authority(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            fake_bin = repository.parent / "fake-bin"
            fake_bin.mkdir()
            marker = repository.parent / "fake-git-invoked"
            fake_git = fake_bin / "git"
            fake_git.write_text(
                f"#!/bin/sh\n: > '{marker}'\nexit 98\n",
                encoding="utf-8",
            )
            fake_git.chmod(0o755)

            with mock.patch.dict(os.environ, {"PATH": str(fake_bin)}, clear=False):
                compiled = preflight(repository, documents)

        self.assertEqual("compiled-workflow", compiled["documentKind"])
        self.assertFalse(marker.exists())

    def test_executable_core_fsmonitor_is_never_invoked_by_preflight(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            marker = repository.parent / "fsmonitor-invoked"
            monitor = repository.parent / "hostile-fsmonitor"
            monitor.write_text(
                f"#!/bin/sh\n: > '{marker}'\nexit 0\n",
                encoding="utf-8",
            )
            monitor.chmod(0o755)
            run_git(repository, ["config", "core.fsmonitor", str(monitor)])

            compiled = preflight(repository, documents)

        self.assertEqual("compiled-workflow", compiled["documentKind"])
        self.assertFalse(marker.exists())

    def test_local_clean_filter_config_is_not_executed_by_read_only_preflight(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / ".gitattributes").write_text(
                "package.json filter=hostile\n",
                encoding="utf-8",
            )
            commit_all(repository, "declare inert filter attribute")
            marker = repository.parent / "clean-filter-invoked"
            clean_filter = repository.parent / "hostile-clean-filter"
            clean_filter.write_text(
                f"#!/bin/sh\n: > '{marker}'\ncat\n",
                encoding="utf-8",
            )
            clean_filter.chmod(0o755)
            run_git(
                repository,
                ["config", "filter.hostile.clean", str(clean_filter)],
            )

            compiled = preflight(repository, documents)

        self.assertEqual("compiled-workflow", compiled["documentKind"])
        self.assertFalse(marker.exists())

    def test_url_instead_of_cannot_forge_a_canonical_cratis_identity(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            run_git(
                repository,
                ["remote", "add", "origin", "https://mirror.invalid/Arc.git"],
            )
            run_git(
                repository,
                [
                    "config",
                    "url.https://github.com/Cratis/.insteadOf",
                    "https://mirror.invalid/",
                ],
            )
            self.assertEqual(
                "https://github.com/Cratis/Arc.git",
                git_output(repository, ["remote", "get-url", "origin"]),
            )

            compiled = preflight(repository, documents)

        resolved = compiled["repositoryBinding"]["resolvedProfile"]
        self.assertIsNone(resolved["repositoryIdentity"])
        self.assertEqual("unidentified-git-repository", compiled["repositoryBinding"]["repositorySnapshot"]["repository"])

    def test_included_local_config_cannot_supply_authority_bearing_remote_identity(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            included = repository.parent / "hostile-include.gitconfig"
            included.write_text(
                '[remote "origin"]\n\turl = https://github.com/Cratis/Arc.git\n',
                encoding="utf-8",
            )
            run_git(repository, ["config", "include.path", str(included)])
            self.assertEqual(
                "https://github.com/Cratis/Arc.git",
                git_output(repository, ["remote", "get-url", "origin"]),
            )

            resolved = resolve_factory.resolve_repository(
                repository,
                ".",
                "investigate",
                documents,
            )
            process = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertIsNone(resolved["repositoryIdentity"])
        self.assertIn(resolve_factory.GIT_CONFIG_INCLUDE_WARNING, resolved["warnings"])
        self.assertIn(resolve_factory.GIT_CONFIG_INCLUDE_BLOCKER, resolved["blockedReasons"])
        self.assertEqual(operation_result.exit_code_for_status("blocked"), process.returncode)
        self.assertEqual("", process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("blocked", envelope["status"])
        self.assertEqual(
            "FACTORY-PREFLIGHT-GIT-CONFIG-BLOCKED",
            envelope["diagnostics"][0]["code"],
        )
        self.assertEqual(
            ["remove-repository-git-includes"],
            [action["id"] for action in envelope["nextActions"]],
        )
        self.assertFalse(envelope["sideEffectsOccurred"])
        operation_result.verify_operation_result_hash(envelope)

    def test_included_partial_clone_and_promisor_config_is_rejected_before_object_access(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            helper_marker = repository.parent / "included-remote-helper-invoked"
            remote_helper = repository.parent / "git-remote-hostile"
            remote_helper.write_text(
                f"#!/bin/sh\n: > '{helper_marker}'\nexit 97\n",
                encoding="utf-8",
            )
            remote_helper.chmod(0o755)
            included = repository.parent / "partial-clone.gitconfig"
            included.write_text(
                "[extensions]\n"
                "\tpartialClone = origin\n"
                "[remote \"origin\"]\n"
                f"\turl = ext::{remote_helper}\n"
                "\tpromisor = true\n"
                "\tpartialCloneFilter = blob:none\n",
                encoding="utf-8",
            )
            run_git(repository, ["config", "include.path", str(included)])

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("include/includeIf", str(context.exception))
        self.assertFalse(helper_marker.exists())

    def test_included_helper_like_config_cannot_execute_during_authority_capture(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            marker = repository.parent / "included-helper-invoked"
            helper = repository.parent / "hostile-git-helper"
            helper.write_text(
                f"#!/bin/sh\n: > '{marker}'\nexit 97\n",
                encoding="utf-8",
            )
            helper.chmod(0o755)
            included = repository.parent / "helpers.gitconfig"
            included.write_text(
                "[core]\n"
                f"\tfsmonitor = {helper}\n"
                f"\thooksPath = {helper}\n"
                "[credential]\n"
                f"\thelper = !{helper}\n"
                "[filter \"hostile\"]\n"
                f"\tclean = {helper}\n"
                "[maintenance]\n"
                "\tauto = true\n"
                "[tar \"hostile\"]\n"
                f"\tcommand = {helper}\n",
                encoding="utf-8",
            )
            run_git(
                repository,
                ["config", "includeIf.onbranch:main.path", str(included)],
            )

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("include/includeIf", str(context.exception))
        self.assertFalse(marker.exists())

    def test_partial_clone_configuration_is_rejected_before_object_access(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            run_git(repository, ["config", "extensions.partialClone", "origin"])

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("partial-clone", str(context.exception))

    def test_stale_stat_cache_cannot_hide_modified_tracked_content(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            package = repository / "package.json"
            metadata = package.stat()
            original = package.read_bytes()
            modified = original.replace(b"21.14.3", b"99.99.9")
            self.assertEqual(len(original), len(modified))
            self.assertNotEqual(original, modified)
            run_git(repository, ["config", "core.trustctime", "false"])
            package.write_bytes(modified)
            os.utime(
                package,
                ns=(metadata.st_atime_ns, metadata.st_mtime_ns),
            )
            self.assertEqual("", git_output(repository, ["status", "--porcelain=v1"]))

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("content differs from HEAD", str(context.exception))

    def test_read_only_preflight_does_not_refresh_or_lock_the_source_index(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            index = repository / ".git" / "index"
            config = repository / ".git" / "config"
            before_content = index.read_bytes()
            before_metadata = index.stat()
            before_config_content = config.read_bytes()
            before_config_metadata = config.stat()

            preflight(repository, documents)

            after_metadata = index.stat()
            after_content = index.read_bytes()
            after_config_metadata = config.stat()
            after_config_content = config.read_bytes()

        self.assertEqual(before_content, after_content)
        self.assertEqual(before_metadata.st_ino, after_metadata.st_ino)
        self.assertEqual(before_metadata.st_mtime_ns, after_metadata.st_mtime_ns)
        self.assertEqual(before_config_content, after_config_content)
        self.assertEqual(before_config_metadata.st_ino, after_config_metadata.st_ino)
        self.assertEqual(
            before_config_metadata.st_mtime_ns,
            after_config_metadata.st_mtime_ns,
        )

    def test_ignored_untracked_files_cannot_become_resolution_evidence(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / ".gitignore").write_text("ignored/\n", encoding="utf-8")
            commit_all(repository, "ignore adversarial evidence")
            expected = preflight(repository, documents)
            ignored = repository / "ignored"
            ignored.mkdir()
            (ignored / "package.json").write_text(
                '{"dependencies":{"@cratis/chronicle":"999.0.0"}}\n',
                encoding="utf-8",
            )
            self.assertEqual("", git_output(repository, ["status", "--porcelain=v1"]))

            actual = preflight(repository, documents)

        self.assertEqual(expected, actual)

    def test_mutation_after_resolution_capture_is_detected_by_final_capture(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            original = preflight_factory._capture_git_state
            calls = 0

            def capture_and_mutate(root: Path):
                nonlocal calls
                calls += 1
                state = original(root)
                if calls == 2:
                    (root / "late-mutation.txt").write_text("changed", encoding="utf-8")
                return state

            with mock.patch.object(
                preflight_factory,
                "_capture_git_state",
                side_effect=capture_and_mutate,
            ):
                with self.assertRaises(preflight_factory.PreflightFailure):
                    preflight(repository, documents)

            self.assertEqual(3, calls)

    def test_tracked_symbolic_link_is_not_materialized_for_executable_preflight(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / "linked-package.json").symlink_to("package.json")
            commit_all(repository, "tracked symbolic link")

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("only regular non-linked files", str(context.exception))

    def test_export_ignore_cannot_hide_a_tracked_file_from_materialized_evidence(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / "hidden-evidence.json").write_text("{}\n", encoding="utf-8")
            (repository / ".gitattributes").write_text(
                "hidden-evidence.json export-ignore\n",
                encoding="utf-8",
            )
            commit_all(repository, "export ignored tracked evidence")

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("omitted committed files", str(context.exception))

    def test_export_substitution_cannot_change_a_tracked_blob_during_materialization(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            (repository / "substituted.txt").write_text("$Format:%H$\n", encoding="utf-8")
            (repository / ".gitattributes").write_text(
                "substituted.txt export-subst\n",
                encoding="utf-8",
            )
            commit_all(repository, "export substituted tracked evidence")

            with self.assertRaises(preflight_factory.PreflightFailure) as context:
                preflight(repository, documents)

        self.assertIn("content changed during materialization", str(context.exception))

    def test_git_replacement_objects_cannot_change_revision_materialization(self) -> None:
        documents = load_documents()
        with clean_golden_repository() as repository:
            repository = repository.resolve()
            original_revision = git_output(repository, ["rev-parse", "HEAD"])
            original_package = (repository / "package.json").read_bytes()
            (repository / "package.json").write_text(
                '{"name":"replacement-without-cratis"}\n',
                encoding="utf-8",
            )
            (repository / "App.csproj").write_text(
                '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
                encoding="utf-8",
            )
            commit_all(repository, "replacement commit")
            replacement_revision = git_output(repository, ["rev-parse", "HEAD"])
            run_git(repository, ["switch", "--detach", original_revision])
            run_git(repository, ["replace", original_revision, replacement_revision])

            state = preflight_factory._capture_git_state(repository)
            with preflight_factory._materialized_repository(repository, state) as materialized:
                materialized_package = (materialized / "package.json").read_bytes()
            compiled = preflight(repository, documents)

        self.assertEqual(original_revision, state.revision)
        self.assertEqual(original_package, materialized_package)
        self.assertEqual(
            original_revision,
            compiled["repositoryBinding"]["repositorySnapshot"]["revision"],
        )

    def test_output_hardlink_to_tracked_source_is_atomically_replaced_without_source_write(self) -> None:
        with clean_golden_repository() as repository:
            source = repository / "package.json"
            source_bytes = source.read_bytes()
            output_path = repository.parent / "preflight-hardlink.json"
            os.link(source, output_path)
            self.assertEqual(source.stat().st_ino, output_path.stat().st_ino)

            process = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                    "--output",
                    str(output_path),
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

            self.assertEqual(0, process.returncode, process.stderr)
            self.assertEqual("", process.stdout)
            self.assertEqual(source_bytes, source.read_bytes())
            self.assertNotEqual(source.stat().st_ino, output_path.stat().st_ino)
            self.assertEqual("", git_output(repository, ["status", "--porcelain=v1"]))
            envelope = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual("success", envelope["status"])
        operation_result.verify_operation_result_hash(envelope)

    def test_output_parent_swap_to_repository_symlink_fails_before_publication(self) -> None:
        with clean_golden_repository() as repository:
            output_parent = repository.parent / "publish"
            output_parent.mkdir()
            destination = preflight_factory._validate_output_path(
                repository,
                str(output_parent / "preflight.json"),
            )
            self.assertIsNotNone(destination)
            moved_parent = repository.parent / "original-publish"
            output_parent.rename(moved_parent)
            output_parent.symlink_to(repository, target_is_directory=True)

            with self.assertRaisesRegex(
                preflight_factory.PreflightFailure,
                "changed or contains a symbolic link",
            ):
                preflight_factory._write_output_safely(destination, "outside only")

            self.assertFalse((repository / "preflight.json").exists())
            self.assertEqual("", git_output(repository, ["status", "--porcelain=v1"]))

    def test_json_compact_failure_is_a_typed_operation_result_with_stable_exit_code(self) -> None:
        with clean_golden_repository() as repository:
            output_path = repository / "compiled.json"
            process = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                    "--output",
                    str(output_path),
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
            self.assertFalse(output_path.exists())

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("", process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("operation-result", envelope["documentKind"])
        self.assertEqual("preflight", envelope["operation"])
        self.assertEqual("invalid", envelope["status"])
        self.assertEqual("FACTORY-PREFLIGHT-INPUT-INVALID", envelope["diagnostics"][0]["code"])
        operation_result.verify_operation_result_hash(envelope)

    def test_json_compact_invocation_failure_uses_the_operation_contract(self) -> None:
        process = subprocess.run(
            [
                sys.executable,
                str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                "--unknown-option",
                "--format",
                "json-compact",
            ],
            cwd=validate_factory.ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )

        self.assertEqual(operation_result.exit_code_for_status("invocation-error"), process.returncode)
        self.assertEqual("", process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("invocation-error", envelope["status"])
        self.assertEqual(
            "FACTORY-PREFLIGHT-INVOCATION-INVALID",
            envelope["diagnostics"][0]["code"],
        )
        operation_result.verify_operation_result_hash(envelope)

    def test_json_compact_success_wraps_the_compiled_plan_as_a_typed_result(self) -> None:
        with clean_golden_repository() as repository:
            process = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(0, process.returncode, process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("success", envelope["status"])
        self.assertFalse(envelope["sideEffectsOccurred"])
        self.assertEqual(preflight_factory.COMPILED_WORKFLOW_SCHEMA, envelope["result"]["schemaId"])
        self.assertEqual("compiled-workflow", envelope["result"]["value"]["documentKind"])
        operation_result.verify_operation_result_hash(envelope)

    def test_text_preflight_and_verify_expose_execution_control_facts(self) -> None:
        with clean_golden_repository() as repository:
            result_path = repository.parent / "preflight-result.json"
            create = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                    "--output",
                    str(result_path),
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
            envelope = json.loads(result_path.read_text(encoding="utf-8"))
            compiled = envelope["result"]["value"]
            preflight_text = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "text",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
            verify_text = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--verify-plan",
                    str(result_path),
                    "--format",
                    "text",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(0, create.returncode, create.stderr)
        self.assertEqual(0, preflight_text.returncode, preflight_text.stderr)
        self.assertEqual(0, verify_text.returncode, verify_text.stderr)
        snapshot = compiled["repositoryBinding"]["repositorySnapshot"]
        workflow = compiled["workflow"]
        for text_projection in (preflight_text.stdout, verify_text.stdout):
            self.assertIn(snapshot["revision"], text_projection)
            self.assertIn(f"target [{snapshot['targetPath']}]", text_projection)
            self.assertIn(f"Workflow: {workflow['id']} v{workflow['version']}", text_projection)
            self.assertIn("Scopes: write none; network none; secret none.", text_projection)
            for phase in compiled["orderedPhases"]:
                self.assertIn(f"{phase['ordinal']} {phase['id']}", text_projection)
                self.assertIn(
                    f"{phase['id']} {phase['policy']['timeoutSeconds']}s/"
                    f"{phase['policy']['maxAttempts']} attempt",
                    text_projection,
                )
                if phase["execution"]["kind"] == "agent":
                    self.assertIn(
                        f"{phase['id']} -> {phase['execution']['id']}",
                        text_projection,
                    )
            for gate_id in compiled["requiredGateIds"]:
                self.assertIn(gate_id, text_projection)
            self.assertIn("accept-intent -> intent-accepted", text_projection)
            self.assertIn("accept-result -> result-accepted", text_projection)
            self.assertIn(
                "Next legal action: obtain human approval intent-accepted for phase accept-intent",
                text_projection,
            )

    def test_tampered_preflight_envelope_is_an_integrity_error_with_correction_action(self) -> None:
        with clean_golden_repository() as repository:
            result_path = repository.parent / "preflight-result.json"
            create = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                    "--output",
                    str(result_path),
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
            tampered = json.loads(result_path.read_text(encoding="utf-8"))
            tampered["summary"] = "tampered"
            tampered_path = repository.parent / "tampered-result.json"
            tampered_path.write_text(json.dumps(tampered), encoding="utf-8")
            verify = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--verify-plan",
                    str(tampered_path),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(0, create.returncode, create.stderr)
        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), verify.returncode)
        self.assertEqual("", verify.stderr)
        envelope = json.loads(verify.stdout)
        self.assertEqual("integrity-error", envelope["status"])
        self.assertEqual(
            "FACTORY-PREFLIGHT-VERIFY-INTEGRITY",
            envelope["diagnostics"][0]["code"],
        )
        self.assertEqual(
            "supply-untampered-preflight-plan",
            envelope["nextActions"][0]["id"],
        )
        self.assertEqual("correct-input", envelope["nextActions"][0]["kind"])
        self.assertEqual("--verify-plan", envelope["nextActions"][0]["location"]["reference"])
        operation_result.verify_operation_result_hash(envelope)

    def test_tampered_bare_compiled_plan_is_an_integrity_error(self) -> None:
        with clean_golden_repository() as repository:
            compiled = preflight(repository, load_documents())
            compiled["workflow"]["id"] = "tampered-workflow"
            tampered_path = repository.parent / "tampered-compiled-plan.json"
            tampered_path.write_text(json.dumps(compiled), encoding="utf-8")
            verify = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--verify-plan",
                    str(tampered_path),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), verify.returncode)
        self.assertEqual("", verify.stderr)
        envelope = json.loads(verify.stdout)
        self.assertEqual("integrity-error", envelope["status"])
        self.assertEqual(
            "FACTORY-PREFLIGHT-VERIFY-INTEGRITY",
            envelope["diagnostics"][0]["code"],
        )
        operation_result.verify_operation_result_hash(envelope)

    def test_preflight_operation_result_can_be_authoritatively_verified_by_the_cli(self) -> None:
        with clean_golden_repository() as repository:
            result_path = repository.parent / "preflight-result.json"
            create = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--format",
                    "json-compact",
                    "--output",
                    str(result_path),
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
            verify = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--verify-plan",
                    str(result_path),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(0, create.returncode, create.stderr)
        self.assertEqual(0, verify.returncode, verify.stderr)
        envelope = json.loads(verify.stdout)
        self.assertEqual("verify", envelope["operation"])
        self.assertEqual("success", envelope["status"])
        operation_result.verify_operation_result_hash(envelope)

    def test_external_non_object_verify_plan_is_a_typed_machine_failure(self) -> None:
        with clean_golden_repository() as repository:
            identifying_directory = repository.parent / "customer-secret-plans"
            identifying_directory.mkdir()
            invalid_plan = identifying_directory / "invalid-plan.json"
            invalid_plan.write_text("[]", encoding="utf-8")
            process = subprocess.run(
                [
                    sys.executable,
                    str(validate_factory.ROOT / "Factory" / "scripts" / "preflight_factory.py"),
                    "--repository",
                    str(repository),
                    "--verify-plan",
                    str(invalid_plan),
                    "--format",
                    "json-compact",
                ],
                cwd=validate_factory.ROOT,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertNotIn("Traceback", process.stdout)
        self.assertNotIn("customer-secret-plans", process.stdout)
        envelope = json.loads(process.stdout)
        self.assertEqual("verify", envelope["operation"])
        self.assertEqual("invalid", envelope["status"])
        self.assertEqual(
            "FACTORY-PREFLIGHT-DEFINITION-INVALID",
            envelope["diagnostics"][0]["code"],
        )
        self.assertIn("external-json-document", envelope["diagnostics"][0]["message"])
        operation_result.verify_operation_result_hash(envelope)


def load_documents() -> dict[Path, dict]:
    return {
        path: deepcopy(validate_factory.load_json(path))
        for path in validate_factory.all_json_files()
    }


def preflight(repository: Path, documents: dict[Path, dict]) -> dict:
    return preflight_factory.preflight_repository(
        documents,
        repository,
        ".",
        "investigate",
        None,
        "local-development",
    )


def commit_manifest(repository: Path, denied_capabilities: list[str]) -> None:
    manifest_directory = repository / ".cratis"
    manifest_directory.mkdir()
    manifest = {
        "$schema": "https://schemas.cratis.io/factory/v1/project-manifest.schema.json",
        "schemaVersion": "1",
        "documentKind": "project-manifest",
        "repositoryMode": "application",
        "profiles": {"include": ["cratis-dotnet-react"], "exclude": []},
        "workflows": {"investigate-cratis-issue": "1.0.0"},
        "policy": {
            "id": "local-development",
            "denyCapabilities": denied_capabilities,
        },
    }
    (manifest_directory / "factory.json").write_text(
        canonical_json.canonical_json(manifest),
        encoding="utf-8",
    )
    commit_all(repository, "project manifest")


def rehash(document: dict) -> None:
    document["contentHash"] = canonical_json.content_hash(
        {key: value for key, value in document.items() if key != "contentHash"}
    )


class clean_golden_repository:
    def __init__(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.path = Path(self._temporary_directory.name) / "repository"

    def __enter__(self) -> Path:
        source = validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        shutil.copytree(source, self.path)
        run_git(self.path, ["init", "--quiet", "--initial-branch=main"])
        commit_all(self.path, "fixture")
        return self.path

    def __exit__(self, exception_type, exception, traceback) -> None:
        self._temporary_directory.cleanup()


def commit_all(repository: Path, message: str) -> None:
    run_git(repository, ["add", "."])
    run_git(
        repository,
        [
            "-c",
            "user.name=Factory Authority Test",
            "-c",
            "user.email=factory-authority-test@example.invalid",
            "commit",
            "--quiet",
            "-m",
            message,
        ],
    )


def run_git(repository: Path, arguments: list[str]) -> None:
    subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )


def git_output(repository: Path, arguments: list[str]) -> str:
    return subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


if __name__ == "__main__":
    unittest.main()
