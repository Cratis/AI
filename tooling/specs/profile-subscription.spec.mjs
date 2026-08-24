// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateProfileSubscriptions } from "../profile-subscription-validation.mjs";
import { presentProfile } from "../profile-presentation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const profileFiles = [
    "distribution/profile-catalog.json",
    "distribution/profile-subscription.schema.json",
    "catalog/v2/taxonomy.json",
    "Documentation/examples/ai-subscriptions/chronicle-framework.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/pi-settings.json",
    "Documentation/examples/private-repository-overlay/.cratis/ai.json",
];

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-ai-profiles-"));
    try {
        for (const path of profileFiles) {
            const destination = join(root, path);
            mkdirSync(dirname(destination), { recursive: true });
            cpSync(join(repositoryRoot, path), destination);
        }
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("profile catalog and project subscriptions pass", () => {
    assert.deepEqual(validateProfileSubscriptions(repositoryRoot), []);
    const catalog = readJson(
        join(repositoryRoot, "distribution/profile-catalog.json"),
    );
    assert.equal(catalog.publicProfiles.length, 32);
    assert.equal(catalog.engineeringProfiles.length, 20);
    assert.equal(catalog.versioning.exactPinsRequired, true);
    assert.equal(catalog.authority.automaticReverseSyncAllowed, false);
    assert.equal(
        catalog.confidentiality.engineeringPackages,
        "public-safe-only",
    );
    assert.equal(
        catalog.confidentiality.confidentialSharedPackagesAllowed,
        false,
    );
    assert(
        catalog.engineeringProfiles.every(
            (profile) =>
                profile.distributionVisibility === "public" &&
                profile.confidentialContentAllowed === false &&
                profile.privateOverlayExpected === true,
        ),
    );
    const reference = readFileSync(
        join(repositoryRoot, "Documentation/profile-reference.md"),
        "utf8",
    );
    for (const [audience, profiles] of [
        ["public", catalog.publicProfiles],
        ["cratis-engineering", catalog.engineeringProfiles],
    ])
        for (const profile of profiles) {
            assert(reference.includes(`\`${profile.id}\``), profile.id);
            assert(
                reference.includes(`\`${profile.packageName}\``),
                profile.packageName,
            );
            const presentation = presentProfile(profile, audience);
            assert.match(presentation.displayName, /^Cratis /);
            assert(presentation.description.length >= 40, profile.id);
            assert(presentation.intendedFor.length >= 25, profile.id);
            assert.equal(
                presentation.description.includes(profile.id),
                false,
                profile.id,
            );
        }
});

test("private repository overlay composes public-safe package and local facts", () => {
    const root = join(
        repositoryRoot,
        "Documentation/examples/private-repository-overlay",
    );
    const subscription = readJson(join(root, ".cratis/ai.json"));
    const piSettings = readJson(join(root, ".pi/settings.json"));
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
    const project = readFileSync(join(root, ".cratis/PROJECT.md"), "utf8");
    const localSkill = readFileSync(
        join(root, ".agents/skills/studio-local-release/SKILL.md"),
        "utf8",
    );
    assert.deepEqual(subscription.profiles, ["engineering-studio"]);
    assert.deepEqual(piSettings.packages, [
        "npm:@cratis/ai-engineering-studio@1.0.0",
    ]);
    assert(agents.includes("repository-local skills"));
    assert(project.includes("private Studio implementation behavior"));
    assert.match(localSkill, /^---\nname: studio-local-release\ndescription: /);
    assert.equal(localSkill.includes("@cratis/ai-engineering-studio"), false);
});

test("profile subscription rejects floating versions and unknown profiles", () => {
    withFixture((root) => {
        const path = join(
            root,
            "Documentation/examples/ai-subscriptions/chronicle-framework.cratis-ai.json",
        );
        const example = readJson(path);
        example.version = "latest";
        example.profiles = ["engineering-framework-unknown"];
        writeJson(path, example);
        const errors = validateProfileSubscriptions(root);
        assert(errors.some((error) => error.includes("version")));
        assert(
            errors.some((error) =>
                error.includes("unknown profile engineering-framework-unknown"),
            ),
        );
    });
});

test("subscription schema enforces exact SemVer pins", () => {
    withFixture((root) => {
        const path = join(
            root,
            "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
        );
        const example = readJson(path);
        example.version = "01.0.0";
        writeJson(path, example);
        assert(
            validateProfileSubscriptions(root).some((error) =>
                error.includes("version"),
            ),
        );
        example.version = "1.2.3-preview.1+build.7";
        writeJson(path, example);
        assert.deepEqual(validateProfileSubscriptions(root), []);
    });
});

test("subscription schema rejects cross-audience profiles", () => {
    withFixture((root) => {
        const path = join(
            root,
            "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
        );
        const example = readJson(path);
        example.profiles = ["engineering-chronicle"];
        writeJson(path, example);
        const errors = validateProfileSubscriptions(root);
        assert(
            errors.some((error) =>
                error.includes("expected exactly one matching oneOf branch"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("unknown profile engineering-chronicle"),
            ),
        );
    });
});

test("profile catalog rejects unknown composition and authority drift", () => {
    withFixture((root) => {
        const path = join(root, "distribution/profile-catalog.json");
        const catalog = readJson(path);
        catalog.authority.automaticReverseSyncAllowed = true;
        catalog.confidentiality.confidentialSharedPackagesAllowed = true;
        catalog.engineeringProfiles[0].confidentialContentAllowed = true;
        catalog.engineeringProfiles[0].composes = ["engineering-missing"];
        writeJson(path, catalog);
        const errors = validateProfileSubscriptions(root);
        assert(
            errors.includes(
                "Profile catalog authority or versioning contract changed",
            ),
        );
        assert(
            errors.includes(
                "engineering-base: unknown composed profile engineering-missing",
            ),
        );
    });
});
