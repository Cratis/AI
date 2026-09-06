// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateVocabulary,
    vocabularySetValues,
} from "../catalog-validation.mjs";

const vocabulary = readCatalog(
    join(defaultRepositoryRoot, "catalog/vocabulary.json"),
);

// The reviewed sets. A value added to or removed from catalog/vocabulary.json
// without a matching review of this table fails here, which is the point: the
// file is the authority, and the authority is not edited silently.
const reviewedSets = Object.freeze({
    "decision.status": [
        "proposed",
        "returned",
        "accepted",
        "rejected",
        "deferred",
        "superseded",
    ],
    "decision.stage": ["none", "implemented", "verified"],
    "decision.class": ["strategy", "contract", "product", "working"],
    "decision.reversibility": ["reversible", "costly", "irreversible"],
    "work-item.next": [
        "triage",
        "human-decision",
        "human-input",
        "owner-acceptance",
        "ai-plan",
        "ai-candidate",
        "human-review",
        "owning-system",
        "none",
    ],
    "work-item.blocker": [
        "none",
        "authority",
        "owner",
        "scope",
        "dependency",
        "evidence",
        "security-privacy",
        "capacity",
        "external-system",
        "stale",
    ],
    "verdict-request.kind": [
        "decision",
        "question",
        "approval",
        "owner-input",
    ],
    "verification.verdict": [
        "settled",
        "claimed-unverified",
        "open",
        "not-applicable",
        "indeterminate",
    ],
    "comment.kind": [
        "acknowledgment",
        "information-request",
        "decision-request",
        "owner-acceptance-request",
        "review-request",
        "material-status",
        "evidence-reference",
        "relationship-link",
        "disposition",
        "correction",
    ],
    "closure.disposition": [
        "fully-resolved",
        "partly-addressed",
        "not-addressed",
    ],
    "readiness.blocker": [
        "package-ownership-unconfirmed",
        "trusted-publisher-not-configured",
        "oidc-not-enabled",
        "public-preview-publish-disabled",
        "npm-latest-tag-unsafe",
        "preview-release-workflow-not-implemented",
    ],
});

const reviewedDispositions = Object.freeze({
    decision: [
        "accept",
        "accept-with-conditions",
        "request-revision",
        "reject",
        "defer",
        "supersede",
    ],
    question: ["answer", "answer-and-record-decision"],
    approval: ["accepted", "correction-requested", "rejected"],
    "owner-input": ["supplied", "declined"],
});

test("the shared vocabulary carries exactly the reviewed sets", () => {
    assert.deepEqual(
        Object.keys(vocabulary.sets).sort(),
        Object.keys(reviewedSets).sort(),
    );
});

test("every reviewed set carries exactly its reviewed values in order", () => {
    for (const [setName, values] of Object.entries(reviewedSets))
        assert.deepEqual(
            vocabularySetValues(vocabulary, setName),
            values,
            `vocabulary set ${setName} drifted from the reviewed values`,
        );
});

test("every value carries a one-line meaning", () => {
    for (const [setName, set] of Object.entries(vocabulary.sets)) {
        assert.equal(typeof set.description, "string");
        for (const entry of set.values)
            assert(
                typeof entry.meaning === "string" && entry.meaning.length > 0,
                `vocabulary set ${setName} value ${entry.value} has no meaning`,
            );
    }
});

test("each verdict-request kind allows exactly its reviewed dispositions", () => {
    const kinds = vocabulary.sets["verdict-request.kind"].values;
    for (const entry of kinds)
        assert.deepEqual(
            entry.dispositions,
            reviewedDispositions[entry.value],
            `verdict-request kind ${entry.value} drifted from its reviewed dispositions`,
        );
});

test("the vocabulary agrees with the schemas that consume it", () => {
    assert.deepEqual(validateVocabulary(vocabulary), []);
});

test("a schema that consumes a set fails when the set drifts", () => {
    const mutated = structuredClone(vocabulary);
    mutated.sets["readiness.blocker"].values.pop();

    assert.deepEqual(validateVocabulary(mutated), [
        "distribution/preview-readiness.schema.json: inline enum differs from vocabulary set readiness.blocker",
    ]);
});

test("a value that breaks the declared pattern is refused", () => {
    const mutated = structuredClone(vocabulary);
    mutated.sets["work-item.blocker"].values.push({
        value: "Not_A_Value",
        meaning: "deliberately malformed",
    });

    assert(
        validateVocabulary(mutated).some((error) =>
            error.includes("does not match"),
        ),
    );
});
