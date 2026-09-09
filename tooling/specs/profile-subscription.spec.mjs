// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
    deriveSubscriptionChannel,
    validateProfileSubscriptions,
} from "../profile-subscription-validation.mjs";
import { presentProfile } from "../profile-presentation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const profileFiles = [
    "distribution/profile-catalog.json",
    "distribution/profile-subscription.schema.json",
    "catalog/v2/taxonomy.json",
    "Documentation/examples/ai-subscriptions/cratis-engineering.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/cratis-chronicle-suite.cratis-ai.json",
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

/** Profile count from the source tree, so adding a profile never stale-dates this guard. */
function countProfileFiles(relativePath = "") {
    let count = 0;
    for (const entry of readdirSync(join(repositoryRoot, "profiles", relativePath), {
        withFileTypes: true,
    })) {
        if (entry.isDirectory())
            count += countProfileFiles(join(relativePath, entry.name));
        else if (entry.isFile() && entry.name.endsWith(".json")) count += 1;
    }
    return count;
}

test("profile catalog and project subscriptions pass", () => {
    assert.deepEqual(validateProfileSubscriptions(repositoryRoot), []);
    const catalog = readJson(
        join(repositoryRoot, "distribution/profile-catalog.json"),
    );
    assert.equal(
        catalog.publicProfiles.length,
        countProfileFiles("public"),
        "publicProfiles must match the profiles/public source tree",
    );
    assert.equal(
        catalog.engineeringProfiles.length,
        countProfileFiles("cratis-engineering"),
        "engineeringProfiles must match the profiles/cratis-engineering source tree",
    );
    assert.equal(catalog.versioning.exactPinsRequired, true);
    assert.equal(catalog.versioning.perProfileVersionStamps, true);
    assert.equal(catalog.versioning.releaseTrain, "atomic");
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
    assert.deepEqual(subscription.profiles, ["cratis/engineering"]);
    assert.deepEqual(piSettings.packages, [
        "npm:@cratis/ai-engineering@1.0.0",
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
            "Documentation/examples/ai-subscriptions/cratis-engineering.cratis-ai.json",
        );
        const example = readJson(path);
        example.version = "latest";
        example.profiles = ["cratis/engineering-unknown"];
        writeJson(path, example);
        const errors = validateProfileSubscriptions(root);
        assert(errors.some((error) => error.includes("version")));
        assert(
            errors.some((error) =>
                error.includes("unknown profile cratis/engineering-unknown"),
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
        example.profiles = ["cratis/engineering"];
        writeJson(path, example);
        const errors = validateProfileSubscriptions(root);
        assert(
            errors.some((error) =>
                error.includes("expected exactly one matching oneOf branch"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes(
                    "declared channel public contradicts the derived channel cratis-engineering",
                ),
            ),
        );
    });
});

test("cratis namespace subscribes without hand-declaring a channel", () => {
    const example = readJson(
        join(
            repositoryRoot,
            "Documentation/examples/ai-subscriptions/cratis-chronicle-suite.cratis-ai.json",
        ),
    );
    assert.deepEqual(example.profiles, ["cratis/chronicle"]);
    assert.equal(Object.hasOwn(example, "channel"), false);
    assert.equal(example.updatePolicy, "reviewed-pull-request");
    assert.equal(example.version, "1.0.0");
    assert.equal(deriveSubscriptionChannel(example.profiles), "public");
    assert.equal(
        deriveSubscriptionChannel(["cratis/engineering"]),
        "cratis-engineering",
    );
    assert.equal(
        deriveSubscriptionChannel(["cratis/arc", "cratis/engineering"]),
        null,
    );
});

test("cratis namespace subscription still rejects a floating version", () => {
    withFixture((root) => {
        const path = join(
            root,
            "Documentation/examples/ai-subscriptions/cratis-chronicle-suite.cratis-ai.json",
        );
        const example = readJson(path);
        example.version = "latest";
        writeJson(path, example);
        assert(
            validateProfileSubscriptions(root).some((error) =>
                error.includes("version"),
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
        const drifted = catalog.engineeringProfiles[0];
        drifted.confidentialContentAllowed = true;
        drifted.composes = ["engineering-missing"];
        writeJson(path, catalog);
        const errors = validateProfileSubscriptions(root);
        assert(
            errors.includes(
                "Profile catalog authority or versioning contract changed",
            ),
        );
        assert(
            errors.includes(
                `${drifted.id}: unknown composed profile engineering-missing`,
            ),
        );
    });
});
