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
    id: "public-fundamentals",
    packageName: "@cratis/ai-fundamentals",
    products: ["fundamentals", "chronicle"],
    languages: ["csharp"],
    state: "preview-source-candidate",
    availableTargets: ["cratis-fundamentals-concept"],
};

const engineeringChronicle = {
    id: "engineering-chronicle",
    packageName: "@cratis/ai-engineering-chronicle",
    products: ["chronicle"],
    repositoryKinds: ["framework"],
    state: "planned-source-migration",
    composes: ["engineering-base"],
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

test("engineering profile descriptions are public-safe and audience-specific", () => {
    assert.equal(
        profileDisplayName(engineeringChronicle, "cratis-engineering"),
        "Cratis Chronicle Maintainer",
    );
    const presentation = presentProfile(
        engineeringChronicle,
        "cratis-engineering",
    );
    assert.match(presentation.description, /Public-safe contributor guidance/);
    assert.match(
        presentation.description,
        /Private repository details remain local/,
    );
    assert.match(presentation.intendedFor, /Cratis maintainers/);
    assert.equal(presentation.materialization, "catalog-only");
});

test("only approved profiles are presented as installable packages", () => {
    const approved = { ...fundamentals, state: "approved" };
    const presentation = presentProfile(approved, "public");
    assert.equal(presentation.installable, true);
    assert.equal(presentation.materialization, "installable-package");
});
