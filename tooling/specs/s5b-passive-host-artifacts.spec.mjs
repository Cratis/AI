// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
    createLogicalTree,
    validateProjectedRoot,
    writeProjectedRoot,
} from "../deterministic-release-tree.mjs";
import { resolveHarness } from "../harness-registry.mjs";
import { createPassiveFixtureProjection } from "../passive-profile-adapters.mjs";
import {
    validateAgentSkill,
    validateCratisPassiveProfile,
} from "../portable-compliance-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const expected = JSON.parse(
    readFileSync(
        join(repositoryRoot, "tooling/fixtures/s5b-passive-expected-tree.json"),
        "utf8",
    ),
);
const skillName = "cratis-example";
const skillBytes = Buffer.from(
    "---\nname: cratis-example\ndescription: Passive example.\n---\n\n# Example\n",
);
const licenseBytes = Buffer.from("MIT\n");

function projection() {
    return createPassiveFixtureProjection({
        version: "1.2.3",
        pluginName: "cratis",
        portableDescription: "Passive fixture.",
        marketplaceDescription: "Passive marketplace.",
        codexDisplayName: "Cratis",
        piPackageManifest: {
            name: "@cratis/ai",
            version: "1.2.3",
            description: "Passive fixture.",
            private: true,
            license: "MIT",
            files: ["skills"],
            keywords: ["pi-package"],
            pi: { skills: ["./skills"] },
        },
        skills: [
            {
                name: skillName,
                files: [
                    { path: "SKILL.md", content: skillBytes },
                    { path: "LICENSE", content: licenseBytes },
                ],
            },
        ],
    });
}

function walk(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        return entry.isDirectory()
            ? walk(root, path)
            : [relative(root, path).replaceAll("\\", "/")];
    });
}

function withCandidate(action) {
    const temporary = mkdtempSync(join(tmpdir(), "cratis-s5b-"));
    const root = join(temporary, "candidate");
    const projected = projection();
    writeProjectedRoot(root, projected);
    try {
        return action({ root, projected });
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}

function assertProjectedMutation(mutate) {
    withCandidate(({ root, projected }) => {
        mutate(root);
        assert.throws(() => validateProjectedRoot(root, projected));
    });
}

test("S5b root set and golden expected trees are exact and additive", () => {
    const projected = projection();
    const newRoots = [
        ...expected.agentPluginRoots,
        ...expected.agentSkillRoots,
    ];
    assert.deepEqual(
        newRoots.map((entry) => entry.outputRoot).sort(),
        projected.roots
            .map((entry) => entry.root)
            .filter((root) => !expected.legacyFixtureRoots.includes(root))
            .sort(),
    );
    for (const entry of newRoots) {
        const harness = resolveHarness(entry.harnessId);
        assert.equal(harness.fixtureOutputRoot, entry.outputRoot);
        assert.equal(harness.projectDiscoveryRoot, entry.discoveryRoot);
        assert.equal(harness.fixtureProjectionRoots.length, 1);
        assert.equal(harness.parityGroup, entry.harnessId);
        assert.equal(harness.artifactClass, "passive-public-package");
        assert.equal(typeof harness.servingRequirementId, "string");
        assert(harness.expectedInventory.length > 0);
    }
});

test("standalone Agent Plugins 1.0 roots have exact inventory, canonical bytes, and strict passive receipts", () => {
    withCandidate(({ root }) => {
        for (const entry of expected.agentPluginRoots) {
            const artifactRoot = join(root, entry.outputRoot);
            assert.deepEqual(walk(artifactRoot).sort(), [
                "plugin.json",
                `skills/${skillName}/LICENSE`,
                `skills/${skillName}/SKILL.md`,
            ]);
            assert.equal(
                readFileSync(
                    join(artifactRoot, `skills/${skillName}/SKILL.md`),
                ).equals(skillBytes),
                true,
            );
            const result = validateCratisPassiveProfile(artifactRoot, {
                profileId: "cratis",
                version: "1.2.3",
                artifactId: entry.harnessId,
                allowFixtureProfileId: true,
            });
            assert.equal(result.conformant, true, entry.harnessId);
            assert.equal(result.releaseBlocking, false, entry.harnessId);
            assert.equal(result.receipt.executionPerformed, false);
            assert.equal(result.receipt.networkAccessPerformed, false);
        }
    });
});

test("direct Agent Skills roots have one discovery copy, canonical bytes, strict skills, and passive payloads", () => {
    withCandidate(({ root }) => {
        for (const entry of expected.agentSkillRoots) {
            const artifactRoot = join(root, entry.outputRoot);
            const prefix = `${entry.discoveryRoot}/skills/${skillName}`;
            assert.deepEqual(walk(artifactRoot).sort(), [
                `${prefix}/LICENSE`,
                `${prefix}/SKILL.md`,
            ]);
            assert.equal(
                readFileSync(join(artifactRoot, `${prefix}/SKILL.md`)).equals(
                    skillBytes,
                ),
                true,
            );
            const result = validateAgentSkill(join(artifactRoot, prefix), {
                mode: "cratis-passive-v1",
                pluginRoot: artifactRoot,
            });
            assert.equal(result.valid, true, entry.harnessId);
            assert.equal(
                walk(artifactRoot).some((path) =>
                    path.startsWith(`skills/${skillName}/`),
                ),
                false,
                `${entry.harnessId} contains a duplicate discovery copy`,
            );
        }
        assert.equal(
            walk(join(root, "grok")).some((path) =>
                path.startsWith(".grok/skills/"),
            ),
            false,
        );
        assert.equal(
            walk(join(root, "grok-native-agent-skills")).some((path) =>
                path.startsWith("plugins/"),
            ),
            false,
        );
    });
});

test("Agent Plugins family rejects wrong roots, duplicates, extra files, stale or unknown manifests, unsupported components, links, special files, collisions, and byte drift", () => {
    const target = expected.agentPluginRoots[0].outputRoot;
    assertProjectedMutation((root) =>
        renameSync(join(root, target), join(root, `${target}-wrong`)),
    );
    assertProjectedMutation((root) =>
        cpSync(
            join(root, target, "skills"),
            join(root, target, ".agents/skills"),
            { recursive: true },
        ),
    );
    assertProjectedMutation((root) =>
        writeFileSync(join(root, target, "extra.txt"), "extra\n"),
    );
    assertProjectedMutation((root) => {
        const path = join(root, target, "plugin.json");
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        manifest.version = "1.2.2";
        writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    });
    withCandidate(({ root }) => {
        const path = join(root, target, "plugin.json");
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        manifest.permissions = {};
        writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
        const result = validateCratisPassiveProfile(join(root, target), {
            profileId: "cratis",
            version: "1.2.3",
        });
        assert(
            result.diagnostics.some(
                (entry) => entry.code === "AP_MANIFEST_UNKNOWN_FIELD",
            ),
        );
        assert.equal(result.releaseBlocking, true);
    });
    assertProjectedMutation((root) =>
        writeFileSync(join(root, target, "commands.md"), "unsafe\n"),
    );
    assertProjectedMutation((root) =>
        symlinkSync("plugin.json", join(root, target, "linked-plugin.json")),
    );
    if (process.platform !== "win32") {
        assertProjectedMutation((root) => {
            const fifo = join(root, target, "special.fifo");
            assert.equal(spawnSync("mkfifo", [fifo]).status, 0);
        });
    }
    assert.throws(
        () =>
            createLogicalTree({
                files: [
                    { path: "plugin.json", content: Buffer.from("a") },
                    { path: "PLUGIN.json", content: Buffer.from("b") },
                ],
            }),
        /collision/,
    );
    assertProjectedMutation((root) =>
        writeFileSync(
            join(root, target, `skills/${skillName}/SKILL.md`),
            `${skillBytes.toString()}drift\n`,
        ),
    );
});

test("direct Agent Skills family rejects wrong roots, duplicate copies, frontmatter transforms, extras, unsupported components, links, special files, collisions, and byte drift", () => {
    const entry = expected.agentSkillRoots[0];
    const target = entry.outputRoot;
    assertProjectedMutation((root) =>
        renameSync(join(root, target), join(root, `${target}-wrong`)),
    );
    assertProjectedMutation((root) =>
        cpSync(
            join(root, target, entry.discoveryRoot),
            join(root, target, ".duplicate"),
            { recursive: true },
        ),
    );
    assertProjectedMutation((root) => {
        const path = join(
            root,
            target,
            entry.discoveryRoot,
            "skills",
            skillName,
            "SKILL.md",
        );
        writeFileSync(
            path,
            skillBytes
                .toString()
                .replace("description:", "compatibility: host\ndescription:"),
        );
    });
    assertProjectedMutation((root) =>
        writeFileSync(join(root, target, "extra.txt"), "extra\n"),
    );
    assertProjectedMutation((root) =>
        writeFileSync(join(root, target, "scripts.sh"), "exit 0\n"),
    );
    assertProjectedMutation((root) =>
        symlinkSync(
            "SKILL.md",
            join(
                root,
                target,
                entry.discoveryRoot,
                "skills",
                skillName,
                "linked.md",
            ),
        ),
    );
    if (process.platform !== "win32") {
        assertProjectedMutation((root) => {
            const fifo = join(
                root,
                target,
                entry.discoveryRoot,
                "skills",
                skillName,
                "special.fifo",
            );
            assert.equal(spawnSync("mkfifo", [fifo]).status, 0);
        });
    }
    assert.throws(
        () =>
            createLogicalTree({
                files: [
                    {
                        path: ".agents/skills/example/SKILL.md",
                        content: Buffer.from("a"),
                    },
                    {
                        path: ".AGENTS/skills/example/SKILL.md",
                        content: Buffer.from("b"),
                    },
                ],
            }),
        /collision/,
    );
    assertProjectedMutation((root) =>
        writeFileSync(
            join(
                root,
                target,
                entry.discoveryRoot,
                "skills",
                skillName,
                "LICENSE",
            ),
            "drift\n",
        ),
    );
});
