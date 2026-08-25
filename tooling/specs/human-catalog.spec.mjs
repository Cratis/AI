// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "../catalog-ordering.mjs";
import {
    buildHumanCatalogOutputs,
    checkHumanCatalogOutputs,
    markdownText,
    writeHumanCatalogOutputsAtomically,
} from "../generate-human-catalog.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const outputRoot = join(repositoryRoot, "catalog/generated/human-catalog");

function readJson(name) {
    return JSON.parse(readFileSync(join(outputRoot, name), "utf8"));
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

const builtCatalog = buildHumanCatalogOutputs();

test("human catalog Markdown escapes metadata expression", () => {
    assert.equal(
        markdownText("<script> [link](url) *bold*\nheading"),
        "&lt;script&gt; \\[link\\](url) \\*bold\\* heading",
    );
});

test("generated human catalog is current and deterministic", () => {
    assert.doesNotThrow(() =>
        execFileSync(
            process.execPath,
            ["tooling/generate-human-catalog.mjs", "--check"],
            { cwd: repositoryRoot, stdio: "pipe" },
        ),
    );
});

test("human catalog check rejects extra generated files", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-human-catalog-"));
    const output = join(root, "output");
    try {
        const { contents } = builtCatalog;
        mkdirSync(output);
        for (const [path, content] of contents) {
            const destination = join(output, path);
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, content);
        }
        writeFileSync(join(output, "unexpected.txt"), "unexpected");
        assert.throws(
            () => checkHumanCatalogOutputs(contents, output),
            /file inventory is stale/,
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("human catalog publishes the manifest last and removes stale files", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-human-catalog-"));
    const output = join(root, "output");
    try {
        mkdirSync(output);
        writeFileSync(join(output, "old.txt"), "old");
        const { contents } = builtCatalog;
        writeHumanCatalogOutputsAtomically(contents, output);
        checkHumanCatalogOutputs(contents, output);
        assert.equal(existsSync(join(output, "old.txt")), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("human catalog manifest remains the activation pointer on interrupted publish", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-human-catalog-"));
    const output = join(root, "output");
    try {
        const { contents } = builtCatalog;
        writeHumanCatalogOutputsAtomically(contents, output);
        const activeManifest = readFileSync(join(output, "manifest.json"));
        const interrupted = new Map(contents);
        interrupted.set("catalog.json", Buffer.from("interrupted\n"));
        assert.throws(
            () =>
                writeHumanCatalogOutputsAtomically(interrupted, output, {
                    failAfterDataFiles: 2,
                }),
            /Injected failure/,
        );
        assert.equal(existsSync(output), true);
        assert.equal(
            readFileSync(join(output, "manifest.json")).equals(activeManifest),
            true,
        );
        assert.throws(
            () => checkHumanCatalogOutputs(contents, output),
            /is stale/,
        );
        writeHumanCatalogOutputsAtomically(contents, output);
        checkHumanCatalogOutputs(contents, output);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("generated human catalog exposes public and engineering packages and capabilities", () => {
    const catalog = readJson("catalog.json");
    const targets = JSON.parse(
        readFileSync(join(repositoryRoot, "catalog/v2/targets.json"), "utf8"),
    ).targets;
    const profileCatalog = JSON.parse(
        readFileSync(
            join(repositoryRoot, "distribution/profile-catalog.json"),
            "utf8",
        ),
    );
    const profiles = [
        ...profileCatalog.publicProfiles,
        ...profileCatalog.engineeringProfiles,
    ];
    assert.equal(catalog.capabilities.length, targets.length);
    assert.equal(catalog.profiles.length, profiles.length);
    assert.deepEqual(
        catalog.capabilities
            .map((capability) => capability.id)
            .sort(compareOrdinal),
        targets.map((target) => target.id).sort(compareOrdinal),
    );
    const firstEngineeringCapability = catalog.capabilities.findIndex(
        (capability) => capability.audience === "cratis-engineering",
    );
    assert(firstEngineeringCapability > 0);
    assert(
        catalog.capabilities
            .slice(0, firstEngineeringCapability)
            .every((capability) => capability.audience === "public"),
    );
    assert(
        catalog.capabilities
            .slice(firstEngineeringCapability)
            .every(
                (capability) => capability.audience === "cratis-engineering",
            ),
    );
    assert.deepEqual(
        new Set(catalog.capabilities.map((capability) => capability.audience)),
        new Set(["public", "cratis-engineering"]),
    );
    assert.deepEqual(
        new Set(catalog.profiles.map((profile) => profile.audience)),
        new Set(["public", "cratis-engineering"]),
    );
    assert(
        catalog.capabilities.every(
            (capability) =>
                capability.runtimeEligible === false &&
                capability.relatedTargetIds.every((targetId) =>
                    targets.some((target) => target.id === targetId),
                ),
        ),
    );
    const fundamentals = catalog.profiles.find(
        (profile) => profile.id === "public-fundamentals",
    );
    assert.equal(fundamentals.displayName, "Cratis Fundamentals");
    assert.match(fundamentals.description, /Strongly typed Cratis/);
    assert.equal(fundamentals.materialization, "candidate-package");
    assert(fundamentals.targetIds.includes("cratis-fundamentals-concept"));
    const engineeringDocumentation = catalog.profiles.find(
        (profile) => profile.id === "engineering-documentation",
    );
    assert.match(engineeringDocumentation.description, /documentation authoring/);
    assert(
        engineeringDocumentation.targetIds.includes(
            "cratis-engineering-docs-authoring",
        ),
    );
    const concept = catalog.capabilities.find(
        (capability) => capability.id === "cratis-fundamentals-concept",
    );
    assert(concept.profileIds.includes("public-fundamentals"));
    assert(concept.profileIds.includes("public-application"));
    assert.match(catalog.disclaimer, /does not grant runtime permission/);
    assert.equal(catalog.hostCoverage.length, 38);
    assert(catalog.hostCoverage.every((record) => record.supportClaim === false));
    assert.equal(
        catalog.hostCoverage.find((record) => record.ecosystemId === "roo-code")
            .coverage,
        "no-surface",
    );
    assert.equal(
        catalog.hostCoverage.find(
            (record) => record.ecosystemId === "amazon-q-developer",
        ).coverage,
        "migration",
    );
    assert.equal(
        catalog.hostCoverage.find((record) => record.ecosystemId === "aider")
            .coverage,
        "fallback",
    );
});

test("human catalog manifest binds every generated product file", () => {
    const manifest = readJson("manifest.json");
    assert.deepEqual(
        manifest.files.map((file) => file.path),
        ["CATALOG.md", "catalog.json"],
    );
    for (const file of manifest.files) {
        const content = readFileSync(join(outputRoot, file.path));
        assert.equal(content.length, file.size);
        assert.equal(sha256(content), file.sha256);
    }
    const catalog = readJson("catalog.json");
    assert.equal(manifest.inputDigest, catalog.inputDigest);
});

test("human catalog Markdown separates approval and trust visibly", () => {
    const markdown = readFileSync(join(outputRoot, "CATALOG.md"), "utf8");
    assert.match(markdown, /^# Cratis AI package and capability catalog/m);
    assert.match(markdown, /## Researched host coverage/);
    assert.match(markdown, /standard-compatible/);
    assert.match(markdown, /native-planned/);
    assert.match(markdown, /no-surface/);
    assert.match(markdown, /## Packages and profiles/);
    assert.match(markdown, /### Cratis Fundamentals/);
    assert.match(markdown, /## Capabilities/);
    assert.match(markdown, /#### Trust and effects/);
    assert.match(markdown, /\*\*Approval:\*\* candidate/);
    assert.match(markdown, /\*\*Runtime eligible:\*\* no/);
    assert.match(markdown, /Unclassified —/);
});
