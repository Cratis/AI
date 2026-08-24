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

test("generated human catalog exposes exact public and engineering package state", () => {
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
    for (const capability of catalog.capabilities) {
        const target = targets.find(
            (candidate) => candidate.id === capability.id,
        );
        assert.equal(capability.approvalState, target.approval.state);
        assert.equal(capability.runtimeEligible, target.includeInRuntime);
        assert(
            capability.relatedTargetIds.every((targetId) =>
                targets.some((candidate) => candidate.id === targetId),
            ),
        );
    }
    assert.deepEqual(
        catalog.capabilities
            .filter((capability) => capability.runtimeEligible)
            .map((capability) => capability.id),
        ["cratis-fundamentals-concept"],
    );
    const fundamentals = catalog.profiles.find(
        (profile) => profile.id === "public-fundamentals",
    );
    assert.equal(fundamentals.displayName, "Cratis Fundamentals");
    assert.match(fundamentals.description, /Strongly typed Cratis/);
    assert.equal(fundamentals.materialization, "installable-package");
    assert.equal(fundamentals.installable, true);
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
    assert.match(markdown, /## Packages and profiles/);
    assert.match(markdown, /### Cratis Fundamentals/);
    assert.match(markdown, /## Capabilities/);
    assert.match(markdown, /#### Trust and effects/);
    assert.match(markdown, /\*\*Approval:\*\* approved/);
    assert.match(markdown, /\*\*Approval:\*\* candidate/);
    assert.match(markdown, /\*\*Runtime eligible:\*\* yes/);
    assert.match(markdown, /\*\*Runtime eligible:\*\* no/);
    assert.match(markdown, /Unclassified —/);
});
