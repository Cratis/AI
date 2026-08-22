// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    generateEngineeringDistributionFixture,
    smokeClaudeEngineeringFixture,
    smokeCopilotEngineeringFixture,
    smokeNpmEngineeringFixture,
    smokeNpmEngineeringUpdateRollback,
    smokePiEngineeringFixture,
    validateEngineeringDistributionFixture,
} from "../generate-engineering-distribution-fixture.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function commandAvailable(command) {
    try {
        execFileSync(command, ["--version"], { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}

const piAvailable = commandAvailable("pi");
const claudeAvailable = commandAvailable("claude");
const copilotAvailable = commandAvailable("copilot");

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-engineering-fixture-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

test("engineering fixture workflow remains read-only and non-promoting", () => {
    const workflow = readFileSync(
        join(
            repositoryRoot,
            ".github/workflows/engineering-distribution-fixture.yml",
        ),
        "utf8",
    );
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /permissions:\n  contents: read/);
    assert.match(
        workflow,
        /0\.0\.N-engineering-fixture/,
    );
    assert.match(workflow, /engineering-distribution-fixture\.spec\.mjs/);
    for (const forbidden of [
        "id-token: write",
        "contents: write",
        "pull-requests: write",
        "npm publish",
        "gh pr create",
        "git push",
        "release:",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("engineering fixture evidence remains local and non-promoting", () => {
    const evidence = readJson(
        join(
            repositoryRoot,
            "distribution/evidence/local-engineering-docs-authoring-fixture-2026-08-22.json",
        ),
    );
    assert.equal(evidence.state, "ENGINEERING_FIXTURE_ONLY");
    assert.equal(evidence.targetId, "cratis-engineering-docs-authoring");
    assert(evidence.results.every(result => result.status === "PASS"));
    assert.equal(evidence.targetApproval, false);
    assert.equal(evidence.installationEligible, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("engineering fixture generation is deterministic and non-installable", () => {
    withTemporaryDirectory(root => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: firstRoot,
            version: "0.0.1-engineering-fixture",
        });
        const second = generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: secondRoot,
            version: "0.0.1-engineering-fixture",
        });
        assert.deepEqual(second, first);
        assert.equal(first.state, "ENGINEERING_FIXTURE_ONLY");
        assert.equal(first.installationEligible, false);
        assert.equal(first.publicationEligible, false);
        assert.equal(first.promotionEligible, false);
        assert.deepEqual(first.generatedTargets, [
            "canonical",
            "claude",
            "copilot",
            "pi",
        ]);
        for (const file of first.files) {
            assert.deepEqual(
                readFileSync(join(firstRoot, file.path)),
                readFileSync(join(secondRoot, file.path)),
            );
        }
        assert.deepEqual(validateEngineeringDistributionFixture(firstRoot), first);
    });
});

test("engineering fixture contains one passive skill and no project context", () => {
    withTemporaryDirectory(root => {
        const stage = join(root, "stage");
        generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: stage,
        });
        const manifest = readJson(
            join(stage, "engineering-distribution-manifest.json"),
        );
        assert.equal(
            manifest.skillName,
            "cratis-engineering-docs-authoring",
        );
        assert(
            manifest.files.some(
                file =>
                    file.path ===
                    "canonical/skills/cratis-engineering-docs-authoring/SKILL.md",
            ),
        );
        for (const forbidden of [
            ".cratis/PROJECT.md",
            ".agents/PROJECT.md",
            "AGENTS.md",
            "CLAUDE.md",
            "GEMINI.md",
            "/scripts/",
            "/evals/",
            "/hooks/",
            "/agents/",
            "/prompts/",
        ])
            assert(
                manifest.files.every(file => !file.path.includes(forbidden)),
                forbidden,
            );
        const packageJson = readJson(join(stage, "pi/package/package.json"));
        assert.equal(packageJson.private, true);
        assert.equal(packageJson.scripts, undefined);
        assert.equal(packageJson.dependencies, undefined);
    });
});

test("engineering fixture detects canonical payload tampering", () => {
    withTemporaryDirectory(root => {
        const stage = join(root, "stage");
        generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: stage,
        });
        writeFileSync(
            join(
                stage,
                "canonical/skills/cratis-engineering-docs-authoring/SKILL.md",
            ),
            "tampered\n",
        );
        assert.throws(
            () => validateEngineeringDistributionFixture(stage),
            /digest mismatch|byte parity|checksum/,
        );
    });
});

test("engineering npm fixture packs installs and uninstalls", () => {
    withTemporaryDirectory(root => {
        const stage = join(root, "stage");
        const smokeRoot = join(root, "smoke");
        generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: stage,
        });
        mkdirSync(smokeRoot);
        const result = smokeNpmEngineeringFixture(stage, smokeRoot);
        assert.equal(existsSync(result.tarball), true);
        assert.equal(
            result.installedSkill,
            "skills/cratis-engineering-docs-authoring/SKILL.md",
        );
    });
});

test("engineering npm fixture updates rolls back and preserves project context", () => {
    withTemporaryDirectory(root => {
        const first = join(root, "first");
        const second = join(root, "second");
        const smokeRoot = join(root, "smoke");
        generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: first,
            version: "0.0.1-engineering-fixture",
        });
        generateEngineeringDistributionFixture({
            repositoryRoot,
            outputRoot: second,
            version: "0.0.2-engineering-fixture",
        });
        mkdirSync(smokeRoot);
        assert.deepEqual(
            smokeNpmEngineeringUpdateRollback(first, second, smokeRoot),
            {
                firstVersion: "0.0.1-engineering-fixture",
                secondVersion: "0.0.2-engineering-fixture",
                rolledBackVersion: "0.0.1-engineering-fixture",
                projectContextPreserved: true,
                uninstalled: true,
            },
        );
    });
});

test(
    "engineering Pi fixture installs and removes in an isolated home",
    { skip: !piAvailable },
    () => {
        withTemporaryDirectory(root => {
            const stage = join(root, "stage");
            const home = join(root, "home");
            generateEngineeringDistributionFixture({
                repositoryRoot,
                outputRoot: stage,
            });
            mkdirSync(home);
            assert.deepEqual(smokePiEngineeringFixture(stage, home), {
                installed: true,
                removed: true,
            });
        });
    },
);

test(
    "engineering Claude fixture validates installs and removes",
    { skip: !claudeAvailable },
    () => {
        withTemporaryDirectory(root => {
            const stage = join(root, "stage");
            const home = join(root, "home");
            generateEngineeringDistributionFixture({
                repositoryRoot,
                outputRoot: stage,
            });
            mkdirSync(home);
            assert.deepEqual(smokeClaudeEngineeringFixture(stage, home), {
                validated: true,
                installed: true,
                removed: true,
            });
        });
    },
);

test(
    "engineering Copilot fixture installs and removes",
    { skip: !copilotAvailable },
    () => {
        withTemporaryDirectory(root => {
            const stage = join(root, "stage");
            const home = join(root, "home");
            generateEngineeringDistributionFixture({
                repositoryRoot,
                outputRoot: stage,
            });
            mkdirSync(home);
            assert.deepEqual(smokeCopilotEngineeringFixture(stage, home), {
                installed: true,
                removed: true,
            });
        });
    },
);

test("engineering fixture CLI binds version and rejects release-shaped values", () => {
    withTemporaryDirectory(root => {
        const stage = join(root, "stage");
        execFileSync(
            process.execPath,
            [
                join(
                    repositoryRoot,
                    "tooling/generate-engineering-distribution-fixture.mjs",
                ),
                stage,
                "0.0.7-engineering-fixture",
            ],
            { cwd: repositoryRoot, stdio: "pipe" },
        );
        assert.equal(
            readJson(join(stage, "engineering-distribution-manifest.json"))
                .version,
            "0.0.7-engineering-fixture",
        );
        assert.throws(() =>
            execFileSync(
                process.execPath,
                [
                    join(
                        repositoryRoot,
                        "tooling/generate-engineering-distribution-fixture.mjs",
                    ),
                    join(root, "invalid"),
                    "1.0.0",
                ],
                { cwd: repositoryRoot, stdio: "pipe" },
            ),
        );
    });
});
