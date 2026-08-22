// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateEngineeringDocsCompanions } from "../engineering-docs-companions-validation.mjs";

const repositoryRoot = process.cwd();

function readCases(root = repositoryRoot) {
    return readFileSync(
        join(root, "evals/cratis-engineering-docs-companions/cases.jsonl"),
        "utf8",
    )
        .trim()
        .split("\n")
        .map(JSON.parse);
}

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-docs-companions-"));
    try {
        cpSync(join(repositoryRoot, "engineering"), join(root, "engineering"), {
            recursive: true,
        });
        cpSync(
            join(repositoryRoot, "evals/cratis-engineering-docs-companions"),
            join(root, "evals/cratis-engineering-docs-companions"),
            { recursive: true },
        );
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("engineering documentation companions and twelve cases pass", () => {
    assert.deepEqual(validateEngineeringDocsCompanions(), []);
    const cases = readCases();
    assert.equal(cases.length, 12);
    assert.equal(cases.filter((item) => item.kind === "positive").length, 4);
    assert.equal(cases.filter((item) => item.kind === "negative").length, 8);
});

test("add-page companion owns placement and routes near misses", () => {
    const skill = readFileSync(
        join(
            repositoryRoot,
            "engineering/skills/cratis-engineering-docs-add-page/SKILL.md",
        ),
        "utf8",
    );
    assert.match(skill, /^---\nname: cratis-engineering-docs-add-page\n/);
    assert(skill.includes("cratis-engineering-docs-edit-page"));
    assert(skill.includes("cratis-engineering-docs-authoring"));
    assert(skill.includes("cratis-engineering-docs-visual-qa"));
    assert(skill.includes("synchronized/generated product pages"));
    assert.equal(skill.includes(".ai/rules/"), false);
    assert.equal(skill.includes("../../"), false);
});

test("edit-page companion discovers authoritative source and avoids outputs", () => {
    const skill = readFileSync(
        join(
            repositoryRoot,
            "engineering/skills/cratis-engineering-docs-edit-page/SKILL.md",
        ),
        "utf8",
    );
    assert.match(skill, /^---\nname: cratis-engineering-docs-edit-page\n/);
    assert(skill.includes("cratis-engineering-docs-add-page"));
    assert(skill.includes("cratis-engineering-docs-authoring"));
    assert(skill.includes("cratis-engineering-docs-visual-qa"));
    assert(skill.includes("generated/synchronized product pages"));
    assert.equal(skill.includes(".ai/rules/"), false);
    assert.equal(skill.includes("../../"), false);
});

test("companion cases preserve new existing visual authority and scope routing", () => {
    const cases = new Map(readCases().map((item) => [item.id, item.expected]));
    assert.equal(cases.get("A01").decision, "PLACE_PRODUCT_PAGE");
    assert.equal(cases.get("A02").decision, "PLACE_SITE_PAGE");
    assert.equal(cases.get("A03").decision, "DEFER_TO_EDIT_PAGE");
    assert.equal(cases.get("A04").decision, "BLOCK");
    assert.equal(cases.get("A05").decision, "DEFER_TO_VISUAL_QA");
    assert.equal(cases.get("A06").decision, "SKIP");
    assert.equal(cases.get("E01").decision, "LOCATE_EDIT_VERIFY");
    assert.equal(cases.get("E02").decision, "SEARCH_LOCATE_EDIT_VERIFY");
    assert.equal(cases.get("E03").decision, "DEFER_TO_ADD_PAGE");
    assert.equal(cases.get("E04").decision, "DEFER_TO_AUTHORING");
    assert.equal(cases.get("E05").decision, "DEFER_TO_VISUAL_QA");
    assert.equal(cases.get("E06").decision, "BLOCK");
});

test("companion validation rejects executable payload and source coupling", () => {
    withFixture((root) => {
        const skillPath = join(
            root,
            "engineering/skills/cratis-engineering-docs-add-page/SKILL.md",
        );
        writeFileSync(
            skillPath,
            `${readFileSync(skillPath, "utf8")}\nRead ../../.ai/rules/docs.md and scripts/run.sh.\n`,
        );
        writeFileSync(
            join(
                root,
                "engineering/skills/cratis-engineering-docs-edit-page/run.sh",
            ),
            "echo forbidden\n",
        );
        const errors = validateEngineeringDocsCompanions(root);
        assert(
            errors.includes(
                "cratis-engineering-docs-add-page:FORBIDDEN:../../",
            ),
        );
        assert(
            errors.includes(
                "cratis-engineering-docs-add-page:FORBIDDEN:scripts/",
            ),
        );
        assert(
            errors.some((error) =>
                error.includes(
                    "engineering/skills/cratis-engineering-docs-edit-page: inventory changed",
                ),
            ),
        );
        assert(errors.some((error) => error.includes("digest changed")));
    });
});

test("companion validation rejects decision oracle drift", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/cratis-engineering-docs-companions/cases.jsonl",
        );
        const cases = readCases(root);
        cases.find((item) => item.id === "A04").expected.decision =
            "PLACE_PRODUCT_PAGE";
        writeFileSync(
            path,
            `${cases.map((item) => JSON.stringify(item)).join("\n")}\n`,
        );
        const errors = validateEngineeringDocsCompanions(root);
        assert(errors.includes("A04:CASE_ORACLE"));
        assert(errors.some((error) => error.includes("digest changed")));
    });
});
