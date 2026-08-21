// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRepositoryRoot = resolve(moduleDirectory, "..");

const catalogPaths = {
    publicSkills: "catalog/public-skills.yml",
    productCoverage: "catalog/product-coverage.yml",
    ecosystemVersions: "catalog/ecosystem-versions.json",
};

const schemaPaths = {
    publicSkills: "catalog/schemas/public-skills.schema.json",
    productCoverage: "catalog/schemas/product-coverage.schema.json",
    ecosystemVersions: "catalog/schemas/ecosystem-versions.schema.json",
};

const supportedSchemaKeywords = new Set([
    "$schema",
    "$id",
    "$defs",
    "$ref",
    "title",
    "description",
    "type",
    "additionalProperties",
    "required",
    "properties",
    "const",
    "enum",
    "minItems",
    "uniqueItems",
    "items",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "minimum",
]);

export function validateSchemaVocabulary(schema, path = "$") {
    const errors = [];
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
        return errors;
    for (const [keyword, value] of Object.entries(schema)) {
        if (!supportedSchemaKeywords.has(keyword)) {
            errors.push(`${path}: unsupported JSON Schema keyword ${keyword}`);
            continue;
        }
        if (keyword === "properties" || keyword === "$defs") {
            for (const [name, child] of Object.entries(value ?? {})) {
                errors.push(
                    ...validateSchemaVocabulary(
                        child,
                        `${path}.${keyword}.${name}`,
                    ),
                );
            }
        } else if (keyword === "items" && value && typeof value === "object") {
            errors.push(...validateSchemaVocabulary(value, `${path}.items`));
        }
    }
    return errors;
}

export function readCatalog(path) {
    const content = readFileSync(path, "utf8");
    try {
        return JSON.parse(content);
    } catch (error) {
        throw new Error(
            `${path} must use strict dependency-free JSON-compatible YAML: ${error.message}`,
        );
    }
}

function resolveReference(rootSchema, reference) {
    if (!reference.startsWith("#/")) {
        throw new Error(
            `Only local schema references are supported: ${reference}`,
        );
    }

    return reference
        .slice(2)
        .split("/")
        .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
        .reduce((current, segment) => current?.[segment], rootSchema);
}

function hasType(value, type) {
    switch (type) {
        case "array":
            return Array.isArray(value);
        case "integer":
            return Number.isInteger(value);
        case "null":
            return value === null;
        case "object":
            return (
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value)
            );
        default:
            return typeof value === type;
    }
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.valueOf()) &&
        parsed.toISOString().startsWith(value)
    );
}

function isValidUri(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol.length > 1;
    } catch {
        return false;
    }
}

function matchesKnownPattern(value, pattern) {
    switch (pattern) {
        case "^[a-z0-9]+(?:-[a-z0-9]+)*$":
            return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
        case "^cratis-[a-z0-9]+(?:-[a-z0-9]+)*$":
            return /^cratis-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
        case "^(\\.ai/skills|skills)/[a-z0-9]+(?:-[a-z0-9]+)*$":
            return /^(\.ai\/skills|skills)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
                value,
            );
        default:
            return new RegExp(pattern).test(value);
    }
}

export function validateAgainstSchema(
    value,
    schema,
    rootSchema = schema,
    path = "$",
) {
    const errors = [];

    if (schema.$ref) {
        const referencedSchema = resolveReference(rootSchema, schema.$ref);
        if (!referencedSchema)
            return [`${path}: unresolved schema reference ${schema.$ref}`];
        return validateAgainstSchema(value, referencedSchema, rootSchema, path);
    }

    if (Object.hasOwn(schema, "const") && value !== schema.const) {
        errors.push(
            `${path}: expected constant ${JSON.stringify(schema.const)}`,
        );
    }

    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: expected one of ${schema.enum.join(", ")}`);
    }

    if (schema.type && !hasType(value, schema.type)) {
        errors.push(`${path}: expected ${schema.type}`);
        return errors;
    }

    if (typeof value === "string") {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(
                `${path}: must contain at least ${schema.minLength} characters`,
            );
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(
                `${path}: must contain at most ${schema.maxLength} characters`,
            );
        }
        if (schema.pattern && !matchesKnownPattern(value, schema.pattern)) {
            errors.push(`${path}: does not match ${schema.pattern}`);
        }
        if (schema.format === "date" && !isValidDate(value)) {
            errors.push(`${path}: must be an ISO calendar date`);
        }
        if (schema.format === "uri" && !isValidUri(value)) {
            errors.push(`${path}: must be an absolute URI`);
        }
    }

    if (
        typeof value === "number" &&
        schema.minimum !== undefined &&
        value < schema.minimum
    ) {
        errors.push(`${path}: must be at least ${schema.minimum}`);
    }

    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push(
                `${path}: must contain at least ${schema.minItems} items`,
            );
        }
        if (schema.uniqueItems) {
            const serializedItems = value.map((item) => JSON.stringify(item));
            if (new Set(serializedItems).size !== serializedItems.length) {
                errors.push(`${path}: must not contain duplicate items`);
            }
        }
        if (schema.items) {
            value.forEach((item, index) => {
                errors.push(
                    ...validateAgainstSchema(
                        item,
                        schema.items,
                        rootSchema,
                        `${path}[${index}]`,
                    ),
                );
            });
        }
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const requiredProperty of schema.required ?? []) {
            if (!Object.hasOwn(value, requiredProperty)) {
                errors.push(
                    `${path}: missing required property ${requiredProperty}`,
                );
            }
        }

        if (schema.additionalProperties === false) {
            const knownProperties = new Set(
                Object.keys(schema.properties ?? {}),
            );
            for (const property of Object.keys(value)) {
                if (!knownProperties.has(property)) {
                    errors.push(`${path}: unknown property ${property}`);
                }
            }
        }

        for (const [property, propertySchema] of Object.entries(
            schema.properties ?? {},
        )) {
            if (Object.hasOwn(value, property)) {
                errors.push(
                    ...validateAgainstSchema(
                        value[property],
                        propertySchema,
                        rootSchema,
                        `${path}.${property}`,
                    ),
                );
            }
        }
    }

    return errors;
}

function findDuplicates(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates];
}

function extractSkillName(skillFile) {
    const content = readFileSync(skillFile, "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) return undefined;
    return frontmatter[1]
        .match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]
        ?.trim();
}

function validatePublicSkills(catalog, coverage, root) {
    const errors = [];
    const skillRoot = join(root, ".ai/skills");
    const currentDirectories = readdirSync(skillRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const publicNames = catalog.skills.map((skill) => skill.currentName);
    const internalNames = catalog.audit.internalSkills.map(
        (skill) => skill.currentName,
    );
    const catalogedNames = [...publicNames, ...internalNames].sort();
    const knownProducts = new Set(
        coverage.products.map((product) => product.id),
    );
    const knownLanguages = new Set(
        coverage.languages.map((language) => language.id),
    );

    if (catalog.audit.currentInventoryCount !== currentDirectories.length) {
        errors.push(
            `public-skills audit count is ${catalog.audit.currentInventoryCount}; found ${currentDirectories.length} current skills`,
        );
    }
    if (catalog.audit.publicCandidateCount !== catalog.skills.length) {
        errors.push(
            `public-skills candidate count is ${catalog.audit.publicCandidateCount}; catalog contains ${catalog.skills.length}`,
        );
    }
    if (
        catalog.audit.internalSkillCount !== catalog.audit.internalSkills.length
    ) {
        errors.push(
            `public-skills internal count is ${catalog.audit.internalSkillCount}; audit contains ${catalog.audit.internalSkills.length}`,
        );
    }
    if (JSON.stringify(catalogedNames) !== JSON.stringify(currentDirectories)) {
        errors.push(
            "public-skills audit must account for every current .ai/skills directory exactly once",
        );
    }

    for (const duplicate of findDuplicates(publicNames)) {
        errors.push(
            `public-skills contains duplicate current name ${duplicate}`,
        );
    }
    for (const duplicate of findDuplicates(internalNames)) {
        errors.push(
            `public-skills contains duplicate internal name ${duplicate}`,
        );
    }

    for (const skill of catalog.skills) {
        const sourcePath = join(root, skill.source);
        const skillFile = join(sourcePath, "SKILL.md");
        if (existsSync(skillFile)) {
            const frontmatterName = extractSkillName(skillFile);
            if (frontmatterName !== skill.currentName) {
                errors.push(
                    `${skill.currentName}: current SKILL.md name is ${frontmatterName ?? "missing"}`,
                );
            }
        } else {
            errors.push(
                `${skill.currentName}: missing ${skill.source}/SKILL.md`,
            );
        }

        for (const product of skill.products) {
            if (!knownProducts.has(product))
                errors.push(`${skill.currentName}: unknown product ${product}`);
        }
        for (const language of skill.languages) {
            if (!knownLanguages.has(language))
                errors.push(
                    `${skill.currentName}: unknown language ${language}`,
                );
        }
        for (const dependency of skill.dependencies.skills) {
            if (!currentDirectories.includes(dependency)) {
                errors.push(
                    `${skill.currentName}: unknown skill dependency ${dependency}`,
                );
            }
        }

        if (skill.disposition === "merge-review" && !skill.mergeGroup) {
            errors.push(
                `${skill.currentName}: merge-review requires mergeGroup`,
            );
        }
        if (skill.disposition !== "merge-review" && skill.mergeGroup) {
            errors.push(
                `${skill.currentName}: mergeGroup is only valid for merge-review`,
            );
        }
        if (
            skill.disposition === "split-review" &&
            (!skill.splitTargets ||
                !skill.splitTargets.includes(skill.proposedName))
        ) {
            errors.push(
                `${skill.currentName}: split-review requires splitTargets containing proposedName`,
            );
        }
        if (skill.disposition !== "split-review" && skill.splitTargets) {
            errors.push(
                `${skill.currentName}: splitTargets is only valid for split-review`,
            );
        }
        if (skill.publicationStatus !== "approved" && skill.includeInRuntime) {
            errors.push(
                `${skill.currentName}: only approved skills may set includeInRuntime`,
            );
        }
        if (skill.publicationStatus === "approved") {
            if (!skill.includeInRuntime)
                errors.push(
                    `${skill.currentName}: approved skills must set includeInRuntime`,
                );
            if (skill.source !== `skills/${skill.proposedName}`) {
                errors.push(
                    `${skill.currentName}: approved source must be skills/${skill.proposedName}`,
                );
            }
            if (skill.currentName !== skill.proposedName) {
                errors.push(
                    `${skill.currentName}: approved currentName must match proposedName`,
                );
            }
            if (skill.dependencies.internalArtifacts.length > 0) {
                errors.push(
                    `${skill.currentName}: approved skills may not depend on internal artifacts`,
                );
            }
            if (skill.reviewNotes.length > 0) {
                errors.push(
                    `${skill.currentName}: approved skills may not retain unresolved review notes`,
                );
            }
        }
    }

    const skillsByProposedName = new Map();
    for (const skill of catalog.skills) {
        const targets = skill.splitTargets ?? [skill.proposedName];
        for (const target of targets) {
            const group = skillsByProposedName.get(target) ?? [];
            group.push(skill);
            skillsByProposedName.set(target, group);
        }
    }
    for (const [proposedName, skills] of skillsByProposedName) {
        if (skills.length < 2) continue;
        const mergeGroups = new Set(skills.map((skill) => skill.mergeGroup));
        const isMergeReview = skills.every(
            (skill) => skill.disposition === "merge-review",
        );
        if (
            !isMergeReview ||
            mergeGroups.size !== 1 ||
            mergeGroups.has(undefined)
        ) {
            errors.push(
                `${proposedName}: duplicate proposed names require one explicit merge-review group`,
            );
        }
    }

    const requiredForbiddenPatterns = [
        "rules/**",
        "agents/**",
        "prompts/**",
        "hooks/**",
        "scripts/**",
        "evals/**",
        ".ai/**",
    ];
    for (const pattern of requiredForbiddenPatterns) {
        if (!catalog.runtimePayloadPolicy.forbidden.includes(pattern)) {
            errors.push(`runtimePayloadPolicy must forbid ${pattern}`);
        }
    }

    return errors;
}

function validateProductCoverage(coverage, publicSkills) {
    const errors = [];
    const languageIds = coverage.languages.map((language) => language.id);
    const productIds = coverage.products.map((product) => product.id);
    const currentPublicSkills = new Set(
        publicSkills.skills.map((skill) => skill.currentName),
    );

    for (const duplicate of findDuplicates(languageIds))
        errors.push(
            `product-coverage contains duplicate language ${duplicate}`,
        );
    for (const duplicate of findDuplicates(productIds))
        errors.push(`product-coverage contains duplicate product ${duplicate}`);

    for (const product of coverage.products) {
        const capabilityIds = product.capabilities.map(
            (capability) => capability.id,
        );
        for (const duplicate of findDuplicates(capabilityIds)) {
            errors.push(`${product.id}: duplicate capability ${duplicate}`);
        }
        for (const capability of product.capabilities) {
            for (const language of capability.languages) {
                if (!languageIds.includes(language))
                    errors.push(
                        `${product.id}/${capability.id}: unknown language ${language}`,
                    );
            }
            for (const sourceSkill of capability.sourceSkills) {
                if (!currentPublicSkills.has(sourceSkill))
                    errors.push(
                        `${product.id}/${capability.id}: unknown public source skill ${sourceSkill}`,
                    );
            }
            if (
                capability.status === "candidate" &&
                capability.sourceSkills.length === 0
            ) {
                errors.push(
                    `${product.id}/${capability.id}: candidate capability requires a source skill`,
                );
            }
            if (
                capability.status === "backlog" &&
                capability.sourceSkills.length > 0
            ) {
                errors.push(
                    `${product.id}/${capability.id}: backlog capability may not claim a source skill`,
                );
            }
        }
    }

    return errors;
}

function validateEcosystems(registry) {
    const errors = [];
    const ecosystemIds = registry.ecosystems.map((ecosystem) => ecosystem.id);
    const requiredEcosystems = [
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
        "grok-bot-plugins",
        "nanoclaw-templates",
        "pi-packages",
        "junie-extensions",
        "opencode-skills",
        "zed-skills",
        "deepseek-harness-skills",
        "npm-cratis-scope",
        "npm-trusted-publishing",
    ];

    for (const duplicate of findDuplicates(ecosystemIds))
        errors.push(`ecosystem-versions contains duplicate id ${duplicate}`);
    for (const required of requiredEcosystems) {
        if (!ecosystemIds.includes(required))
            errors.push(`ecosystem-versions is missing ${required}`);
    }
    for (const ecosystem of registry.ecosystems) {
        for (const source of ecosystem.sources) {
            if (!source.url.startsWith("https://"))
                errors.push(
                    `${ecosystem.id}: source must use https: ${source.url}`,
                );
            if (source.verifiedOn > registry.verifiedOn) {
                errors.push(
                    `${ecosystem.id}: source verification date is later than registry verification date`,
                );
            }
        }
    }

    return errors;
}

export function validateCatalogs(root = defaultRepositoryRoot) {
    const schemas = {};
    const catalogs = {};
    const errors = [];

    for (const key of Object.keys(catalogPaths)) {
        try {
            schemas[key] = readCatalog(join(root, schemaPaths[key]));
            catalogs[key] = readCatalog(join(root, catalogPaths[key]));
        } catch (error) {
            errors.push(error.message);
        }
    }

    if (errors.length > 0) return errors;

    for (const key of Object.keys(catalogPaths)) {
        errors.push(
            ...validateSchemaVocabulary(schemas[key]).map(
                (error) => `${schemaPaths[key]} ${error}`,
            ),
        );
        errors.push(
            ...validateAgainstSchema(catalogs[key], schemas[key]).map(
                (error) => `${catalogPaths[key]} ${error}`,
            ),
        );
    }

    errors.push(
        ...validatePublicSkills(
            catalogs.publicSkills,
            catalogs.productCoverage,
            root,
        ),
    );
    errors.push(
        ...validateProductCoverage(
            catalogs.productCoverage,
            catalogs.publicSkills,
        ),
    );
    errors.push(...validateEcosystems(catalogs.ecosystemVersions));

    return errors;
}

export { catalogPaths, schemaPaths };
