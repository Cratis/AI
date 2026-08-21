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
    v2CatalogPaths,
    v2SchemaPath,
    validateArtifacts,
    validateEvidenceAndCoverage,
    validateMigrations,
    validateRepositoryInventory,
    validateSources,
    validateTargets,
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
    assert(errors.some((error) => error.includes("lacks matching immutable evidence")));
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
    unsupported.$defs.target.oneOf = [];
    assert(
        validateSchemaVocabulary(unsupported).some((error) =>
            error.includes("unsupported JSON Schema keyword oneOf"),
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
    catalogs.evidence.evidence[1].verifiedOn = "2026-08-21";
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

test("sources, migrations, artifacts, and inventory reject dangling evidence", () => {
    const catalogs = loadCatalogs();
    catalogs.sources.sources[0].evidenceIds.push("missing-evidence");
    catalogs.migrations.migrations[0].evidenceIds.push("missing-evidence");
    catalogs.artifacts.artifacts[0].evidenceIds.push("missing-evidence");
    catalogs.repositoryInventory.records[0].evidenceIds.push(
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

test("the accepted Option A+ decision still blocks unapproved live targets", () => {
    const catalogs = loadCatalogs();
    const decision = catalogs.artifacts.distributionDecision;
    const planned = catalogs.artifacts.artifacts.find(
        (artifact) => !artifact.fixtureOnly,
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
    planned.requiresApprovedTargets = false;
    planned.materializationAllowed = true;
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes("non-fixture artifacts must require approved targets"),
        ),
    );
    planned.requiresApprovedTargets = true;
    assert(
        validateArtifacts(catalogs).some((error) =>
            error.includes("unapproved target selected for live artifact"),
        ),
    );
    planned.materializationAllowed = false;
    planned.runtimeEligible = true;
    const runtimeErrors = validateArtifacts(catalogs);
    assert(
        runtimeErrors.some((error) =>
            error.includes("runtime eligibility requires materialization approval"),
        ),
    );
    assert(
        runtimeErrors.some((error) =>
            error.includes("unapproved target selected for live artifact"),
        ),
    );
});

test("repository inventory supports a clean tracked repository", () => {
    const inventory = clone(
        readCatalog(
            join(
                defaultRepositoryRoot,
                v2CatalogPaths.repositoryInventory,
            ),
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
    const errors = validateRepositoryInventory(
        catalogs,
        defaultRepositoryRoot,
    );
    assert(errors.some((error) => error.includes("index digest changed")));
    assert(
        errors.some((error) =>
            error.includes("base-revision changes changed"),
        ),
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
