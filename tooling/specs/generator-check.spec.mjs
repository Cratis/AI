// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    generatorCheckExitCodes,
    runGeneratorCheck,
} from "../generator-check.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

// Every generator the README validation gate runs.
const gateGenerators = Object.freeze([
    "harness-registry.mjs",
    "generate-catalog-v2.mjs",
    "generate-support.mjs",
    "preview-readiness.mjs",
    "generate-ecosystem-artifact-coverage.mjs",
    "generate-human-catalog.mjs",
    "generate-repository-inventory.mjs",
]);

function runGenerator(name, argv = []) {
    return spawnSync(process.execPath, [join("tooling", name), ...argv], {
        cwd: repositoryRoot,
        encoding: "utf8",
    });
}

test("every gate generator only runs its main behavior when invoked directly", () => {
    for (const name of gateGenerators) {
        const source = readFileSync(join(repositoryRoot, "tooling", name), "utf8");
        assert(
            source.includes("fileURLToPath(import.meta.url)") &&
                source.includes("process.argv[1]"),
            `${name} executes on import instead of behind a main guard`,
        );
    }
});

test("importing a gate generator leaves the working tree untouched", () => {
    const before = execFileSync("git", ["status", "--porcelain"], {
        cwd: repositoryRoot,
        encoding: "utf8",
    });
    for (const name of gateGenerators) {
        const result = spawnSync(
            process.execPath,
            ["--input-type=module", "-e", `import './tooling/${name}'`],
            { cwd: repositoryRoot, encoding: "utf8" },
        );
        assert.equal(result.status, 0, `importing ${name} failed: ${result.stderr}`);
    }
    const after = execFileSync("git", ["status", "--porcelain"], {
        cwd: repositoryRoot,
        encoding: "utf8",
    });
    assert.equal(after, before);
});

test("every gate generator reports a current tree read-only", () => {
    for (const name of gateGenerators) {
        const result = runGenerator(name, ["--check"]);
        assert.equal(
            result.status,
            generatorCheckExitCodes.current,
            `${name} --check reported drift: ${result.stderr}`,
        );
    }
});

test("check mode names the drifting paths and exits one", () => {
    const outputs = new Map([
        ["README.md", "this is not what README.md contains"],
    ]);
    const written = [];
    const stderr = [];
    const original = [process.stdout.write, process.stderr.write];
    process.stdout.write = (chunk) => written.push(chunk) && true;
    process.stderr.write = (chunk) => stderr.push(chunk) && true;
    try {
        const code = runGeneratorCheck({
            name: "spec",
            root: repositoryRoot,
            build: () => outputs,
        });
        assert.equal(code, generatorCheckExitCodes.drift);
    } finally {
        [process.stdout.write, process.stderr.write] = original;
    }
    assert(stderr.join("").includes("- README.md"));
});

test("check mode separates could-not-run from drift", () => {
    const stderr = [];
    const original = process.stderr.write;
    process.stderr.write = (chunk) => stderr.push(chunk) && true;
    try {
        const code = runGeneratorCheck({
            name: "spec",
            root: repositoryRoot,
            build: () => {
                throw new Error("an input is unreadable");
            },
        });
        assert.equal(code, generatorCheckExitCodes.couldNotRun);
    } finally {
        process.stderr.write = original;
    }
    assert(stderr.join("").includes("could not run"));
});

test("check mode treats a missing output as drift rather than a pass", () => {
    const stderr = [];
    const original = process.stderr.write;
    process.stderr.write = (chunk) => stderr.push(chunk) && true;
    try {
        const code = runGeneratorCheck({
            name: "spec",
            root: repositoryRoot,
            build: () =>
                new Map([["catalog/v2/does-not-exist.json", "{}\n"]]),
        });
        assert.equal(code, generatorCheckExitCodes.drift);
    } finally {
        process.stderr.write = original;
    }
    assert(stderr.join("").includes("catalog/v2/does-not-exist.json"));
});
