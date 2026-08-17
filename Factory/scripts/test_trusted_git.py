#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the centralized fail-closed Factory Git boundary."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import trusted_git


class TrustedGitTests(unittest.TestCase):
    def test_command_uses_an_absolute_attested_executable_and_security_overrides(self) -> None:
        command = trusted_git.command(["version"])

        self.assertTrue(Path(command[0]).is_absolute())
        self.assertNotEqual("git", command[0])
        self.assertIn("--no-replace-objects", command)
        self.assertIn("core.fsmonitor=false", command)
        self.assertIn(f"core.hooksPath={os.devnull}", command)
        self.assertIn("credential.helper=", command)

    def test_environment_does_not_inherit_path_or_git_configuration(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "PATH": "/hostile/path",
                "GIT_CONFIG_GLOBAL": "/hostile/config",
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "core.fsmonitor",
                "GIT_CONFIG_VALUE_0": "/hostile/hook",
            },
            clear=False,
        ):
            environment = trusted_git.environment()

        self.assertNotEqual("/hostile/path", environment["PATH"])
        self.assertEqual(os.devnull, environment["GIT_CONFIG_GLOBAL"])
        self.assertNotIn("GIT_CONFIG_COUNT", environment)
        self.assertNotIn("GIT_CONFIG_KEY_0", environment)
        self.assertNotIn("GIT_CONFIG_VALUE_0", environment)
        self.assertEqual("0", environment["GIT_OPTIONAL_LOCKS"])

    def test_security_environment_overrides_are_rejected(self) -> None:
        with self.assertRaises(trusted_git.TrustedGitError):
            trusted_git.environment({"GIT_CONFIG_GLOBAL": "/hostile/config"})

    def test_callers_cannot_append_a_global_config_override(self) -> None:
        with self.assertRaises(trusted_git.TrustedGitError):
            trusted_git.command(["-c", "core.fsmonitor=/hostile/hook", "status"])

    def test_changed_attested_executable_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            executable = Path(temporary_directory) / "git"
            executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
            metadata = executable.stat()
            value = trusted_git.GitAttestation(
                executable,
                metadata.st_dev,
                metadata.st_ino,
                metadata.st_size,
                metadata.st_mtime_ns,
                hashlib.sha256(executable.read_bytes()).hexdigest(),
            )
            executable.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")

            with mock.patch.object(trusted_git, "_ATTESTATION", value):
                with self.assertRaises(trusted_git.TrustedGitError):
                    trusted_git.command(["version"])

    def test_worktree_include_is_rejected_before_a_general_command(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            included = repository / "included.gitconfig"
            included.write_text("[core]\n\tfsmonitor = hostile\n", encoding="utf-8")
            self.assertEqual(
                0,
                trusted_git.run(["init", "--quiet"], cwd=repository).returncode,
            )
            self.assertEqual(
                0,
                trusted_git.run(
                    ["config", "--local", "extensions.worktreeConfig", "true"],
                    cwd=repository,
                ).returncode,
            )
            self.assertEqual(
                0,
                trusted_git.run(
                    ["config", "--worktree", "include.path", str(included)],
                    cwd=repository,
                ).returncode,
            )

            with self.assertRaises(trusted_git.RepositoryConfigIncludesError):
                trusted_git.run(["status", "--short"], cwd=repository)


if __name__ == "__main__":
    unittest.main()
