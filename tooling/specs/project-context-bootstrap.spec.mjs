// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
    bootstrapContents,
    canonicalProjectContextPath,
    legacyProjectContextPath,
    planProjectBootstraps,
    resolveProjectContext,
} from "../project-context-bootstrap.mjs";

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    "../..",
);
const fixturesRoot = join(repositoryRoot, "tooling/fixtures/project-context");
const fixture = (name) => join(fixturesRoot, name);

test("canonical project context wins when both canonical and legacy files exist", () => {
    const resolved = resolveProjectContext(fixture("both"));
    assert.equal(resolved.state, "canonical");
    assert.equal(resolved.relativePath, canonicalProjectContextPath);
    assert.equal(resolved.legacyAlsoExists, true);
    assert.match(resolved.content, /must win/);
    assert.doesNotMatch(resolved.content, /must not be combined/);
});

test("legacy project context is read only as a fallback", () => {
    const resolved = resolveProjectContext(fixture("framework-legacy"));
    assert.equal(resolved.state, "legacy-fallback");
    assert.equal(resolved.relativePath, legacyProjectContextPath);
    assert.match(resolved.content, /framework fixture/);
});

test("neither project-context file is a valid no-context state", () => {
    const resolved = resolveProjectContext(fixture("no-context"));
    assert.deepEqual(resolved, {
        state: "no-context",
        relativePath: undefined,
        content: undefined,
        legacyAlsoExists: false,
    });
    assert.deepEqual(planProjectBootstraps(fixture("no-context")).create, []);
});

test("bootstrap templates are minimal locators and contain no shared corpus policy", () => {
    const templates = bootstrapContents(canonicalProjectContextPath);
    assert.equal(templates["CLAUDE.md"], "@.cratis/PROJECT.md\n");
    assert.equal(templates["GEMINI.md"], "@.cratis/PROJECT.md\n");
    assert.match(templates["AGENTS.md"], /\.cratis\/PROJECT\.md/);
    for (const content of Object.values(templates)) {
        assert.doesNotMatch(
            content,
            /vertical slice|Chronicle|Cratis engineering|quality gate/i,
        );
    }
});

test("application and framework fixtures select the correct bootstrap import", () => {
    const application = planProjectBootstraps(fixture("application-canonical"));
    const framework = planProjectBootstraps(fixture("framework-legacy"));
    assert.equal(
        application.create.find((entry) => entry.path === "CLAUDE.md").content,
        "@.cratis/PROJECT.md\n",
    );
    assert.equal(
        framework.create.find((entry) => entry.path === "CLAUDE.md").content,
        "@.agents/PROJECT.md\n",
    );
});

test("existing project-owned bootstrap files are reported and never overwritten or combined", () => {
    const root = fixture("existing-bootstrap");
    const before = new Map(
        ["AGENTS.md", "CLAUDE.md", "GEMINI.md"].map((path) => [
            path,
            readFileSync(join(root, path), "utf8"),
        ]),
    );
    const plan = planProjectBootstraps(root);
    assert.deepEqual(plan.create, []);
    assert.deepEqual(
        plan.existing.map((entry) => entry.path).sort(),
        [...before.keys()].sort(),
    );
    for (const [path, content] of before) {
        assert.equal(readFileSync(join(root, path), "utf8"), content);
        assert.equal(
            plan.existing.find((entry) => entry.path === path).content,
            content,
        );
    }
});
