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
import { compareOrdinal, sortedOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import {
    regularFiles,
    validateComponentCatalogs,
} from "./component-catalog-validation.mjs";

export const v2CatalogPaths = {
    sources: "catalog/v2/sources.json",
    targets: "catalog/v2/targets.json",
    migrations: "catalog/v2/migrations.json",
    artifacts: "catalog/v2/artifacts.json",
    evidence: "catalog/v2/evidence.json",
    productCoverage: "catalog/v2/product-coverage.json",
    repositoryInventory: "catalog/v2/repository-inventory.json",
    taxonomy: "catalog/v2/taxonomy.json",
    sourceContracts: "catalog/v2/source-contracts.json",
    bundles: "catalog/v2/bundles.json",
    upstreamCompanions: "catalog/v2/upstream-companions.json",
    authoringContracts: "catalog/v2/authoring-contracts.json",
    humanCatalog: "catalog/v2/human-catalog.json",
    components: "catalog/v2/components.json",
    componentProjections: "catalog/v2/component-projections.json",
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
    taxonomy: "taxonomyCatalog",
    sourceContracts: "sourceContractsCatalog",
    bundles: "bundlesCatalog",
    upstreamCompanions: "upstreamCompanionsCatalog",
    authoringContracts: "authoringContractsCatalog",
    humanCatalog: "humanCatalogContract",
    components: "componentsCatalog",
    componentProjections: "componentProjectionsCatalog",
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
    return sortedOrdinal(values);
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

const revisionSnapshots = new Map();

function readRevisionBlobs(root, objectIds) {
    if (objectIds.length === 0) return new Map();
    const output = execFileSync("git", ["cat-file", "--batch"], {
        cwd: root,
        encoding: null,
        input: `${objectIds.join("\n")}\n`,
        maxBuffer: 128 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
    });
    const blobs = new Map();
    let offset = 0;
    for (const expectedId of objectIds) {
        const newline = output.indexOf(10, offset);
        if (newline < 0)
            throw new Error("Git returned an incomplete blob header");
        const header = output.subarray(offset, newline).toString("utf8");
        const [objectId, type, sizeText] = header.split(" ");
        const size = Number(sizeText);
        if (
            objectId !== expectedId ||
            type !== "blob" ||
            !Number.isSafeInteger(size) ||
            size < 0
        ) {
            throw new Error(`Git returned an invalid blob header: ${header}`);
        }
        const start = newline + 1;
        const end = start + size;
        if (end >= output.length || output[end] !== 10)
            throw new Error(`Git returned an incomplete blob: ${objectId}`);
        blobs.set(objectId, output.subarray(start, end));
        offset = end + 1;
    }
    if (offset !== output.length)
        throw new Error("Git returned unexpected trailing blob data");
    return blobs;
}

function revisionSnapshot(root, revision) {
    const key = `${realpathSync(root)}\0${revision}`;
    const cached = revisionSnapshots.get(key);
    if (cached) return cached;
    const treeOutput = execFileSync("git", ["ls-tree", "-r", "-z", revision], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const entries = treeOutput
        .split("\0")
        .filter(Boolean)
        .map((entry) => {
            const match = entry.match(
                /^(?<mode>[0-7]+) blob (?<objectId>[a-f0-9]+)\t(?<path>.+)$/,
            );
            if (!match?.groups)
                throw new Error(`Git returned an invalid tree entry: ${entry}`);
            return match.groups;
        });
    const objectIds = [...new Set(entries.map((entry) => entry.objectId))];
    const blobs = readRevisionBlobs(root, objectIds);
    const files = new Map(
        entries.map((entry) => [entry.path, blobs.get(entry.objectId)]),
    );
    const snapshot = { files };
    revisionSnapshots.set(key, snapshot);
    return snapshot;
}

function revisionSourceFiles(root, revision, sourcePath) {
    return sorted(
        [...revisionSnapshot(root, revision).files.keys()].filter((path) =>
            path.startsWith(`${sourcePath}/`),
        ),
    );
}

function revisionFile(root, revision, path) {
    const content = revisionSnapshot(root, revision).files.get(path);
    if (!content) throw new Error(`Source revision does not contain ${path}`);
    return content;
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
            "catalog v2 sources must preserve all 45 authored skill sources exactly once",
        );
    if (sourceIds.length !== 45)
        errors.push(
            `catalog v2 must contain 45 sources; found ${sourceIds.length}`,
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
            const currentPaths = listRegularSourceFiles(
                root,
                source.sourcePath,
            );
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
            errors.push(
                `${source.id}: source provenance failed: ${error.message}`,
            );
        }
    }
    return errors;
}

function approvalFields() {
    return ["reviewer", "approvedOn", "sourceRevision", "contentDigest"];
}

function taxonomyIds(catalogs, dimension) {
    return new Set(
        catalogs.taxonomy.dimensions[dimension].map((entry) => entry.id),
    );
}

export function graphHasCycle(adjacency) {
    const nodes = new Set(adjacency.keys());
    for (const dependencies of adjacency.values()) {
        for (const dependency of dependencies) nodes.add(dependency);
    }
    const incoming = new Map([...nodes].map((node) => [node, 0]));
    for (const dependencies of adjacency.values()) {
        for (const dependency of dependencies)
            incoming.set(dependency, incoming.get(dependency) + 1);
    }
    const pending = [...nodes].filter((node) => incoming.get(node) === 0);
    let visited = 0;
    while (pending.length > 0) {
        const node = pending.pop();
        visited += 1;
        for (const dependency of adjacency.get(node) ?? []) {
            const remaining = incoming.get(dependency) - 1;
            incoming.set(dependency, remaining);
            if (remaining === 0) pending.push(dependency);
        }
    }
    return visited !== nodes.size;
}

function validateApplicability(target, field, knownIds, errors) {
    const applicability = target[field];
    if (applicability.state === "applicable") {
        if (applicability.ids.length === 0)
            errors.push(`${target.id}: applicable ${field} needs explicit ids`);
        for (const id of applicability.ids) {
            if (!knownIds.has(id))
                errors.push(`${target.id}: unknown ${field} id ${id}`);
        }
    } else if (applicability.ids.length > 0) {
        errors.push(`${target.id}: ${field} ids require applicable state`);
    }
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
    const sourceContractsById = new Map(
        catalogs.sourceContracts.contracts.map((contract) => [
            contract.id,
            contract,
        ]),
    );
    const companionIds = new Set(
        catalogs.upstreamCompanions.companions.map((companion) => companion.id),
    );
    const authoringContractsById = new Map(
        catalogs.authoringContracts.contracts.map((contract) => [
            contract.id,
            contract,
        ]),
    );
    const productIds = taxonomyIds(catalogs, "products");
    const languageIds = taxonomyIds(catalogs, "languages");
    const architectureIds = taxonomyIds(catalogs, "architectures");
    const personaIds = taxonomyIds(catalogs, "personas");
    const surfaceIds = taxonomyIds(catalogs, "surfaces");
    const repositoryProfileIds = taxonomyIds(catalogs, "repositoryProfiles");
    const effectOperationIds = taxonomyIds(catalogs, "effectOperations");
    const dataClassificationIds = taxonomyIds(catalogs, "dataClassifications");
    addDuplicateErrors(errors, "targets", targetIdList);
    for (const target of catalogs.targets.targets) {
        if (target.semanticName !== target.id)
            errors.push(`${target.id}: semanticName must equal id`);
        for (const productId of target.products) {
            if (!productIds.has(productId))
                errors.push(`${target.id}: unknown product ${productId}`);
        }
        for (const languageId of target.languages) {
            if (!languageIds.has(languageId))
                errors.push(`${target.id}: unknown language ${languageId}`);
        }
        validateApplicability(target, "architectures", architectureIds, errors);
        validateApplicability(target, "personas", personaIds, errors);
        validateApplicability(target, "surfaces", surfaceIds, errors);
        validateApplicability(
            target,
            "repositoryProfiles",
            repositoryProfileIds,
            errors,
        );
        if (
            (target.trust.class === "executable") !==
            target.security.executable
        )
            errors.push(
                `${target.id}: trust class must match executable security classification`,
            );
        addDuplicateErrors(
            errors,
            `${target.id} effects`,
            target.trust.effects.map((effect) => effect.id),
        );
        for (const effect of target.trust.effects) {
            if (!effectOperationIds.has(effect.operation))
                errors.push(
                    `${target.id}: unknown effect operation ${effect.operation}`,
                );
            for (const dataClassification of effect.dataClassifications) {
                if (!dataClassificationIds.has(dataClassification))
                    errors.push(
                        `${target.id}: unknown data classification ${dataClassification}`,
                    );
            }
            if (
                effect.confirmation.required ===
                (effect.confirmation.timing === "none")
            ) {
                errors.push(
                    `${target.id}: effect confirmation timing contradicts its requirement`,
                );
            }
            if (effect.authorization.required) {
                if (
                    effect.authorization.authority === "not-required" ||
                    effect.authorization.evidenceIds.length === 0
                ) {
                    errors.push(
                        `${target.id}: required effect authorization needs authority and evidence`,
                    );
                }
            } else if (
                effect.authorization.authority !== "not-required" ||
                effect.authorization.evidenceIds.length > 0
            ) {
                errors.push(
                    `${target.id}: optional effect authorization must use not-required with no evidence`,
                );
            }
            const requiresEffectConfirmation =
                [
                    "create",
                    "modify",
                    "delete",
                    "execute",
                    "transmit",
                    "publish",
                ].includes(effect.operation) ||
                effect.dataClassifications.includes("credential");
            if (
                requiresEffectConfirmation &&
                (!effect.confirmation.required ||
                    effect.confirmation.timing === "none")
            ) {
                errors.push(
                    `${target.id}: effect ${effect.id} requires explicit confirmation`,
                );
            }
            if (requiresEffectConfirmation && !effect.authorization.required) {
                errors.push(
                    `${target.id}: effect ${effect.id} requires explicit authorization`,
                );
            }
            if (
                ["delete", "transmit", "publish"].includes(effect.operation) &&
                effect.confirmation.timing !== "before-effect"
            ) {
                errors.push(
                    `${target.id}: high-impact effect ${effect.id} requires confirmation before effect`,
                );
            }
            if (effect.reversible && !effect.rollbackOrCompensation)
                errors.push(
                    `${target.id}: reversible effect needs rollback or compensation`,
                );
        }
        if (
            target.security.destructive &&
            target.trust.assessmentState === "assessed" &&
            target.trust.effects.length === 0
        ) {
            errors.push(
                `${target.id}: destructive guidance requires an explicit effect assessment`,
            );
        }
        if (
            target.dependencyClassificationState === "unclassified" &&
            target.dependencyEdges.length > 0
        ) {
            errors.push(
                `${target.id}: dependency edges require classified state`,
            );
        }
        if (target.dependencyClassificationState === "classified") {
            const legacyByCategory = new Map([
                ["target", target.dependencies.targets],
                ["tool", target.dependencies.externalTools],
                ["internal-artifact", target.dependencies.internalArtifacts],
            ]);
            for (const [category, legacyIds] of legacyByCategory) {
                const classifiedIds = target.dependencyEdges
                    .filter((edge) => edge.category === category)
                    .map((edge) => edge.dependencyId);
                if (!equalStringSets(legacyIds, classifiedIds))
                    errors.push(
                        `${target.id}: classified ${category} dependencies must preserve legacy membership`,
                    );
            }
        }
        if (
            target.sourceContractState === "unclassified" &&
            (target.sourceContractIds.length > 0 ||
                target.sourceAuthoritySubjects.length > 0)
        ) {
            errors.push(
                `${target.id}: source contracts and subjects require classified state`,
            );
        }
        if (
            target.sourceContractState === "classified" &&
            (target.sourceContractIds.length === 0 ||
                target.sourceAuthoritySubjects.length === 0)
        ) {
            errors.push(
                `${target.id}: classified source authority needs contracts and subjects`,
            );
        }
        const selectedSourceContracts = [];
        for (const sourceContractId of target.sourceContractIds) {
            const sourceContract = sourceContractsById.get(sourceContractId);
            if (!sourceContract) {
                errors.push(
                    `${target.id}: unknown source contract ${sourceContractId}`,
                );
                continue;
            }
            selectedSourceContracts.push(sourceContract);
            if (
                !sourceContract.productIds.some((productId) =>
                    target.products.includes(productId),
                )
            ) {
                errors.push(
                    `${target.id}: source contract ${sourceContractId} does not cover a target product`,
                );
            }
            if (
                target.approval.state === "approved" &&
                (sourceContract.verificationState !== "verified" ||
                    !sourceContract.distributionInputAllowed)
            ) {
                errors.push(
                    `${target.id}: approved target needs verified distribution source contract ${sourceContractId}`,
                );
            }
        }
        if (target.sourceContractState === "classified") {
            for (const productId of target.products) {
                for (const subject of target.sourceAuthoritySubjects) {
                    if (
                        !selectedSourceContracts.some(
                            (contract) =>
                                contract.productIds.includes(productId) &&
                                contract.subjectKinds.includes(subject),
                        )
                    ) {
                        errors.push(
                            `${target.id}: source authority does not cover ${productId}/${subject}`,
                        );
                    }
                }
            }
        }
        if (
            target.authoringContractState === "unclassified" &&
            target.authoringContractIds.length > 0
        ) {
            errors.push(
                `${target.id}: authoring contracts require classified state`,
            );
        }
        if (
            target.authoringContractState === "classified" &&
            target.authoringContractIds.length === 0
        ) {
            errors.push(
                `${target.id}: classified authoring contracts cannot be empty`,
            );
        }
        for (const authoringContractId of target.authoringContractIds) {
            const authoringContract =
                authoringContractsById.get(authoringContractId);
            if (!authoringContract)
                errors.push(
                    `${target.id}: unknown authoring contract ${authoringContractId}`,
                );
            else if (
                target.approval.state === "approved" &&
                authoringContract.state !== "active"
            )
                errors.push(
                    `${target.id}: approved target needs active authoring contract ${authoringContractId}`,
                );
        }
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
        addDuplicateErrors(
            errors,
            `${target.id} dependency edges`,
            target.dependencyEdges.map(
                (edge) => `${edge.category}:${edge.dependencyId}`,
            ),
        );
        for (const edge of target.dependencyEdges) {
            if (companionIds.has(edge.dependencyId))
                errors.push(
                    `${target.id}: upstream companion cannot satisfy a dependency`,
                );
            if (edge.category === "target" && !targetIds.has(edge.dependencyId))
                errors.push(
                    `${target.id}: unknown dependency edge target ${edge.dependencyId}`,
                );
            if (edge.category === "target" && edge.dependencyId === target.id)
                errors.push(
                    `${target.id}: dependency edge cannot target itself`,
                );
            const action = edge.missingBehavior.action;
            const validAction =
                (edge.strength === "hard" && action === "block") ||
                (edge.strength === "soft" &&
                    ["degrade", "substitute"].includes(action)) ||
                (edge.strength === "optional" && action === "omit");
            if (!validAction)
                errors.push(
                    `${target.id}: ${edge.strength} dependency has invalid ${action} behavior`,
                );
            if (action === "substitute") {
                const substitute = edge.missingBehavior.substituteDependencyId;
                if (!substitute)
                    errors.push(
                        `${target.id}: substitute dependency needs a substitute id`,
                    );
                if (substitute && companionIds.has(substitute))
                    errors.push(
                        `${target.id}: upstream companion cannot be a dependency substitute`,
                    );
                if (substitute === edge.dependencyId)
                    errors.push(
                        `${target.id}: substitute dependency cannot select the missing dependency`,
                    );
                if (
                    edge.category === "target" &&
                    substitute &&
                    !targetIds.has(substitute)
                )
                    errors.push(
                        `${target.id}: substitute dependency needs a known target`,
                    );
                if (edge.category === "target" && substitute === target.id)
                    errors.push(
                        `${target.id}: substitute dependency cannot select itself`,
                    );
            } else if (edge.missingBehavior.substituteDependencyId) {
                errors.push(
                    `${target.id}: substitute id requires substitute behavior`,
                );
            }
        }
        if (target.approval.state !== "approved" && target.includeInRuntime) {
            errors.push(
                `${target.id}: only approved targets can enter runtime`,
            );
        }
        if (target.approval.state === "approved") {
            if (target.capabilityKind === "unclassified")
                errors.push(
                    `${target.id}: approved target needs capability kind`,
                );
            if (target.invocation === "unclassified")
                errors.push(`${target.id}: approved target needs invocation`);
            if (target.lifecycle !== "approved")
                errors.push(
                    `${target.id}: approved target needs approved lifecycle`,
                );
            for (const field of [
                "architectures",
                "personas",
                "surfaces",
                "repositoryProfiles",
            ]) {
                if (target[field].state === "unclassified")
                    errors.push(
                        `${target.id}: approved target needs classified ${field}`,
                    );
            }
            if (target.trust.assessmentState !== "assessed")
                errors.push(
                    `${target.id}: approved target needs assessed trust and effects`,
                );
            if (target.dependencyClassificationState !== "classified")
                errors.push(
                    `${target.id}: approved target needs classified dependencies`,
                );
            if (target.sourceContractState !== "classified")
                errors.push(
                    `${target.id}: approved target needs classified source contracts`,
                );
            if (target.authoringContractState !== "classified")
                errors.push(
                    `${target.id}: approved target needs classified authoring contracts`,
                );
            if (
                !target.authoringContractIds.includes(
                    "cratis-skill-clean-room-v1",
                )
            )
                errors.push(
                    `${target.id}: approved target needs the Cratis clean-room authoring contract`,
                );
            if (
                target.audience === "public" &&
                target.dependencies.internalArtifacts.length > 0
            ) {
                errors.push(
                    `${target.id}: approved public target cannot depend on internal artifacts`,
                );
            }
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
        if (
            target.approval.state !== "approved" &&
            target.lifecycle === "approved"
        ) {
            errors.push(
                `${target.id}: approved lifecycle requires target approval`,
            );
        }
        for (const evidenceId of [
            ...target.evidenceIds,
            ...target.approval.evidenceIds,
            ...target.security.evidenceIds,
            ...target.trust.effects.flatMap((effect) => [
                ...effect.evidenceIds,
                ...effect.authorization.evidenceIds,
            ]),
            ...Object.values(target.evaluations).flatMap(
                (evaluation) => evaluation.evidenceIds,
            ),
        ]) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${target.id}: unknown evidence ${evidenceId}`);
        }
    }
    const hardDependencies = new Map(
        catalogs.targets.targets.map((target) => [
            target.id,
            target.dependencyEdges
                .filter(
                    (edge) =>
                        edge.category === "target" && edge.strength === "hard",
                )
                .map((edge) => edge.dependencyId),
        ]),
    );
    if (graphHasCycle(hardDependencies))
        errors.push(
            "hard target dependencies must form a directed acyclic graph",
        );
    const substitutes = new Map(
        catalogs.targets.targets.map((target) => [
            target.id,
            target.dependencyEdges
                .filter(
                    (edge) =>
                        edge.category === "target" &&
                        edge.missingBehavior.action === "substitute",
                )
                .map((edge) => edge.missingBehavior.substituteDependencyId),
        ]),
    );
    if (graphHasCycle(substitutes))
        errors.push("substitute target dependencies must not cycle");
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
    const migratedTargets = catalogs.migrations.migrations.flatMap(
        (migration) => migration.targetIds,
    );
    addDuplicateErrors(errors, "migration target accounting", migratedTargets);
    if (!equalStringSets(migratedTargets, targetIds))
        errors.push("migrations must produce every target exactly once");
    const targetSources = new Map();
    for (const migration of catalogs.migrations.migrations) {
        for (const targetId of migration.targetIds)
            targetSources.set(targetId, migration.sourceIds);
    }
    for (const target of catalogs.targets.targets) {
        if (
            !equalStringSets(
                target.sourceSkillIds,
                targetSources.get(target.id) ?? [],
            )
        )
            errors.push(
                `${target.id}: target source skills must equal its migration inputs`,
            );
    }
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

export function validateTaxonomy(catalogs) {
    const errors = [];
    const fixedDimensions = new Map([
        [
            "capabilityKinds",
            [
                "primitive",
                "router",
                "journey",
                "gate",
                "explanation",
                "adapter",
            ],
        ],
        ["invocations", ["user", "model", "both"]],
        ["trustClasses", ["passive", "executable"]],
        [
            "effectOperations",
            [
                "read",
                "create",
                "modify",
                "delete",
                "execute",
                "transmit",
                "publish",
            ],
        ],
        ["dependencyStrengths", ["hard", "soft", "optional"]],
        [
            "missingDependencyActions",
            ["block", "degrade", "omit", "substitute"],
        ],
    ]);
    for (const [dimension, entries] of Object.entries(
        catalogs.taxonomy.dimensions,
    )) {
        const ids = entries.map((entry) => entry.id);
        addDuplicateErrors(errors, `taxonomy ${dimension}`, ids);
        const expected = fixedDimensions.get(dimension);
        if (expected && !equalStringSets(ids, expected))
            errors.push(`taxonomy ${dimension} must match the closed contract`);
    }
    return errors;
}

export function validateSourceContracts(catalogs) {
    const errors = [];
    const evidenceById = new Map(
        catalogs.evidence.evidence.map((evidence) => [evidence.id, evidence]),
    );
    const evidenceIds = new Set(evidenceById.keys());
    const productIds = taxonomyIds(catalogs, "products");
    addDuplicateErrors(
        errors,
        "source contracts",
        catalogs.sourceContracts.contracts.map((contract) => contract.id),
    );
    const verifiedAuthority = new Map();
    for (const contract of catalogs.sourceContracts.contracts) {
        if (!contract.repositoryUrl.startsWith("https://"))
            errors.push(`${contract.id}: repository URL must use HTTPS`);
        for (const productId of contract.productIds) {
            if (!productIds.has(productId))
                errors.push(`${contract.id}: unknown product ${productId}`);
            for (const subjectKind of contract.subjectKinds) {
                if (contract.verificationState !== "verified") continue;
                const key = `${productId}/${subjectKind}`;
                const existing = verifiedAuthority.get(key);
                if (existing)
                    errors.push(
                        `${contract.id}: verified authority overlaps ${existing} for ${key}`,
                    );
                verifiedAuthority.set(key, contract.id);
            }
        }
        if (contract.verificationState === "verified") {
            for (const field of [
                "immutableRevision",
                "verifiedOn",
                "contentDigest",
            ]) {
                if (!contract[field])
                    errors.push(
                        `${contract.id}: verified source contract is missing ${field}`,
                    );
            }
            const revisionBoundEvidence = contract.evidenceIds.some(
                (evidenceId) => {
                    const evidence = evidenceById.get(evidenceId);
                    return (
                        evidence?.officialUrl.startsWith(
                            contract.repositoryUrl,
                        ) &&
                        evidence.immutableRevision ===
                            contract.immutableRevision &&
                        evidence.digest === contract.contentDigest
                    );
                },
            );
            if (!revisionBoundEvidence)
                errors.push(
                    `${contract.id}: verified source contract lacks revision-bound evidence`,
                );
        }
        if (
            contract.distributionInputAllowed &&
            contract.verificationState !== "verified"
        ) {
            errors.push(
                `${contract.id}: only verified source contracts can supply distribution input`,
            );
        }
        for (const evidenceId of contract.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${contract.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

export function validateBundles(catalogs) {
    const errors = [];
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const targetsById = new Map(
        catalogs.targets.targets.map((target) => [target.id, target]),
    );
    addDuplicateErrors(
        errors,
        "bundles",
        catalogs.bundles.bundles.map((bundle) => bundle.id),
    );
    const optionalCandidatesByRoot = new Map();
    function optionalCandidatesForRoot(rootTargetId) {
        const cached = optionalCandidatesByRoot.get(rootTargetId);
        if (cached) return cached;
        const optionalCandidates = new Set();
        const visited = new Set();
        const pending = [rootTargetId];
        while (pending.length > 0) {
            const targetId = pending.pop();
            if (visited.has(targetId)) continue;
            visited.add(targetId);
            const target = targetsById.get(targetId);
            if (target?.dependencyClassificationState !== "classified")
                continue;
            for (const edge of target.dependencyEdges) {
                if (edge.category !== "target") continue;
                if (edge.strength === "hard") pending.push(edge.dependencyId);
                else optionalCandidates.add(edge.dependencyId);
            }
        }
        optionalCandidatesByRoot.set(rootTargetId, optionalCandidates);
        return optionalCandidates;
    }
    for (const bundle of catalogs.bundles.bundles) {
        const selectedTargetIds = [
            ...bundle.rootTargetIds,
            ...bundle.selectedSoftOrOptionalTargetIds,
        ];
        if (new Set(selectedTargetIds).size !== selectedTargetIds.length)
            errors.push(`${bundle.id}: target selection contains duplicates`);
        const selectedTargets = new Set(selectedTargetIds);
        for (const targetId of selectedTargetIds) {
            const target = targetsById.get(targetId);
            if (!target) {
                errors.push(`${bundle.id}: unknown target ${targetId}`);
                continue;
            }
            if (bundle.audience === "public" && target.audience !== "public")
                errors.push(
                    `${bundle.id}: public bundle cannot select engineering target ${targetId}`,
                );
        }
        for (const targetId of selectedTargetIds) {
            const target = targetsById.get(targetId);
            if (target?.dependencyClassificationState !== "classified")
                continue;
            for (const edge of target.dependencyEdges) {
                if (
                    edge.category === "target" &&
                    edge.strength === "hard" &&
                    !selectedTargets.has(edge.dependencyId)
                ) {
                    errors.push(
                        `${bundle.id}: missing hard dependency ${edge.dependencyId} for ${targetId}`,
                    );
                }
            }
        }
        const optionalCandidates = new Set();
        for (const rootTargetId of bundle.rootTargetIds) {
            for (const targetId of optionalCandidatesForRoot(rootTargetId))
                optionalCandidates.add(targetId);
        }
        for (const targetId of bundle.selectedSoftOrOptionalTargetIds) {
            if (!optionalCandidates.has(targetId))
                errors.push(
                    `${bundle.id}: selected optional target ${targetId} is not reachable from bundle roots`,
                );
        }
        if (bundle.publishable) {
            if (bundle.state !== "approved")
                errors.push(
                    `${bundle.id}: publishable bundle must be approved`,
                );
            if (bundle.missingCapabilityIds.length > 0)
                errors.push(
                    `${bundle.id}: publishable bundle cannot retain capability gaps`,
                );
            for (const targetId of [
                ...bundle.rootTargetIds,
                ...bundle.selectedSoftOrOptionalTargetIds,
            ]) {
                const target = targetsById.get(targetId);
                if (
                    !target ||
                    target.approval.state !== "approved" ||
                    !target.includeInRuntime
                ) {
                    errors.push(
                        `${bundle.id}: publishable bundle contains unapproved target ${targetId}`,
                    );
                }
            }
        }
        for (const evidenceId of bundle.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${bundle.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

export function validateUpstreamCompanions(catalogs) {
    const errors = [];
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const targetIds = new Set(
        catalogs.targets.targets.map((target) => target.id),
    );
    addDuplicateErrors(
        errors,
        "upstream companions",
        catalogs.upstreamCompanions.companions.map((companion) => companion.id),
    );
    for (const companion of catalogs.upstreamCompanions.companions) {
        if (targetIds.has(companion.id))
            errors.push(
                `${companion.id}: companion id cannot equal a Cratis target id`,
            );
        if (!companion.upstreamUrl.startsWith("https://"))
            errors.push(`${companion.id}: upstream URL must use HTTPS`);
        if (companion.expiresOn < catalogs.evidence.asOf)
            errors.push(`${companion.id}: companion review has expired`);
        for (const targetId of companion.knownCollisionTargetIds) {
            if (!targetIds.has(targetId))
                errors.push(
                    `${companion.id}: unknown collision target ${targetId}`,
                );
        }
        for (const evidenceId of companion.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${companion.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

export function validateAuthoringContracts(catalogs) {
    const errors = [];
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    addDuplicateErrors(
        errors,
        "authoring contracts",
        catalogs.authoringContracts.contracts.map((contract) => contract.id),
    );
    const activeContracts = catalogs.authoringContracts.contracts.filter(
        (contract) => contract.state === "active",
    );
    if (activeContracts.length !== 1)
        errors.push("exactly one authoring contract must be active");
    const cleanRoom = catalogs.authoringContracts.contracts.find(
        (contract) => contract.id === "cratis-skill-clean-room-v1",
    );
    if (!cleanRoom || cleanRoom.state !== "active")
        errors.push("the Cratis clean-room skill contract must be active");
    if (cleanRoom) {
        if (
            !equalStringSets(cleanRoom.outputPolicy.requiredFrontmatterKeys, [
                "name",
                "description",
            ])
        ) {
            errors.push(
                `${cleanRoom.id}: required frontmatter must be exactly name and description`,
            );
        }
        const requiredEvidenceKinds = [
            "behavior",
            "positive-trigger",
            "negative-trigger",
            "collision",
            "security",
            "portability",
            "source-review",
        ];
        if (
            !equalStringSets(
                cleanRoom.requiredEvidenceKinds,
                requiredEvidenceKinds,
            )
        ) {
            errors.push(
                `${cleanRoom.id}: required evidence kinds must match the release gate`,
            );
        }
    }
    for (const contract of catalogs.authoringContracts.contracts) {
        for (const evidenceId of contract.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${contract.id}: unknown evidence ${evidenceId}`);
        }
    }
    return errors;
}

function validateRelativeGeneratedPath(path, label, errors) {
    const segments = path.split("/");
    if (
        isAbsolute(path) ||
        path.includes("\\") ||
        segments.some(
            (segment) => segment === "" || segment === "." || segment === "..",
        )
    ) {
        errors.push(`${label} must be a normalized relative path`);
    }
}

export function validateHumanCatalogContract(catalogs) {
    const errors = [];
    const contract = catalogs.humanCatalog;
    validateRelativeGeneratedPath(
        contract.outputRoot,
        "human catalog output root",
        errors,
    );
    for (const [kind, path] of Object.entries(contract.generatedFiles))
        validateRelativeGeneratedPath(path, `human catalog ${kind}`, errors);
    if (!contract.outputRoot.startsWith("catalog/generated/"))
        errors.push("human catalog output must remain under catalog/generated");
    if (
        !equalStringSets(contract.includeAudiences, [
            "public",
            "cratis-engineering",
        ])
    )
        errors.push(
            "human catalog must include public and Cratis engineering targets",
        );
    if (contract.includeRuntimePayloadBytes)
        errors.push("human catalog can never include runtime payload bytes");
    const requiredSections = [
        "identity",
        "purpose",
        "when-to-use",
        "when-not-to-use",
        "invocation",
        "applicability",
        "dependencies",
        "trust-and-effects",
        "evidence-and-support",
        "related-capabilities",
        "bundle-membership",
        "profile-membership",
    ];
    if (
        !equalStringSets(contract.requiredCapabilitySections, requiredSections)
    ) {
        errors.push("human catalog sections must match the product contract");
    }
    if (!contract.disclaimer.includes("does not grant runtime permission"))
        errors.push("human catalog disclaimer must deny runtime permission");
    return errors;
}

export function validateArtifacts(catalogs, root = defaultRepositoryRoot) {
    const errors = [];
    const decision = catalogs.artifacts.distributionDecision;
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((evidence) => evidence.id),
    );
    const targetIds = new Set(
        catalogs.targets.targets.map((target) => target.id),
    );
    const targetAudiences = new Map(
        catalogs.targets.targets.map((target) => [target.id, target.audience]),
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
    const componentKindByInventory = new Map([
        ["skills", "skill"],
        ["agents", "agent"],
        ["subagents", "subagent"],
        ["commands", "command"],
        ["prompts", "prompt"],
        ["rules", "rule"],
        ["instructions", "instruction"],
        ["hooks", "hook"],
        ["mcp", "mcp"],
        ["lsp", "lsp"],
        ["executableExtensions", "executable-host-extension"],
        ["staticAssets", "static-asset"],
    ]);
    const componentsById = new Map(
        catalogs.components.components.map((component) => [
            component.id,
            component,
        ]),
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
                targetAudiences.get(targetId) !== artifact.audience
            ) {
                errors.push(
                    `${artifact.id}: ${artifact.audience} artifact cannot select ${targetAudiences.get(targetId)} target ${targetId}`,
                );
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
        for (const [inventoryName, expectedKind] of componentKindByInventory) {
            for (const componentId of artifact.componentInventory[
                inventoryName
            ]) {
                const component = componentsById.get(componentId);
                if (!component) {
                    errors.push(
                        `${artifact.id}: unknown ${expectedKind} component ${componentId}`,
                    );
                } else if (component.kind !== expectedKind) {
                    errors.push(
                        `${artifact.id}: ${inventoryName} inventory cannot contain ${component.kind} component ${componentId}`,
                    );
                } else if (
                    !artifact.fixtureOnly &&
                    component.audience !== artifact.audience
                ) {
                    errors.push(
                        `${artifact.id}: ${artifact.audience} artifact cannot select ${component.audience} component ${componentId}`,
                    );
                } else if (
                    !artifact.fixtureOnly &&
                    liveEnabled &&
                    component.approval.state !== "approved"
                ) {
                    errors.push(
                        `${artifact.id}: live artifact cannot select unapproved component ${componentId}`,
                    );
                }
                if (
                    ["hooks", "mcp", "lsp", "executableExtensions"].includes(
                        inventoryName,
                    )
                ) {
                    errors.push(
                        `${artifact.id}: passive artifact rejects executable component ${componentId}`,
                    );
                }
            }
        }
        if (
            !artifact.fixtureOnly &&
            !artifact.materializationAllowed &&
            artifact.exactSourcePaths.length > 0
        )
            errors.push(
                `${artifact.id}: non-materialized artifact cannot claim exact source bytes`,
            );
        if (artifact.fixtureOnly || artifact.materializationAllowed) {
            try {
                const expectedSourcePaths = [];
                for (const [inventoryName] of componentKindByInventory)
                    for (const componentId of artifact.componentInventory[
                        inventoryName
                    ]) {
                        const component = componentsById.get(componentId);
                        if (!component) continue;
                        for (const source of component.canonicalSources)
                            expectedSourcePaths.push(
                                ...regularFiles(
                                    root,
                                    source.path,
                                ),
                            );
                    }
                const expected = [...new Set(expectedSourcePaths)].sort(
                    compareOrdinal,
                );
                const actual = [...artifact.exactSourcePaths].sort(
                    compareOrdinal,
                );
                if (JSON.stringify(expected) !== JSON.stringify(actual))
                    errors.push(
                        `${artifact.id}: exact source paths do not match the complete component byte inventory`,
                    );
            } catch (error) {
                errors.push(
                    `${artifact.id}: component byte inventory failed: ${error.message}`,
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
        .sort(compareOrdinal);
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
    return changes.sort((left, right) => compareOrdinal(left.path, right.path));
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
    const requiredGenerationDependencies = new Map([
        [
            "catalog-v2-generated-surfaces",
            ["tooling/generate-component-catalogs.mjs"],
        ],
        [
            "generated-human-catalog",
            [
                "catalog/v2/components.json",
                "catalog/v2/component-projections.json",
            ],
        ],
        [
            "s8-native-non-skill-expected-tree",
            [
                "catalog/component-projections.json",
                "catalog/components.json",
                "catalog/evidence.json",
                "catalog/host-adapters.json",
                "tooling/native-non-skill-projections.mjs",
            ],
        ],
        [
            "mcp-generated-guidance-references",
            [
                "catalog/chronicle-mcp-tool-classifications.json",
                "catalog/evidence.json",
                "catalog/mcp-guidance-products.json",
                "catalog/studio-mcp-tool-classifications.json",
                "catalog/schemas/chronicle-mcp-tool-classifications.schema.json",
                "catalog/schemas/evidence.schema.json",
                "catalog/schemas/mcp-guidance-products.schema.json",
                "catalog/schemas/v2/catalog-v2.schema.json",
                "catalog/v2/source-contracts.json",
                "tooling/chronicle-mcp-guidance-validation.mjs",
                "tooling/generate-chronicle-mcp-guidance-references.mjs",
                "tooling/generate-mcp-guidance-references.mjs",
                "tooling/mcp-guidance-product-contract.mjs",
                "tooling/mcp-guidance-validation.mjs",
                "tooling/support-validation.mjs",
            ],
        ],
    ]);
    for (const [recordId, dependencies] of requiredGenerationDependencies) {
        const record = inventory.records.find(
            (candidate) => candidate.id === recordId,
        );
        for (const dependency of dependencies)
            if (!record?.dependencies.includes(dependency))
                errors.push(
                    `${recordId}: missing generation provenance dependency ${dependency}`,
                );
    }
    const generatedSurfaces = inventory.records.find(
        (record) => record.id === "catalog-v2-generated-surfaces",
    );
    if (
        !generatedSurfaces?.generator?.includes(
            "tooling/generate-component-catalogs.mjs",
        )
    )
        errors.push(
            "catalog-v2-generated-surfaces: component catalog generator is missing from provenance",
        );
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
    const universeSet = new Set(universe);
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
        if (!universeSet.has(path))
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
    errors.push(...validateTaxonomy(catalogs));
    errors.push(...validateSources(catalogs, root));
    errors.push(...validateTargets(catalogs));
    errors.push(...validateMigrations(catalogs));
    errors.push(...validateEvidenceAndCoverage(catalogs, root));
    errors.push(...validateSourceContracts(catalogs));
    errors.push(...validateBundles(catalogs));
    errors.push(...validateUpstreamCompanions(catalogs));
    errors.push(...validateAuthoringContracts(catalogs));
    errors.push(...validateHumanCatalogContract(catalogs));
    errors.push(...validateArtifacts(catalogs, root));
    errors.push(...validateComponentCatalogs(root));
    errors.push(...validateRepositoryInventory(catalogs, root));
    return errors;
}
