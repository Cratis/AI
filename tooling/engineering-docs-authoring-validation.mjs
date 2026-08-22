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
    "SKILL.md":
        "014f2e7b55d4f1a7dd982e4e352cffc8cfa078a262056bb55b76eb2b81da0791",
    LICENSE: "4da4b2010f3bf808be0595b698fd786ad167c778302e3c73918075750b1674ad",
    "references/site-format.md":
        "b50039ede61ff439f6836798ef4f6b028b8d3d5567db10d5170acb5df17b18e1",
    "../../evals/cratis-engineering-docs-authoring/assertions.json":
        "7e67538228c07da393932450df83920c6d7852418ad324bb8168636eb29ad57a",
    "../../evals/cratis-engineering-docs-authoring/baseline.md":
        "184abee0cb0959a452d402dc70d58f582348715db66088907441966374d55df8",
    "../../evals/cratis-engineering-docs-authoring/evaluation-plan.json":
        "16f06bafeb8a7ae2e314f1eb6cd82c86633b98c713eb3188397ad04149dbd0d8",
    "../../evals/cratis-engineering-docs-authoring/evaluation-summary.json":
        "b8a322d0f43764a0469c540f28fd57734be4f6a885f81064f55ffe06f85d5c74",
    "../../evals/cratis-engineering-docs-authoring/frozen-prompt.md":
        "641d663b30ed872064757c48c90a4b9c15c446f6ab523d3018474318cb7391f5",
    "../../evals/cratis-engineering-docs-authoring/grading.calibration.v1.json":
        "ef699daa8a0bd61fa8c72f859dc161fa2e19cfbe9c7898103b69853bdf60e721",
    "../../evals/cratis-engineering-docs-authoring/grading.json":
        "0e24293c69f31765415ab5c1f6736fca653e94cfd4d606bfe59b46528b10a4a5",
    "../../evals/cratis-engineering-docs-authoring/held-out-cases.jsonl":
        "837e8137f5b469a5c8857006d7c54a784c9fc02dfb0bc8381e9e4eea8c0a36c9",
    "../../evals/cratis-engineering-docs-authoring/held-out-evaluation-plan.json":
        "a1dfb49021305d11e7a9563ade98960ea3abd0a0a8bc6690abc471ef03617264",
    "../../evals/cratis-engineering-docs-authoring/held-out-grading.json":
        "ff6e9e4297ce6204f9099812d10947495bc9f4bcc1453e49895f10a2dfb4b04b",
    "../../evals/cratis-engineering-docs-authoring/held-out-prompt.md":
        "3677e5487397492abeeeceb7b7f920811f2b2c18c9fe037004019e1a4be57ce3",
    "../../evals/cratis-engineering-docs-authoring/runs/manifest.json":
        "69e639292e1f6f90eaec87128043f6b19c72784bb1cdf943ee87050a7ec1eac4",
    "../../evals/cratis-engineering-docs-authoring/held-out-runs/manifest.json":
        "d9861b60e6a0eb94e87ef3f4b0eb533fd22e29980aa24625f93bb3ef689e6f63",
};
const casesDigest =
    "4a3eb583eba0c280bb1434fa2a915f91a92d0aa54793b049635f7edad0a326c6";

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
        if (!lstatSync(absolute).isDirectory())
            throw new Error("directory required");
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

function frontmatter(markdown) {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return null;
    const values = new Map();
    for (const line of match[1].split("\n")) {
        const separator = line.indexOf(":");
        if (separator < 1) return null;
        values.set(
            line.slice(0, separator).trim(),
            line.slice(separator + 1).trim(),
        );
    }
    return values;
}

function parseCases(repositoryRoot, errors) {
    const path = `${evaluationRoot}/cases.jsonl`;
    const content = readContained(repositoryRoot, path, 524288, errors);
    if (content === null) return [];
    if (sha256(content) !== casesDigest) errors.push("CASES_DIGEST");
    const cases = [];
    for (const [index, line] of content
        .split(/\r?\n/)
        .filter(Boolean)
        .entries()) {
        try {
            cases.push(JSON.parse(line));
        } catch {
            errors.push(`${path}:${index + 1}: invalid JSON`);
        }
    }
    return cases;
}

function validateRunSet(
    repositoryRoot,
    directory,
    expectedPass,
    expectedPromptSha256,
    errors,
) {
    const root = `${evaluationRoot}/${directory}`;
    const manifest = readJson(
        repositoryRoot,
        `${root}/manifest.json`,
        errors,
    )?.value;
    const manifestRuns = Array.isArray(manifest?.runs) ? manifest.runs : [];
    const runIds = manifestRuns.map((run) => run?.runId).filter(Boolean);
    const runsById = new Map(manifestRuns.map((run) => [run?.runId, run]));
    const expectedRunIdentities = [
        "BASELINE_OUTPUT_CONTRACT_ONLY/gpt-5.4-mini/1",
        "BASELINE_OUTPUT_CONTRACT_ONLY/gpt-5.4-mini/2",
        "BASELINE_OUTPUT_CONTRACT_ONLY/gpt-5.6-luna/1",
        "BASELINE_OUTPUT_CONTRACT_ONLY/gpt-5.6-luna/2",
        "SKILL_WITH_OUTPUT_CONTRACT/gpt-5.4-mini/1",
        "SKILL_WITH_OUTPUT_CONTRACT/gpt-5.4-mini/2",
        "SKILL_WITH_OUTPUT_CONTRACT/gpt-5.6-luna/1",
        "SKILL_WITH_OUTPUT_CONTRACT/gpt-5.6-luna/2",
    ];
    const actualRunIdentities = manifestRuns
        .map((run) => `${run?.condition}/${run?.model}/${run?.repetition}`)
        .sort();
    inventory(repositoryRoot, root, ["manifest.json", ...runIds], errors);
    if (
        !manifest ||
        manifest.schemaVersion !== "1.0.0" ||
        manifest.sourceRevision !==
            "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9" ||
        manifest.promptSha256 !== expectedPromptSha256 ||
        runIds.length !== 8 ||
        new Set(runIds).size !== runIds.length ||
        JSON.stringify(actualRunIdentities) !==
            JSON.stringify(expectedRunIdentities.sort()) ||
        (expectedPass === "held-out" &&
            manifest.evaluationPass !== "held-out") ||
        (expectedPass === "calibration" &&
            ![undefined, "calibration"].includes(manifest.evaluationPass))
    )
        errors.push(`${directory}:RUN_MANIFEST`);
    for (const runId of runIds) {
        const runRoot = `${root}/${runId}`;
        inventory(
            repositoryRoot,
            runRoot,
            ["metadata.json", "output.txt"],
            errors,
        );
        const metadata = readJson(
            repositoryRoot,
            `${runRoot}/metadata.json`,
            errors,
        )?.value;
        const output = readContained(
            repositoryRoot,
            `${runRoot}/output.txt`,
            131072,
            errors,
        );
        const manifestRun = runsById.get(runId);
        if (
            !metadata ||
            !manifestRun ||
            JSON.stringify(metadata) !== JSON.stringify(manifestRun) ||
            metadata.runId !== runId ||
            ![
                "BASELINE_OUTPUT_CONTRACT_ONLY",
                "SKILL_WITH_OUTPUT_CONTRACT",
            ].includes(metadata.condition) ||
            metadata.provider !== "openai-codex" ||
            !["gpt-5.4-mini", "gpt-5.6-luna"].includes(metadata.model) ||
            ![1, 2].includes(metadata.repetition) ||
            metadata.exitCode !== 0 ||
            metadata.signal !== null ||
            metadata.toolsEnabled !== false ||
            metadata.contextFilesEnabled !== false ||
            typeof metadata.durationMilliseconds !== "number" ||
            output === null ||
            sha256(output) !== metadata.outputSha256 ||
            sha256(output) !== manifestRun?.outputSha256
        )
            errors.push(`${runId}:RUN_BINDING`);
    }
}

export function validateEngineeringDocsAuthoring(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    inventory(
        repositoryRoot,
        skillRoot,
        ["LICENSE", "SKILL.md", "references"],
        errors,
    );
    inventory(
        repositoryRoot,
        `${skillRoot}/references`,
        ["site-format.md"],
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
            "evaluation-summary.json",
            "frozen-prompt.md",
            "grading.calibration.v1.json",
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
        const resolved = path.startsWith("../../")
            ? path.slice(6)
            : `${skillRoot}/${path}`;
        const content = resolved.endsWith(".json")
            ? readJson(repositoryRoot, resolved, errors)?.content
            : readContained(repositoryRoot, resolved, 131072, errors);
        if (
            content !== null &&
            content !== undefined &&
            sha256(content) !== digest
        )
            errors.push(`${resolved}: digest changed`);
    }

    const skill = readContained(
        repositoryRoot,
        `${skillRoot}/SKILL.md`,
        131072,
        errors,
    );
    if (skill !== null) {
        const metadata = frontmatter(skill);
        if (
            !metadata ||
            metadata.size !== 3 ||
            metadata.get("name") !== "cratis-engineering-docs-authoring" ||
            !metadata
                .get("description")
                ?.includes("Draft accurate Cratis documentation") ||
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
            if (skill.includes(forbidden))
                errors.push(`SKILL_FORBIDDEN:${forbidden}`);
        if (!skill.includes("[site-format.md](references/site-format.md)"))
            errors.push("SKILL_REFERENCE");
        for (const decision of [
            "cratis-engineering-docs-add-page",
            "cratis-engineering-docs-edit-page",
            "cratis-engineering-docs-visual-qa",
            "missing authority",
        ])
            if (
                !skill
                    .toLocaleLowerCase("en-US")
                    .includes(decision.toLocaleLowerCase("en-US"))
            )
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
        assertions.modelRuns !== 16 ||
        assertions.targetApproval !== false ||
        assertions.installationEligible !== false ||
        assertions.promotionEligible !== false
    )
        errors.push("ASSERTIONS");

    validateRunSet(
        repositoryRoot,
        "runs",
        "calibration",
        "641d663b30ed872064757c48c90a4b9c15c446f6ab523d3018474318cb7391f5",
        errors,
    );
    validateRunSet(
        repositoryRoot,
        "held-out-runs",
        "held-out",
        "3677e5487397492abeeeceb7b7f920811f2b2c18c9fe037004019e1a4be57ce3",
        errors,
    );
    const calibration = readJson(
        repositoryRoot,
        `${evaluationRoot}/grading.json`,
        errors,
    )?.value;
    if (
        !calibration ||
        calibration.state !== "SKILL_BEHAVIOR_PASS_CONTRACT_GAPS" ||
        calibration.skillBehaviorPass !== true ||
        calibration.strictContractPass !== false ||
        calibration.targetApproval !== false ||
        calibration.installationEligible !== false ||
        calibration.promotionEligible !== false
    )
        errors.push("CALIBRATION_GRADING");
    const heldOut = readJson(
        repositoryRoot,
        `${evaluationRoot}/held-out-grading.json`,
        errors,
    )?.value;
    if (
        !heldOut ||
        heldOut.state !== "HELD_OUT_SKILL_PASS" ||
        heldOut.skillPass !== true ||
        heldOut.decisionImprovement !== 4 ||
        heldOut.targetApproval !== false ||
        heldOut.installationEligible !== false ||
        heldOut.promotionEligible !== false
    )
        errors.push("HELD_OUT_GRADING");
    const summary = readJson(
        repositoryRoot,
        `${evaluationRoot}/evaluation-summary.json`,
        errors,
    )?.value;
    if (
        !summary ||
        summary.state !== "EVIDENCE_PASS_OWNER_REVIEW_PENDING" ||
        summary.modelRuns !== 16 ||
        summary.heldOut?.skillDecisionMatches !== 32 ||
        summary.heldOut?.baselineDecisionMatches !== 28 ||
        summary.independentReview?.id !==
            "validate-f2fa66ec52217d7edf216972982de179" ||
        summary.independentReview?.status !==
            "HIGH_FINDING_CORRECTED_NO_RECURSIVE_REVIEW" ||
        summary.targetApproval !== false ||
        summary.installationEligible !== false ||
        summary.publicationEligible !== false ||
        summary.promotionEligible !== false
    )
        errors.push("EVALUATION_SUMMARY");

    const cases = parseCases(repositoryRoot, errors);
    if (
        JSON.stringify(cases.map((item) => item?.id).sort()) !==
        JSON.stringify(caseIds)
    )
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
            "Engineering docs authoring validation passed: 9 canonical cases, 8 held-out cases, 16 model runs.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
