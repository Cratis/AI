#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the corpus manifest that records which corpus a repository is on."""

from __future__ import annotations

import json
import unittest

import corpus_manifest


def files() -> dict[str, bytes]:
    return {
        ".ai/rules/csharp.md": b"# C#\n",
        ".ai/skills/toolbar/SKILL.md": b"# Toolbar\n",
        "AGENTS.md": b"# Agents\n",
    }


def manifest(**overrides) -> dict:
    arguments = {
        "source_repository": "Cratis/AI",
        "source_commit": "0d6f12a2a30818b8d19ef5471ee675cbcafe8ac0",
        "files": files(),
        "generated_at": "2026-08-19T00:00:00Z",
    }
    arguments.update(overrides)
    return corpus_manifest.build_manifest(**arguments)


class CorpusDigestTests(unittest.TestCase):
    def test_identical_corpora_have_the_same_digest(self) -> None:
        self.assertEqual(corpus_manifest.corpus_digest(files()), corpus_manifest.corpus_digest(files()))

    def test_digest_does_not_depend_on_insertion_order(self) -> None:
        reversed_order = dict(reversed(list(files().items())))

        self.assertEqual(
            corpus_manifest.corpus_digest(files()),
            corpus_manifest.corpus_digest(reversed_order),
        )

    def test_changed_content_changes_the_digest(self) -> None:
        changed = files()
        changed[".ai/rules/csharp.md"] = b"# C# (edited)\n"

        self.assertNotEqual(corpus_manifest.corpus_digest(files()), corpus_manifest.corpus_digest(changed))

    def test_moving_a_file_changes_the_digest_even_though_content_is_identical(self) -> None:
        moved = files()
        moved[".ai/rules/csharp-standards.md"] = moved.pop(".ai/rules/csharp.md")

        self.assertNotEqual(corpus_manifest.corpus_digest(files()), corpus_manifest.corpus_digest(moved))

    def test_a_removed_file_changes_the_digest(self) -> None:
        without = files()
        del without["AGENTS.md"]

        self.assertNotEqual(corpus_manifest.corpus_digest(files()), corpus_manifest.corpus_digest(without))

    def test_path_boundaries_are_unambiguous(self) -> None:
        # Without length-prefixed paths these two corpora would hash identically, because the
        # concatenation of their paths is the same. A digest that cannot tell them apart would
        # report a renamed corpus as in sync.
        first = corpus_manifest.corpus_digest({"ab": b"", "c": b""})
        second = corpus_manifest.corpus_digest({"a": b"", "bc": b""})

        self.assertNotEqual(first, second)

    def test_an_empty_path_is_rejected(self) -> None:
        with self.assertRaises(corpus_manifest.CorpusManifestError):
            corpus_manifest.corpus_digest({"": b"x"})


class BuildManifestTests(unittest.TestCase):
    def test_manifest_records_source_and_digest(self) -> None:
        built = manifest()

        self.assertEqual(corpus_manifest.MANIFEST_VERSION, built["version"])
        self.assertEqual("Cratis/AI", built["sourceRepository"])
        self.assertEqual("0d6f12a2a30818b8d19ef5471ee675cbcafe8ac0", built["sourceCommit"])
        self.assertEqual(3, built["fileCount"])
        self.assertEqual(corpus_manifest.corpus_digest(files()), built["corpusDigest"])

    def test_rendering_is_byte_identical_for_identical_input(self) -> None:
        # Propagating an unchanged corpus must not produce a commit in every target repository.
        self.assertEqual(
            corpus_manifest.render_manifest(manifest()),
            corpus_manifest.render_manifest(manifest()),
        )

    def test_rendered_manifest_ends_with_a_newline(self) -> None:
        self.assertTrue(corpus_manifest.render_manifest(manifest()).endswith("\n"))

    def test_missing_source_repository_is_rejected(self) -> None:
        with self.assertRaises(corpus_manifest.CorpusManifestError):
            manifest(source_repository="")

    def test_missing_source_commit_is_rejected(self) -> None:
        with self.assertRaises(corpus_manifest.CorpusManifestError):
            manifest(source_commit="")


class ReadManifestTests(unittest.TestCase):
    def test_round_trips_a_rendered_manifest(self) -> None:
        read = corpus_manifest.read_manifest(corpus_manifest.render_manifest(manifest()))

        self.assertEqual(manifest(), read)

    def test_invalid_json_is_rejected(self) -> None:
        with self.assertRaises(corpus_manifest.CorpusManifestError):
            corpus_manifest.read_manifest("{not json")

    def test_a_future_version_is_rejected_rather_than_misread(self) -> None:
        future = manifest()
        future["version"] = corpus_manifest.MANIFEST_VERSION + 1

        with self.assertRaises(corpus_manifest.CorpusManifestError):
            corpus_manifest.read_manifest(json.dumps(future))

    def test_a_manifest_missing_the_digest_is_rejected(self) -> None:
        without = manifest()
        del without["corpusDigest"]

        with self.assertRaises(corpus_manifest.CorpusManifestError):
            corpus_manifest.read_manifest(json.dumps(without))


class CompareTests(unittest.TestCase):
    def test_matching_digests_are_in_sync(self) -> None:
        local = manifest()

        comparison = corpus_manifest.compare(local, local["corpusDigest"], "abc123")

        self.assertTrue(comparison["inSync"])

    def test_differing_digests_are_out_of_sync(self) -> None:
        comparison = corpus_manifest.compare(manifest(), "sha256:different", "abc123")

        self.assertFalse(comparison["inSync"])

    def test_a_new_source_commit_with_an_unchanged_corpus_is_still_in_sync(self) -> None:
        # The corpus is unchanged across most source commits. Reporting those repositories as
        # stale would produce a permanently red dashboard that everyone learns to ignore.
        local = manifest(source_commit="older0000000000000000000000000000000000")

        comparison = corpus_manifest.compare(local, local["corpusDigest"], "newer111")

        self.assertTrue(comparison["inSync"])


if __name__ == "__main__":
    unittest.main()
