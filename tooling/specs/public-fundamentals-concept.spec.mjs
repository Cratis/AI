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

test("Guid and non-Guid event-source identity templates stay type-correct", () => {
    const guidSection = skill
        .split("## Guid-backed event-source identity")[1]
        .split("## Non-Guid event-source identity")[0];
    const nonGuidSection = skill
        .split("## Non-Guid event-source identity")[1]
        .split("## Sentinel values")[0];
    assert(guidSection.includes("EventSourceId<Guid>"));
    assert(guidSection.includes("Guid.NewGuid()"));
    const nonGuidTemplate = /```csharp\n([\s\S]*?)```/.exec(
        nonGuidSection,
    )?.[1];
    assert(nonGuidTemplate?.includes("EventSourceId<<UnderlyingType>>"));
    assert.equal(nonGuidTemplate?.includes("Guid.NewGuid()"), false);
    assert(nonGuidSection.includes("domain has a valid way to create"));
});

test("concept guidance preserves value identity placement and verification boundaries", () => {
    for (const required of [
        "ConceptAs<T>",
        "EventSourceId<T>",
        "Do not use `ConceptAs<Guid>` for an event-source identity",
        "Do not introduce a top-level `Features/` wrapper",
        "`dotnet build` passes",
    ])
        assert(skill.includes(required), required);
});
