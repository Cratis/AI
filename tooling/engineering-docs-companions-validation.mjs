#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const addRoot = "engineering/skills/cratis-engineering-docs-add-page";
const editRoot = "engineering/skills/cratis-engineering-docs-edit-page";
const evaluationRoot = "evals/cratis-engineering-docs-companions";
const caseIds = [
    "A01",
    "A02",
    "A03",
    "A04",
    "A05",
    "A06",
    "E01",
    "E02",
    "E03",
    "E04",
    "E05",
    "E06",
];
const decisions = {
    A01: ["PLACE_PRODUCT_PAGE", "PLACEMENT_INPUT_COMPLETE"],
    A02: ["PLACE_SITE_PAGE", "SITE_PLACEMENT_INPUT_COMPLETE"],
    A03: ["DEFER_TO_EDIT_PAGE", "PAGE_ALREADY_EXISTS"],
    A04: ["BLOCK", "OWNERSHIP_OR_DESTINATION_UNRESOLVED"],
    A05: ["DEFER_TO_VISUAL_QA", "VISUAL_REVIEW_REQUEST"],
    A06: ["SKIP", "NON_CRATIS_DOCUMENTATION"],
    E01: ["LOCATE_EDIT_VERIFY", "EXISTING_SOURCE_IDENTIFIED"],
    E02: ["SEARCH_LOCATE_EDIT_VERIFY", "SOURCE_SEARCH_REQUIRED"],
    E03: ["DEFER_TO_ADD_PAGE", "PAGE_DOES_NOT_EXIST"],
    E04: ["DEFER_TO_AUTHORING", "SUBSTANTIAL_CONTENT_DESIGN_REQUIRED"],
    E05: ["DEFER_TO_VISUAL_QA", "VISUAL_REVIEW_REQUEST"],
    E06: ["BLOCK", "MISSING_FIRST_PARTY_PRODUCT_AUTHORITY"],
};
const digests = {
    [`${addRoot}/SKILL.md`]:
        "5dff5ee0dcc317ff77f1f2027d8857c13d599d86344ac13b498bc4aad68f1f47",
    [`${addRoot}/LICENSE`]:
        "4da4b2010f3bf808be0595b698fd786ad167c778302e3c73918075750b1674ad",
    [`${addRoot}/references/ownership-and-navigation.md`]:
        "924d9d1683cc0ab9c4b73d7a9630b662da1a45498b55ca2a51eb4753dce372f1",
    [`${editRoot}/SKILL.md`]:
        "efb527496bc8a6e0ed5c222fb1fd216bfb6cbc75a7fd178c636d4200e8b27fb0",
    [`${editRoot}/LICENSE`]:
        "4da4b2010f3bf808be0595b698fd786ad167c778302e3c73918075750b1674ad",
    [`${editRoot}/references/source-discovery.md`]:
        "cd992bd3fd68c6e88211093795a987fcf72b2d294eb99ba58036fde210066fd3",
    [`${evaluationRoot}/assertions.json`]:
        "095eac6d798f817991fabd1f8dd988d32545223c7f3818a66ff8d544cb7b53a9",
    [`${evaluationRoot}/baseline.md`]:
        "e76e30d0349a7e178d821d05796b17b161deaf814cf77e885062320eb86e8fdf",
    [`${evaluationRoot}/cases.jsonl`]:
        "adfe988856479a8db31c8085a6c241d4c51644b6a7f681c84bcd5d14addeb6d1",
};

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function safePath(path) {
    return (
        typeof path === "string" &&
        !isAbsolute(path) &&
        !path.includes("\\") &&
        path
            .split("/")
            .every((segment) => segment && segment !== "." && segment !== "..")
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

function inventory(repositoryRoot, path, expected, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const absolute = join(root, path);
        const entries = readdirSync(absolute, { withFileTypes: true });
        const names = entries.map((entry) => entry.name).sort();
        if (
            JSON.stringify(names) !== JSON.stringify([...expected].sort()) ||
            entries.some((entry) => !entry.isFile() && !entry.isDirectory())
        )
            errors.push(`${path}: inventory changed`);
    } catch {
        errors.push(`${path}: inventory unavailable`);
    }
}

function readJson(repositoryRoot, path, errors) {
    const content = readContained(repositoryRoot, path, 131072, errors);
    if (content === null) return null;
    try {
        return JSON.parse(content);
    } catch {
        errors.push(`${path}: invalid JSON`);
        return null;
    }
}

function frontmatter(markdown) {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return null;
    return new Map(
        match[1].split("\n").map((line) => {
            const separator = line.indexOf(":");
            return separator > 0
                ? [
                      line.slice(0, separator).trim(),
                      line.slice(separator + 1).trim(),
                  ]
                : ["", ""];
        }),
    );
}

function validateSkill(
    repositoryRoot,
    root,
    name,
    reference,
    requiredRoutes,
    errors,
) {
    inventory(
        repositoryRoot,
        root,
        ["LICENSE", "SKILL.md", "references"],
        errors,
    );
    inventory(repositoryRoot, `${root}/references`, [reference], errors);
    const skill = readContained(
        repositoryRoot,
        `${root}/SKILL.md`,
        131072,
        errors,
    );
    if (skill === null) return;
    const metadata = frontmatter(skill);
    if (
        !metadata ||
        metadata.size !== 3 ||
        metadata.get("name") !== name ||
        metadata.get("license") !== "LICENSE" ||
        !metadata.get("description")
    )
        errors.push(`${name}:FRONTMATTER`);
    if (!skill.includes(`references/${reference}`))
        errors.push(`${name}:REFERENCE`);
    for (const route of requiredRoutes)
        if (!skill.includes(route)) errors.push(`${name}:ROUTING:${route}`);
    for (const forbidden of [
        "../../",
        ".ai/rules/",
        ".agents/PROJECT.md",
        "scripts/",
        "evals/",
    ])
        if (skill.includes(forbidden))
            errors.push(`${name}:FORBIDDEN:${forbidden}`);
}

export function validateEngineeringDocsCompanions(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    validateSkill(
        repositoryRoot,
        addRoot,
        "cratis-engineering-docs-add-page",
        "ownership-and-navigation.md",
        [
            "cratis-engineering-docs-edit-page",
            "cratis-engineering-docs-authoring",
            "cratis-engineering-docs-visual-qa",
            "Product/API authority is missing",
        ],
        errors,
    );
    validateSkill(
        repositoryRoot,
        editRoot,
        "cratis-engineering-docs-edit-page",
        "source-discovery.md",
        [
            "cratis-engineering-docs-add-page",
            "cratis-engineering-docs-authoring",
            "cratis-engineering-docs-visual-qa",
            "unverified product/API behavior",
        ],
        errors,
    );
    inventory(
        repositoryRoot,
        evaluationRoot,
        [
            "assertions.json",
            "baseline.md",
            "cases.jsonl",
            "evaluation-plan.json",
            "evaluation-review.json",
            "evaluation-summary.json",
            "frozen-prompt.md",
            "grading.json",
            "held-out-cases.jsonl",
            "held-out-evaluation-plan.json",
            "held-out-grading.json",
            "held-out-prompt.md",
            "held-out-runs",
            "runs",
        ],
        errors,
    );
    for (const [path, digest] of Object.entries(digests)) {
        const content = path.endsWith(".json")
            ? readJson(repositoryRoot, path, errors) &&
              readContained(repositoryRoot, path, 131072, errors)
            : readContained(repositoryRoot, path, 131072, errors);
        if (content !== null && sha256(content) !== digest)
            errors.push(`${path}: digest changed`);
    }
    const assertions = readJson(
        repositoryRoot,
        `${evaluationRoot}/assertions.json`,
        errors,
    );
    if (
        !assertions ||
        assertions.targets !== 2 ||
        assertions.positiveCases !== 4 ||
        assertions.negativeCases !== 8 ||
        assertions.totalCases !== 12 ||
        assertions.heldOutCases !== 12 ||
        assertions.modelRuns !== 16 ||
        assertions.targetApproval !== false ||
        assertions.installationEligible !== false ||
        assertions.promotionEligible !== false
    )
        errors.push("ASSERTIONS");
    const casesContent = readContained(
        repositoryRoot,
        `${evaluationRoot}/cases.jsonl`,
        524288,
        errors,
    );
    const cases = [];
    if (casesContent !== null) {
        for (const [index, line] of casesContent
            .split(/\r?\n/)
            .filter(Boolean)
            .entries()) {
            try {
                cases.push(JSON.parse(line));
            } catch {
                errors.push(
                    `${evaluationRoot}/cases.jsonl:${index + 1}: invalid JSON`,
                );
            }
        }
    }
    if (
        JSON.stringify(cases.map((item) => item?.id).sort()) !==
        JSON.stringify(caseIds)
    )
        errors.push("CASE_INVENTORY");
    for (const testCase of cases) {
        const expected = decisions[testCase?.id];
        if (
            !testCase ||
            !expected ||
            ![addRoot.split("/").at(-1), editRoot.split("/").at(-1)].includes(
                testCase.targetId,
            ) ||
            !["positive", "negative"].includes(testCase.kind) ||
            typeof testCase.prompt !== "string" ||
            testCase.expected?.decision !== expected[0] ||
            testCase.expected?.reason !== expected[1]
        )
            errors.push(`${testCase?.id ?? "UNKNOWN"}:CASE_ORACLE`);
    }
    return [...new Set(errors)].sort();
}

function main() {
    const errors = validateEngineeringDocsCompanions();
    if (errors.length) {
        process.stderr.write(
            `Engineering docs companion validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Engineering docs companion validation passed: 12 calibration cases, 12 held-out cases, 16 model runs.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
