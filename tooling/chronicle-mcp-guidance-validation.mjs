// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { expectedChronicleMcpGuidanceReferences } from "./generate-chronicle-mcp-guidance-references.mjs";

export const chronicleMcpGuidancePaths = Object.freeze({
    catalog: "catalog/chronicle-mcp-tool-classifications.json",
    schema: "catalog/schemas/chronicle-mcp-tool-classifications.schema.json",
    sourceContract: "catalog/v2/source-contracts.json",
    evidence: "catalog/evidence.json",
    components: "catalog/components.json",
    projections: "catalog/component-projections.json",
    artifacts: "catalog/v2/artifacts.json",
    assurancePolicy: "distribution/artifact-assurance-policy.json",
    artifactBindings: "distribution/ecosystem-artifact-bindings.json",
    profiles: "distribution/profile-catalog.json",
    releaseApprovals: "distribution/release-approvals.json",
    skillRoot: "skills/cratis-chronicle-mcp-inspection",
});

const expectedEffectClasses = Object.freeze([
    "classification-only",
    "observational",
    "effectful",
    "unknown",
]);
const expectedBlockedEffects = Object.freeze([
    "credential-access",
    "destructive",
    "dynamic-delegation",
    "execute",
    "open-world-transmission",
    "publish",
    "unbounded-transmission",
    "write",
]);
const expectedAdmissionRequirements = Object.freeze([
    "bounded-output",
    "closed-transitive-operation-set",
    "complete-subject-inventory",
    "credential-review",
    "effect-review",
    "immutable-upstream-revision",
    "implementation-digest",
    "input-output-schema-digest",
    "output-classification",
    "redaction-review",
    "unique-subject-identity",
]);
const expectedSkillFiles = Object.freeze([
    "LICENSE",
    "SKILL.md",
    "references/blocked-tools.md",
    "references/observational-tools.md",
]);
const blockedEffects = new Set(expectedBlockedEffects);
const moduleRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function filesUnder(root, sourceRoot) {
    const absoluteRoot = join(root, sourceRoot);
    const files = [];
    const visit = (current) => {
        for (const entry of readdirSync(current).sort()) {
            const path = join(current, entry);
            const stat = lstatSync(path);
            if (stat.isSymbolicLink())
                throw new Error(
                    `${relative(root, path).split(sep).join("/")} is a symlink`,
                );
            if (stat.isDirectory()) visit(path);
            else if (stat.isFile())
                files.push(
                    relative(absoluteRoot, path).split(sep).join("/"),
                );
            else
                throw new Error(
                    `${relative(root, path).split(sep).join("/")} is a special file`,
                );
        }
    };
    visit(absoluteRoot);
    return files.sort();
}

function classificationSemantics(subject) {
    return {
        effectClass: subject.effectClass,
        disposition: subject.disposition,
        effects: [...subject.effects].sort(),
        delegatedOperationIds: [...subject.delegatedOperationIds].sort(),
        boundedOutput: subject.boundedOutput,
        outputClassification: subject.outputClassification,
        annotationHints: {
            readOnly: subject.annotationHints.readOnly,
            destructive: subject.annotationHints.destructive,
            idempotent: subject.annotationHints.idempotent,
            openWorld: subject.annotationHints.openWorld,
        },
    };
}

export function chronicleMcpInventoryDigest(catalog) {
    const lines = [
        ...catalog.tools.map((subject) => ({ kind: "tool", subject })),
        ...catalog.prompts.map((subject) => ({ kind: "prompt", subject })),
    ]
        .map(({ kind, subject }) =>
            JSON.stringify({
                guidanceProductId: catalog.guidanceProductId,
                kind,
                id: subject.id,
                sourceRevision: subject.sourceRevision,
                implementationDigest: subject.implementationDigest,
                schemaDigest: subject.schemaDigest,
                classification: classificationSemantics(subject),
            }),
        )
        .sort();
    return createHash("sha256").update(`${lines.join("\n")}\n`).digest("hex");
}

function reviewBindingDigest(catalog, subjectKind, subject, assuranceId) {
    return createHash("sha256")
        .update(
            JSON.stringify({
                guidanceProductId: catalog.guidanceProductId,
                sourceContractId: catalog.sourceContractId,
                upstreamRevision: catalog.upstreamRevision,
                subjectKind,
                subjectId: subject.id,
                implementationDigest: subject.implementationDigest,
                schemaDigest: subject.schemaDigest,
                classification: classificationSemantics(subject),
                assuranceId,
            }),
        )
        .digest("hex");
}

function sourceBelongsToContract(source, sourceContract, revision) {
    if (
        source?.kind !== "repository-snapshot" ||
        source.immutableRevision !== revision
    )
        return false;
    try {
        const repository = new URL(
            sourceContract.repositoryUrl.replace(/\.git$/u, ""),
        );
        const locator = new URL(source.locator);
        const repositoryPath = repository.pathname.replace(/\/$/u, "");
        return (
            locator.origin === repository.origin &&
            (locator.pathname.startsWith(
                `${repositoryPath}/tree/${revision}`,
            ) ||
                locator.pathname.startsWith(
                    `${repositoryPath}/commit/${revision}`,
                ))
        );
    } catch {
        return false;
    }
}

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

export function validateChronicleMcpClassification(
    catalog,
    schema,
    sourceContracts,
    evidence,
) {
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(catalog, schema, schema),
    ];
    if (!same(catalog.effectClasses, expectedEffectClasses))
        errors.push(
            "Chronicle MCP effect classes differ from the reviewed contract",
        );
    if (!same(catalog.blockedEffectIds, expectedBlockedEffects))
        errors.push(
            "Chronicle MCP blocked effects differ from the reviewed contract",
        );
    if (!same(catalog.admissionRequirements, expectedAdmissionRequirements))
        errors.push(
            "Chronicle MCP admission requirements differ from the reviewed contract",
        );
    const sourceContract = catalog.sourceContractId
        ? sourceContracts.contracts.find(
              (contract) => contract.id === catalog.sourceContractId,
          )
        : null;
    if (catalog.sourceContractId && !sourceContract)
        errors.push(
            `${catalog.guidanceProductId}: classification references an unknown source contract`,
        );
    const sourceIsAdmitted =
        sourceContract?.verificationState === "verified" &&
        sourceContract?.distributionInputAllowed === true;
    const subjectRecords = [
        ...catalog.tools.map((subject) => ({ kind: "tool", subject })),
        ...catalog.prompts.map((subject) => ({ kind: "prompt", subject })),
    ];
    const subjects = subjectRecords.map((record) => record.subject);
    for (const id of duplicates(subjects.map((subject) => subject.id)))
        errors.push(
            `Chronicle MCP classification contains duplicate subject ${id}`,
        );
    const subjectsById = new Map(
        subjects.map((subject) => [subject.id, subject]),
    );
    const delegatedTargets = new Set();
    for (const subject of subjects)
        for (const delegatedId of subject.delegatedOperationIds) {
            delegatedTargets.add(delegatedId);
            if (!subjectsById.has(delegatedId))
                errors.push(
                    `${subject.id}: delegated operation ${delegatedId} is unknown`,
                );
        }
    const visiting = new Set();
    const visited = new Set();
    const visitDelegation = (subjectId) => {
        if (visiting.has(subjectId)) {
            errors.push(`MCP delegation cycle contains ${subjectId}`);
            return;
        }
        if (visited.has(subjectId)) return;
        visiting.add(subjectId);
        for (const delegatedId of
            subjectsById.get(subjectId)?.delegatedOperationIds ?? [])
            if (subjectsById.has(delegatedId)) visitDelegation(delegatedId);
        visiting.delete(subjectId);
        visited.add(subjectId);
    };
    for (const subjectId of subjectsById.keys()) visitDelegation(subjectId);
    for (const subject of subjects)
        if (
            subject.disposition === "passive-allowed" &&
            (subject.delegatedOperationIds.length > 0 ||
                delegatedTargets.has(subject.id))
        )
            errors.push(
                `${subject.id}: delegated operations cannot be passive-allowed`,
            );
    if (!sourceIsAdmitted) {
        if (
            catalog.authorityState !== "NO_ADMITTED_TOOL_EFFECT_EVIDENCE" ||
            catalog.upstreamRevision !== null ||
            catalog.inventoryDigest !== null ||
            catalog.inventoryEvidenceId !== null ||
            subjects.length !== 0
        )
            errors.push(
                "Unverified Chronicle MCP authority requires null provenance and an empty deny-all inventory",
            );
        for (const { subject } of subjectRecords) {
            if (subject.sourceRevision !== catalog.upstreamRevision)
                errors.push(
                    `${subject.id}: source revision does not match the catalog`,
                );
            const hasBlockedEffect = subject.effects.some((effect) =>
                blockedEffects.has(effect),
            );
            if (
                subject.effectClass !== "observational" &&
                subject.disposition === "passive-allowed"
            )
                errors.push(
                    `${subject.id}: only evidence-proven observational subjects can be passive-allowed`,
                );
            if (
                (subject.effectClass === "effectful" || hasBlockedEffect) &&
                subject.disposition !== "effectful-blocked"
            )
                errors.push(
                    `${subject.id}: effectful behavior must remain blocked`,
                );
            if (
                subject.effectClass === "unknown" &&
                subject.disposition !== "evidence-blocked"
            )
                errors.push(
                    `${subject.id}: unknown behavior must remain evidence-blocked`,
                );
            if (subject.disposition === "passive-allowed")
                errors.push(`${subject.id}: missing authority must fail closed`);

        }
        return errors;
    }
    const requiredSubjectKinds = [
        "tools",
        "schemas",
        "credentials",
        "mutations",
        "versions",
        ...(catalog.prompts.length > 0 ? ["prompts"] : []),
    ];
    if (
        !sourceContract.productIds.includes(catalog.guidanceProductId) ||
        requiredSubjectKinds.some(
            (subjectKind) =>
                !sourceContract.subjectKinds.includes(subjectKind),
        )
    )
        errors.push(
            `${catalog.guidanceProductId}: source contract does not authorize this product and MCP subject scope`,
        );
    if (catalog.authorityState === "NO_ADMITTED_TOOL_EFFECT_EVIDENCE") {
        if (
            catalog.upstreamRevision !== null ||
            catalog.inventoryDigest !== null ||
            catalog.inventoryEvidenceId !== null ||
            subjects.length !== 0
        )
            errors.push(
                "No-admitted-evidence authority requires null provenance and an empty inventory",
            );
        return errors;
    }
    if (
        !catalog.upstreamRevision ||
        sourceContract.immutableRevision !== catalog.upstreamRevision ||
        !sourceContract.contentDigest ||
        !catalog.inventoryDigest ||
        catalog.inventoryDigest !== chronicleMcpInventoryDigest(catalog) ||
        !catalog.inventoryEvidenceId ||
        subjects.length === 0
    )
        errors.push(
            "Admitted Chronicle MCP authority requires exact source-contract revision, content, and complete inventory provenance",
        );

    const observationsById = new Map(
        evidence.observations.map((observation) => [
            observation.id,
            observation,
        ]),
    );
    const sourcesById = new Map(
        evidence.sources.map((source) => [source.id, source]),
    );
    const evidenceOwners = new Map();
    const bindEvidence = (
        evidenceId,
        owner,
        assuranceId,
        expectedDigest,
    ) => {
        if (!evidenceId) {
            errors.push(`${owner}: missing ${assuranceId} evidence`);
            return;
        }
        const priorOwner = evidenceOwners.get(evidenceId);
        if (priorOwner && priorOwner !== owner)
            errors.push(
                `${owner}: evidence ${evidenceId} is already bound to ${priorOwner}`,
            );
        else evidenceOwners.set(evidenceId, owner);
        const observation = observationsById.get(evidenceId);
        if (!observation) {
            errors.push(`${owner}: unknown evidence ${evidenceId}`);
            return;
        }
        const source = sourcesById.get(observation.sourceId);
        const exactSubject =
            observation.subject.kind === "source-contract" &&
            observation.subject.id === catalog.sourceContractId &&
            observation.subject.version === catalog.upstreamRevision &&
            observation.subject.digest === expectedDigest;
        const exactAssertion = observation.assertions.some(
            (assertion) =>
                assertion.assuranceId === assuranceId &&
                assertion.outcome === "pass" &&
                assertion.supporting,
        );
        const active =
            observation.observedOn <= evidence.asOf &&
            evidence.asOf <= observation.validThrough;
        const revisionBound = sourceBelongsToContract(
            source,
            sourceContract,
            catalog.upstreamRevision,
        );
        if (!exactSubject || !exactAssertion || !active || !revisionBound)
            errors.push(
                `${owner}: ${assuranceId} evidence is stale, unrelated, or not revision and digest bound`,
            );
        const conflicting = evidence.observations.some(
            (candidate) =>
                candidate.subject.kind === "source-contract" &&
                candidate.subject.id === catalog.sourceContractId &&
                candidate.subject.version === catalog.upstreamRevision &&
                candidate.assertions.some(
                    (assertion) =>
                        assertion.assuranceId === assuranceId &&
                        assertion.outcome === "fail",
                ),
        );
        if (conflicting)
            errors.push(`${owner}: conflicting ${assuranceId} evidence exists`);
    };
    if (sourceContract.evidenceIds.length === 0)
        errors.push(
            "Chronicle MCP source contract lacks revision-bound authority evidence",
        );
    for (const evidenceId of sourceContract.evidenceIds)
        bindEvidence(
            evidenceId,
            "Chronicle MCP source contract authority",
            "source-contract-verification",
            sourceContract.contentDigest,
        );
    bindEvidence(
        catalog.inventoryEvidenceId,
        "complete Chronicle MCP inventory",
        "complete-subject-inventory",
        catalog.inventoryDigest,
    );
    const evidenceRequirements = [
        ["implementation", "implementation-review"],
        ["schema", "input-output-schema-review"],
        ["effectReview", "effect-review"],
        ["credentialReview", "credential-review"],
        ["outputClassification", "output-classification"],
        ["redactionReview", "redaction-review"],
    ];
    for (const { kind, subject } of subjectRecords) {
        if (subject.sourceRevision !== catalog.upstreamRevision)
            errors.push(
                `${subject.id}: source revision does not match the catalog`,
            );
        for (const [field, assuranceId] of evidenceRequirements)
            bindEvidence(
                subject.evidence[field],
                `${kind}:${subject.id}`,
                assuranceId,
                reviewBindingDigest(catalog, kind, subject, assuranceId),
            );
        const hasBlockedEffect = subject.effects.some((effect) =>
            blockedEffects.has(effect),
        );
        if (
            subject.effectClass === "observational" &&
            subject.disposition === "passive-allowed"
        ) {
            if (
                !subject.effects.includes("read") ||
                subject.delegatedOperationIds.length > 0 ||
                delegatedTargets.has(subject.id) ||
                hasBlockedEffect ||
                !subject.boundedOutput ||
                subject.outputClassification === "unknown" ||
                Object.values(subject.evidence).some(
                    (evidenceId) => evidenceId === null,
                ) ||
                subject.annotationHints.readOnly === false ||
                subject.annotationHints.destructive === true ||
                subject.annotationHints.openWorld === true
            )
                errors.push(
                    `${subject.id}: passive observational admission lacks complete bounded read evidence`,
                );
        } else if (subject.disposition === "passive-allowed")
            errors.push(
                `${subject.id}: only evidence-proven observational subjects can be passive-allowed`,
            );
        if (
            (subject.effectClass === "effectful" || hasBlockedEffect) &&
            subject.disposition !== "effectful-blocked"
        )
            errors.push(`${subject.id}: effectful behavior must remain blocked`);
        if (
            subject.effectClass === "unknown" &&
            subject.disposition !== "evidence-blocked"
        )
            errors.push(`${subject.id}: unknown behavior must remain evidence-blocked`);
    }
    return errors;
}

export function validateChronicleMcpGuidance(
    root = defaultRepositoryRoot,
    overrides = {},
) {
    const errors = [];
    let catalog;
    let schema;
    let sourceContracts;
    let evidence;
    let components;
    let projections;
    let artifacts;
    let assurancePolicy;
    let artifactBindings;
    let profiles;
    let releaseApprovals;
    try {
        catalog =
            overrides.catalog ??
            readCatalog(join(root, chronicleMcpGuidancePaths.catalog));
        schema =
            overrides.schema ??
            readCatalog(join(root, chronicleMcpGuidancePaths.schema));
        sourceContracts =
            overrides.sourceContracts ??
            readCatalog(join(root, chronicleMcpGuidancePaths.sourceContract));
        evidence =
            overrides.evidence ??
            readCatalog(join(root, chronicleMcpGuidancePaths.evidence));
        components =
            overrides.components ??
            readCatalog(join(root, chronicleMcpGuidancePaths.components));
        projections =
            overrides.projections ??
            readCatalog(join(root, chronicleMcpGuidancePaths.projections));
        artifacts =
            overrides.artifacts ??
            readCatalog(join(root, chronicleMcpGuidancePaths.artifacts));
        assurancePolicy =
            overrides.assurancePolicy ??
            readCatalog(join(root, chronicleMcpGuidancePaths.assurancePolicy));
        artifactBindings =
            overrides.artifactBindings ??
            readCatalog(join(root, chronicleMcpGuidancePaths.artifactBindings));
        profiles =
            overrides.profiles ??
            readCatalog(join(root, chronicleMcpGuidancePaths.profiles));
        releaseApprovals =
            overrides.releaseApprovals ??
            readCatalog(join(root, chronicleMcpGuidancePaths.releaseApprovals));
    } catch (error) {
        return [`Chronicle MCP guidance catalog cannot be loaded: ${error.message}`];
    }
    errors.push(
        ...validateChronicleMcpClassification(
            catalog,
            schema,
            sourceContracts,
            evidence,
        ),
    );
    if (
        catalog.emission.executableAllowed ||
        catalog.emission.installationAllowed ||
        catalog.emission.invocationAllowed ||
        catalog.emission.promptInvocationAllowed ||
        catalog.emission.runtimeConfigurationAllowed ||
        catalog.emission.serverBytesAllowed
    )
        errors.push("Chronicle MCP guidance cannot grant executable emission");

    if (
        catalog.guidanceProductId !== "chronicle-mcp" ||
        catalog.guidanceComponentId !== "cratis-chronicle-mcp-inspection" ||
        catalog.sourceContractId !== "cratis-chronicle-mcp-source"
    )
        errors.push("Chronicle MCP guidance product binding changed");
    const guidanceComponent = components.components.find(
        (component) => component.id === "cratis-chronicle-mcp-inspection",
    );
    if (
        !guidanceComponent ||
        guidanceComponent.kind !== "skill" ||
        guidanceComponent.classification.effect !== "guided-read" ||
        guidanceComponent.classification.executable ||
        guidanceComponent.approval.state !== "modeled" ||
        guidanceComponent.distributionTargetId !== guidanceComponent.id
    )
        errors.push(
            "Chronicle MCP guidance must remain a modeled passive guided-read skill component",
        );
    if (
        components.components.some(
            (component) => component.kind === "mcp" || component.kind === "lsp",
        ) ||
        !components.declaredEmptyKinds.includes("mcp") ||
        !components.declaredEmptyKinds.includes("lsp")
    )
        errors.push("Chronicle MCP guidance cannot create MCP or LSP components");
    if (
        projections.projections.length !== 312 ||
        projections.projections.some(
            (projection) =>
                projection.componentId === "cratis-chronicle-mcp-inspection",
        )
    )
        errors.push(
            "Chronicle MCP guidance cannot create a host or portable component projection",
        );
    for (const artifact of artifacts.artifacts) {
        if (artifact.componentInventory.mcp.length > 0)
            errors.push(`${artifact.id}: MCP executable inventory must remain empty`);
        if (
            (artifact.materializationAllowed || artifact.runtimeEligible) &&
            artifact.componentInventory.skills.includes(
                "cratis-chronicle-mcp-inspection",
            )
        )
            errors.push(
                `${artifact.id}: Chronicle MCP guidance cannot enter a materialized or runtime artifact`,
            );
    }
    const publicPlan = artifacts.artifacts.find(
        (artifact) => artifact.id === "planned-passive-public-release",
    );
    if (
        !publicPlan?.componentInventory.skills.includes(
            "cratis-chronicle-mcp-inspection",
        ) ||
        publicPlan.materializationAllowed ||
        publicPlan.runtimeEligible
    )
        errors.push(
            "Chronicle MCP guidance must remain only in the non-materialized public plan",
        );
    for (const classId of [
        "passive-effectful-guidance",
        "stdio-mcp-server",
        "remote-mcp-server",
    ]) {
        const artifactClass = assurancePolicy.classes.find(
            (candidate) => candidate.id === classId,
        );
        if (
            !artifactClass ||
            artifactClass.s4EmissionAllowed ||
            artifactClass.supportGranted ||
            artifactClass.publicationGranted ||
            artifactClass.runtimeGranted ||
            artifactClass.promotionGranted
        )
            errors.push(`${classId}: assurance lane must remain non-emitting`);
    }
    for (const binding of artifactBindings.bindings.filter(
        (candidate) =>
            candidate.interfaceId === "mcp-protocol" ||
            candidate.interfaceId === "mcp-registry-publication",
    ))
        if (
            binding.artifactClass !== "no-artifact" ||
            binding.strategy !== "no-output" ||
            binding.generationState !== "no-output" ||
            binding.outputRoot !== null ||
            binding.supportClaim
        )
            errors.push(`${binding.id}: MCP binding must remain no-output`);
    const publicProfile = profiles.publicProfiles.find(
        (profile) => profile.id === "public-chronicle-mcp",
    );
    if (
        publicProfile?.state !== "preview-source-candidate" ||
        !publicProfile.availableTargets?.includes(
            "cratis-chronicle-mcp-inspection",
        )
    )
        errors.push(
            "public-chronicle-mcp must remain a source candidate with the passive target",
        );
    if (
        releaseApprovals.targetApprovals.some(
            (approval) =>
                approval.targetId === "cratis-chronicle-mcp-inspection",
        ) ||
        releaseApprovals.profileApprovals.some(
            (approval) => approval.profileId === "public-chronicle-mcp",
        )
    )
        errors.push(
            "Chronicle MCP guidance target and profile must remain unapproved",
        );

    let expectedReferences;
    try {
        expectedReferences = expectedChronicleMcpGuidanceReferences(catalog, {
            schema,
            sourceContracts,
            evidence,
        });
    } catch (error) {
        errors.push(error.message);
        expectedReferences = {};
    }
    for (const [path, expected] of Object.entries(expectedReferences)) {
        if (!existsSync(join(root, path)))
            errors.push(`Chronicle MCP generated reference is missing: ${path}`);
        else if (readFileSync(join(root, path), "utf8") !== expected)
            errors.push(`Chronicle MCP generated reference is stale: ${path}`);
    }
    try {
        const actualFiles = filesUnder(root, chronicleMcpGuidancePaths.skillRoot);
        if (!same(actualFiles, expectedSkillFiles))
            errors.push(
                "Chronicle MCP guidance source contains undeclared or missing files",
            );
        const sourceText = actualFiles
            .map((path) =>
                readFileSync(
                    join(root, chronicleMcpGuidancePaths.skillRoot, path),
                    "utf8",
                ),
            )
            .join("\n");
        for (const forbidden of [
            /tools\/call/iu,
            /jsonrpc/iu,
            /mcp\.json/iu,
            /https?:\/\//iu,
            /```(?:bash|sh|powershell|json)/iu,
        ])
            if (forbidden.test(sourceText))
                errors.push(
                    `Chronicle MCP passive source contains forbidden executable material: ${forbidden}`,
                );
    } catch (error) {
        errors.push(`Chronicle MCP guidance source failed: ${error.message}`);
    }
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateChronicleMcpGuidance(moduleRoot);
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else process.stdout.write("Chronicle MCP guidance validation passed.\n");
}
