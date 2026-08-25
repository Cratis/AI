// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "./catalog-validation.mjs";

export const componentCatalogPaths = Object.freeze({
    authoredComponents: "catalog/components.json",
    authoredProjections: "catalog/component-projections.json",
    componentsSchema: "catalog/schemas/components.schema.json",
    projectionsSchema: "catalog/schemas/component-projections.schema.json",
    generatedComponents: "catalog/v2/components.json",
    generatedProjections: "catalog/v2/component-projections.json",
    evidence: "catalog/v2/evidence.json",
    targets: "catalog/v2/targets.json",
    hostAdapters: "catalog/host-adapters.json",
    assuranceProfiles: "catalog/v2/artifact-assurance-profiles.json",
});

export const componentKinds = Object.freeze([
    "skill",
    "agent",
    "subagent",
    "command",
    "prompt",
    "rule",
    "instruction",
    "hook",
    "mcp",
    "lsp",
    "executable-host-extension",
    "static-asset",
]);

const executableKinds = new Set([
    "hook",
    "mcp",
    "lsp",
    "executable-host-extension",
]);
const passivePackageClasses = new Set([
    "passive-public-package",
    "passive-private-fixture",
]);
const executableCanaries = new Set([
    "threat-model",
    "security-review",
    "effect-boundary",
    "host-discovery",
]);
const privateProjectContextPrefixes = [
    ".agents/PROJECT.md",
    ".cratis/PROJECT.md",
    "Documentation/examples/private-repository-overlay/",
    "tooling/fixtures/project-context/",
];
const derivedCanonicalPrefixes = [
    ".agents/",
    ".claude/",
    ".github/agents/",
    ".github/instructions",
    ".github/prompts",
    ".github/skills",
    ".pi/agents/",
    "AGENTS.md",
];

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

function normalizedRepositoryPath(path) {
    if (typeof path !== "string" || path.length === 0 || isAbsolute(path))
        return false;
    const normalized = path.split("\\").join("/");
    return (
        normalized === path &&
        !path.startsWith("/") &&
        !path.split("/").includes("..") &&
        !path.split("/").includes(".")
    );
}

function pathWithin(path, root) {
    return path === root || path.startsWith(`${root}/`);
}

function regularFiles(root, sourcePath) {
    if (!normalizedRepositoryPath(sourcePath))
        throw new Error("path must be normalized and repository-relative");
    const absolute = join(root, sourcePath);
    const rootReal = realpathSync(root);
    const absoluteReal = realpathSync(absolute);
    if (
        absoluteReal !== rootReal &&
        !absoluteReal.startsWith(`${rootReal}${sep}`)
    )
        throw new Error("path escapes repository root");
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error("source path is a symlink");
    if (stat.isFile()) return [sourcePath];
    if (!stat.isDirectory())
        throw new Error("source path is not a regular file or directory");
    const files = [];
    const visit = (current) => {
        for (const entry of readdirSync(current).sort(compareOrdinal)) {
            const path = join(current, entry);
            const item = lstatSync(path);
            const repositoryPath = relative(root, path).split(sep).join("/");
            if (item.isSymbolicLink())
                throw new Error(`source contains symlink ${repositoryPath}`);
            if (item.isDirectory()) visit(path);
            else if (item.isFile()) files.push(repositoryPath);
            else
                throw new Error(
                    `source contains special path ${repositoryPath}`,
                );
        }
    };
    visit(absolute);
    return files.sort(compareOrdinal);
}

export function digestCanonicalSource(root, sourcePath) {
    const hash = createHash("sha256");
    for (const path of regularFiles(root, sourcePath)) {
        hash.update(path);
        hash.update("\0");
        hash.update(readFileSync(join(root, path)));
        hash.update("\0");
    }
    return hash.digest("hex");
}

export function digestComponentSources(sources) {
    const hash = createHash("sha256");
    for (const source of [...sources].sort((left, right) =>
        compareOrdinal(left.path, right.path),
    )) {
        hash.update(source.path);
        hash.update("\0");
        hash.update(source.digest);
        hash.update("\0");
    }
    return hash.digest("hex");
}

function expectedAnchoredId(component) {
    const paths = component.canonicalSources.map((source) => source.path);
    if (
        component.kind === "agent" &&
        paths.length === 1 &&
        paths[0].startsWith(".ai/agents/")
    )
        return `cratis-agent-${paths[0].split("/").at(-1).replace(/\.md$/, "")}`;
    if (
        (component.kind === "prompt" || component.kind === "command") &&
        paths.length === 1 &&
        paths[0].startsWith(".ai/prompts/")
    )
        return `cratis-${component.kind}-${paths[0]
            .split("/")
            .at(-1)
            .replace(/\.prompt\.md$/, "")}`;
    if (
        component.kind === "rule" &&
        paths.length === 1 &&
        paths[0].startsWith(".ai/rules/")
    )
        return `cratis-rule-${paths[0].split("/").at(-1).replace(/\.md$/, "").replaceAll(".", "-")}`;
    if (
        component.kind === "instruction" &&
        paths.length === 1 &&
        paths[0] === ".ai/rules/general.md"
    )
        return "cratis-instruction-general";
    if (
        component.kind === "hook" &&
        paths.length === 1 &&
        paths[0] === ".ai/hooks"
    )
        return "cratis-hooks";
    if (
        component.kind === "executable-host-extension" &&
        paths.length === 1 &&
        paths[0] === ".pi/extensions/cratis-hooks"
    )
        return "cratis-pi-hooks-extension";
    if (
        component.kind === "executable-host-extension" &&
        paths.length === 1 &&
        paths[0] === ".pi/extensions/subagent"
    )
        return "cratis-pi-subagent-extension";
    return null;
}

function allowanceMatches(component, host, projection) {
    return component.allowedProjections.some(
        (allowance) =>
            (allowance.hostContract === host.contract ||
                allowance.hostContract === "any-passive-host") &&
            allowance.kinds.includes(projection.projectedKind) &&
            allowance.artifactClasses.includes(projection.artifactClass),
    );
}

function projectionOutputMatchesHost(host, path) {
    return host.allowedOutputPrefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
}

function sourceSignature(component) {
    return component.canonicalSources
        .map((source) => `${source.path}:${source.digest}`)
        .sort(compareOrdinal)
        .join("|");
}

export function validateComponents(catalogs, root = defaultRepositoryRoot) {
    const errors = [];
    const { components: catalog, evidence, targets } = catalogs;
    const componentIds = new Set(
        catalog.components.map((component) => component.id),
    );
    const evidenceIds = new Set(evidence.evidence.map((record) => record.id));
    const targetIds = new Set(targets.targets.map((target) => target.id));
    for (const id of duplicates(
        catalog.components.map((component) => component.id),
    ))
        errors.push(`components contains duplicate component id ${id}`);
    for (const identity of duplicates(
        catalog.components.map((component) => component.semanticIdentity),
    ))
        errors.push(
            `components contains duplicate semantic identity ${identity}`,
        );
    const roots = catalog.canonicalSourceRoots;
    for (const rootPath of roots) {
        if (!normalizedRepositoryPath(rootPath))
            errors.push(`canonical source root is unsafe: ${rootPath}`);
        else if (!existsSync(join(root, rootPath)))
            errors.push(`canonical source root is missing: ${rootPath}`);
    }
    const ownership = new Map();
    const references = new Map();
    for (const component of catalog.components) {
        if (component.semanticIdentity !== component.id)
            errors.push(
                `${component.id}: semantic identity must equal its stable component id`,
            );
        const anchoredId = expectedAnchoredId(component);
        if (anchoredId && anchoredId !== component.id)
            errors.push(
                `${component.id}: stable identity anchor requires ${anchoredId}`,
            );
        if (component.kind === "skill" && !targetIds.has(component.id))
            errors.push(
                `${component.id}: skill component must retain an existing target id`,
            );
        if (component.kind !== "skill" && targetIds.has(component.id))
            errors.push(
                `${component.id}: non-skill component cannot reuse a skill target id`,
            );
        if (
            component.audience === "public" &&
            component.owner !== "public Cratis product capability"
        )
            errors.push(
                `${component.id}: public component requires public capability ownership`,
            );
        if (
            component.audience === "public" &&
            component.releaseBoundary !== "public-passive"
        )
            errors.push(
                `${component.id}: public component requires the public passive release boundary`,
            );
        if (
            component.audience === "cratis-engineering" &&
            component.releaseBoundary === "public-passive"
        )
            errors.push(
                `${component.id}: engineering component cannot enter the public release boundary`,
            );
        if (
            component.classification.passive ===
            component.classification.executable
        )
            errors.push(
                `${component.id}: passive and executable classifications must be opposites`,
            );
        if (
            (component.classification.trust === "executable") !==
            component.classification.executable
        )
            errors.push(
                `${component.id}: trust must match executable classification`,
            );
        if (
            (component.classification.artifactClass ===
                "executable-extension") !==
            component.classification.executable
        )
            errors.push(
                `${component.id}: artifact class must match executable classification`,
            );
        if (
            executableKinds.has(component.kind) !==
            component.classification.executable
        )
            errors.push(
                `${component.id}: component kind requires matching executable classification`,
            );
        if (
            component.classification.executable &&
            component.classification.effect !== "runtime-effect"
        )
            errors.push(
                `${component.id}: executable component requires runtime-effect classification`,
            );
        if (component.classification.executable) {
            if (component.releaseBoundary !== "future-executable-package")
                errors.push(
                    `${component.id}: executable component requires a separate future executable package boundary`,
                );
            if (component.approval.state !== "blocked")
                errors.push(
                    `${component.id}: executable component remains blocked until its separate approval lane completes`,
                );
            if (
                !component.securityRequirements.threatModel ||
                !component.securityRequirements.securityReview ||
                !component.securityRequirements.executableAssuranceProfile
            )
                errors.push(
                    `${component.id}: executable component requires threat model, security review, and executable assurance profile`,
                );
            for (const canary of executableCanaries)
                if (!component.requiredCanaries.includes(canary))
                    errors.push(
                        `${component.id}: executable component requires ${canary} canary`,
                    );
        }
        for (const dependency of component.dependencies)
            if (!componentIds.has(dependency))
                errors.push(
                    `${component.id}: unknown component dependency ${dependency}`,
                );
        for (const evidenceId of component.approval.evidenceIds)
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `${component.id}: unknown component evidence ${evidenceId}`,
                );
        for (const forbidden of component.forbiddenProjections) {
            if (
                component.allowedProjections.some((allowance) =>
                    allowance.kinds.includes(forbidden),
                )
            )
                errors.push(
                    `${component.id}: projection kind ${forbidden} is both allowed and forbidden`,
                );
        }
        for (const source of component.canonicalSources) {
            if (!normalizedRepositoryPath(source.path)) {
                errors.push(
                    `${component.id}: canonical source path is unsafe: ${source.path}`,
                );
                continue;
            }
            if (
                derivedCanonicalPrefixes.some(
                    (prefix) =>
                        source.path === prefix ||
                        source.path.startsWith(prefix),
                )
            )
                errors.push(
                    `${component.id}: generated adapter cannot be claimed as canonical source: ${source.path}`,
                );
            if (
                privateProjectContextPrefixes.some(
                    (prefix) =>
                        source.path === prefix ||
                        source.path.startsWith(prefix),
                )
            )
                errors.push(
                    `${component.id}: private project context cannot become a catalog component source: ${source.path}`,
                );
            if (
                !roots.some(
                    (rootPath) =>
                        pathWithin(source.path, rootPath) ||
                        pathWithin(rootPath, source.path),
                )
            )
                errors.push(
                    `${component.id}: canonical source is outside declared roots: ${source.path}`,
                );
            try {
                const digest = digestCanonicalSource(root, source.path);
                if (digest !== source.digest)
                    errors.push(
                        `${component.id}: canonical source digest drift for ${source.path}`,
                    );
                const files = regularFiles(root, source.path);
                for (const file of files) {
                    const referencesForPath = references.get(file) ?? [];
                    referencesForPath.push(component.id);
                    references.set(file, referencesForPath);
                    if (source.ownership === "owner") {
                        const owners = ownership.get(file) ?? [];
                        owners.push(component.id);
                        ownership.set(file, owners);
                    }
                }
            } catch (error) {
                errors.push(
                    `${component.id}: canonical source failed for ${source.path}: ${error.message}`,
                );
            }
            if (
                source.ownership === "owner" &&
                source.ownerComponentId !== component.id
            )
                errors.push(
                    `${component.id}: owned source must name its owning component`,
                );
            if (
                source.ownership === "shared-reference" &&
                source.ownerComponentId === component.id
            )
                errors.push(
                    `${component.id}: shared source must name another owner`,
                );
            if (!componentIds.has(source.ownerComponentId))
                errors.push(
                    `${component.id}: source references unknown owner ${source.ownerComponentId}`,
                );
        }
        if (
            digestComponentSources(component.canonicalSources) !==
            component.contentDigest
        )
            errors.push(`${component.id}: component content digest is stale`);
    }
    for (const rootPath of roots) {
        try {
            for (const file of regularFiles(root, rootPath)) {
                const owners = ownership.get(file) ?? [];
                if (owners.length === 0)
                    errors.push(`orphan canonical source ${file}`);
                if (owners.length > 1)
                    errors.push(
                        `duplicate canonical source ownership ${file}: ${owners.join(", ")}`,
                    );
            }
        } catch (error) {
            errors.push(
                `canonical source root failed for ${rootPath}: ${error.message}`,
            );
        }
    }
    for (const component of catalog.components) {
        for (const source of component.canonicalSources) {
            const owner = catalog.components.find(
                (candidate) => candidate.id === source.ownerComponentId,
            );
            if (
                !owner ||
                !owner.canonicalSources.some(
                    (candidate) =>
                        candidate.path === source.path &&
                        candidate.ownership === "owner" &&
                        candidate.digest === source.digest,
                )
            )
                errors.push(
                    `${component.id}: source owner does not own identical canonical bytes for ${source.path}`,
                );
        }
    }
    const countsByKind = Object.fromEntries(
        componentKinds.map((kind) => [
            kind,
            catalog.components.filter((component) => component.kind === kind)
                .length,
        ]),
    );
    for (const kind of catalog.declaredEmptyKinds)
        if (countsByKind[kind] !== 0)
            errors.push(
                `declared empty component kind ${kind} contains entries`,
            );
    for (const kind of componentKinds)
        if (
            countsByKind[kind] === 0 &&
            !catalog.declaredEmptyKinds.includes(kind)
        )
            errors.push(
                `empty component kind ${kind} must be declared explicitly`,
            );
    const promptsBySource = new Map(
        catalog.components
            .filter((component) => component.kind === "prompt")
            .map((component) => [sourceSignature(component), component]),
    );
    for (const command of catalog.components.filter(
        (component) => component.kind === "command",
    )) {
        const prompt = promptsBySource.get(sourceSignature(command));
        if (prompt && prompt.semanticIdentity === command.semanticIdentity)
            errors.push(
                `${command.id}: command and prompt semantics are conflated`,
            );
    }
    return errors;
}

export function validateComponentProjections(
    catalogs,
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const { components, projections, evidence, assuranceProfiles } = catalogs;
    const componentsById = new Map(
        components.components.map((component) => [component.id, component]),
    );
    const hostsById = new Map(projections.hosts.map((host) => [host.id, host]));
    const evidenceIds = new Set(evidence.evidence.map((record) => record.id));
    const profilesById = new Map(
        assuranceProfiles.profiles.map((profile) => [profile.id, profile]),
    );
    for (const id of duplicates(projections.hosts.map((host) => host.id)))
        errors.push(`component projection hosts contains duplicate id ${id}`);
    for (const id of duplicates(
        projections.projections.map((projection) => projection.id),
    ))
        errors.push(`component projections contains duplicate id ${id}`);
    for (const host of projections.hosts)
        for (const evidenceId of host.evidenceIds)
            if (!evidenceIds.has(evidenceId))
                errors.push(`${host.id}: unknown host evidence ${evidenceId}`);
    const packageTrust = new Map();
    for (const projection of projections.projections) {
        const component = componentsById.get(projection.componentId);
        const host = hostsById.get(projection.hostId);
        const profile = profilesById.get(projection.assuranceProfileId);
        if (!component)
            errors.push(
                `${projection.id}: unknown component ${projection.componentId}`,
            );
        if (!host)
            errors.push(`${projection.id}: unknown host ${projection.hostId}`);
        if (!profile)
            errors.push(
                `${projection.id}: unknown assurance profile ${projection.assuranceProfileId}`,
            );
        else if (profile.artifactClass !== projection.artifactClass)
            errors.push(
                `${projection.id}: projection artifact class does not match assurance profile`,
            );
        for (const evidenceId of projection.evidenceIds)
            if (!evidenceIds.has(evidenceId))
                errors.push(
                    `${projection.id}: unknown projection evidence ${evidenceId}`,
                );
        if (component && host && !allowanceMatches(component, host, projection))
            errors.push(
                `${projection.id}: projection is not explicitly allowed by the component contract`,
            );
        if (component?.forbiddenProjections.includes(projection.projectedKind))
            errors.push(
                `${projection.id}: projection kind is explicitly forbidden`,
            );
        if (host?.contract === "portable-agent-plugins-1-0") {
            if (!new Set(["skill", "mcp"]).has(projection.projectedKind))
                errors.push(
                    `${projection.id}: portable Agent Plugins 1.0 accepts only skills and optional separately approved MCP`,
                );
            if (
                projection.projectedKind === "mcp" &&
                (projection.approval !== "approved" ||
                    component?.approval.state !== "approved")
            )
                errors.push(
                    `${projection.id}: portable MCP requires separate component and projection approval`,
                );
        }
        if (projection.state === "existing") {
            if (
                projection.outputPaths.length === 0 ||
                projection.adapterType === "none"
            )
                errors.push(
                    `${projection.id}: existing projection requires explicit adapter output`,
                );
            for (const path of projection.outputPaths) {
                if (normalizedRepositoryPath(path)) {
                    if (host && !projectionOutputMatchesHost(host, path))
                        errors.push(
                            `${projection.id}: projection output does not match host boundary: ${path}`,
                        );
                    if (!existsSync(join(root, path)))
                        errors.push(
                            `${projection.id}: existing projection output is missing: ${path}`,
                        );
                } else
                    errors.push(
                        `${projection.id}: projection output path is unsafe: ${path}`,
                    );
            }
        } else if (
            projection.outputPaths.length > 0 ||
            projection.adapterType !== "none"
        )
            errors.push(
                `${projection.id}: planned or blocked projection cannot claim existing output`,
            );
        if (component?.classification.executable) {
            if (passivePackageClasses.has(projection.artifactClass))
                errors.push(
                    `${projection.id}: passive package rejects executable component kind ${component.kind}`,
                );
            if (
                !profile ||
                profile.passivePublic ||
                (profile.components.execution !== "allow" &&
                    profile.components.execution !== "require")
            )
                errors.push(
                    `${projection.id}: executable component requires executable assurance profile`,
                );
            for (const requirement of [
                "threat-model",
                "security-review",
                "effect-boundary",
            ])
                if (!projection.securityRequirements.includes(requirement))
                    errors.push(
                        `${projection.id}: executable projection requires ${requirement}`,
                    );
            for (const canary of executableCanaries)
                if (!projection.requiredCanaries.includes(canary))
                    errors.push(
                        `${projection.id}: executable projection requires ${canary} canary`,
                    );
        } else if (
            profile &&
            !profile.passivePublic &&
            passivePackageClasses.has(projection.artifactClass) === false &&
            projection.artifactClass === "executable-plugin-package"
        )
            errors.push(
                `${projection.id}: passive component cannot silently enter executable package identity`,
            );
        if (projection.packageIdentity) {
            const trust = component?.classification.trust;
            const prior = packageTrust.get(projection.packageIdentity);
            if (prior && prior !== trust)
                errors.push(
                    `${projection.id}: executable and passive components cannot share package identity ${projection.packageIdentity}`,
                );
            else packageTrust.set(projection.packageIdentity, trust);
        }
    }
    return errors;
}

function generatedPayload(authored, generatedBy, sourceDigest) {
    const { schemaVersion: _schemaVersion, ...payload } = authored;
    return { schemaVersion: 2, generatedBy, sourceDigest, ...payload };
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function parseAuthoredCatalog(bytes, path) {
    try {
        return JSON.parse(bytes);
    } catch (error) {
        throw new Error(`Invalid authored component catalog JSON: ${path}`, {
            cause: error,
        });
    }
}

export function expectedGeneratedComponentCatalogs(
    root = defaultRepositoryRoot,
) {
    const componentBytes = readFileSync(
        join(root, componentCatalogPaths.authoredComponents),
    );
    const projectionBytes = readFileSync(
        join(root, componentCatalogPaths.authoredProjections),
    );
    return {
        components: generatedPayload(
            parseAuthoredCatalog(
                componentBytes,
                componentCatalogPaths.authoredComponents,
            ),
            "tooling/generate-component-catalogs.mjs",
            sha256(componentBytes),
        ),
        projections: generatedPayload(
            parseAuthoredCatalog(
                projectionBytes,
                componentCatalogPaths.authoredProjections,
            ),
            "tooling/generate-component-catalogs.mjs",
            sha256(projectionBytes),
        ),
    };
}

export function validateGeneratedComponentCatalogs(
    generatedComponents,
    generatedProjections,
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const expected = expectedGeneratedComponentCatalogs(root);
    if (
        JSON.stringify(generatedComponents) !==
        JSON.stringify(expected.components)
    )
        errors.push("generated component catalog is stale");
    if (
        JSON.stringify(generatedProjections) !==
        JSON.stringify(expected.projections)
    )
        errors.push("generated component projection catalog is stale");
    return errors;
}

export function validateComponentCatalogs(root = defaultRepositoryRoot) {
    const errors = [];
    let authoredComponents;
    let authoredProjections;
    let generatedComponents;
    let generatedProjections;
    let evidence;
    let targets;
    let assuranceProfiles;
    try {
        authoredComponents = readCatalog(
            join(root, componentCatalogPaths.authoredComponents),
        );
        authoredProjections = readCatalog(
            join(root, componentCatalogPaths.authoredProjections),
        );
        generatedComponents = readCatalog(
            join(root, componentCatalogPaths.generatedComponents),
        );
        generatedProjections = readCatalog(
            join(root, componentCatalogPaths.generatedProjections),
        );
        evidence = readCatalog(join(root, componentCatalogPaths.evidence));
        targets = readCatalog(join(root, componentCatalogPaths.targets));
        assuranceProfiles = readCatalog(
            join(root, componentCatalogPaths.assuranceProfiles),
        );
        const componentsSchema = readCatalog(
            join(root, componentCatalogPaths.componentsSchema),
        );
        const projectionsSchema = readCatalog(
            join(root, componentCatalogPaths.projectionsSchema),
        );
        errors.push(
            ...validateAgainstSchema(
                authoredComponents,
                componentsSchema,
                componentsSchema,
            ).map(
                (error) =>
                    `${componentCatalogPaths.authoredComponents} ${error}`,
            ),
        );
        errors.push(
            ...validateAgainstSchema(
                authoredProjections,
                projectionsSchema,
                projectionsSchema,
            ).map(
                (error) =>
                    `${componentCatalogPaths.authoredProjections} ${error}`,
            ),
        );
    } catch (error) {
        return [error.message];
    }
    if (errors.length > 0) return errors;
    const catalogs = {
        components: authoredComponents,
        projections: authoredProjections,
        evidence,
        targets,
        assuranceProfiles,
    };
    errors.push(...validateComponents(catalogs, root));
    errors.push(...validateComponentProjections(catalogs, root));
    errors.push(
        ...validateGeneratedComponentCatalogs(
            generatedComponents,
            generatedProjections,
            root,
        ),
    );
    return errors;
}
