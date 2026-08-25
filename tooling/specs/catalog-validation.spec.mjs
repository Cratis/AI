// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateCatalogs,
    validateEcosystems,
} from "../catalog-validation.mjs";

const publicCatalogPath = join(
    defaultRepositoryRoot,
    "catalog/public-skills.yml",
);
const publicSchemaPath = join(
    defaultRepositoryRoot,
    "catalog/schemas/public-skills.schema.json",
);
const coveragePath = join(
    defaultRepositoryRoot,
    "catalog/product-coverage.yml",
);
const coverageSchemaPath = join(
    defaultRepositoryRoot,
    "catalog/schemas/product-coverage.schema.json",
);
const ecosystemPath = join(
    defaultRepositoryRoot,
    "catalog/ecosystem-versions.json",
);
const ecosystemSchemaPath = join(
    defaultRepositoryRoot,
    "catalog/schemas/ecosystem-versions.schema.json",
);

const clone = (value) => structuredClone(value);

test("repository catalogs satisfy schemas and semantic policy", () => {
    assert.deepEqual(validateCatalogs(), []);
});

test("catalog YAML files intentionally use strict dependency-free JSON-compatible syntax", () => {
    assert.doesNotThrow(() => readCatalog(publicCatalogPath));
    assert.doesNotThrow(() => readCatalog(coveragePath));
    assert(readFileSync(publicCatalogPath, "utf8").trimStart().startsWith("{"));
    assert(readFileSync(coveragePath, "utf8").trimStart().startsWith("{"));
});

test("catalog parsing rejects trailing commas without mutating string content", () => {
    const directory = mkdtempSync(join(tmpdir(), "cratis-ai-catalog-"));
    const path = join(directory, "invalid.json");
    writeFileSync(path, '{"note":"x,}",}', "utf8");

    try {
        assert.throws(() => readCatalog(path), /strict dependency-free/);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("public schema rejects unknown fields and non-Cratis public names", () => {
    const schema = readCatalog(publicSchemaPath);
    const catalog = clone(readCatalog(publicCatalogPath));
    catalog.unexpected = true;
    catalog.skills[0].proposedName = "business-rule";

    const errors = validateAgainstSchema(catalog, schema);
    assert(
        errors.some((error) => error.includes("unknown property unexpected")),
    );
    assert(errors.some((error) => error.includes("does not match")));
});

test("public catalog starts deny-by-default with no runtime-approved candidates", () => {
    const catalog = readCatalog(publicCatalogPath);
    assert.equal(catalog.defaultPolicy, "deny");
    assert.equal(catalog.skills.length, 37);
    assert.equal(catalog.audit.internalSkills.length, 8);
    assert(
        catalog.skills.every(
            (skill) => skill.publicationStatus === "candidate",
        ),
    );
    assert(catalog.skills.every((skill) => skill.includeInRuntime === false));
});

test("Chronicle MCP candidate remains classification-only and runtime denied", () => {
    const catalog = readCatalog(publicCatalogPath);
    const guidance = catalog.skills.find(
        (skill) =>
            skill.currentName === "cratis-chronicle-mcp-inspection",
    );
    assert.equal(guidance.source, "skills/cratis-chronicle-mcp-inspection");
    assert.equal(guidance.disposition, "retain");
    assert.equal(guidance.publicationStatus, "candidate");
    assert.equal(guidance.includeInRuntime, false);
    assert.deepEqual(guidance.products, ["chronicle-mcp"]);
    assert.deepEqual(guidance.dependencies.externalTools, []);
});

test("Studio MCP candidate remains public-safe, classification-only, and denied", () => {
    const catalog = readCatalog(publicCatalogPath);
    const guidance = catalog.skills.find(
        (skill) =>
            skill.currentName === "cratis-studio-mcp-safety-guidance",
    );
    assert.equal(guidance.source, "skills/cratis-studio-mcp-safety-guidance");
    assert.equal(guidance.disposition, "retain");
    assert.equal(guidance.publicationStatus, "candidate");
    assert.equal(guidance.includeInRuntime, false);
    assert.deepEqual(guidance.products, ["studio"]);
    assert.deepEqual(guidance.dependencies.externalTools, []);
});

test("business-rule source records the approved split review", () => {
    const catalog = readCatalog(publicCatalogPath);
    const businessRules = catalog.skills.find(
        (skill) => skill.currentName === "add-business-rule",
    );

    assert.equal(businessRules.disposition, "split-review");
    assert.deepEqual(businessRules.splitTargets, [
        "cratis-arc-command-validation",
        "cratis-chronicle-event-constraints",
    ]);
});

test("vertical-slice duplicate target is explicitly limited to one merge review", () => {
    const catalog = readCatalog(publicCatalogPath);
    const matching = catalog.skills.filter(
        (skill) => skill.proposedName === "cratis-application-vertical-slice",
    );

    assert.equal(matching.length, 2);
    assert(matching.every((skill) => skill.disposition === "merge-review"));
    assert.deepEqual(
        [...new Set(matching.map((skill) => skill.mergeGroup))],
        ["application-vertical-slice"],
    );
});

test("product coverage schema rejects an unknown capability property", () => {
    const schema = readCatalog(coverageSchemaPath);
    const catalog = clone(readCatalog(coveragePath));
    catalog.products[0].capabilities[0].claim = "unsupported";

    const errors = validateAgainstSchema(catalog, schema);
    assert(errors.some((error) => error.includes("unknown property claim")));
});

test("ecosystem schema requires official source registry fields", () => {
    const schema = readCatalog(ecosystemSchemaPath);
    const registry = clone(readCatalog(ecosystemPath));
    delete registry.ecosystems[0].sources;

    const errors = validateAgainstSchema(registry, schema);
    assert(
        errors.some((error) =>
            error.includes("missing required property sources"),
        ),
    );
});

test("ecosystem semantic validation rejects missing and unregistered records", () => {
    const missing = clone(readCatalog(ecosystemPath));
    missing.ecosystems = missing.ecosystems.filter(
        (ecosystem) => ecosystem.id !== "agent-plugins",
    );
    assert(
        validateEcosystems(missing).includes(
            "ecosystem-versions is missing required ecosystem agent-plugins",
        ),
    );

    const unexpected = clone(readCatalog(ecosystemPath));
    unexpected.ecosystems.push({
        ...unexpected.ecosystems[0],
        id: "unregistered-ecosystem",
    });
    assert(
        validateEcosystems(unexpected).includes(
            "ecosystem-versions contains unregistered ecosystem unregistered-ecosystem",
        ),
    );
});

test("ecosystem registry includes current MCP and compatible-client evidence", () => {
    const registry = readCatalog(ecosystemPath);
    const byId = new Map(
        registry.ecosystems.map((ecosystem) => [ecosystem.id, ecosystem]),
    );

    assert.equal(byId.get("model-context-protocol").version, "2026-07-28");
    assert(byId.has("vscode-agent-plugins"));
    assert(byId.has("openclaw-bundles"));
    assert.equal(byId.get("deepseek-deepcode-skills").status, "current");
    assert.equal(byId.get("deepseek-harness-skills").status, "preview");
    assert(byId.has("npm-trusted-publishing"));
    assert.equal(byId.get("pi-packages").version, "0.84.3-registry-latest");
    assert.equal(
        byId.get("claude-code-plugins").version,
        "claude-code-2.1.245-registry-latest",
    );
    assert.equal(
        byId.get("openai-plugins").version,
        "codex-cli-0.149.1-registry-latest",
    );
    assert.equal(
        byId.get("github-copilot-plugins").version,
        "copilot-cli-1.0.80-registry-latest",
    );
    assert.equal(
        byId.get("gemini-cli-extensions").version,
        "gemini-cli-0.56.0-registry-latest",
    );
    assert.equal(
        byId.get("qwen-code").version,
        "qwen-code-0.22.0-registry-latest",
    );
    assert.equal(byId.get("roo-code").status, "archived");
    assert.equal(byId.get("continue").status, "archived");
    assert.equal(byId.get("amazon-q-developer").status, "retiring");
});
