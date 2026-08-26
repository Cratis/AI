#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function git(root, args) {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

export function validateReleaseMergeTopology(
    root,
    requestPath,
    beforeRevision,
    revision = "HEAD",
) {
    const errors = [];
    if (!/^distribution\/releases\/v[^/]+\.json$/u.test(requestPath))
        return ["release request path is invalid"];
    let parents;
    try {
        parents = git(root, ["rev-list", "--parents", "-n", "1", revision])
            .split(" ")
            .filter(Boolean);
    } catch (error) {
        return [`cannot inspect release merge: ${error.message}`];
    }
    if (parents.length !== 3)
        return [
            "release activation requires exactly one two-parent merge commit",
        ];
    const [, firstParent, reviewedHead] = parents;
    if (!beforeRevision || firstParent !== beforeRevision)
        errors.push(
            "release push must advance directly from PUSH_BEFORE to one reviewed merge commit",
        );
    const changes = git(root, [
        "diff",
        "--name-status",
        "--no-renames",
        firstParent,
        revision,
        "--",
    ])
        .split("\n")
        .filter(Boolean);
    if (
        changes.length !== 1 ||
        changes[0] !== `A\t${requestPath}`
    )
        errors.push(
            "release merge must add exactly one request and no authority or workflow changes",
        );
    try {
        execFileSync("git", ["cat-file", "-e", `${firstParent}:${requestPath}`], {
            cwd: root,
            stdio: "pipe",
        });
        errors.push("release request already existed on the first parent");
    } catch {
        // Expected: request is add-only.
    }
    try {
        const reviewed = execFileSync(
            "git",
            ["show", `${reviewedHead}:${requestPath}`],
            { cwd: root },
        );
        const merged = execFileSync(
            "git",
            ["show", `${revision}:${requestPath}`],
            { cwd: root },
        );
        if (!reviewed.equals(merged))
            errors.push("merged release request differs from reviewed PR head");
    } catch (error) {
        errors.push(`cannot bind reviewed release request: ${error.message}`);
    }
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const requestPath = process.argv[2];
    const beforeRevision = process.argv[3];
    if (!requestPath || !beforeRevision) {
        process.stderr.write(
            "Usage: node tooling/release-merge-topology-validation.mjs distribution/releases/v<version>.json <push-before-sha>\n",
        );
        process.exitCode = 1;
    } else {
        const errors = validateReleaseMergeTopology(
            defaultRepositoryRoot,
            requestPath,
            beforeRevision,
        );
        if (errors.length > 0) {
            for (const error of errors) process.stderr.write(`- ${error}\n`);
            process.exitCode = 1;
        } else process.stdout.write("Release merge topology validation passed.\n");
    }
}
