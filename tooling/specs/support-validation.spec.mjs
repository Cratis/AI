// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "../catalog-validation.mjs";
import { generateSupport } from "../generate-support.mjs";
import {
    computeSupport,
    loadSupportCatalogs,
    supportPaths,
    validateNormalizedEvidence,
    validateSupportCatalogs,
} from "../support-validation.mjs";

const clone = (value) => structuredClone(value);
const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const bindingId = "gemini-cli-extensions-artifact-binding";
const observationId = "gemini-skill-discovery-2026-08-24";
const allTechnicalAssurances = [
    "artifact-generation",
    "static-validation",
    "install",
    "discovery",
    "behavior-positive",
    "behavior-negative",
    "update",
    "rollback",
    "uninstall",
    "project-context-preservation",
    "released-artifact",
    "canary",
    "ecosystem-native-provenance",
    "release-approval",
    "immutable-source",
    "sha256-inventory",
    "canonical-parity",
    "secret-scanning",
    "path-scanning",
];

function hasError(errors, text) {
    assert(
        errors.some((error) => error.includes(text)),
        `Expected error containing ${JSON.stringify(text)}; received:\n${errors.join("\n")}`,
    );
}

function configuredCatalogs({
    assurances = allTechnicalAssurances,
    evidenceClass = "local",
    observedOn = "2026-08-24",
    validThrough = "2026-08-24",
    outcome = "pass",
} = {}) {
    const catalogs = clone(loadSupportCatalogs());
    const observation = catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    );
    observation.evidenceClass = evidenceClass;
    observation.subject = {
        kind: "host",
        id: "gemini-cli",
        version: "1.2.3",
        digest: digestA,
        harnessId: "gemini",
        hostVersion: "0.33.1",
    };
    observation.environment = {
        operatingSystem: "linux",
        architecture: "x64",
        isolation: "isolated-home",
        runtime: "node 24.0.0",
    };
    observation.observedOn = observedOn;
    observation.validThrough = validThrough;
    observation.assertions = assurances.map((assuranceId) => ({
        assuranceId,
        outcome,
        supporting: true,
        claimIds: [],
        ...(catalogs.policy.executionRequiredAssuranceIds.includes(assuranceId)
            ? {
                  execution: {
                      argv: [
                          "gemini",
                          "extensions",
                          "install",
                          "artifact@1.2.3",
                      ],
                      exitCode: outcome === "pass" ? 0 : 1,
                      client: "gemini-cli",
                      clientVersion: "0.33.1",
                      artifactVersion: "1.2.3",
                      artifactDigest: digestA,
                      environment: clone(observation.environment),
                      reportDigest: digestB,
                  },
              }
            : {}),
        ...(assuranceId === "release-approval"
            ? { approvalName: "Cratis AI release approval 1.2.3" }
            : {}),
    }));
    return catalogs;
}

function supportRecord(catalogs) {
    return computeSupport(catalogs).bindings.find(
        (record) => record.bindingId === bindingId,
    );
}

function evidenceSchema() {
    return readCatalog(
        join(defaultRepositoryRoot, supportPaths.evidenceSchema),
    );
}

test("normalized evidence and computed support pass all closed and semantic validation", () => {
    assert.deepEqual(validateSupportCatalogs(), []);
});

test("all authored evidence and support policy schemas reject unknown properties", () => {
    for (const [path, schemaPath] of [
        [supportPaths.evidence, supportPaths.evidenceSchema],
        [supportPaths.policy, supportPaths.policySchema],
    ]) {
        const value = readCatalog(join(defaultRepositoryRoot, path));
        value.unexpected = true;
        hasError(
            validateAgainstSchema(
                value,
                readCatalog(join(defaultRepositoryRoot, schemaPath)),
            ),
            "unknown property unexpected",
        );
    }
});

test("all 83 observations, 110 fact IDs, 12 legacy gaps, 63 official sources, and 13 distribution evidence files are accounted exactly", () => {
    const catalogs = loadSupportCatalogs();
    assert.equal(catalogs.evidence.observations.length, 83);
    assert.equal(catalogs.evidence.legacyFacts.length, 110);
    assert.equal(catalogs.evidence.legacyGaps.length, 12);
    assert.equal(
        catalogs.ecosystemVersions.ecosystems.reduce(
            (count, ecosystem) => count + ecosystem.sources.length,
            0,
        ),
        63,
    );
    assert.equal(catalogs.evidence.distributionEvidenceFiles.length, 13);
    assert.deepEqual(
        catalogs.evidence.distributionEvidenceFiles
            .map((record) => record.repositoryPath)
            .sort(),
        readdirSync(join(defaultRepositoryRoot, "distribution/evidence"))
            .filter((name) => name.endsWith(".json"))
            .map((name) => `distribution/evidence/${name}`)
            .sort(),
    );
});

test("legacy facts use minimum exact evidence rather than all-source fan-out", () => {
    const evidence = loadSupportCatalogs().evidence;
    assert(evidence.legacyFacts.every((fact) => fact.evidenceIds.length <= 3));
    assert(evidence.legacyFacts.some((fact) => fact.evidenceIds.length === 0));
    assert(evidence.legacyFacts.some((fact) => fact.evidenceIds.length === 2));
});

test("wrong exact subject is rejected", () => {
    const catalogs = configuredCatalogs();
    catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    ).subject.id = "other-host";
    hasError(
        validateNormalizedEvidence(catalogs),
        "execution client does not match its exact host subject",
    );
});

test("wrong artifact version is rejected", () => {
    const catalogs = configuredCatalogs();
    catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    ).subject.version = "9.9.9";
    hasError(
        validateNormalizedEvidence(catalogs),
        "artifact version does not match its exact subject",
    );
});

test("wrong artifact digest is rejected", () => {
    const catalogs = configuredCatalogs();
    catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    ).subject.digest = "c".repeat(64);
    hasError(
        validateNormalizedEvidence(catalogs),
        "artifact digest does not match its exact subject",
    );
});

test("wrong host version is rejected", () => {
    const catalogs = configuredCatalogs();
    catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    ).subject.hostVersion = "0.34.0";
    hasError(
        validateNormalizedEvidence(catalogs),
        "host/client version does not match its exact subject",
    );
});

test("wrong environment is rejected", () => {
    const catalogs = configuredCatalogs();
    catalogs.evidence.observations
        .find((record) => record.id === observationId)
        .assertions.find(
            (assertion) => assertion.assuranceId === "install",
        ).execution.environment.architecture = "arm64";
    hasError(
        validateNormalizedEvidence(catalogs),
        "execution environment does not match",
    );
});

test("missing argv and exitCode are rejected by the closed evidence schema", () => {
    for (const field of ["argv", "exitCode"]) {
        const catalogs = configuredCatalogs();
        const execution = catalogs.evidence.observations
            .find((record) => record.id === observationId)
            .assertions.find(
                (assertion) => assertion.assuranceId === "install",
            ).execution;
        delete execution[field];
        hasError(
            validateAgainstSchema(catalogs.evidence, evidenceSchema()),
            `missing required property ${field}`,
        );
    }
});

test("synthetic fixture evidence never satisfies install-tested or above", () => {
    const record = supportRecord(
        configuredCatalogs({ evidenceClass: "synthetic-fixture" }),
    );
    assert.equal(record.effectiveTier, "statically-validated");
    assert.equal(record.rank, 3);
    assert.equal(record.supportClaim, false);
});

test("future evidence cannot satisfy a gate", () => {
    const record = supportRecord(
        configuredCatalogs({
            observedOn: "2026-08-25",
            validThrough: "2026-09-25",
        }),
    );
    assert.equal(record.effectiveTier, "documented");
    assert(record.futureEvidenceIds.includes(observationId));
    assert.equal(record.decay.state, "future-evidence");
});

test("expired evidence remains history but cannot satisfy a gate", () => {
    const record = supportRecord(
        configuredCatalogs({
            observedOn: "2026-08-01",
            validThrough: "2026-08-23",
        }),
    );
    assert.equal(record.effectiveTier, "documented");
    assert(record.expiredEvidenceIds.includes(observationId));
    assert.equal(record.decay.state, "expired-evidence");
});

test("evidence activity is inclusive at observedOn and validThrough", () => {
    const record = supportRecord(configuredCatalogs());
    assert.equal(record.effectiveTier, "supported");
    assert(record.activeEvidenceIds.includes(observationId));
});

test("pass and fail conflict fails the affected assurance", () => {
    const catalogs = configuredCatalogs();
    const observation = catalogs.evidence.observations.find(
        (record) => record.id === observationId,
    );
    observation.assertions.push({
        assuranceId: "install",
        outcome: "fail",
        supporting: true,
        claimIds: [],
        execution: {
            ...clone(
                observation.assertions.find(
                    (assertion) => assertion.assuranceId === "install",
                ).execution,
            ),
            exitCode: 1,
        },
    });
    assert.equal(supportRecord(catalogs).effectiveTier, "statically-validated");
});

test("higher assurance cannot skip an unsatisfied lower tier", () => {
    const record = supportRecord(
        configuredCatalogs({
            assurances: ["discovery", "behavior-positive", "behavior-negative"],
        }),
    );
    assert.equal(record.effectiveTier, "documented");
    assert.equal(record.rank, 1);
});

test("coordinated observation and reciprocal claim ID mutation fails the independent evidence anchor", () => {
    const catalogs = clone(loadSupportCatalogs());
    const observation = catalogs.evidence.observations.find(
        (record) => record.id === "agent-plugins-source-1",
    );
    observation.id = "replacement-observation";
    for (const fact of catalogs.evidence.legacyFacts) {
        fact.evidenceIds = fact.evidenceIds.map((id) =>
            id === "agent-plugins-source-1" ? observation.id : id,
        );
    }
    for (const assertion of observation.assertions) assertion.claimIds = [];
    hasError(
        validateNormalizedEvidence(catalogs),
        "preserve all 83 S0/S1 evidence IDs exactly once",
    );
});

test("duplicate observation is rejected", () => {
    const catalogs = clone(loadSupportCatalogs());
    catalogs.evidence.observations.push(
        clone(catalogs.evidence.observations[0]),
    );
    hasError(
        validateNormalizedEvidence(catalogs),
        "observation catalog contains duplicate id",
    );
});

test("dangling reusable source is rejected", () => {
    const catalogs = clone(loadSupportCatalogs());
    catalogs.evidence.observations[0].sourceId = "missing-source";
    hasError(
        validateNormalizedEvidence(catalogs),
        "references dangling source missing-source",
    );
});

test("unindexed distribution evidence is rejected", () => {
    const catalogs = clone(loadSupportCatalogs());
    catalogs.evidence.distributionEvidenceFiles.pop();
    hasError(
        validateNormalizedEvidence(catalogs),
        "does not account for every distribution evidence JSON file exactly once",
    );
});

test("tier decays when the authored asOf moves beyond every relevant validity window", () => {
    const catalogs = configuredCatalogs({
        observedOn: "2026-08-01",
        validThrough: "2026-08-31",
    });
    catalogs.policy.asOf = "2027-01-01";
    const record = supportRecord(catalogs);
    assert.equal(record.effectiveTier, "unsupported");
    assert.equal(record.decay.state, "expired-evidence");
});

test("marketplace listing is orthogonal for direct delivery and required only when availability is claimed", () => {
    const direct = configuredCatalogs();
    assert.equal(supportRecord(direct).effectiveTier, "supported");
    assert.equal(supportRecord(direct).marketplace.status, "not-claimed");

    const claimed = configuredCatalogs();
    claimed.bindings.bindings.find(
        (binding) => binding.id === bindingId,
    ).marketplaceAvailabilityClaim = true;
    assert.equal(supportRecord(claimed).effectiveTier, "release-tested");
    assert.equal(supportRecord(claimed).marketplace.status, "listing-missing");

    claimed.evidence.observations
        .find((record) => record.id === observationId)
        .assertions.push({
            assuranceId: "marketplace-listing",
            outcome: "pass",
            supporting: true,
            claimIds: [],
        });
    assert.equal(supportRecord(claimed).effectiveTier, "supported");
    assert.equal(supportRecord(claimed).marketplace.status, "listed");
});

test("authored technical tier claims are forbidden", () => {
    const catalogs = clone(loadSupportCatalogs());
    catalogs.evidence.observations[0].effectiveTier = "supported";
    hasError(
        validateNormalizedEvidence(catalogs),
        "forbidden authored tier claim effectiveTier",
    );
});

test("computed support is deterministic and byte-identical to the generated catalog", () => {
    const first = `${JSON.stringify(generateSupport(), null, 2)}\n`;
    const second = `${JSON.stringify(generateSupport(), null, 2)}\n`;
    assert.equal(first, second);
    assert.equal(
        first,
        readFileSync(join(defaultRepositoryRoot, supportPaths.support), "utf8"),
    );
});

test("current computed support keeps every runtime, publication, promotion, and support gate false", () => {
    const support = generateSupport();
    assert.equal(support.runtimeEligible, false);
    assert.equal(support.publicationEligible, false);
    assert.equal(support.promotionEligible, false);
    assert.equal(support.summary.supportClaimCount, 0);
    assert(support.bindings.every((record) => record.supportClaim === false));
});
