#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Corpus manifest: what a repository's `.ai/` corpus is, and where it came from.

The corpus is propagated from one Cratis repository into the others, and until now nothing
recorded which snapshot a repository ended up with. Staleness was only discoverable by
hashing 35 repositories by hand, which is how it was in fact discovered.

A manifest makes that a local question. It records the source repository, the source commit,
and a digest of the corpus tree, so any repository can be asked "which corpus are you on?"
without cloning anything, and a reporter can compare that answer to the source of truth.

The digest deliberately covers **paths and content together**: a file that moves is a
different corpus even when every byte is preserved, because the corpus is addressed by path
--- rules and skills reference each other by relative path, so a move breaks references that
a content-only digest would call identical.

`corpus_digest` intentionally hashes only what is propagated. The caller supplies the file
set, because the authoritative selector lives in the propagation workflow and this module
must not fork a second, silently diverging copy of it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Iterable, Mapping

import canonical_json

MANIFEST_VERSION = 1
MANIFEST_PATH = ".ai/.corpus-manifest.json"


class CorpusManifestError(ValueError):
    """Raised when a corpus manifest cannot be built or read."""


def corpus_digest(files: Mapping[str, bytes]) -> str:
    """Return a SHA-256 digest over the corpus paths and their content.

    Paths are sorted so the digest does not depend on directory traversal order, and each
    entry mixes in the path as well as the content hash so that moving a file changes the
    digest. Length prefixes keep the encoding unambiguous: without them the pair
    ("ab", "c") and ("a", "bc") would hash identically.
    """
    hasher = hashlib.sha256()
    for path in sorted(files):
        if not path:
            raise CorpusManifestError("a corpus entry has an empty path")
        path_bytes = path.encode("utf-8")
        content_hash = hashlib.sha256(files[path]).digest()
        hasher.update(str(len(path_bytes)).encode("ascii"))
        hasher.update(b":")
        hasher.update(path_bytes)
        hasher.update(content_hash)
    return f"sha256:{hasher.hexdigest()}"


def build_manifest(
    *,
    source_repository: str,
    source_commit: str,
    files: Mapping[str, bytes],
    generated_at: str,
) -> dict:
    """Build the manifest recorded in a repository that received the corpus."""
    if not source_repository:
        raise CorpusManifestError("source_repository is required")
    if not source_commit:
        raise CorpusManifestError("source_commit is required")
    if not generated_at:
        raise CorpusManifestError("generated_at is required")

    return {
        "version": MANIFEST_VERSION,
        "sourceRepository": source_repository,
        "sourceCommit": source_commit,
        "generatedAt": generated_at,
        "fileCount": len(files),
        "corpusDigest": corpus_digest(files),
    }


def render_manifest(manifest: Mapping[str, object]) -> str:
    """Render a manifest as canonical JSON with a trailing newline.

    Canonical JSON keeps the file byte-identical for identical input, so propagating an
    unchanged corpus does not produce a spurious commit in every target repository.
    """
    return canonical_json.canonical_json(manifest) + "\n"


def read_manifest(text: str) -> dict:
    """Parse and validate a manifest read from a repository."""
    try:
        manifest = json.loads(text)
    except json.JSONDecodeError as error:
        raise CorpusManifestError(f"manifest is not valid JSON: {error}") from error

    if not isinstance(manifest, dict):
        raise CorpusManifestError("manifest must be a JSON object")

    missing = [
        field
        for field in ("version", "sourceRepository", "sourceCommit", "corpusDigest")
        if field not in manifest
    ]
    if missing:
        raise CorpusManifestError(f"manifest is missing required fields: {', '.join(missing)}")

    version = manifest["version"]
    if version != MANIFEST_VERSION:
        raise CorpusManifestError(
            f"unsupported manifest version {version!r}; this tool understands version {MANIFEST_VERSION}"
        )
    return manifest


def compare(local: Mapping[str, object], source_digest: str, source_commit: str) -> dict:
    """Compare a repository's manifest against the current source of truth.

    `inSync` is decided by the digest rather than the commit: the corpus can be unchanged
    across many source commits, and reporting those repositories as stale would produce a
    permanently red dashboard that everyone learns to ignore.
    """
    in_sync = local.get("corpusDigest") == source_digest
    return {
        "inSync": in_sync,
        "localDigest": local.get("corpusDigest"),
        "sourceDigest": source_digest,
        "localCommit": local.get("sourceCommit"),
        "sourceCommit": source_commit,
        "localSource": local.get("sourceRepository"),
    }


def _collect(root: Path, relative_paths: Iterable[str]) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for relative in relative_paths:
        path = root / relative
        if not path.is_file():
            raise CorpusManifestError(f"corpus file does not exist: {relative}")
        files[relative] = path.read_bytes()
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build or verify a corpus manifest.")
    parser.add_argument("--root", default=".", help="repository root to read corpus files from")
    parser.add_argument(
        "--files-from",
        required=True,
        help="file holding the propagated corpus paths, one per line (use - for stdin)",
    )
    parser.add_argument("--source-repository", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--generated-at", required=True)
    arguments = parser.parse_args(argv)

    if arguments.files_from == "-":
        listing = sys.stdin.read()
    else:
        listing = Path(arguments.files_from).read_text(encoding="utf-8")
    relative_paths = [line.strip() for line in listing.splitlines() if line.strip()]
    if not relative_paths:
        print("::error::no corpus files were listed; refusing to write an empty manifest", file=sys.stderr)
        return 1

    try:
        files = _collect(Path(arguments.root), relative_paths)
        manifest = build_manifest(
            source_repository=arguments.source_repository,
            source_commit=arguments.source_commit,
            files=files,
            generated_at=arguments.generated_at,
        )
    except CorpusManifestError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1

    sys.stdout.write(render_manifest(manifest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
