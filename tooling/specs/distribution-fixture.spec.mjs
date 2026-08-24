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
    generateDistributionFixture,
    smokeClaudeDistributionFixture,
    smokeDeepSeekDistributionFixture,
    smokeCodexDistributionFixture,
    smokeCopilotDistributionFixture,
    smokeGeminiDistributionFixture,
    smokeGrokDistributionFixture,
    smokeNpmDistributionFixture,
    smokePiDistributionFixture,
    validateDistributionFixture,
} from "../generate-distribution-fixture.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
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
const codexAvailable = commandAvailable("codex");
const copilotAvailable = commandAvailable("copilot");
const geminiAvailable = commandAvailable("gemini");

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-distribution-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

test("distribution requirements and artifact matrix stay authority bounded", () => {
    const requirements = readJson(
        join(repositoryRoot, "distribution/marketplace-requirements.json"),
    );
    const matrix = readJson(
        join(repositoryRoot, "distribution/artifact-matrix.json"),
    );
    const localEvidence = readJson(
        join(
            repositoryRoot,
            "distribution/evidence/local-fixture-smoke-2026-08-22.json",
        ),
    );
    const currentProfileEvidence = readJson(
        join(
            repositoryRoot,
            "distribution/evidence/local-profile-fixture-smoke-2026-08-22.json",
        ),
    );
    const verified = requirements.requirements
        .filter((item) => item.status.startsWith("VERIFIED"))
        .map((item) => item.id);
    assert.deepEqual(verified, [
        "agent-skills-open-standard",
        "agent-plugins-open-standard",
        "claude-code-marketplace",
        "openai-codex-plugin",
        "github-copilot-plugin",
        "gemini-cli-extension",
        "pi-passive-package",
        "grok-build-skills",
        "deepseek-harness-skills",
        "deepseek-model-provider",
        "npm-trusted-publication",
        "cursor-marketplace",
        "kiro-marketplace",
        "junie-marketplace",
    ]);
    assert.deepEqual(
        requirements.requirements
            .filter(
                (item) =>
                    item.status === "BLOCKED_NO_AUTHORITATIVE_REQUIREMENTS",
            )
            .map((item) => item.id),
        [],
    );
    assert.equal(matrix.state, "FIXTURE_ONLY_LOCAL_STAGING");
    assert.equal(matrix.publicationEligible, false);
    assert.equal(matrix.promotionEligible, false);
    assert.equal(matrix.repository.status, "INITIALIZED_PROTECTED_FIXTURE");
    const requirementIds = new Set(
        requirements.requirements.map((item) => item.id),
    );
    assert(
        matrix.targets.every((target) =>
            requirementIds.has(target.requirementId),
        ),
    );
    assert(
        matrix.targets
            .filter((target) => target.state === "BLOCKED")
            .every((target) => target.outputRoot === null),
    );
    assert.equal(localEvidence.publicationEligible, false);
    assert.equal(localEvidence.promotionEligible, false);
    assert(
        localEvidence.results.every((result) =>
            result.status.startsWith("PASS"),
        ),
    );
    assert.equal(currentProfileEvidence.status, "PASS");
    assert.equal(
        currentProfileEvidence.sourceCommit,
        "e9d161a70e25334bb468a33240bcf00f03f87522",
    );
    assert.equal(
        currentProfileEvidence.sourceArtifactId,
        "cratis-fundamentals-concept-preview",
    );
    assert.equal(
        currentProfileEvidence.provenanceSourceRevision,
        currentProfileEvidence.sourceCommit,
    );
    assert(
        currentProfileEvidence.results.every(
            (result) => result.status === "PASS",
        ),
    );
    assert.equal(currentProfileEvidence.publicationEligible, false);
    assert.equal(currentProfileEvidence.promotionEligible, false);
});

test("distribution fixture generation is deterministic across native adapters", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = generateDistributionFixture({
            repositoryRoot,
            outputRoot: firstRoot,
        });
        const second = generateDistributionFixture({
            repositoryRoot,
            outputRoot: secondRoot,
        });
        assert.deepEqual(second, first);
        for (const file of first.files) {
            assert.deepEqual(
                readFileSync(join(secondRoot, file.path)),
                readFileSync(join(firstRoot, file.path)),
            );
        }
        assert.deepEqual(validateDistributionFixture(firstRoot), first);
        assert.deepEqual(first.generatedTargets, [
            "canonical",
            "agent-plugin",
            "claude",
            "codex",
            "copilot",
            "cursor",
            "deepseek",
            "gemini",
            "grok",
            "junie",
            "kiro",
            "pi",
        ]);
    });
});

test("fixture provenance binds the authorized immutable public source", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        const provenance = readJson(join(stage, "provenance.json"));
        assert.equal(
            provenance.sourceArtifactId,
            "cratis-fundamentals-concept-preview",
        );
        assert.equal(
            provenance.sourceRevision,
            "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        );
        assert.equal(
            provenance.sourceContentDigest,
            "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
        );
        assert.equal(
            provenance.sourcePath,
            "skills/cratis-fundamentals-concept",
        );
        assert.match(provenance.sourceContentDigest, /^[0-9a-f]{64}$/);
        assert.equal(provenance.publicationEligible, false);
        assert.equal(provenance.promotionEligible, false);
    });
});

test("generated marketplace manifests remain passive and idiomatic", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        const portable = readJson(join(stage, "agent-plugin/plugin.json"));
        const claude = readJson(
            join(stage, "claude/plugins/cratis/.claude-plugin/plugin.json"),
        );
        const codex = readJson(
            join(stage, "codex/plugins/cratis/.codex-plugin/plugin.json"),
        );
        const copilot = readJson(
            join(stage, "copilot/plugins/cratis/plugin.json"),
        );
        const cursor = readJson(
            join(stage, "cursor/plugins/cratis/plugin.json"),
        );
        const gemini = readJson(join(stage, "gemini/gemini-extension.json"));
        const providerCompatibility = readJson(
            join(stage, "provider-compatibility.json"),
        );
        const kiro = readJson(join(stage, "kiro/plugin.json"));
        const junie = readJson(
            join(stage, "junie/extensions/cratis/extension.json"),
        );
        const piPackage = readJson(join(stage, "pi/package/package.json"));
        assert.equal(claude.name, "cratis");
        assert.equal(codex.skills, "./skills/");
        assert.deepEqual(copilot, portable);
        assert.deepEqual(cursor, portable);
        assert.deepEqual(kiro, portable);
        assert.equal(
            portable.$schema,
            "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        );
        assert.equal(portable.repository, "https://github.com/Cratis/AI");
        assert.equal(portable.homepage, "https://cratis.io/ai");
        assert.equal(portable.skills, undefined);
        assert.equal(gemini.name, "cratis");
        assert.deepEqual(providerCompatibility.providers, [
            {
                id: "deepseek",
                artifactStrategy: "USE_HARNESS_PACKAGE",
                supportedHarnessOutputs: [
                    "claude",
                    "copilot",
                    "deepseek",
                    "pi",
                ],
                distinctArtifactRoot: null,
            },
        ]);
        assert.equal(
            readFileSync(
                join(
                    stage,
                    "deepseek/.dsh/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
            readFileSync(
                join(
                    stage,
                    "canonical/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
        );
        assert.equal(
            readFileSync(
                join(
                    stage,
                    "grok/.grok/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
            readFileSync(
                join(
                    stage,
                    "canonical/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
        );
        assert.equal(
            kiro.$schema,
            "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        );
        assert.equal(junie.name, "cratis");
        for (const manifest of [
            portable,
            claude,
            codex,
            copilot,
            cursor,
            gemini,
            kiro,
            junie,
        ]) {
            assert.equal(manifest.hooks, undefined);
            assert.equal(manifest.mcpServers, undefined);
            assert.equal(manifest.commands, undefined);
        }
        assert.equal(piPackage.name, "@cratis/ai");
        assert.equal(piPackage.private, true);
        assert.deepEqual(piPackage.pi, { skills: ["./skills"] });
        assert.equal(piPackage.scripts, undefined);
        assert.equal(piPackage.dependencies, undefined);
        const skill = readFileSync(
            join(
                stage,
                "canonical/skills/cratis-fundamentals-concept/SKILL.md",
            ),
            "utf8",
        );
        assert.match(
            skill,
            /^---\nname: cratis-fundamentals-concept\ndescription: /,
        );
    });
});

test("distribution fixture detects payload and checksum tampering", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        const path = join(
            stage,
            "gemini/skills/cratis-fundamentals-concept/SKILL.md",
        );
        writeFileSync(path, "tampered\n");
        assert.throws(
            () => validateDistributionFixture(stage),
            /digest mismatch|byte parity|Checksum verification/,
        );
    });
});

test("Grok and DeepSeek direct skill fixtures install and remove", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        assert.deepEqual(
            smokeGrokDistributionFixture(stage, join(root, "grok-home")),
            { installed: true, removed: true },
        );
        assert.deepEqual(
            smokeDeepSeekDistributionFixture(
                stage,
                join(root, "deepseek-home"),
            ),
            { installed: true, removed: true },
        );
    });
});

test("passive npm fixture packs installs and uninstalls without scripts", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const smokeRoot = join(root, "smoke");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(smokeRoot);
        const result = smokeNpmDistributionFixture(stage, smokeRoot);
        assert.equal(existsSync(result.tarball), true);
        assert.equal(
            result.installedSkill,
            "skills/cratis-fundamentals-concept/SKILL.md",
        );
    });
});

test("passive Pi fixture installs lists and removes in an isolated home", {
    skip: !piAvailable,
}, () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const isolatedHome = join(root, "home");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(isolatedHome);
        assert.deepEqual(smokePiDistributionFixture(stage, isolatedHome), {
            installed: true,
            removed: true,
        });
    });
});

test("Claude fixture validates installs and removes in an isolated home", {
    skip: !claudeAvailable,
}, () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const isolatedHome = join(root, "home");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(isolatedHome);
        assert.deepEqual(smokeClaudeDistributionFixture(stage, isolatedHome), {
            validated: true,
            installed: true,
            removed: true,
        });
    });
});

test("Copilot fixture installs and removes in an isolated home", {
    skip: !copilotAvailable,
}, () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const isolatedHome = join(root, "home");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(isolatedHome);
        assert.deepEqual(smokeCopilotDistributionFixture(stage, isolatedHome), {
            installed: true,
            removed: true,
        });
    });
});

test("Codex fixture marketplace adds and removes in an isolated home", {
    skip: !codexAvailable,
}, () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const isolatedHome = join(root, "home");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(isolatedHome);
        assert.deepEqual(smokeCodexDistributionFixture(stage, isolatedHome), {
            added: true,
            removed: true,
        });
    });
});

test("Gemini fixture links and removes in an isolated home", {
    skip: !geminiAvailable,
}, () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const isolatedHome = join(root, "home");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        mkdirSync(isolatedHome);
        assert.deepEqual(smokeGeminiDistributionFixture(stage, isolatedHome), {
            linked: true,
            removed: true,
        });
    });
});

test("distribution generator CLI binds the requested fixture version", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        execFileSync(
            process.execPath,
            [
                join(
                    repositoryRoot,
                    "tooling/generate-distribution-fixture.mjs",
                ),
                stage,
                "0.0.5-fixture",
            ],
            { cwd: repositoryRoot, stdio: "pipe" },
        );
        assert.equal(
            readJson(join(stage, "distribution-manifest.json")).version,
            "0.0.5-fixture",
        );
        assert.throws(() =>
            execFileSync(
                process.execPath,
                [
                    join(
                        repositoryRoot,
                        "tooling/generate-distribution-fixture.mjs",
                    ),
                    join(root, "invalid"),
                    "latest",
                ],
                { cwd: repositoryRoot, stdio: "pipe" },
            ),
        );
    });
});

test("distribution generator refuses an existing destination", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        mkdirSync(stage);
        assert.throws(
            () =>
                generateDistributionFixture({
                    repositoryRoot,
                    outputRoot: stage,
                }),
            /must not exist/,
        );
    });
});
