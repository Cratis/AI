#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { readCatalog } from "./catalog-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = join(repositoryRoot, "catalog/v2");
const revision = "b795d5307e20f7f7458a67708b4f26975e223796";
const sourceRevisionEvidenceId = "repo-main-b795d53";
const publicOwner = "public Cratis product capability";
const engineeringOwner = "reusable Cratis engineering behavior";
const v1Public = readCatalog(join(repositoryRoot, "catalog/public-skills.yml"));
const v1Coverage = readCatalog(
    join(repositoryRoot, "catalog/product-coverage.yml"),
);
const v1Ecosystems = readCatalog(
    join(repositoryRoot, "catalog/ecosystem-versions.json"),
);
const releaseApprovals = readCatalog(
    join(repositoryRoot, "distribution/release-approvals.json"),
);
if (
    releaseApprovals.schemaVersion !== "1.0.0" ||
    releaseApprovals.defaultPolicy !== "deny"
)
    throw new Error("Release approval catalog contract changed");
const targetApprovals = new Map(
    releaseApprovals.targetApprovals.map((approval) => [
        approval.targetId,
        approval,
    ]),
);
if (targetApprovals.size !== releaseApprovals.targetApprovals.length)
    throw new Error("Release approval catalog contains duplicate targets");

const internalTargets = new Map([
    ["add-cratis-docs-page", "cratis-engineering-docs-add-page"],
    ["add-traces", "cratis-engineering-chronicle-kernel-tracing"],
    ["cratis-csharp-standards", "cratis-engineering-csharp-conventions"],
    ["edit-cratis-docs", "cratis-engineering-docs-edit-page"],
    ["qa-cratis-docs", "cratis-engineering-docs-visual-qa"],
    ["ship-changes", "cratis-engineering-ship-changes"],
    ["skill-creator", "skill-creator"],
    ["write-documentation", "cratis-engineering-docs-authoring"],
]);

const publicClassifications = new Map([
    [
        "cratis-fundamentals-concept",
        {
            capabilityKind: "primitive",
            invocation: "both",
            products: ["chronicle", "fundamentals"],
            languages: ["csharp"],
            architectures: {
                state: "applicable",
                ids: ["product-neutral"],
                reason: "Strongly typed domain values and Chronicle stream identities apply across application and library architectures.",
            },
            personas: {
                state: "applicable",
                ids: ["contributor", "developer", "maintainer"],
                reason: "Developers and maintainers create and review strongly typed domain values.",
            },
            surfaces: {
                state: "applicable",
                ids: ["backend", "direct-agent-skills", "ide", "pi"],
                reason: "The passive skill guides C# source changes from supported agent and IDE surfaces.",
            },
            repositoryProfiles: {
                state: "applicable",
                ids: [
                    "application",
                    "client",
                    "consuming-project",
                    "framework",
                ],
                reason: "Concepts appear in consuming applications, framework code, and client libraries.",
            },
            trust: {
                class: "passive",
                assessmentState: "assessed",
                effects: [
                    {
                        id: "create-or-modify-concept-source",
                        operation: "modify",
                        resourceBoundary: "current repository worktree",
                        scope: "one domain concept or Chronicle event-source identity source file selected by the user",
                        dataClassifications: [
                            "confidential",
                            "internal",
                            "public",
                        ],
                        reversible: true,
                        rollbackOrCompensation:
                            "Restore the prior uncommitted file or revert the dedicated source commit.",
                        confirmation: {
                            required: true,
                            timing: "before-effect",
                            reason: "The repository owner confirms the target domain type and file before source changes.",
                        },
                        authorization: {
                            required: true,
                            authority: "Repository maintainer or task owner",
                            evidenceIds: ["ai-126"],
                        },
                        evidenceIds: [
                            "fundamentals-concept-source-review-2026-08-23",
                        ],
                    },
                ],
            },
            security: {
                executable: false,
                destructive: false,
                risk: "low",
                disposition: "accepted",
                evidenceIds: ["fundamentals-concept-source-review-2026-08-23"],
            },
            dependencyEdges: [
                {
                    dependencyId: "dotnet",
                    category: "tool",
                    strength: "hard",
                    reason: "The generated C# type must compile and its specifications must run against the verified packages.",
                    missingBehavior: {
                        action: "block",
                        description:
                            "Stop before claiming completion when the .NET SDK and project gates are unavailable.",
                    },
                },
            ],
            targetDependencies: [],
            internalArtifacts: [],
            sourceContractIds: [
                "cratis-fundamentals-source",
                "cratis-chronicle-source",
            ],
            sourceAuthoritySubjects: [
                "api",
                "documentation",
                "examples",
                "versions",
            ],
            authoringContractIds: ["cratis-skill-clean-room-v1"],
            runtimeAllowed: [
                "SKILL.md",
                "references/**",
                "assets/**",
                "LICENSE*",
            ],
            behaviorEvaluationEvidenceId:
                "fundamentals-concept-focused-evaluation-2026-08-23",
            routingEvaluationEvidenceId:
                "fundamentals-concept-focused-evaluation-2026-08-23",
            evidenceIds: [
                "fundamentals-concept-source-review-2026-08-23",
                "fundamentals-concept-focused-evaluation-2026-08-23",
                "fundamentals-concept-samples-canary-2026-08-23",
            ],
        },
    ],
]);

const sourceOverrides = new Map([
    [
        "add-concept",
        {
            sourcePath: "skills/cratis-fundamentals-concept",
            sourceRevision: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
            evidenceId: "public-fundamentals-concept-source-b53caa5",
        },
    ],
    [
        "add-cratis-docs-page",
        {
            sourcePath: "engineering/skills/cratis-engineering-docs-add-page",
            sourceRevision: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
            evidenceId: "engineering-docs-add-page-source-684d037",
        },
    ],
    [
        "edit-cratis-docs",
        {
            sourcePath: "engineering/skills/cratis-engineering-docs-edit-page",
            sourceRevision: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
            evidenceId: "engineering-docs-edit-page-source-684d037",
        },
    ],
    [
        "write-documentation",
        {
            sourcePath: "engineering/skills/cratis-engineering-docs-authoring",
            sourceRevision: "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9",
            evidenceId: "engineering-docs-authoring-source-f58bcf7",
        },
    ],
]);

function documentationEffect(id, operation, scope, rollback) {
    return {
        id,
        operation,
        resourceBoundary: "current repository worktree",
        scope,
        dataClassifications: ["internal", "public"],
        reversible: true,
        rollbackOrCompensation: rollback,
        confirmation: {
            required: true,
            timing: "before-effect",
            reason: "The repository maintainer confirms the exact documentation paths before files change.",
        },
        authorization: {
            required: true,
            authority: "Repository maintainer or task owner",
            evidenceIds: ["ai-126"],
        },
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    };
}

function documentationCompanionClassification({
    effects,
    dependencyEdges,
    targetDependencies,
}) {
    return {
        capabilityKind: "journey",
        invocation: "both",
        architectures: {
            state: "applicable",
            ids: ["product-neutral"],
            reason: "Documentation integration applies across Cratis products without assuming an application architecture.",
        },
        personas: {
            state: "applicable",
            ids: ["contributor", "maintainer"],
            reason: "Contributors and maintainers integrate reviewed Cratis documentation.",
        },
        surfaces: {
            state: "applicable",
            ids: ["direct-agent-skills", "ide"],
            reason: "The workflow is an instruction-only skill used from an agent or IDE session.",
        },
        repositoryProfiles: {
            state: "applicable",
            ids: ["application", "client", "corpus", "framework"],
            reason: "Documentation can be owned by application, client, framework, or corpus repositories.",
        },
        trust: {
            class: "passive",
            assessmentState: "assessed",
            effects,
        },
        dependencyEdges,
        targetDependencies,
        internalArtifacts: [],
        sourceContractIds: ["cratis-ai-composition"],
        sourceAuthoritySubjects: ["capability-composition"],
        authoringContractIds: ["cratis-skill-clean-room-v1"],
        runtimeAllowed: ["SKILL.md", "references/**", "assets/**", "LICENSE*"],
    };
}

const engineeringClassifications = new Map([
    [
        "cratis-engineering-docs-add-page",
        documentationCompanionClassification({
            effects: [
                documentationEffect(
                    "create-documentation-page",
                    "create",
                    "one approved documentation source page",
                    "Delete the uncommitted page or revert the dedicated documentation commit.",
                ),
                documentationEffect(
                    "modify-documentation-navigation",
                    "modify",
                    "owning ToC and site navigation entries required for the approved page",
                    "Restore the prior navigation bytes or revert the dedicated documentation commit.",
                ),
            ],
            dependencyEdges: [
                {
                    dependencyId: "cratis-engineering-docs-authoring",
                    category: "target",
                    strength: "soft",
                    reason: "A new page needs approved content after placement is known.",
                    missingBehavior: {
                        action: "degrade",
                        description:
                            "Place only already approved content; otherwise stop after the placement plan.",
                    },
                },
                {
                    dependencyId: "cratis-engineering-docs-visual-qa",
                    category: "target",
                    strength: "optional",
                    reason: "Rendered visual review is a separate completion enhancement.",
                    missingBehavior: {
                        action: "omit",
                        description:
                            "Report visual QA as outstanding without claiming rendered quality.",
                    },
                },
            ],
            targetDependencies: [
                "cratis-engineering-docs-authoring",
                "cratis-engineering-docs-visual-qa",
            ],
        }),
    ],
    [
        "cratis-engineering-docs-edit-page",
        documentationCompanionClassification({
            effects: [
                documentationEffect(
                    "modify-documentation-page",
                    "modify",
                    "one authoritative existing documentation source page and navigation only when its title or slug changes",
                    "Restore the prior source/navigation bytes or revert the dedicated documentation commit.",
                ),
            ],
            dependencyEdges: [
                {
                    dependencyId: "cratis-engineering-docs-authoring",
                    category: "target",
                    strength: "soft",
                    reason: "Substantial content redesign is delegated to the authoring workflow.",
                    missingBehavior: {
                        action: "degrade",
                        description:
                            "Apply only narrow source-backed corrections; block substantial redesign.",
                    },
                },
                {
                    dependencyId: "cratis-engineering-docs-visual-qa",
                    category: "target",
                    strength: "optional",
                    reason: "Rendered visual review is a separate completion enhancement.",
                    missingBehavior: {
                        action: "omit",
                        description:
                            "Report visual QA as outstanding without claiming rendered quality.",
                    },
                },
            ],
            targetDependencies: [
                "cratis-engineering-docs-authoring",
                "cratis-engineering-docs-visual-qa",
            ],
        }),
    ],
    [
        "cratis-engineering-docs-authoring",
        {
            capabilityKind: "journey",
            invocation: "both",
            architectures: {
                state: "applicable",
                ids: ["product-neutral"],
                reason: "Documentation authoring applies across Cratis products without assuming an application architecture.",
            },
            personas: {
                state: "applicable",
                ids: ["contributor", "maintainer"],
                reason: "Contributors and maintainers author reviewed Cratis documentation.",
            },
            surfaces: {
                state: "applicable",
                ids: ["direct-agent-skills", "ide"],
                reason: "The workflow is an instruction-only skill used from an agent or IDE session.",
            },
            repositoryProfiles: {
                state: "applicable",
                ids: ["application", "client", "corpus", "framework"],
                reason: "Documentation can be owned by application, client, framework, or corpus repositories.",
            },
            trust: {
                class: "passive",
                assessmentState: "assessed",
                effects: [
                    {
                        id: "create-repository-documentation",
                        operation: "create",
                        resourceBoundary: "current repository worktree",
                        scope: "Documentation source and navigation files selected by the owning repository",
                        dataClassifications: ["internal", "public"],
                        reversible: true,
                        rollbackOrCompensation:
                            "Delete the uncommitted page or revert the dedicated documentation commit.",
                        confirmation: {
                            required: true,
                            timing: "before-effect",
                            reason: "The repository maintainer confirms the proposed documentation paths before files are created.",
                        },
                        authorization: {
                            required: true,
                            authority: "Repository maintainer or task owner",
                            evidenceIds: ["ai-126"],
                        },
                        evidenceIds: [
                            "repo-main-b795d53",
                            "reevaluation-authority",
                        ],
                    },
                    {
                        id: "modify-repository-documentation",
                        operation: "modify",
                        resourceBoundary: "current repository worktree",
                        scope: "Documentation source and navigation files selected by the owning repository",
                        dataClassifications: ["internal", "public"],
                        reversible: true,
                        rollbackOrCompensation:
                            "Restore the prior bytes or revert the dedicated documentation commit.",
                        confirmation: {
                            required: true,
                            timing: "before-effect",
                            reason: "The repository maintainer confirms the proposed documentation paths before existing files are changed.",
                        },
                        authorization: {
                            required: true,
                            authority: "Repository maintainer or task owner",
                            evidenceIds: ["ai-126"],
                        },
                        evidenceIds: [
                            "repo-main-b795d53",
                            "reevaluation-authority",
                        ],
                    },
                ],
            },
            dependencyEdges: [],
            targetDependencies: [],
            internalArtifacts: [],
            sourceContractIds: ["cratis-ai-composition"],
            sourceAuthoritySubjects: ["capability-composition"],
            routingEvaluationEvidenceId:
                "engineering-docs-authoring-evaluation-2026-08-22",
            authoringContractIds: ["cratis-skill-clean-room-v1"],
            runtimeAllowed: [
                "SKILL.md",
                "references/**",
                "assets/**",
                "LICENSE*",
            ],
        },
    ],
]);

const profiles = {
    "cratis-arc-command-validation": [
        "Arc command validation",
        "Use when adding validation or state-dependent rejection to an existing Arc command.",
        [
            "Do not use to define a new command.",
            "Do not use for append-time Chronicle constraints.",
        ],
        ["cratis-arc-command", "cratis-chronicle-event-constraints"],
        "high",
        false,
    ],
    "cratis-chronicle-event-constraints": [
        "Chronicle event constraints",
        "Use when enforcing append-time uniqueness, concurrency, or event-store constraints.",
        [
            "Do not use for ordinary command input validation.",
            "Do not use to create a projection.",
        ],
        [
            "cratis-arc-command-validation",
            "cratis-chronicle-event-specifications",
        ],
        "high",
        false,
    ],
    "cratis-fundamentals-concept": [
        "Strongly typed Cratis concepts",
        "Use when creating a ConceptAs<T> value or EventSourceId<T> identity.",
        [
            "Do not use for DTO cleanup.",
            "Do not use for event schema migration.",
        ],
        ["cratis-chronicle-event-type-migration"],
        "medium",
        false,
    ],
    "cratis-arc-ef-core-migration": [
        "Arc EF Core migrations",
        "Use when adding or changing an EF Core schema in a Cratis application.",
        [
            "Do not use for Chronicle read models.",
            "Do not use for query paging.",
        ],
        ["cratis-chronicle-read-model", "cratis-arc-query-paging"],
        "high",
        true,
    ],
    "cratis-chronicle-projection": [
        "Chronicle projections",
        "Use when adding projection behavior to an existing Chronicle read model.",
        [
            "Do not use to create the read model itself.",
            "Do not use when a reducer is not genuinely required.",
        ],
        ["cratis-chronicle-read-model", "cratis-chronicle-reducer"],
        "high",
        false,
    ],
    "cratis-chronicle-reactor": [
        "Chronicle reactors",
        "Use when implementing an automation or translation that reacts to events.",
        [
            "Do not use for projections.",
            "Do not use for an ordinary backend command call.",
        ],
        ["cratis-chronicle-projection", "cratis-arc-command-execution"],
        "high",
        true,
    ],
    "cratis-chronicle-reducer": [
        "Chronicle reducers",
        "Use when a current-state-plus-event transition cannot be expressed as a projection.",
        [
            "Do not use for simple mapping.",
            "Do not use before projection alternatives are exhausted.",
        ],
        ["cratis-chronicle-projection", "cratis-chronicle-read-model"],
        "high",
        false,
    ],
    "cratis-arc-authentication-authorization-and-identity": [
        "Arc authentication, authorization, and identity",
        "Use for Arc identity providers, endpoint protection, roles, or frontend identity integration.",
        [
            "Do not use for isolated command validation.",
            "Do not use for tenant namespaces alone.",
        ],
        ["cratis-arc-command-validation", "cratis-chronicle-multi-tenancy"],
        "critical",
        false,
    ],
    "cratis-arc-command-execution": [
        "Arc command pipeline execution",
        "Use when backend code must execute an existing Arc command through ICommandPipeline.",
        [
            "Do not use to define a command.",
            "Do not use for reactor design alone.",
        ],
        ["cratis-arc-command", "cratis-chronicle-reactor"],
        "high",
        true,
    ],
    "cratis-arc-command": [
        "Arc command definition",
        "Use when defining an Arc command and its generated full-stack proxy workflow.",
        [
            "Do not use for a validation-only change.",
            "Do not use only to execute an existing command.",
        ],
        ["cratis-arc-command-validation", "cratis-arc-command-execution"],
        "high",
        false,
    ],
    "cratis-arc-react-page": [
        "Arc React pages",
        "Use when building a DataPage or MVVM React page backed by generated Arc queries.",
        [
            "Do not use for an empty route shell.",
            "Do not use for a multi-step wizard alone.",
        ],
        [
            "cratis-arc-react-feature-scaffolding",
            "cratis-components-stepper-command-dialog",
        ],
        "medium",
        false,
    ],
    "cratis-chronicle-read-model": [
        "Chronicle read models",
        "Use when creating a Chronicle read model and model-bound query surface.",
        [
            "Do not use for projection-only changes.",
            "Do not default to a reducer.",
        ],
        [
            "cratis-chronicle-projection",
            "cratis-chronicle-reducer",
            "cratis-arc-query-paging",
        ],
        "high",
        false,
    ],
    "cratis-specifications-csharp": [
        "Cratis C# specification foundations",
        "Use for framework or library C# Specification by Example tests.",
        [
            "Do not use for application scenario routing.",
            "Do not use for React tests.",
        ],
        [
            "cratis-application-slice-specifications",
            "cratis-specifications-typescript",
        ],
        "low",
        false,
    ],
    "cratis-specifications-typescript": [
        "Cratis TypeScript specification foundations",
        "Use for framework or package TypeScript Specification by Example tests.",
        [
            "Do not use for React application slice behavior.",
            "Do not use for C# scenarios.",
        ],
        [
            "cratis-application-react-specifications",
            "cratis-specifications-csharp",
        ],
        "low",
        false,
    ],
    "cratis-application-vertical-slice": [
        "Cratis application vertical slices",
        "Use for vertical-slice architecture selection or end-to-end implementation after the merge experiment passes.",
        [
            "Do not use only to scaffold an empty feature shell.",
            "Do not assume architecture explanation and implementation triggers are equivalent.",
        ],
        [
            "cratis-arc-react-feature-scaffolding",
            "cratis-chronicle-event-modeling",
        ],
        "high",
        false,
    ],
    "cratis-event-model-diagram": [
        "Event-model diagrams",
        "Use when creating or maintaining a Mermaid EventModel.md diagram for settled behavior.",
        [
            "Do not use to settle event vocabulary.",
            "Do not use to implement a slice.",
        ],
        [
            "cratis-chronicle-event-modeling",
            "cratis-application-vertical-slice",
        ],
        "low",
        false,
    ],
    "cratis-chronicle-event-metadata": [
        "Chronicle event metadata",
        "Use when attaching audit, actor, tenant, or correlation metadata outside domain event payloads.",
        [
            "Do not use for domain facts.",
            "Do not use for tenant isolation alone.",
        ],
        ["cratis-chronicle-multi-tenancy"],
        "high",
        false,
    ],
    "cratis-application-slice-diagnostics": [
        "Application slice diagnostics",
        "Use when a Cratis slice misbehaves and source-level cause is unclear.",
        [
            "Do not use for direct live-store operation.",
            "Do not use only for observable-query HTTP inspection.",
        ],
        ["cratis-chronicle-cli-operations", "cratis-arc-observable-query-http"],
        "medium",
        false,
    ],
    "cratis-fundamentals-type-discovery": [
        "Cratis implementation discovery",
        "Use when a service must enumerate all implementations through IInstancesOf<T>.",
        ["Do not use for normal single-service dependency injection."],
        [],
        "medium",
        false,
    ],
    "cratis-chronicle-event-modeling": [
        "Chronicle event modeling",
        "Use before implementation when commands, events, streams, read models, or reactions are unsettled.",
        [
            "Do not use only to edit a Mermaid diagram.",
            "Do not use when the model is already accepted.",
        ],
        ["cratis-event-model-diagram", "cratis-application-vertical-slice"],
        "high",
        false,
    ],
    "cratis-chronicle-event-type-migration": [
        "Chronicle event type migration",
        "Use when a stored event schema needs a new generation and migration.",
        ["Do not use for a new event.", "Do not use for an EF Core migration."],
        ["cratis-arc-ef-core-migration"],
        "critical",
        false,
    ],
    "cratis-chronicle-cli-operations": [
        "Chronicle CLI operations",
        "Use to inspect a running Chronicle store and, only with explicit confirmation, perform recovery operations.",
        [
            "Do not use for source-only diagnostics.",
            "Do not mutate a store without an explicit target and confirmation.",
        ],
        [
            "cratis-application-slice-diagnostics",
            "cratis-arc-observable-query-http",
        ],
        "critical",
        true,
    ],
    "cratis-chronicle-multi-tenancy": [
        "Chronicle multi-tenancy",
        "Use when isolating tenants through Chronicle namespaces and Arc tenant resolution.",
        [
            "Do not use for identity alone.",
            "Do not use for event metadata alone.",
        ],
        [
            "cratis-arc-authentication-authorization-and-identity",
            "cratis-chronicle-event-metadata",
        ],
        "critical",
        false,
    ],
    "cratis-arc-observable-query-http": [
        "Arc observable-query HTTP diagnostics",
        "Use when inspecting Arc observable query SSE or streaming behavior with curl or HTTP tools.",
        [
            "Do not use to implement the frontend query.",
            "Do not use for Chronicle store recovery.",
        ],
        [
            "cratis-application-slice-diagnostics",
            "cratis-chronicle-cli-operations",
        ],
        "medium",
        false,
    ],
    "cratis-arc-query-paging": [
        "Arc query paging",
        "Use when adding server-side paging and sorting to an Arc read-model query.",
        [
            "Do not use for generic query creation.",
            "Do not use as a general performance review.",
        ],
        ["cratis-chronicle-read-model", "cratis-performance-review"],
        "medium",
        false,
    ],
    "cratis-code-review": [
        "Cratis code review",
        "Use for a general correctness and maintainability review of Cratis code.",
        [
            "Do not substitute it for a focused security audit.",
            "Do not duplicate specialist performance findings.",
        ],
        ["cratis-performance-review", "cratis-security-review"],
        "medium",
        false,
    ],
    "cratis-performance-review": [
        "Cratis performance review",
        "Use for focused Chronicle, database, .NET, or React scalability analysis.",
        [
            "Do not use for ordinary implementation.",
            "Do not override authoritative paging guidance.",
        ],
        ["cratis-code-review", "cratis-arc-query-paging"],
        "high",
        false,
    ],
    "cratis-security-review": [
        "Cratis security review",
        "Use for focused authentication, authorization, data exposure, event-sourcing, and frontend security review.",
        [
            "Do not use to implement authentication.",
            "Do not treat policy preferences as framework contracts.",
        ],
        [
            "cratis-code-review",
            "cratis-arc-authentication-authorization-and-identity",
        ],
        "critical",
        false,
    ],
    "cratis-arc-react-feature-scaffolding": [
        "Arc React feature scaffolding",
        "Use when creating an empty route, navigation entry, and feature composition shell.",
        [
            "Do not use to implement a behavior slice.",
            "Do not use for a populated DataPage.",
        ],
        ["cratis-application-vertical-slice", "cratis-arc-react-page"],
        "medium",
        false,
    ],
    "cratis-components-stepper-command-dialog": [
        "Cratis Components stepper command dialogs",
        "Use when a command requires a multi-step wizard dialog.",
        [
            "Do not use for an ordinary command dialog.",
            "Do not use for a page shell.",
        ],
        ["cratis-arc-command", "cratis-arc-react-page"],
        "medium",
        false,
    ],
    "cratis-components-toolbar": [
        "Cratis Components toolbar",
        "Use when building a canvas-style icon toolbar with active tools or fan-out controls.",
        ["Do not use for ordinary page actions or menus."],
        ["cratis-arc-react-page"],
        "low",
        false,
    ],
    "cratis-application-slice-specifications": [
        "Application slice specifications",
        "Use to route event-sourced application backend behavior to the correct in-process scenario family.",
        [
            "Do not use for framework library specifications.",
            "Do not use for frontend behavior.",
        ],
        [
            "cratis-specifications-csharp",
            "cratis-chronicle-event-specifications",
            "cratis-chronicle-read-model-specifications",
        ],
        "medium",
        false,
    ],
    "cratis-chronicle-event-specifications": [
        "Chronicle event specifications",
        "Use for EventScenario append, constraint, concurrency, or sequence behavior.",
        [
            "Do not use for command handling.",
            "Do not use for read-model projection behavior.",
        ],
        [
            "cratis-application-slice-specifications",
            "cratis-chronicle-read-model-specifications",
        ],
        "medium",
        false,
    ],
    "cratis-application-react-specifications": [
        "Application React specifications",
        "Use for React or TypeScript behavior in a Cratis application slice.",
        [
            "Do not use for framework package TypeScript specs.",
            "Do not use for backend scenarios.",
        ],
        [
            "cratis-specifications-typescript",
            "cratis-application-slice-specifications",
        ],
        "low",
        false,
    ],
    "cratis-chronicle-read-model-specifications": [
        "Chronicle read-model specifications",
        "Use for ReadModelScenario projection or reducer behavior.",
        [
            "Do not use for read-model creation.",
            "Do not use for raw event append behavior.",
        ],
        [
            "cratis-chronicle-event-specifications",
            "cratis-chronicle-read-model",
        ],
        "medium",
        false,
    ],
    "cratis-engineering-docs-add-page": [
        "Cratis documentation page creation",
        "Use by Cratis maintainers to add a source-owned product documentation page.",
        ["Do not use to edit or visually QA an existing page."],
        [
            "cratis-engineering-docs-edit-page",
            "cratis-engineering-docs-authoring",
        ],
        "medium",
        false,
    ],
    "cratis-engineering-chronicle-kernel-tracing": [
        "Chronicle Kernel tracing maintenance",
        "Use by Chronicle framework maintainers to add generated OpenTelemetry traces.",
        [
            "Do not use for application telemetry or generic OpenTelemetry setup.",
        ],
        [],
        "high",
        false,
    ],
    "cratis-engineering-csharp-conventions": [
        "Cratis C# engineering conventions",
        "Use for Cratis-maintainer C# house standards and review policy.",
        [
            "Do not expose broad engineering policy as a public product capability.",
        ],
        ["cratis-code-review"],
        "medium",
        false,
    ],
    "cratis-engineering-docs-edit-page": [
        "Cratis documentation page editing",
        "Use by Cratis maintainers to edit the source-owned copy of an existing documentation page.",
        ["Do not use to add a new page or perform visual QA."],
        [
            "cratis-engineering-docs-add-page",
            "cratis-engineering-docs-visual-qa",
        ],
        "medium",
        false,
    ],
    "cratis-engineering-docs-visual-qa": [
        "Cratis documentation visual QA",
        "Use by Cratis maintainers to render and inspect documentation in light and dark modes.",
        ["Do not use for textual editing alone."],
        ["cratis-engineering-docs-edit-page"],
        "high",
        true,
    ],
    "cratis-engineering-ship-changes": [
        "Cratis change shipping",
        "Use only after an explicit request to commit, push, open, or merge a Cratis pull request.",
        ["Do not trigger for review, status, or local validation requests."],
        [],
        "critical",
        true,
    ],
    "skill-creator": [
        "Skill authoring and evaluation",
        "Use by trusted maintainers to create, improve, and evaluate Agent Skills.",
        ["Do not use for an ordinary prompt or documentation edit."],
        [],
        "critical",
        true,
    ],
    "cratis-engineering-docs-authoring": [
        "Cratis documentation authoring",
        "Use by Cratis maintainers to apply Diátaxis and documentation writing guidance.",
        [
            "Do not use to choose repository placement or perform visual QA alone.",
        ],
        [
            "cratis-engineering-docs-add-page",
            "cratis-engineering-docs-edit-page",
        ],
        "low",
        false,
    ],
};

function listFiles(root, current = root) {
    const files = [];
    for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        const stat = lstatSync(path);
        if (stat.isDirectory()) files.push(...listFiles(root, path));
        else if (stat.isFile())
            files.push(relative(repositoryRoot, path).split("\\").join("/"));
        else
            throw new Error(
                `Source capability contains a non-regular path: ${relative(repositoryRoot, path)}`,
            );
    }
    return files.sort(compareOrdinal);
}

function digestFiles(paths) {
    const hash = createHash("sha256");
    for (const path of paths) {
        hash.update(path);
        hash.update("\0");
        hash.update(readFileSync(join(repositoryRoot, path)));
        hash.update("\0");
    }
    return hash.digest("hex");
}

function digestFile(path) {
    return createHash("sha256")
        .update(readFileSync(join(repositoryRoot, path)))
        .digest("hex");
}

function writeJson(name, value) {
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(
        join(outputRoot, name),
        `${JSON.stringify(value, null, 2)}\n`,
    );
}

const publicBySource = new Map();
for (const skill of v1Public.skills) {
    const targets = skill.splitTargets ?? [skill.proposedName];
    const sourceTargets = publicBySource.get(skill.currentName) ?? [];
    sourceTargets.push(...targets);
    publicBySource.set(skill.currentName, [...new Set(sourceTargets)]);
}
publicBySource.set("cratis-vertical-slice", [
    "cratis-application-vertical-slice",
]);
publicBySource.set("new-vertical-slice", ["cratis-application-vertical-slice"]);
const targetIdsBySource = new Map([
    ...publicBySource,
    ...[...internalTargets].map(([source, target]) => [source, [target]]),
]);

const internalNames = new Set(internalTargets.keys());
const allSkillNames = [
    ...v1Public.skills.map((skill) => skill.currentName),
    ...internalTargets.keys(),
].sort(compareOrdinal);
const sources = allSkillNames.map((name) => {
    const sourceOverride = sourceOverrides.get(name);
    const path = sourceOverride?.sourcePath ?? `.ai/skills/${name}`;
    const files = listFiles(join(repositoryRoot, path));
    const targetOwner = internalNames.has(name)
        ? engineeringOwner
        : publicOwner;
    return {
        id: name,
        sourcePath: path,
        artifactType: "agent-skill-source",
        currentOwner: engineeringOwner,
        targetOwner,
        audience: internalNames.has(name) ? "cratis-engineering" : "public",
        bundledPaths: files,
        sourceRevision: sourceOverride?.sourceRevision ?? revision,
        contentDigest: digestFiles(files),
        publicationApproval: false,
        evidenceIds: [
            "repo-main-b795d53",
            "reevaluation-authority",
            ...(sourceOverride ? [sourceOverride.evidenceId] : []),
        ],
    };
});
writeJson("sources.json", {
    schemaVersion: 2,
    defaultPolicy: "deny",
    generatedBy: "tooling/generate-catalog-v2.mjs",
    sources,
});

function sourceRecordsForTarget(targetId) {
    return allSkillNames.filter((source) =>
        (targetIdsBySource.get(source) ?? []).includes(targetId),
    );
}

const v1BySource = new Map(
    v1Public.skills.map((skill) => [skill.currentName, skill]),
);
const allTargetIds = [...new Set([...targetIdsBySource.values()].flat())].sort(
    compareOrdinal,
);
function unclassifiedApplicability(dimension) {
    return {
        state: "unclassified",
        ids: [],
        reason: `${dimension} requires reviewed target classification.`,
    };
}

const targets = allTargetIds.map((targetId) => {
    const profile = profiles[targetId];
    if (!profile) throw new Error(`Missing target profile: ${targetId}`);
    const sourceSkillIds = sourceRecordsForTarget(targetId);
    const publicTarget = sourceSkillIds.some(
        (source) => !internalNames.has(source),
    );
    const sourceEntries = sourceSkillIds
        .map((source) => v1BySource.get(source))
        .filter(Boolean);
    const products = [
        ...new Set(sourceEntries.flatMap((entry) => entry.products)),
    ].sort(compareOrdinal);
    const languages = [
        ...new Set(sourceEntries.flatMap((entry) => entry.languages)),
    ].sort(compareOrdinal);
    const targetDependencies = [
        ...new Set(
            sourceEntries
                .flatMap((entry) => entry.dependencies.skills)
                .flatMap((source) => targetIdsBySource.get(source) ?? []),
        ),
    ]
        .filter((dependency) => dependency !== targetId)
        .sort(compareOrdinal);
    const internalArtifacts = [
        ...new Set(
            sourceEntries.flatMap(
                (entry) => entry.dependencies.internalArtifacts,
            ),
        ),
    ].sort(compareOrdinal);
    const externalTools = [
        ...new Set(
            sourceEntries.flatMap((entry) => entry.dependencies.externalTools),
        ),
    ].sort(compareOrdinal);
    const hasLegacyBehaviorEvals = sourceSkillIds.some((source) =>
        existsSync(join(repositoryRoot, `.ai/skills/${source}/evals`)),
    );
    const engineeringClassification =
        publicClassifications.get(targetId) ??
        engineeringClassifications.get(targetId);
    const releaseApproval = targetApprovals.get(targetId);
    const sourceRecord = sources.find(
        (source) => source.id === sourceSkillIds[0],
    );
    if (
        releaseApproval &&
        (sourceSkillIds.length !== 1 ||
            !sourceRecord ||
            releaseApproval.sourceRevision !== sourceRecord.sourceRevision ||
            releaseApproval.contentDigest !== sourceRecord.contentDigest)
    )
        throw new Error(`${targetId}: release approval source binding changed`);
    return {
        id: targetId,
        semanticName: targetId,
        sourceSkillIds,
        owner: publicTarget ? publicOwner : engineeringOwner,
        audience: publicTarget ? "public" : "cratis-engineering",
        products: publicTarget
            ? (engineeringClassification?.products ?? products)
            : ["cratis-engineering"],
        languages: publicTarget
            ? (engineeringClassification?.languages ?? languages)
            : ["language-agnostic"],
        capabilityKind:
            engineeringClassification?.capabilityKind ?? "unclassified",
        invocation: engineeringClassification?.invocation ?? "unclassified",
        lifecycle: releaseApproval ? "approved" : "candidate",
        architectures:
            engineeringClassification?.architectures ??
            unclassifiedApplicability("Architecture"),
        personas:
            engineeringClassification?.personas ??
            unclassifiedApplicability("Persona"),
        surfaces:
            engineeringClassification?.surfaces ??
            unclassifiedApplicability("Surface"),
        repositoryProfiles:
            engineeringClassification?.repositoryProfiles ??
            unclassifiedApplicability("Repository profile"),
        trust: engineeringClassification?.trust ?? {
            class: "passive",
            assessmentState: "unclassified",
            effects: [],
        },
        dependencyClassificationState: engineeringClassification
            ? "classified"
            : "unclassified",
        dependencyEdges: engineeringClassification?.dependencyEdges ?? [],
        sourceContractState: engineeringClassification
            ? "classified"
            : "unclassified",
        sourceContractIds: engineeringClassification?.sourceContractIds ?? [],
        sourceAuthoritySubjects:
            engineeringClassification?.sourceAuthoritySubjects ?? [],
        authoringContractState: engineeringClassification
            ? "classified"
            : "unclassified",
        authoringContractIds:
            engineeringClassification?.authoringContractIds ?? [],
        capability: profile[0],
        positiveTriggerIntent: profile[1],
        nearMissExclusions: profile[2],
        collisionSet: profile[3],
        dependencies: {
            targets:
                engineeringClassification?.targetDependencies ??
                targetDependencies,
            internalArtifacts:
                engineeringClassification?.internalArtifacts ??
                internalArtifacts,
            externalTools,
        },
        runtimePayloadPolicy: {
            allowed:
                engineeringClassification?.runtimeAllowed ??
                (publicTarget
                    ? ["SKILL.md", "references/**", "assets/**", "LICENSE*"]
                    : []),
            forbidden: [
                "scripts/**",
                "evals/**",
                "rules/**",
                "agents/**",
                "prompts/**",
                "commands/**",
                "hooks/**",
                "lsp/**",
                "tooling/**",
                "workflows/**",
                "local-configuration/**",
            ],
        },
        security: engineeringClassification?.security ?? {
            executable: false,
            destructive: profile[5],
            risk: profile[4],
            disposition: "pending",
            evidenceIds: [],
        },
        evaluations: {
            behavior: engineeringClassification?.behaviorEvaluationEvidenceId
                ? {
                      status: "passing",
                      evidenceIds: [
                          engineeringClassification.behaviorEvaluationEvidenceId,
                      ],
                  }
                : {
                      status: hasLegacyBehaviorEvals
                          ? "legacy-needs-migration"
                          : "missing",
                      evidenceIds: [],
                  },
            positiveTrigger:
                engineeringClassification?.routingEvaluationEvidenceId
                    ? {
                          status: "passing",
                          evidenceIds: [
                              engineeringClassification.routingEvaluationEvidenceId,
                          ],
                      }
                    : { status: "missing", evidenceIds: [] },
            negativeTrigger:
                engineeringClassification?.routingEvaluationEvidenceId
                    ? {
                          status: "passing",
                          evidenceIds: [
                              engineeringClassification.routingEvaluationEvidenceId,
                          ],
                      }
                    : { status: "missing", evidenceIds: [] },
            collision: engineeringClassification?.routingEvaluationEvidenceId
                ? {
                      status: "passing",
                      evidenceIds: [
                          engineeringClassification.routingEvaluationEvidenceId,
                      ],
                  }
                : { status: "missing", evidenceIds: [] },
        },
        approval: releaseApproval
            ? {
                  state: "approved",
                  reviewer: releaseApproval.reviewer,
                  approvedOn: releaseApproval.approvedOn,
                  sourceRevision: releaseApproval.sourceRevision,
                  contentDigest: releaseApproval.contentDigest,
                  evidenceIds: releaseApproval.evidenceIds,
              }
            : { state: "candidate", evidenceIds: [] },
        evidenceIds: [
            "repo-main-b795d53",
            "reevaluation-authority",
            ...(engineeringClassification?.evidenceIds ?? []),
        ],
        includeInRuntime: Boolean(releaseApproval),
    };
});
writeJson("targets.json", {
    schemaVersion: 2,
    defaultPolicy: "deny",
    generatedBy: "tooling/generate-catalog-v2.mjs",
    targets,
});

const migrations = [];
for (const skill of v1Public.skills) {
    if (skill.currentName === "new-vertical-slice") continue;
    if (skill.currentName === "cratis-vertical-slice") {
        migrations.push({
            id: "merge-application-vertical-slice",
            kind: "merge",
            sourceIds: ["cratis-vertical-slice", "new-vertical-slice"],
            targetIds: ["cratis-application-vertical-slice"],
            state: "evaluation-required",
            evaluationEvidenceIds: [],
            evidenceIds: ["reevaluation-authority"],
        });
    } else if (skill.currentName === "add-business-rule") {
        migrations.push({
            id: "split-add-business-rule",
            kind: "split",
            sourceIds: [skill.currentName],
            targetIds: skill.splitTargets,
            state: "evaluation-required",
            evaluationEvidenceIds: [],
            evidenceIds: ["reevaluation-authority"],
        });
    } else {
        migrations.push({
            id: `rename-${skill.currentName}`,
            kind:
                skill.currentName === skill.proposedName ? "retain" : "rename",
            sourceIds: [skill.currentName],
            targetIds: [skill.proposedName],
            state: "proposed",
            evaluationEvidenceIds: [],
            evidenceIds: ["reevaluation-authority"],
        });
    }
}
for (const [source, target] of internalTargets) {
    migrations.push({
        id: `${source === target ? "retain" : "rename"}-${source}`,
        kind: source === target ? "retain" : "rename",
        sourceIds: [source],
        targetIds: [target],
        state: "proposed",
        evaluationEvidenceIds: [],
        evidenceIds: ["reevaluation-authority"],
    });
}
migrations.sort((left, right) => compareOrdinal(left.id, right.id));
writeJson("migrations.json", {
    schemaVersion: 2,
    generatedBy: "tooling/generate-catalog-v2.mjs",
    migrations,
});

const publicTargetIds = targets
    .filter((target) => target.audience === "public")
    .map((target) => target.id);
const engineeringTargetIds = targets
    .filter((target) => target.audience === "cratis-engineering")
    .map((target) => target.id);
const approvedPublicTargets = targets.filter(
    (target) =>
        target.audience === "public" &&
        target.approval.state === "approved" &&
        target.includeInRuntime,
);
const approvedEngineeringTargets = targets.filter(
    (target) =>
        target.audience === "cratis-engineering" &&
        target.approval.state === "approved" &&
        target.includeInRuntime,
);
const exactPathsForTargets = (approvedTargets) =>
    [
        ...new Set(
            approvedTargets
                .flatMap((target) => target.sourceSkillIds)
                .flatMap(
                    (sourceId) =>
                        sources.find((source) => source.id === sourceId)
                            ?.bundledPaths ?? [],
                ),
        ),
    ].sort(compareOrdinal);
writeJson("artifacts.json", {
    schemaVersion: 2,
    defaultPolicy: "deny",
    distributionDecision: {
        state: "accepted",
        authorityEvidenceIds: [
            "workflows-68",
            "option-a-plus-authority",
            "organization-option-a-plus-authority",
        ],
        acceptedArchitecture: "option-a-plus-generated-distribution-repository",
        blockedActions: [
            "mixed-source-installation",
            "manual-distribution-authorship",
            "materialization-before-target-approval",
            "publication-before-release-gates",
        ],
    },
    artifacts: [
        {
            id: "planned-passive-public-release",
            audience: "public",
            fixtureOnly: false,
            materializationAllowed: approvedPublicTargets.length > 0,
            runtimeEligible: approvedPublicTargets.length > 0,
            componentInventory: { skills: publicTargetIds, mcp: [] },
            exactSourcePaths: exactPathsForTargets(approvedPublicTargets),
            allowedPathPatterns: [
                "skills/<approved-target>/SKILL.md",
                "skills/<approved-target>/references/**",
                "skills/<approved-target>/assets/**",
                "skills/<approved-target>/LICENSE*",
            ],
            forbiddenPathPatterns: [
                "engineering/**",
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
            ],
            requiresApprovedTargets: true,
            evidenceIds: [
                "workflows-68",
                "option-a-plus-authority",
                "organization-option-a-plus-authority",
            ],
        },
        {
            id: "planned-passive-engineering-release",
            audience: "cratis-engineering",
            fixtureOnly: false,
            materializationAllowed: approvedEngineeringTargets.length > 0,
            runtimeEligible: approvedEngineeringTargets.length > 0,
            componentInventory: { skills: engineeringTargetIds, mcp: [] },
            exactSourcePaths: exactPathsForTargets(approvedEngineeringTargets),
            allowedPathPatterns: [
                "engineering/skills/<approved-target>/SKILL.md",
                "engineering/skills/<approved-target>/references/**",
                "engineering/skills/<approved-target>/assets/**",
                "engineering/skills/<approved-target>/LICENSE*",
            ],
            forbiddenPathPatterns: [
                "skills/**",
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
                ".cratis/PROJECT.md",
                ".agents/PROJECT.md",
                "AGENTS.md",
                "CLAUDE.md",
                "GEMINI.md",
            ],
            requiresApprovedTargets: true,
            evidenceIds: [
                "workflows-68",
                "option-a-plus-authority",
                "organization-option-a-plus-authority",
            ],
        },
        {
            id: "sanitized-engineering-docs-authoring-fixture",
            audience: "test-fixture",
            fixtureOnly: true,
            materializationAllowed: true,
            runtimeEligible: false,
            componentInventory: {
                skills: ["cratis-engineering-docs-authoring-fixture"],
                mcp: [],
            },
            exactSourcePaths: [
                "engineering/skills/cratis-engineering-docs-authoring/LICENSE",
                "engineering/skills/cratis-engineering-docs-authoring/SKILL.md",
                "engineering/skills/cratis-engineering-docs-authoring/references/site-format.md",
            ],
            allowedPathPatterns: [
                "skills/cratis-engineering-docs-authoring/LICENSE",
                "skills/cratis-engineering-docs-authoring/SKILL.md",
                "skills/cratis-engineering-docs-authoring/references/**",
            ],
            forbiddenPathPatterns: [
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
                ".cratis/PROJECT.md",
                ".agents/PROJECT.md",
                "AGENTS.md",
                "CLAUDE.md",
                "GEMINI.md",
            ],
            requiresApprovedTargets: false,
            evidenceIds: [
                "engineering-docs-authoring-source-f58bcf7",
                "engineering-docs-authoring-evaluation-2026-08-22",
            ],
        },
        {
            id: "cratis-fundamentals-concept-preview",
            audience: "test-fixture",
            fixtureOnly: true,
            materializationAllowed: true,
            runtimeEligible: false,
            componentInventory: {
                skills: ["cratis-fundamentals-concept"],
                mcp: [],
            },
            exactSourcePaths: [
                "skills/cratis-fundamentals-concept/LICENSE",
                "skills/cratis-fundamentals-concept/SKILL.md",
            ],
            allowedPathPatterns: [
                "skills/cratis-fundamentals-concept/SKILL.md",
                "skills/cratis-fundamentals-concept/references/**",
                "skills/cratis-fundamentals-concept/assets/**",
                "skills/cratis-fundamentals-concept/LICENSE*",
            ],
            forbiddenPathPatterns: [
                "engineering/**",
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
            ],
            requiresApprovedTargets: false,
            evidenceIds: [
                "reevaluation-authority",
                "public-fundamentals-concept-source-b53caa5",
            ],
        },
    ],
});

const evidence = [
    {
        id: "github-organization-24",
        officialUrl: "https://github.com/Cratis/.github/issues/24",
        sourceKind: "organization-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-11-18",
        applicableVersion: "issue-state-2026-08-20",
        confidence: "high",
    },
    {
        id: "workflows-68",
        officialUrl: "https://github.com/Cratis/Workflows/issues/68",
        sourceKind: "organization-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-09-19",
        applicableVersion: "issue-state-2026-08-20",
        confidence: "high",
    },
    {
        id: "ai-126",
        officialUrl: "https://github.com/Cratis/AI/issues/126",
        sourceKind: "repository-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-11-18",
        applicableVersion: "issue-state-2026-08-20",
        confidence: "high",
    },
    {
        id: "ai-127",
        officialUrl: "https://github.com/Cratis/AI/issues/127",
        sourceKind: "repository-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-11-18",
        applicableVersion: "issue-state-2026-08-20",
        confidence: "high",
    },
    {
        id: sourceRevisionEvidenceId,
        officialUrl: `https://github.com/Cratis/AI/tree/${revision}`,
        sourceKind: "repository-snapshot",
        verifiedOn: "2026-08-20",
        expiresOn: "2027-08-20",
        applicableVersion: revision,
        confidence: "high",
        immutableRevision: revision,
    },
    {
        id: "public-fundamentals-concept-source-b53caa5",
        officialUrl:
            "https://github.com/Cratis/AI/tree/b53caa555b9a3f05ba1462b86202fe3ccb8a9470/skills/cratis-fundamentals-concept",
        sourceKind: "repository-snapshot",
        verifiedOn: "2026-08-23",
        expiresOn: "2027-08-23",
        applicableVersion: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        confidence: "high",
        immutableRevision: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
    },
    {
        id: "fundamentals-concept-source-review-2026-08-23",
        officialUrl: "https://github.com/Cratis/AI/issues/148",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-23",
        expiresOn: "2026-11-21",
        applicableVersion:
            "Cratis.Fundamentals@7.18.1+Cratis.Chronicle@16.38.1",
        confidence: "high",
        repositoryPath:
            "distribution/evidence/fundamentals-concept-source-review-2026-08-23.json",
        digest: digestFile(
            "distribution/evidence/fundamentals-concept-source-review-2026-08-23.json",
        ),
    },
    {
        id: "fundamentals-concept-focused-evaluation-2026-08-23",
        officialUrl: "https://github.com/Cratis/AI/issues/148",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-23",
        expiresOn: "2026-11-21",
        applicableVersion: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        confidence: "medium",
        repositoryPath:
            "evals/cratis-fundamentals-concept/focused-evaluation.json",
        digest: digestFile(
            "evals/cratis-fundamentals-concept/focused-evaluation.json",
        ),
    },
    {
        id: "fundamentals-concept-samples-canary-2026-08-23",
        officialUrl: "https://github.com/Cratis/Samples",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-23",
        expiresOn: "2026-11-21",
        applicableVersion:
            "Cratis/Samples@55e6eb168606da96136cc7f91db8adf45aac3288",
        confidence: "high",
        repositoryPath:
            "distribution/evidence/real-samples-fundamentals-preview-canary-2026-08-23.json",
        digest: digestFile(
            "distribution/evidence/real-samples-fundamentals-preview-canary-2026-08-23.json",
        ),
    },
    {
        id: "engineering-docs-add-page-source-684d037",
        officialUrl:
            "https://github.com/Cratis/AI/tree/684d03755bacd40af95463b81b4a0c8b9f088ec1/engineering/skills/cratis-engineering-docs-add-page",
        sourceKind: "repository-snapshot",
        verifiedOn: "2026-08-22",
        expiresOn: "2027-08-22",
        applicableVersion: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
        confidence: "high",
        immutableRevision: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
    },
    {
        id: "engineering-docs-edit-page-source-684d037",
        officialUrl:
            "https://github.com/Cratis/AI/tree/684d03755bacd40af95463b81b4a0c8b9f088ec1/engineering/skills/cratis-engineering-docs-edit-page",
        sourceKind: "repository-snapshot",
        verifiedOn: "2026-08-22",
        expiresOn: "2027-08-22",
        applicableVersion: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
        confidence: "high",
        immutableRevision: "684d03755bacd40af95463b81b4a0c8b9f088ec1",
    },
    {
        id: "engineering-docs-authoring-source-f58bcf7",
        officialUrl:
            "https://github.com/Cratis/AI/tree/f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9/engineering/skills/cratis-engineering-docs-authoring",
        sourceKind: "repository-snapshot",
        verifiedOn: "2026-08-22",
        expiresOn: "2027-08-22",
        applicableVersion: "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9",
        confidence: "high",
        immutableRevision: "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9",
    },
    {
        id: "engineering-docs-authoring-evaluation-2026-08-22",
        officialUrl: "https://github.com/Cratis/AI",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-22",
        expiresOn: "2026-11-20",
        applicableVersion: "f58bcf7f5cc9fc0e11305ada3b5ecb6fa20953e9",
        confidence: "high",
        repositoryPath:
            "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
        digest: "b8a322d0f43764a0469c540f28fd57734be4f6a885f81064f55ffe06f85d5c74",
    },
    {
        id: "reevaluation-authority",
        officialUrl: "https://github.com/Cratis/AI",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-09-19",
        applicableVersion: "content-digest-bound",
        confidence: "medium",
        repositoryPath: "AI-REPOSITORY-REDESIGN-REEVALUATION.md",
        digest: digestFile("AI-REPOSITORY-REDESIGN-REEVALUATION.md"),
    },
    {
        id: "ecosystem-use-cases",
        officialUrl: "https://github.com/Cratis/AI",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-11-18",
        applicableVersion: "content-digest-bound",
        confidence: "medium",
        repositoryPath: "AI-REPOSITORY-REDESIGN-ECOSYSTEM-USE-CASES.md",
        digest: digestFile("AI-REPOSITORY-REDESIGN-ECOSYSTEM-USE-CASES.md"),
    },
    {
        id: "third-party-skills-evaluation",
        officialUrl: "https://github.com/Cratis/AI",
        sourceKind: "local-evidence-report",
        verifiedOn: "2026-08-20",
        expiresOn: "2026-11-18",
        applicableVersion: "content-digest-bound",
        confidence: "medium",
        repositoryPath:
            "AI-REPOSITORY-REDESIGN-THIRD-PARTY-SKILLS-EVALUATION.md",
        digest: digestFile(
            "AI-REPOSITORY-REDESIGN-THIRD-PARTY-SKILLS-EVALUATION.md",
        ),
    },
    {
        id: "option-a-plus-authority",
        officialUrl:
            "https://github.com/Cratis/Workflows/issues/68#issuecomment-5363284054",
        sourceKind: "organization-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2027-08-20",
        applicableVersion: "option-a-plus-accepted",
        confidence: "high",
    },
    {
        id: "organization-option-a-plus-authority",
        officialUrl:
            "https://github.com/Cratis/.github/issues/24#issuecomment-5363284173",
        sourceKind: "organization-authority",
        verifiedOn: "2026-08-20",
        expiresOn: "2027-08-20",
        applicableVersion: "option-a-plus-accepted",
        confidence: "high",
    },
];
const ecosystemFacts = [];
for (const ecosystem of v1Ecosystems.ecosystems) {
    const sourceIds = ecosystem.sources.map((source, index) => {
        const id = `${ecosystem.id}-source-${index + 1}`;
        evidence.push({
            id,
            officialUrl: source.url,
            sourceKind: source.kind,
            verifiedOn: source.verifiedOn,
            expiresOn: "2026-11-18",
            applicableVersion: ecosystem.version,
            confidence: ecosystem.status === "provisional" ? "medium" : "high",
        });
        return id;
    });
    ecosystem.facts.forEach((fact, index) =>
        ecosystemFacts.push({
            id: `${ecosystem.id}-fact-${index + 1}`,
            ecosystemId: ecosystem.id,
            fact,
            evidenceIds: sourceIds,
        }),
    );
}
writeJson("evidence.json", {
    schemaVersion: 2,
    asOf: "2026-08-24",
    generatedBy: "tooling/generate-catalog-v2.mjs",
    evidence,
    ecosystemFacts,
});

function coverageStateForCapability(status) {
    if (status === "candidate") return "source-candidate";
    if (status === "partial") return "partial";
    return "gap";
}

const coverageProducts = v1Coverage.products.map((product) => {
    const capabilities = product.capabilities.map((capability) => {
        const record = {
            id: capability.id,
            coverageState: coverageStateForCapability(capability.status),
            claimState: "unclaimed",
            languages: capability.languages,
            sourceSkillIds: capability.sourceSkills,
            targetIds: [
                ...new Set(
                    capability.sourceSkills.flatMap(
                        (source) => targetIdsBySource.get(source) ?? [],
                    ),
                ),
            ].sort(compareOrdinal),
            evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
        };
        if (capability.notes) record.notes = capability.notes;
        return record;
    });
    return {
        id: product.id,
        name: product.name,
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
        capabilities,
    };
});
const coverageLanguages = v1Coverage.languages.map((language) => {
    const record = {
        id: language.id,
        name: language.name,
        coverageState:
            language.supportStatus === "current-corpus" ? "partial" : "gap",
        claimState: "unclaimed",
        evidenceIds: ["repo-main-b795d53", "reevaluation-authority"],
    };
    if (language.notes) record.notes = language.notes;
    return record;
});
writeJson("product-coverage.json", {
    schemaVersion: 2,
    claimPolicy: "verified-only",
    generatedBy: "tooling/generate-catalog-v2.mjs",
    languages: coverageLanguages,
    products: coverageProducts,
});

process.stdout.write(
    `Generated catalog v2: ${sources.length} sources, ${targets.length} targets, ${migrations.length} migrations, ${evidence.length} evidence records, and ${ecosystemFacts.length} ecosystem facts.\n`,
);
