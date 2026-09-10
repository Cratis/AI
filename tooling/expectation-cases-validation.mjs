#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Typed expectation cases for skill evaluations (Cratis/AI#261). A case file
// under evals/<capability>/expectations.json that carries schemaVersion 1
// opts in and is validated by validate-catalogs --basic: schema shape first,
// then the coverage discipline the protocol requires — one smoke, edge,
// negative, and disclosure tag, and one adversarial case each for authority,
// privacy, staleness, and import-prompt-injection. A case set that cannot
// pass vacuously is the point (guards-and-fuses).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export const expectationCaseSchemaPath =
    "distribution/expectation-case.schema.json";
const evalsRoot = "evals";

const requiredCoverageTags = ["smoke", "edge", "negative", "disclosure"];
const requiredAdversarialTags = [
    "authority",
    "privacy",
    "staleness",
    "import-prompt-injection",
];

function expectationCaseFiles(root) {
    const directory = join(root, evalsRoot);
    if (!existsSync(directory)) return [];
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = join(directory, entry.name, "expectations.json");
        if (existsSync(candidate) && statSync(candidate).isFile())
            files.push(candidate);
    }
    return files.sort();
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function validateExpectationCases(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    const schemaPath = join(repositoryRoot, expectationCaseSchemaPath);
    const schema = readJson(schemaPath);
    errors.push(
        ...validateSchemaVocabulary(
            schema,
            "expectation-case.schema.json",
        ),
    );
    const files = expectationCaseFiles(repositoryRoot);
    if (files.length === 0) return errors;
    const caseIdsByCapability = new Map();
    for (const path of files) {
        const document = readJson(path);
        if (document.schemaVersion !== 1) continue; // not opted in
        errors.push(
            ...validateAgainstSchema(
                document,
                schema,
                schema,
                path.slice(repositoryRoot.length + 1),
            ),
        );
        const ids = new Set();
        for (const case_ of document.cases ?? []) {
            if (ids.has(case_.id))
                errors.push(`${path}: duplicate case id ${case_.id}`);
            ids.add(case_.id);
            for (const assertion of case_.assertions ?? [])
                if (
                    assertion.mechanical === true &&
                    case_.expected?.activation === "not-observable"
                )
                    errors.push(
                        `${path}: case ${case_.id} marks an assertion mechanical while activation is not-observable`,
                    );
        }
        caseIdsByCapability.set(document.capability, ids);
        const coverage = new Set(
            (document.cases ?? []).flatMap((case_) => case_.coverage ?? []),
        );
        for (const tag of requiredCoverageTags)
            if (!coverage.has(tag))
                errors.push(
                    `${path}: case set is missing the required ${tag} coverage tag`,
                );
        const adversarial = (document.cases ?? []).filter(
            (case_) => case_.caseKind === "adversarial",
        );
        for (const tag of requiredAdversarialTags)
            if (!adversarial.some((case_) => (case_.coverage ?? []).includes(tag)))
                errors.push(
                    `${path}: case set is missing an adversarial case for ${tag}`,
                );
    }
    return [...new Set(errors)].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateExpectationCases();
    if (errors.length) {
        process.stderr.write(
            `Expectation case validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Expectation cases validated: schema, coverage discipline, and mechanical-field consistency.\n",
        );
    }
}
