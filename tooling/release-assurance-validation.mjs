#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { compareOrdinal } from "./catalog-ordering.mjs";

export const releaseAssurancePaths = Object.freeze({
    policy: "distribution/artifact-assurance-policy.json",
    schema: "distribution/artifact-assurance-policy.schema.json",
    profiles: "catalog/v2/artifact-assurance-profiles.json",
    bindings: "distribution/ecosystem-artifact-bindings.json",
});

const requiredClasses = Object.freeze([
    "local-executable-extension",
    "marketplace-index",
    "passive-effectful-guidance",
    "passive-native-metadata",
    "passive-skill-package",
    "remote-mcp-server",
    "stdio-mcp-server",
]);
const executableAssurances = Object.freeze([
    "canary",
    "provenance",
    "sbom",
    "threat-model",
]);
const passiveS1Classes = new Set([
    "passive-private-fixture",
    "passive-public-package",
]);

function equalOrdinal(left, right) {
    return (
        JSON.stringify([...left].sort(compareOrdinal)) ===
        JSON.stringify([...right].sort(compareOrdinal))
    );
}

export function loadReleaseAssuranceInputs(root = defaultRepositoryRoot) {
    return Object.fromEntries(
        Object.entries(releaseAssurancePaths).map(([key, path]) => [
            key,
            readCatalog(join(root, path)),
        ]),
    );
}

export function validateReleaseAssurancePolicy(root = defaultRepositoryRoot) {
    const errors = [];
    let inputs;
    try {
        inputs = loadReleaseAssuranceInputs(root);
    } catch (error) {
        return [
            error instanceof Error
                ? error.message
                : "Unable to load release assurance inputs",
        ];
    }
    errors.push(...validateSchemaVocabulary(inputs.schema));
    errors.push(...validateAgainstSchema(inputs.policy, inputs.schema));
    const classes = inputs.policy.classes ?? [];
    if (
        !equalOrdinal(
            classes.map((record) => record.id),
            requiredClasses,
        )
    )
        errors.push(
            "release assurance policy must close over the seven S4 artifact classes exactly once",
        );
    const profilesById = new Map(
        inputs.profiles.profiles.map((profile) => [profile.id, profile]),
    );
    for (const artifactClass of classes) {
        for (const profileId of artifactClass.assuranceProfileIds) {
            const profile = profilesById.get(profileId);
            if (!profile) {
                errors.push(
                    `${artifactClass.id} references unknown S1 assurance profile ${profileId}`,
                );
                continue;
            }
            for (const [control, disposition] of Object.entries(
                artifactClass.generationControls,
            ))
                if (profile.controls[control] !== disposition)
                    errors.push(
                        `${artifactClass.id} does not preserve ${profileId} control ${control}`,
                    );
        }
        if (
            artifactClass.kind === "executable" &&
            !equalOrdinal(
                artifactClass.requiredAssurances,
                executableAssurances,
            )
        )
            errors.push(
                `${artifactClass.id} must fail closed on SBOM, provenance, threat-model, and canary assurance`,
            );
        if (
            artifactClass.kind === "executable" &&
            artifactClass.s4EmissionAllowed
        )
            errors.push(`${artifactClass.id} must not be emitted in S4`);
        for (const grant of [
            "supportGranted",
            "publicationGranted",
            "runtimeGranted",
            "promotionGranted",
        ])
            if (artifactClass[grant] !== false)
                errors.push(`${artifactClass.id} must not grant ${grant}`);
    }
    for (const binding of inputs.bindings.bindings) {
        if (!passiveS1Classes.has(binding.artifactClass)) continue;
        const profile = profilesById.get(binding.assuranceProfileId);
        if (!profile || profile.failClosed !== true)
            errors.push(
                `${binding.id} does not bind a fail-closed S1 assurance profile`,
            );
        if (
            !classes.some(
                (record) =>
                    record.id === "passive-skill-package" &&
                    record.assuranceProfileIds.includes(
                        binding.assuranceProfileId,
                    ),
            )
        )
            errors.push(
                `${binding.id} is not bound to the S4 passive generation controls`,
            );
    }
    return errors;
}

export function buildReleaseAssuranceReceipt({
    artifactClasses,
    assurances,
    releaseManifest,
    policy = loadReleaseAssuranceInputs().policy,
}) {
    if (!Array.isArray(artifactClasses) || artifactClasses.length === 0)
        throw new Error("At least one artifact assurance class is required");
    const byId = new Map(policy.classes.map((record) => [record.id, record]));
    const supplied = new Set(assurances ?? []);
    const selected = artifactClasses.map((id) => {
        const record = byId.get(id);
        if (!record) throw new Error(`Unknown artifact assurance class: ${id}`);
        const missing = record.requiredAssurances.filter(
            (assurance) => !supplied.has(assurance),
        );
        if (record.kind === "executable" && missing.length > 0)
            throw new Error(
                `${id} is missing executable assurances: ${missing.join(", ")}`,
            );
        if (!record.s4EmissionAllowed)
            throw new Error(`Artifact class is not emitted in S4: ${id}`);
        return {
            id,
            assuranceProfileIds: record.assuranceProfileIds,
            requiredAssurances: record.requiredAssurances,
            observedAssurances: record.requiredAssurances.filter((assurance) =>
                supplied.has(assurance),
            ),
            outcome: missing.length === 0 ? "pass" : "incomplete",
        };
    });
    return {
        schemaVersion: "1.0.0",
        state: "S4_DETERMINISTIC_GENERATION_ASSURANCE",
        releaseManifest,
        classes: selected,
        staticValidationInput: {
            assuranceId: "static-validation",
            outcome: selected.every((record) => record.outcome === "pass")
                ? "pass"
                : "fail",
            supporting: false,
            reason: "Complete deterministic generation validation is an S2 static-validation input; it does not establish support, publication, runtime, or promotion approval.",
        },
        supportGranted: false,
        publicationGranted: false,
        runtimeGranted: false,
        promotionGranted: false,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateReleaseAssurancePolicy();
    if (errors.length > 0) {
        process.stderr.write(
            `Release assurance validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write("Release assurance policy validation passed.\n");
    }
}
