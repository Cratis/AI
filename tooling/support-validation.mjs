// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compareOrdinal, sortedOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

export const supportPaths = Object.freeze({
    evidence: "catalog/evidence.json",
    evidenceSchema: "catalog/schemas/evidence.schema.json",
    policy: "catalog/support-policy.json",
    policySchema: "catalog/schemas/support-policy.schema.json",
    support: "catalog/v2/support.json",
    supportSchema: "catalog/schemas/support.schema.json",
    legacyEvidence: "catalog/v2/evidence.json",
    ecosystemVersions: "catalog/ecosystem-versions.json",
    ecosystemContracts: "catalog/v2/ecosystem-contracts.json",
    bindings: "distribution/ecosystem-artifact-bindings.json",
    assuranceProfiles: "catalog/v2/artifact-assurance-profiles.json",
});

const expectedObservationAnchor =
    "0d82c5c7c7a08a4278fc0278a3f25421e1299cc83d20af450427948305210f69";
const expectedFactAnchor =
    "52a021f9b82367dbc3587b9ddc3f5e772ea9cefb65f026d6f06f1680358e2525";
const expectedGapAnchor =
    "92e1b11d5046b5305e349b6ccf5c62467190c716529919b0393daf720049fb96";
const expectedTierOrder = [
    "unsupported",
    "documented",
    "generated",
    "statically-validated",
    "install-tested",
    "behavior-tested",
    "lifecycle-tested",
    "release-tested",
    "supported",
];
const forbiddenAuthoredKeys = new Set([
    "effectiveTier",
    "computedTier",
    "technicalTier",
]);

function digestLines(lines) {
    return createHash("sha256")
        .update(`${sortedOrdinal(lines).join("\n")}\n`)
        .digest("hex");
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

function equalSets(left, right) {
    return (
        JSON.stringify(sortedOrdinal(left)) ===
        JSON.stringify(sortedOrdinal(right))
    );
}

function walkForbiddenKeys(value, path, errors) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            walkForbiddenKeys(item, `${path}[${index}]`, errors),
        );
        return;
    }
    for (const [key, item] of Object.entries(value)) {
        if (forbiddenAuthoredKeys.has(key))
            errors.push(
                `${path} contains forbidden authored tier claim ${key}`,
            );
        walkForbiddenKeys(item, `${path}.${key}`, errors);
    }
}

function readSupportInputs(root = defaultRepositoryRoot) {
    return {
        evidence: readCatalog(join(root, supportPaths.evidence)),
        policy: readCatalog(join(root, supportPaths.policy)),
        bindings: readCatalog(join(root, supportPaths.bindings)),
        assuranceProfiles: readCatalog(
            join(root, supportPaths.assuranceProfiles),
        ),
        ecosystemVersions: readCatalog(
            join(root, supportPaths.ecosystemVersions),
        ),
        ecosystemContracts: readCatalog(
            join(root, supportPaths.ecosystemContracts),
        ),
    };
}

export function loadSupportCatalogs(root = defaultRepositoryRoot) {
    return readSupportInputs(root);
}

function validatePolicy(policy) {
    const errors = [];
    const actualOrder = policy.tiers.map((tier) => tier.id);
    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedTierOrder))
        errors.push(
            "support policy tier order must preserve the monotonic nine-tier anchor",
        );
    policy.tiers.forEach((tier, rank) => {
        if (tier.rank !== rank)
            errors.push(
                `support policy tier ${tier.id} must have rank ${rank}`,
            );
    });
    if (policy.support.syntheticMaximumTier !== "statically-validated")
        errors.push(
            "synthetic fixture evidence must never satisfy install-tested or above",
        );
    return errors;
}

function validateExecution(observation, assertion, bindingsById, errors) {
    if (!assertion.supporting) return;
    const execution = assertion.execution;
    if (!execution) {
        errors.push(
            `observation ${observation.id} supporting ${assertion.assuranceId} lacks exact argv, exitCode, host/client version, artifact version/digest, environment, and report digest`,
        );
        return;
    }
    if (assertion.outcome === "pass" && execution.exitCode !== 0)
        errors.push(
            `observation ${observation.id} pass assertion has nonzero exitCode`,
        );
    if (assertion.outcome === "fail" && execution.exitCode === 0)
        errors.push(
            `observation ${observation.id} fail assertion has zero exitCode`,
        );
    if (observation.subject.version !== execution.artifactVersion)
        errors.push(
            `observation ${observation.id} execution artifact version does not match its exact subject`,
        );
    if (observation.subject.kind !== "host")
        errors.push(
            `observation ${observation.id} execution must bind an exact host subject`,
        );
    if (observation.subject.id !== execution.client)
        errors.push(
            `observation ${observation.id} execution client does not match its exact host subject`,
        );
    for (const bindingId of observation.bindingIds) {
        const binding = bindingsById.get(bindingId);
        if (
            binding &&
            (binding.harnessId !== observation.subject.harnessId ||
                binding.targetId !== observation.subject.id)
        )
            errors.push(
                `observation ${observation.id} execution subject does not match binding ${bindingId}`,
            );
    }
    if (observation.subject.digest !== execution.artifactDigest)
        errors.push(
            `observation ${observation.id} execution artifact digest does not match its exact subject`,
        );
    if (observation.subject.hostVersion !== execution.clientVersion)
        errors.push(
            `observation ${observation.id} execution host/client version does not match its exact subject`,
        );
    if (!observation.subject.harnessId)
        errors.push(
            `observation ${observation.id} supporting ${assertion.assuranceId} lacks an exact harness subject`,
        );
    if (
        JSON.stringify(observation.environment) !==
        JSON.stringify(execution.environment)
    )
        errors.push(
            `observation ${observation.id} execution environment does not match its exact observation environment`,
        );
}

export function validateNormalizedEvidence(
    catalogs,
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const {
        evidence,
        ecosystemVersions,
        ecosystemContracts,
        bindings,
        policy,
    } = catalogs;
    const sourceIds = evidence.sources.map((source) => source.id);
    const observationIds = evidence.observations.map(
        (observation) => observation.id,
    );
    const factIds = evidence.legacyFacts.map((fact) => fact.id);
    const gapIds = evidence.legacyGaps.map((gap) => gap.id);
    const bindingsById = new Map(
        bindings.bindings.map((binding) => [binding.id, binding]),
    );
    const bindingIds = new Set(bindingsById.keys());
    const factsById = new Map(
        evidence.legacyFacts.map((fact) => [fact.id, fact]),
    );
    const observationsById = new Map(
        evidence.observations.map((observation) => [
            observation.id,
            observation,
        ]),
    );
    const sourcesById = new Map(
        evidence.sources.map((source) => [source.id, source]),
    );

    for (const [label, ids] of [
        ["source", sourceIds],
        ["observation", observationIds],
        ["legacy fact", factIds],
        ["legacy gap", gapIds],
    ]) {
        for (const duplicate of duplicates(ids))
            errors.push(`${label} catalog contains duplicate id ${duplicate}`);
    }
    if (digestLines(observationIds) !== expectedObservationAnchor)
        errors.push(
            "normalized evidence must preserve all 83 S0/S1 evidence IDs exactly once",
        );
    if (
        digestLines(
            evidence.legacyFacts.map((fact) => `${fact.id}\0${fact.fact}`),
        ) !== expectedFactAnchor
    )
        errors.push(
            "normalized evidence must preserve all 110 legacy fact IDs and texts exactly",
        );
    if (
        digestLines(
            evidence.legacyGaps.map(
                (gap) => `${gap.ecosystemId}\0${gap.value}`,
            ),
        ) !== expectedGapAnchor
    )
        errors.push(
            "normalized evidence must account for all 12 legacy localEvidence strings exactly",
        );

    const legacyFacts = ecosystemVersions.ecosystems.flatMap((ecosystem) =>
        ecosystem.facts.map((fact, index) => ({
            id: `${ecosystem.id}-fact-${index + 1}`,
            fact,
        })),
    );
    if (
        !equalSets(
            legacyFacts.map((fact) => `${fact.id}\0${fact.fact}`),
            evidence.legacyFacts.map((fact) => `${fact.id}\0${fact.fact}`),
        )
    )
        errors.push(
            "normalized facts diverge from the S0 ecosystem-version anchor",
        );
    const legacyGaps = ecosystemVersions.ecosystems.flatMap((ecosystem) =>
        (ecosystem.localEvidence ?? []).map(
            (value) => `${ecosystem.id}\0${value}`,
        ),
    );
    if (
        !equalSets(
            legacyGaps,
            evidence.legacyGaps.map(
                (gap) => `${gap.ecosystemId}\0${gap.value}`,
            ),
        )
    )
        errors.push(
            "normalized gaps diverge from the legacy localEvidence anchor",
        );

    const officialObservationIds = new Set(
        ecosystemVersions.ecosystems.flatMap((ecosystem) =>
            ecosystem.sources.map(
                (_, index) => `${ecosystem.id}-source-${index + 1}`,
            ),
        ),
    );
    if (officialObservationIds.size !== 63)
        errors.push(
            `legacy ecosystem source anchor must remain 63; found ${officialObservationIds.size}`,
        );

    for (const observation of evidence.observations) {
        const source = sourcesById.get(observation.sourceId);
        if (!source)
            errors.push(
                `observation ${observation.id} references dangling source ${observation.sourceId}`,
            );
        if (observation.observedOn > observation.validThrough)
            errors.push(
                `observation ${observation.id} is valid before it was observed`,
            );
        for (const bindingId of observation.bindingIds) {
            if (!bindingIds.has(bindingId))
                errors.push(
                    `observation ${observation.id} references unknown binding ${bindingId}`,
                );
        }
        for (const supersededId of observation.supersedes) {
            if (!observationsById.has(supersededId))
                errors.push(
                    `observation ${observation.id} supersedes dangling observation ${supersededId}`,
                );
            if (supersededId === observation.id)
                errors.push(
                    `observation ${observation.id} cannot supersede itself`,
                );
        }
        const assertionKeys = observation.assertions.map(
            (assertion) => `${assertion.assuranceId}\0${assertion.outcome}`,
        );
        for (const duplicate of duplicates(assertionKeys))
            errors.push(
                `observation ${observation.id} contains duplicate assertion ${duplicate.replace("\0", "/")}`,
            );
        for (const assertion of observation.assertions) {
            for (const claimId of assertion.claimIds) {
                const fact = factsById.get(claimId);
                if (!fact)
                    errors.push(
                        `observation ${observation.id} references unknown claim ${claimId}`,
                    );
                else if (!fact.evidenceIds.includes(observation.id))
                    errors.push(
                        `observation ${observation.id} claim ${claimId} lacks reciprocal fact binding`,
                    );
            }
            if (
                policy.executionRequiredAssuranceIds.includes(
                    assertion.assuranceId,
                )
            )
                validateExecution(observation, assertion, bindingsById, errors);
            if (
                assertion.assuranceId ===
                    policy.support.releaseApprovalAssuranceId &&
                assertion.supporting &&
                !assertion.approvalName
            )
                errors.push(
                    `observation ${observation.id} release approval must be named`,
                );
        }
        if (officialObservationIds.has(observation.id)) {
            if (observation.subject.kind !== "ecosystem")
                errors.push(
                    `official observation ${observation.id} must bind an exact ecosystem subject`,
                );
            if (!observation.subject.version)
                errors.push(
                    `official observation ${observation.id} must bind an exact ecosystem version`,
                );
            if (
                !observation.assertions.some(
                    (assertion) =>
                        assertion.assuranceId === "documentation" &&
                        assertion.supporting,
                )
            )
                errors.push(
                    `official observation ${observation.id} must retain a supporting documentation assertion`,
                );
        }
    }

    const supersessionGraph = new Map(
        evidence.observations.map((observation) => [
            observation.id,
            observation.supersedes,
        ]),
    );
    function visit(id, stack = new Set()) {
        if (stack.has(id)) {
            errors.push(`evidence supersession cycle contains ${id}`);
            return;
        }
        const next = new Set(stack);
        next.add(id);
        for (const child of supersessionGraph.get(id) ?? []) visit(child, next);
    }
    for (const id of observationIds) visit(id);

    for (const fact of evidence.legacyFacts) {
        for (const evidenceId of fact.evidenceIds) {
            const observation = observationsById.get(evidenceId);
            if (!observation)
                errors.push(
                    `legacy fact ${fact.id} references unknown observation ${evidenceId}`,
                );
            else if (
                !observation.assertions.some((assertion) =>
                    assertion.claimIds.includes(fact.id),
                )
            )
                errors.push(
                    `legacy fact ${fact.id} evidence ${evidenceId} lacks reciprocal claim assertion`,
                );
        }
        if (fact.evidenceIds.length > 3)
            errors.push(
                `legacy fact ${fact.id} uses broad all-source evidence fan-out`,
            );
    }

    const contractFactBindings = new Map(
        ecosystemContracts.ecosystems.flatMap((contract) =>
            contract.legacyFactBindings.map((binding) => [
                binding.factId,
                binding.evidenceIds,
            ]),
        ),
    );
    for (const fact of evidence.legacyFacts) {
        if (
            !equalSets(
                contractFactBindings.get(fact.id) ?? [],
                fact.evidenceIds,
            )
        )
            errors.push(
                `ecosystem contract fact ${fact.id} does not consume its exact normalized evidence`,
            );
    }

    const evidenceDirectory = join(root, "distribution/evidence");
    const actualEvidencePaths = existsSync(evidenceDirectory)
        ? readdirSync(evidenceDirectory)
              .filter((name) => name.endsWith(".json"))
              .map((name) => `distribution/evidence/${name}`)
        : [];
    const indexedPaths = evidence.distributionEvidenceFiles.map(
        (record) => record.repositoryPath,
    );
    if (!equalSets(actualEvidencePaths, indexedPaths))
        errors.push(
            "normalized evidence inventory does not account for every distribution evidence JSON file exactly once",
        );
    for (const record of evidence.distributionEvidenceFiles) {
        const absolutePath = join(root, record.repositoryPath);
        if (!existsSync(absolutePath)) {
            errors.push(
                `distribution evidence inventory references missing ${record.repositoryPath}`,
            );
            continue;
        }
        if (sha256(readFileSync(absolutePath)) !== record.digest)
            errors.push(
                `distribution evidence inventory digest is stale for ${record.repositoryPath}`,
            );
        if (record.role === "supporting" && record.observationIds.length === 0)
            errors.push(
                `supporting distribution evidence ${record.repositoryPath} lacks an observation`,
            );
        if (
            record.role === "inventory-only" &&
            record.observationIds.length > 0
        )
            errors.push(
                `inventory-only distribution evidence ${record.repositoryPath} cannot support observations`,
            );
        for (const observationId of record.observationIds) {
            const observation = observationsById.get(observationId);
            if (observation) {
                const source = sourcesById.get(observation.sourceId);
                if (
                    source?.repositoryPath !== record.repositoryPath ||
                    source?.digest !== record.digest
                )
                    errors.push(
                        `distribution evidence ${record.repositoryPath} does not match observation ${observationId} source locator and digest`,
                    );
            } else
                errors.push(
                    `distribution evidence ${record.repositoryPath} references unknown observation ${observationId}`,
                );
        }
    }
    walkForbiddenKeys(evidence, "catalog/evidence.json", errors);
    walkForbiddenKeys(policy, "catalog/support-policy.json", errors);
    return errors;
}

function statusForObservation(observation, asOf) {
    if (asOf < observation.observedOn) return "future";
    if (asOf > observation.validThrough) return "expired";
    return "active";
}

function assertionsForBinding(binding, evidence, asOf) {
    const related = evidence.observations.filter((observation) =>
        observation.bindingIds.includes(binding.id),
    );
    const activeSuperseders = new Set(
        related
            .filter(
                (observation) =>
                    statusForObservation(observation, asOf) === "active",
            )
            .flatMap((observation) => observation.supersedes),
    );
    const groups = { active: [], expired: [], future: [] };
    for (const observation of related) {
        let status = statusForObservation(observation, asOf);
        if (status === "active" && activeSuperseders.has(observation.id))
            status = "expired";
        groups[status].push(observation);
    }
    return groups;
}

function requirementsForTier(tier, binding, profile, policy) {
    const requirements = [...tier.requirements];
    if (
        tier.rank >= 7 &&
        profile.controls.ecosystemNativeProvenance !== "not-applicable"
    )
        requirements.push("ecosystem-native-provenance");
    if (tier.rank >= 8 && policy.support.requireAllApplicableProfileControls) {
        for (const mapping of policy.assuranceProfileControlMap) {
            if (profile.controls[mapping.control] !== "not-applicable")
                requirements.push(mapping.assuranceId);
        }
    }
    if (tier.rank >= 8 && binding.marketplaceAvailabilityClaim)
        requirements.push(policy.marketplace.listingAssuranceId);
    return [...new Set(requirements)];
}

export function computeSupport(catalogs) {
    const { evidence, policy, bindings, assuranceProfiles } = catalogs;
    const profilesById = new Map(
        assuranceProfiles.profiles.map((profile) => [profile.id, profile]),
    );
    const records = bindings.bindings
        .map((binding) => {
            const profile = profilesById.get(binding.assuranceProfileId);
            if (!profile)
                throw new Error(
                    `Unknown assurance profile ${binding.assuranceProfileId}`,
                );
            const groups = assertionsForBinding(binding, evidence, policy.asOf);
            const assuranceObservations = new Map();
            for (const observation of groups.active) {
                for (const assertion of observation.assertions) {
                    if (!assertion.supporting) continue;
                    if (!assuranceObservations.has(assertion.assuranceId))
                        assuranceObservations.set(assertion.assuranceId, []);
                    assuranceObservations
                        .get(assertion.assuranceId)
                        .push({ observation, assertion });
                }
            }
            const satisfied = new Set();
            for (const [assuranceId, values] of assuranceObservations) {
                const hasPass = values.some(
                    ({ assertion }) => assertion.outcome === "pass",
                );
                const hasFail = values.some(
                    ({ assertion }) => assertion.outcome === "fail",
                );
                if (hasPass && !hasFail) satisfied.add(assuranceId);
            }
            let effective = policy.tiers[0];
            const missing = new Set();
            for (const tier of policy.tiers.slice(1)) {
                const requirements = requirementsForTier(
                    tier,
                    binding,
                    profile,
                    policy,
                );
                const tierMissing = requirements.filter((assuranceId) => {
                    if (!satisfied.has(assuranceId)) return true;
                    const values = assuranceObservations.get(assuranceId) ?? [];
                    if (
                        tier.rank >= 4 &&
                        values.every(
                            ({ observation }) =>
                                observation.evidenceClass ===
                                "synthetic-fixture",
                        )
                    )
                        return true;
                    return false;
                });
                if (tierMissing.length > 0) {
                    tierMissing.forEach((assuranceId) =>
                        missing.add(assuranceId),
                    );
                    break;
                }
                effective = tier;
            }
            const listingEvidence = groups.active.filter((observation) =>
                observation.assertions.some(
                    (assertion) =>
                        assertion.supporting &&
                        assertion.outcome === "pass" &&
                        assertion.assuranceId ===
                            policy.marketplace.listingAssuranceId,
                ),
            );
            const marketplace = binding.marketplaceAvailabilityClaim
                ? {
                      availabilityClaim: true,
                      listingRequired: true,
                      status:
                          listingEvidence.length > 0
                              ? "listed"
                              : "listing-missing",
                      evidenceIds: sortedOrdinal(
                          listingEvidence.map((observation) => observation.id),
                      ),
                  }
                : {
                      availabilityClaim: false,
                      listingRequired: false,
                      status: "not-claimed",
                      evidenceIds: [],
                  };
            const namedApproval = groups.active.some((observation) =>
                observation.assertions.some(
                    (assertion) =>
                        assertion.supporting &&
                        assertion.outcome === "pass" &&
                        assertion.assuranceId ===
                            policy.support.releaseApprovalAssuranceId &&
                        Boolean(assertion.approvalName),
                ),
            );
            const supportClaim =
                effective.id === "supported" &&
                namedApproval &&
                marketplace.status !== "listing-missing";
            const expiredSupporting = groups.expired.some((observation) =>
                observation.assertions.some(
                    (assertion) => assertion.supporting,
                ),
            );
            const futureSupporting = groups.future.some((observation) =>
                observation.assertions.some(
                    (assertion) => assertion.supporting,
                ),
            );
            const decay = expiredSupporting
                ? {
                      state: "expired-evidence",
                      reason: "Expired evidence remains history but cannot satisfy a technical gate.",
                  }
                : futureSupporting
                  ? {
                        state: "future-evidence",
                        reason: "Evidence observed after the authored asOf date cannot satisfy a technical gate.",
                    }
                  : {
                        state: "none",
                        reason: "No related supporting evidence is expired or future-dated at the authored asOf date.",
                    };
            return {
                bindingId: binding.id,
                ecosystemId: binding.ecosystemId,
                artifactClass: binding.artifactClass,
                effectiveTier: effective.id,
                rank: effective.rank,
                supportClaim,
                activeEvidenceIds: sortedOrdinal(
                    groups.active.map((observation) => observation.id),
                ),
                expiredEvidenceIds: sortedOrdinal(
                    groups.expired.map((observation) => observation.id),
                ),
                futureEvidenceIds: sortedOrdinal(
                    groups.future.map((observation) => observation.id),
                ),
                satisfiedAssurances: sortedOrdinal([...satisfied]),
                missingAssurances: sortedOrdinal([...missing]),
                decay,
                marketplace,
            };
        })
        .sort((left, right) => compareOrdinal(left.bindingId, right.bindingId));
    const byTier = Object.fromEntries(
        expectedTierOrder.map((tier) => [
            tier,
            records.filter((record) => record.effectiveTier === tier).length,
        ]),
    );
    return {
        schemaVersion: 1,
        asOf: policy.asOf,
        generatedBy: "tooling/generate-support.mjs",
        defaultPolicy: "deny",
        publicationEligible: false,
        promotionEligible: false,
        runtimeEligible: false,
        tierOrder: expectedTierOrder,
        summary: {
            bindingCount: records.length,
            supportClaimCount: records.filter((record) => record.supportClaim)
                .length,
            byTier,
        },
        bindings: records,
    };
}

export function validateSupportCatalogs(root = defaultRepositoryRoot) {
    const catalogs = readSupportInputs(root);
    const evidenceSchema = readCatalog(join(root, supportPaths.evidenceSchema));
    const policySchema = readCatalog(join(root, supportPaths.policySchema));
    const supportSchema = readCatalog(join(root, supportPaths.supportSchema));
    const errors = [
        ...validateSchemaVocabulary(evidenceSchema),
        ...validateSchemaVocabulary(policySchema),
        ...validateSchemaVocabulary(supportSchema),
        ...validateAgainstSchema(catalogs.evidence, evidenceSchema),
        ...validateAgainstSchema(catalogs.policy, policySchema),
        ...validatePolicy(catalogs.policy),
        ...validateNormalizedEvidence(catalogs, root),
    ];
    if (existsSync(join(root, supportPaths.support))) {
        const support = readCatalog(join(root, supportPaths.support));
        errors.push(...validateAgainstSchema(support, supportSchema));
        const generated = computeSupport(catalogs);
        if (JSON.stringify(support) !== JSON.stringify(generated))
            errors.push(
                "generated support catalog is stale; run node tooling/generate-support.mjs",
            );
        if (
            support.summary.supportClaimCount !== 0 ||
            support.bindings.some((record) => record.supportClaim)
        )
            errors.push("no current support eligibility may be true");
    } else {
        errors.push(
            `missing generated support catalog ${supportPaths.support}`,
        );
    }
    return errors;
}
