// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import {
    buildGlobalReleaseManifest,
    createLogicalTree,
    projectLogicalTree,
    validateProjectedRoot,
    writeProjectedRoot,
} from "../deterministic-release-tree.mjs";

function temporaryRoot() {
    return mkdtempSync(join(tmpdir(), "cratis-release-tree-"));
}

function files(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        return entry.isDirectory()
            ? files(root, path)
            : [relative(root, path).replaceAll("\\", "/")];
    });
}

function inventory(root) {
    return Object.fromEntries(
        files(root)
            .sort()
            .map((path) => [
                path,
                readFileSync(join(root, path)).toString("hex"),
            ]),
    );
}

function tree(
    filesInput = [
        { path: "skills/example/LICENSE", content: Buffer.from("license\n") },
        { path: "skills/example/SKILL.md", content: Buffer.from("skill\n") },
    ],
) {
    return createLogicalTree({ files: filesInput });
}

function projection(logicalTree, roots = ["one", "two"]) {
    return projectLogicalTree(
        logicalTree,
        roots.map((root) => ({
            id: root,
            root,
            parityGroup: "example",
            mappings: logicalTree.files.map((file) => ({
                sourcePath: file.path,
                path: file.path,
            })),
        })),
    );
}

test("two runs and randomized logical lane order produce identical bytes", () => {
    const temporary = temporaryRoot();
    try {
        const forward = tree();
        const reverse = tree(
            [...forward.files]
                .reverse()
                .map((file) => ({
                    path: file.path,
                    content: forward.read(file.path),
                })),
        );
        const first = projection(forward, ["one", "two"]);
        const second = projection(reverse, ["two", "one"]);
        writeProjectedRoot(join(temporary, "first"), first);
        writeProjectedRoot(join(temporary, "second"), second);
        assert.deepEqual(
            inventory(join(temporary, "first")),
            inventory(join(temporary, "second")),
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("one or more explicit declared roots retain canonical byte parity", () => {
    const temporary = temporaryRoot();
    try {
        const logical = tree();
        const projected = projection(logical, ["native", "compatibility"]);
        const validation = writeProjectedRoot(
            join(temporary, "candidate"),
            projected,
        );
        assert.equal(validation.fileCount, 4);
        assert.deepEqual(
            readFileSync(
                join(temporary, "candidate/native/skills/example/SKILL.md"),
            ),
            readFileSync(
                join(
                    temporary,
                    "candidate/compatibility/skills/example/SKILL.md",
                ),
            ),
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("tampered duplicates and undeclared files fail complete validation", () => {
    const temporary = temporaryRoot();
    try {
        const projected = projection(tree());
        const root = join(temporary, "candidate");
        writeProjectedRoot(root, projected);
        writeFileSync(join(root, "two/skills/example/SKILL.md"), "tampered\n");
        assert.throws(
            () => validateProjectedRoot(root, projected),
            /digest mismatch/,
        );
        writeFileSync(join(root, "two/skills/example/SKILL.md"), "skill\n");
        writeFileSync(join(root, "undeclared.txt"), "extra\n");
        assert.throws(
            () => validateProjectedRoot(root, projected),
            /complete declared inventory/,
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("path, case, Unicode, normalized, and escape collisions are rejected", () => {
    assert.throws(
        () =>
            tree([
                { path: "A.txt", content: Buffer.from("a") },
                { path: "a.txt", content: Buffer.from("b") },
            ]),
        /collision/,
    );
    assert.throws(
        () =>
            tree([
                { path: "caf\u00e9.txt", content: Buffer.from("a") },
                { path: "cafe\u0301.txt", content: Buffer.from("b") },
            ]),
        /collision/,
    );
    assert.throws(
        () =>
            tree([
                { path: "file", content: Buffer.from("a") },
                { path: "file/child", content: Buffer.from("b") },
            ]),
        /file\/directory collision/,
    );
    assert.throws(
        () => tree([{ path: "../escape", content: Buffer.from("a") }]),
        /escapes/,
    );
    assert.throws(
        () => tree([{ path: "/absolute", content: Buffer.from("a") }]),
        /relative/,
    );
});

test("approved sources reject symlinks and special files", () => {
    const temporary = temporaryRoot();
    try {
        writeFileSync(join(temporary, "regular"), "value");
        symlinkSync("regular", join(temporary, "link"));
        assert.throws(
            () =>
                createLogicalTree({
                    sourceRoot: temporary,
                    approvedFiles: ["link"],
                }),
            /[Ss]ymlink/,
        );
        const fifo = join(temporary, "fifo");
        execFileSync("mkfifo", [fifo]);
        assert.throws(
            () =>
                createLogicalTree({
                    sourceRoot: temporary,
                    approvedFiles: ["fifo"],
                }),
            /regular file/,
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("a failure in any root removes the whole new candidate", () => {
    const temporary = temporaryRoot();
    try {
        const destination = join(temporary, "candidate");
        assert.throws(
            () =>
                writeProjectedRoot(destination, projection(tree()), {
                    beforeWrite({ path }) {
                        if (path.startsWith("two/"))
                            throw new Error("injected root failure");
                    },
                }),
            /injected root failure/,
        );
        assert.equal(files(temporary).includes("candidate"), false);
        assert.equal(readdirSync(temporary).includes("candidate"), false);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("preexisting destinations are preserved and refused", () => {
    const temporary = temporaryRoot();
    try {
        const destination = join(temporary, "candidate");
        mkdirSync(destination);
        writeFileSync(join(destination, "preserved"), "original\n");
        assert.throws(
            () => writeProjectedRoot(destination, projection(tree())),
            /must not exist/,
        );
        assert.equal(
            readFileSync(join(destination, "preserved"), "utf8"),
            "original\n",
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test("every final file is reread and hashed with no persistent cache authority", () => {
    const temporary = temporaryRoot();
    try {
        const metrics = { sourceReads: 0, finalReads: 0, bytesHashed: 0 };
        const source = join(temporary, "source");
        mkdirSync(source);
        writeFileSync(join(source, "one.txt"), "one");
        writeFileSync(join(source, "two.txt"), "two");
        const logical = createLogicalTree({
            sourceRoot: source,
            approvedFiles: ["two.txt", "one.txt"],
            metrics,
        });
        assert.equal(metrics.sourceReads, 2);
        const projected = projectLogicalTree(logical, [
            {
                id: "root",
                root: "root",
                mappings: logical.files.map((file) => ({
                    sourcePath: file.path,
                    path: file.path,
                })),
            },
        ]);
        const validation = writeProjectedRoot(
            join(temporary, "candidate"),
            projected,
            { metrics },
        );
        assert.equal(metrics.finalReads, validation.fileCount);
        assert.equal(
            files(join(temporary, "candidate")).some((path) =>
                /cache/i.test(path),
            ),
            false,
        );
        const manifest = buildGlobalReleaseManifest(projected, validation, {
            releaseId: "fixture",
        });
        assert.equal(manifest.files.length, validation.fileCount);
        assert.equal(manifest.supportGranted, false);
        assert.equal(manifest.publicationGranted, false);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});
