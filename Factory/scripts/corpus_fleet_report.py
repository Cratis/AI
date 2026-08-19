#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Report which repositories are running which corpus.

The corpus is propagated from one Cratis repository into the others, and nothing reported
whether that actually arrived. Staleness was discoverable only by hashing every repository by
hand, which is how it was in fact discovered: seven versions of one rules file in circulation,
and the largest cluster covering 15 of 40 repositories.

This turns that into a routine report. It reads each repository's `.ai/.corpus-manifest.json`,
compares the recorded digest against the source of truth, and renders a table.

Two deliberate choices, because the obvious alternatives produce a report nobody reads:

Repositories with no manifest are reported as `unknown`, not as stale. Until propagation has
run once with manifest support, no repository has one, and calling them all stale would
produce a wall of red on day one that teaches everybody to ignore the report.

Sync is decided by digest, not by commit. The corpus is unchanged across most commits to its
source, so comparing commits would mark almost every repository behind forever.

This module does no network calls. The caller supplies each repository's manifest text, so the
same code runs in CI against the API and locally against checkouts, and the tests need no
fixtures beyond strings.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, Mapping, NamedTuple

import corpus_manifest

STATUS_IN_SYNC = "in-sync"
STATUS_STALE = "stale"
STATUS_UNKNOWN = "unknown"
STATUS_UNREADABLE = "unreadable"


class RepositoryReport(NamedTuple):
    """What one repository reports about the corpus it is running."""

    repository: str
    status: str
    detail: str


def evaluate(repository: str, manifest_text: str | None, source_digest: str) -> RepositoryReport:
    """Classify a single repository against the source of truth."""
    if manifest_text is None:
        return RepositoryReport(repository, STATUS_UNKNOWN, "no manifest; has not received a corpus sync yet")

    try:
        manifest = corpus_manifest.read_manifest(manifest_text)
    except corpus_manifest.CorpusManifestError as error:
        return RepositoryReport(repository, STATUS_UNREADABLE, str(error))

    if manifest["corpusDigest"] == source_digest:
        return RepositoryReport(repository, STATUS_IN_SYNC, f"on {_short(manifest['sourceCommit'])}")

    return RepositoryReport(
        repository,
        STATUS_STALE,
        f"on {_short(manifest['sourceCommit'])} from {manifest['sourceRepository']}",
    )


def build_report(
    repositories: Mapping[str, str | None],
    source_digest: str,
    source_repository: str,
    source_commit: str,
) -> dict:
    """Build the whole-fleet report."""
    reports = [evaluate(name, text, source_digest) for name, text in sorted(repositories.items())]
    counts = {
        status: sum(1 for report in reports if report.status == status)
        for status in (STATUS_IN_SYNC, STATUS_STALE, STATUS_UNKNOWN, STATUS_UNREADABLE)
    }
    return {
        "sourceRepository": source_repository,
        "sourceCommit": source_commit,
        "sourceDigest": source_digest,
        "counts": counts,
        "repositories": [report._asdict() for report in reports],
    }


def render_markdown(report: Mapping[str, object]) -> str:
    """Render the report as a GitHub job summary."""
    counts = report["counts"]
    lines = [
        "# Corpus fleet report",
        "",
        f"Source: `{report['sourceRepository']}` at `{_short(str(report['sourceCommit']))}`",
        "",
        f"- in sync: **{counts[STATUS_IN_SYNC]}**",
        f"- stale: **{counts[STATUS_STALE]}**",
        f"- unknown: **{counts[STATUS_UNKNOWN]}**",
    ]
    if counts[STATUS_UNREADABLE]:
        lines.append(f"- unreadable: **{counts[STATUS_UNREADABLE]}**")

    interesting = [
        entry
        for entry in report["repositories"]
        if entry["status"] in (STATUS_STALE, STATUS_UNREADABLE)
    ]
    if interesting:
        lines += ["", "| Repository | Status | Detail |", "| --- | --- | --- |"]
        lines += [
            f"| `{entry['repository']}` | {entry['status']} | {entry['detail']} |" for entry in interesting
        ]
    else:
        lines += ["", "Every repository carrying a manifest is on the current corpus."]

    if counts[STATUS_UNKNOWN]:
        lines += [
            "",
            "Repositories reported as unknown carry no manifest yet. They receive one the first "
            "time the corpus is propagated to them after manifest support landed; until then "
            "their corpus cannot be identified, which is the gap this report exists to close.",
        ]
    return "\n".join(lines) + "\n"


def _short(commit: str) -> str:
    return commit[:12] if commit else "(unknown)"


def _load(pairs: Iterable[str]) -> dict[str, str | None]:
    repositories: dict[str, str | None] = {}
    for pair in pairs:
        name, _, path = pair.partition("=")
        if not name or not path:
            raise ValueError(f"expected repository=path, got {pair!r}")
        try:
            with open(path, encoding="utf-8") as handle:
                repositories[name] = handle.read()
        except FileNotFoundError:
            repositories[name] = None
    return repositories


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Report corpus freshness across repositories.")
    parser.add_argument("--source-repository", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--source-digest", required=True)
    parser.add_argument(
        "--repository",
        action="append",
        default=[],
        metavar="NAME=PATH",
        help="a repository name and the path to its manifest; a missing file means no manifest",
    )
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    arguments = parser.parse_args(argv)

    try:
        repositories = _load(arguments.repository)
    except ValueError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1

    report = build_report(
        repositories,
        arguments.source_digest,
        arguments.source_repository,
        arguments.source_commit,
    )

    if arguments.format == "json":
        sys.stdout.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    else:
        sys.stdout.write(render_markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
