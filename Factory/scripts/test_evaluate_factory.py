#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for deterministic, immutable Stage 0 Factory evaluations."""

from __future__ import annotations

import argparse
from copy import deepcopy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from contextlib import redirect_stdout
import io

import canonical_json
import evaluate_factory
import operation_result
import validate_factory


class FactoryEvaluationTests(unittest.TestCase):
    def test_committed_executable_corpus_is_deterministic_and_passes(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()

        first = evaluate_factory.run_evaluations(documents, catalog)
        second = evaluate_factory.run_evaluations(documents, catalog)

        self.assertEqual(first, second)
        self.assertEqual("pass", first["outcome"])
        self.assertEqual(
            {"total": 10, "passed": 10, "failed": 0, "blocked": 0},
            first["summary"],
        )
        self.assertEqual("full-executable-catalog", first["coverage"]["scope"])
        self.assertEqual(40, first["coverage"]["catalogCaseCount"])
        self.assertEqual(10, first["coverage"]["executableCaseCount"])
        self.assertEqual(10, first["coverage"]["selectedCaseCount"])
        self.assertTrue(all(case["assertions"] for case in first["cases"]))
        self.assertTrue(
            all(
                assertion["outcome"] == "pass"
                for case in first["cases"]
                for assertion in case["assertions"]
            )
        )
        evaluate_factory.verify_evaluation_result(first, documents)

    def test_one_case_selection_is_exact_and_unknown_case_fails(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()

        result = evaluate_factory.run_evaluations(
            documents,
            catalog,
            ["discovery-arc-without-chronicle"],
        )

        self.assertEqual(1, result["summary"]["total"])
        self.assertEqual("discovery-arc-without-chronicle", result["cases"][0]["caseId"])
        self.assertEqual("selected-executable-cases", result["coverage"]["scope"])
        self.assertEqual(1, result["coverage"]["selectedCaseCount"])
        with self.assertRaises(evaluate_factory.EvaluationFailure):
            evaluate_factory.run_evaluations(documents, catalog, ["missing-case"])
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "At least one"):
            evaluate_factory.run_evaluations(documents, catalog, [])
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "must be unique"):
            evaluate_factory.run_evaluations(
                documents,
                catalog,
                ["discovery-arc-without-chronicle", "discovery-arc-without-chronicle"],
            )

    def test_fixture_tree_drift_fails_before_any_assertion_runs(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        fixture = catalog["fixtures"][0]
        fixture["treeHash"] = f"sha256:{'0' * 64}"
        rehash(fixture)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.run_evaluations(documents, catalog)

        self.assertIn("tree hash mismatch", str(context.exception))

    def test_fixture_git_metadata_is_rejected_before_materialization(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            git_metadata = root / ".git"
            git_metadata.mkdir()
            (git_metadata / "config").write_text("[core]\n", encoding="utf-8")

            with self.assertRaisesRegex(
                evaluate_factory.EvaluationFailure,
                "forbidden Git metadata",
            ):
                evaluate_factory._capture_fixture_snapshot(root)

    def test_missing_fixture_reference_fails_closed(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        execution = catalog["executions"][0]
        execution["fixtureId"] = "missing-fixture"
        rehash(execution)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.run_evaluations(documents, catalog)

        self.assertIn("references missing fixture", str(context.exception))

    def test_unknown_expected_profile_fails_closed(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        execution = catalog["executions"][1]
        execution["expectedProfileIds"] = ["invented-profile"]
        profile_assertion = next(
            assertion for assertion in execution["assertions"] if assertion["id"] == "profiles-exact"
        )
        profile_assertion["expected"] = ["invented-profile"]
        rehash(execution)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.run_evaluations(documents, catalog)

        self.assertIn("expects unknown profiles", str(context.exception))

    def test_placeholder_assertion_fails_closed(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        execution = catalog["executions"][0]
        execution["assertions"][1]["expected"] = "TODO"
        rehash(execution)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.run_evaluations(documents, catalog)

        self.assertIn("placeholder value", str(context.exception))

    def test_machine_assertion_failure_produces_a_failed_immutable_result(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        execution = catalog["executions"][1]
        execution["assertions"][1]["expected"] = "chronicle-client-dotnet"
        rehash(execution)

        result = evaluate_factory.run_evaluations(
            documents,
            catalog,
            [execution["caseId"]],
        )

        self.assertEqual("fail", result["outcome"])
        self.assertEqual(1, result["summary"]["failed"])
        failed_assertion = next(
            assertion
            for assertion in result["cases"][0]["assertions"]
            if assertion["outcome"] == "fail"
        )
        self.assertEqual("assertion-failed", failed_assertion["diagnosticCode"])
        evaluate_factory.verify_evaluation_result(result, documents, catalog)

    def test_rehashed_result_with_false_summary_is_rejected(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        result["summary"] = {"total": 1, "passed": 0, "failed": 1, "blocked": 0}
        rehash(result)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.verify_evaluation_result(result, documents)

        self.assertIn("summary mismatch", str(context.exception))

    def test_rehashed_result_with_invented_execution_binding_is_rejected(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        result["cases"][0]["executionHash"] = f"sha256:{'0' * 64}"
        rehash(result)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.verify_evaluation_result(result, documents)

        self.assertIn("executionHash is not catalog-bound", str(context.exception))

    def test_rehashed_assertion_outcome_and_diagnostic_are_recomputed_from_actual(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        assertion = result["cases"][0]["assertions"][0]
        assertion["actual"] = []
        rehash(result)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.verify_evaluation_result(result, documents)

        self.assertIn("not derived from actual evidence", str(context.exception))

        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        assertion = result["cases"][0]["assertions"][0]
        assertion["diagnosticCode"] = "assertion-failed"
        rehash(result)
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "not derived from actual"):
            evaluate_factory.verify_evaluation_result(result, documents)

    def test_arbitrary_operation_hash_is_rejected_by_authoritative_rerun(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        result["cases"][0]["operationHash"] = f"sha256:{'0' * 64}"
        rehash(result)

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.verify_evaluation_result(result, documents)

        self.assertIn("authoritative rerun", str(context.exception))

    def test_subset_cannot_claim_full_executable_or_full_catalog_coverage(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        result["coverage"]["scope"] = "full-catalog"
        rehash(result)

        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "coverage does not match"):
            evaluate_factory.verify_evaluation_result(result, documents)

    def test_duplicate_case_and_fixture_references_fail_at_runtime(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        catalog["cases"][1]["id"] = catalog["cases"][0]["id"]
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "case identifiers must be unique"):
            evaluate_factory.run_evaluations(documents, catalog)

        catalog = foundation_catalog()
        catalog["fixtures"][1]["path"] = catalog["fixtures"][0]["path"]
        rehash(catalog["fixtures"][1])
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "fixture paths must be unique"):
            evaluate_factory.run_evaluations(documents, catalog)

    def test_json_equality_is_type_aware_for_scalars_and_collections(self) -> None:
        equals = {"operator": "equals", "expected": 1}
        contains = {"operator": "contains", "expected": 1}
        projected = {"operator": "project-set-equals", "field": "value", "expected": [1]}

        self.assertFalse(evaluate_factory._apply_operator(equals, True))
        self.assertFalse(evaluate_factory._apply_operator(contains, [True]))
        self.assertFalse(evaluate_factory._apply_operator(projected, [{"value": True}]))

    def test_noncanonical_catalog_and_result_values_fail_with_evaluation_diagnostics(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        catalog["executions"][0]["assertions"][0]["expected"] = 1.5
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "canonical JSON v1"):
            evaluate_factory.run_evaluations(documents, catalog)

        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        result["cases"][0]["assertions"][0]["actual"] = 1.5
        with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "canonical JSON v1"):
            evaluate_factory.verify_evaluation_result(result, documents)

    def test_result_for_an_untrusted_catalog_is_rejected_without_explicit_context(self) -> None:
        documents = load_documents()
        catalog = foundation_catalog()
        catalog["version"] = "9.9.9"
        result = evaluate_factory.run_evaluations(
            documents,
            catalog,
            ["discovery-arc-without-chronicle"],
        )

        with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
            evaluate_factory.verify_evaluation_result(result, documents)

        self.assertIn("current trusted catalog match", str(context.exception))

    def test_fixture_hash_rejects_symbolic_links(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            target = root / "target.txt"
            target.write_text("content", encoding="utf-8")
            (root / "link.txt").symlink_to(target)

            with self.assertRaises(evaluate_factory.EvaluationFailure) as context:
                evaluate_factory.fixture_tree_hash(root)

        self.assertIn("forbidden symbolic link", str(context.exception))

    def test_fixture_hash_rejects_a_symbolic_link_as_the_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            parent = Path(temporary_directory)
            root = parent / "fixture"
            root.mkdir()
            (root / "file.txt").write_text("content", encoding="utf-8")
            linked_root = parent / "linked-fixture"
            linked_root.symlink_to(root, target_is_directory=True)

            with self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "root must not"):
                evaluate_factory.fixture_tree_hash(linked_root)

    def test_fixture_capture_rejects_intermediate_directory_swap_to_outside_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            parent = Path(temporary_directory)
            root = parent / "fixture"
            nested = root / "sub"
            nested.mkdir(parents=True)
            (nested / "file.txt").write_text("inside", encoding="utf-8")
            outside = parent / "outside"
            outside.mkdir()
            (outside / "file.txt").write_text("OUTSIDE", encoding="utf-8")
            original_open = evaluate_factory.os.open
            swapped = False

            def swap_before_directory_open(path, flags, *args, **kwargs):
                nonlocal swapped
                if path == "sub" and kwargs.get("dir_fd") is not None and not swapped:
                    swapped = True
                    nested.rename(root / "original-sub")
                    nested.symlink_to(outside, target_is_directory=True)
                return original_open(path, flags, *args, **kwargs)

            with (
                mock.patch.object(evaluate_factory.os, "open", side_effect=swap_before_directory_open),
                self.assertRaisesRegex(evaluate_factory.EvaluationFailure, "changed while being captured"),
            ):
                evaluate_factory._capture_fixture_snapshot(root)

        self.assertTrue(swapped)

    def test_fixture_execution_uses_the_captured_snapshot_after_source_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "value.txt"
            source.write_text("captured", encoding="utf-8")
            snapshot = evaluate_factory._capture_fixture_snapshot(root)
            source.write_text("mutated", encoding="utf-8")

            with evaluate_factory._materialize_fixture_snapshot(snapshot) as materialized:
                actual = (materialized / "value.txt").read_text(encoding="utf-8")

        self.assertEqual("captured", actual)

    def test_deterministic_git_ignores_global_identity_signing_and_templates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            repository = root / "repository"
            repository.mkdir()
            (repository / "file.txt").write_text("content", encoding="utf-8")
            (repository / ".gitignore").write_text("ignored.txt\n", encoding="utf-8")
            (repository / "ignored.txt").write_text("still fixture evidence", encoding="utf-8")
            snapshot = evaluate_factory._capture_fixture_snapshot(repository)
            template = root / "template"
            hooks = template / "hooks"
            hooks.mkdir(parents=True)
            hook = hooks / "pre-commit"
            hook_marker = root / "inherited-hook-ran"
            hook.write_text(
                f"#!/bin/sh\n: > '{hook_marker}'\nexit 97\n",
                encoding="utf-8",
            )
            hook.chmod(0o755)
            global_config = root / "global.gitconfig"
            global_config.write_text(
                f"[commit]\n\tgpgSign = true\n[init]\n\ttemplateDir = {template}\n",
                encoding="utf-8",
            )
            fake_bin = root / "fake-bin"
            fake_bin.mkdir()
            fake_git = fake_bin / "git"
            fake_git.write_text("#!/bin/sh\nexit 96\n", encoding="utf-8")
            fake_git.chmod(0o755)
            with mock.patch.dict(
                os.environ,
                {
                    "GIT_CONFIG_GLOBAL": str(global_config),
                    "GIT_AUTHOR_NAME": "Attacker",
                    "GIT_AUTHOR_EMAIL": "attacker@example.invalid",
                    "GIT_CONFIG_COUNT": "1",
                    "GIT_CONFIG_KEY_0": "core.hooksPath",
                    "GIT_CONFIG_VALUE_0": str(hooks),
                    "PATH": str(fake_bin),
                },
                clear=False,
            ):
                evaluate_factory._initialize_deterministic_git_repository(repository, snapshot)

            author = subprocess.run(
                ["git", "log", "-1", "--format=%an|%ae|%aI"],
                cwd=repository,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()

        self.assertEqual(
            "Factory Evaluation|factory-evaluation@example.invalid|2000-01-01T00:00:00Z",
            author,
        )
        self.assertFalse(hook_marker.exists())

    def test_machine_verify_failure_is_only_a_typed_operation_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            invalid_result = Path(temporary_directory) / "invalid-result.json"
            invalid_result.write_text("{}", encoding="utf-8")
            process = run_evaluator(
                "--verify-result",
                str(invalid_result),
                "--format",
                "json-compact",
            )

        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), process.returncode)
        self.assertEqual("", process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("verify-evaluation-result", envelope["operation"])
        self.assertEqual("integrity-error", envelope["status"])
        operation_result.verify_operation_result_hash(envelope)

    def test_machine_load_failure_does_not_disclose_the_requested_local_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            identifying_path = (
                Path(temporary_directory)
                / "customer-secret-artifacts"
                / "missing-evaluation.json"
            )
            process = run_evaluator(
                "--verify-result",
                str(identifying_path),
                "--format",
                "json-compact",
            )

        self.assertEqual(operation_result.exit_code_for_status("integrity-error"), process.returncode)
        self.assertEqual("", process.stderr)
        self.assertNotIn("customer-secret-artifacts", process.stdout)
        self.assertNotIn(str(identifying_path), process.stdout)
        envelope = json.loads(process.stdout)
        self.assertEqual("integrity-error", envelope["status"])
        self.assertIn("filesystem access failed", envelope["diagnostics"][0]["message"])
        operation_result.verify_operation_result_hash(envelope)

    def test_machine_run_failure_is_only_a_typed_operation_result(self) -> None:
        process = run_evaluator(
            "--case",
            "missing-case",
            "--format",
            "json-compact",
        )

        self.assertEqual(operation_result.exit_code_for_status("invalid"), process.returncode)
        self.assertEqual("", process.stderr)
        envelope = json.loads(process.stdout)
        self.assertEqual("evaluate", envelope["operation"])
        self.assertEqual("invalid", envelope["status"])
        self.assertNotIn("result", envelope)
        operation_result.verify_operation_result_hash(envelope)

    def test_machine_run_and_verify_use_typed_result_envelopes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "evaluation.json"
            run = run_evaluator(
                "--case",
                "discovery-golden-stack",
                "--format",
                "json-compact",
                "--output",
                str(output),
            )
            verify = run_evaluator(
                "--verify-result",
                str(output),
                "--format",
                "json-compact",
            )
            run_envelope = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(0, run.returncode, run.stderr)
        self.assertEqual(0, verify.returncode, verify.stderr)
        self.assertEqual(evaluate_factory.EVALUATION_RESULT_SCHEMA, run_envelope["result"]["schemaId"])
        self.assertEqual("evaluate", run_envelope["operation"])
        self.assertTrue(run_envelope["sideEffectsOccurred"])
        verify_envelope = json.loads(verify.stdout)
        self.assertEqual("verify-evaluation-result", verify_envelope["operation"])
        self.assertFalse(verify_envelope["sideEffectsOccurred"])
        self.assertEqual(evaluate_factory.EVALUATION_RESULT_SCHEMA, verify_envelope["result"]["schemaId"])

    def test_safe_publication_replaces_symlink_and_hardlink_entries_without_mutating_source(self) -> None:
        with tempfile.TemporaryDirectory(dir=validate_factory.ROOT.parent) as temporary_directory:
            output_parent = Path(temporary_directory)
            source = validate_factory.ROOT / "README.md"
            source_before = source.read_bytes()

            symlink_output = output_parent / "symlink-result.json"
            symlink_output.symlink_to(source)
            symlink_destination = evaluate_factory._bind_output_destination(
                str(symlink_output),
                validate_factory.ROOT,
            )
            evaluate_factory._publish_output_safely(symlink_destination, "symlink projection")

            self.assertFalse(symlink_output.is_symlink())
            self.assertEqual("symlink projection", symlink_output.read_text(encoding="utf-8"))
            self.assertEqual(source_before, source.read_bytes())

            hardlink_output = output_parent / "hardlink-result.json"
            os.link(source, hardlink_output)
            hardlink_destination = evaluate_factory._bind_output_destination(
                str(hardlink_output),
                validate_factory.ROOT,
            )
            evaluate_factory._publish_output_safely(hardlink_destination, "hardlink projection")

            self.assertEqual("hardlink projection", hardlink_output.read_text(encoding="utf-8"))
            self.assertNotEqual(source.stat().st_ino, hardlink_output.stat().st_ino)
            self.assertEqual(source_before, source.read_bytes())

    def test_safe_publication_rejects_a_bound_parent_swap_without_writing_either_directory(self) -> None:
        with tempfile.TemporaryDirectory(dir=validate_factory.ROOT.parent) as temporary_directory:
            root = Path(temporary_directory)
            output_parent = root / "output"
            output_parent.mkdir()
            attacker_parent = root / "attacker"
            attacker_parent.mkdir()
            destination = evaluate_factory._bind_output_destination(
                str(output_parent / "evaluation.json"),
                validate_factory.ROOT,
            )
            original_open = evaluate_factory._open_output_directory_nofollow
            calls = 0

            def swap_before_second_open(path: Path) -> int:
                nonlocal calls
                calls += 1
                if calls == 2:
                    output_parent.rename(root / "bound-output")
                    output_parent.symlink_to(attacker_parent, target_is_directory=True)
                return original_open(path)

            with (
                mock.patch.object(
                    evaluate_factory,
                    "_open_output_directory_nofollow",
                    side_effect=swap_before_second_open,
                ),
                self.assertRaises(evaluate_factory.EvaluationOutputFailure),
            ):
                evaluate_factory._publish_output_safely(destination, "must not publish")

            self.assertEqual(2, calls)
            self.assertFalse((root / "bound-output" / "evaluation.json").exists())
            self.assertFalse((attacker_parent / "evaluation.json").exists())
            self.assertEqual([], list((root / "bound-output").glob(".cratis-evaluation-*.tmp")))

    def test_safe_publication_preserves_existing_entry_and_removes_temp_after_write_failure(self) -> None:
        with tempfile.TemporaryDirectory(dir=validate_factory.ROOT.parent) as temporary_directory:
            output_parent = Path(temporary_directory)
            output = output_parent / "evaluation.json"
            output.write_text("previous projection", encoding="utf-8")
            destination = evaluate_factory._bind_output_destination(
                str(output),
                validate_factory.ROOT,
            )

            with (
                mock.patch.object(evaluate_factory.os, "write", side_effect=OSError("private path")),
                self.assertRaises(evaluate_factory.EvaluationOutputFailure),
            ):
                evaluate_factory._publish_output_safely(destination, "replacement")

            self.assertEqual("previous projection", output.read_text(encoding="utf-8"))
            self.assertEqual([], list(output_parent.glob(".cratis-evaluation-*.tmp")))

    def test_output_failure_is_typed_path_opaque_and_reports_no_published_artifact(self) -> None:
        identifying_output = validate_factory.ROOT / "customer-secret-output.json"
        stdout = io.StringIO()
        with (
            mock.patch.object(
                sys,
                "argv",
                [
                    "evaluate_factory.py",
                    "--case",
                    "discovery-golden-stack",
                    "--format",
                    "json-compact",
                    "--output",
                    str(identifying_output),
                ],
            ),
            redirect_stdout(stdout),
        ):
            exit_code = evaluate_factory.main()

        self.assertEqual(operation_result.exit_code_for_status("invalid"), exit_code)
        self.assertFalse(identifying_output.exists())
        self.assertNotIn("customer-secret-output", stdout.getvalue())
        self.assertNotIn(str(validate_factory.ROOT), stdout.getvalue())
        self.assertNotIn("Traceback", stdout.getvalue())
        envelope = json.loads(stdout.getvalue())
        self.assertEqual("evaluate", envelope["operation"])
        self.assertEqual("invalid", envelope["status"])
        self.assertFalse(envelope["sideEffectsOccurred"])
        operation_result.verify_operation_result_hash(envelope)

    def test_main_reports_published_side_effect_after_post_replace_close_failure(self) -> None:
        result = evaluate_factory.run_evaluations(
            load_documents(),
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        with tempfile.TemporaryDirectory(dir=validate_factory.ROOT.parent) as temporary_directory:
            output = Path(temporary_directory) / "evaluation.json"
            stdout = io.StringIO()
            real_replace = evaluate_factory.os.replace
            real_close = evaluate_factory.os.close
            committed = False
            injected = False

            def replace_and_mark(*args, **kwargs):
                nonlocal committed
                value = real_replace(*args, **kwargs)
                committed = True
                return value

            def close_after_commit(descriptor: int) -> None:
                nonlocal injected
                real_close(descriptor)
                if committed and not injected:
                    injected = True
                    raise OSError("private post-commit detail")

            with (
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        "evaluate_factory.py",
                        "--case",
                        "discovery-arc-without-chronicle",
                        "--format",
                        "json-compact",
                        "--output",
                        str(output),
                    ],
                ),
                mock.patch.object(evaluate_factory, "run_evaluations", return_value=result),
                mock.patch.object(evaluate_factory.os, "replace", side_effect=replace_and_mark),
                mock.patch.object(evaluate_factory.os, "close", side_effect=close_after_commit),
                redirect_stdout(stdout),
            ):
                exit_code = evaluate_factory.main()

            published_envelope = json.loads(output.read_text(encoding="utf-8"))

        self.assertTrue(injected)
        self.assertEqual(operation_result.exit_code_for_status("unexpected"), exit_code)
        self.assertTrue(published_envelope["sideEffectsOccurred"])
        failure_envelope = json.loads(stdout.getvalue())
        self.assertEqual("unexpected", failure_envelope["status"])
        self.assertTrue(failure_envelope["sideEffectsOccurred"])
        self.assertIn("was published", failure_envelope["diagnostics"][0]["message"])
        self.assertNotIn("private post-commit", stdout.getvalue())
        self.assertNotIn("Traceback", stdout.getvalue())
        operation_result.verify_operation_result_hash(failure_envelope)

    def test_main_reports_temporary_artifact_when_cleanup_fails_before_publication(self) -> None:
        result = evaluate_factory.run_evaluations(
            load_documents(),
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        with tempfile.TemporaryDirectory(dir=validate_factory.ROOT.parent) as temporary_directory:
            output_parent = Path(temporary_directory)
            output = output_parent / "evaluation.json"
            stdout = io.StringIO()
            with (
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        "evaluate_factory.py",
                        "--case",
                        "discovery-arc-without-chronicle",
                        "--format",
                        "json-compact",
                        "--output",
                        str(output),
                    ],
                ),
                mock.patch.object(evaluate_factory, "run_evaluations", return_value=result),
                mock.patch.object(
                    evaluate_factory.os,
                    "write",
                    side_effect=OSError("private write detail"),
                ),
                mock.patch.object(
                    evaluate_factory.os,
                    "unlink",
                    side_effect=OSError("private cleanup detail"),
                ),
                redirect_stdout(stdout),
            ):
                exit_code = evaluate_factory.main()

            residue = list(output_parent.glob(".cratis-evaluation-*.tmp"))
            self.assertFalse(output.exists())
            self.assertEqual(1, len(residue))
            residue[0].unlink()

        self.assertEqual(operation_result.exit_code_for_status("unexpected"), exit_code)
        failure_envelope = json.loads(stdout.getvalue())
        self.assertEqual("unexpected", failure_envelope["status"])
        self.assertTrue(failure_envelope["sideEffectsOccurred"])
        self.assertIn(
            "temporary projection artifact may remain",
            failure_envelope["diagnostics"][0]["message"],
        )
        self.assertNotIn("private write", stdout.getvalue())
        self.assertNotIn("private cleanup", stdout.getvalue())
        self.assertNotIn("Traceback", stdout.getvalue())
        operation_result.verify_operation_result_hash(failure_envelope)

    def test_evaluation_projection_formats_expose_exact_selected_and_executed_ids(self) -> None:
        documents = load_documents()
        result = evaluate_factory.run_evaluations(
            documents,
            foundation_catalog(),
            ["discovery-arc-without-chronicle"],
        )
        evidence_before = deepcopy(result)
        envelope = evaluate_factory._result_envelope(
            result,
            "evaluate",
            evaluate_factory._canonical_hash({"request": "projection-test"}, "request"),
            side_effects_occurred=False,
        )

        pretty = operation_result.render_operation_result(envelope, "json")
        compact = operation_result.render_operation_result(envelope, "json-compact")
        text = operation_result.render_operation_result(envelope, "text")
        selected = envelope["result"]["value"]["coverage"]["selectedCaseIds"]
        executed = [case["caseId"] for case in envelope["result"]["value"]["cases"]]

        self.assertEqual(envelope, json.loads(pretty))
        self.assertEqual(envelope, json.loads(compact))
        self.assertEqual(["discovery-arc-without-chronicle"], selected)
        self.assertEqual(selected, executed)
        self.assertIn("Catalog case IDs: ", text)
        self.assertIn("Executable case IDs: ", text)
        self.assertIn("Selected case IDs: discovery-arc-without-chronicle", text)
        self.assertIn("Executed case IDs: discovery-arc-without-chronicle", text)
        self.assertEqual(evidence_before, result)
        self.assertEqual(
            canonical_json.content_hash(result),
            envelope["result"]["contentHash"],
        )

    def test_request_hash_is_independent_of_the_checkout_location(self) -> None:
        catalog = foundation_catalog()
        short_checkout = Path("/factory-checkout")
        long_checkout = Path("/factory/checkout/at/a/considerably/longer/absolute/location")

        short = request_hash_at(short_checkout, catalog=catalog)
        long = request_hash_at(long_checkout, catalog=catalog)
        other_catalog_path = request_hash_at(
            short_checkout,
            catalog=catalog,
            catalog_path="Evaluations/Factory/other.catalog.json",
        )

        self.assertEqual(short, long)
        self.assertNotEqual(short, other_catalog_path)

    def test_request_hash_is_independent_of_the_verified_result_location(self) -> None:
        catalog = foundation_catalog()
        checkout = Path("/factory-checkout")

        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_outside = request_hash_at(
                checkout,
                catalog=catalog,
                verify_result=str(Path(first) / "evaluation.json"),
            )
            second_outside = request_hash_at(
                checkout,
                catalog=catalog,
                verify_result=str(Path(second) / "evaluation.json"),
            )
        short_inside = request_hash_at(
            checkout,
            catalog=catalog,
            verify_result=str(checkout / "evaluation.json"),
        )
        long_checkout = Path("/factory/checkout/at/a/considerably/longer/absolute/location")
        long_inside = request_hash_at(
            long_checkout,
            catalog=catalog,
            verify_result=str(long_checkout / "evaluation.json"),
        )

        self.assertEqual(first_outside, second_outside)
        self.assertEqual(short_inside, long_inside)
        self.assertNotEqual(short_inside, first_outside)


def load_documents() -> dict[Path, dict]:
    return {
        path: deepcopy(validate_factory.load_json(path))
        for path in validate_factory.all_json_files()
    }


def foundation_catalog() -> dict:
    path = validate_factory.ROOT / "Evaluations" / "Factory" / "foundation.catalog.json"
    return deepcopy(validate_factory.load_json(path))


def request_hash_at(
    checkout: Path,
    *,
    catalog: dict,
    catalog_path: str = "Evaluations/Factory/foundation.catalog.json",
    verify_result: str | None = None,
) -> str:
    """Hash an evaluation request as if the repository were checked out at ``checkout``."""
    arguments = argparse.Namespace(
        catalog=catalog_path,
        cases=None,
        verify_result=verify_result,
    )
    operation = "verify-evaluation-result" if verify_result else "evaluate"
    with mock.patch.object(validate_factory, "ROOT", checkout):
        return evaluate_factory._request_hash(operation, catalog, None, None, arguments)


def rehash(document: dict) -> None:
    document["contentHash"] = canonical_json.content_hash(
        {key: value for key, value in document.items() if key != "contentHash"}
    )


def run_evaluator(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(validate_factory.ROOT / "Factory" / "scripts" / "evaluate_factory.py"),
            *arguments,
        ],
        cwd=validate_factory.ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


if __name__ == "__main__":
    unittest.main()
