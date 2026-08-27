// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { snapshotProjectContext } from "../real-host-project-context-snapshot.mjs";

function withContext(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-s9-context-"));
    try {
        mkdirSync(join(root, ".git"));
        mkdirSync(join(root, "empty"));
        mkdirSync(join(root, "nested"));
        writeFileSync(join(root, "AGENTS.md"), "agents\n");
        writeFileSync(join(root, "nested/file.txt"), "content\n");
        symlinkSync("file.txt", join(root, "nested/link.txt"));
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("context snapshot includes bytes, modes, symlinks, and empty directories but excludes git metadata", () => {
    withContext((root) => {
        const snapshot = snapshotProjectContext(root);
        assert(
            snapshot.entries.some(
                (entry) => entry.path === "." && entry.kind === "directory",
            ),
        );
        assert(snapshot.entries.some((entry) => entry.path === "empty"));
        assert(
            snapshot.entries.some(
                (entry) =>
                    entry.path === "nested/link.txt" &&
                    entry.kind === "symlink" &&
                    entry.target === "file.txt",
            ),
        );
        assert(snapshot.entries.every((entry) => !entry.path.startsWith(".git")));
        assert.equal(snapshot.digest.length, 64);
    });
});

test("context snapshot detects byte, mode, symlink, and empty-directory changes", () => {
    for (const mutate of [
        (root) => chmodSync(root, 0o1700),
        (root) => writeFileSync(join(root, "AGENTS.md"), "changed\n"),
        (root) => chmodSync(join(root, "AGENTS.md"), 0o600),
        (root) => {
            rmSync(join(root, "nested/link.txt"));
            symlinkSync("../AGENTS.md", join(root, "nested/link.txt"));
        },
        (root) => mkdirSync(join(root, "another-empty")),
    ])
        withContext((root) => {
            const before = snapshotProjectContext(root);
            mutate(root);
            const after = snapshotProjectContext(root);
            assert.notEqual(after.digest, before.digest);
        });
});
