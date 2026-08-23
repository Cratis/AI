// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const verification = readFileSync(
    ".github/workflows/verify-ai-corpus.yml",
    "utf8",
);

test("verification workflow covers every release-relevant source", () => {
    for (const path of [
        ".ai/**",
        ".agents/**",
        ".github/ISSUE_TEMPLATE/**",
        ".github/workflows/**",
        "AGENTS.md",
        "README.md",
        "Documentation/**",
        "catalog/**",
        "distribution/**",
        "engineering/**",
        "evals/**",
        "evidence/**",
        "pilots/**",
        "skills/**",
        "tooling/**",
    ]) {
        const occurrences = verification.split(`- "${path}"`).length - 1;
        assert.equal(occurrences, 2, path);
    }
});

test("legacy propagation workflows are inert and inherit no secrets", () => {
    for (const path of [
        ".github/workflows/propagate-copilot-instructions.yml",
        ".github/workflows/sync-copilot-instructions.yml",
    ]) {
        const workflow = readFileSync(path, "utf8");
        assert(workflow.includes("Retired -"));
        assert(workflow.includes("workflow_dispatch"));
        assert.equal(workflow.includes("uses: Cratis/Workflows/"), false);
        assert.equal(workflow.includes("secrets: inherit"), false);
        assert.equal(workflow.includes("push:"), false);
    }
});
