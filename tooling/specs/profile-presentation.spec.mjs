// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import test from "node:test";
import {
    presentProfile,
    profileDescription,
    profileDisplayName,
    profileMaterialization,
} from "../profile-presentation.mjs";

const fundamentals = {
    id: "cratis/fundamentals",
    packageName: "@cratis/ai-fundamentals",
    products: ["fundamentals", "chronicle"],
    languages: ["csharp"],
    state: "preview-source-candidate",
    availableTargets: ["cratis-fundamentals-concept"],
};

const engineering = {
    id: "cratis/engineering",
    packageName: "@cratis/ai-engineering",
    products: [],
    repositoryKinds: ["application", "framework", "client", "documentation", "corpus"],
    state: "preview-source-candidate",
    availableTargets: [
        "cratis-engineering-csharp-conventions",
        "cratis-engineering-decision-record",
        "cratis-engineering-docs-authoring",
        "cratis-engineering-effect-boundaries",
    ],
};

test("profile presentation gives packages useful developer-facing descriptions", () => {
    assert.equal(
        profileDisplayName(fundamentals, "public"),
        "Cratis Fundamentals",
    );
    assert.equal(
        profileDescription(fundamentals, "public"),
        "Strongly typed Cratis Fundamentals concepts and Chronicle event-source identities for C# projects.",
    );
    assert.equal(profileMaterialization(fundamentals), "candidate-package");
    const presentation = presentProfile(fundamentals, "public");
    assert.match(presentation.intendedFor, /Developers who use/);
    assert.equal(presentation.installable, false);
    assert.deepEqual(presentation.directTargetIds, [
        "cratis-fundamentals-concept",
    ]);
});

test("Chronicle MCP profile presentation denies tool and prompt invocation", () => {
    const profile = {
        id: "cratis/chronicle/mcp",
        packageName: "@cratis/ai-chronicle-mcp",
        products: ["chronicle-mcp"],
        languages: ["language-agnostic"],
        state: "preview-source-candidate",
        availableTargets: ["cratis-chronicle-mcp-inspection"],
    };
    const description = profileDescription(profile, "public");
    assert.match(description, /Classification-only passive guidance/u);
    assert.match(description, /no tool or prompt is admitted or invocable/u);
});

test("Studio profile presentation denies implementation operation admission", () => {
    const profile = {
        id: "cratis/studio",
        packageName: "@cratis/ai-studio",
        products: ["studio"],
        languages: ["language-agnostic"],
        state: "preview-source-candidate",
        availableTargets: ["cratis-studio-mcp-safety-guidance"],
    };
    const description = profileDescription(profile, "public");
    assert.match(description, /Classification-only public-safe guidance/u);
    assert.match(description, /no implementation operation is admitted or invocable/u);
});

test("engineering profile descriptions are public-safe and audience-specific", () => {
    assert.equal(
        profileDisplayName(engineering, "cratis-engineering"),
        "Cratis Maintainer Engineering",
    );
    const presentation = presentProfile(
        engineering,
        "cratis-engineering",
    );
    assert.match(presentation.description, /Public-safe shared engineering conventions/);
    assert.match(presentation.intendedFor, /Cratis maintainers/);
    assert.equal(presentation.materialization, "candidate-package");
});

test("only approved profiles are presented as installable packages", () => {
    const approved = { ...fundamentals, state: "approved" };
    const presentation = presentProfile(approved, "public");
    assert.equal(presentation.installable, true);
    assert.equal(presentation.materialization, "installable-package");
});
