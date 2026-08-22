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
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    sha256EventModelingJson,
    validateDomainExpertEventModelingPilot,
    validateEventModelingExpected,
    validateEventModelingResult,
} from "../domain-expert-event-modeling-pilot-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function readCases(root = repositoryRoot) {
    return readFileSync(
        join(root, "evals/domain-expert-event-modeling/cases.jsonl"),
        "utf8",
    )
        .trim()
        .split("\n")
        .map(JSON.parse);
}

function writeCases(root, cases) {
    writeFileSync(
        join(root, "evals/domain-expert-event-modeling/cases.jsonl"),
        `${cases.map((item) => JSON.stringify(item)).join("\n")}\n`,
    );
}

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-event-modeling-pilot-"));
    try {
        cpSync(
            join(repositoryRoot, "pilots/domain-expert-event-modeling"),
            join(root, "pilots/domain-expert-event-modeling"),
            { recursive: true },
        );
        cpSync(
            join(repositoryRoot, "evals/domain-expert-event-modeling"),
            join(root, "evals/domain-expert-event-modeling"),
            { recursive: true },
        );
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("domain-expert event-modeling contracts and nine cases pass", () => {
    assert.deepEqual(validateDomainExpertEventModelingPilot(), []);
    const cases = readCases();
    assert.equal(cases.length, 9);
    assert.equal(cases.filter((item) => item.kind === "positive").length, 4);
    assert.equal(cases.filter((item) => item.kind === "negative").length, 5);
    assert.equal(
        cases.every((item) => item.enabled),
        true,
    );
});

test("domain-expert event-modeling metadata remains passive", () => {
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/domain-expert-event-modeling/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    assert.equal(metadata.state, "CONTRACT_ONLY");
    assert.equal(metadata.persistedModelRuns, 0);
    assert.equal(metadata.repositoryOnly, true);
    assert.equal(metadata.runtimeEligible, false);
    for (const permission of Object.values(metadata.permissions))
        assert.equal(permission, false);
});

test("event-modeling inputs and results bind exact external case identity", () => {
    for (const testCase of readCases()) {
        assert.equal(
            testCase.inputSha256,
            testCase.input === null
                ? null
                : sha256EventModelingJson(testCase.input),
        );
        assert.deepEqual(
            validateEventModelingResult(testCase.expected, {
                repositoryRoot,
                evaluatedCaseId: testCase.id,
            }),
            [],
        );
    }
    const p01 = readCases().find((item) => item.id === "P01");
    assert(
        validateEventModelingResult(p01.expected, {
            repositoryRoot,
            evaluatedCaseId: "P02",
        }).includes("RESULT_ORACLE_MISMATCH"),
    );
});

test("event-modeling outcomes preserve Cratis draft and handoff boundaries", () => {
    const corpus = readCases();
    const cases = new Map(corpus.map((item) => [item.id, item.expected]));
    assert.equal(cases.get("P01").outcome, "MODEL_DRAFT");
    assert.equal(cases.get("P01").modelStatus, "DRAFT");
    assert.equal(cases.get("P01").handoff, "OWNER_REVIEW");
    assert(
        cases
            .get("P01")
            .stateViews.every((view) =>
                view.fields.every((field) => field.factRef !== null),
            ),
    );
    assert.deepEqual(
        cases.get("P02").reactions.map((reaction) => reaction.kind),
        ["AUTOMATION", "TRANSLATION"],
    );
    assert(
        corpus
            .find((item) => item.id === "P02")
            .input.narrative.includes("OrderStatus view"),
    );
    assert.equal(cases.get("P03").outcome, "QUESTIONS_REQUIRED");
    assert.equal(
        cases.get("P04").outcomeReasonCode,
        "COMPLIANCE_BOUNDARY_UNSETTLED",
    );
    assert.equal(cases.get("N01").outcome, "SKIPPED");
    assert.equal(cases.get("N02").outcome, "REFUSED");
    assert.equal(cases.get("N03").outcome, "BLOCKED");
    assert.equal(cases.get("N04").outcome, "INCONCLUSIVE");
    assert.equal(
        cases.get("N05").outcomeReasonCode,
        "THIRD_PARTY_COPY_REQUEST",
    );
});

test("event-modeling validator rejects field digest and acceptance drift", () => {
    const mutations = [
        {
            code: "P01:INPUT_FIELDS",
            mutate: (testCase) => {
                testCase.input.unexpected = true;
                testCase.inputSha256 = sha256EventModelingJson(testCase.input);
                testCase.expected.inputBinding.inputSha256 =
                    testCase.inputSha256;
            },
        },
        {
            code: "P01:INPUT_BINDING",
            mutate: (testCase) => {
                testCase.inputSha256 = "0".repeat(64);
                testCase.expected.inputBinding.inputSha256 =
                    testCase.inputSha256;
            },
        },
        {
            code: "N01:ACCEPTED_MODEL",
            mutate: (testCase) => {
                testCase.expected.outcome = "MODEL_DRAFT";
                testCase.expected.outcomeReasonCode =
                    "INFORMATION_COMPLETE_FOR_OWNER_REVIEW";
                testCase.expected.modelStatus = "DRAFT";
                testCase.expected.handoff = "OWNER_REVIEW";
            },
        },
    ];
    for (const { code, mutate } of mutations) {
        withFixture((root) => {
            const cases = readCases(root);
            const testCase = cases.find((item) => item.id === code.slice(0, 3));
            mutate(testCase);
            writeCases(root, cases);
            assert(validateDomainExpertEventModelingPilot(root).includes(code));
        });
    }
});

test("event-modeling malformed nested results stay bounded and deterministic", () => {
    const testCase = structuredClone(
        readCases().find((item) => item.id === "P01"),
    );
    testCase.expected.limitations = {};
    testCase.expected.facts = [null];
    testCase.expected.stateViews = [{ id: "V01", fields: [null] }];
    testCase.expected.reactions = [null];
    assert.doesNotThrow(() => {
        assert.notDeepEqual(validateEventModelingExpected(testCase), []);
    });

    const questionsCase = structuredClone(
        readCases().find((item) => item.id === "P03"),
    );
    questionsCase.expected.questions = null;
    questionsCase.expected.gaps = null;
    assert.doesNotThrow(() => {
        assert.notDeepEqual(validateEventModelingExpected(questionsCase), []);
    });

    const draftCase = structuredClone(
        readCases().find((item) => item.id === "P01"),
    );
    draftCase.expected.commands = null;
    draftCase.expected.reactions = null;
    assert.doesNotThrow(() => {
        assert.notDeepEqual(validateEventModelingExpected(draftCase), []);
    });

    const first = validateDomainExpertEventModelingPilot();
    const second = validateDomainExpertEventModelingPilot();
    assert.deepEqual(first, []);
    assert.deepEqual(second, first);
});
