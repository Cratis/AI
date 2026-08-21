// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    readNavigatorCases,
    validateNavigatorPilot,
} from "../navigator-pilot-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function withRepositoryFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-navigator-"));
    try {
        for (const path of ["catalog", "evals", "pilots"])
            cpSync(join(repositoryRoot, path), join(root, path), {
                recursive: true,
            });
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("navigator pilot contract and canonical cases pass", () => {
    assert.deepEqual(validateNavigatorPilot(), []);
    const cases = readNavigatorCases();
    assert.equal(cases.length, 28);
    assert.equal(cases.filter((testCase) => testCase.kind === "positive").length, 12);
    assert.equal(cases.filter((testCase) => testCase.kind === "negative").length, 16);
});

test("navigator pilot cannot claim runtime or effects", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "pilots/cratis-navigator/metadata.draft.json");
        const metadata = JSON.parse(readFileSync(path, "utf8"));
        metadata.runtimeEligible = true;
        metadata.repositoryWritesAllowed = true;
        writeFileSync(path, JSON.stringify(metadata));
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("absent from runtime")));
        assert(errors.some((error) => error.includes("effect-free")));
    });
});

test("navigator pilot routes cannot invent evidence or approval", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "pilots/cratis-navigator/routes.draft.json");
        const routes = JSON.parse(readFileSync(path, "utf8"));
        routes.routes[0].evidenceState = "verified";
        routes.routes[0].evidenceRefs = ["invented"];
        routes.routes[0].approvalState = "approved";
        writeFileSync(path, JSON.stringify(routes));
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("cannot claim evidence")));
        assert(errors.some((error) => error.includes("cannot claim approval")));
    });
});

test("navigator pilot cases fail on extra output or performed invocation", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "evals/cratis-navigator/cases.jsonl");
        const cases = readNavigatorCases(root);
        cases[0].expected.unexpected = true;
        cases[0].expected.invocationPerformed = true;
        writeFileSync(path, `${cases.map((value) => JSON.stringify(value)).join("\n")}\n`);
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("unknown property unexpected")));
        assert(errors.some((error) => error.includes("cannot perform invocation")));
    });
});

test("navigator pilot cases preserve evidence precedence and lexical abstention", () => {
    const cases = new Map(readNavigatorCases().map((testCase) => [testCase.id, testCase]));
    assert.equal(cases.get("P07").expected.decision, "BLOCKED_UNVERIFIED");
    assert.equal(cases.get("P07").expected.requestedEffect, "executable");
    for (const id of ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08"])
        assert.equal(cases.get(id).expected.decision, "ABSTAIN");
    assert.equal(cases.get("N14").expected.decision, "REFUSE");
    assert.equal(cases.get("N16").expected.decision, "REFUSE");
});
