// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "../catalog-validation.mjs";
import {
    graphHasCycle,
    v2CatalogPaths,
    v2SchemaPath,
    validateArtifacts,
    validateAuthoringContracts,
    validateBundles,
    validateEvidenceAndCoverage,
    validateMigrations,
    validateHumanCatalogContract,
    validateRepositoryInventory,
    validateSourceContracts,
    validateSources,
    validateTargets,
    validateTaxonomy,
    validateUpstreamCompanions,
    validateV2Catalogs,
} from "../catalog-v2-validation.mjs";

function clone(value) {
    return structuredClone(value);
}

function loadCatalogs() {
    return Object.fromEntries(
        Object.entries(v2CatalogPaths).map(([key, path]) => [
            key,
            readCatalog(join(defaultRepositoryRoot, path)),
        ]),
    );
}

const schema = readCatalog(join(defaultRepositoryRoot, v2SchemaPath));

test("catalog v2 schemas and semantic policy pass for the repository", () => {
    assert.deepEqual(validateV2Catalogs(), []);
});

test("catalog v2 preserves all 43 sources while split and merge targets are independent", () => {
    const catalogs = loadCatalogs();
    assert.equal(catalogs.sources.sources.length, 43);
    assert.equal(catalogs.targets.targets.length, 43);
    const split = catalogs.migrations.migrations.find(
        (migration) => migration.kind === "split",
    );
    const merge = catalogs.migrations.migrations.find(
        (migration) => migration.kind === "merge",
    );
    assert.deepEqual(split.sourceIds, ["add-business-rule"]);
    assert.deepEqual(split.targetIds, [
        "cratis-arc-command-validation",
        "cratis-chronicle-event-constraints",
    ]);
    assert.deepEqual(merge.sourceIds, [
        "cratis-vertical-slice",
        "new-vertical-slice",
    ]);
    assert.deepEqual(merge.targetIds, ["cratis-application-vertical-slice"]);
    assert.notEqual(
        catalogs.targets.targets.find(
            (target) => target.id === split.targetIds[0],
        ),
        catalogs.targets.targets.find(
            (target) => target.id === split.targetIds[1],
        ),
    );
});

test("catalog v2 exposes closed shared taxonomies without broadening targets", () => {
    const catalogs = loadCatalogs();
    assert.deepEqual(validateTaxonomy(catalogs), []);
    const productIds = new Set(
        catalogs.taxonomy.dimensions.products.map((entry) => entry.id),
    );
    const languageIds = new Set(
        catalogs.taxonomy.dimensions.languages.map((entry) => entry.id),
    );
    for (const target of catalogs.targets.targets) {
        assert(target.products.every((id) => productIds.has(id)));
        assert(target.languages.every((id) => languageIds.has(id)));
    }
});

test("unreviewed targets remain explicitly unclassified and runtime ineligible", () => {
    const catalogs = loadCatalogs();
    const classified = new Set([
        "cratis-fundamentals-concept",
        "cratis-engineering-docs-add-page",
        "cratis-engineering-docs-authoring",
        "cratis-engineering-docs-edit-page",
    ]);
    for (const target of catalogs.targets.targets) {
        if (classified.has(target.id)) continue;
        assert.equal(target.capabilityKind, "unclassified");
        assert.equal(target.invocation, "unclassified");
        assert.equal(target.lifecycle, "candidate");
        assert.equal(target.trust.class, "passive");
        assert.equal(target.trust.assessmentState, "unclassified");
        assert.deepEqual(target.trust.effects, []);
        assert.equal(target.dependencyClassificationState, "unclassified");
        assert.deepEqual(target.dependencyEdges, []);
        assert.equal(target.sourceContractState, "unclassified");
        assert.deepEqual(target.sourceContractIds, []);
        assert.equal(target.authoringContractState, "unclassified");
        assert.deepEqual(target.authoringContractIds, []);
        for (const field of [
            "architectures",
            "personas",
            "surfaces",
            "repositoryProfiles",
        ]) {
            assert.equal(target[field].state, "unclassified");
            assert.deepEqual(target[field].ids, []);
        }
        assert.equal(target.approval.state, "candidate");
        assert.equal(target.includeInRuntime, false);
    }
});

test("documentation authoring is classified but remains unapproved", () => {
    const catalogs = loadCatalogs();
    const target = catalogs.targets.targets.find(
        (candidate) => candidate.id === "cratis-engineering-docs-authoring",
    );
    assert.equal(target.audience, "cratis-engineering");
    assert.equal(target.capabilityKind, "journey");
    assert.equal(target.invocation, "both");
    assert.deepEqual(target.architectures.ids, ["product-neutral"]);
    assert.deepEqual(target.personas.ids, ["contributor", "maintainer"]);
    assert.deepEqual(target.surfaces.ids, ["direct-agent-skills", "ide"]);
    assert.deepEqual(target.repositoryProfiles.ids, [
        "application",
        "client",
        "corpus",
        "framework",
    ]);
    assert.equal(target.trust.class, "passive");
    assert.equal(target.trust.assessmentState, "assessed");
    assert.deepEqual(
        target.trust.effects.map((effect) => effect.operation),
        ["create", "modify"],
    );
    assert.equal(target.dependencyClassificationState, "classified");
    assert.deepEqual(target.dependencyEdges, []);
    assert.deepEqual(target.dependencies.targets, []);
    assert.deepEqual(target.dependencies.internalArtifacts, []);
    assert.equal(target.sourceContractState, "classified");
    assert.deepEqual(target.sourceContractIds, ["cratis-ai-composition"]);
    assert.deepEqual(target.sourceAuthoritySubjects, [
        "capability-composition",
    ]);
    assert.equal(target.authoringContractState, "classified");
    assert.deepEqual(target.authoringContractIds, [
        "cratis-skill-clean-room-v1",
    ]);
    assert.deepEqual(target.runtimePayloadPolicy.allowed, [
        "SKILL.md",
        "references/**",
        "assets/**",
        "LICENSE*",
    ]);
    const source = catalogs.sources.sources.find(
        (candidate) => candidate.id === "write-documentation",
    );
    assert.equal(
        source.sourcePath,
        "engineering/skills/cratis-engineering-docs-authoring",
    );
    assert.equal(
        source.sourceRevision,
        "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9",
    );
    assert(
        source.evidenceIds.includes(
            "engineering-docs-authoring-source-f58bcf7",
        ),
    );
    assert.equal(target.evaluations.behavior.status, "missing");
    for (const evaluation of [
        target.evaluations.positiveTrigger,
        target.evaluations.negativeTrigger,
        target.evaluations.collision,
    ]) {
        assert.equal(evaluation.status, "passing");
        assert.deepEqual(evaluation.evidenceIds, [
            "engineering-docs-authoring-evaluation-2026-08-22",
        ]);
    }
    assert.equal(target.approval.state, "candidate");
    assert.equal(target.includeInRuntime, false);
});

test("first useful public skill is bound to immutable canonical source", () => {
    const catalogs = loadCatalogs();
    const source = catalogs.sources.sources.find(
        (candidate) => candidate.id === "add-concept",
    );
    const target = catalogs.targets.targets.find(
        (candidate) => candidate.id === "cratis-fundamentals-concept",
    );
    assert.equal(source.sourcePath, "skills/cratis-fundamentals-concept");
    assert.equal(
        source.sourceRevision,
        "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
    );
    assert.deepEqual(source.bundledPaths, [
        "skills/cratis-fundamentals-concept/LICENSE",
        "skills/cratis-fundamentals-concept/SKILL.md",
    ]);
    assert(
        source.evidenceIds.includes(
            "public-fundamentals-concept-source-b53caa5",
        ),
    );
    assert.deepEqual(target.sourceSkillIds, ["add-concept"]);
    assert.deepEqual(target.products, ["chronicle", "fundamentals"]);
    assert.equal(target.capabilityKind, "primitive");
    assert.equal(target.invocation, "both");
    assert.equal(target.trust.assessmentState, "assessed");
    assert.deepEqual(
        target.dependencyEdges.map((edge) => [
            edge.category,
            edge.dependencyId,
            edge.strength,
        ]),
        [["tool", "dotnet", "hard"]],
    );
    assert.deepEqual(target.sourceContractIds, [
        "cratis-fundamentals-source",
        "cratis-chronicle-source",
    ]);
    assert.deepEqual(target.authoringContractIds, [
        "cratis-skill-clean-room-v1",
    ]);
    assert.equal(target.security.disposition, "accepted");
    assert.deepEqual(target.security.evidenceIds, [
        "fundamentals-concept-source-review-2026-08-23",
    ]);
    for (const evaluation of Object.values(target.evaluations)) {
        assert.equal(evaluation.status, "passing");
        assert.deepEqual(evaluation.evidenceIds, [
            "fundamentals-concept-focused-evaluation-2026-08-23",
        ]);
    }
    assert.deepEqual(target.evidenceIds.slice(-3), [
        "fundamentals-concept-source-review-2026-08-23",
        "fundamentals-concept-focused-evaluation-2026-08-23",
        "fundamentals-concept-samples-canary-2026-08-23",
    ]);
    assert.equal(target.approval.state, "approved");
    assert.equal(target.approval.reviewer, "woksin");
    assert.equal(
        target.approval.sourceRevision,
        "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
    );
    assert.equal(
        target.approval.contentDigest,
        "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
    );
    assert.equal(target.includeInRuntime, true);
});

test("documentation companions are classified and bound but unevaluated", () => {
    const catalogs = loadCatalogs();
    const expectations = [
        {
            targetId: "cratis-engineering-docs-add-page",
            sourceId: "add-cratis-docs-page",
            sourcePath: "engineering/skills/cratis-engineering-docs-add-page",
            evidenceId: "engineering-docs-add-page-source-684d037",
            effects: ["create", "modify"],
        },
        {
            targetId: "cratis-engineering-docs-edit-page",
            sourceId: "edit-cratis-docs",
            sourcePath: "engineering/skills/cratis-engineering-docs-edit-page",
            evidenceId: "engineering-docs-edit-page-source-684d037",
            effects: ["modify"],
        },
    ];
    for (const expected of expectations) {
        const target = catalogs.targets.targets.find(
            (candidate) => candidate.id === expected.targetId,
        );
        const source = catalogs.sources.sources.find(
            (candidate) => candidate.id === expected.sourceId,
        );
        assert.equal(target.capabilityKind, "journey");
        assert.equal(target.invocation, "both");
        assert.deepEqual(target.architectures.ids, ["product-neutral"]);
        assert.deepEqual(target.personas.ids, ["contributor", "maintainer"]);
        assert.deepEqual(target.surfaces.ids, ["direct-agent-skills", "ide"]);
        assert.deepEqual(target.repositoryProfiles.ids, [
            "application",
            "client",
            "corpus",
            "framework",
        ]);
        assert.equal(target.trust.class, "passive");
        assert.equal(target.trust.assessmentState, "assessed");
        assert.deepEqual(
            target.trust.effects.map((effect) => effect.operation),
            expected.effects,
        );
        assert(
            target.trust.effects.every(
                (effect) =>
                    effect.confirmation.required === true &&
                    effect.confirmation.timing === "before-effect" &&
                    effect.authorization.required === true &&
                    effect.reversible === true,
            ),
        );
        assert.equal(target.dependencyClassificationState, "classified");
        assert.deepEqual(target.dependencies.targets, [
            "cratis-engineering-docs-authoring",
            "cratis-engineering-docs-visual-qa",
        ]);
        assert.deepEqual(
            target.dependencyEdges.map((edge) => edge.strength),
            ["soft", "optional"],
        );
        assert.equal(target.sourceContractState, "classified");
        assert.deepEqual(target.sourceContractIds, ["cratis-ai-composition"]);
        assert.equal(target.authoringContractState, "classified");
        assert.deepEqual(target.authoringContractIds, [
            "cratis-skill-clean-room-v1",
        ]);
        assert.equal(target.evaluations.behavior.status, "missing");
        assert.equal(target.evaluations.positiveTrigger.status, "missing");
        assert.equal(target.evaluations.negativeTrigger.status, "missing");
        assert.equal(target.evaluations.collision.status, "missing");
        assert.equal(target.approval.state, "candidate");
        assert.equal(target.includeInRuntime, false);
        assert.equal(source.sourcePath, expected.sourcePath);
        assert.equal(
            source.sourceRevision,
            "684d03755bacd40af95463b81b4a0c8b9f088ec1",
        );
        assert(source.evidenceIds.includes(expected.evidenceId));
    }
});

test("source digests remain bound to the current source bytes", () => {
    const catalogs = loadCatalogs();
    catalogs.sources.sources[0].contentDigest = "0".repeat(64);
    assert(
        validateSources(catalogs, defaultRepositoryRoot).some((error) =>
            error.includes("source content digest is stale"),
        ),
    );
});

test("source revisions require immutable evidence and exact revision bytes", () => {
    const catalogs = loadCatalogs();
    const source = catalogs.sources.sources[0];
    source.sourceRevision = "0".repeat(40);
    const errors = validateSources(catalogs, defaultRepositoryRoot);
    assert(
        errors.some((error) =>
            error.includes("lacks matching immutable evidence"),
        ),
    );
    assert(errors.some((error) => error.includes("source provenance failed")));
});

test("candidate and rejected targets can never enter runtime", () => {
    const catalogs = loadCatalogs();
    const target = catalogs.targets.targets[0];
    target.includeInRuntime = true;
    assert(
        validateTargets(catalogs).some((error) =>
            error.includes("only approved targets"),
        ),
    );
    target.approval.state = "rejected";
    assert(
        validateTargets(catalogs).some((error) =>
            error.includes("only approved targets"),
        ),
    );
});

test("approval cannot omit revision, digest, reviewer, evaluations, or security evidence", () => {
    const catalogs = loadCatalogs();
    const target = catalogs.targets.targets[0];
    target.approval.state = "approved";
    target.includeInRuntime = true;
    const errors = validateTargets(catalogs);
    for (const requirement of [
        "needs capability kind",
        "needs invocation",
        "needs approved lifecycle",
        "needs classified architectures",
        "needs classified personas",
        "needs classified surfaces",
        "needs classified repositoryProfiles",
        "needs assessed trust and effects",
        "needs classified dependencies",
        "needs classified source contracts",
        "needs classified authoring contracts",
        "needs the Cratis clean-room authoring contract",
    ]) {
        assert(errors.some((error) => error.includes(requirement)));
    }
    for (const field of [
        "reviewer",
        "approvedOn",
        "sourceRevision",
        "contentDigest",
    ]) {
        assert(errors.some((error) => error.includes(`missing ${field}`)));
    }
    assert(errors.some((error) => error.includes("approval evidence")));
    assert(errors.some((error) => error.includes("security evidence")));
    assert(errors.some((error) => error.includes("passing behavior evidence")));
    assert(
        errors.some((error) =>
            error.includes("passing positiveTrigger evidence"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("passing negativeTrigger evidence"),
        ),
    );
    assert(
        errors.some((error) => error.includes("passing collision evidence")),
    );
});

test("duplicate target and migration ids fail semantic validation", () => {
    const catalogs = loadCatalogs();
    catalogs.targets.targets.push(clone(catalogs.targets.targets[0]));
    assert(
        validateTargets(catalogs).some((error) =>
            error.includes("duplicate id"),
        ),
    );
    catalogs.targets.targets.pop();
    catalogs.migrations.migrations.push(
        clone(catalogs.migrations.migrations[0]),
    );
    assert(
        validateMigrations(catalogs).some((error) =>
            error.includes("duplicate id"),
        ),
    );
});

test("migration outputs remain the exact inverse of target source mappings", () => {
    const catalogs = loadCatalogs();
    const migration = catalogs.migrations.migrations[0];
    const removedTarget = migration.targetIds.pop();
    let errors = validateMigrations(catalogs);
    assert(
        errors.some((error) =>
            error.includes("produce every target exactly once"),
        ),
    );

    migration.targetIds.push(removedTarget);
    const target = catalogs.targets.targets.find(
        (candidate) => candidate.id === removedTarget,
    );
    target.sourceSkillIds = [catalogs.sources.sources[0].id];
    errors = validateMigrations(catalogs);
    assert(
        errors.some((error) =>
            error.includes(
                "target source skills must equal its migration inputs",
            ),
        ),
    );
});

test("applicability, trust, and dependency classifications fail closed", () => {
    const catalogs = loadCatalogs();
    const first = catalogs.targets.targets[0];
    const second = catalogs.targets.targets[1];
    const third = catalogs.targets.targets[2];
    first.architectures.state = "applicable";
    first.architectures.ids = ["missing-architecture"];
    first.trust.class = "executable";
    first.trust.assessmentState = "assessed";
    first.trust.effects = [
        {
            id: "fixture-write",
            operation: "modify",
            resourceBoundary: "Fixture repository",
            scope: "Fixture file",
            dataClassifications: ["credential"],
            reversible: true,
            rollbackOrCompensation: "Restore the fixture file.",
            confirmation: {
                required: false,
                timing: "none",
                reason: "Deliberately invalid fixture.",
            },
            authorization: {
                required: false,
                authority: "not-required",
                evidenceIds: [],
            },
            evidenceIds: ["reevaluation-authority"],
        },
    ];
    first.dependencyClassificationState = "classified";
    first.dependencyEdges = [
        {
            dependencyId: second.id,
            category: "target",
            strength: "hard",
            reason: "Fixture dependency",
            missingBehavior: {
                action: "degrade",
                description: "Invalid hard dependency behavior.",
            },
        },
        {
            dependencyId: third.id,
            category: "target",
            strength: "soft",
            reason: "Fixture substitute",
            missingBehavior: {
                action: "substitute",
                description: "Invalid no-op substitution.",
                substituteDependencyId: third.id,
            },
        },
        {
            dependencyId: "matt-pocock-skills",
            category: "tool",
            strength: "optional",
            reason: "Invalid companion dependency.",
            missingBehavior: {
                action: "omit",
                description: "Omit the invalid dependency.",
            },
        },
    ];
    second.dependencyClassificationState = "classified";
    second.dependencyEdges = [
        {
            dependencyId: first.id,
            category: "target",
            strength: "hard",
            reason: "Fixture cycle",
            missingBehavior: {
                action: "block",
                description: "Block when missing.",
            },
        },
    ];
    const errors = validateTargets(catalogs);
    assert(errors.some((error) => error.includes("unknown architectures id")));
    assert(errors.some((error) => error.includes("trust class must match")));
    assert(
        errors.some((error) =>
            error.includes("requires explicit confirmation"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("requires explicit authorization"),
        ),
    );
    assert(errors.some((error) => error.includes("invalid degrade behavior")));
    assert(
        errors.some((error) =>
            error.includes("cannot select the missing dependency"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("upstream companion cannot satisfy a dependency"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes(
                "classified target dependencies must preserve legacy membership",
            ),
        ),
    );
    assert(errors.some((error) => error.includes("directed acyclic graph")));
});

test("dependency cycle detection handles deep graphs without recursion", () => {
    const size = 5000;
    const graph = new Map();
    for (let index = 0; index < size; index += 1) {
        graph.set(
            `target-${index}`,
            index + 1 < size ? [`target-${index + 1}`] : [],
        );
    }
    assert.equal(graphHasCycle(graph), false);
    graph.set(`target-${size - 1}`, ["target-0"]);
    assert.equal(graphHasCycle(graph), true);
});

test("source contracts cannot become inputs before exact verification", () => {
    const catalogs = loadCatalogs();
    const contract = catalogs.sourceContracts.contracts[0];
    contract.distributionInputAllowed = true;
    assert(
        validateSourceContracts(catalogs).some((error) =>
            error.includes("only verified source contracts"),
        ),
    );
    contract.verificationState = "verified";
    let errors = validateSourceContracts(catalogs);
    for (const field of ["immutableRevision", "verifiedOn", "contentDigest"])
        assert(errors.some((error) => error.includes(`missing ${field}`)));
    contract.immutableRevision = "0".repeat(40);
    contract.verifiedOn = "2026-08-20";
    contract.contentDigest = "0".repeat(64);
    errors = validateSourceContracts(catalogs);
    assert(
        errors.some((error) => error.includes("lacks revision-bound evidence")),
    );
});

test("draft bundles cannot imply publication or target approval", () => {
    const catalogs = loadCatalogs();
    const bundle = catalogs.bundles.bundles[0];
    const selected = new Set(bundle.rootTargetIds);
    const outsideTarget = catalogs.targets.targets.find(
        (target) => !selected.has(target.id),
    );
    const arbitraryOptionalTarget = catalogs.targets.targets.find(
        (target) => !selected.has(target.id) && target.id !== outsideTarget.id,
    );
    bundle.selectedSoftOrOptionalTargetIds = [arbitraryOptionalTarget.id];
    const rootTarget = catalogs.targets.targets.find(
        (target) => target.id === bundle.rootTargetIds[0],
    );
    rootTarget.dependencyClassificationState = "classified";
    rootTarget.dependencyEdges = [
        {
            dependencyId: outsideTarget.id,
            category: "target",
            strength: "hard",
            reason: "Fixture hard dependency",
            missingBehavior: {
                action: "block",
                description: "Block when missing.",
            },
        },
    ];
    bundle.publishable = true;
    const errors = validateBundles(catalogs);
    assert(errors.some((error) => error.includes("must be approved")));
    assert(errors.some((error) => error.includes("unapproved target")));
    assert(errors.some((error) => error.includes("missing hard dependency")));
    assert(
        errors.some((error) =>
            error.includes("is not reachable from bundle roots"),
        ),
    );
});

test("upstream companions contain metadata but never upstream bytes", () => {
    const catalogs = loadCatalogs();
    assert.deepEqual(validateUpstreamCompanions(catalogs), []);
    assert(
        catalogs.upstreamCompanions.companions.every(
            (companion) => companion.bytesIncluded === false,
        ),
    );
    const companions = clone(catalogs.upstreamCompanions);
    companions.companions[0].bytesIncluded = true;
    const errors = validateAgainstSchema(
        companions,
        schema.$defs.upstreamCompanionsCatalog,
        schema,
    );
    assert(errors.some((error) => error.includes("expected constant false")));
});

test("the clean-room authoring contract cannot weaken its evidence or copy policy", () => {
    const catalogs = loadCatalogs();
    assert.deepEqual(validateAuthoringContracts(catalogs), []);
    const contract = catalogs.authoringContracts.contracts[0];
    contract.requiredEvidenceKinds.pop();
    contract.outputPolicy.requiredFrontmatterKeys.push("license");
    const errors = validateAuthoringContracts(catalogs);
    assert(
        errors.some((error) =>
            error.includes("required evidence kinds must match"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("frontmatter must be exactly name and description"),
        ),
    );
});

test("the human catalog contract forbids runtime bytes and permission claims", () => {
    const catalogs = loadCatalogs();
    assert.deepEqual(validateHumanCatalogContract(catalogs), []);
    const contract = catalogs.humanCatalog;
    contract.includeRuntimePayloadBytes = true;
    contract.includeAudiences = ["public"];
    contract.requiredCapabilitySections.pop();
    contract.disclaimer = "This catalog grants runtime permission.";
    const errors = validateHumanCatalogContract(catalogs);
    assert(errors.some((error) => error.includes("runtime payload bytes")));
    assert(
        errors.some((error) =>
            error.includes("must include public and Cratis engineering"),
        ),
    );
    assert(errors.some((error) => error.includes("sections must match")));
    assert(errors.some((error) => error.includes("deny runtime permission")));
});

test("unknown properties fail the closed catalog v2 schema", () => {
    const targets = readCatalog(
        join(defaultRepositoryRoot, v2CatalogPaths.targets),
    );
    targets.targets[0].unexpected = true;
    const errors = validateAgainstSchema(
        targets,
        schema.$defs.targetsCatalog,
        schema,
    );
    assert(
        errors.some((error) => error.includes("unknown property unexpected")),
    );
});

test("unsupported JSON Schema vocabulary fails explicitly", () => {
    const unsupported = clone(schema);
    unsupported.$defs.target.allOf = [];
    assert(
        validateSchemaVocabulary(unsupported).some((error) =>
            error.includes("unsupported JSON Schema keyword allOf"),
        ),
    );
});

test("stale and future-dated evidence fail and every fact remains evidence-bound", () => {
    const catalogs = loadCatalogs();
    assert(
        catalogs.evidence.ecosystemFacts.every(
            (fact) => fact.evidenceIds.length > 0,
        ),
    );
    catalogs.evidence.evidence[0].expiresOn = "2026-08-19";
    catalogs.evidence.evidence[1].verifiedOn = "2026-08-25";
    const errors = validateEvidenceAndCoverage(catalogs);
    assert(errors.some((error) => error.includes("expired")));
    assert(errors.some((error) => error.includes("verified after")));
});

test("local evidence reports remain bound to repository bytes", () => {
    const catalogs = loadCatalogs();
    const localEvidence = catalogs.evidence.evidence.find(
        (evidence) => evidence.sourceKind === "local-evidence-report",
    );
    const originalDigest = localEvidence.digest;
    localEvidence.digest = "0".repeat(64);
    assert(
        validateEvidenceAndCoverage(catalogs).some((error) =>
            error.includes("local evidence digest is stale"),
        ),
    );
    localEvidence.digest = originalDigest;
    localEvidence.repositoryPath = "../outside.md";
    assert(
        validateEvidenceAndCoverage(catalogs).some((error) =>
            error.includes(
                "local evidence path must be normalized and repository-relative",
            ),
        ),
    );
});

test("all v2 catalog families reject dangling evidence", () => {
    const catalogs = loadCatalogs();
    catalogs.sources.sources[0].evidenceIds.push("missing-evidence");
    catalogs.migrations.migrations[0].evidenceIds.push("missing-evidence");
    catalogs.artifacts.artifacts[0].evidenceIds.push("missing-evidence");
    catalogs.repositoryInventory.records[0].evidenceIds.push(
        "missing-evidence",
    );
    catalogs.sourceContracts.contracts[0].evidenceIds.push("missing-evidence");
    catalogs.bundles.bundles[0].evidenceIds.push("missing-evidence");
    catalogs.upstreamCompanions.companions[0].evidenceIds.push(
        "missing-evidence",
    );
    catalogs.authoringContracts.contracts[0].evidenceIds.push(
        "missing-evidence",
    );
    assert(
        validateSources(catalogs, defaultRepositoryRoot).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateMigrations(catalogs).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes("references unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateRepositoryInventory(catalogs, defaultRepositoryRoot).some(
            (error) => error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateSourceContracts(catalogs).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateBundles(catalogs).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateUpstreamCompanions(catalogs).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
    assert(
        validateAuthoringContracts(catalogs).some((error) =>
            error.includes("unknown evidence missing-evidence"),
        ),
    );
});

test("coverage and released claims are separate and evidence-bound", () => {
    const catalogs = loadCatalogs();
    const capabilities = catalogs.productCoverage.products.flatMap(
        (product) => product.capabilities,
    );
    assert(
        capabilities.every((capability) => capability.evidenceIds.length > 0),
    );
    assert(
        capabilities.every((capability) =>
            ["gap", "source-candidate", "partial", "complete"].includes(
                capability.coverageState,
            ),
        ),
    );
    assert(
        capabilities.every(
            (capability) => capability.claimState === "unclaimed",
        ),
    );
});

test("the accepted Option A+ decision releases only explicitly approved targets", () => {
    const catalogs = loadCatalogs();
    const decision = catalogs.artifacts.distributionDecision;
    const planned = catalogs.artifacts.artifacts.find(
        (artifact) => artifact.id === "planned-passive-public-release",
    );
    const engineering = catalogs.artifacts.artifacts.find(
        (artifact) => artifact.id === "planned-passive-engineering-release",
    );
    const fixture = catalogs.artifacts.artifacts.find(
        (artifact) => artifact.fixtureOnly,
    );
    assert.equal(decision.state, "accepted");
    assert.equal(
        decision.acceptedArchitecture,
        "option-a-plus-generated-distribution-repository",
    );
    assert(decision.authorityEvidenceIds.includes("option-a-plus-authority"));
    assert.equal(fixture.materializationAllowed, true);
    assert.equal(planned.materializationAllowed, true);
    assert.equal(planned.runtimeEligible, true);
    assert.deepEqual(planned.componentInventory.skills, [
        "cratis-fundamentals-concept",
    ]);
    assert.deepEqual(planned.exactSourcePaths, [
        "skills/cratis-fundamentals-concept/LICENSE",
        "skills/cratis-fundamentals-concept/SKILL.md",
    ]);
    assert.equal(engineering.audience, "cratis-engineering");
    assert.equal(engineering.materializationAllowed, false);
    assert.equal(engineering.runtimeEligible, false);
    assert.equal(engineering.requiresApprovedTargets, true);
    assert.equal(engineering.exactSourcePaths.length, 0);
    assert(
        engineering.componentInventory.skills.every((targetId) =>
            catalogs.targets.targets.some(
                (target) =>
                    target.id === targetId &&
                    target.audience === "cratis-engineering",
            ),
        ),
    );
    assert(engineering.forbiddenPathPatterns.includes("skills/**"));
    assert(engineering.forbiddenPathPatterns.includes(".cratis/PROJECT.md"));
    const publicTarget = catalogs.targets.targets.find(
        (target) => target.audience === "public",
    );
    engineering.componentInventory.skills.push(publicTarget.id);
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes(
                "cratis-engineering artifact cannot select public target",
            ),
        ),
    );
    engineering.componentInventory.skills.pop();
    planned.requiresApprovedTargets = false;
    planned.materializationAllowed = true;
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes(
                "non-fixture artifacts must require approved targets",
            ),
        ),
    );
    planned.requiresApprovedTargets = true;
    const unapprovedPublicTarget = catalogs.targets.targets.find(
        (target) =>
            target.audience === "public" &&
            target.approval.state !== "approved",
    );
    planned.componentInventory.skills.push(unapprovedPublicTarget.id);
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes("unapproved target selected for live artifact"),
        ),
    );
    planned.componentInventory.skills.pop();
    planned.materializationAllowed = false;
    planned.runtimeEligible = true;
    const runtimeErrors = validateArtifacts(catalogs);
    assert(
        runtimeErrors.some((error) =>
            error.includes(
                "runtime eligibility requires materialization approval",
            ),
        ),
    );
});

test("repository inventory supports a clean tracked repository", () => {
    const inventory = clone(
        readCatalog(
            join(defaultRepositoryRoot, v2CatalogPaths.repositoryInventory),
        ),
    );
    inventory.admittedUntracked = [];
    assert.deepEqual(
        validateAgainstSchema(
            inventory,
            schema.$defs.repositoryInventoryCatalog,
            schema,
        ),
        [],
    );
});

test("repository inventory binds the base delta and self-excluding index digest", () => {
    const catalogs = loadCatalogs();
    catalogs.repositoryInventory.indexDigest = "0".repeat(64);
    catalogs.repositoryInventory.changesSinceBase = [];
    const errors = validateRepositoryInventory(catalogs, defaultRepositoryRoot);
    assert(errors.some((error) => error.includes("index digest changed")));
    assert(
        errors.some((error) => error.includes("base-revision changes changed")),
    );
});

test("repository inventory expands every tracked and admitted redesign path exactly once", () => {
    const catalogs = loadCatalogs();
    assert.deepEqual(
        validateRepositoryInventory(catalogs, defaultRepositoryRoot),
        [],
    );
    assert(
        catalogs.repositoryInventory.records.reduce(
            (count, record) => count + record.expectedPathCount,
            0,
        ) > 300,
    );
});
