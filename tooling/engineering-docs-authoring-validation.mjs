#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    lstatSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skillRoot = "engineering/skills/cratis-engineering-docs-authoring";
const evaluationRoot = "evals/cratis-engineering-docs-authoring";
const caseIds = ["N01", "N02", "N03", "N04", "N05", "P01", "P02", "P03", "P04"];
const expectedDecisions = {
    P01: ["AUTHOR_CONTENT", "TUTORIAL_INPUT_COMPLETE", "TUTORIAL"],
    P02: ["AUTHOR_CONTENT", "HOW_TO_INPUT_COMPLETE", "HOW_TO"],
    P03: ["AUTHOR_CONTENT", "EXPLANATION_INPUT_COMPLETE", "EXPLANATION"],
    P04: ["AUTHOR_CONTENT", "REFERENCE_INPUT_COMPLETE", "REFERENCE"],
    N01: ["DEFER_TO_ADD_PAGE", "PLACEMENT_OR_NAVIGATION_UNRESOLVED", null],
    N02: ["DEFER_TO_EDIT_PAGE", "EXISTING_SOURCE_UNRESOLVED", null],
    N03: ["DEFER_TO_VISUAL_QA", "VISUAL_REVIEW_REQUEST", null],
    N04: ["BLOCK", "MISSING_FIRST_PARTY_PRODUCT_AUTHORITY", null],
    N05: ["SKIP", "NON_CRATIS_DOCUMENTATION", null],
};
const digests = {
    "SKILL.md": "014f2e7b55d4f1a7dd982e4e352cffc8cfa078a262056bb55b76eb2b81da0791",
    "LICENSE": "4da4b2010f3bf808be0595b698fd786ad167c778302e3c73918075750b1674ad",
    "references/site-format.md": "b50039ede61ff439f6836798ef4f6b028b8d3d5567db10d5170acb5df17b18e1",
    "../../evals/cratis-engineering-docs-authoring/assertions.json": "8343ee25859bf91ada665aad6bab1c936c354f0bd9d8026456c1740a6206abbb",
    "../../evals/cratis-engineering-docs-authoring/baseline.md": "ce50ac6b804531521f8ca31ce38db5171866e586dd65fcad40fb136d3722f131",
};
const casesDigest = "4a3eb583eba0c280bb1434fa2a915f91a92d0aa54793b049635f7edad0a326c6";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function safePath(path) {
    return (
        typeof path === "string" &&
        !isAbsolute(path) &&
        !path.includes("\\") &&
        path.split("/").every(segment => segment && segment !== "." && segment !== "..")
    );
}

function readContained(repositoryRoot, path, maximumBytes, errors) {
    try {
        if (!safePath(path)) throw new Error("unsafe path");
        const root = realpathSync(repositoryRoot);
        const absolute = join(root, path);
        const stat = lstatSync(absolute);
        if (!stat.isFile() || stat.size > maximumBytes)
            throw new Error("regular bounded file required");
        const real = realpathSync(absolute);
        const fromRoot = relative(root, real);
        if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("path escape");
        return readFileSync(real, "utf8");
    } catch {
        errors.push(`${path}: unreadable bounded file`);
        return null;
    }
}

function readJson(repositoryRoot, path, errors) {
    const content = readContained(repositoryRoot, path, 131072, errors);
    if (content === null) return null;
    try {
        return { content, value: JSON.parse(content) };
    } catch {
        errors.push(`${path}: invalid JSON`);
        return null;
    }
}

function inventory(repositoryRoot, path, expected, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const absolute = join(root, path);
        if (!lstatSync(absolute).isDirectory()) throw new Error("directory required");
        const entries = readdirSync(absolute, { withFileTypes: true });
        const names = entries.map(entry => entry.name).sort();
        if (
            JSON.stringify(names) !== JSON.stringify([...expected].sort()) ||
            entries.some(entry => !entry.isFile() && !entry.isDirectory())
        )
            errors.push(`${path}: inventory changed`);
    } catch {
        errors.push(`${path}: inventory unavailable`);
    }
}

function frontmatter(markdown) {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return null;
    const values = new Map();
    for (const line of match[1].split("\n")) {
        const separator = line.indexOf(":");
        if (separator < 1) return null;
        values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
    return values;
}

function parseCases(repositoryRoot, errors) {
    const path = `${evaluationRoot}/cases.jsonl`;
    const content = readContained(repositoryRoot, path, 524288, errors);
    if (content === null) return [];
    if (sha256(content) !== casesDigest) errors.push("CASES_DIGEST");
    const cases = [];
    for (const [index, line] of content.split(/\r?\n/).filter(Boolean).entries()) {
        try {
            cases.push(JSON.parse(line));
        } catch {
            errors.push(`${path}:${index + 1}: invalid JSON`);
        }
    }
    return cases;
}

export function validateEngineeringDocsAuthoring(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    inventory(repositoryRoot, skillRoot, ["LICENSE", "SKILL.md", "references"], errors);
    inventory(repositoryRoot, `${skillRoot}/references`, ["site-format.md"], errors);
    inventory(repositoryRoot, evaluationRoot, ["assertions.json", "baseline.md", "cases.jsonl"], errors);

    for (const [path, digest] of Object.entries(digests)) {
        const resolved = path.startsWith("../../")
            ? path.slice(6)
            : `${skillRoot}/${path}`;
        const content = resolved.endsWith(".json")
            ? readJson(repositoryRoot, resolved, errors)?.content
            : readContained(repositoryRoot, resolved, 131072, errors);
        if (content !== null && content !== undefined && sha256(content) !== digest)
            errors.push(`${resolved}: digest changed`);
    }

    const skill = readContained(repositoryRoot, `${skillRoot}/SKILL.md`, 131072, errors);
    if (skill !== null) {
        const metadata = frontmatter(skill);
        if (
            !metadata ||
            metadata.size !== 3 ||
            metadata.get("name") !== "cratis-engineering-docs-authoring" ||
            !metadata.get("description")?.includes("Draft accurate Cratis documentation") ||
            metadata.get("license") !== "LICENSE"
        )
            errors.push("SKILL_FRONTMATTER");
        for (const forbidden of [
            "../../",
            ".ai/rules/",
            ".agents/PROJECT.md",
            "scripts/",
            "evals/",
        ])
            if (skill.includes(forbidden)) errors.push(`SKILL_FORBIDDEN:${forbidden}`);
        if (!skill.includes("[site-format.md](references/site-format.md)"))
            errors.push("SKILL_REFERENCE");
        for (const decision of [
            "cratis-engineering-docs-add-page",
            "cratis-engineering-docs-edit-page",
            "cratis-engineering-docs-visual-qa",
            "missing authority",
        ])
            if (!skill.toLocaleLowerCase("en-US").includes(decision.toLocaleLowerCase("en-US")))
                errors.push(`SKILL_ROUTING:${decision}`);
    }

    const assertions = readJson(
        repositoryRoot,
        `${evaluationRoot}/assertions.json`,
        errors,
    )?.value;
    if (
        !assertions ||
        assertions.positiveCases !== 4 ||
        assertions.negativeCases !== 5 ||
        assertions.totalCases !== 9 ||
        assertions.modelRuns !== 0 ||
        assertions.targetApproval !== false ||
        assertions.installationEligible !== false ||
        assertions.promotionEligible !== false
    )
        errors.push("ASSERTIONS");

    const cases = parseCases(repositoryRoot, errors);
    if (JSON.stringify(cases.map(item => item?.id).sort()) !== JSON.stringify(caseIds))
        errors.push("CASE_INVENTORY");
    for (const testCase of cases) {
        if (
            !testCase ||
            !caseIds.includes(testCase.id) ||
            !["positive", "negative"].includes(testCase.kind) ||
            typeof testCase.prompt !== "string" ||
            !testCase.context ||
            !testCase.expected
        ) {
            errors.push(`${testCase?.id ?? "UNKNOWN"}:CASE_FIELDS`);
            continue;
        }
        const expected = expectedDecisions[testCase.id];
        if (
            testCase.expected.decision !== expected[0] ||
            testCase.expected.reason !== expected[1] ||
            testCase.expected.documentType !== expected[2]
        )
            errors.push(`${testCase.id}:DECISION_ORACLE`);
        if (
            testCase.expected.decision === "AUTHOR_CONTENT" &&
            (testCase.context.authoritativeSourceStatus !== "VERIFIED" ||
                typeof testCase.context.owningRepository !== "string" ||
                typeof testCase.context.destination !== "string")
        )
            errors.push(`${testCase.id}:AUTHORING_INPUT`);
    }
    return [...new Set(errors)].sort();
}

function main() {
    const errors = validateEngineeringDocsAuthoring();
    if (errors.length) {
        process.stderr.write(
            `Engineering docs authoring validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Engineering docs authoring validation passed: 9 cases, zero model runs.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
