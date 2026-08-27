// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    buildGlobalReleaseManifest,
    createLogicalTree,
    projectLogicalTree,
    writeProjectedRoot,
} from "./deterministic-release-tree.mjs";
import {
    fixtureProjectionRoots,
    harnesses,
    passiveHarnesses,
    profileProjectionRoots,
} from "./harness-registry.mjs";
import {
    assertSafeContent,
    validatePayloadPath,
} from "./public-artifact-materializer.mjs";
import {
    formatComplianceDiagnostics,
    parseAgentSkillFrontmatter,
    validateAgentSkill,
    validateCratisPassiveProfile,
} from "./portable-compliance-validation.mjs";

export { passiveHarnesses } from "./harness-registry.mjs";

function jsonBuffer(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

export function createClaudeMarketplace({ name, version, description }) {
    return {
        name: "cratis",
        owner: { name: "Cratis" },
        metadata: { description, version },
        plugins: [
            {
                name,
                description,
                version,
                source: `./plugins/${name}`,
                strict: true,
            },
        ],
    };
}

export function createClaudePluginManifest({ name, version, description }) {
    return {
        name,
        version,
        description,
        author: { name: "Cratis" },
    };
}

export function createAgentPluginManifest({ name, version, description }) {
    return {
        $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        name,
        version,
        description,
        author: {
            name: "Cratis",
            url: "https://cratis.io",
        },
        homepage: "https://cratis.io/ai",
        repository: "https://github.com/Cratis/AI",
        license: "MIT",
        keywords: ["cratis", "agent-skills"],
    };
}

export function readSkillFrontmatter(content, skillName) {
    const parsed = parseAgentSkillFrontmatter(content, {
        path: `skills/${skillName}/SKILL.md`,
    });
    if (
        parsed.diagnostics.length > 0 ||
        parsed.frontmatter.name !== skillName ||
        typeof parsed.frontmatter.description !== "string" ||
        parsed.frontmatter.description.length === 0
    )
        throw new Error(
            `Profile skill frontmatter name or description is invalid: ${skillName}`,
        );
    return new Map(Object.entries(parsed.frontmatter));
}

function assertInputs({
    version,
    profileId,
    packageName,
    description,
    skills,
}) {
    if (
        !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
            version,
        )
    )
        throw new Error("Profile release version must be exact SemVer");
    if (!/^(?:public|engineering)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId))
        throw new Error("Profile id is invalid");
    if (!/^@cratis\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageName))
        throw new Error("Profile package name is invalid");
    if (
        typeof description !== "string" ||
        description.length === 0 ||
        description.length > 1024
    )
        throw new Error("Profile package description is invalid");
    if (!Array.isArray(skills) || skills.length === 0)
        throw new Error("Profile release requires at least one skill");
    const names = new Set();
    for (const skill of skills) {
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ||
            names.has(skill.name) ||
            !Array.isArray(skill.files) ||
            !skill.files.some((file) => file.path === "SKILL.md")
        )
            throw new Error(`Profile skill input is invalid: ${skill.name}`);
        names.add(skill.name);
        const filePaths = new Set();
        const collisionKeys = new Set();
        for (const file of skill.files) {
            if (
                !/^(?:SKILL\.md|LICENSE[^/]*|references\/[A-Za-z0-9._/-]+|assets\/[A-Za-z0-9._/-]+)$/.test(
                    file.path,
                ) ||
                file.path.split("/").includes("..") ||
                !Buffer.isBuffer(file.content) ||
                filePaths.has(file.path) ||
                collisionKeys.has(file.path.normalize("NFC").toLowerCase())
            )
                throw new Error(
                    `Profile skill file is invalid: ${skill.name}/${file.path}`,
                );
            filePaths.add(file.path);
            collisionKeys.add(file.path.normalize("NFC").toLowerCase());
            const payloadPath = `skills/${skill.name}/${file.path}`;
            validatePayloadPath(payloadPath);
            assertSafeContent(payloadPath, file.content);
        }
        readSkillFrontmatter(
            skill.files.find((file) => file.path === "SKILL.md").content,
            skill.name,
        );
    }
}

function skillLogicalFiles(skills) {
    return skills.flatMap((skill) =>
        skill.files.map((file) => ({
            path: `skills/${skill.name}/${file.path}`,
            content: file.content,
        })),
    );
}

function skillMappings(logicalFiles, skillRoot) {
    return logicalFiles.map((file) => ({
        sourcePath: file.path,
        path: [skillRoot, file.path].filter(Boolean).join("/"),
    }));
}

function metadataFilesForHarness(harness, options) {
    const {
        profileId,
        version,
        packageName,
        description,
        codexInstallationPolicy,
        piPrivate,
    } = options;
    const files = [];
    const add = (path, value) => {
        const sourcePath = `metadata/${harness.id}/${path}`;
        files.push({ sourcePath, path, content: jsonBuffer(value) });
    };
    switch (harness.adapterKind) {
        case "portable-plugin":
            add(
                "plugin.json",
                createAgentPluginManifest({
                    name: profileId,
                    version,
                    description,
                }),
            );
            break;
        case "claude-compatible":
            add(
                ".claude-plugin/marketplace.json",
                createClaudeMarketplace({
                    name: profileId,
                    version,
                    description,
                }),
            );
            add(
                `plugins/${profileId}/.claude-plugin/plugin.json`,
                createClaudePluginManifest({
                    name: profileId,
                    version,
                    description,
                }),
            );
            break;
        case "codex-plugin":
            add(".agents/plugins/marketplace.json", {
                name: "cratis",
                interface: { displayName: "Cratis" },
                plugins: [
                    {
                        name: profileId,
                        source: {
                            source: "local",
                            path: `./plugins/${profileId}`,
                        },
                        policy: {
                            installation: codexInstallationPolicy,
                            ...(codexInstallationPolicy === "NOT_AVAILABLE"
                                ? {}
                                : { authentication: "ON_INSTALL" }),
                        },
                        category: "Developer Tools",
                    },
                ],
            });
            add(`plugins/${profileId}/.codex-plugin/plugin.json`, {
                name: profileId,
                version,
                description,
                skills: "./skills/",
            });
            break;
        case "portable-plugin-marketplace": {
            const cursor = harness.id === "cursor";
            add(
                cursor
                    ? ".cursor-plugin/marketplace.json"
                    : ".github/plugin/marketplace.json",
                {
                    name: "cratis",
                    owner: { name: "Cratis" },
                    metadata: { description, version },
                    plugins: [
                        {
                            name: profileId,
                            description,
                            version,
                            source: `./plugins/${profileId}`,
                            ...(cursor ? {} : { strict: true }),
                        },
                    ],
                },
            );
            add(
                `plugins/${profileId}/plugin.json`,
                createAgentPluginManifest({
                    name: profileId,
                    version,
                    description,
                }),
            );
            break;
        }
        case "direct-skills-manifest":
            add("gemini-extension.json", {
                name: profileId,
                version,
                description,
            });
            break;
        case "pi-package":
            add("package.json", {
                name: packageName,
                version,
                description,
                private: piPrivate,
                license: "MIT",
                repository: {
                    type: "git",
                    url: "https://github.com/Cratis/AI",
                },
                homepage: "https://cratis.io/ai",
                files: ["skills"],
                keywords: ["pi-package", "cratis"],
                pi: { skills: ["./skills"] },
            });
            break;
        case "direct-skills":
            break;
        default:
            throw new Error(
                `Unknown passive adapter kind: ${harness.adapterKind}`,
            );
    }
    return files;
}

function metadataFilesForFixtureHarness(harness, projection, options) {
    const {
        pluginName,
        version,
        portableDescription,
        marketplaceDescription,
        codexDisplayName,
        piPackageManifest,
    } = options;
    const files = [];
    const add = (path, value) => {
        const sourcePath = `metadata/${harness.id}/${projection.id}/${path}`;
        files.push({ sourcePath, path, content: jsonBuffer(value) });
    };
    switch (harness.adapterKind) {
        case "portable-plugin":
            add(
                "plugin.json",
                createAgentPluginManifest({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
            break;
        case "claude-compatible":
            add(
                ".claude-plugin/marketplace.json",
                createClaudeMarketplace({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
            add(
                `plugins/${pluginName}/.claude-plugin/plugin.json`,
                createClaudePluginManifest({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
            break;
        case "codex-plugin":
            add(".agents/plugins/marketplace.json", {
                name: pluginName,
                interface: { displayName: codexDisplayName },
                plugins: [
                    {
                        name: pluginName,
                        source: {
                            source: "local",
                            path: `./plugins/${pluginName}`,
                        },
                        policy: {
                            installation: "AVAILABLE",
                            authentication: "ON_INSTALL",
                        },
                        category: "Developer Tools",
                    },
                ],
            });
            add(`plugins/${pluginName}/.codex-plugin/plugin.json`, {
                name: pluginName,
                version,
                description: portableDescription,
                skills: "./skills/",
            });
            break;
        case "portable-plugin-marketplace": {
            const cursor = harness.id === "cursor";
            add(
                cursor
                    ? ".cursor-plugin/marketplace.json"
                    : ".github/plugin/marketplace.json",
                {
                    name: pluginName,
                    owner: { name: "Cratis" },
                    metadata: { description: marketplaceDescription, version },
                    plugins: [
                        {
                            name: pluginName,
                            description: portableDescription,
                            version,
                            source: `./plugins/${pluginName}`,
                            ...(cursor ? {} : { strict: true }),
                        },
                    ],
                },
            );
            add(
                `plugins/${pluginName}/plugin.json`,
                createAgentPluginManifest({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
            break;
        }
        case "direct-skills-manifest":
            add("gemini-extension.json", {
                name: pluginName,
                version,
                description: portableDescription,
            });
            break;
        case "pi-package":
            add(
                [projection.skillRoot, "package.json"]
                    .filter(Boolean)
                    .join("/"),
                piPackageManifest,
            );
            break;
        case "direct-skills":
            break;
        default:
            throw new Error(
                `Unknown passive adapter kind: ${harness.adapterKind}`,
            );
    }
    return files;
}

/** Builds the shared logical skill tree and registry-declared fixture projections. */
export function createPassiveFixtureProjection(options) {
    const logicalSkillFiles = skillLogicalFiles(options.skills);
    const roots = [];
    const metadata = [];
    for (const harness of harnesses) {
        for (const projection of fixtureProjectionRoots(
            harness.id,
            options.pluginName,
        )) {
            const harnessMetadata = metadataFilesForFixtureHarness(
                harness,
                projection,
                options,
            );
            metadata.push(...harnessMetadata);
            roots.push({
                id: projection.id,
                root: projection.outputRoot,
                parityGroup: projection.parityGroup,
                mappings: [
                    ...skillMappings(logicalSkillFiles, projection.skillRoot),
                    ...harnessMetadata.map((file) => ({
                        sourcePath: file.sourcePath,
                        path: file.path,
                    })),
                ],
            });
        }
    }
    const logicalTree = createLogicalTree({
        files: [
            ...logicalSkillFiles,
            ...metadata.map((file) => ({
                path: file.sourcePath,
                content: file.content,
            })),
        ],
        metrics: options.metrics,
    });
    return projectLogicalTree(logicalTree, roots, {
        concurrency: options.concurrency ?? 1,
    });
}

/** Builds the single logical-skill-tree and explicit registry projections used by passive releases. */
export function createPassiveProfileProjection(options) {
    const logicalSkillFiles = skillLogicalFiles(options.skills);
    const metadataByHarness = new Map(
        harnesses.map((harness) => [
            harness.id,
            metadataFilesForHarness(harness, options),
        ]),
    );
    const logicalTree = createLogicalTree({
        files: [
            ...logicalSkillFiles,
            ...[...metadataByHarness.values()].flat().map((file) => ({
                path: file.sourcePath,
                content: file.content,
            })),
        ],
        metrics: options.metrics,
    });
    const roots = harnesses.flatMap((harness) =>
        profileProjectionRoots(harness.id, options.profileId).map(
            (projection) => ({
                id: projection.id,
                root: projection.outputRoot,
                parityGroup: projection.parityGroup,
                mappings: [
                    ...skillMappings(logicalSkillFiles, projection.skillRoot),
                    ...metadataByHarness.get(harness.id).map((file) => ({
                        sourcePath: file.sourcePath,
                        path: file.path,
                    })),
                ],
            }),
        ),
    );
    return projectLogicalTree(logicalTree, roots, {
        concurrency: options.concurrency ?? 1,
    });
}

export function validatePassiveFixtureHarnesses({
    outputRoot,
    version,
    pluginName,
    skills,
}) {
    const root = resolve(outputRoot);
    const receipts = [];
    for (const harness of harnesses.filter(
        (candidate) => candidate.complianceModes.length > 0,
    )) {
        for (const descriptor of fixtureProjectionRoots(
            harness.id,
            pluginName,
        )) {
            const artifactRoot = join(root, descriptor.outputRoot);
            if (harness.adapterKind === "portable-plugin") {
                const result = validateCratisPassiveProfile(artifactRoot, {
                    profileId: pluginName,
                    version,
                    artifactId: harness.id,
                    allowFixtureProfileId: true,
                });
                if (result.releaseBlocking)
                    throw new Error(
                        `${harness.id}: fixture compliance failed\n${formatComplianceDiagnostics(result.diagnostics)}`,
                    );
                receipts.push(result.receipt);
                continue;
            }
            const files = [];
            for (const skill of skills) {
                const skillRoot = join(
                    artifactRoot,
                    descriptor.skillRoot,
                    "skills",
                    skill.name,
                );
                const result = validateAgentSkill(skillRoot, {
                    mode: "cratis-passive-v1",
                    pluginRoot: artifactRoot,
                });
                if (!result.valid)
                    throw new Error(
                        `${harness.id}: fixture Agent Skill validation failed\n${formatComplianceDiagnostics(result.diagnostics)}`,
                    );
                files.push({
                    name: skill.name,
                    path: `${descriptor.skillRoot}/skills/${skill.name}/SKILL.md`,
                    sha256: createHash("sha256")
                        .update(result.sourceBytes)
                        .digest("hex"),
                });
            }
            receipts.push({
                schemaVersion: "1.0.0",
                contract: "agent-skills-strict-passive-v1",
                artifactId: harness.id,
                files,
                conformant: true,
                releaseBlocking: false,
                passivePayloadSafe: true,
                executionPerformed: false,
                networkAccessPerformed: false,
                approvalGranted: false,
                supportGranted: false,
                publicationGranted: false,
            });
        }
    }
    return {
        schemaVersion: "1.0.0",
        state: "GENERATED_STATIC_VALIDATION_ONLY",
        hostTested: false,
        installationTested: false,
        runtimeGranted: false,
        publicationGranted: false,
        promotionGranted: false,
        supportGranted: false,
        receipts,
    };
}

function generatePassiveProfileAdaptersCore(options) {
    const {
        outputRoot,
        version,
        profileId,
        packageName,
        description,
        skills,
        codexInstallationPolicy = "AVAILABLE",
        piPrivate = false,
    } = options;
    assertInputs({ version, profileId, packageName, description, skills });
    if (
        !["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"].includes(
            codexInstallationPolicy,
        ) ||
        typeof piPrivate !== "boolean"
    )
        throw new Error("Profile adapter publication policy is invalid");
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Profile adapter output must not exist: ${root}`);
    const metrics = options.metrics ?? {
        sourceReads: 0,
        finalReads: 0,
        bytesHashed: 0,
    };
    const projected = createPassiveProfileProjection({
        ...options,
        codexInstallationPolicy,
        piPrivate,
        metrics,
    });
    const validation = writeProjectedRoot(root, projected, {
        concurrency: options.concurrency ?? 1,
        metrics,
        beforeWrite: options.beforeWrite,
    });

    const rootsByHarness = Object.fromEntries(
        harnesses.map((harness) => {
            const roots = projected.roots
                .filter((candidate) => candidate.parityGroup === harness.id)
                .map((candidate) => candidate.root);
            return [harness.id, roots[0]];
        }),
    );
    const declaredRoots = Object.fromEntries(
        harnesses.map((harness) => [
            harness.id,
            projected.roots
                .filter((candidate) => candidate.parityGroup === harness.id)
                .map((candidate) => candidate.root),
        ]),
    );
    const complianceReceipts = [];
    for (const harness of harnesses) {
        const harnessRoots = projected.roots.filter(
            (candidate) => candidate.parityGroup === harness.parityGroup,
        );
        for (const harnessRoot of harnessRoots) {
            const descriptor = profileProjectionRoots(
                harness.id,
                profileId,
            ).find((candidate) => candidate.id === harnessRoot.id);
            if (!descriptor)
                throw new Error(
                    `Missing profile projection descriptor: ${harnessRoot.id}`,
                );
            const artifactRoot = join(root, harnessRoot.root);
            const rootPrefix = `${harnessRoot.root}/`;
            const artifactFiles = projected.files
                .filter((file) => file.path.startsWith(rootPrefix))
                .map((file) => ({
                    path: file.path.slice(rootPrefix.length),
                    size: file.size,
                    sha256: file.sha256,
                }))
                .sort((left, right) => compareOrdinal(left.path, right.path));
            if (
                harness.adapterKind === "portable-plugin" ||
                harness.adapterKind === "portable-plugin-marketplace"
            ) {
                const portableRoot =
                    harness.adapterKind === "portable-plugin-marketplace"
                        ? join(artifactRoot, `plugins/${profileId}`)
                        : artifactRoot;
                const validationResult = validateCratisPassiveProfile(
                    portableRoot,
                    {
                        profileId,
                        version,
                        artifactId: harness.id,
                    },
                );
                if (validationResult.releaseBlocking) {
                    rmSync(root, { recursive: true, force: true });
                    throw new Error(
                        `${harness.id}: portable compliance failed\n${formatComplianceDiagnostics(validationResult.diagnostics)}`,
                    );
                }
                complianceReceipts.push({
                    ...validationResult.receipt,
                    artifactId: harnessRoot.id,
                    artifactRoot: harnessRoot.root,
                    artifactFiles,
                });
                continue;
            }
            const skillReceipts = [];
            for (const skill of skills) {
                const skillRoot = join(
                    artifactRoot,
                    descriptor.skillRoot,
                    "skills",
                    skill.name,
                );
                const validationResult = validateAgentSkill(skillRoot, {
                    mode: "cratis-passive-v1",
                    pluginRoot: artifactRoot,
                });
                if (!validationResult.valid) {
                    rmSync(root, { recursive: true, force: true });
                    throw new Error(
                        `${harness.id}: strict Agent Skill validation failed\n${formatComplianceDiagnostics(validationResult.diagnostics)}`,
                    );
                }
                skillReceipts.push({
                    name: skill.name,
                    path: `${descriptor.skillRoot ? `${descriptor.skillRoot}/` : ""}skills/${skill.name}/SKILL.md`,
                    sha256: createHash("sha256")
                        .update(validationResult.sourceBytes)
                        .digest("hex"),
                });
            }
            complianceReceipts.push({
                artifactId: harnessRoot.id,
                artifactRoot: harnessRoot.root,
                profile:
                    harness.adapterKind === "direct-skills"
                        ? "agent-skills-strict-passive-v1"
                        : "passive-native-metadata-v1",
                conformant: true,
                releaseBlocking: false,
                passivePayloadSafe: true,
                skills: skillReceipts,
                artifactFiles,
                executionPerformed: false,
                networkAccessPerformed: false,
                supportGranted: false,
                hostTested: false,
            });
        }
    }
    const canonicalFiles = skillLogicalFiles(skills).map((file) => {
        const projectedFile = projected.files.find(
            (candidate) => candidate.sourcePath === file.path,
        );
        return [file.path, projectedFile.sha256];
    });
    const profileHash = createHash("sha256");
    profileHash.update(profileId);
    profileHash.update("\0");
    profileHash.update(version);
    profileHash.update("\0");
    for (const [path, digest] of canonicalFiles.sort(([left], [right]) =>
        compareOrdinal(left, right),
    )) {
        profileHash.update(path);
        profileHash.update("\0");
        profileHash.update(digest);
        profileHash.update("\0");
    }
    const deterministicManifest = buildGlobalReleaseManifest(
        projected,
        validation,
        {
            profileId,
            version,
        },
    );
    return {
        harnesses: passiveHarnesses,
        roots: rootsByHarness,
        declaredRoots,
        deterministicManifest,
        compliance: {
            profile: "cratis-passive-v1",
            profileDigest: profileHash.digest("hex"),
            specifications: complianceReceipts.find(
                (receipt) => receipt.specifications,
            )?.specifications,
            receipts: complianceReceipts,
            deterministicReleaseTree: {
                state: deterministicManifest.state,
                fileCount: deterministicManifest.fileCount,
                totalBytes: deterministicManifest.totalBytes,
                roots: deterministicManifest.roots.map((candidate) => ({
                    id: candidate.id,
                    path: candidate.path,
                })),
            },
            staticValidationInput: {
                assuranceId: "static-validation",
                outcome: "pass",
                supporting: false,
                reason: "Deterministic repository validation input; it does not establish host support or release approval.",
            },
            approvalGranted: false,
            supportGranted: false,
            publicationGranted: false,
            runtimeGranted: false,
            promotionGranted: false,
        },
        files: validation.files,
        metrics,
    };
}

export function generatePassiveProfileAdapters(options) {
    return generatePassiveProfileAdaptersCore(options);
}
