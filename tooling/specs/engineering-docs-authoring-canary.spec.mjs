// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runEngineeringDocsAuthoringCanary } from "../run-engineering-docs-authoring-canary.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const scriptPath = join(
    repositoryRoot,
    "tooling/run-engineering-docs-authoring-canary.mjs",
);

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-engineering-canary-spec-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("real Documentation canary evidence remains bound and non-promoting", () => {
    const evidence = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "distribution/evidence/real-documentation-engineering-canary-2026-08-22.json",
            ),
            "utf8",
        ),
    );
    assert.equal(evidence.state, "REAL_REPOSITORY_FIXTURE_CANARY_PASS");
    assert.equal(evidence.consumerRepository, "Cratis/Documentation");
    assert.equal(
        evidence.consumerRevision,
        "72677c19acf2aea71ab5d39138ff350c1f661fe1",
    );
    assert.deepEqual(evidence.routing, {
        explicit: "DEFER_TO_EDIT_PAGE",
        implicit: "DEFER_TO_ADD_PAGE",
        authorityBlock: "BLOCK",
    });
    assert.equal(evidence.priorAttempt.state, "FAIL");
    assert.equal(evidence.priorAttempt.implicitOutput, "NEEDS_DECISION");
    assert.equal(evidence.worktreePreserved, true);
    assert.deepEqual(
        evidence.projectContextAfter,
        evidence.projectContextBefore,
    );
    assert.equal(evidence.packageRemoved, true);
    assert.equal(evidence.toolsEnabled, false);
    assert.equal(evidence.targetApproval, false);
    assert.equal(evidence.installationEligible, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("engineering real-repository canary remains no-tools and isolated", () => {
    const script = readFileSync(scriptPath, "utf8");
    assert.match(script, /"--no-tools"/);
    assert.match(script, /"--no-extensions"/);
    assert.match(script, /"--no-session"/);
    assert.match(script, /PI_CODING_AGENT_DIR: configRoot/);
    assert.match(script, /PI_CODING_AGENT_SESSION_DIR: sessionRoot/);
    assert.match(script, /copyFileSync\(authFile/);
    assert.match(
        script,
        /chmodSync\(join\(configRoot, "auth\.json"\), 0o600\)/,
    );
    assert.match(script, /rmSync\(temporaryRoot/);
});

test("engineering canary checks update rollback uninstall and project context", () => {
    const script = readFileSync(scriptPath, "utf8");
    for (const expected of [
        "0.0.1-engineering-fixture",
        "0.0.2-engineering-fixture",
        "DEFER_TO_EDIT_PAGE",
        "DEFER_TO_ADD_PAGE",
        "BLOCK",
        'execFileSync("pi", ["remove", packageRoot]',
        "Canary changed the consumer worktree",
        "Canary changed project-owned context",
    ])
        assert(script.includes(expected), expected);
    for (const contextPath of [
        ".cratis/PROJECT.md",
        ".agents/PROJECT.md",
        "AGENTS.md",
        "CLAUDE.md",
        "GEMINI.md",
    ])
        assert(script.includes(contextPath), contextPath);
});

test("engineering canary rejects a dirty consuming repository before auth use", () => {
    withTemporaryDirectory((root) => {
        execFileSync("git", ["init", "--initial-branch", "main"], {
            cwd: root,
            stdio: "pipe",
        });
        execFileSync("git", ["config", "user.name", "Canary Spec"], {
            cwd: root,
        });
        execFileSync(
            "git",
            ["config", "user.email", "canary@invalid.example"],
            {
                cwd: root,
            },
        );
        writeFileSync(join(root, "README.md"), "# Canary\n");
        execFileSync("git", ["add", "README.md"], { cwd: root });
        execFileSync("git", ["commit", "-m", "Initial"], {
            cwd: root,
            stdio: "pipe",
        });
        writeFileSync(join(root, "dirty.txt"), "dirty\n");
        const authFile = join(root, "auth.json");
        writeFileSync(authFile, "{}\n");
        assert.throws(
            () =>
                runEngineeringDocsAuthoringCanary({
                    consumerRoot: root,
                    evidencePath: join(root, "evidence.json"),
                    authFile,
                }),
            /must be clean/,
        );
    });
});

test("engineering canary rejects missing auth and preexisting evidence", () => {
    withTemporaryDirectory((root) => {
        execFileSync("git", ["init", "--initial-branch", "main"], {
            cwd: root,
            stdio: "pipe",
        });
        execFileSync("git", ["config", "user.name", "Canary Spec"], {
            cwd: root,
        });
        execFileSync(
            "git",
            ["config", "user.email", "canary@invalid.example"],
            {
                cwd: root,
            },
        );
        writeFileSync(join(root, "README.md"), "# Canary\n");
        execFileSync("git", ["add", "README.md"], { cwd: root });
        execFileSync("git", ["commit", "-m", "Initial"], {
            cwd: root,
            stdio: "pipe",
        });
        assert.throws(
            () =>
                runEngineeringDocsAuthoringCanary({
                    consumerRoot: root,
                    evidencePath: join(root, "evidence.json"),
                    authFile: join(root, "missing-auth.json"),
                }),
            /auth file is unavailable/,
        );
        const authFile = join(root, "auth.json");
        const evidencePath = join(root, "evidence.json");
        writeFileSync(authFile, "{}\n");
        writeFileSync(evidencePath, "{}\n");
        assert.throws(
            () =>
                runEngineeringDocsAuthoringCanary({
                    consumerRoot: root,
                    evidencePath,
                    authFile,
                }),
            /evidence already exists/,
        );
    });
});
