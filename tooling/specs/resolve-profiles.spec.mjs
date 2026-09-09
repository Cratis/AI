// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildApprovedProfileReleasePlan } from "../generate-approved-profile-release.mjs";
import {
    ProfileResolutionError,
    resolveProfiles,
    resolveTargetsByProfile,
    validateComposition,
} from "../resolve-profiles.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function readJson(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

function profile(id, extra = {}) {
    return {
        id,
        packageName: `@cratis/ai-${id.replace(/[^a-z0-9]+/g, "-")}`,
        version: "0.0.0",
        products: [],
        languages: [],
        state: "planned-composition",
        ...extra,
    };
}

/** A composes B and C; B and C both compose D. */
function diamondCatalog() {
    return {
        publicProfiles: [
            profile("public-diamond-a", {
                composes: ["public-diamond-b", "public-diamond-c"],
                availableTargets: ["cratis-diamond-a"],
            }),
            profile("public-diamond-b", {
                composes: ["public-diamond-d"],
                availableTargets: ["cratis-diamond-b"],
            }),
            profile("public-diamond-c", {
                composes: ["public-diamond-d"],
                availableTargets: ["cratis-diamond-c"],
            }),
            profile("public-diamond-d", {
                availableTargets: ["cratis-diamond-shared"],
            }),
        ],
        engineeringProfiles: [],
    };
}

test("a diamond composition includes every profile and skill exactly once", () => {
    const manifest = resolveProfiles({
        profileCatalog: diamondCatalog(),
        requested: ["public-diamond-a"],
    });
    assert.deepEqual(
        manifest.profiles.map((entry) => entry.id),
        [
            "public-diamond-a",
            "public-diamond-b",
            "public-diamond-c",
            "public-diamond-d",
        ],
    );
    assert.deepEqual(
        manifest.skills.map((skill) => skill.id),
        [
            "cratis-diamond-a",
            "cratis-diamond-b",
            "cratis-diamond-c",
            "cratis-diamond-shared",
        ],
    );
    const shared = manifest.profiles.find(
        (entry) => entry.id === "public-diamond-d",
    );
    assert.deepEqual(shared.includedBy, [
        "public-diamond-b",
        "public-diamond-c",
    ]);
    assert.equal(shared.depth, 2);
    assert.equal(shared.requestedDirectly, false);
    assert.deepEqual(
        manifest.skills.find((skill) => skill.id === "cratis-diamond-shared")
            .includedBy,
        ["public-diamond-d"],
    );
    assert.deepEqual(manifest.versions, [
        { profileId: "public-diamond-a", version: "0.0.0" },
        { profileId: "public-diamond-b", version: "0.0.0" },
        { profileId: "public-diamond-c", version: "0.0.0" },
        { profileId: "public-diamond-d", version: "0.0.0" },
    ]);
});

test("resolution is deterministic regardless of request order", () => {
    const catalog = diamondCatalog();
    const first = resolveProfiles({
        profileCatalog: catalog,
        requested: ["public-diamond-c", "public-diamond-b"],
    });
    const second = resolveProfiles({
        profileCatalog: catalog,
        requested: ["public-diamond-b", "public-diamond-c", "public-diamond-b"],
    });
    assert.deepEqual(first, second);
    assert.deepEqual(first.requested, [
        "public-diamond-b",
        "public-diamond-c",
    ]);
});

test("a composition cycle is rejected and named", () => {
    const catalog = {
        publicProfiles: [
            profile("public-cycle-a", { composes: ["public-cycle-b"] }),
            profile("public-cycle-b", { composes: ["public-cycle-a"] }),
        ],
        engineeringProfiles: [],
    };
    assert.throws(
        () =>
            resolveProfiles({
                profileCatalog: catalog,
                requested: ["public-cycle-a"],
            }),
        (error) => {
            assert(error instanceof ProfileResolutionError);
            assert.match(error.message, /Profile composition cycle/);
            assert.match(
                error.message,
                /public-cycle-a -> public-cycle-b -> public-cycle-a/,
            );
            return true;
        },
    );
    assert(
        validateComposition(catalog).some(
            (reason) => reason.code === "COMPOSITION_CYCLE",
        ),
    );
});

test("a missing dependency is rejected by name", () => {
    const catalog = {
        publicProfiles: [
            profile("public-orphan", { composes: ["public-absent"] }),
        ],
        engineeringProfiles: [],
    };
    assert.throws(
        () =>
            resolveProfiles({
                profileCatalog: catalog,
                requested: ["public-orphan"],
            }),
        /unknown composed profile public-absent/,
    );
    assert.throws(
        () =>
            resolveProfiles({
                profileCatalog: diamondCatalog(),
                requested: ["public-not-in-catalog"],
            }),
        /Unknown requested profile: public-not-in-catalog/,
    );
});

test("a composition that crosses audiences is rejected", () => {
    const catalog = {
        publicProfiles: [
            profile("public-crossing", { composes: ["engineering-crossed"] }),
        ],
        engineeringProfiles: [profile("engineering-crossed")],
    };
    assert.throws(
        () =>
            resolveProfiles({
                profileCatalog: catalog,
                requested: ["public-crossing"],
            }),
        /crosses public and engineering audiences/,
    );
    assert.throws(
        () =>
            resolveProfiles({
                profileCatalog: {
                    publicProfiles: [profile("public-one")],
                    engineeringProfiles: [profile("engineering-one")],
                },
                requested: ["public-one", "engineering-one"],
            }),
        /Requested profiles cross audiences/,
    );
});

test("the release packaging path expands composes exactly like the catalog path", () => {
    // Cratis/AI#254: generate-approved-profile-release.mjs read only
    // availableTargets and dropped every composed capability.
    const profileCatalog = diamondCatalog();
    const plan = buildApprovedProfileReleasePlan({
        profileId: "public-diamond-a",
        version: "1.0.0",
        profileCatalog,
        targets: [],
        sources: [],
        sourceContracts: [],
        authoringContracts: [],
        artifacts: [],
    });
    assert.deepEqual(plan.targetIds, [
        "cratis-diamond-a",
        "cratis-diamond-b",
        "cratis-diamond-c",
        "cratis-diamond-shared",
    ]);
    assert.deepEqual(
        plan.targetIds,
        resolveTargetsByProfile(profileCatalog).get("public-diamond-a"),
    );
    assert.notDeepEqual(
        plan.targetIds,
        profileCatalog.publicProfiles[0].availableTargets,
    );
});

test("the real catalog agrees between the packaging path and the human catalog", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const humanCatalog = readJson(
        "catalog/generated/human-catalog/catalog.json",
    );
    for (const profileId of [
        "cratis/application/arc-chronicle",
        "cratis/application",
        "cratis/full",
    ]) {
        const plan = buildApprovedProfileReleasePlan({
            profileId,
            version: "1.0.0",
            profileCatalog,
            targets: [],
            sources: [],
            sourceContracts: [],
            authoringContracts: [],
            artifacts: [],
        });
        const presented = humanCatalog.profiles.find(
            (entry) => entry.id === profileId,
        );
        assert.deepEqual(plan.targetIds, presented.targetIds, profileId);
    }
});

test("the real catalog resolves the cratis namespace without duplication", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    assert.deepEqual(validateComposition(profileCatalog), []);
    const manifest = resolveProfiles({
        profileCatalog,
        requested: ["cratis/full"],
    });
    const ids = manifest.profiles.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, [...ids].sort());
    const fundamentals = manifest.profiles.find(
        (entry) => entry.id === "cratis/fundamentals",
    );
    assert(fundamentals.includedBy.length > 1, "diamond over cratis/fundamentals");
    assert.equal(manifest.audience, "public");
    assert(
        manifest.versions.every((entry) => entry.version === "0.0.0"),
        "every profile carries a version stamp",
    );
});

test("Arc and Chronicle meta-profiles stay decoupled", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const arc = resolveProfiles({
        profileCatalog,
        requested: ["cratis/arc"],
    }).profiles.map((entry) => entry.id);
    const chronicle = resolveProfiles({
        profileCatalog,
        requested: ["cratis/chronicle"],
    }).profiles.map((entry) => entry.id);
    assert(arc.includes("cratis/arc/core"));
    assert.equal(
        arc.some((id) => id.startsWith("cratis/chronicle")),
        false,
        "cratis/arc must not imply Chronicle",
    );
    assert(chronicle.includes("cratis/chronicle/core"));
    assert.equal(
        chronicle.some((id) => id.startsWith("cratis/arc")),
        false,
        "cratis/chronicle must not imply Arc",
    );
});

test("language profiles are composable units that imply no product", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    for (const [profileId, language] of [
        ["cratis/language/csharp", "csharp"],
        ["cratis/language/typescript", "typescript"],
        ["cratis/language/kotlin", "kotlin"],
        ["cratis/language/elixir", "elixir"],
    ]) {
        const manifest = resolveProfiles({
            profileCatalog,
            requested: [profileId],
        });
        assert.deepEqual(
            manifest.profiles.map((entry) => entry.id),
            [profileId],
            profileId,
        );
        assert.deepEqual(manifest.skills, [], profileId);
        assert.deepEqual(
            profileCatalog.publicProfiles.find(
                (entry) => entry.id === profileId,
            ).languages,
            [language],
        );
        assert(
            manifest.rejected.some(
                (rejection) =>
                    rejection.kind === "profile-capability-set" &&
                    rejection.id === profileId &&
                    rejection.reason.includes("contributes no capability"),
            ),
            profileId,
        );
    }
});

test("the governed release methodology profile carries no product or language", () => {
    // Release methodology is reusable in any repository, so selecting it must
    // never drag in Arc, Chronicle, or a language profile the way a product
    // profile would.
    const profileId = "cratis/methodology/governed-releases";
    const targetId = "cratis-governed-release-methodology";
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const profile = profileCatalog.publicProfiles.find(
        (entry) => entry.id === profileId,
    );
    assert(profile, profileId);
    assert.deepEqual(profile.products, []);
    assert.deepEqual(profile.languages, []);
    assert.deepEqual(profile.composes ?? [], []);
    const manifest = resolveProfiles({ profileCatalog, requested: [profileId] });
    assert.deepEqual(
        manifest.profiles.map((entry) => entry.id),
        [profileId],
    );
    assert.deepEqual(manifest.skills, [
        { id: targetId, includedBy: [profileId] },
    ]);
    assert.deepEqual(manifest.mcpServers, []);
    assert.deepEqual(manifest.rejected, []);
    assert.deepEqual(resolveTargetsByProfile(profileCatalog).get(profileId), [
        targetId,
    ]);
    const skill = readFileSync(
        join(repositoryRoot, `skills/${targetId}/SKILL.md`),
        "utf8",
    );
    assert.match(skill, new RegExp(`^name: ${targetId}$`, "mu"));
});
