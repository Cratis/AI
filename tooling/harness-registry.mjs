#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const harnessDefinitions = [
    {
        id: "agent-skills",
        subscriptionId: "agent-skills",
        fixtureTargetId: "canonical-agent-skills",
        fixtureOutputRoot: "canonical",
        canonicalArtifactId: "agent-skills",
        profileSkillRoot: ".",
        fixtureSkillRoot: ".",
        adapterKind: "direct-skills",
    },
    {
        id: "agent-plugin",
        subscriptionId: "agent-plugin",
        fixtureTargetId: "portable-agent-plugin",
        fixtureOutputRoot: "agent-plugin",
        canonicalArtifactId: "agent-plugin",
        profileSkillRoot: ".",
        fixtureSkillRoot: ".",
        adapterKind: "portable-plugin",
    },
    {
        id: "claude",
        subscriptionId: "claude",
        fixtureTargetId: "claude-code",
        fixtureOutputRoot: "claude",
        canonicalArtifactId: "claude",
        modelProviders: ["deepseek"],
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        adapterKind: "claude-compatible",
    },
    {
        id: "codex",
        subscriptionId: "codex",
        fixtureTargetId: "openai-codex",
        fixtureOutputRoot: "codex",
        canonicalArtifactId: "codex",
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        adapterKind: "codex-plugin",
    },
    {
        id: "copilot",
        subscriptionId: "copilot",
        fixtureTargetId: "github-copilot",
        fixtureOutputRoot: "copilot",
        canonicalArtifactId: "agent-plugin",
        modelProviders: ["deepseek"],
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        adapterKind: "portable-plugin-marketplace",
    },
    {
        id: "cursor",
        subscriptionId: "cursor",
        fixtureTargetId: "cursor",
        fixtureOutputRoot: "cursor",
        canonicalArtifactId: "agent-plugin",
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        adapterKind: "portable-plugin-marketplace",
    },
    {
        id: "deepcode",
        subscriptionId: "deepcode",
        fixtureTargetId: "deepseek-deepcode",
        fixtureOutputRoot: "deepcode",
        canonicalArtifactId: "deepcode",
        modelProviders: ["deepseek"],
        profileSkillRoot: ".deepcode",
        fixtureSkillRoot: ".deepcode",
        projectSkillRoot: ".deepcode/skills",
        copySkillsDirectly: true,
        adapterKind: "direct-skills",
    },
    {
        id: "deepseek",
        subscriptionId: "deepseek-harness",
        aliases: ["deepseek-harness"],
        fixtureTargetId: "deepseek-harness",
        fixtureOutputRoot: "deepseek",
        canonicalArtifactId: "deepseek-harness",
        modelProviders: ["deepseek"],
        profileSkillRoot: ".dsh",
        fixtureSkillRoot: ".dsh",
        projectSkillRoot: ".dsh/skills",
        copySkillsDirectly: true,
        adapterKind: "direct-skills",
    },
    {
        id: "gemini",
        subscriptionId: "gemini",
        fixtureTargetId: "gemini-cli",
        fixtureOutputRoot: "gemini",
        canonicalArtifactId: "gemini",
        profileSkillRoot: ".",
        fixtureSkillRoot: ".",
        copySkillsDirectly: true,
        adapterKind: "direct-skills-manifest",
    },
    {
        id: "grok",
        subscriptionId: "grok",
        fixtureTargetId: "grok-build",
        fixtureOutputRoot: "grok",
        canonicalArtifactId: "claude",
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        projectSkillRoot: ".grok/plugins",
        adapterKind: "claude-compatible",
    },
    {
        id: "junie",
        subscriptionId: "junie",
        fixtureTargetId: "junie",
        fixtureOutputRoot: "junie",
        canonicalArtifactId: "claude",
        profileSkillRoot: "plugins/{plugin}",
        fixtureSkillRoot: "plugins/{plugin}",
        adapterKind: "claude-compatible",
    },
    {
        id: "kiro",
        subscriptionId: "kiro",
        fixtureTargetId: "kiro",
        fixtureOutputRoot: "kiro",
        canonicalArtifactId: "agent-plugin",
        profileSkillRoot: ".",
        fixtureSkillRoot: ".",
        copySkillsDirectly: true,
        adapterKind: "portable-plugin",
    },
    {
        id: "pi",
        subscriptionId: "pi",
        fixtureTargetId: "pi-npm",
        fixtureOutputRoot: "pi",
        canonicalArtifactId: "pi",
        modelProviders: ["deepseek"],
        profileSkillRoot: ".",
        fixtureSkillRoot: "package",
        adapterKind: "pi-package",
    },
];

// Independent completeness anchor until S1 replaces this with the structured
// ecosystem contract. Keeping it separate from ecosystem-versions.json means
// deleting a known ecosystem cannot silently validate.
export const requiredEcosystemIds = Object.freeze([
    "agent-plugins",
    "agent-skills",
    "model-context-protocol",
    "mcp-registry",
    "github-cli-skills",
    "vscode-agent-plugins",
    "github-copilot-plugins",
    "openai-plugins",
    "claude-code-plugins",
    "gemini-cli-extensions",
    "cursor-plugins",
    "kiro-powers",
    "hermes-agent-plugins",
    "openclaw-bundles",
    "grok-build-skills",
    "grok-bot-plugins",
    "nanoclaw-templates",
    "pi-packages",
    "junie-extensions",
    "opencode-skills",
    "zed-skills",
    "deepseek-deepcode-skills",
    "deepseek-harness-skills",
    "deepseek-model-integrations",
    "npm-cratis-scope",
    "npm-trusted-publishing",
]);

export const harnesses = Object.freeze(
    harnessDefinitions.map((definition) =>
        Object.freeze({
            ...definition,
            aliases: Object.freeze([...(definition.aliases ?? [])]),
            modelProviders: Object.freeze([
                ...(definition.modelProviders ?? []),
            ]),
            profileOutputRoot: definition.id,
        }),
    ),
);

export const passiveHarnesses = Object.freeze(
    harnesses.map((harness) => harness.id),
);
export const subscriptionHarnessIds = Object.freeze(
    harnesses.map((harness) => harness.subscriptionId),
);
export const fixtureOutputRoots = Object.freeze(
    harnesses.map((harness) => harness.fixtureOutputRoot),
);
export const claudeCompatibleHarnesses = Object.freeze(
    harnesses
        .filter((harness) => harness.adapterKind === "claude-compatible")
        .map((harness) => harness.id),
);
export const directProfileHarnesses = Object.freeze(
    harnesses
        .filter((harness) => harness.copySkillsDirectly)
        .map((harness) => harness.id),
);

const identifiers = new Map();
for (const harness of harnesses) {
    for (const identifier of new Set([
        harness.id,
        harness.subscriptionId,
        ...harness.aliases,
    ])) {
        const existing = identifiers.get(identifier);
        if (existing && existing !== harness)
            throw new Error(`Harness identifier is ambiguous: ${identifier}`);
        identifiers.set(identifier, harness);
    }
}

export function resolveHarness(identifier) {
    const harness = identifiers.get(identifier);
    if (!harness) throw new Error(`Unknown harness: ${identifier}`);
    return harness;
}

function expandSkillRoot(root, pluginName) {
    if (!root.includes("{plugin}")) return root === "." ? "" : root;
    if (!pluginName)
        throw new Error("pluginName is required for plugin harnesses");
    return root.replaceAll("{plugin}", pluginName);
}

export function profileSkillRoot(identifier, pluginName) {
    return expandSkillRoot(
        resolveHarness(identifier).profileSkillRoot,
        pluginName,
    );
}

export function fixtureSkillRoot(identifier, pluginName) {
    const harness = resolveHarness(identifier);
    const skillRoot = expandSkillRoot(harness.fixtureSkillRoot, pluginName);
    return [harness.fixtureOutputRoot, skillRoot].filter(Boolean).join("/");
}

export function fixtureSkillRoots(pluginName) {
    return harnesses
        .filter((harness) => harness.id !== "agent-skills")
        .map((harness) => fixtureSkillRoot(harness.id, pluginName));
}

export function harnessOutputsForProvider(providerId) {
    return harnesses
        .filter((harness) => harness.modelProviders.includes(providerId))
        .map((harness) => harness.fixtureOutputRoot);
}

export const forbiddenPathPolicy = Object.freeze({
    artifactSegments: Object.freeze([
        ".cache",
        ".git",
        ".pi",
        "agents",
        "cache",
        "commands",
        "engineering",
        "evals",
        "hooks",
        "instructions",
        "lsp",
        "prompts",
        "rules",
        "scripts",
        "tooling",
        "workflows",
    ]),
    publicRuntimePatterns: Object.freeze([
        "rules/**",
        "instructions/**",
        "agents/**",
        "prompts/**",
        "commands/**",
        "hooks/**",
        "lsp/**",
        "scripts/**",
        "evals/**",
        "tooling/**",
        ".ai/**",
    ]),
    artifactPatterns: Object.freeze([
        "**/scripts/**",
        "**/evals/**",
        "rules/**",
        "agents/**",
        "prompts/**",
        "commands/**",
        "hooks/**",
        "lsp/**",
        "tooling/**",
        "workflows/**",
        ".pi/**",
        ".git/**",
    ]),
    projectOwnedPaths: Object.freeze([
        ".cratis/PROJECT.md",
        ".agents/PROJECT.md",
        "AGENTS.md",
        "CLAUDE.md",
        "GEMINI.md",
    ]),
    engineeringAlwaysPatterns: Object.freeze([
        "**/evals/**",
        "**/scripts/**",
        "rules/**",
        "agents/**",
        "prompts/**",
        "commands/**",
        "hooks/**",
        "lsp/**",
        "workflows/**",
        "tooling/**",
        ".pi/**",
        ".git/**",
        "local-configuration/**",
    ]),
});

export function artifactForbiddenPathPatterns({
    audience,
    fixture = false,
} = {}) {
    if (audience === "public")
        return ["engineering/**", ...forbiddenPathPolicy.artifactPatterns];
    if (audience === "cratis-engineering")
        return [
            ...(fixture ? [] : ["skills/**"]),
            ...forbiddenPathPolicy.artifactPatterns,
            ...forbiddenPathPolicy.projectOwnedPaths,
        ];
    throw new Error(`Unknown artifact audience: ${audience}`);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function synchronizeSubscriptionHarnessEnum(path) {
    const content = readFileSync(path, "utf8");
    const harnessProperty = content.indexOf('    "harnesses": {');
    const enumStart = content.indexOf('        "enum": [', harnessProperty);
    const enumEnd = content.indexOf("\n        ]", enumStart);
    if (harnessProperty < 0 || enumStart < 0 || enumEnd < 0)
        throw new Error("Profile subscription harness enum is missing");
    const replacement = [
        '        "enum": [',
        ...subscriptionHarnessIds.map(
            (id, index) =>
                `          ${JSON.stringify(id)}${index === subscriptionHarnessIds.length - 1 ? "" : ","}`,
        ),
    ].join("\n");
    writeFileSync(
        path,
        `${content.slice(0, enumStart)}${replacement}${content.slice(enumEnd)}`,
    );
}

export function synchronizeHarnessRegistrySurfaces(repositoryRoot) {
    const root = resolve(repositoryRoot);
    const schemaPath = join(
        root,
        "distribution/profile-subscription.schema.json",
    );
    synchronizeSubscriptionHarnessEnum(schemaPath);

    const artifactMatrixPath = join(root, "distribution/artifact-matrix.json");
    const artifactMatrix = readJson(artifactMatrixPath);
    const targets = new Map(
        artifactMatrix.targets.map((target) => [target.id, target]),
    );
    for (const harness of harnesses) {
        const target = targets.get(harness.fixtureTargetId);
        if (!target)
            throw new Error(
                `Artifact matrix is missing ${harness.fixtureTargetId}`,
            );
        target.outputRoot = harness.fixtureOutputRoot;
    }
    writeJson(artifactMatrixPath, artifactMatrix);

    const engineeringMatrixPath = join(
        root,
        "distribution/engineering-artifact-matrix.json",
    );
    const engineeringMatrix = readJson(engineeringMatrixPath);
    engineeringMatrix.projectOwnedForbiddenPaths = [
        ...forbiddenPathPolicy.projectOwnedPaths,
    ];
    engineeringMatrix.alwaysForbiddenPaths = [
        ...forbiddenPathPolicy.engineeringAlwaysPatterns,
    ];
    writeJson(engineeringMatrixPath, engineeringMatrix);
}

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    synchronizeHarnessRegistrySurfaces(defaultRepositoryRoot);
