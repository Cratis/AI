// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    fixtureOutputRoots,
    harnessOutputsForProvider,
} from "../harness-registry.mjs";
import {
    generateDistributionFixture,
    smokeClaudeDistributionFixture,
    smokeDeepCodeDistributionFixture,
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
    const targetRequirementIds = new Set(
        matrix.targets.map((target) => target.requirementId),
    );
    assert(
        matrix.targets.every(
            (target) =>
                verified.includes(target.requirementId) ||
                target.requirementId === "pi-passive-package",
        ),
    );
    assert.equal(
        requirements.requirements.find(
            (item) => item.id === "pi-passive-package",
        ).status,
        "DOCUMENTATION_REVIEWED",
    );
    assert.deepEqual(
        verified.filter((id) => !targetRequirementIds.has(id)),
        ["npm-trusted-publication"],
    );
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
        assert.deepEqual(first.generatedTargets, fixtureOutputRoots);
        assert.deepEqual(
            readdirSync(firstRoot, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort(),
            [...fixtureOutputRoots].sort(),
        );
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

test("Gemini evidence binds public and engineering skill discovery", () => {
    const evidence = readJson(
        join(
            repositoryRoot,
            "distribution/evidence/local-gemini-skill-discovery-2026-08-24.json",
        ),
    );
    assert.equal(evidence.state, "LOCAL_GEMINI_SKILL_DISCOVERY_PASS");
    assert.equal(evidence.geminiCliVersion, "0.33.1");
    assert.equal(evidence.publicFixture.skill, "cratis-fundamentals-concept");
    assert.equal(
        evidence.engineeringFixture.skill,
        "cratis-engineering-docs-authoring",
    );
    assert(evidence.results.every((result) => result.status === "PASS"));
    assert.equal(evidence.hostTested, true);
    assert.equal(evidence.installationEligible, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
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
        const grokMarketplace = readJson(
            join(stage, "grok/.claude-plugin/marketplace.json"),
        );
        const grokPlugin = readJson(
            join(stage, "grok/plugins/cratis/.claude-plugin/plugin.json"),
        );
        const kiro = readJson(join(stage, "kiro/plugin.json"));
        const junieMarketplace = readJson(
            join(stage, "junie/.claude-plugin/marketplace.json"),
        );
        const junie = readJson(
            join(stage, "junie/plugins/cratis/.claude-plugin/plugin.json"),
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
                supportedHarnessOutputs: harnessOutputsForProvider("deepseek"),
                distinctArtifactRoot: null,
            },
        ]);
        const canonicalSkill = readFileSync(
            join(
                stage,
                "canonical/skills/cratis-fundamentals-concept/SKILL.md",
            ),
            "utf8",
        );
        assert.equal(
            readFileSync(
                join(
                    stage,
                    "deepcode/.deepcode/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
            canonicalSkill,
        );
        assert.equal(
            readFileSync(
                join(
                    stage,
                    "deepseek/.dsh/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
            canonicalSkill,
        );
        assert.equal(
            readFileSync(
                join(
                    stage,
                    "grok/plugins/cratis/skills/cratis-fundamentals-concept/SKILL.md",
                ),
                "utf8",
            ),
            canonicalSkill,
        );
        assert.equal(grokMarketplace.plugins[0].source, "./plugins/cratis");
        assert.deepEqual(grokPlugin, claude);
        assert.equal(junieMarketplace.plugins[0].source, "./plugins/cratis");
        assert.deepEqual(junie, claude);
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

test("distribution fixture rejects post-hoc files omitted from checksums and assurance", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        const extraPath = join(stage, "undeclared-executable.sh");
        const extra = Buffer.from("#!/bin/sh\nexit 0\n");
        writeFileSync(extraPath, extra);
        const manifestPath = join(stage, "distribution-manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.files.push({
            path: "undeclared-executable.sh",
            size: extra.length,
            sha256: createHash("sha256").update(extra).digest("hex"),
        });
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(
            () => validateDistributionFixture(stage),
            /undeclared payload or metadata|exact final inventory/,
        );
    });
});

test("Grok compatibility and DeepSeek skill fixtures install and remove", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        generateDistributionFixture({ repositoryRoot, outputRoot: stage });
        assert.deepEqual(
            smokeGrokDistributionFixture(stage, join(root, "grok-home")),
            { installed: true, removed: true },
        );
        assert.deepEqual(
            smokeDeepCodeDistributionFixture(
                stage,
                join(root, "deepcode-home"),
            ),
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
            skillDiscovered: true,
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
