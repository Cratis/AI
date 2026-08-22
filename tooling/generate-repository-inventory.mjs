#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal, sortedOrdinal } from "./catalog-ordering.mjs";
import { readCatalog } from "./catalog-validation.mjs";
import { expandInventoryRecord } from "./catalog-v2-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = join(repositoryRoot, "catalog/v2/repository-inventory.json");
const inventoryOutputPath = "catalog/v2/repository-inventory.json";
const revision = "b795d5307e20f7f7458a67708b4f26975e223796";
const indexDigestExcludedPaths = [inventoryOutputPath];
const publicOwner = "public Cratis product capability";
const engineeringOwner = "reusable Cratis engineering behavior";
const ensembleOwner = "Ensemble";
const workflowsOwner = "Workflows organization mechanics";
const repositoryOwner = "repository-only authoring/release tooling";
const obsoleteOwner =
    "obsolete, with deletion deferred until replacement evidence exists";

function gitPaths(args) {
    return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" })
        .split("\0")
        .filter(Boolean);
}

function pathDigest(paths) {
    return createHash("sha256")
        .update(`${sortedOrdinal(paths).join("\n")}\n`)
        .digest("hex");
}

function indexDigest(excludedPaths) {
    const excluded = new Set(excludedPaths);
    const entries = gitPaths(["ls-files", "-s", "-z"])
        .filter((entry) => {
            const separator = entry.indexOf("\t");
            return separator >= 0 && !excluded.has(entry.slice(separator + 1));
        })
        .sort(compareOrdinal);
    const hash = createHash("sha256");
    for (const entry of entries) {
        hash.update(entry);
        hash.update("\0");
    }
    return hash.digest("hex");
}

function changesSinceBase(baseRevision) {
    const statusNames = new Map([
        ["A", "added"],
        ["M", "modified"],
        ["D", "deleted"],
        ["T", "type-changed"],
        ["U", "unmerged"],
        ["X", "unknown"],
    ]);
    const values = gitPaths([
        "diff",
        "--cached",
        "--no-renames",
        "--name-status",
        "-z",
        baseRevision,
        "--",
    ]);
    const changes = [];
    for (let index = 0; index < values.length; index += 2) {
        const status = statusNames.get(values[index]) ?? "unknown";
        const path = values[index + 1];
        if (!path) throw new Error("Git returned an incomplete change record");
        changes.push({ path, status });
    }
    return changes.sort((left, right) => compareOrdinal(left.path, right.path));
}

const excludedRuntimePrefixes = [".pi/delegate/", ".pi/fusion/", ".pi/tasks/"];
const tracked = gitPaths(["ls-files", "-z"]);
const admittedUntracked = gitPaths([
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
])
    .filter(
        (path) =>
            !excludedRuntimePrefixes.some((prefix) => path.startsWith(prefix)),
    )
    .sort(compareOrdinal);
const unexpectedUntracked = admittedUntracked.filter(
    (path) =>
        !(
            path === ".github/workflows/distribution-canary-rollback.yml" ||
            path === ".github/workflows/engineering-distribution-fixture.yml" ||
            path === ".github/workflows/distribution-generated-update.yml" ||
            path === ".github/workflows/distribution-npm-stage.yml" ||
            /^AI-REPOSITORY-REDESIGN-[A-Z0-9-]+\.md$/.test(path) ||
            /^Documentation\/(?:capability-catalog-v2|phase-0-verification|public-product-architecture|skill-authoring-contract|skill-classification-audit|project-context-bootstrap|redesign-foundation-validation|source-evidence-contract)\.md$/.test(
                path,
            ) ||
            /^Documentation\/evidence\/redesign-autonomous-execution-2026-08-20\//.test(
                path,
            ) ||
            /^catalog\//.test(path) ||
            /^distribution\//.test(path) ||
            /^engineering\//.test(path) ||
            /^evidence\/source-evidence\//.test(path) ||
            /^evals\//.test(path) ||
            /^pilots\//.test(path) ||
            /^tooling\//.test(path)
        ),
);
if (unexpectedUntracked.length > 0) {
    throw new Error(
        `Refusing to admit unexpected untracked files: ${unexpectedUntracked.join(", ")}`,
    );
}
const universe = [...tracked, ...admittedUntracked];
const v2Sources = readCatalog(join(repositoryRoot, "catalog/v2/sources.json"));
const publicSkillRoots = v2Sources.sources
    .filter((source) => source.audience === "public")
    .map((source) => `${source.sourcePath}/**`);
const legacyEngineeringSkillNames = [
    "add-cratis-docs-page",
    "add-traces",
    "cratis-csharp-standards",
    "edit-cratis-docs",
    "qa-cratis-docs",
    "ship-changes",
    "skill-creator",
    "write-documentation",
];
const engineeringSkillRoots = legacyEngineeringSkillNames.map(
    (name) => `.ai/skills/${name}/**`,
);

const definitions = [
    {
        id: "root-repository-metadata",
        sourcePathPatterns: [".gitignore", "LICENSE", "README.md"],
        artifactType: "repository-metadata",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [],
        risk: "low",
        migrationState: "retain",
        evidenceIds: ["repo-main-b795d53"],
    },
    {
        id: "root-instruction-adapter",
        sourcePathPatterns: ["AGENTS.md"],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: obsoleteOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/rules/general.md"],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68", "reevaluation-authority"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "root-skill-adapter",
        sourcePathPatterns: [".agents/skills"],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: obsoleteOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/skills"],
        risk: "critical",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68", "reevaluation-authority"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "engineering-corpus-readme",
        sourcePathPatterns: [".ai/README.md"],
        artifactType: "documentation",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".ai/**"],
        risk: "medium",
        migrationState: "classify-in-place",
        evidenceIds: ["repo-main-b795d53", "ai-126"],
    },
    {
        id: "engineering-rules",
        sourcePathPatterns: [".ai/rules/**"],
        artifactType: "rule",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [],
        risk: "high",
        migrationState: "classify-in-place",
        evidenceIds: ["repo-main-b795d53", "ai-126"],
    },
    {
        id: "ensemble-investigation-agents",
        sourcePathPatterns: [
            ".ai/agents/repository-investigation-reviewer.md",
            ".ai/agents/repository-investigator.md",
        ],
        artifactType: "agent",
        currentOwner: engineeringOwner,
        targetOwner: ensembleOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [],
        risk: "high",
        migrationState: "move-deferred",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "engineering-agents",
        sourcePathPatterns: [".ai/agents/**"],
        excludePathPatterns: [
            ".ai/agents/repository-investigation-reviewer.md",
            ".ai/agents/repository-investigator.md",
        ],
        artifactType: "agent",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".ai/rules/**"],
        risk: "high",
        migrationState: "classify-in-place",
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    },
    {
        id: "engineering-prompts",
        sourcePathPatterns: [".ai/prompts/**"],
        artifactType: "prompt-command",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".ai/rules/**", ".ai/skills/**"],
        risk: "high",
        migrationState: "classify-in-place",
        evidenceIds: ["repo-main-b795d53"],
    },
    {
        id: "engineering-hooks",
        sourcePathPatterns: [".ai/hooks/**"],
        artifactType: "hook",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".pi/extensions/cratis-hooks/index.ts"],
        risk: "critical",
        migrationState: "move-deferred",
        evidenceIds: ["repo-main-b795d53", "ai-126"],
    },
    {
        id: "workflows-claude-action-source",
        sourcePathPatterns: [".ai/workflows/**"],
        artifactType: "workflow",
        currentOwner: engineeringOwner,
        targetOwner: workflowsOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["anthropics/claude-code-action"],
        risk: "critical",
        migrationState: "move-deferred",
        evidenceIds: ["workflows-68", "reevaluation-authority"],
    },
    {
        id: "public-skill-sources-and-resources",
        sourcePathPatterns: publicSkillRoots,
        excludePathPatterns: [".ai/skills/*/evals/**"],
        artifactType: "skill-source-and-resources",
        currentOwner: engineeringOwner,
        targetOwner: publicOwner,
        runtimeEligibility: "candidate",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["catalog/v2/targets.json"],
        risk: "critical",
        migrationState: "blocked-by-distribution-decision",
        evidenceIds: [
            "repo-main-b795d53",
            "workflows-68",
            "reevaluation-authority",
        ],
    },
    {
        id: "engineering-skill-sources-and-resources",
        sourcePathPatterns: engineeringSkillRoots,
        excludePathPatterns: [".ai/skills/*/evals/**"],
        artifactType: "skill-source-and-resources",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["catalog/v2/targets.json"],
        risk: "critical",
        migrationState: "move-deferred",
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    },
    {
        id: "engineering-canonical-target-sources",
        sourcePathPatterns: ["engineering/skills/**"],
        artifactType: "skill-source-and-resources",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "candidate",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/targets.json",
            "distribution/engineering-artifact-matrix.json",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["option-a-plus-authority", "reevaluation-authority"],
    },
    {
        id: "skill-evaluations",
        sourcePathPatterns: [".ai/skills/*/evals/**"],
        artifactType: "evaluation",
        currentOwner: engineeringOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".ai/skills/**"],
        risk: "medium",
        migrationState: "move-deferred",
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    },
    {
        id: "claude-host-adapters",
        sourcePathPatterns: [".claude/**"],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/**"],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68", "reevaluation-authority"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "copilot-ensemble-agent-adapters",
        sourcePathPatterns: [
            ".github/agents/repository-investigation-reviewer.agent.md",
            ".github/agents/repository-investigator.agent.md",
        ],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: ensembleOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "path-reference",
        dependencies: [
            ".ai/agents/repository-investigation-reviewer.md",
            ".ai/agents/repository-investigator.md",
        ],
        risk: "high",
        migrationState: "move-deferred",
        evidenceIds: ["reevaluation-authority"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "copilot-engineering-agent-adapters",
        sourcePathPatterns: [".github/agents/**"],
        excludePathPatterns: [
            ".github/agents/repository-investigation-reviewer.agent.md",
            ".github/agents/repository-investigator.agent.md",
        ],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/agents/**"],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "copilot-corpus-adapters",
        sourcePathPatterns: [
            ".github/copilot-instructions.md",
            ".github/instructions",
            ".github/prompts",
            ".github/skills",
        ],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: obsoleteOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/rules/**", ".ai/prompts/**", ".ai/skills/**"],
        risk: "critical",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68", "reevaluation-authority"],
        generator: ".github/scripts/propagate-copilot-instructions.sh",
    },
    {
        id: "copilot-propagation-mechanics",
        sourcePathPatterns: [
            ".github/scripts/**",
            ".github/workflows/propagate-copilot-instructions.yml",
            ".github/workflows/sync-copilot-instructions.yml",
        ],
        artifactType: "propagation-script",
        currentOwner: engineeringOwner,
        targetOwner: workflowsOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["Cratis/Workflows"],
        risk: "critical",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68"],
    },
    {
        id: "obsolete-package-update-workflow",
        sourcePathPatterns: [".github/workflows/update-packages.yml"],
        artifactType: "workflow",
        currentOwner: repositoryOwner,
        targetOwner: obsoleteOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["ai-126"],
    },
    {
        id: "repository-validation-workflow",
        sourcePathPatterns: [
            ".github/workflows/distribution-canary-rollback.yml",
            ".github/workflows/engineering-distribution-fixture.yml",
            ".github/workflows/distribution-generated-update.yml",
            ".github/workflows/distribution-npm-stage.yml",
            ".github/workflows/verify-ai-corpus.yml",
        ],
        artifactType: "workflow",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["tooling/validate-catalogs.mjs", "tooling/specs/**"],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["repo-main-b795d53", "option-a-plus-authority"],
    },
    {
        id: "repository-github-metadata-and-cleanup",
        sourcePathPatterns: [
            ".github/ISSUE_TEMPLATE/**",
            ".github/pull_request_template.md",
            ".github/workflows/cleanup-pr-artifacts.yml",
        ],
        artifactType: "repository-metadata",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["repo-main-b795d53"],
    },
    {
        id: "pi-ensemble-agent-adapters",
        sourcePathPatterns: [
            ".pi/agents/repository-investigation-reviewer.md",
            ".pi/agents/repository-investigator.md",
        ],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: ensembleOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [
            ".ai/agents/repository-investigation-reviewer.md",
            ".ai/agents/repository-investigator.md",
        ],
        risk: "high",
        migrationState: "move-deferred",
        evidenceIds: ["reevaluation-authority"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "pi-engineering-agent-adapters",
        sourcePathPatterns: [".pi/agents/**"],
        excludePathPatterns: [
            ".pi/agents/repository-investigation-reviewer.md",
            ".pi/agents/repository-investigator.md",
        ],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/agents/**"],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "pi-prompt-adapters",
        sourcePathPatterns: [".pi/prompts/**"],
        artifactType: "adapter",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "derived",
        adapterStatus: "symlink-adapter",
        dependencies: [".ai/prompts/**"],
        risk: "high",
        migrationState: "retire-after-evidence",
        evidenceIds: ["workflows-68"],
        generator: "legacy-manual-adapter-model",
    },
    {
        id: "pi-hook-extension",
        sourcePathPatterns: [".pi/extensions/cratis-hooks/**"],
        artifactType: "pi-extension",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "adapter",
        dependencies: [".ai/hooks/scripts/**"],
        risk: "critical",
        migrationState: "move-deferred",
        evidenceIds: ["repo-main-b795d53", "ai-126"],
    },
    {
        id: "pi-subagent-extension",
        sourcePathPatterns: [".pi/extensions/subagent/**"],
        artifactType: "pi-extension",
        currentOwner: engineeringOwner,
        targetOwner: engineeringOwner,
        runtimeEligibility: "forbidden",
        generatedStatus: "source",
        adapterStatus: "adapter",
        dependencies: [".pi/agents/**", ".ai/agents/**"],
        risk: "critical",
        migrationState: "move-deferred",
        evidenceIds: ["repo-main-b795d53"],
    },
    {
        id: "autonomous-execution-evidence",
        sourcePathPatterns: [
            "Documentation/evidence/redesign-autonomous-execution-2026-08-20/**",
        ],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "Cratis/.github#24",
            "Cratis/Workflows#68",
            "Cratis/AI#126",
            "Cratis/AI#127",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: [
            "github-organization-24",
            "workflows-68",
            "option-a-plus-authority",
            "organization-option-a-plus-authority",
        ],
    },
    {
        id: "legacy-documentation",
        sourcePathPatterns: [
            "Documentation/agents.md",
            "Documentation/architecture.md",
            "Documentation/index.md",
            "Documentation/instructions-vs-skills.md",
            "Documentation/instructions.md",
            "Documentation/orchestrator.md",
            "Documentation/skills.md",
            "Documentation/verify-markdown.sh",
        ],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: obsoleteOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [".ai/**"],
        risk: "medium",
        migrationState: "retire-after-evidence",
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    },
    {
        id: "redesign-decision-documents",
        sourcePathPatterns: [
            "AI-REPOSITORY-REDESIGN-*.md",
            "Documentation/phase-0-verification.md",
            "Documentation/public-product-architecture.md",
            "Documentation/skill-classification-audit.md",
            "Documentation/project-context-bootstrap.md",
            "Documentation/redesign-foundation-validation.md",
        ],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["Cratis/.github#24", "Cratis/Workflows#68"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: [
            "github-organization-24",
            "workflows-68",
            "reevaluation-authority",
        ],
    },
    {
        id: "capability-model-documentation",
        sourcePathPatterns: ["Documentation/capability-catalog-v2.md"],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/bundles.json",
            "catalog/v2/source-contracts.json",
            "catalog/v2/taxonomy.json",
            "catalog/v2/upstream-companions.json",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["option-a-plus-authority"],
    },
    {
        id: "skill-authoring-documentation",
        sourcePathPatterns: ["Documentation/skill-authoring-contract.md"],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/authoring-contracts.json",
            "catalog/v2/human-catalog.json",
            "tooling/generate-human-catalog.mjs",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases", "third-party-skills-evaluation"],
    },
    {
        id: "code-review-pilot-source",
        sourcePathPatterns: ["pilots/evidence-bound-code-review/**"],
        artifactType: "pilot",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["catalog/v2/authoring-contracts.json"],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "code-review-pilot-evaluations",
        sourcePathPatterns: ["evals/evidence-bound-code-review/**"],
        artifactType: "evaluation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["pilots/evidence-bound-code-review/**"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "event-modeling-pilot-source",
        sourcePathPatterns: ["pilots/domain-expert-event-modeling/**"],
        artifactType: "pilot",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["catalog/v2/authoring-contracts.json"],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "event-modeling-pilot-evaluations",
        sourcePathPatterns: ["evals/domain-expert-event-modeling/**"],
        artifactType: "evaluation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["pilots/domain-expert-event-modeling/**"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "engineering-docs-authoring-evaluations",
        sourcePathPatterns: ["evals/cratis-engineering-docs-authoring/**"],
        artifactType: "evaluation",
        currentOwner: engineeringOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "engineering/skills/cratis-engineering-docs-authoring/**",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "engineering-docs-companion-evaluations",
        sourcePathPatterns: ["evals/cratis-engineering-docs-companions/**"],
        artifactType: "evaluation",
        currentOwner: engineeringOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "engineering/skills/cratis-engineering-docs-add-page/**",
            "engineering/skills/cratis-engineering-docs-edit-page/**",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "source-evidence-contract-v1",
        sourcePathPatterns: [
            "Documentation/source-evidence-contract.md",
            "evidence/source-evidence/**",
        ],
        artifactType: "repository-metadata",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/source-contracts.json",
            "pilots/application-slice-diagnostics/**",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "diagnostics-pilot-source",
        sourcePathPatterns: ["pilots/application-slice-diagnostics/**"],
        artifactType: "pilot",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/authoring-contracts.json",
            "catalog/v2/source-contracts.json",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "diagnostics-pilot-evaluations",
        sourcePathPatterns: ["evals/application-slice-diagnostics/**"],
        artifactType: "evaluation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["pilots/application-slice-diagnostics/**"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "navigator-pilot-source",
        sourcePathPatterns: ["pilots/cratis-navigator/**"],
        artifactType: "pilot",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/authoring-contracts.json",
            "catalog/v2/targets.json",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "navigator-pilot-evaluations",
        sourcePathPatterns: ["evals/cratis-navigator/**"],
        artifactType: "evaluation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["pilots/cratis-navigator/**"],
        risk: "low",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases"],
    },
    {
        id: "catalog-v1-scaffold",
        sourcePathPatterns: [
            "catalog/ecosystem-versions.json",
            "catalog/product-coverage.yml",
            "catalog/public-skills.yml",
            "catalog/schemas/ecosystem-versions.schema.json",
            "catalog/schemas/product-coverage.schema.json",
            "catalog/schemas/public-skills.schema.json",
        ],
        artifactType: "catalog-schema",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["tooling/catalog-validation.mjs"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "catalog-v2-authored-registries",
        sourcePathPatterns: [
            "catalog/v2/authoring-contracts.json",
            "catalog/v2/bundles.json",
            "catalog/v2/human-catalog.json",
            "catalog/v2/source-contracts.json",
            "catalog/v2/taxonomy.json",
            "catalog/v2/upstream-companions.json",
        ],
        artifactType: "catalog-schema",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "catalog/schemas/v2/catalog-v2.schema.json",
            "tooling/catalog-v2-validation.mjs",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["ecosystem-use-cases", "third-party-skills-evaluation"],
    },
    {
        id: "catalog-v2-generated-surfaces",
        sourcePathPatterns: ["catalog/v2/**"],
        excludePathPatterns: [
            "catalog/v2/authoring-contracts.json",
            "catalog/v2/bundles.json",
            "catalog/v2/human-catalog.json",
            "catalog/v2/source-contracts.json",
            "catalog/v2/taxonomy.json",
            "catalog/v2/upstream-companions.json",
        ],
        artifactType: "catalog-schema",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "generated",
        adapterStatus: "none",
        dependencies: [
            "tooling/generate-catalog-v2.mjs",
            "tooling/generate-repository-inventory.mjs",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
        generator:
            "tooling/generate-catalog-v2.mjs and tooling/generate-repository-inventory.mjs",
    },
    {
        id: "generated-human-catalog",
        sourcePathPatterns: ["catalog/generated/human-catalog/**"],
        artifactType: "documentation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "generated",
        adapterStatus: "none",
        dependencies: [
            "catalog/v2/human-catalog.json",
            "catalog/v2/targets.json",
            "tooling/generate-human-catalog.mjs",
        ],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["option-a-plus-authority"],
        generator: "tooling/generate-human-catalog.mjs",
    },
    {
        id: "catalog-v2-schema",
        sourcePathPatterns: ["catalog/schemas/v2/**"],
        artifactType: "catalog-schema",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["tooling/catalog-v2-validation.mjs"],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "distribution-foundation",
        sourcePathPatterns: ["distribution/**"],
        artifactType: "repository-metadata",
        currentOwner: repositoryOwner,
        targetOwner: "Workflows organization mechanics",
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "adapter",
        dependencies: [
            "catalog/v2/artifacts.json",
            "tooling/public-artifact-materializer.mjs",
        ],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["option-a-plus-authority"],
    },
    {
        id: "catalog-and-redesign-tooling",
        sourcePathPatterns: ["tooling/*.mjs"],
        artifactType: "validation-tooling",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["catalog/**"],
        risk: "high",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "catalog-and-materializer-specs",
        sourcePathPatterns: ["tooling/specs/**"],
        artifactType: "evaluation",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: ["tooling/*.mjs", "catalog/**"],
        risk: "medium",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
    {
        id: "sanitized-redesign-fixtures",
        sourcePathPatterns: ["tooling/fixtures/**"],
        artifactType: "test-fixture",
        currentOwner: repositoryOwner,
        targetOwner: repositoryOwner,
        runtimeEligibility: "repository-only",
        generatedStatus: "source",
        adapterStatus: "none",
        dependencies: [
            "tooling/public-artifact-materializer.mjs",
            "tooling/project-context-bootstrap.mjs",
        ],
        risk: "low",
        migrationState: "retain",
        evidenceIds: ["reevaluation-authority"],
    },
];

const records = definitions.map((definition) => {
    const record = { excludePathPatterns: [], ...definition };
    const paths = expandInventoryRecord(record, universe);
    if (paths.length === 0)
        throw new Error(`Inventory record ${record.id} matches no paths`);
    return {
        ...record,
        expectedPathCount: paths.length,
        expectedPathsDigest: pathDigest(paths),
    };
});

const output = {
    schemaVersion: 2,
    baseRevision: revision,
    indexDigest: indexDigest(indexDigestExcludedPaths),
    indexDigestExcludedPaths,
    changesSinceBase: changesSinceBase(revision),
    admittedUntracked,
    excludedRuntimePrefixes,
    records,
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
    `Generated repository inventory: ${records.length} groups account for ${universe.length} tracked and admitted paths.\n`,
);
