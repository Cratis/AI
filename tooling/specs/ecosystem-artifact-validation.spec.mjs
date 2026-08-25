// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "../catalog-validation.mjs";
import {
    ecosystemArtifactPaths,
    ecosystemArtifactSchemaPaths,
    loadEcosystemArtifactCatalogs,
    validateArtifactAssuranceProfiles,
    validateEcosystemArtifactClosure,
    validateEcosystemArtifactContracts,
    validateEcosystemContracts,
    validateHostAdapters,
} from "../ecosystem-artifact-validation.mjs";
import { generateEcosystemArtifactCoverage } from "../generate-ecosystem-artifact-coverage.mjs";

const clone = (value) => structuredClone(value);
const load = () => loadEcosystemArtifactCatalogs(defaultRepositoryRoot);

function hasError(errors, text) {
    assert(
        errors.some((error) => error.includes(text)),
        `Expected an error containing ${JSON.stringify(text)}; received:\n${errors.join("\n")}`,
    );
}

test("structured ecosystem and artifact contracts pass closed schemas and semantic closure", () => {
    assert.deepEqual(validateEcosystemArtifactContracts(), []);
});

test("all new ecosystem and artifact schemas reject unknown properties", () => {
    const catalogs = load();
    for (const [key, schemaPath] of Object.entries(
        ecosystemArtifactSchemaPaths,
    )) {
        const schema = readCatalog(join(defaultRepositoryRoot, schemaPath));
        const mutated = clone(catalogs[key]);
        mutated.unexpected = true;
        hasError(
            validateAgainstSchema(mutated, schema),
            "unknown property unexpected",
        );
        assert(ecosystemArtifactPaths[key]);
    }
});

test("ecosystem contracts preserve all 45 IDs, 108 official sources, and 172 facts", () => {
    const catalogs = load();
    const contracts = catalogs.ecosystemContracts.ecosystems;
    assert.equal(contracts.length, 45);
    assert.equal(
        contracts.reduce(
            (count, contract) => count + contract.officialEvidenceIds.length,
            0,
        ),
        108,
    );
    assert.equal(
        contracts.reduce(
            (count, contract) => count + contract.legacyFactBindings.length,
            0,
        ),
        172,
    );
});

test("Agent Plugins requires only root plugin.json while skills and root mcp.json remain optional", () => {
    const catalogs = load();
    const contract = catalogs.ecosystemContracts.ecosystems.find(
        (record) => record.id === "agent-plugins",
    );
    assert.deepEqual(
        contract.manifests
            .filter((manifest) => manifest.requirement === "required")
            .map((manifest) => manifest.path),
        ["plugin.json"],
    );
    assert.equal(contract.components.skills, "optional");
    assert.equal(contract.components.mcp, "optional");
    assert.equal(
        contract.manifests.find((manifest) => manifest.path === "mcp.json")
            .requirement,
        "optional",
    );

    const mutation = clone(catalogs);
    mutation.ecosystemContracts.ecosystems
        .find((record) => record.id === "agent-plugins")
        .manifests.push({
            id: "skill-manifest",
            path: "skills/<skill-name>/SKILL.md",
            requirement: "required",
            schemaVersion: null,
        });
    hasError(
        validateEcosystemContracts(mutation),
        "must universally require only root plugin.json",
    );
});

test("standards contracts pin the published Agent Plugins version without inventing an Agent Skills version", () => {
    const pluginsMutation = clone(load());
    pluginsMutation.ecosystemContracts.ecosystems.find(
        (record) => record.id === "agent-plugins",
    ).versions.specification = "1.1.0";
    hasError(
        validateEcosystemContracts(pluginsMutation),
        "pinned to published specification 1.0.0",
    );

    const skillsMutation = clone(load());
    skillsMutation.ecosystemContracts.ecosystems.find(
        (record) => record.id === "agent-skills",
    ).versions.specification = "1.0.0";
    hasError(
        validateEcosystemContracts(skillsMutation),
        "must not invent a numbered specification version",
    );
});

test("Agent Plugins cannot make MCP universal and Agent Skills cannot impose an enclosing root", () => {
    const catalogs = load();
    const mcpMutation = clone(catalogs);
    mcpMutation.ecosystemContracts.ecosystems
        .find((record) => record.id === "agent-plugins")
        .manifests.find(
            (manifest) => manifest.path === "mcp.json",
        ).requirement = "required";
    hasError(
        validateEcosystemContracts(mcpMutation),
        "mcp.json must remain optional",
    );

    const skillsMutation = clone(catalogs);
    skillsMutation.ecosystemContracts.ecosystems.find(
        (record) => record.id === "agent-skills",
    ).discoveryRoots[0].path = "skills/<skill-name>/SKILL.md";
    hasError(
        validateEcosystemContracts(skillsMutation),
        "without a universal enclosing path",
    );
});

test("passive public profiles reject every executable component and require all assurance controls", () => {
    const catalogs = load();
    const executionMutation = clone(catalogs);
    executionMutation.assuranceProfiles.profiles.find(
        (profile) => profile.id === "passive-public-package-v1",
    ).components.scripts = "allow";
    hasError(
        validateArtifactAssuranceProfiles(executionMutation),
        "admits executable component scripts",
    );

    const controlMutation = clone(catalogs);
    controlMutation.assuranceProfiles.profiles.find(
        (profile) => profile.id === "passive-public-package-v1",
    ).controls.sha256Inventory = "when-supported";
    hasError(
        validateArtifactAssuranceProfiles(controlMutation),
        "must require sha256Inventory",
    );
});

test("closure rejects an unmapped ecosystem, requirement, target, harness, and generated root", () => {
    const removals = [
        [
            "agent-skills-artifact-binding",
            "ecosystem artifact bindings does not account for agent-skills",
        ],
        [
            "npm-trusted-publishing-artifact-binding",
            "ecosystem artifact requirement bindings does not account for npm-trusted-publication",
        ],
        [
            "openai-plugins-artifact-binding",
            "ecosystem artifact target bindings does not account for openai-codex",
        ],
        [
            "gemini-cli-extensions-artifact-binding",
            "ecosystem artifact harness bindings does not account for gemini",
        ],
        [
            "pi-packages-artifact-binding",
            "ecosystem artifact output-root bindings does not account for pi",
        ],
    ];
    for (const [bindingId, message] of removals) {
        const catalogs = load();
        catalogs.bindings.bindings = catalogs.bindings.bindings.filter(
            (binding) => binding.id !== bindingId,
        );
        hasError(validateEcosystemArtifactClosure(catalogs), message);
    }
});

test("independent anchors reject coordinated ecosystem, requirement, target, and binding drift", () => {
    const ecosystemMutation = clone(load());
    ecosystemMutation.ecosystemContracts.ecosystems[0].id =
        "replacement-ecosystem";
    ecosystemMutation.ecosystemVersions.ecosystems[0].id =
        "replacement-ecosystem";
    ecosystemMutation.bindings.bindings[0].ecosystemId =
        "replacement-ecosystem";
    hasError(
        validateEcosystemContracts(ecosystemMutation),
        "must remain the harness registry completeness anchor",
    );

    const requirementMutation = clone(load());
    const oldRequirement =
        requirementMutation.marketplaceRequirements.requirements[0].id;
    requirementMutation.marketplaceRequirements.requirements[0].id =
        "replacement-requirement";
    for (const target of requirementMutation.artifactMatrix.targets) {
        if (target.requirementId === oldRequirement)
            target.requirementId = "replacement-requirement";
    }
    for (const binding of requirementMutation.bindings.bindings) {
        if (binding.requirementId === oldRequirement)
            binding.requirementId = "replacement-requirement";
    }
    hasError(
        validateEcosystemArtifactClosure(requirementMutation),
        "marketplace requirement catalog does not account for",
    );

    const targetMutation = clone(load());
    const oldTarget = targetMutation.artifactMatrix.targets[0].id;
    targetMutation.artifactMatrix.targets[0].id = "replacement-target";
    for (const binding of targetMutation.bindings.bindings) {
        if (binding.targetId === oldTarget)
            binding.targetId = "replacement-target";
    }
    hasError(
        validateEcosystemArtifactClosure(targetMutation),
        "artifact target catalog does not account for",
    );

    const bindingMutation = clone(load());
    bindingMutation.bindings.bindings[0].id = "replacement-artifact-binding";
    hasError(
        validateEcosystemArtifactClosure(bindingMutation),
        "ecosystem artifact binding IDs does not account for",
    );
});

test("closure requires exact evidence bindings", () => {
    const wrongBindingEvidence = clone(load());
    wrongBindingEvidence.bindings.bindings[0].evidenceIds = [
        "reevaluation-authority",
    ];
    hasError(
        validateEcosystemArtifactClosure(wrongBindingEvidence),
        "minimum exact official evidence",
    );

    const omittedFactEvidence = clone(load());
    omittedFactEvidence.ecosystemContracts.ecosystems[0].legacyFactBindings[0].evidenceIds.pop();
    hasError(
        validateEcosystemContracts(omittedFactEvidence),
        "must preserve its exact evidence binding",
    );

    const omittedRootEvidence = clone(load());
    omittedRootEvidence.ecosystemContracts.ecosystems[0].discoveryRoots[0].evidenceIds.pop();
    hasError(
        validateEcosystemContracts(omittedRootEvidence),
        "discovery root . must use minimum exact official evidence",
    );
});

test("closure binds requirement and generation state to target strategy", () => {
    const requirementMutation = clone(load());
    requirementMutation.bindings.bindings.find(
        (binding) => binding.id === "agent-plugins-artifact-binding",
    ).requirementId = "agent-skills-open-standard";
    hasError(
        validateEcosystemArtifactClosure(requirementMutation),
        "requirement diverges from target portable-agent-plugin",
    );

    const stateMutation = clone(load());
    const binding = stateMutation.bindings.bindings.find(
        (record) => record.id === "model-context-protocol-artifact-binding",
    );
    binding.strategy = "blocked";
    binding.generationState = "fixture-generated";
    hasError(
        validateEcosystemArtifactClosure(stateMutation),
        "generation state fixture-generated is invalid for strategy blocked",
    );
});

test("closed schemas reject additive ecosystem coverage records", () => {
    const catalogs = load();
    const bindingsSchema = readCatalog(
        join(defaultRepositoryRoot, ecosystemArtifactSchemaPaths.bindings),
    );
    const mutation = clone(catalogs.bindings);
    mutation.bindings.push({
        ...mutation.bindings[0],
        id: "additional-artifact-binding",
        ecosystemId: "additional-ecosystem",
    });
    hasError(
        validateAgainstSchema(mutation, bindingsSchema),
        "must contain at most 45 items",
    );
});

test("closure rejects dangling IDs and duplicate semantic bindings", () => {
    const dangling = clone(load());
    dangling.bindings.bindings[0].assuranceProfileId = "missing-profile";
    hasError(
        validateEcosystemArtifactClosure(dangling),
        "references unknown assurance profile missing-profile",
    );

    const duplicate = clone(load());
    duplicate.bindings.bindings.push({
        ...duplicate.bindings.bindings[0],
        id: "duplicate-artifact-binding",
    });
    hasError(
        validateEcosystemArtifactClosure(duplicate),
        "duplicate semantic binding",
    );
});

test("provider, registry, publication, and no-output records cannot fabricate outputs", () => {
    for (const ecosystemId of [
        "deepseek-model-integrations",
        "mcp-registry",
        "npm-cratis-scope",
        "npm-trusted-publishing",
    ]) {
        const catalogs = load();
        const binding = catalogs.bindings.bindings.find(
            (record) => record.ecosystemId === ecosystemId,
        );
        binding.harnessId = "agent-skills";
        binding.outputRoot = "canonical";
        hasError(
            validateEcosystemArtifactClosure(catalogs),
            "must not fabricate",
        );
    }
});

test("host registry is exact, fail-closed, and rejects unsupported claims or fabricated outputs", () => {
    const catalogs = load();
    assert.equal(catalogs.hostAdapters.hosts.length, 38);
    assert.deepEqual(validateHostAdapters(catalogs), []);

    const deletion = clone(catalogs);
    deletion.hostAdapters.hosts = deletion.hostAdapters.hosts.filter(
        (record) => record.ecosystemId !== "cline",
    );
    hasError(validateHostAdapters(deletion), "does not account for cline");

    const wrongStandard = clone(catalogs);
    const aider = wrongStandard.hostAdapters.hosts.find(
        (record) => record.ecosystemId === "aider",
    );
    aider.acceptedStandards.agentPlugins = {
        state: "explicit",
        version: "1.0.0",
        evidenceIds: ["aider-source-1"],
    };
    hasError(
        validateHostAdapters(wrongStandard),
        "claims Agent Plugins without the ecosystem interface",
    );

    const fabricated = clone(catalogs);
    const roo = fabricated.hostAdapters.hosts.find(
        (record) => record.ecosystemId === "roo-code",
    );
    roo.serving.targetId = "canonical-agent-skills";
    roo.serving.outputRoot = "canonical";
    hasError(validateHostAdapters(fabricated), "fabricates output");

    const versionType = clone(catalogs);
    const cline = versionType.hostAdapters.hosts.find(
        (record) => record.ecosystemId === "cline",
    );
    cline.product.clientVersion = "current-documentation-2026-08-25";
    hasError(validateHostAdapters(versionType), "confuses a documentation snapshot");

    const expired = clone(catalogs);
    expired.hostAdapters.hosts.find(
        (record) => record.ecosystemId === "cline",
    ).officialEvidence.validThrough = "2026-08-24";
    hasError(validateHostAdapters(expired), "evidence is expired");

    const dangling = clone(catalogs);
    dangling.hostAdapters.hosts.find(
        (record) => record.ecosystemId === "cline",
    ).serving.artifactBindingId = "missing-artifact-binding";
    hasError(validateHostAdapters(dangling), "unknown or foreign serving artifact binding");
});

test("closed host schema rejects coordinated additive records", () => {
    const catalogs = load();
    const schema = readCatalog(
        join(defaultRepositoryRoot, ecosystemArtifactSchemaPaths.hostAdapters),
    );
    const mutation = clone(catalogs.hostAdapters);
    mutation.hosts.push({
        ...clone(mutation.hosts[0]),
        id: "fabricated-host-adapter",
        ecosystemId: "fabricated-host",
    });
    hasError(validateAgainstSchema(mutation, schema), "must contain at most 38 items");
});

test("generated coverage is deterministic, byte-stable, and explicitly not support", () => {
    const first = `${JSON.stringify(generateEcosystemArtifactCoverage(), null, 2)}\n`;
    const second = `${JSON.stringify(generateEcosystemArtifactCoverage(), null, 2)}\n`;
    assert.equal(first, second);
    assert.equal(
        first,
        `${JSON.stringify(readCatalog(join(defaultRepositoryRoot, ecosystemArtifactPaths.coverage)), null, 2)}\n`,
    );
    const coverage = JSON.parse(first);
    assert.equal(coverage.coverage.length, 45);
    assert(coverage.coverage.every((record) => record.supportClaim === false));
    assert.match(coverage.supportPolicy, /not support claims/);
});
