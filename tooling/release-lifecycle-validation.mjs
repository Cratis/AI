// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { s10ReleasePaths } from "./generate-release-readiness.mjs";

const requiredPhases = [
    "preflight",
    "artifact-validation",
    "negative-baseline",
    "collision-negative",
    "install",
    "discovery",
    "behavior-positive",
    "behavior-negative",
    "update",
    "rollback",
    "uninstall",
    "project-context-preservation",
    "cleanup",
];

export function validateReleaseLifecycleReport(report, schema) {
    const errors = validateAgainstSchema(report, schema, schema);
    const ids = report.phases?.map((phase) => phase.id).sort() ?? [];
    if (JSON.stringify(ids) !== JSON.stringify([...requiredPhases].sort()))
        errors.push("production lifecycle report phase inventory is incomplete");
    if (report.versionA === report.versionB)
        errors.push("production lifecycle update and rollback require distinct versions");
    const byId = new Map(report.phases?.map((phase) => [phase.id, phase]) ?? []);
    if (
        byId.get("update")?.selectedDigest ===
            byId.get("rollback")?.selectedDigest ||
        byId.get("install")?.selectedDigest !==
            byId.get("rollback")?.selectedDigest
    )
        errors.push("production lifecycle digests do not prove A-to-B-to-A transition");
    if (
        report.artifactDigest !== byId.get("install")?.selectedDigest ||
        report.artifactDigest !== byId.get("rollback")?.selectedDigest
    )
        errors.push(
            "production lifecycle artifact digest does not match installed and rolled-back artifact",
        );
    return errors;
}

export function validateReleaseLifecycleEvidence(
    root = defaultRepositoryRoot,
) {
    const schema = readCatalog(join(root, s10ReleasePaths.lifecycleSchema));
    const errors = validateSchemaVocabulary(schema);
    const evidenceRoot = join(root, "distribution/evidence");
    const reports = existsSync(evidenceRoot)
        ? readdirSync(evidenceRoot).filter((name) =>
              name.startsWith("s10-lifecycle-"),
          )
        : [];
    for (const name of reports) {
        const report = readCatalog(join(evidenceRoot, name));
        errors.push(...validateReleaseLifecycleReport(report, schema));
    }
    return errors;
}
