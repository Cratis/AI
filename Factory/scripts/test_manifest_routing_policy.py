#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Regressions for project-manifest workflow and effective-policy routing parity."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import canonical_json
import compile_factory
import operation_result
import preflight_factory
import resolve_factory
import validate_factory


class ManifestRoutingPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.documents = {
            path: deepcopy(validate_factory.load_json(path))
            for path in validate_factory.all_json_files()
        }
        cls.fixture = (
            validate_factory.ROOT / "Factory" / "Fixtures" / "Ecosystems" / "golden-stack"
        )

    def test_empty_allowlist_is_blocked_in_inspect_and_preflight(self) -> None:
        manifest = self._manifest(workflows={})
        resolved = self._resolve(manifest)
        inspect_envelope = resolve_factory._resolution_envelope(resolved, "sha256:" + "1" * 64)

        with self.assertRaises(preflight_factory.PreflightRouteBlocked) as context:
            preflight_factory._select_workflow(resolved, None, manifest)
        preflight_envelope = preflight_factory._failure_envelope(
            "preflight",
            "sha256:" + "2" * 64,
            context.exception,
        )

        self.assertEqual([], resolved["workflows"])
        self.assertIn(resolve_factory.MANIFEST_WORKFLOWS_EMPTY_BLOCKER, resolved["blockedReasons"])
        self.assertEqual("blocked", inspect_envelope["status"])
        self.assertEqual("blocked", preflight_envelope["status"])
        self.assertEqual(3, operation_result.exit_code_for_status(inspect_envelope["status"]))
        self.assertEqual(3, operation_result.exit_code_for_status(preflight_envelope["status"]))
        self.assertEqual("authorize-project-workflow", inspect_envelope["nextActions"][0]["id"])
        self.assertEqual("authorize-project-workflow", preflight_envelope["nextActions"][0]["id"])
        operation_result.verify_operation_result_hash(inspect_envelope)
        operation_result.verify_operation_result_hash(preflight_envelope)

    def test_stale_workflow_pin_explains_requested_and_trusted_versions(self) -> None:
        manifest = self._manifest(
            workflows={"investigate-cratis-issue": "9.9.9"}
        )

        with self.assertRaises(resolve_factory.ResolutionFailure) as context:
            self._resolve(manifest)

        detail = str(context.exception)
        self.assertIn("version 9.9.9 is not available", detail)
        self.assertIn("trusted Factory version is 1.0.0", detail)

    def test_omitted_workflow_allowlist_is_invalid_in_inspect_and_preflight(self) -> None:
        manifest = self._manifest()
        del manifest["workflows"]

        with self.assertRaises(resolve_factory.ResolutionFailure) as context:
            self._resolve(manifest)

        inspect_envelope = resolve_factory._failure_envelope(
            "sha256:" + "6" * 64,
            context.exception,
        )
        preflight_envelope = preflight_factory._failure_envelope(
            "preflight",
            "sha256:" + "7" * 64,
            context.exception,
        )
        self.assertIn("'workflows' is a required property", str(context.exception))
        self.assertEqual("invalid", inspect_envelope["status"])
        self.assertEqual("invalid", preflight_envelope["status"])
        self.assertEqual(4, operation_result.exit_code_for_status(inspect_envelope["status"]))
        self.assertEqual(4, operation_result.exit_code_for_status(preflight_envelope["status"]))

    def test_exact_workflow_content_hash_survives_manifest_narrowing(self) -> None:
        manifest = self._manifest()
        resolved = self._resolve(manifest)
        workflow = next(
            document
            for document in self.documents.values()
            if document.get("documentKind") == "workflow"
            and document.get("id") == "investigate-cratis-issue"
        )

        self.assertEqual(["investigate-cratis-issue"], [item["id"] for item in resolved["workflows"]])
        self.assertEqual(
            canonical_json.content_hash(workflow),
            resolved["workflows"][0]["contentHash"],
        )
        self.assertEqual(
            canonical_json.content_hash(manifest),
            next(item for item in resolved["evidence"] if item["kind"] == "manifest")["value"],
        )

    def test_required_gate_capability_denial_has_inspect_preflight_status_parity(self) -> None:
        manifest = self._manifest(denied=["run-quality-gates"])
        resolved = self._resolve(manifest)
        inspect_envelope = resolve_factory._resolution_envelope(resolved, "sha256:" + "3" * 64)

        with self.assertRaises(preflight_factory.PreflightPolicyDenied) as context:
            preflight_factory._select_workflow(
                resolved,
                "investigate-cratis-issue",
                manifest,
            )
        preflight_envelope = preflight_factory._failure_envelope(
            "preflight",
            "sha256:" + "4" * 64,
            context.exception,
        )

        self.assertEqual([], resolved["workflows"])
        self.assertIn(
            ("run-quality-gates", "explicitly-denied", "investigate-cratis-issue"),
            {
                (item["id"], item["reason"], item["requiredBy"])
                for item in resolved["negativeCapabilities"]
            },
        )
        for envelope in (inspect_envelope, preflight_envelope):
            self.assertEqual("denied", envelope["status"])
            self.assertEqual(7, operation_result.exit_code_for_status(envelope["status"]))
            self.assertEqual("contact-maintainer", envelope["nextActions"][0]["kind"])
            self.assertEqual("human-only", envelope["nextActions"][0]["automation"])
            operation_result.verify_operation_result_hash(envelope)

        rendered = resolve_factory._render_inspection_text(inspect_envelope, "summary")
        self.assertIn("Status: denied", rendered)
        self.assertIn("run-quality-gates", rendered)

    def test_agent_repository_capability_denial_has_inspect_preflight_status_parity(self) -> None:
        manifest = self._manifest(denied=["read-repository"])
        resolved = self._resolve(manifest)
        inspect_envelope = resolve_factory._resolution_envelope(
            resolved,
            "sha256:" + "8" * 64,
        )

        with self.assertRaises(preflight_factory.PreflightPolicyDenied) as context:
            preflight_factory._select_workflow(
                resolved,
                "investigate-cratis-issue",
                manifest,
            )
        preflight_envelope = preflight_factory._failure_envelope(
            "preflight",
            "sha256:" + "9" * 64,
            context.exception,
        )

        self.assertIn(
            ("read-repository", "explicitly-denied", "investigate-cratis-issue"),
            {
                (item["id"], item["reason"], item["requiredBy"])
                for item in resolved["negativeCapabilities"]
            },
        )
        for envelope in (inspect_envelope, preflight_envelope):
            self.assertEqual("denied", envelope["status"])
            self.assertEqual(7, operation_result.exit_code_for_status(envelope["status"]))
            self.assertEqual("contact-maintainer", envelope["nextActions"][0]["kind"])
            self.assertEqual("human-only", envelope["nextActions"][0]["automation"])

    def test_denial_of_unused_known_capability_keeps_route_and_compilation_allowed(self) -> None:
        manifest = self._manifest(denied=["create-pull-request"])
        resolved = self._resolve(manifest)
        selected = preflight_factory._select_workflow(
            resolved,
            "investigate-cratis-issue",
            manifest,
        )
        snapshot = {
            "protocolVersion": "1",
            "repository": "manifest-policy-test",
            "revision": "a" * 40,
            "targetPath": resolved["targetPath"],
            "dirty": False,
        }
        snapshot["contentHash"] = canonical_json.content_hash(snapshot)
        compiled = compile_factory.compile_documents(
            self.documents,
            selected,
            resolved,
            snapshot,
            "local-development",
            ["create-pull-request"],
            canonical_json.content_hash(manifest),
        )

        self.assertEqual("investigate-cratis-issue", selected)
        self.assertEqual(["investigate-cratis-issue"], [item["id"] for item in resolved["workflows"]])
        agent_grants = {
            phase["id"]: [
                grant
                for grant in phase["capabilities"]
                if grant["usage"] == "agent"
            ]
            for phase in compiled["orderedPhases"]
            if phase["kind"] == "agent"
        }
        self.assertEqual({"investigate", "review"}, set(agent_grants))
        self.assertTrue(
            all(
                grants == [
                    {
                        "id": "read-repository",
                        "usage": "agent",
                        "sourceId": phase_id,
                        "effect": "read",
                        "policyCapability": "read-repository",
                        "decision": "allow",
                    }
                ]
                for phase_id, grants in agent_grants.items()
            )
        )

    def test_manifest_cannot_replace_the_trusted_baseline_with_another_known_policy(self) -> None:
        documents = deepcopy(self.documents)
        base_policy = next(
            document
            for document in documents.values()
            if document.get("documentKind") == "policy"
            and document.get("id") == "local-development"
        )
        weaker_policy = deepcopy(base_policy)
        weaker_policy["id"] = "weaker-development"
        weaker_policy["version"] = "1.0.0"
        documents[validate_factory.POLICIES / "weaker-development.policy.json"] = weaker_policy
        manifest = self._manifest(policy_id="weaker-development")

        with self.assertRaises(resolve_factory.ResolutionFailure) as context:
            resolve_factory.resolve_repository(
                self.fixture,
                ".",
                "investigate",
                documents,
                _validated_manifest=manifest,
                baseline_policy_id="local-development",
            )

        self.assertIn("cannot replace trusted baseline policy local-development", str(context.exception))
        self.assertIn("may only narrow the baseline", str(context.exception))

    def test_executable_preflight_returns_typed_denied_for_manifest_policy_conflict(self) -> None:
        manifest = self._manifest(denied=["run-quality-gates"])
        with self._clean_repository(manifest) as repository:
            with self.assertRaises(preflight_factory.PreflightPolicyDenied) as context:
                preflight_factory.preflight_repository(
                    self.documents,
                    repository,
                    ".",
                    "investigate",
                    None,
                    "local-development",
                )

        envelope = preflight_factory._failure_envelope(
            "preflight",
            "sha256:" + "5" * 64,
            context.exception,
        )
        self.assertEqual("denied", envelope["status"])
        self.assertEqual("FACTORY-PREFLIGHT-POLICY-DENIED", envelope["diagnostics"][0]["code"])
        self.assertFalse(envelope["sideEffectsOccurred"])

    def _resolve(self, manifest: dict) -> dict:
        return resolve_factory.resolve_repository(
            self.fixture,
            ".",
            "investigate",
            self.documents,
            _validated_manifest=manifest,
            baseline_policy_id="local-development",
        )

    @staticmethod
    def _manifest(
        *,
        workflows: dict[str, str] | None = None,
        denied: list[str] | None = None,
        policy_id: str = "local-development",
    ) -> dict:
        return {
            "$schema": "https://schemas.cratis.io/factory/v1/project-manifest.schema.json",
            "schemaVersion": "1",
            "documentKind": "project-manifest",
            "repositoryMode": "application",
            "profiles": {"include": ["cratis-dotnet-react"], "exclude": []},
            "workflows": (
                {"investigate-cratis-issue": "1.0.0"}
                if workflows is None
                else workflows
            ),
            "policy": {
                "id": policy_id,
                "denyCapabilities": [] if denied is None else denied,
            },
        }

    class _clean_repository:
        def __init__(self, manifest: dict) -> None:
            self.manifest = manifest
            self.temporary = tempfile.TemporaryDirectory()
            self.repository = Path(self.temporary.name) / "repository"

        def __enter__(self) -> Path:
            source = (
                validate_factory.ROOT
                / "Factory"
                / "Fixtures"
                / "Ecosystems"
                / "golden-stack"
            )
            shutil.copytree(source, self.repository)
            manifest_directory = self.repository / ".cratis"
            manifest_directory.mkdir()
            (manifest_directory / "factory.json").write_text(
                canonical_json.canonical_json(self.manifest),
                encoding="utf-8",
            )
            subprocess.run(
                ["git", "init", "--quiet", "--initial-branch=main"],
                cwd=self.repository,
                check=True,
            )
            subprocess.run(["git", "add", "."], cwd=self.repository, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Factory Manifest Test",
                    "-c",
                    "user.email=factory-manifest-test@example.invalid",
                    "commit",
                    "--quiet",
                    "-m",
                    "fixture",
                ],
                cwd=self.repository,
                check=True,
            )
            return self.repository

        def __exit__(self, exception_type, exception, traceback) -> None:
            self.temporary.cleanup()


if __name__ == "__main__":
    unittest.main()
