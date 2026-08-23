#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, readdirSync } from "node:fs";
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
        profileCatalog.schemaVersion !== "1.1.0" ||
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
        profileCatalog.authority?.automaticReverseSyncAllowed !== false ||
        profileCatalog.confidentiality?.publicProductPackages !==
            "public-safe-only" ||
        profileCatalog.confidentiality?.engineeringPackages !==
            "public-safe-only" ||
        profileCatalog.confidentiality
            ?.engineeringPrefixImpliesConfidentiality !== false ||
        profileCatalog.confidentiality?.confidentialSharedPackagesAllowed !==
            false ||
        profileCatalog.confidentiality?.privateFactsOwner !==
            "consuming private repository" ||
        profileCatalog.confidentiality?.packageMayReadOrWritePrivateOverlay !==
            false
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
    const publicProfileIds = new Set(
        profileCatalog.publicProfiles.map((profile) => profile.id),
    );
    const engineeringProfileIds = new Set(
        profileCatalog.engineeringProfiles.map((profile) => profile.id),
    );
    const taxonomy = readJson(
        join(repositoryRoot, "catalog/v2/taxonomy.json"),
        errors,
    );
    const knownProducts = new Set(
        taxonomy?.dimensions?.products?.map((product) => product.id) ?? [],
    );
    const knownLanguages = new Set(
        taxonomy?.dimensions?.languages?.map((language) => language.id) ?? [],
    );
    const allowedProfileStates = new Set([
        "approved",
        "authority-gap",
        "content-gap",
        "owner-review-pending",
        "planned",
        "planned-composition",
        "planned-source-migration",
        "preview-source-candidate",
    ]);
    for (const profile of profiles) {
        const isPublic = publicProfileIds.has(profile.id);
        if (!allowedProfileStates.has(profile.state))
            errors.push(
                `${profile.id}: unknown profile state ${profile.state}`,
            );
        if (
            profile.state === "approved" &&
            (profile.availableTargets?.length ?? 0) === 0
        )
            errors.push(`${profile.id}: approved profile has no targets`);
        if (!/^@cratis\/ai-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.packageName))
            errors.push(`${profile.id}: invalid package name`);
        for (const product of profile.products ?? [])
            if (!knownProducts.has(product))
                errors.push(`${profile.id}: unknown product ${product}`);
        for (const language of profile.languages ?? [])
            if (!knownLanguages.has(language))
                errors.push(`${profile.id}: unknown language ${language}`);
        if (
            !isPublic &&
            (profile.distributionVisibility !== "public" ||
                profile.confidentialContentAllowed !== false ||
                profile.privateOverlayExpected !== true)
        )
            errors.push(
                `${profile.id}: engineering profile must be public-safe with a private local overlay`,
            );
        for (const dependency of profile.composes ?? []) {
            if (!knownProfiles.has(dependency)) {
                errors.push(
                    `${profile.id}: unknown composed profile ${dependency}`,
                );
                continue;
            }
            if (
                (isPublic && !publicProfileIds.has(dependency)) ||
                (!isPublic && !engineeringProfileIds.has(dependency))
            )
                errors.push(
                    `${profile.id}: composition crosses public and engineering audiences`,
                );
        }
    }
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

    const exampleRoot = join(
        repositoryRoot,
        "Documentation/examples/ai-subscriptions",
    );
    const examples = [
        ...readdirSync(exampleRoot)
            .filter((name) => name.endsWith(".cratis-ai.json"))
            .sort()
            .map((name) => `Documentation/examples/ai-subscriptions/${name}`),
        "Documentation/examples/private-repository-overlay/.cratis/ai.json",
    ];
    const parsedExamples = new Map();
    for (const relativePath of examples) {
        const example = readJson(join(repositoryRoot, relativePath), errors);
        if (!example) continue;
        parsedExamples.set(relativePath, example);
        errors.push(
            ...validateAgainstSchema(example, schema, schema, relativePath),
        );
        const allowedProfiles = new Set(
            (example.channel === "public"
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
        const profileCatalog = JSON.parse(
            readFileSync(
                join(
                    defaultRepositoryRoot,
                    "distribution/profile-catalog.json",
                ),
                "utf8",
            ),
        );
        const exampleCount =
            readdirSync(
                join(
                    defaultRepositoryRoot,
                    "Documentation/examples/ai-subscriptions",
                ),
            ).filter((name) => name.endsWith(".cratis-ai.json")).length + 1;
        process.stdout.write(
            `Profile subscription validation passed: ${profileCatalog.publicProfiles.length + profileCatalog.engineeringProfiles.length} profiles and ${exampleCount} examples.\n`,
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
