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

test("ecosystem contracts preserve all 26 legacy IDs, 63 official sources, and 110 facts", () => {
    const catalogs = load();
    const contracts = catalogs.ecosystemContracts.ecosystems;
    assert.equal(contracts.length, 26);
    assert.equal(
        contracts.reduce(
            (count, contract) => count + contract.officialEvidenceIds.length,
            0,
        ),
        63,
    );
    assert.equal(
        contracts.reduce(
            (count, contract) => count + contract.legacyFactBindings.length,
            0,
        ),
        110,
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

test("Agent Plugins cannot make MCP universal and Agent Skills cannot impose an enclosing root", () => {
    const catalogs = load();
    const mcpMutation = clone(catalogs);
    mcpMutation.ecosystemContracts.ecosystems
        .find((record) => record.id === "agent-plugins")
        .manifests.find((manifest) => manifest.path === "mcp.json").requirement =
        "required";
    hasError(validateEcosystemContracts(mcpMutation), "mcp.json must remain optional");

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
        ["agent-skills-artifact-binding", "ecosystem artifact bindings does not account for agent-skills"],
        ["npm-trusted-publishing-artifact-binding", "ecosystem artifact requirement bindings does not account for npm-trusted-publication"],
        ["openai-plugins-artifact-binding", "ecosystem artifact target bindings does not account for openai-codex"],
        ["gemini-cli-extensions-artifact-binding", "ecosystem artifact harness bindings does not account for gemini"],
        ["pi-packages-artifact-binding", "ecosystem artifact output-root bindings does not account for pi"],
    ];
    for (const [bindingId, message] of removals) {
        const catalogs = load();
        catalogs.bindings.bindings = catalogs.bindings.bindings.filter(
            (binding) => binding.id !== bindingId,
        );
        hasError(validateEcosystemArtifactClosure(catalogs), message);
    }
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

test("generated coverage is deterministic, byte-stable, and explicitly not support", () => {
    const first = `${JSON.stringify(generateEcosystemArtifactCoverage(), null, 2)}\n`;
    const second = `${JSON.stringify(generateEcosystemArtifactCoverage(), null, 2)}\n`;
    assert.equal(first, second);
    assert.equal(
        first,
        `${JSON.stringify(readCatalog(join(defaultRepositoryRoot, ecosystemArtifactPaths.coverage)), null, 2)}\n`,
    );
    const coverage = JSON.parse(first);
    assert.equal(coverage.coverage.length, 26);
    assert(
        coverage.coverage.every((record) => record.supportClaim === false),
    );
    assert.match(coverage.supportPolicy, /not support claims/);
});
