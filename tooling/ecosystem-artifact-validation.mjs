// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { join } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import {
    fixtureOutputRoots,
    harnesses,
    requiredArtifactTargetIds,
    requiredEcosystemBindingIds,
    requiredEcosystemIds,
    requiredMarketplaceRequirementIds,
} from "./harness-registry.mjs";
import { generateEcosystemArtifactCoverage } from "./generate-ecosystem-artifact-coverage.mjs";

export const ecosystemArtifactPaths = Object.freeze({
    ecosystemContracts: "catalog/v2/ecosystem-contracts.json",
    assuranceProfiles: "catalog/v2/artifact-assurance-profiles.json",
    bindings: "distribution/ecosystem-artifact-bindings.json",
    coverage: "catalog/v2/ecosystem-artifact-coverage.json",
    ecosystemVersions: "catalog/ecosystem-versions.json",
    evidence: "catalog/v2/evidence.json",
    marketplaceRequirements: "distribution/marketplace-requirements.json",
    artifactMatrix: "distribution/artifact-matrix.json",
    hostAdapters: "catalog/host-adapters.json",
});

export const ecosystemArtifactSchemaPaths = Object.freeze({
    ecosystemContracts: "catalog/schemas/ecosystem-contracts.schema.json",
    assuranceProfiles:
        "catalog/schemas/artifact-assurance-profiles.schema.json",
    bindings: "distribution/ecosystem-artifact-bindings.schema.json",
    coverage: "catalog/schemas/ecosystem-artifact-coverage.schema.json",
    hostAdapters: "catalog/schemas/host-adapters.schema.json",
});

const generatedStrategies = new Set([
    "distinct-output",
    "shared-output",
    "compatible-source",
]);
const outputlessStrategies = new Set([
    "provider-inherited",
    "publication-only",
    "no-output",
    "blocked",
]);
const generationStatesByStrategy = new Map([
    [
        "distinct-output",
        new Set(["fixture-generated", "fixture-generated-evidence-incomplete"]),
    ],
    [
        "shared-output",
        new Set(["fixture-generated", "fixture-generated-evidence-incomplete"]),
    ],
    ["compatible-source", new Set(["source-compatible"])],
    ["provider-inherited", new Set(["provider-inherited"])],
    ["publication-only", new Set(["publication-only"])],
    ["no-output", new Set(["no-output"])],
    ["blocked", new Set(["blocked"])],
]);
const executableComponents = [
    "execution",
    "mcp",
    "hooks",
    "scripts",
    "executableExtensions",
];
const requiredPassiveControls = [
    "immutableSource",
    "sha256Inventory",
    "canonicalParity",
    "secretScanning",
    "pathScanning",
];
const requiredNonClaims = [
    "no-agent-plugin-manifest-signature",
    "no-generic-context-isolation",
    "no-generic-host-sandbox",
];

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

function sorted(values) {
    return [...values].sort(compareOrdinal);
}

function equalSets(left, right) {
    return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function addClosureErrors(errors, label, actual, expected) {
    for (const missing of sorted(
        [...expected].filter((value) => !actual.has(value)),
    ))
        errors.push(`${label} does not account for ${missing}`);
    for (const unexpected of sorted(
        [...actual].filter((value) => !expected.has(value)),
    ))
        errors.push(`${label} references unknown ${unexpected}`);
}

export function loadEcosystemArtifactCatalogs(root = defaultRepositoryRoot) {
    return Object.fromEntries(
        Object.entries(ecosystemArtifactPaths).map(([key, path]) => [
            key,
            readCatalog(join(root, path)),
        ]),
    );
}

export function validateArtifactAssuranceProfiles(catalogs) {
    const errors = [];
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((record) => record.id),
    );
    const profiles = catalogs.assuranceProfiles.profiles;
    const profileIds = profiles.map((profile) => profile.id);
    const classes = profiles.map((profile) => profile.artifactClass);

    for (const duplicate of duplicates(profileIds))
        errors.push(
            `artifact assurance profiles contain duplicate id ${duplicate}`,
        );
    for (const duplicate of duplicates(classes))
        errors.push(
            `artifact assurance profiles contain duplicate artifact class ${duplicate}`,
        );

    for (const profile of profiles) {
        if (!profile.failClosed)
            errors.push(`assurance profile ${profile.id} must fail closed`);
        for (const evidenceId of profile.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `assurance profile ${profile.id} references unknown evidence ${evidenceId}`,
                );
        }
        if (!equalSets(profile.nonClaims, requiredNonClaims))
            errors.push(
                `assurance profile ${profile.id} must preserve all explicit non-claims`,
            );
        if (profile.passivePublic) {
            if (profile.artifactClass !== "passive-public-package")
                errors.push(
                    `assurance profile ${profile.id} marks a non-public class as passive public`,
                );
            for (const component of executableComponents) {
                if (profile.components[component] !== "forbid")
                    errors.push(
                        `passive public assurance profile ${profile.id} admits executable component ${component}`,
                    );
            }
            for (const control of requiredPassiveControls) {
                if (profile.controls[control] !== "required")
                    errors.push(
                        `passive public assurance profile ${profile.id} must require ${control}`,
                    );
            }
            if (profile.controls.ecosystemNativeProvenance !== "when-supported")
                errors.push(
                    `passive public assurance profile ${profile.id} must require ecosystem-native provenance when supported`,
                );
        }
    }
    return errors;
}

export function validateEcosystemContracts(catalogs) {
    const errors = [];
    const contracts = catalogs.ecosystemContracts.ecosystems;
    const legacy = catalogs.ecosystemVersions.ecosystems;
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((record) => record.id),
    );
    const factsById = new Map(
        catalogs.evidence.ecosystemFacts.map((fact) => [fact.id, fact]),
    );
    const contractsById = new Map(
        contracts.map((contract) => [contract.id, contract]),
    );
    const legacyById = new Map(
        legacy.map((ecosystem) => [ecosystem.id, ecosystem]),
    );

    for (const duplicate of duplicates(contracts.map((record) => record.id)))
        errors.push(`ecosystem contracts contain duplicate id ${duplicate}`);
    if (contracts.length !== 45)
        errors.push(
            `ecosystem contracts must retain the 45-ecosystem S5a completeness anchor; found ${contracts.length}`,
        );
    addClosureErrors(
        errors,
        "ecosystem contracts",
        new Set(contractsById.keys()),
        new Set(legacyById.keys()),
    );
    if (
        !equalSets(
            contracts.map((record) => record.id),
            requiredEcosystemIds,
        )
    )
        errors.push(
            "ecosystem contracts must remain the harness registry completeness anchor",
        );

    for (const contract of contracts) {
        const legacyRecord = legacyById.get(contract.id);
        if (!legacyRecord) continue;
        if (contract.lifecycle !== legacyRecord.status)
            errors.push(
                `ecosystem contract ${contract.id} lifecycle diverges from its legacy projection`,
            );
        const expectedEvidenceIds = legacyRecord.sources.map(
            (_, index) => `${contract.id}-source-${index + 1}`,
        );
        if (!equalSets(contract.officialEvidenceIds, expectedEvidenceIds))
            errors.push(
                `ecosystem contract ${contract.id} does not preserve its official evidence projection`,
            );
        for (const evidenceId of contract.officialEvidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `ecosystem contract ${contract.id} references unknown evidence ${evidenceId}`,
                );
        }
        const expectedFactIds = legacyRecord.facts.map(
            (_, index) => `${contract.id}-fact-${index + 1}`,
        );
        const factIds = contract.legacyFactBindings.map(
            (binding) => binding.factId,
        );
        if (!equalSets(factIds, expectedFactIds))
            errors.push(
                `ecosystem contract ${contract.id} does not bind every legacy fact exactly once`,
            );
        for (const duplicate of duplicates(factIds))
            errors.push(
                `ecosystem contract ${contract.id} contains duplicate legacy fact binding ${duplicate}`,
            );
        for (const binding of contract.legacyFactBindings) {
            const fact = factsById.get(binding.factId);
            if (!fact)
                errors.push(
                    `ecosystem contract ${contract.id} references unknown legacy fact ${binding.factId}`,
                );
            else if (fact.ecosystemId !== contract.id)
                errors.push(
                    `ecosystem contract ${contract.id} binds legacy fact ${binding.factId} from ${fact.ecosystemId}`,
                );
            if (fact && !equalSets(binding.evidenceIds, fact.evidenceIds))
                errors.push(
                    `ecosystem contract ${contract.id} legacy fact ${binding.factId} must preserve its exact evidence binding`,
                );
        }
        for (const root of contract.discoveryRoots) {
            if (
                root.evidenceIds.length === 0 ||
                root.evidenceIds.some(
                    (evidenceId) =>
                        !contract.officialEvidenceIds.includes(evidenceId),
                )
            )
                errors.push(
                    `ecosystem contract ${contract.id} discovery root ${root.path} must use minimum exact official evidence`,
                );
        }
    }

    const agentPlugins = contractsById.get("agent-plugins");
    if (agentPlugins) {
        if (agentPlugins.versions.specification !== "1.0.0")
            errors.push(
                "Agent Plugins contract must remain pinned to published specification 1.0.0",
            );
        const requiredManifests = agentPlugins.manifests
            .filter((manifest) => manifest.requirement === "required")
            .map((manifest) => manifest.path);
        if (!equalSets(requiredManifests, ["plugin.json"]))
            errors.push(
                "Agent Plugins 1.0.0 must universally require only root plugin.json",
            );
        const mcp = agentPlugins.manifests.find(
            (manifest) => manifest.path === "mcp.json",
        );
        if (mcp?.requirement !== "optional")
            errors.push("Agent Plugins root mcp.json must remain optional");
        if (agentPlugins.components.skills !== "optional")
            errors.push(
                "Agent Plugins skills must remain an optional component",
            );
        if (agentPlugins.components.mcp !== "optional")
            errors.push("Agent Plugins MCP must remain an optional component");
    }

    const agentSkills = contractsById.get("agent-skills");
    if (agentSkills) {
        if (agentSkills.versions.specification !== null)
            errors.push(
                "Agent Skills contract must not invent a numbered specification version",
            );
        const requiredPaths = agentSkills.discoveryRoots
            .filter((root) => root.requirement === "required")
            .map((root) => root.path);
        if (!equalSets(requiredPaths, ["<skill-root>/SKILL.md"]))
            errors.push(
                "Agent Skills must require only skill-root SKILL.md without a universal enclosing path",
            );
    }
    return errors;
}

export function validateEcosystemArtifactClosure(catalogs) {
    const errors = [];
    const contractsById = new Map(
        catalogs.ecosystemContracts.ecosystems.map((record) => [
            record.id,
            record,
        ]),
    );
    const profilesById = new Map(
        catalogs.assuranceProfiles.profiles.map((profile) => [
            profile.id,
            profile,
        ]),
    );
    const requirementsById = new Map(
        catalogs.marketplaceRequirements.requirements.map((requirement) => [
            requirement.id,
            requirement,
        ]),
    );
    const targetsById = new Map(
        catalogs.artifactMatrix.targets.map((target) => [target.id, target]),
    );
    const harnessesById = new Map(
        harnesses.map((harness) => [harness.id, harness]),
    );
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((record) => record.id),
    );
    const bindings = catalogs.bindings.bindings;
    const bindingOutputs = bindings.flatMap((binding) => [
        binding,
        ...(binding.additionalOutputs ?? []),
    ]);

    for (const duplicate of duplicates(bindings.map((binding) => binding.id)))
        errors.push(
            `ecosystem artifact bindings contain duplicate id ${duplicate}`,
        );
    addClosureErrors(
        errors,
        "ecosystem artifact binding IDs",
        new Set(bindings.map((binding) => binding.id)),
        new Set(requiredEcosystemBindingIds),
    );
    const bindingKeys = bindings.map((binding) =>
        [
            binding.ecosystemId,
            binding.interfaceId,
            binding.requirementId,
            binding.targetId,
            binding.harnessId,
            binding.strategy,
        ].join("\0"),
    );
    for (const duplicate of duplicates(bindingKeys))
        errors.push(
            `ecosystem artifact bindings contain duplicate semantic binding ${duplicate.replaceAll("\0", "/")}`,
        );

    addClosureErrors(
        errors,
        "ecosystem artifact bindings",
        new Set(bindings.map((binding) => binding.ecosystemId)),
        new Set(contractsById.keys()),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact requirement bindings",
        new Set(
            bindingOutputs
                .map((binding) => binding.requirementId)
                .filter(Boolean),
        ),
        new Set(requiredMarketplaceRequirementIds),
    );
    addClosureErrors(
        errors,
        "marketplace requirement catalog",
        new Set(requirementsById.keys()),
        new Set(requiredMarketplaceRequirementIds),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact target bindings",
        new Set(
            bindingOutputs.map((binding) => binding.targetId).filter(Boolean),
        ),
        new Set(requiredArtifactTargetIds),
    );
    addClosureErrors(
        errors,
        "artifact target catalog",
        new Set(targetsById.keys()),
        new Set(requiredArtifactTargetIds),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact harness bindings",
        new Set(
            bindingOutputs.map((binding) => binding.harnessId).filter(Boolean),
        ),
        new Set(harnessesById.keys()),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact output-root bindings",
        new Set(
            bindingOutputs.map((binding) => binding.outputRoot).filter(Boolean),
        ),
        new Set(fixtureOutputRoots),
    );

    for (const binding of bindings) {
        const contract = contractsById.get(binding.ecosystemId);
        const profile = profilesById.get(binding.assuranceProfileId);
        const target = binding.targetId
            ? targetsById.get(binding.targetId)
            : undefined;
        const harness = binding.harnessId
            ? harnessesById.get(binding.harnessId)
            : undefined;

        if (contract && !contract.interfaces.includes(binding.interfaceId))
            errors.push(
                `binding ${binding.id} uses interface ${binding.interfaceId} not declared by ${binding.ecosystemId}`,
            );
        if (
            binding.requirementId &&
            !requirementsById.has(binding.requirementId)
        )
            errors.push(
                `binding ${binding.id} references unknown requirement ${binding.requirementId}`,
            );
        if (binding.targetId && !target)
            errors.push(
                `binding ${binding.id} references unknown target ${binding.targetId}`,
            );
        if (binding.harnessId && !harness)
            errors.push(
                `binding ${binding.id} references unknown harness ${binding.harnessId}`,
            );
        if (!profile)
            errors.push(
                `binding ${binding.id} references unknown assurance profile ${binding.assuranceProfileId}`,
            );
        else if (profile.artifactClass !== binding.artifactClass)
            errors.push(
                `binding ${binding.id} artifact class does not match assurance profile ${profile.id}`,
            );
        for (const evidenceId of binding.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `binding ${binding.id} references unknown evidence ${evidenceId}`,
                );
        }
        if (
            contract &&
            (binding.evidenceIds.length === 0 ||
                binding.evidenceIds.some(
                    (evidenceId) =>
                        !contract.officialEvidenceIds.includes(evidenceId),
                ))
        )
            errors.push(
                `binding ${binding.id} must use minimum exact official evidence`,
            );
        if (binding.supportClaim)
            errors.push(`binding ${binding.id} must not claim support`);

        if (generatedStrategies.has(binding.strategy)) {
            if (!target || !harness || !binding.outputRoot)
                errors.push(
                    `generated binding ${binding.id} must name a target, harness, and output root`,
                );
            if (target && target.outputRoot !== binding.outputRoot)
                errors.push(
                    `binding ${binding.id} output root diverges from target ${target.id}`,
                );
            if (target && target.requirementId !== binding.requirementId)
                errors.push(
                    `binding ${binding.id} requirement diverges from target ${target.id}`,
                );
            if (harness) {
                if (harness.fixtureTargetId !== binding.targetId)
                    errors.push(
                        `binding ${binding.id} target diverges from harness ${harness.id}`,
                    );
                if (harness.fixtureOutputRoot !== binding.outputRoot)
                    errors.push(
                        `binding ${binding.id} output root diverges from harness ${harness.id}`,
                    );
            }
        }
        const allowedGenerationStates = generationStatesByStrategy.get(
            binding.strategy,
        );
        if (!allowedGenerationStates?.has(binding.generationState))
            errors.push(
                `binding ${binding.id} generation state ${binding.generationState} is invalid for strategy ${binding.strategy}`,
            );
        if (
            outputlessStrategies.has(binding.strategy) &&
            (binding.harnessId !== null || binding.outputRoot !== null)
        )
            errors.push(
                `outputless binding ${binding.id} must not fabricate a harness or output root`,
            );
        if (
            contract &&
            ["provider", "registry", "publication-service"].includes(
                contract.kind,
            ) &&
            binding.outputRoot !== null
        )
            errors.push(
                `${contract.kind} binding ${binding.id} must not fabricate an output root`,
            );
        if (
            target &&
            target.outputRoot === null &&
            (binding.harnessId !== null || binding.outputRoot !== null)
        )
            errors.push(
                `no-output target binding ${binding.id} must not fabricate output`,
            );
        for (const output of binding.additionalOutputs ?? []) {
            const additionalTarget = targetsById.get(output.targetId);
            const additionalHarness = harnessesById.get(output.harnessId);
            if (!requirementsById.has(output.requirementId))
                errors.push(
                    `binding ${binding.id} alternate output references unknown requirement ${output.requirementId}`,
                );
            if (!additionalTarget || !additionalHarness)
                errors.push(
                    `binding ${binding.id} alternate output references an unknown target or harness`,
                );
            else if (
                additionalTarget.requirementId !== output.requirementId ||
                additionalTarget.outputRoot !== output.outputRoot ||
                additionalHarness.fixtureTargetId !== output.targetId ||
                additionalHarness.fixtureOutputRoot !== output.outputRoot
            )
                errors.push(
                    `binding ${binding.id} alternate output diverges from its target or harness`,
                );
            if (output.supportClaim || output.marketplaceAvailabilityClaim)
                errors.push(
                    `binding ${binding.id} alternate output must not claim support or marketplace availability`,
                );
        }
    }

    const agentPluginRequirement = requirementsById.get(
        "agent-plugins-open-standard",
    );
    if (
        agentPluginRequirement &&
        !equalSets(agentPluginRequirement.requiredRoots, ["plugin.json"])
    )
        errors.push(
            "Agent Plugins marketplace requirement must universally require only root plugin.json",
        );
    const agentSkillsRequirement = requirementsById.get(
        "agent-skills-open-standard",
    );
    if (
        agentSkillsRequirement &&
        !equalSets(agentSkillsRequirement.requiredRoots, [
            "<skill-root>/SKILL.md",
        ])
    )
        errors.push(
            "Agent Skills marketplace requirement must not impose a universal enclosing path",
        );

    if (
        catalogs.bindings.publicationEligible ||
        catalogs.bindings.promotionEligible ||
        catalogs.artifactMatrix.publicationEligible ||
        catalogs.artifactMatrix.promotionEligible
    )
        errors.push(
            "S1 must not alter publication or promotion eligibility gates",
        );
    return errors;
}

const expectedHostAdapterAnchor =
    "9355fb1d654896bdd1bcf51d301b5728161240c1629e9fe69f19cea4e64e4c00";

export function validateHostAdapters(catalogs) {
    const errors = [];
    const hostAdapterAnchor = createHash("sha256")
        .update(
            `${[...catalogs.hostAdapters.hosts]
                .sort((left, right) => compareOrdinal(left.id, right.id))
                .map((record) => JSON.stringify(record))
                .join("\n")}\n`,
        )
        .digest("hex");
    if (hostAdapterAnchor !== expectedHostAdapterAnchor)
        errors.push(
            "host adapter semantic contract differs from the independently reviewed anchor",
        );
    const contractsById = new Map(
        catalogs.ecosystemContracts.ecosystems.map((record) => [
            record.id,
            record,
        ]),
    );
    const bindingsById = new Map(
        catalogs.bindings.bindings.map((record) => [record.id, record]),
    );
    const evidenceById = new Map(
        catalogs.evidence.evidence.map((record) => [record.id, record]),
    );
    const expectedHostEcosystemIds = new Set(
        catalogs.ecosystemContracts.ecosystems
            .filter(
                (record) =>
                    record.kind === "host" || record.id === "pi-packages",
            )
            .map((record) => record.id),
    );
    const actualHostEcosystemIds = new Set(
        catalogs.hostAdapters.hosts.map((record) => record.ecosystemId),
    );
    addClosureErrors(
        errors,
        "host adapter registry",
        actualHostEcosystemIds,
        expectedHostEcosystemIds,
    );
    for (const duplicate of duplicates(
        catalogs.hostAdapters.hosts.map((record) => record.id),
    ))
        errors.push(`host adapter registry contains duplicate id ${duplicate}`);
    for (const host of catalogs.hostAdapters.hosts) {
        if (host.id !== `${host.ecosystemId}-host-adapter`)
            errors.push(
                `host adapter ${host.id} identity diverges from ecosystem ${host.ecosystemId}`,
            );
        const contract = contractsById.get(host.ecosystemId);
        const binding = bindingsById.get(host.serving.artifactBindingId);
        if (!contract) {
            errors.push(
                `host adapter ${host.id} references unknown ecosystem ${host.ecosystemId}`,
            );
            continue;
        }
        if (binding?.ecosystemId !== host.ecosystemId)
            errors.push(
                `host adapter ${host.id} references an unknown or foreign serving artifact binding`,
            );
        else if (
            binding.targetId !== host.serving.targetId ||
            binding.outputRoot !== host.serving.outputRoot
        )
            errors.push(
                `host adapter ${host.id} serving artifact diverges from its binding`,
            );
        if (host.product.clientVersion !== contract.versions.client)
            errors.push(
                `host adapter ${host.id} client version diverges from its ecosystem contract`,
            );
        if (host.product.serviceVersion !== contract.versions.service)
            errors.push(
                `host adapter ${host.id} service version diverges from its ecosystem contract`,
            );
        if (
            host.product.clientVersion?.includes("documentation") ||
            host.product.serviceVersion?.includes("documentation")
        )
            errors.push(
                `host adapter ${host.id} confuses a documentation snapshot with a product version`,
            );
        if (
            (host.product.clientVersion || host.product.serviceVersion) &&
            !host.product.versionEvidenceId
        )
            errors.push(`host adapter ${host.id} version lacks exact evidence`);
        if (host.product.versionEvidenceId) {
            const versionEvidence = evidenceById.get(
                host.product.versionEvidenceId,
            );
            const version =
                host.product.clientVersion ?? host.product.serviceVersion;
            if (
                !host.officialEvidence.evidenceIds.includes(
                    host.product.versionEvidenceId,
                ) ||
                !versionEvidence ||
                !versionEvidence.applicableVersion.includes(version)
            )
                errors.push(
                    `host adapter ${host.id} version is not bound to exact official evidence`,
                );
        }
        const citedEvidence = [];
        for (const evidenceId of host.officialEvidence.evidenceIds) {
            if (!contract.officialEvidenceIds.includes(evidenceId))
                errors.push(
                    `host adapter ${host.id} uses non-contract evidence ${evidenceId}`,
                );
            if (evidenceById.has(evidenceId))
                citedEvidence.push(evidenceById.get(evidenceId));
            else
                errors.push(
                    `host adapter ${host.id} references unknown evidence ${evidenceId}`,
                );
        }
        if (host.officialEvidence.validThrough < catalogs.hostAdapters.asOf)
            errors.push(`host adapter ${host.id} evidence is expired`);
        if (citedEvidence.length > 0) {
            const expectedObservedOn = citedEvidence
                .map((record) => record.verifiedOn)
                .sort()
                .at(-1);
            const expectedValidThrough = citedEvidence
                .map((record) => record.expiresOn)
                .sort()[0];
            const documentationDates = citedEvidence
                .filter((record) =>
                    [
                        "specification",
                        "official-documentation",
                        "installed-documentation",
                    ].includes(record.sourceKind),
                )
                .map((record) => record.verifiedOn)
                .sort();
            const expectedDocumentationSnapshot =
                documentationDates.at(-1) ?? expectedObservedOn;
            if (
                host.officialEvidence.observedOn !== expectedObservedOn ||
                host.officialEvidence.validThrough !== expectedValidThrough
            )
                errors.push(
                    `host adapter ${host.id} evidence window exceeds or diverges from cited evidence`,
                );
            if (
                host.product.documentationSnapshot !==
                expectedDocumentationSnapshot
            )
                errors.push(
                    `host adapter ${host.id} documentation snapshot diverges from cited documentation evidence`,
                );
        }
        for (const [standardName, standard] of Object.entries(
            host.acceptedStandards,
        )) {
            if (
                ["explicit", "compatible-layout", "provider-only"].includes(
                    standard.state,
                ) &&
                standard.evidenceIds.length === 0
            )
                errors.push(
                    `host adapter ${host.id} ${standardName} claim lacks evidence`,
                );
            for (const evidenceId of standard.evidenceIds)
                if (!host.officialEvidence.evidenceIds.includes(evidenceId))
                    errors.push(
                        `host adapter ${host.id} ${standardName} claim uses non-host evidence ${evidenceId}`,
                    );
        }
        if (host.acceptedStandards.agentPlugins.state === "explicit") {
            if (host.acceptedStandards.agentPlugins.version !== "1.0.0")
                errors.push(
                    `host adapter ${host.id} must pin explicit Agent Plugins compatibility to 1.0.0`,
                );
            if (!contract.interfaces.includes("agent-plugin-package"))
                errors.push(
                    `host adapter ${host.id} claims Agent Plugins without the ecosystem interface`,
                );
        }
        if (
            host.acceptedStandards.agentSkills.state === "explicit" &&
            !contract.interfaces.includes("agent-skill")
        )
            errors.push(
                `host adapter ${host.id} claims Agent Skills without the ecosystem interface`,
            );
        if (host.strategy === "no-public-extension-surface") {
            if (
                [
                    host.acceptedStandards.agentSkills,
                    host.acceptedStandards.agentPlugins,
                ].some((standard) =>
                    ["explicit", "compatible-layout", "provider-only"].includes(
                        standard.state,
                    ),
                ) ||
                host.supportDisposition.coverage !== "no-surface"
            )
                errors.push(
                    `host adapter ${host.id} no-surface disposition contradicts active host capabilities`,
                );
        }
        if (
            [
                "migration-only",
                "evidence-gap",
                "no-public-extension-surface",
                "rules-fallback",
            ].includes(host.strategy) &&
            (host.serving.targetId !== null || host.serving.outputRoot !== null)
        )
            errors.push(
                `host adapter ${host.id} fabricates output for ${host.strategy}`,
            );
        if (host.supportDisposition.supportClaim)
            errors.push(`host adapter ${host.id} must not claim support`);
    }
    return errors;
}

export function validateGeneratedEcosystemArtifactCoverage(catalogs, root) {
    const errors = [];
    const expected = generateEcosystemArtifactCoverage(root);
    if (JSON.stringify(catalogs.coverage) !== JSON.stringify(expected))
        errors.push(
            "generated ecosystem artifact coverage does not match authored bindings",
        );
    if (
        catalogs.coverage.publicationEligible ||
        catalogs.coverage.promotionEligible
    )
        errors.push(
            "generated ecosystem artifact coverage must remain publication and promotion ineligible",
        );
    for (const record of catalogs.coverage.coverage) {
        if (record.supportClaim)
            errors.push(
                `generated coverage ${record.bindingId} must not claim support`,
            );
    }
    return errors;
}

export function validateEcosystemArtifactSemantics(
    catalogs,
    root = defaultRepositoryRoot,
) {
    return [
        ...validateArtifactAssuranceProfiles(catalogs),
        ...validateEcosystemContracts(catalogs),
        ...validateEcosystemArtifactClosure(catalogs),
        ...validateHostAdapters(catalogs),
        ...validateGeneratedEcosystemArtifactCoverage(catalogs, root),
    ];
}

export function validateEcosystemArtifactContracts(
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const catalogs = loadEcosystemArtifactCatalogs(root);
    for (const [key, schemaPath] of Object.entries(
        ecosystemArtifactSchemaPaths,
    )) {
        const schema = readCatalog(join(root, schemaPath));
        errors.push(
            ...validateSchemaVocabulary(schema).map(
                (error) => `${schemaPath} ${error}`,
            ),
        );
        errors.push(
            ...validateAgainstSchema(catalogs[key], schema).map(
                (error) => `${ecosystemArtifactPaths[key]} ${error}`,
            ),
        );
    }
    if (errors.length > 0) return errors;
    return validateEcosystemArtifactSemantics(catalogs, root);
}
