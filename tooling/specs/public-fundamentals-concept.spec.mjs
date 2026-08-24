// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync(
    "skills/cratis-fundamentals-concept/SKILL.md",
    "utf8",
);
const legacySkill = readFileSync(".ai/skills/add-concept/SKILL.md", "utf8");
const conceptRule = readFileSync(".ai/rules/concepts.md", "utf8");

test("source review binds exact product releases without granting approval", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/fundamentals-concept-source-review-2026-08-23.json",
            "utf8",
        ),
    );
    const contracts = JSON.parse(
        readFileSync("catalog/v2/source-contracts.json", "utf8"),
    ).contracts;
    assert.equal(evidence.state, "SOURCE_REVIEW_PASS_OWNER_APPROVAL_PENDING");
    assert.equal(evidence.accountableOwner, "woksin");
    assert.equal(evidence.sharedReviewer, "einari");
    assert.equal(evidence.fundamentals.release, "7.18.1");
    assert.equal(
        evidence.fundamentals.releaseRevision,
        "7424cac54aa27753c182333a696e25f0263b54b5",
    );
    assert.equal(evidence.chronicle.release, "16.38.1");
    assert.equal(
        evidence.chronicle.releaseRevision,
        "8c5c6f34abae61f8d94bbfb9f4179674409b7cd3",
    );
    assert.equal(
        evidence.compileEvidence.result,
        "PASS_ZERO_WARNINGS_ZERO_ERRORS",
    );
    assert.equal(evidence.compatibilityEvidence.chronicleVersion, "16.37.1");
    assert.equal(
        evidence.compatibilityEvidence.templateCompileResult,
        "PASS_ZERO_WARNINGS_ZERO_ERRORS",
    );
    assert.equal(
        evidence.compatibilityEvidence.eventSourceIdBlobMatches16_38_1,
        true,
    );
    assert.equal(evidence.targetApproval, false);
    assert.equal(evidence.includeInRuntime, false);
    for (const id of [
        "cratis-fundamentals-source",
        "cratis-chronicle-source",
    ]) {
        const contract = contracts.find((candidate) => candidate.id === id);
        assert(
            contract.evidenceIds.includes(
                "fundamentals-concept-source-review-2026-08-23",
            ),
        );
        assert.equal(contract.verificationState, "verified");
        assert.equal(contract.distributionInputAllowed, true);
        assert.match(contract.immutableRevision, /^[0-9a-f]{40}$/);
        assert.match(contract.contentDigest, /^[0-9a-f]{64}$/);
        assert.equal(contract.verifiedOn, "2026-08-23");
    }
});

test("focused behavior trigger collision and security evidence passes without promotion", () => {
    const evaluation = JSON.parse(
        readFileSync(
            "evals/cratis-fundamentals-concept/focused-evaluation.json",
            "utf8",
        ),
    );
    const digest = (path) =>
        createHash("sha256").update(readFileSync(path)).digest("hex");
    assert.equal(
        evaluation.state,
        "FOCUSED_EVALUATION_PASS_OWNER_APPROVAL_PENDING",
    );
    assert.equal(evaluation.provider, "openai-codex");
    assert.equal(evaluation.toolsEnabled, false);
    assert.equal(evaluation.caseCount, 12);
    assert.equal(evaluation.decisionMatches, 12);
    assert.equal(evaluation.rationalesPresent, 12);
    assert.equal(evaluation.passed, true);
    assert.equal(
        evaluation.casesSha256,
        digest("evals/cratis-fundamentals-concept/focused-cases.json"),
    );
    assert.equal(
        evaluation.promptSha256,
        digest("evals/cratis-fundamentals-concept/focused-prompt.md"),
    );
    assert.equal(
        evaluation.skillSha256,
        digest("skills/cratis-fundamentals-concept/SKILL.md"),
    );
    assert.equal(
        evaluation.outputSha256,
        digest("evals/cratis-fundamentals-concept/focused-run-output.json"),
    );
    assert.equal(evaluation.targetApproval, false);
    assert.equal(evaluation.includeInRuntime, false);
    assert.equal(evaluation.publicationEligible, false);
    assert.equal(evaluation.promotionEligible, false);
});

test("legacy local concept guidance no longer contradicts product authority", () => {
    for (const content of [legacySkill, conceptRule]) {
        assert(content.includes("IComparable"));
        assert(content.includes("optional domain"));
        assert(content.includes("CHR0026"));
        assert(content.includes("CHR0034"));
        assert.equal(
            content.includes(
                "Add a `static readonly NotSet` sentinel instead of using `null`",
            ),
            false,
        );
        assert.equal(
            content.includes(
                "Don't redeclare the `EventSourceId` / `T` / `string` conversions",
            ),
            false,
        );
    }
});

test("Samples consumer canary passes while preserving failed attempts", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/real-samples-fundamentals-preview-canary-2026-08-23.json",
            "utf8",
        ),
    );
    assert.equal(
        evidence.state,
        "REAL_PUBLIC_REPOSITORY_PREVIEW_CANARY_PASS_OWNER_APPROVAL_PENDING",
    );
    assert.equal(
        evidence.repositoryRevision,
        "55e6eb168606da96136cc7f91db8adf45aac3288",
    );
    assert.equal(evidence.scope, "Chronicle/Backend");
    assert.equal(evidence.consumerPackages["Cratis.Fundamentals"], "7.18.1");
    assert.equal(evidence.consumerPackages["Cratis.Chronicle"], "16.37.1");
    assert(evidence.results.every((result) => result.status === "PASS"));
    assert.deepEqual(
        evidence.preservedAttempts.map((attempt) => attempt.status),
        [
            "FAILED_HARNESS_CONFIGURATION",
            "FAILED_AMBIGUOUS_CANARY_QUESTION",
            "INCONCLUSIVE_HARNESS_SCRIPT_EXIT",
        ],
    );
    assert.equal(evidence.targetApproval, false);
    assert.equal(evidence.includeInRuntime, false);
    assert.equal(evidence.installationSupported, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("Fundamentals concept skill is passive canonical Agent Skills content", () => {
    assert.match(
        skill,
        /^---\nname: cratis-fundamentals-concept\ndescription: .+\nlicense: MIT\n---/,
    );
    assert.equal(skill.includes("scripts/"), false);
    assert.equal(skill.includes("allowed-tools:"), false);
    assert.equal(skill.includes(".ai/"), false);
    assert.equal(skill.includes("../"), false);
});

test("skill binds exact Fundamentals and Chronicle product versions", () => {
    assert(skill.includes("`Cratis.Fundamentals` | `7.18.1`"));
    assert(skill.includes("`Cratis.Chronicle` | `16.38.1`"));
    assert(skill.includes("Reverify product sources"));
});

test("ConceptAs guidance follows the authoritative single-value contract", () => {
    for (const required of [
        "exactly one wrapped value",
        "Do not add extra properties",
        "implements `IComparable`",
        "Do not wrap an enum",
        "rejects a null wrapped value",
        "nullable concept reference",
        "Primitive-to-concept conversion is optional",
        "A `NotSet` or `Empty` value is optional domain policy",
    ])
        assert(skill.includes(required), required);
    assert.equal(skill.includes("It has a `static readonly NotSet`"), false);
    assert.equal(
        skill.includes("It has an implicit conversion from the primitive"),
        false,
    );
});

test("Guid and non-Guid event-source identity templates stay type-correct", () => {
    const guidSection = skill
        .split("## Create a Guid-backed Chronicle stream identity")[1]
        .split("## Create a non-Guid Chronicle stream identity")[0];
    const nonGuidSection = skill
        .split("## Create a non-Guid Chronicle stream identity")[1]
        .split("### Unspecified and sensitive identities")[0];
    assert(guidSection.includes("EventSourceId<Guid>"));
    assert(guidSection.includes("Guid.NewGuid()"));
    assert(guidSection.includes("Copyright (c) Cratis"));
    const nonGuidTemplate = /```csharp\n([\s\S]*?)```/.exec(
        nonGuidSection,
    )?.[1];
    assert(
        nonGuidTemplate?.includes("EventSourceId<<ComparableUnderlyingType>>"),
    );
    assert.equal(nonGuidTemplate?.includes("Guid.NewGuid()"), false);
    assert(nonGuidSection.includes("domain has an authoritative way"));
    assert(nonGuidSection.includes("do not create\nyour derived"));
});

test("Chronicle identity guidance preserves stream compliance and analyzer boundaries", () => {
    for (const required of [
        "actually supplied to Chronicle",
        "Merely declaring an\n`EventSourceId<T>` property does not select the event stream",
        "`CHR0026`",
        "`CHR0034`",
        "cannot encrypt event-source IDs",
        "random surrogate stream ID",
        "real, specified stream\nIDs",
    ])
        assert(skill.includes(required), required);
    assert.equal(
        skill.includes(
            "Do not redeclare conversions between `EventSourceId`, `T`, or `string`",
        ),
        false,
    );
});

test("placement and completion are correctly classified and observable", () => {
    for (const required of [
        "This placement is a Cratis application convention",
        "Do not introduce a top-level `Features/` wrapper",
        "The project builds and its relevant specifications pass",
    ])
        assert(skill.includes(required), required);
});
