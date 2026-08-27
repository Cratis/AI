// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { validateReleaseMergeTopology } from "../release-merge-topology-validation.mjs";

function git(root, args) {
    return execFileSync("git", args, { cwd: root, stdio: "pipe" });
}

function repository(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-release-topology-"));
    try {
        git(root, ["init", "-b", "main"]);
        git(root, ["config", "user.name", "Cratis Test"]);
        git(root, ["config", "user.email", "test@invalid.example"]);
        writeFileSync(join(root, "README.md"), "base\n");
        git(root, ["add", "README.md"]);
        git(root, ["commit", "-m", "base"]);
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("two-parent add-only release merge binds the reviewed request bytes", () => {
    repository((root) => {
        const before = git(root, ["rev-parse", "HEAD"]).toString().trim();
        git(root, ["checkout", "-b", "release"]);
        mkdirSync(join(root, "distribution/releases"), { recursive: true });
        const request = "distribution/releases/v1.0.0.json";
        writeFileSync(join(root, request), "{}\n");
        git(root, ["add", request]);
        git(root, ["commit", "-m", "request"]);
        git(root, ["checkout", "main"]);
        git(root, ["merge", "--no-ff", "release", "-m", "merge request"]);
        assert.deepEqual(
            validateReleaseMergeTopology(root, request, before),
            [],
        );
        const wrongBefore = git(root, ["rev-parse", "release"])
            .toString()
            .trim();
        assert(
            validateReleaseMergeTopology(
                root,
                request,
                wrongBefore,
            ).some((error) => error.includes("PUSH_BEFORE")),
        );
    });
});

test("direct, squash-like, and authority-changing release commits fail topology", () => {
    repository((root) => {
        mkdirSync(join(root, "distribution/releases"), { recursive: true });
        const request = "distribution/releases/v1.0.0.json";
        writeFileSync(join(root, request), "{}\n");
        git(root, ["add", request]);
        git(root, ["commit", "-m", "direct request"]);
        const before = git(root, ["rev-parse", "HEAD~1"])
            .toString()
            .trim();
        assert(
            validateReleaseMergeTopology(root, request, before).some((error) =>
                error.includes("two-parent merge"),
            ),
        );
    });
});
