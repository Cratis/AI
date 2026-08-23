#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readJson(path, errors) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        errors.push(
            `Unable to parse ${path}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        return null;
    }
}

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

export function validateProfileSubscriptions(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    const profilePath = join(
        repositoryRoot,
        "distribution/profile-catalog.json",
    );
    const schemaPath = join(
        repositoryRoot,
        "distribution/profile-subscription.schema.json",
    );
    const profileCatalog = readJson(profilePath, errors);
    const schema = readJson(schemaPath, errors);
    if (!profileCatalog || !schema) return errors;
    errors.push(
        ...validateSchemaVocabulary(schema, "profile-subscription.schema.json"),
    );
    if (
        profileCatalog.schemaVersion !== "1.0.0" ||
        profileCatalog.state !== "DESIGNED_RELEASES_NOT_YET_PUBLISHED" ||
        profileCatalog.versioning?.strategy !== "semver" ||
        profileCatalog.versioning?.releaseTrain !== "atomic" ||
        profileCatalog.versioning?.exactPinsRequired !== true ||
        profileCatalog.versioning?.floatingVersionsAllowed !== false ||
        profileCatalog.authority?.sharedBehaviorOwner !== "Cratis/AI" ||
        profileCatalog.authority?.productFactOwner !==
            "owning Cratis product repository" ||
        profileCatalog.authority?.projectContextOwner !==
            "consuming repository" ||
        profileCatalog.authority?.directGeneratedEditsAllowed !== false ||
        profileCatalog.authority?.automaticReverseSyncAllowed !== false
    )
        errors.push("Profile catalog authority or versioning contract changed");
    const profiles = [
        ...profileCatalog.publicProfiles,
        ...profileCatalog.engineeringProfiles,
    ];
    const profileIds = profiles.map((profile) => profile.id);
    const packageNames = profiles.map((profile) => profile.packageName);
    if (duplicates(profileIds).length)
        errors.push("Profile catalog contains duplicate profile ids");
    if (duplicates(packageNames).length)
        errors.push("Profile catalog contains duplicate package names");
    const knownProfiles = new Set(profileIds);
    for (const profile of profiles)
        for (const dependency of profile.composes ?? [])
            if (!knownProfiles.has(dependency))
                errors.push(
                    `${profile.id}: unknown composed profile ${dependency}`,
                );
    if (
        profileCatalog.subscription?.projectFile !== ".cratis/ai.json" ||
        profileCatalog.subscription?.projectOwned !== true ||
        profileCatalog.subscription?.packageWritesProjectContext !== false ||
        profileCatalog.subscription?.profileSelectionRequired !== true ||
        profileCatalog.subscription?.exactVersionRequired !== true ||
        profileCatalog.contributionFlow?.consumerRepositoriesPublishPackages !==
            false ||
        profileCatalog.contributionFlow
            ?.consumerRepositoriesPushGeneratedBytes !== false
    )
        errors.push("Profile subscription or contribution boundary changed");

    const examples = [
        [
            "Documentation/examples/ai-subscriptions/chronicle-framework.cratis-ai.json",
            "cratis-engineering",
        ],
        [
            "Documentation/examples/ai-subscriptions/cratis-application.cratis-ai.json",
            "public",
        ],
    ];
    const parsedExamples = new Map();
    for (const [relativePath, expectedChannel] of examples) {
        const example = readJson(join(repositoryRoot, relativePath), errors);
        if (!example) continue;
        parsedExamples.set(relativePath, example);
        errors.push(
            ...validateAgainstSchema(example, schema, schema, relativePath),
        );
        if (example.channel !== expectedChannel)
            errors.push(`${relativePath}: unexpected channel`);
        const allowedProfiles = new Set(
            (expectedChannel === "public"
                ? profileCatalog.publicProfiles
                : profileCatalog.engineeringProfiles
            ).map((profile) => profile.id),
        );
        for (const profile of example.profiles)
            if (!allowedProfiles.has(profile))
                errors.push(`${relativePath}: unknown profile ${profile}`);
        const overlap = (example.skillAllowlist ?? []).filter((skill) =>
            (example.skillDenylist ?? []).includes(skill),
        );
        if (overlap.length)
            errors.push(
                `${relativePath}: skill allowlist and denylist overlap`,
            );
    }
    const piSettingsPath =
        "Documentation/examples/ai-subscriptions/pi-settings.json";
    const piSettings = readJson(join(repositoryRoot, piSettingsPath), errors);
    const chronicleSubscription = parsedExamples.get(
        "Documentation/examples/ai-subscriptions/chronicle-framework.cratis-ai.json",
    );
    if (
        !piSettings ||
        !chronicleSubscription ||
        JSON.stringify(piSettings.packages) !==
            JSON.stringify([
                `npm:@cratis/ai-engineering-chronicle@${chronicleSubscription.version}`,
            ]) ||
        piSettings.enableSkillCommands !== true ||
        Object.hasOwn(piSettings, "extensions")
    )
        errors.push("Pi profile settings example changed");
    return [...new Set(errors)].sort();
}

function main() {
    const errors = validateProfileSubscriptions();
    if (errors.length) {
        process.stderr.write(
            `Profile subscription validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Profile subscription validation passed: 16 profiles and 2 examples.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
