// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
    existsSync,
    lstatSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

export const v2CatalogPaths = {
    sources: "catalog/v2/sources.json",
    targets: "catalog/v2/targets.json",
    migrations: "catalog/v2/migrations.json",
    artifacts: "catalog/v2/artifacts.json",
    evidence: "catalog/v2/evidence.json",
    productCoverage: "catalog/v2/product-coverage.json",
    repositoryInventory: "catalog/v2/repository-inventory.json",
};

export const v2SchemaPath = "catalog/schemas/v2/catalog-v2.schema.json";

const schemaDefinitionByCatalog = {
    sources: "sourcesCatalog",
    targets: "targetsCatalog",
    migrations: "migrationsCatalog",
    artifacts: "artifactsCatalog",
    evidence: "evidenceCatalog",
    productCoverage: "productCoverageCatalog",
    repositoryInventory: "repositoryInventoryCatalog",
};

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

function sorted(values) {
    return [...values].sort((left, right) => left.localeCompare(right));
}

function equalStringSets(left, right) {
    return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function addDuplicateErrors(errors, label, values) {
    for (const value of duplicates(values))
        errors.push(`${label} contains duplicate id ${value}`);
}

function unknownEvidenceErrors(records, evidenceIds, label) {
    const errors = [];
    for (const record of records) {
        for (const evidenceId of record.evidenceIds ?? []) {
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `${label} ${record.id} references unknown evidence ${evidenceId}`,
                );
        }
    }
    return errors;
}

function digestBundledPaths(paths, readContent) {
    const hash = createHash("sha256");
    for (const path of paths) {
        hash.update(path);
        hash.update("\0");
        hash.update(readContent(path));
        hash.update("\0");
    }
    return hash.digest("hex");
}

function listRegularSourceFiles(root, sourcePath) {
    const sourceRoot = join(root, sourcePath);
    const files = [];
    function visit(current) {
        for (const entry of readdirSync(current)) {
            const absolutePath = join(current, entry);
            const stat = lstatSync(absolutePath);
            if (stat.isDirectory()) visit(absolutePath);
            else if (stat.isFile())
                files.push(relative(root, absolutePath).split(sep).join("/"));
            else
                throw new Error(
                    `source contains a non-regular path: ${relative(root, absolutePath)}`,
                );
        }
    }
    visit(sourceRoot);
    return sorted(files);
}

function revisionSourceFiles(root, revision, sourcePath) {
    return sorted(
        execFileSync(
            "git",
            ["ls-tree", "-r", "--name-only", "-z", revision, "--", sourcePath],
            {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            },
        )
            .split("\0")
            .filter(Boolean),
    );
}

function revisionFile(root, revision, path) {
    return execFileSync("git", ["show", `${revision}:${path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "pipe"],
    });
}

export function validateSources(catalogs, root) {
    const errors = [];
    const sourceIds = catalogs.sources.sources.map((source) => source.id);
    const evidenceById = new Map(
        catalogs.evidence.evidence.map((evidence) => [evidence.id, evidence]),
    );
    addDuplicateErrors(errors, "sources", sourceIds);
    const v1 = readCatalog(join(root, "catalog/public-skills.yml"));
    const v1Ids = [
        ...v1.skills.map((skill) => skill.currentName),
        ...v1.audit.internalSkills.map((skill) => skill.currentName),
    ];
    if (!equalStringSets(sourceIds, v1Ids))
        errors.push(
            "catalog v2 sources must preserve all 43 v1 skill sources exactly once",
        );
    if (sourceIds.length !== 43)
        errors.push(
            `catalog v2 must contain 43 sources; found ${sourceIds.length}`,
        );
    for (const source of catalogs.sources.sources) {
        if (source.publicationApproval)
            errors.push(
                `${source.id}: source records can never grant publication approval`,
            );
        for (const evidenceId of source.evidenceIds) {
            if (!evidenceById.has(evidenceId))
                errors.push(`${source.id}: unknown evidence ${evidenceId}`);
        }
        if (
            !source.evidenceIds.some(
                (evidenceId) =>
                    evidenceById.get(evidenceId)?.immutableRevision ===
                    source.sourceRevision,
            )
        ) {
            errors.push(
                `${source.id}: source revision lacks matching immutable evidence`,
            );
        }
        if (!existsSync(join(root, source.sourcePath, "SKILL.md")))
            errors.push(`${source.id}: source SKILL.md is missing`);
        for (const path of source.bundledPaths) {
            if (
                path !== source.sourcePath &&
                !path.startsWith(`${source.sourcePath}/`)
            ) {
                errors.push(
                    `${source.id}: bundled path escapes source root: ${path}`,
                );
            }
        }
        try {
            const currentPaths = listRegularSourceFiles(root, source.sourcePath);
            if (!equalStringSets(currentPaths, source.bundledPaths)) {
                errors.push(
                    `${source.id}: bundled paths do not exactly close over the source directory`,
                );
                continue;
            }
            const revisionPaths = revisionSourceFiles(
                root,
                source.sourceRevision,
                source.sourcePath,
            );
            if (!equalStringSets(revisionPaths, source.bundledPaths)) {
                errors.push(
                    `${source.id}: source revision does not contain the exact bundled paths`,
                );
                continue;
            }
            const currentDigest = digestBundledPaths(
                source.bundledPaths,
                (path) => readFileSync(join(root, path)),
            );
            const revisionDigest = digestBundledPaths(
                source.bundledPaths,
                (path) => revisionFile(root, source.sourceRevision, path),
            );
            if (currentDigest !== source.contentDigest)
                errors.push(`${source.id}: source content digest is stale`);
            if (revisionDigest !== source.contentDigest)
                errors.push(
                    `${source.id}: source revision bytes do not match the content digest`,
                );
        } catch (error) {
            errors.push(`${source.id}: source provenance failed: ${error.message}`);
        }
    }
    return errors;
}

function approvalFields() {
    return ["reviewer", "approvedOn", "sourceRevision", "contentDigest"];
}

export function validateTargets(catalogs) {
    const errors = [];
    const sourceIds = new Set(
        catalogs.sources.sources.map((source) => source.id),
    );
    const targetIdList = catalogs.targets.targets.map((target) => target.id);
    const targetIds = new Set(targetIdList);
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    addDuplicateErrors(errors, "targets", targetIdList);
    for (const target of catalogs.targets.targets) {
        if (target.semanticName !== target.id)
            errors.push(`${target.id}: semanticName must equal id`);
        for (const sourceId of target.sourceSkillIds) {
            if (!sourceIds.has(sourceId))
                errors.push(`${target.id}: unknown source ${sourceId}`);
        }
        for (const collision of target.collisionSet) {
            if (!targetIds.has(collision))
                errors.push(
                    `${target.id}: unknown collision target ${collision}`,
                );
            if (collision === target.id)
                errors.push(
                    `${target.id}: collision set may not contain itself`,
                );
        }
        for (const dependency of target.dependencies.targets) {
            if (!targetIds.has(dependency))
                errors.push(
                    `${target.id}: unknown target dependency ${dependency}`,
                );
        }
        if (target.approval.state !== "approved" && target.includeInRuntime) {
            errors.push(
                `${target.id}: only approved targets can enter runtime`,
            );
        }
        if (target.approval.state === "approved") {
            for (const field of approvalFields(target.approval)) {
                if (!target.approval[field])
                    errors.push(
                        `${target.id}: approved target is missing ${field}`,
                    );
            }
            if (target.approval.evidenceIds.length === 0)
                errors.push(
                    `${target.id}: approved target needs approval evidence`,
                );
            if (
                target.security.disposition !== "accepted" ||
                target.security.evidenceIds.length === 0
            ) {
                errors.push(
                    `${target.id}: approved target needs accepted security evidence`,
                );
            }
            for (const [name, evaluation] of Object.entries(
                target.evaluations,
            )) {
                if (
                    evaluation.status !== "passing" ||
                    evaluation.evidenceIds.length === 0
                ) {
                    errors.push(
                        `${target.id}: approved target needs passing ${name} evidence`,
                    );
                }
            }
            if (!target.includeInRuntime)
                errors.push(
                    `${target.id}: approved target must explicitly enter runtime`,
                );
        }
        for (const evidenceId of [
            ...target.evidenceIds,
            ...target.approval.evidenceIds,
            ...target.security.evidenceIds,
            ...Object.values(target.evaluations).flatMap(
                (evaluation) => evaluation.evidenceIds,
            ),
        ]) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${target.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

export function validateMigrations(catalogs) {
    const errors = [];
    addDuplicateErrors(
        errors,
        "migrations",
        catalogs.migrations.migrations.map((migration) => migration.id),
    );
    const sourceIds = new Set(
        catalogs.sources.sources.map((source) => source.id),
    );
    const targetIds = new Set(
        catalogs.targets.targets.map((target) => target.id),
    );
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const migratedSources = catalogs.migrations.migrations.flatMap(
        (migration) => migration.sourceIds,
    );
    addDuplicateErrors(errors, "migration source accounting", migratedSources);
    if (!equalStringSets(migratedSources, sourceIds))
        errors.push("migrations must account for every source exactly once");
    for (const migration of catalogs.migrations.migrations) {
        for (const sourceId of migration.sourceIds) {
            if (!sourceIds.has(sourceId))
                errors.push(`${migration.id}: unknown source ${sourceId}`);
        }
        for (const targetId of migration.targetIds) {
            if (!targetIds.has(targetId))
                errors.push(`${migration.id}: unknown target ${targetId}`);
        }
        if (migration.kind === "split" && migration.targetIds.length < 2)
            errors.push(`${migration.id}: split needs independent targets`);
        if (migration.kind === "merge" && migration.sourceIds.length < 2)
            errors.push(`${migration.id}: merge needs every input`);
        if (
            ["split", "merge"].includes(migration.kind) &&
            migration.state === "approved" &&
            migration.evaluationEvidenceIds.length === 0
        ) {
            errors.push(
                `${migration.id}: approved ${migration.kind} needs evaluation evidence`,
            );
        }
        for (const evidenceId of [
            ...migration.evidenceIds,
            ...migration.evaluationEvidenceIds,
        ]) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${migration.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

export function validateEvidenceAndCoverage(
    catalogs,
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const evidenceIdList = catalogs.evidence.evidence.map(
        (evidence) => evidence.id,
    );
    const evidenceIds = new Set(evidenceIdList);
    addDuplicateErrors(errors, "evidence", evidenceIdList);
    addDuplicateErrors(
        errors,
        "ecosystem facts",
        catalogs.evidence.ecosystemFacts.map((fact) => fact.id),
    );
    for (const evidence of catalogs.evidence.evidence) {
        if (evidence.expiresOn < catalogs.evidence.asOf)
            errors.push(
                `${evidence.id}: evidence expired before the catalog as-of date`,
            );
        if (evidence.verifiedOn > catalogs.evidence.asOf)
            errors.push(
                `${evidence.id}: evidence was verified after the catalog as-of date`,
            );
        if (
            evidence.sourceKind === "repository-snapshot" &&
            !evidence.immutableRevision
        ) {
            errors.push(
                `${evidence.id}: repository snapshot needs an immutable revision`,
            );
        }
        if (evidence.sourceKind === "local-evidence-report") {
            if (!evidence.repositoryPath || !evidence.digest) {
                errors.push(
                    `${evidence.id}: local evidence needs a repository path and digest`,
                );
            } else {
                const segments = evidence.repositoryPath.split("/");
                if (
                    isAbsolute(evidence.repositoryPath) ||
                    evidence.repositoryPath.includes("\\") ||
                    segments.some(
                        (segment) =>
                            segment === "" ||
                            segment === "." ||
                            segment === "..",
                    )
                ) {
                    errors.push(
                        `${evidence.id}: local evidence path must be normalized and repository-relative`,
                    );
                } else {
                    const evidencePath = resolve(root, evidence.repositoryPath);
                    try {
                        const stat = lstatSync(evidencePath);
                        if (stat.isSymbolicLink() || !stat.isFile())
                            throw new Error("path is not a regular file");
                        const repositoryRoot = realpathSync(root);
                        const resolvedEvidence = realpathSync(evidencePath);
                        const relativePath = relative(
                            repositoryRoot,
                            resolvedEvidence,
                        );
                        if (
                            relativePath === ".." ||
                            relativePath.startsWith(`..${sep}`) ||
                            isAbsolute(relativePath)
                        ) {
                            throw new Error("path escapes the repository root");
                        }
                        const digest = createHash("sha256")
                            .update(readFileSync(resolvedEvidence))
                            .digest("hex");
                        if (digest !== evidence.digest)
                            errors.push(
                                `${evidence.id}: local evidence digest is stale`,
                            );
                    } catch (error) {
                        errors.push(
                            `${evidence.id}: local evidence path is unsafe: ${error.message}`,
                        );
                    }
                }
            }
        }
    }
    errors.push(
        ...unknownEvidenceErrors(
            catalogs.evidence.ecosystemFacts,
            evidenceIds,
            "ecosystem fact",
        ),
    );
    const sourceIds = new Set(
        catalogs.sources.sources.map((source) => source.id),
    );
    const targetIds = new Set(
        catalogs.targets.targets.map((target) => target.id),
    );
    for (const language of catalogs.productCoverage.languages) {
        errors.push(
            ...unknownEvidenceErrors([language], evidenceIds, "language claim"),
        );
        if (
            language.claimState === "verified" &&
            language.evidenceIds.length === 0
        )
            errors.push(
                `${language.id}: verified language claim needs evidence`,
            );
    }
    for (const product of catalogs.productCoverage.products) {
        errors.push(
            ...unknownEvidenceErrors([product], evidenceIds, "product claim"),
        );
        addDuplicateErrors(
            errors,
            `${product.id} capabilities`,
            product.capabilities.map((capability) => capability.id),
        );
        for (const capability of product.capabilities) {
            errors.push(
                ...unknownEvidenceErrors(
                    [capability],
                    evidenceIds,
                    "capability claim",
                ),
            );
            for (const sourceId of capability.sourceSkillIds) {
                if (!sourceIds.has(sourceId))
                    errors.push(
                        `${product.id}/${capability.id}: unknown source ${sourceId}`,
                    );
            }
            for (const targetId of capability.targetIds) {
                if (!targetIds.has(targetId))
                    errors.push(
                        `${product.id}/${capability.id}: unknown target ${targetId}`,
                    );
            }
            if (
                capability.claimState === "verified" &&
                capability.evidenceIds.length === 0
            ) {
                errors.push(
                    `${product.id}/${capability.id}: verified support claim needs evidence`,
                );
            }
            if (
                capability.coverageState === "gap" &&
                capability.claimState === "verified"
            ) {
                errors.push(
                    `${product.id}/${capability.id}: a coverage gap cannot be a verified support claim`,
                );
            }
        }
    }
    return errors;
}

export function validateArtifacts(catalogs) {
    const errors = [];
    const decision = catalogs.artifacts.distributionDecision;
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const targetIds = new Set(
        catalogs.targets.targets.map((target) => target.id),
    );
    const approvedTargets = new Set(
        catalogs.targets.targets
            .filter(
                (target) =>
                    target.approval.state === "approved" &&
                    target.includeInRuntime,
            )
            .map((target) => target.id),
    );
    addDuplicateErrors(
        errors,
        "artifacts",
        catalogs.artifacts.artifacts.map((artifact) => artifact.id),
    );
    for (const evidenceId of decision.authorityEvidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
            errors.push(
                `distribution decision references unknown evidence ${evidenceId}`,
            );
        }
    }
    if (
        decision.state === "accepted" &&
        decision.acceptedArchitecture === "none"
    ) {
        errors.push(
            "accepted distribution decision must name its architecture",
        );
    }
    for (const artifact of catalogs.artifacts.artifacts) {
        if (
            decision.state === "unresolved" &&
            !artifact.fixtureOnly &&
            (artifact.materializationAllowed || artifact.runtimeEligible)
        ) {
            errors.push(
                `${artifact.id}: unresolved distribution decision blocks live materialization and runtime`,
            );
        }
        if (artifact.runtimeEligible && !artifact.materializationAllowed) {
            errors.push(
                `${artifact.id}: runtime eligibility requires materialization approval`,
            );
        }
        if (artifact.fixtureOnly && artifact.requiresApprovedTargets) {
            errors.push(
                `${artifact.id}: fixture artifacts cannot require approved targets`,
            );
        }
        if (!artifact.fixtureOnly && !artifact.requiresApprovedTargets) {
            errors.push(
                `${artifact.id}: non-fixture artifacts must require approved targets`,
            );
        }
        const liveEnabled =
            artifact.materializationAllowed || artifact.runtimeEligible;
        for (const targetId of artifact.componentInventory.skills) {
            if (!targetIds.has(targetId) && !artifact.fixtureOnly) {
                errors.push(`${artifact.id}: unknown target ${targetId}`);
            } else if (
                !artifact.fixtureOnly &&
                liveEnabled &&
                !approvedTargets.has(targetId)
            ) {
                errors.push(
                    `${artifact.id}: unapproved target selected for live artifact: ${targetId}`,
                );
            }
        }
        for (const evidenceId of artifact.evidenceIds) {
            if (!evidenceIds.has(evidenceId)) {
                errors.push(
                    `${artifact.id}: references unknown evidence ${evidenceId}`,
                );
            }
        }
        if (artifact.audience === "public" && artifact.fixtureOnly)
            errors.push(
                `${artifact.id}: public release definition cannot masquerade as a fixture`,
            );
    }
    return errors;
}

function globToRegExp(pattern) {
    let expression = "^";
    for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern[index];
        if (character === "*" && pattern[index + 1] === "*") {
            expression += ".*";
            index += 1;
        } else if (character === "*") {
            expression += "[^/]*";
        } else {
            expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
        }
    }
    return new RegExp(`${expression}$`);
}

function pathDigest(paths) {
    return createHash("sha256")
        .update(`${sorted(paths).join("\n")}\n`)
        .digest("hex");
}

function gitPaths(root, args) {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" })
        .split("\0")
        .filter(Boolean);
}

function indexDigest(root, excludedPaths) {
    const excluded = new Set(excludedPaths);
    const entries = gitPaths(root, ["ls-files", "-s", "-z"])
        .filter((entry) => {
            const separator = entry.indexOf("\t");
            return separator >= 0 && !excluded.has(entry.slice(separator + 1));
        })
        .sort((left, right) => left.localeCompare(right));
    const hash = createHash("sha256");
    for (const entry of entries) {
        hash.update(entry);
        hash.update("\0");
    }
    return hash.digest("hex");
}

function changesSinceBase(root, baseRevision) {
    const statusNames = new Map([
        ["A", "added"],
        ["M", "modified"],
        ["D", "deleted"],
        ["T", "type-changed"],
        ["U", "unmerged"],
        ["X", "unknown"],
    ]);
    const values = gitPaths(root, [
        "diff",
        "--cached",
        "--no-renames",
        "--name-status",
        "-z",
        baseRevision,
        "--",
    ]);
    const changes = [];
    for (let index = 0; index < values.length; index += 2) {
        const status = statusNames.get(values[index]) ?? "unknown";
        const path = values[index + 1];
        if (!path) throw new Error("Git returned an incomplete change record");
        changes.push({ path, status });
    }
    return changes.sort((left, right) => left.path.localeCompare(right.path));
}

export function expandInventoryRecord(record, universe) {
    const include = record.sourcePathPatterns.map(globToRegExp);
    const exclude = record.excludePathPatterns.map(globToRegExp);
    return sorted(
        universe.filter(
            (path) =>
                include.some((pattern) => pattern.test(path)) &&
                !exclude.some((pattern) => pattern.test(path)),
        ),
    );
}

export function validateRepositoryInventory(catalogs, root) {
    const errors = [];
    const inventory = catalogs.repositoryInventory;
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const tracked = gitPaths(root, ["ls-files", "-z"]);
    const untracked = gitPaths(root, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
    ]).filter(
        (path) =>
            !inventory.excludedRuntimePrefixes.some((prefix) =>
                path.startsWith(prefix),
            ),
    );
    if (!equalStringSets(untracked, inventory.admittedUntracked)) {
        errors.push(
            "repository inventory admittedUntracked must exactly match non-runtime untracked files",
        );
    }
    if (
        indexDigest(root, inventory.indexDigestExcludedPaths) !==
        inventory.indexDigest
    ) {
        errors.push("repository inventory index digest changed");
    }
    try {
        if (
            JSON.stringify(changesSinceBase(root, inventory.baseRevision)) !==
            JSON.stringify(inventory.changesSinceBase)
        ) {
            errors.push("repository inventory base-revision changes changed");
        }
    } catch (error) {
        errors.push(
            `repository inventory base revision cannot be verified: ${error.message}`,
        );
    }
    for (const path of inventory.admittedUntracked) {
        if (!existsSync(join(root, path)))
            errors.push(
                `repository inventory admits missing untracked path ${path}`,
            );
    }
    const universe = [...tracked, ...inventory.admittedUntracked];
    const assignments = new Map();
    for (const record of inventory.records) {
        const paths = expandInventoryRecord(record, universe);
        if (paths.length !== record.expectedPathCount) {
            errors.push(
                `${record.id}: expected ${record.expectedPathCount} paths but expanded to ${paths.length}`,
            );
        }
        if (pathDigest(paths) !== record.expectedPathsDigest)
            errors.push(`${record.id}: expanded path digest changed`);
        for (const path of paths) {
            const owners = assignments.get(path) ?? [];
            owners.push(record.id);
            assignments.set(path, owners);
        }
        if (record.generatedStatus !== "source" && !record.generator)
            errors.push(
                `${record.id}: generated or derived records must name a generator`,
            );
        for (const evidenceId of record.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${record.id}: unknown evidence ${evidenceId}`);
        }
    }
    for (const path of universe) {
        const owners = assignments.get(path) ?? [];
        if (owners.length === 0)
            errors.push(`repository inventory does not account for ${path}`);
        if (owners.length > 1)
            errors.push(
                `repository inventory assigns ${path} more than once: ${owners.join(", ")}`,
            );
    }
    for (const path of assignments.keys()) {
        if (!universe.includes(path))
            errors.push(
                `repository inventory expanded path outside the repository universe: ${path}`,
            );
    }
    return errors;
}

export function validateV2Catalogs(root = defaultRepositoryRoot) {
    const errors = [];
    let schema;
    const catalogs = {};
    try {
        schema = readCatalog(join(root, v2SchemaPath));
        for (const [key, path] of Object.entries(v2CatalogPaths))
            catalogs[key] = readCatalog(join(root, path));
    } catch (error) {
        return [error.message];
    }
    errors.push(
        ...validateSchemaVocabulary(schema).map(
            (error) => `${v2SchemaPath} ${error}`,
        ),
    );
    for (const [key, path] of Object.entries(v2CatalogPaths)) {
        const definition = schema.$defs[schemaDefinitionByCatalog[key]];
        errors.push(
            ...validateAgainstSchema(catalogs[key], definition, schema).map(
                (error) => `${path} ${error}`,
            ),
        );
    }
    if (errors.length > 0) return errors;
    errors.push(...validateSources(catalogs, root));
    errors.push(...validateTargets(catalogs));
    errors.push(...validateMigrations(catalogs));
    errors.push(...validateEvidenceAndCoverage(catalogs));
    errors.push(...validateArtifacts(catalogs));
    errors.push(...validateRepositoryInventory(catalogs, root));
    return errors;
}
