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
        hostAdapters: readCatalog(
            join(defaultRepositoryRoot, componentCatalogPaths.hostAdapters),
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
        lifecycle: "active",
        distributionTargetId: null,
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

function syntheticCatalog(component) {
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
    assert.equal(counts.skill, 49);
    assert.equal(counts.agent, 12);
    assert.equal(counts.command, 18);
    assert.equal(counts.prompt, 18);
    assert.equal(counts.rule, 36);
    assert.equal(counts.instruction, 1);
    assert.equal(counts.hook, 1);
    assert.equal(counts["executable-host-extension"], 2);
    assert.equal(counts.mcp, 0);
    assert.equal(counts.lsp, 0);
    assert(components.declaredEmptyKinds.includes("mcp"));
    assert(components.declaredEmptyKinds.includes("lsp"));
    assert(
        components.components.every(
            (component) =>
                component.hostNeutralPurpose !== ">" &&
                component.hostNeutralPurpose.trim().length > 1,
        ),
    );
});

test("Chronicle MCP product guidance is a passive skill, not an MCP component", () => {
    const catalogs = load();
    const guidance = catalogs.components.components.find(
        (component) => component.id === "cratis-chronicle-mcp-inspection",
    );
    assert.equal(guidance.kind, "skill");
    assert.equal(guidance.classification.effect, "guided-read");
    assert.equal(guidance.classification.executable, false);
    assert.equal(guidance.approval.state, "modeled");
    assert.equal(
        catalogs.components.components.filter(
            (component) => component.kind === "mcp",
        ).length,
        0,
    );
    assert.equal(
        catalogs.projections.projections.filter(
            (projection) => projection.componentId === guidance.id,
        ).length,
        0,
    );
});

test("Studio MCP guidance is a passive unprojected skill without MCP components", () => {
    const catalogs = load();
    const guidance = catalogs.components.components.find(
        (component) => component.id === "cratis-studio-mcp-safety-guidance",
    );
    assert.equal(guidance.kind, "skill");
    assert.equal(guidance.classification.effect, "guided-read");
    assert.equal(guidance.classification.executable, false);
    assert.equal(guidance.approval.state, "modeled");
    assert.equal(
        catalogs.projections.projections.filter(
            (projection) => projection.componentId === guidance.id,
        ).length,
        0,
    );
    assert.equal(
        catalogs.components.components.filter(
            (component) => component.kind === "mcp",
        ).length,
        0,
    );
});

test("S8 adds exactly 70 passive generated-static non-skill projections", () => {
    const catalogs = load();
    const generated = catalogs.projections.projections.filter(
        (projection) => projection.state === "generated-static",
    );
    assert.equal(catalogs.projections.hosts.length, 9);
    assert.equal(catalogs.projections.projections.length, 386);
    assert.equal(
        catalogs.projections.projections.filter(
            (projection) => projection.state === "existing",
        ).length,
        316,
    );
    assert.equal(generated.length, 70);
    assert.equal(
        generated.filter((projection) => projection.projectedKind === "rule")
            .length,
        68,
    );
    assert.equal(
        generated.filter(
            (projection) => projection.projectedKind === "instruction",
        ).length,
        2,
    );
    assert(
        generated.every(
            (projection) =>
                projection.adapterType === "generated" &&
                projection.hostActivation === "none" &&
                projection.packageIdentity === null &&
                projection.approval === "modeled",
        ),
    );
});

test("S8 generated-static projections reject kind, path, package, and evidence drift", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) => candidate.state === "generated-static",
    );
    projection.packageIdentity = "fabricated-package";
    projection.outputPaths = [
        "jetbrains-ai-assistant-rules/.aiassistant/rules/general.md",
    ];
    let errors = projectionErrors(catalogs);
    assert(
        errors.some((error) =>
            error.includes("generated-static projection contract changed"),
        ),
    );
    assert(
        errors.some((error) =>
            error.includes("semantic kind, source, or output mapping changed"),
        ),
    );

    const expired = load();
    const generated = expired.projections.projections.find(
        (candidate) => candidate.state === "generated-static",
    );
    expired.evidence.evidence.find(
        (record) => record.id === generated.evidenceIds[0],
    ).expiresOn = "2026-08-24";
    errors = projectionErrors(expired);
    assert(
        errors.some((error) => error.includes("expired projection evidence")),
    );

    const hostDrift = load();
    const host = hostDrift.projections.hosts.find(
        (candidate) => candidate.id === "jetbrains-ai-assistant",
    );
    host.staticOutputRoot = "wrong-root";
    errors = projectionErrors(hostDrift);
    assert(
        errors.some((error) =>
            error.includes("static fixture host contract changed"),
        ),
    );
});

test("retained legacy host skills are explicit unbound components", () => {
    const catalogs = load();
    const legacy = catalogs.components.components.filter(
        (component) => component.lifecycle === "legacy-retained",
    );
    assert.equal(legacy.length, 4);
    assert(
        legacy.every(
            (component) =>
                component.kind === "skill" &&
                component.distributionTargetId === null &&
                component.releaseBoundary === "repository-only",
        ),
    );
    for (const component of legacy)
        for (const hostId of ["claude-code", "codex", "github-copilot"])
            assert(
                catalogs.projections.projections.some(
                    (projection) =>
                        projection.componentId === component.id &&
                        projection.hostId === hostId &&
                        projection.hostActivation === "active",
                ),
            );
});

test("an orphan canonical source fails exact closure", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-component-orphan-"));
    try {
        mkdirSync(join(root, "source"));
        writeFileSync(join(root, "source/owned.txt"), "owned\n");
        writeFileSync(join(root, "source/orphan.txt"), "orphan\n");
        const catalogs = syntheticCatalog(passiveStaticComponent(root));
        assert(
            validateComponents(catalogs, root).some((error) =>
                error.includes("orphan canonical source source/orphan.txt"),
            ),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("a declared root cannot be a child of a broader canonical source", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-component-boundary-"));
    try {
        mkdirSync(join(root, "source"));
        writeFileSync(join(root, "source/owned.txt"), "owned\n");
        const component = passiveStaticComponent(root, "source");
        const catalogs = syntheticCatalog(component);
        catalogs.components.canonicalSourceRoots = ["source/owned.txt"];
        assert(
            validateComponents(catalogs, root).some((error) =>
                error.includes("canonical source is outside declared roots"),
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
        let errors = validateComponents(syntheticCatalog(component), root);
        assert(errors.some((error) => error.includes("path is unsafe")));
        component.canonicalSources[0].path = "source/link";
        errors = validateComponents(syntheticCatalog(component), root);
        assert(errors.some((error) => error.includes("symlink")));
        component.canonicalSources[0].path = "source/fifo";
        errors = validateComponents(syntheticCatalog(component), root);
        assert(errors.some((error) => error.includes("not a regular file")));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("distribution target bindings are exact and legacy components stay unbound", () => {
    const catalogs = load();
    const bound = catalogs.components.components.find(
        (component) => component.distributionTargetId !== null,
    );
    bound.distributionTargetId = null;
    const legacy = catalogs.components.components.find(
        (component) => component.lifecycle === "legacy-retained",
    );
    legacy.distributionTargetId = legacy.id;
    const errors = validateComponents(catalogs);
    assert(errors.some((error) => error.includes("retain its target binding")));
    assert(errors.some((error) => error.includes("legacy-retained component")));
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
    projection.hostActivation = "none";
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

test("additive components require an independently reviewed anchor update", () => {
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
    assert(
        validateComponents(catalogs).some((error) =>
            error.includes("independently reviewed anchor"),
        ),
    );
    assert.equal(additive.approval.state, "modeled");
});

test("coordinated projection host and adapter mutations fail independent anchors", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections[0];
    projection.id = `${projection.id}-renamed`;
    projection.adapterType = "generated";
    const host = catalogs.projections.hosts[0];
    const oldHostId = host.id;
    host.id = `${host.id}-renamed`;
    for (const candidate of catalogs.projections.projections)
        if (candidate.hostId === oldHostId) candidate.hostId = host.id;
    const errors = projectionErrors(catalogs);
    assert(
        errors.some((error) => error.includes("projection semantic contract")),
    );
    assert(errors.some((error) => error.includes("projection host contract")));
});

test("duplicate semantic projection records fail even with distinct IDs", () => {
    const catalogs = load();
    const duplicate = clone(catalogs.projections.projections[0]);
    duplicate.id = `${duplicate.id}-duplicate`;
    catalogs.projections.projections.push(duplicate);
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("duplicate semantic projection"),
        ),
    );
});

test("host output and shared symlink closure reject unmodeled exposure", () => {
    const catalogs = load();
    catalogs.projections.projections = catalogs.projections.projections.filter(
        (projection) =>
            !(
                projection.componentId === "cratis-legacy-add-concept" &&
                projection.hostId === "claude-code"
            ),
    );
    let errors = projectionErrors(catalogs);
    assert(
        errors.some((error) =>
            error.includes("exact component projection coverage"),
        ),
    );

    const missingOutput = load();
    missingOutput.projections.projections =
        missingOutput.projections.projections.filter(
            (projection) =>
                !projection.outputPaths.includes(
                    ".github/copilot-instructions.md",
                ),
        );
    errors = projectionErrors(missingOutput);
    assert(
        errors.some((error) =>
            error.includes("actual host adapter outputs do not match"),
        ),
    );

    const implicitSharing = load();
    const claude = implicitSharing.projections.hosts.find(
        (host) => host.id === "claude-code",
    );
    claude.sharedSymlinkOutputs = claude.sharedSymlinkOutputs.filter(
        (path) => path !== ".claude/skills",
    );
    errors = projectionErrors(implicitSharing);
    assert(
        errors.some((error) =>
            error.includes("shared output is not explicitly declared"),
        ),
    );
});

test("Pi prompt and canonical executable exposures are completely modeled", () => {
    const catalogs = load();
    const piPrompts = catalogs.projections.projections.filter(
        (projection) =>
            projection.hostId === "pi" &&
            projection.projectedKind === "prompt" &&
            projection.hostActivation === "active",
    );
    assert.equal(piPrompts.length, 18);
    assert(
        piPrompts.every(
            (projection) =>
                projection.adapterType === "symlink" &&
                projection.outputPaths[0].startsWith(".pi/prompts/"),
        ),
    );
    const executable = catalogs.projections.projections.filter(
        (projection) =>
            projection.hostId === "pi" &&
            projection.projectedKind === "executable-host-extension",
    );
    assert.equal(executable.length, 2);
    assert(
        executable.every(
            (projection) =>
                projection.state === "existing" &&
                projection.hostActivation === "active" &&
                projection.adapterType === "canonical-in-place" &&
                projection.approval === "blocked" &&
                projection.packageIdentity === null,
        ),
    );
});

test("symlink projection closure rejects canonical bytes outside its target", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) =>
            candidate.hostId === "claude-code" &&
            candidate.projectedKind === "subagent" &&
            candidate.adapterType === "symlink",
    );
    const component = catalogs.components.components.find(
        (candidate) => candidate.id === projection.componentId,
    );
    const outside = catalogs.components.components.find(
        (candidate) => candidate.kind === "rule",
    ).canonicalSources[0];
    component.canonicalSources.push(clone(outside));
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("does not expose all component canonical bytes"),
        ),
    );
});

test("canonical-in-place exposure must cover every component source file", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) =>
            candidate.adapterType === "canonical-in-place" &&
            candidate.outputPaths.length > 1,
    );
    projection.outputPaths.pop();
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("do not exactly match component source bytes"),
        ),
    );
});

test("path-reference records are explicitly inert rather than host behavior", () => {
    const catalogs = load();
    const references = catalogs.projections.projections.filter(
        (projection) => projection.adapterType === "path-reference",
    );
    assert.equal(references.length, 3);
    assert(
        references.every((projection) => projection.hostActivation === "inert"),
    );
    references[0].hostActivation = "active";
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("requires inert host activation"),
        ),
    );
});

test("portable hosts cannot opt into the native passive wildcard", () => {
    const catalogs = load();
    const portable = catalogs.projections.hosts.find(
        (host) => host.contract === "portable-agent-plugins-1-0",
    );
    portable.acceptsAnyPassiveProjection = true;
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("cannot accept the native passive-host wildcard"),
        ),
    );
});

test("declared adapter types must match real repository paths", () => {
    const catalogs = load();
    const projection = catalogs.projections.projections.find(
        (candidate) => candidate.adapterType === "path-reference",
    );
    projection.adapterType = "symlink";
    assert(
        projectionErrors(catalogs).some((error) =>
            error.includes("declared symlink adapter is not a symlink"),
        ),
    );
});

test("canonical roots ownership direction and portable kind cannot be coordinated away", () => {
    const catalogs = load();
    catalogs.components.canonicalSourceRoots.push(".ai/rules/general.md");
    let errors = validateComponents(catalogs);
    assert(errors.some((error) => error.includes("source roots overlap")));

    const command = catalogs.components.components.find(
        (component) => component.kind === "command",
    );
    const prompt = catalogs.components.components.find(
        (component) =>
            component.id === command.canonicalSources[0].ownerComponentId,
    );
    command.canonicalSources[0].ownership = "owner";
    command.canonicalSources[0].ownerComponentId = command.id;
    prompt.canonicalSources[0].ownership = "shared-reference";
    prompt.canonicalSources[0].ownerComponentId = command.id;
    errors = validateComponents(catalogs);
    assert(errors.some((error) => error.includes("prompt must own")));
    assert(errors.some((error) => error.includes("command must share")));

    const projectionCatalogs = load();
    const agent = projectionCatalogs.components.components.find(
        (component) => component.kind === "agent",
    );
    const portable = {
        ...clone(
            projectionCatalogs.projections.projections.find(
                (projection) => projection.componentId === agent.id,
            ),
        ),
        id: "fabricated-portable-agent-projection",
        hostId: "portable-agent-plugins-1-0",
        projectedKind: "skill",
        state: "blocked",
        hostActivation: "none",
        adapterType: "none",
        outputPaths: [],
    };
    projectionCatalogs.projections.projections.push(portable);
    agent.allowedProjections.push({
        hostContract: "portable-agent-plugins-1-0",
        kinds: ["skill"],
        artifactClasses: [portable.artifactClass],
    });
    agent.forbiddenProjections = agent.forbiddenProjections.filter(
        (kind) => kind !== "skill",
    );
    assert(
        projectionErrors(projectionCatalogs).some((error) =>
            error.includes("canonical component kind is not portable"),
        ),
    );
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

test("fixture component inventories bind exact canonical bytes", () => {
    const catalogs = load();
    const artifacts = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/artifacts.json"),
    );
    const fixture = artifacts.artifacts.find(
        (artifact) => artifact.id === "cratis-fundamentals-concept-preview",
    );
    fixture.componentInventory.skills.push("cratis-arc-command");
    assert(
        validateArtifacts({ ...catalogs, artifacts }).some((error) =>
            error.includes("complete component byte inventory"),
        ),
    );
});

test("artifact byte validation honors the caller repository root", () => {
    const catalogs = load();
    const artifacts = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/artifacts.json"),
    );
    const root = mkdtempSync(join(tmpdir(), "cratis-artifact-root-"));
    try {
        assert(
            validateArtifacts({ ...catalogs, artifacts }, root).some((error) =>
                error.includes("component byte inventory failed"),
            ),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("non-materialized artifacts cannot claim exact source bytes", () => {
    const catalogs = load();
    const artifacts = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/artifacts.json"),
    );
    const planned = artifacts.artifacts.find(
        (artifact) => !artifact.fixtureOnly,
    );
    planned.exactSourcePaths.push("skills/cratis-arc-command/SKILL.md");
    assert(
        validateArtifacts({ ...catalogs, artifacts }).some((error) =>
            error.includes("cannot claim exact source bytes"),
        ),
    );
});

test("runtime-effect classification cannot remain passive", () => {
    const catalogs = load();
    const passive = catalogs.components.components.find(
        (component) => component.classification.passive,
    );
    passive.classification.effect = "runtime-effect";
    assert(
        validateComponents(catalogs).some((error) =>
            error.includes("runtime-effect and executable"),
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
