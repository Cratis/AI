// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync(
    "skills/cratis-fundamentals-concept/SKILL.md",
    "utf8",
);

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
    assert.equal(skill.includes("It has an implicit conversion from the primitive"), false);
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
        nonGuidTemplate?.includes(
            "EventSourceId<<ComparableUnderlyingType>>",
        ),
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
