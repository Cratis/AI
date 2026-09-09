// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { validateAgainstSchema } from "../catalog-validation.mjs";
import { distributionPointerOutputs } from "../component-catalog-validation.mjs";

// The four marketplace manifests are hand-authored files committed on the
// default branch. There is no generator, no staged tree, and no ref to inject:
// every plugin resolves a real directory in this repository on its default
// branch, so what a host installs is exactly what a reviewer reads here.
const pointerManifestPaths = [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    ".cursor-plugin/marketplace.json",
    ".github/plugin/marketplace.json",
];

// `engineering/` carries a real plugin.json per host (verified against
// github/copilot-plugins' accepted microsoft/work-iq listing), because its
// plugin root is a wrapper directory with skills nested one level under it —
// the default-discovery shape, outside any watched canonical-source root.
//
// `skills/` cannot do the same yet: the marketplace source.path for "cratis"
// IS the watched `skills` canonical-source root itself (every entry under it
// is owned 1:1 by a single skill component), so a plugin.json placed there
// trips "unmodeled canonical source" in component-catalog.spec.mjs. Giving
// "cratis" a real plugin.json needs a repository-structure decision (nest
// skills under a wrapper, matching engineering/) — not a catalog workaround.
// Until then it keeps the strict:false + skills:"./" shim.
const expectedPlugins = [
    { name: "cratis", path: "skills", skills: "./", hasPluginManifest: false },
    {
        name: "cratis-engineering",
        path: "engineering",
        skills: "./skills",
        hasPluginManifest: true,
    },
];

// The one version string every plugin.json and every marketplace entry must
// carry. A single constant here means a partial bump fails this spec instead
// of drifting silently.
const PLUGIN_VERSION = "0.1.0";

// The four per-host plugin-manifest locations, verified against a real
// accepted plugin (microsoft/work-iq, listed in github/copilot-plugins).
const pluginManifestDirs = [
    ".claude-plugin",
    ".codex-plugin",
    ".cursor-plugin",
    ".github/plugin",
];

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

test("every marketplace manifest installs Cratis/AI from its default branch", () => {
    for (const path of pointerManifestPaths) {
        assert(existsSync(path), path);
        const manifest = readJson(path);
        assert.equal(manifest.name, "cratis", path);
        assert.deepEqual(
            manifest.plugins.map((plugin) => plugin.name),
            expectedPlugins.map((plugin) => plugin.name),
            path,
        );
        for (const [index, plugin] of manifest.plugins.entries()) {
            const expected = expectedPlugins[index];
            assert.deepEqual(
                plugin.source,
                {
                    source: "github",
                    repo: "Cratis/AI",
                    path: expected.path,
                },
                `${path}: ${plugin.name}`,
            );
            // No ref: a host resolves the default branch. A pinned ref would
            // reintroduce the release-tag machinery this repository removed.
            assert.equal(plugin.source.ref, undefined, path);
            assert.equal(plugin.version, PLUGIN_VERSION, path);
            if (expected.hasPluginManifest) {
                // A real plugin.json exists, so strict (default true)
                // applies and no skills override is needed here.
                assert.equal(plugin.strict, undefined, path);
                assert.equal(plugin.skills, undefined, path);
            } else {
                // No plugin.json yet — the marketplace entry is still the
                // whole definition.
                assert.equal(plugin.strict, false, path);
                assert.equal(plugin.skills, expected.skills, path);
            }
        }
    }
});

test("each declared skills path is a real directory holding SKILL.md files", () => {
    for (const { path, skills } of expectedPlugins) {
        const root = `${path}/${skills}`.replace(/\/\.\/?$/u, "");
        const names = readdirSync(root, { withFileTypes: true })
            // Dotdirs here are per-host plugin-manifest roots (.claude-plugin,
            // .codex-plugin, .cursor-plugin, .github), not skills.
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
            .map((entry) => entry.name);
        assert(names.length > 0, root);
        for (const name of names)
            assert(existsSync(`${root}/${name}/SKILL.md`), `${root}/${name}`);
    }
});

test("each plugin root that can carry a plugin.json has a matching one for every host", () => {
    for (const { name, path, skills, hasPluginManifest } of expectedPlugins) {
        for (const dir of pluginManifestDirs) {
            const manifestPath = `${path}/${dir}/plugin.json`;
            if (!hasPluginManifest) {
                assert.equal(existsSync(manifestPath), false, manifestPath);
                continue;
            }
            assert(existsSync(manifestPath), manifestPath);
            const plugin = readJson(manifestPath);
            assert.equal(plugin.name, name, manifestPath);
            assert.equal(plugin.version, PLUGIN_VERSION, manifestPath);
            assert.equal(plugin.skills, skills, manifestPath);
        }
    }
});

test("pointer manifests are owned by distribution, not by a host projection", () => {
    assert.deepEqual([...distributionPointerOutputs].sort(), pointerManifestPaths);
    const requirements = readJson("distribution/marketplace-requirements.json");
    const requiredRoots = new Set(
        requirements.requirements.flatMap(
            (requirement) => requirement.requiredRoots,
        ),
    );
    for (const path of pointerManifestPaths)
        assert(requiredRoots.has(path), path);
    const inventoryGenerator = readFileSync(
        "tooling/generate-repository-inventory.mjs",
        "utf8",
    );
    assert(inventoryGenerator.includes('id: "marketplace-pointer-manifests"'));
    for (const path of pointerManifestPaths)
        assert(inventoryGenerator.includes(`"${path}"`), path);
});

test("no install command pins a removed release tag or distribution ref", () => {
    const requirements = readJson("distribution/marketplace-requirements.json");
    for (const requirement of requirements.requirements)
        for (const command of [
            ...requirement.installCommands,
            ...requirement.updateCommands,
            ...requirement.uninstallCommands,
        ]) {
            assert.equal(
                command.includes("dist/v"),
                false,
                `${requirement.id}: ${command}`,
            );
            assert.equal(
                command.includes("Cratis/AI.Distribution"),
                false,
                `${requirement.id}: ${command}`,
            );
        }
});

test("public evaluation policy closes every target and denies by default", () => {
    const policy = readJson("distribution/public-evaluation-eligibility.json");
    const schema = readJson(
        "distribution/public-evaluation-eligibility.schema.json",
    );
    const publicTargetIds = readJson("catalog/v2/targets.json")
        .targets.filter((target) => target.audience === "public")
        .map((target) => target.id)
        .sort();
    assert.deepEqual(validateAgainstSchema(policy, schema, schema), []);
    assert.equal(policy.defaultPolicy, "deny");
    assert.equal(policy.approval.state, "approved-for-unsupported-evaluation");
    assert.equal(policy.approval.reviewer, "woksin");
    assert.equal(policy.eligibleTargetIds.length, 29);
    assert.deepEqual(
        [
            ...policy.eligibleTargetIds,
            ...policy.excludedTargets.map((entry) => entry.targetId),
        ].sort(),
        publicTargetIds,
    );
    assert.equal(policy.installationSupported, false);
    assert.equal(policy.behaviorSupported, false);
    assert.equal(policy.supportGranted, false);
    assert.equal(policy.promotionEligible, false);
});
