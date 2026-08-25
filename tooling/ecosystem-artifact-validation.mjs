// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { join } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import {
    fixtureOutputRoots,
    harnesses,
    requiredEcosystemIds,
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
});

export const ecosystemArtifactSchemaPaths = Object.freeze({
    ecosystemContracts: "catalog/schemas/ecosystem-contracts.schema.json",
    assuranceProfiles:
        "catalog/schemas/artifact-assurance-profiles.schema.json",
    bindings: "distribution/ecosystem-artifact-bindings.schema.json",
    coverage: "catalog/schemas/ecosystem-artifact-coverage.schema.json",
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
    return [...values].sort((left, right) => left.localeCompare(right, "en"));
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
        errors.push(`artifact assurance profiles contain duplicate id ${duplicate}`);
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
            if (
                profile.controls.ecosystemNativeProvenance !==
                "when-supported"
            )
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
    if (contracts.length !== 26)
        errors.push(
            `ecosystem contracts must retain the 26-ecosystem S1 completeness anchor; found ${contracts.length}`,
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
            for (const evidenceId of binding.evidenceIds) {
                if (!contract.officialEvidenceIds.includes(evidenceId))
                    errors.push(
                        `ecosystem contract ${contract.id} legacy fact ${binding.factId} references nonofficial evidence ${evidenceId}`,
                    );
            }
        }
        for (const root of contract.discoveryRoots) {
            for (const evidenceId of root.evidenceIds) {
                if (!contract.officialEvidenceIds.includes(evidenceId))
                    errors.push(
                        `ecosystem contract ${contract.id} discovery root references nonofficial evidence ${evidenceId}`,
                    );
            }
        }
    }

    const agentPlugins = contractsById.get("agent-plugins");
    if (agentPlugins) {
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
            errors.push("Agent Plugins skills must remain an optional component");
        if (agentPlugins.components.mcp !== "optional")
            errors.push("Agent Plugins MCP must remain an optional component");
    }

    const agentSkills = contractsById.get("agent-skills");
    if (agentSkills) {
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
    const harnessesById = new Map(harnesses.map((harness) => [harness.id, harness]));
    const evidenceIds = new Set(
        catalogs.evidence.evidence.map((record) => record.id),
    );
    const bindings = catalogs.bindings.bindings;

    for (const duplicate of duplicates(bindings.map((binding) => binding.id)))
        errors.push(`ecosystem artifact bindings contain duplicate id ${duplicate}`);
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
            bindings
                .map((binding) => binding.requirementId)
                .filter(Boolean),
        ),
        new Set(requirementsById.keys()),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact target bindings",
        new Set(bindings.map((binding) => binding.targetId).filter(Boolean)),
        new Set(targetsById.keys()),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact harness bindings",
        new Set(bindings.map((binding) => binding.harnessId).filter(Boolean)),
        new Set(harnessesById.keys()),
    );
    addClosureErrors(
        errors,
        "ecosystem artifact output-root bindings",
        new Set(bindings.map((binding) => binding.outputRoot).filter(Boolean)),
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
        if (binding.requirementId && !requirementsById.has(binding.requirementId))
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
