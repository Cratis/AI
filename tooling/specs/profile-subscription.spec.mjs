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

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const profileFiles = [
    "distribution/profile-catalog.json",
    "distribution/profile-subscription.schema.json",
    "Documentation/examples/ai-subscriptions/chronicle-framework.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
    "Documentation/examples/ai-subscriptions/pi-settings.json",
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
    assert.equal(catalog.publicProfiles.length, 5);
    assert.equal(catalog.engineeringProfiles.length, 11);
    assert.equal(catalog.versioning.exactPinsRequired, true);
    assert.equal(catalog.authority.automaticReverseSyncAllowed, false);
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
        example.profiles = ["engineering-framework-chronicle"];
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
                    "unknown profile engineering-framework-chronicle",
                ),
            ),
        );
    });
});

test("profile catalog rejects unknown composition and authority drift", () => {
    withFixture((root) => {
        const path = join(root, "distribution/profile-catalog.json");
        const catalog = readJson(path);
        catalog.authority.automaticReverseSyncAllowed = true;
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
