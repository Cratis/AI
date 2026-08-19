#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the corpus fleet report."""

from __future__ import annotations

import json
import unittest

import corpus_fleet_report
import corpus_manifest

SOURCE_DIGEST = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
OTHER_DIGEST = "sha256:2222222222222222222222222222222222222222222222222222222222222222"


def manifest_text(digest: str = SOURCE_DIGEST, commit: str = "abcdef1234567890", source: str = "Cratis/AI") -> str:
    return corpus_manifest.render_manifest(
        {
            "version": corpus_manifest.MANIFEST_VERSION,
            "sourceRepository": source,
            "sourceCommit": commit,
            "generatedAt": "2026-08-19T00:00:00Z",
            "fileCount": 3,
            "corpusDigest": digest,
        }
    )


class EvaluateTests(unittest.TestCase):
    def test_a_matching_digest_is_in_sync(self) -> None:
        report = corpus_fleet_report.evaluate("Cratis/Arc", manifest_text(), SOURCE_DIGEST)

        self.assertEqual(corpus_fleet_report.STATUS_IN_SYNC, report.status)

    def test_a_differing_digest_is_stale(self) -> None:
        report = corpus_fleet_report.evaluate("Cratis/Arc", manifest_text(OTHER_DIGEST), SOURCE_DIGEST)

        self.assertEqual(corpus_fleet_report.STATUS_STALE, report.status)

    def test_a_missing_manifest_is_unknown_rather_than_stale(self) -> None:
        # Before propagation has run once with manifest support, no repository has a manifest.
        # Reporting them all as stale would make the report useless on the day it ships.
        report = corpus_fleet_report.evaluate("Cratis/Arc", None, SOURCE_DIGEST)

        self.assertEqual(corpus_fleet_report.STATUS_UNKNOWN, report.status)

    def test_a_corrupt_manifest_is_unreadable_rather_than_crashing(self) -> None:
        report = corpus_fleet_report.evaluate("Cratis/Arc", "{not json", SOURCE_DIGEST)

        self.assertEqual(corpus_fleet_report.STATUS_UNREADABLE, report.status)

    def test_a_future_manifest_version_is_unreadable_rather_than_misread(self) -> None:
        future = json.loads(manifest_text())
        future["version"] = corpus_manifest.MANIFEST_VERSION + 1

        report = corpus_fleet_report.evaluate("Cratis/Arc", json.dumps(future), SOURCE_DIGEST)

        self.assertEqual(corpus_fleet_report.STATUS_UNREADABLE, report.status)

    def test_a_stale_repository_reports_where_its_corpus_came_from(self) -> None:
        report = corpus_fleet_report.evaluate(
            "Cratis/Arc", manifest_text(OTHER_DIGEST, source="Cratis/Chronicle"), SOURCE_DIGEST
        )

        self.assertIn("Cratis/Chronicle", report.detail)


class BuildReportTests(unittest.TestCase):
    def report(self) -> dict:
        return corpus_fleet_report.build_report(
            {
                "Cratis/Arc": manifest_text(),
                "Cratis/Chronicle": manifest_text(OTHER_DIGEST),
                "Cratis/Lens": None,
            },
            SOURCE_DIGEST,
            "Cratis/AI",
            "abcdef1234567890",
        )

    def test_counts_every_status(self) -> None:
        counts = self.report()["counts"]

        self.assertEqual(1, counts[corpus_fleet_report.STATUS_IN_SYNC])
        self.assertEqual(1, counts[corpus_fleet_report.STATUS_STALE])
        self.assertEqual(1, counts[corpus_fleet_report.STATUS_UNKNOWN])

    def test_repositories_are_ordered_so_the_report_is_stable(self) -> None:
        names = [entry["repository"] for entry in self.report()["repositories"]]

        self.assertEqual(sorted(names), names)

    def test_an_empty_fleet_produces_an_empty_report_rather_than_failing(self) -> None:
        report = corpus_fleet_report.build_report({}, SOURCE_DIGEST, "Cratis/AI", "abc")

        self.assertEqual(0, report["counts"][corpus_fleet_report.STATUS_IN_SYNC])
        self.assertEqual([], report["repositories"])


class RenderTests(unittest.TestCase):
    def test_stale_repositories_are_named_in_the_table(self) -> None:
        report = corpus_fleet_report.build_report(
            {"Cratis/Chronicle": manifest_text(OTHER_DIGEST)}, SOURCE_DIGEST, "Cratis/AI", "abc"
        )

        rendered = corpus_fleet_report.render_markdown(report)

        self.assertIn("Cratis/Chronicle", rendered)
        self.assertIn("stale", rendered)

    def test_a_healthy_fleet_says_so_plainly(self) -> None:
        report = corpus_fleet_report.build_report(
            {"Cratis/Arc": manifest_text()}, SOURCE_DIGEST, "Cratis/AI", "abc"
        )

        rendered = corpus_fleet_report.render_markdown(report)

        self.assertIn("Every repository carrying a manifest is on the current corpus.", rendered)

    def test_unknown_repositories_are_explained_rather_than_left_alarming(self) -> None:
        report = corpus_fleet_report.build_report({"Cratis/Arc": None}, SOURCE_DIGEST, "Cratis/AI", "abc")

        rendered = corpus_fleet_report.render_markdown(report)

        self.assertIn("carry no manifest yet", rendered)

    def test_rendering_is_deterministic(self) -> None:
        report = corpus_fleet_report.build_report(
            {"Cratis/Arc": manifest_text(), "Cratis/Chronicle": manifest_text(OTHER_DIGEST)},
            SOURCE_DIGEST,
            "Cratis/AI",
            "abc",
        )

        self.assertEqual(corpus_fleet_report.render_markdown(report), corpus_fleet_report.render_markdown(report))


if __name__ == "__main__":
    unittest.main()
