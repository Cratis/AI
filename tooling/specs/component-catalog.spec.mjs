// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
    componentCatalogPaths,
    componentKinds,
    digestCanonicalSource,
    digestComponentSources,
    validateComponentCatalogs,
    validateComponentProjections,
    validateComponents,
    validateGeneratedComponentCatalogs,
} from "../component-catalog-validation.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "../catalog-validation.mjs";
import { validateArtifacts } from "../catalog-v2-validation.mjs";

function clone(value) {
    return structuredClone(value);
}

function load() {
    return {
        components: readCatalog(
            join(
                defaultRepositoryRoot,
                componentCatalogPaths.authoredComponents,
            ),
        ),
        projections: readCatalog(
            join(
                defaultRepositoryRoot,
                componentCatalogPaths.authoredProjections,
            ),
        ),
        generatedComponents: readCatalog(
            join(
                defaultRepositoryRoot,
                componentCatalogPaths.generatedComponents,
            ),
        ),
        generatedProjections: readCatalog(
            join(
                defaultRepositoryRoot,
                componentCatalogPaths.generatedProjections,
            ),
        ),
        evidence: readCatalog(
            join(defaultRepositoryRoot, componentCatalogPaths.evidence),
        ),
        targets: readCatalog(
            join(defaultRepositoryRoot, componentCatalogPaths.targets),
        ),
        assuranceProfiles: readCatalog(
            join(
                defaultRepositoryRoot,
                componentCatalogPaths.assuranceProfiles,
            ),
        ),
    };
}

function passiveStaticComponent(root, sourcePath = "source/owned.txt") {
    const digest = digestCanonicalSource(root, sourcePath);
    const canonicalSources = [
        {
            path: sourcePath,
            digest,
            ownership: "owner",
            ownerComponentId: "fixture-static-asset",
        },
    ];
    return {
        id: "fixture-static-asset",
        kind: "static-asset",
        semanticIdentity: "fixture-static-asset",
        semanticName: "Fixture static asset",
        canonicalSources,
        contentDigest: digestComponentSources(canonicalSources),
        owner: "repository-only authoring/release tooling",
        audience: "repository-only",
        classification: {
            artifactClass: "static-asset",
            trust: "passive",
            passive: true,
            executable: false,
            effect: "none",
        },
        dependencies: [],
        hostNeutralPurpose: "Exercise exact source closure.",
        approval: { state: "modeled", evidenceIds: ["fixture-evidence"] },
        releaseBoundary: "repository-only",
        allowedProjections: [],
        forbiddenProjections: componentKinds.filter(
            (kind) => kind !== "static-asset",
        ),
        requiredCanaries: ["source-digest"],
        securityRequirements: {
            threatModel: false,
            securityReview: false,
            executableAssuranceProfile: false,
        },
    };
}

function syntheticCatalog(root, component) {
    return {
        components: {
            schemaVersion: 1,
            defaultPolicy: "deny",
            canonicalSourceRoots: ["source"],
            declaredEmptyKinds: componentKinds.filter(
                (kind) => kind !== component.kind,
            ),
            components: [component],
        },
        evidence: { evidence: [{ id: "fixture-evidence" }] },
        targets: { targets: [] },
    };
}

function projectionErrors(catalogs) {
    return validateComponentProjections(catalogs, defaultRepositoryRoot);
}

test("component catalogs are closed, exact, generated, and fail closed", () => {
    assert.deepEqual(validateComponentCatalogs(), []);
    const catalogs = load();
    const componentSchema = readCatalog(
        join(defaultRepositoryRoot, componentCatalogPaths.componentsSchema),
    );
    const mutated = clone(catalogs.components);
    mutated.components[0].unexpected = true;
    assert(
        validateAgainstSchema(mutated, componentSchema, componentSchema).some(
            (error) => error.includes("unknown property unexpected"),
        ),
    );
});

test("catalog records all kinds and honestly declares MCP and LSP empty", () => {
    const { components } = load();
    const counts = Object.fromEntries(
        componentKinds.map((kind) => [
            kind,
            components.components.filter((component) => component.kind === kind)
                .length,
        ]),
    );
    assert.equal(counts.skill, 43);
    assert.equal(counts.agent, 12);
    assert.equal(counts.command, 18);
    assert.equal(counts.prompt, 18);
    assert.equal(counts.rule, 34);
    assert.equal(counts.instruction, 1);
    assert.equal(counts.hook, 1);
    assert.equal(counts["executable-host-extension"], 2);
    assert.equal(counts.mcp, 0);
    assert.equal(counts.lsp, 0);
    assert(components.declaredEmptyKinds.includes("mcp"));
    assert(components.declaredEmptyKinds.includes("lsp"));
});

test("an orphan canonical source fails exact closure", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-component-orphan-"));
    try {
        mkdirSync(join(root, "source"));
        writeFileSync(join(root, "source/owned.txt"), "owned\n");
        writeFileSync(join(root, "source/orphan.txt"), "orphan\n");
        const catalogs = syntheticCatalog(root, passiveStaticComponent(root));
        assert(
            validateComponents(catalogs, root).some((error) =>
                error.includes("orphan canonical source source/orphan.txt"),
            ),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("duplicate canonical ownership fails", () => {
    const catalogs = load();
    const first = catalogs.components.components.find(
        (component) => component.kind === "agent",
    );
    const duplicate = clone(first);
    duplicate.id = "duplicate-owner-fixture";
    duplicate.semanticIdentity = duplicate.id;
    duplicate.canonicalSources[0].ownerComponentId = duplicate.id;
    duplicate.contentDigest = digestComponentSources(
        duplicate.canonicalSources,
    );
    catalogs.components.components.push(duplicate);
    assert(
        validateComponents(catalogs).some((error) =>
            error.includes("duplicate canonical source ownership"),
        ),
    );
});

test("path escape, symlink, and special canonical sources fail", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-component-paths-"));
    try {
        mkdirSync(join(root, "source"));
        writeFileSync(join(root, "outside.txt"), "outside\n");
        symlinkSync("../outside.txt", join(root, "source/link"));
        execFileSync("mkfifo", [join(root, "source/fifo")]);
        const component = passiveStaticComponent(root, "outside.txt");
        component.canonicalSources[0].path = "../outside.txt";
        let errors = validateComponents(
            syntheticCatalog(root, component),
            root,
        );
        assert(errors.some((error) => error.includes("path is unsafe")));
        component.canonicalSources[0].path = "source/link";
        errors = validateComponents(syntheticCatalog(root, component), root);
        assert(errors.some((error) => error.includes("symlink")));
        component.canonicalSources[0].path = "source/fifo";
        errors = validateComponents(syntheticCatalog(root, component), root);
        assert(errors.some((error) => error.includes("not a regular file")));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("canonical and component digest drift fails", () => {
    const catalogs = load();
    const component = catalogs.components.components[0];
    component.canonicalSources[0].digest = "0".repeat(64);
    component.contentDigest = "0".repeat(64);
    const errors = validateComponents(catalogs);
    assert(
        errors.some((error) => error.includes("canonical source digest drift")),
    );
    assert(
        errors.some((error) =>
            error.includes("component content digest is stale"),
        ),
    );
});

test("unknown component dependency and evidence fail", () => {
    const catalogs = load();
    const component = catalogs.components.components[0];
    component.dependencies.push("unknown-component");
    component.approval.evidenceIds.push("unknown-evidence");
    const errors = validateComponents(catalogs);
    assert(
        errors.some((error) => error.includes("unknown component dependency")),
    );
    assert(
        errors.some((error) => error.includes("unknown component evidence")),
    );
});

test("unknown projection component, evidence, host, and artifact class fail", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections[0];
    projection.componentId = "unknown-component";
    projection.hostId = "unknown-host";
    projection.assuranceProfileId = "unknown-profile";
    projection.artifactClass = "unknown-artifact-class";
    projection.evidenceIds.push("unknown-evidence");
    const errors = projectionErrors(catalogs);
    assert(errors.some((error) => error.includes("unknown component")));
    assert(errors.some((error) => error.includes("unknown host")));
    assert(errors.some((error) => error.includes("unknown assurance profile")));
    assert(
        errors.some((error) => error.includes("unknown projection evidence")),
    );
});

test("an agent cannot be approximated as a portable plugin field", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) => candidate.projectedKind === "agent",
    );
    projection.hostId = "portable-agent-plugins-1-0";
    projection.artifactClass = "passive-public-package";
    projection.assuranceProfileId = "passive-public-package-v1";
    projection.state = "planned";
    projection.adapterType = "none";
    projection.outputPaths = [];
    const errors = projectionErrors(catalogs);
    assert(
        errors.some((error) =>
            error.includes(
                "accepts only skills and optional separately approved MCP",
            ),
        ),
    );
});

test("hook, MCP, and LSP components are rejected from passive artifacts", () => {
    const catalogs = load();
    const artifacts = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/artifacts.json"),
    );
    const base = catalogs.components.components.find(
        (component) => component.kind === "hook",
    );
    for (const [inventory, kind] of [
        ["hooks", "hook"],
        ["mcp", "mcp"],
        ["lsp", "lsp"],
    ]) {
        const component = clone(base);
        component.id = `fixture-${kind}`;
        component.kind = kind;
        catalogs.components.components.push(component);
        artifacts.artifacts[0].componentInventory[inventory].push(component.id);
    }
    const errors = validateArtifacts({ ...catalogs, artifacts });
    assert.equal(
        errors.filter((error) =>
            error.includes("passive artifact rejects executable component"),
        ).length,
        3,
    );
});

test("executable components require threat, security, assurance, and canary contracts", () => {
    const catalogs = load();
    const component = catalogs.components.components.find(
        (candidate) => candidate.kind === "hook",
    );
    component.securityRequirements = {
        threatModel: false,
        securityReview: false,
        executableAssuranceProfile: false,
    };
    component.requiredCanaries = [];
    const errors = validateComponents(catalogs);
    assert(errors.some((error) => error.includes("requires threat model")));
    assert(
        errors.some((error) => error.includes("requires threat-model canary")),
    );
    assert(
        errors.some((error) =>
            error.includes("requires security-review canary"),
        ),
    );
});

test("commands and prompts cannot conflate semantic identity", () => {
    const catalogs = load();
    const command = catalogs.components.components.find(
        (component) => component.kind === "command",
    );
    const prompt = catalogs.components.components.find(
        (component) =>
            component.kind === "prompt" &&
            component.canonicalSources[0].path ===
                command.canonicalSources[0].path,
    );
    command.semanticIdentity = prompt.semanticIdentity;
    const errors = validateComponents(catalogs);
    assert(
        errors.some((error) => error.includes("duplicate semantic identity")),
    );
    assert(errors.some((error) => error.includes("semantics are conflated")));
});

test("generated adapters cannot acquire canonical ownership", () => {
    const catalogs = load();
    const component = catalogs.components.components.find(
        (candidate) => candidate.kind === "agent",
    );
    component.canonicalSources[0].path = ".pi/agents/backend-developer.md";
    const errors = validateComponents(catalogs);
    assert(
        errors.some((error) =>
            error.includes(
                "generated adapter cannot be claimed as canonical source",
            ),
        ),
    );
});

test("projection state and host output boundary must agree", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) => candidate.hostId === "claude-code",
    );
    projection.hostId = "codex";
    let errors = projectionErrors(catalogs);
    assert(
        errors.some((error) => error.includes("does not match host boundary")),
    );
    projection.state = "planned";
    errors = projectionErrors(catalogs);
    assert(
        errors.some((error) =>
            error.includes(
                "planned or blocked projection cannot claim existing output",
            ),
        ),
    );
    const projectionCatalog = clone(load().projections);
    delete projectionCatalog.projections[0].state;
    const projectionSchema = readCatalog(
        join(defaultRepositoryRoot, componentCatalogPaths.projectionsSchema),
    );
    assert(
        validateAgainstSchema(
            projectionCatalog,
            projectionSchema,
            projectionSchema,
        ).some((error) => error.includes("missing required property state")),
    );
});

test("coordinated component ID rename still violates exact semantic anchors", () => {
    const catalogs = load();
    const component = catalogs.components.components.find(
        (candidate) => candidate.kind === "prompt",
    );
    const oldId = component.id;
    component.id = `${oldId}-renamed`;
    component.semanticIdentity = component.id;
    component.canonicalSources[0].ownerComponentId = component.id;
    for (const candidate of catalogs.components.components) {
        for (const source of candidate.canonicalSources) {
            if (source.ownerComponentId === oldId)
                source.ownerComponentId = component.id;
        }
    }
    const errors = validateComponents(catalogs);
    assert(
        errors.some((error) =>
            error.includes("stable identity anchor requires"),
        ),
    );
});

test("an additive passive component is accepted without granting eligibility", () => {
    const catalogs = load();
    const owner = catalogs.components.components.find(
        (component) => component.id === "cratis-rule-code-quality",
    );
    const additive = clone(owner);
    additive.id = "cratis-static-code-quality-reference";
    additive.semanticIdentity = additive.id;
    additive.semanticName = "Cratis static code quality reference";
    additive.kind = "static-asset";
    additive.canonicalSources[0].ownership = "shared-reference";
    additive.canonicalSources[0].ownerComponentId = owner.id;
    additive.classification.artifactClass = "static-asset";
    additive.classification.effect = "none";
    additive.allowedProjections = [];
    additive.forbiddenProjections = componentKinds.filter(
        (kind) => kind !== "static-asset",
    );
    additive.contentDigest = digestComponentSources(additive.canonicalSources);
    catalogs.components.declaredEmptyKinds =
        catalogs.components.declaredEmptyKinds.filter(
            (kind) => kind !== "static-asset",
        );
    catalogs.components.components.push(additive);
    assert.deepEqual(validateComponents(catalogs), []);
    assert.equal(additive.approval.state, "modeled");
});

test("stale generated component projection fails deterministic parity", () => {
    const catalogs = load();
    catalogs.generatedProjections.projections.pop();
    assert(
        validateGeneratedComponentCatalogs(
            catalogs.generatedComponents,
            catalogs.generatedProjections,
        ).some((error) => error.includes("projection catalog is stale")),
    );
});

test("component inventory cannot grant artifact runtime eligibility", () => {
    const catalogs = load();
    const artifacts = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/artifacts.json"),
    );
    const planned = artifacts.artifacts.find(
        (artifact) => !artifact.fixtureOnly,
    );
    planned.runtimeEligible = true;
    const hook = catalogs.components.components.find(
        (component) => component.kind === "hook",
    );
    planned.componentInventory.hooks.push(hook.id);
    const errors = validateArtifacts({ ...catalogs, artifacts });
    assert(
        errors.some((error) =>
            error.includes(
                "runtime eligibility requires materialization approval",
            ),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("passive artifact rejects executable component"),
        ),
    );
});

test("executable and passive components cannot share a package identity", () => {
    const catalogs = load();
    const passiveProjection = catalogs.projections.projections.find(
        (projection) =>
            catalogs.components.components.find(
                (component) => component.id === projection.componentId,
            )?.classification.passive,
    );
    const executableProjection = catalogs.projections.projections.find(
        (projection) => projection.componentId === "cratis-hooks",
    );
    passiveProjection.packageIdentity = "shared-package-fixture";
    executableProjection.packageIdentity = "shared-package-fixture";
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("cannot share package identity"),
        ),
    );
});
