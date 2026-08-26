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
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
    artifacts: "catalog/v2/artifacts.json",
});

const expectedComponentAnchor =
    "293461cd41ae39e761cebc9afb75442401aef69efec4059c02f07f10f277a951";
const expectedProjectionAnchor =
    "390dae84371d1682cac9efdb3c99ea36cfb1582823c3a8d9ebc841c6f50f6ebe";
const expectedProjectionHostAnchor =
    "9735e6fd6a1b15e92086df6fda6cb4a988094c37c26e11bddf0518d5d3fdeba2";

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
const staticFixtureHostContracts = new Map([
    [
        "jetbrains-ai-assistant",
        {
            adapterId: "jetbrains-ai-assistant-host-adapter",
            outputRoot: "jetbrains-ai-assistant-rules",
            discoveryRoot: ".aiassistant/rules/",
            kind: "rule",
            evidenceId: "jetbrains-ai-assistant-source-1",
        },
    ],
    [
        "tabnine",
        {
            adapterId: "tabnine-host-adapter",
            outputRoot: "tabnine-guidelines",
            discoveryRoot: ".tabnine/guidelines/",
            kind: "rule",
            evidenceId: "tabnine-source-1",
        },
    ],
    [
        "visual-studio-copilot",
        {
            adapterId: "visual-studio-copilot-host-adapter",
            outputRoot: "visual-studio-copilot-instructions",
            discoveryRoot: ".github/copilot-instructions.md",
            kind: "instruction",
            evidenceId: "visual-studio-copilot-source-2",
        },
    ],
    [
        "devin-hosted",
        {
            adapterId: "devin-hosted-host-adapter",
            outputRoot: "devin-hosted-instructions",
            discoveryRoot: "AGENTS.md",
            kind: "instruction",
            evidenceId: "devin-hosted-source-2",
        },
    ],
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

function semanticAnchor(records) {
    const lines = [...records]
        .sort((left, right) => compareOrdinal(left.id, right.id))
        .map((record) => JSON.stringify(record));
    return createHash("sha256").update(`${lines.join("\n")}\n`).digest("hex");
}

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

export function regularFiles(root, sourcePath) {
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

function adapterLeaves(root, outputPath) {
    if (!normalizedRepositoryPath(outputPath))
        throw new Error("adapter path must be normalized and repository-relative");
    const absolute = join(root, outputPath);
    const stat = lstatSync(absolute);
    if (stat.isFile() || stat.isSymbolicLink()) return [outputPath];
    if (!stat.isDirectory())
        throw new Error("adapter path is not a file, directory, or symlink");
    const leaves = [];
    const visit = (current) => {
        for (const entry of readdirSync(current).sort(compareOrdinal)) {
            const path = join(current, entry);
            const item = lstatSync(path);
            const repositoryPath = relative(root, path).split(sep).join("/");
            if (item.isDirectory() && !item.isSymbolicLink()) visit(path);
            else if (item.isFile() || item.isSymbolicLink())
                leaves.push(repositoryPath);
            else
                throw new Error(
                    `adapter contains special path ${repositoryPath}`,
                );
        }
    };
    visit(absolute);
    return leaves.sort(compareOrdinal);
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
                (allowance.hostContract === "any-passive-host" &&
                    host.acceptsAnyPassiveProjection &&
                    component.classification.passive)) &&
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
    if (semanticAnchor(catalog.components) !== expectedComponentAnchor)
        errors.push(
            "component semantic contract differs from the independently reviewed anchor",
        );
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
    for (let index = 0; index < roots.length; index++)
        for (let other = index + 1; other < roots.length; other++)
            if (
                pathWithin(roots[index], roots[other]) ||
                pathWithin(roots[other], roots[index])
            )
                errors.push(
                    `canonical source roots overlap: ${roots[index]} and ${roots[other]}`,
                );
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
        if (
            component.distributionTargetId !== null &&
            (component.kind !== "skill" ||
                component.distributionTargetId !== component.id ||
                !targetIds.has(component.distributionTargetId))
        )
            errors.push(
                `${component.id}: distribution target binding must reference the same skill target id`,
            );
        if (
            targetIds.has(component.id) &&
            component.distributionTargetId !== component.id
        )
            errors.push(
                `${component.id}: target-backed component must retain its target binding`,
            );
        if (
            component.lifecycle === "legacy-retained" &&
            (component.distributionTargetId !== null ||
                component.releaseBoundary !== "repository-only" ||
                component.approval.state === "approved")
        )
            errors.push(
                `${component.id}: legacy-retained component must remain unbound, repository-only, and unapproved`,
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
            (component.classification.effect === "runtime-effect") !==
            component.classification.executable
        )
            errors.push(
                `${component.id}: runtime-effect and executable classifications must match`,
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
                !roots.some((rootPath) =>
                    pathWithin(source.path, rootPath),
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
    const targetBindings = catalog.components
        .map((component) => component.distributionTargetId)
        .filter((targetId) => targetId !== null);
    for (const targetId of duplicates(targetBindings))
        errors.push(`multiple components bind distribution target ${targetId}`);
    for (const targetId of targetIds)
        if (!targetBindings.includes(targetId))
            errors.push(`distribution target has no component binding ${targetId}`);
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
    for (const watchedRoot of [
        ".ai/agents",
        ".ai/hooks",
        ".ai/prompts",
        ".ai/rules",
        ".ai/skills",
        ".pi/extensions",
        "engineering/skills",
        "skills",
    ]) {
        if (!existsSync(join(root, watchedRoot))) continue;
        try {
            for (const file of regularFiles(root, watchedRoot)) {
                if ((ownership.get(file) ?? []).length === 0)
                    errors.push(`unmodeled canonical source ${file}`);
            }
        } catch (error) {
            errors.push(
                `watched source root failed for ${watchedRoot}: ${error.message}`,
            );
        }
    }

    const ownerEdges = new Map(
        catalog.components.map((component) => [
            component.id,
            component.canonicalSources
                .filter((source) => source.ownership === "shared-reference")
                .map((source) => source.ownerComponentId),
        ]),
    );
    const visitOwner = (id, stack = new Set()) => {
        if (stack.has(id)) {
            errors.push(`component source ownership cycle contains ${id}`);
            return;
        }
        const next = new Set(stack);
        next.add(id);
        for (const ownerId of ownerEdges.get(id) ?? [])
            visitOwner(ownerId, next);
    };
    for (const component of catalog.components) visitOwner(component.id);

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
    for (const prompt of catalog.components.filter(
        (component) => component.kind === "prompt",
    ))
        if (
            prompt.canonicalSources.some(
                (source) =>
                    source.ownership !== "owner" ||
                    source.ownerComponentId !== prompt.id,
            )
        )
            errors.push(`${prompt.id}: prompt must own its canonical bytes`);
    for (const command of catalog.components.filter(
        (component) => component.kind === "command",
    )) {
        const prompt = promptsBySource.get(sourceSignature(command));
        if (prompt && prompt.semanticIdentity === command.semanticIdentity)
            errors.push(
                `${command.id}: command and prompt semantics are conflated`,
            );
        if (
            !prompt ||
            command.canonicalSources.some(
                (source) =>
                    source.ownership !== "shared-reference" ||
                    source.ownerComponentId !== prompt.id,
            )
        )
            errors.push(
                `${command.id}: command must share canonical bytes owned by its prompt`,
            );
    }
    return errors;
}

export function validateComponentProjections(
    catalogs,
    root = defaultRepositoryRoot,
) {
    const errors = [];
    const {
        components,
        projections,
        evidence,
        assuranceProfiles,
        hostAdapters,
    } = catalogs;
    if (semanticAnchor(projections.projections) !== expectedProjectionAnchor)
        errors.push(
            "component projection semantic contract differs from the independently reviewed anchor",
        );
    if (semanticAnchor(projections.hosts) !== expectedProjectionHostAnchor)
        errors.push(
            "component projection host contract differs from the independently reviewed anchor",
        );
    const componentsById = new Map(
        components.components.map((component) => [component.id, component]),
    );
    const hostsById = new Map(projections.hosts.map((host) => [host.id, host]));
    const evidenceIds = new Set(evidence.evidence.map((record) => record.id));
    const evidenceById = new Map(
        evidence.evidence.map((record) => [record.id, record]),
    );
    const hostAdaptersById = new Map(
        hostAdapters.hosts.map((adapter) => [adapter.id, adapter]),
    );
    const profilesById = new Map(
        assuranceProfiles.profiles.map((profile) => [profile.id, profile]),
    );
    for (const id of duplicates(projections.hosts.map((host) => host.id)))
        errors.push(`component projection hosts contains duplicate id ${id}`);
    for (const id of duplicates(
        projections.projections.map((projection) => projection.id),
    ))
        errors.push(`component projections contains duplicate id ${id}`);
    for (const identity of duplicates(
        projections.projections.map((projection) =>
            JSON.stringify([
                projection.componentId,
                projection.hostId,
                projection.projectedKind,
                projection.outputPaths,
            ]),
        ),
    ))
        errors.push(
            `component projections contains duplicate semantic projection ${identity}`,
        );
    const outputUses = new Map();
    for (const projection of projections.projections)
        for (const outputPath of projection.outputPaths) {
            const uses = outputUses.get(outputPath) ?? [];
            uses.push(projection);
            outputUses.set(outputPath, uses);
        }
    for (const host of projections.hosts) {
        for (const evidenceId of host.evidenceIds) {
            if (!evidenceIds.has(evidenceId))
                errors.push(`${host.id}: unknown host evidence ${evidenceId}`);
            else if (evidenceById.get(evidenceId).expiresOn < evidence.asOf)
                errors.push(`${host.id}: expired host evidence ${evidenceId}`);
        }
        const adapter = host.hostAdapterId
            ? hostAdaptersById.get(host.hostAdapterId)
            : null;
        if (host.hostAdapterId && !adapter)
            errors.push(`${host.id}: unknown host adapter ${host.hostAdapterId}`);
        const staticContract = staticFixtureHostContracts.get(host.id);
        if (host.materialization === "static-fixture") {
            if (
                !staticContract ||
                host.hostAdapterId !== staticContract.adapterId ||
                host.staticOutputRoot !== staticContract.outputRoot ||
                !host.allowedOutputPrefixes.includes(staticContract.outputRoot) ||
                !host.allowedProjectedKinds.includes(staticContract.kind) ||
                !host.evidenceIds.includes(staticContract.evidenceId) ||
                !adapter?.nativeDiscoveryRoots.some(
                    (root) =>
                        root.path === staticContract.discoveryRoot &&
                        root.evidenceIds.includes(staticContract.evidenceId),
                )
            )
                errors.push(`${host.id}: static fixture host contract changed`);
        } else if (host.staticOutputRoot !== null)
            errors.push(`${host.id}: non-static host cannot declare an output root`);
        if (
            host.contract === "portable-agent-plugins-1-0" &&
            host.acceptsAnyPassiveProjection
        )
            errors.push(
                `${host.id}: portable contract cannot accept the native passive-host wildcard`,
            );
        const hostProjections = projections.projections.filter(
            (projection) => projection.hostId === host.id,
        );
        const declaredOutputs = [
            ...new Set(hostProjections.flatMap((projection) => projection.outputPaths)),
        ].sort(compareOrdinal);
        if (host.materialization === "repository-existing") {
            try {
                const actualOutputs = [
                    ...new Set(
                        host.allowedOutputPrefixes.flatMap((prefix) =>
                            adapterLeaves(root, prefix),
                        ),
                    ),
                ].sort(compareOrdinal);
                if (
                    JSON.stringify(actualOutputs) !==
                    JSON.stringify(declaredOutputs)
                )
                    errors.push(
                        `${host.id}: actual host adapter outputs do not match the projection catalog`,
                    );
            } catch (error) {
                errors.push(
                    `${host.id}: host output closure failed: ${error.message}`,
                );
            }
        } else if (
            host.materialization === "none" &&
            declaredOutputs.length > 0
        )
            errors.push(`${host.id}: non-materialized host has output claims`);
        for (const outputPath of host.sharedSymlinkOutputs) {
            if (!projectionOutputMatchesHost(host, outputPath))
                errors.push(
                    `${host.id}: shared symlink output is outside its host boundary: ${outputPath}`,
                );
            const uses = outputUses.get(outputPath) ?? [];
            if (
                uses.length < 2 ||
                uses.some(
                    (projection) =>
                        projection.hostId !== host.id ||
                        projection.adapterType !== "symlink" ||
                        projection.hostActivation !== "active",
                )
            )
                errors.push(
                    `${host.id}: shared symlink output lacks multiple consistent active projections: ${outputPath}`,
                );
        }
        for (const projection of hostProjections)
            for (const outputPath of projection.outputPaths) {
                const uses = outputUses.get(outputPath) ?? [];
                if (
                    uses.length > 1 &&
                    !host.sharedSymlinkOutputs.includes(outputPath)
                )
                    errors.push(
                        `${projection.id}: shared output is not explicitly declared by its host: ${outputPath}`,
                    );
            }
    }
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
            else if (evidenceById.get(evidenceId).expiresOn < evidence.asOf)
                errors.push(
                    `${projection.id}: expired projection evidence ${evidenceId}`,
                );
        if (component && host && !allowanceMatches(component, host, projection))
            errors.push(
                `${projection.id}: projection is not explicitly allowed by the component contract`,
            );
        if (host && !host.allowedProjectedKinds.includes(projection.projectedKind))
            errors.push(
                `${projection.id}: projected kind is not allowed by the host contract`,
            );
        if (component?.forbiddenProjections.includes(projection.projectedKind))
            errors.push(
                `${projection.id}: projection kind is explicitly forbidden`,
            );
        if (host?.contract === "portable-agent-plugins-1-0") {
            if (
                !component ||
                !new Set(["skill", "mcp"]).has(component.kind) ||
                projection.projectedKind !== component.kind
            )
                errors.push(
                    `${projection.id}: canonical component kind is not portable in Agent Plugins 1.0`,
                );
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
            const expectedActivation =
                projection.adapterType === "path-reference" ? "inert" : "active";
            if (projection.hostActivation !== expectedActivation)
                errors.push(
                    `${projection.id}: existing ${projection.adapterType} adapter requires ${expectedActivation} host activation`,
                );
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
                    const output = join(root, path);
                    if (!existsSync(output))
                        errors.push(
                            `${projection.id}: existing projection output is missing: ${path}`,
                        );
                    else {
                        const stat = lstatSync(output);
                        if (
                            projection.adapterType === "symlink" &&
                            !stat.isSymbolicLink()
                        )
                            errors.push(
                                `${projection.id}: declared symlink adapter is not a symlink: ${path}`,
                            );
                        if (
                            projection.adapterType === "path-reference" &&
                            (!stat.isFile() || stat.isSymbolicLink())
                        )
                            errors.push(
                                `${projection.id}: declared path-reference adapter is not a regular file: ${path}`,
                            );
                        if (
                            projection.adapterType === "canonical-in-place" &&
                            (!stat.isFile() || stat.isSymbolicLink())
                        )
                            errors.push(
                                `${projection.id}: canonical-in-place output is not a regular file: ${path}`,
                            );
                        try {
                            const canonicalTargets = component?.canonicalSources.map(
                                (source) => realpathSync(join(root, source.path)),
                            );
                            if (
                                projection.adapterType === "path-reference" &&
                                canonicalTargets
                            ) {
                                const reference = readFileSync(output, "utf8").trim();
                                const target = realpathSync(
                                    resolve(dirname(output), reference),
                                );
                                if (!canonicalTargets.includes(target))
                                    errors.push(
                                        `${projection.id}: path-reference does not resolve to its canonical source`,
                                    );
                            }
                            if (
                                projection.adapterType === "symlink" &&
                                canonicalTargets
                            ) {
                                const target = realpathSync(output);
                                if (
                                    !canonicalTargets.some(
                                        (canonical) =>
                                            canonical === target ||
                                            dirname(canonical) === target,
                                    )
                                )
                                    errors.push(
                                        `${projection.id}: symlink adapter does not resolve to its canonical source boundary`,
                                    );
                            }
                        } catch (error) {
                            errors.push(
                                `${projection.id}: adapter target validation failed for ${path}: ${error.message}`,
                            );
                        }
                    }
                } else
                    errors.push(
                        `${projection.id}: projection output path is unsafe: ${path}`,
                    );
            }
            if (
                projection.adapterType === "canonical-in-place" &&
                component
            ) {
                try {
                    const canonicalFiles = [
                        ...new Set(
                            component.canonicalSources.flatMap((source) =>
                                regularFiles(root, source.path),
                            ),
                        ),
                    ].sort(compareOrdinal);
                    const outputFiles = [...projection.outputPaths].sort(
                        compareOrdinal,
                    );
                    if (
                        JSON.stringify(canonicalFiles) !==
                        JSON.stringify(outputFiles)
                    )
                        errors.push(
                            `${projection.id}: canonical-in-place outputs do not exactly match component source bytes`,
                        );
                } catch (error) {
                    errors.push(
                        `${projection.id}: canonical-in-place validation failed: ${error.message}`,
                    );
                }
            }
        } else if (projection.state === "generated-static") {
            const staticContract = host
                ? staticFixtureHostContracts.get(host.id)
                : null;
            if (
                !component ||
                !component.classification.passive ||
                !host ||
                host.materialization !== "static-fixture" ||
                !staticContract ||
                projection.adapterType !== "generated" ||
                projection.hostActivation !== "none" ||
                projection.packageIdentity !== null ||
                projection.artifactClass !== "provider-compatibility" ||
                projection.assuranceProfileId !== "provider-compatibility-v1" ||
                projection.approval !== "modeled" ||
                projection.outputPaths.length !== 1 ||
                !projection.evidenceIds.includes(staticContract.evidenceId)
            )
                errors.push(
                    `${projection.id}: generated-static projection contract changed`,
                );
            const sourcePath = component?.canonicalSources[0]?.path;
            const basename = sourcePath?.split("/").at(-1);
            const expectedOutput =
                staticContract?.kind === "rule"
                    ? `${staticContract.outputRoot}/${staticContract.discoveryRoot}${basename}`
                    : staticContract
                      ? `${staticContract.outputRoot}/${staticContract.discoveryRoot}`
                      : null;
            if (
                component?.kind !== staticContract?.kind ||
                projection.projectedKind !== staticContract?.kind ||
                component?.canonicalSources.length !== 1 ||
                projection.outputPaths[0] !== expectedOutput ||
                !projectionOutputMatchesHost(host, projection.outputPaths[0])
            )
                errors.push(
                    `${projection.id}: generated-static semantic kind, source, or output mapping changed`,
                );
        } else if (
            projection.outputPaths.length > 0 ||
            projection.adapterType !== "none" ||
            projection.hostActivation !== "none"
        )
            errors.push(
                `${projection.id}: planned or blocked projection cannot claim existing output or activation`,
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
    const generatedStatic = projections.projections.filter(
        (projection) => projection.state === "generated-static",
    );
    const generatedCounts = Object.fromEntries(
        [...staticFixtureHostContracts.keys()].map((hostId) => [
            hostId,
            generatedStatic.filter((projection) => projection.hostId === hostId)
                .length,
        ]),
    );
    if (
        projections.hosts.length !== 9 ||
        projections.projections.length !== 385 ||
        projections.projections.filter(
            (projection) => projection.state === "existing",
        ).length !== 315 ||
        generatedStatic.length !== 70 ||
        generatedCounts["jetbrains-ai-assistant"] !== 34 ||
        generatedCounts.tabnine !== 34 ||
        generatedCounts["visual-studio-copilot"] !== 1 ||
        generatedCounts["devin-hosted"] !== 1 ||
        new Set(generatedStatic.map((projection) => projection.componentId))
            .size !== 35
    )
        errors.push(
            "S8 generated-static projection cardinality differs from the reviewed contract",
        );
    for (const [outputPath, uses] of outputUses) {
        if (
            uses.length === 0 ||
            uses.some(
                (projection) =>
                    projection.adapterType !== "symlink" ||
                    projection.hostActivation !== "active",
            )
        )
            continue;
        try {
            const target = realpathSync(join(root, outputPath));
            const targetPath = relative(root, target).split(sep).join("/");
            const exposedFiles = regularFiles(root, targetPath);
            const representedFiles = new Set();
            for (const projection of uses) {
                const component = componentsById.get(projection.componentId);
                const componentFiles =
                    component?.canonicalSources.flatMap((source) =>
                        regularFiles(root, source.path),
                    ) ?? [];
                const representedByProjection = componentFiles.filter((file) =>
                    pathWithin(file, targetPath),
                );
                if (
                    representedByProjection.length !== componentFiles.length
                )
                    errors.push(
                        `${projection.id}: symlink output does not expose all component canonical bytes`,
                    );
                for (const file of representedByProjection)
                    representedFiles.add(file);
            }
            const represented = [...representedFiles].sort(compareOrdinal);
            if (JSON.stringify(exposedFiles) !== JSON.stringify(represented))
                errors.push(
                    `${outputPath}: symlink target bytes do not have exact component projection coverage`,
                );
        } catch (error) {
            errors.push(
                `${outputPath}: symlink output closure failed: ${error.message}`,
            );
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
    let hostAdapters;
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
        hostAdapters = readCatalog(
            join(root, componentCatalogPaths.hostAdapters),
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
        hostAdapters,
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
