// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
    "execute",
    "open-world-transmission",
    "publish",
    "unbounded-transmission",
    "write",
]);
const expectedAdmissionRequirements = Object.freeze([
    "bounded-output",
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

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
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
    } catch (error) {
        return [`Chronicle MCP guidance catalog cannot be loaded: ${error.message}`];
    }
    errors.push(...validateSchemaVocabulary(schema));
    errors.push(...validateAgainstSchema(catalog, schema, schema));
    if (!same(catalog.effectClasses, expectedEffectClasses))
        errors.push("Chronicle MCP effect classes differ from the reviewed contract");
    if (!same(catalog.blockedEffectIds, expectedBlockedEffects))
        errors.push("Chronicle MCP blocked effects differ from the reviewed contract");
    if (!same(catalog.admissionRequirements, expectedAdmissionRequirements))
        errors.push(
            "Chronicle MCP admission requirements differ from the reviewed contract",
        );
    const sourceContract = sourceContracts.contracts.find(
        (contract) => contract.id === catalog.sourceContractId,
    );
    if (!sourceContract)
        errors.push("Chronicle MCP classification references an unknown source contract");
    const sourceIsAdmitted =
        sourceContract?.verificationState === "verified" &&
        sourceContract?.distributionInputAllowed === true;
    const subjects = [...catalog.tools, ...catalog.prompts];
    for (const id of duplicates(subjects.map((subject) => subject.id)))
        errors.push(`Chronicle MCP classification contains duplicate subject ${id}`);
    const evidenceIds = new Set(
        evidence.observations.map((observation) => observation.id),
    );
    for (const subject of subjects) {
        if (subject.sourceRevision !== catalog.upstreamRevision)
            errors.push(`${subject.id}: source revision does not match the catalog`);
        for (const evidenceId of [
            ...subject.evidenceIds,
            ...subject.redactionReviewEvidenceIds,
        ])
            if (!evidenceIds.has(evidenceId))
                errors.push(`${subject.id}: unknown evidence ${evidenceId}`);
        const hasBlockedEffect = subject.effects.some((effect) =>
            blockedEffects.has(effect),
        );
        if (
            subject.effectClass === "observational" &&
            subject.disposition === "passive-allowed"
        ) {
            if (
                !sourceIsAdmitted ||
                !subject.effects.includes("read") ||
                hasBlockedEffect ||
                !subject.boundedOutput ||
                subject.outputClassification === "unknown" ||
                subject.redactionReviewEvidenceIds.length === 0 ||
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
            (subject.effectClass === "unknown" || !sourceIsAdmitted) &&
            subject.disposition === "passive-allowed"
        )
            errors.push(`${subject.id}: missing authority must fail closed`);
    }
    if (!sourceIsAdmitted) {
        if (
            catalog.authorityState !== "NO_ADMITTED_TOOL_EFFECT_EVIDENCE" ||
            catalog.upstreamRevision !== null ||
            subjects.length !== 0
        )
            errors.push(
                "Unverified Chronicle MCP authority requires a null revision and empty deny-all inventory",
            );
    }
    if (
        catalog.emission.executableAllowed ||
        catalog.emission.installationAllowed ||
        catalog.emission.invocationAllowed ||
        catalog.emission.promptInvocationAllowed ||
        catalog.emission.runtimeConfigurationAllowed ||
        catalog.emission.serverBytesAllowed
    )
        errors.push("Chronicle MCP guidance cannot grant executable emission");

    const expectedReferences = expectedChronicleMcpGuidanceReferences(catalog);
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
