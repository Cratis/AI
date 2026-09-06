// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateMcpDeclarations } from "../mcp-declaration-validation.mjs";
import {
    loadMcpDeclarations,
    readProfileCatalog,
    resolveProfiles,
} from "../resolve-profiles.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const fixtureFiles = [
    "mcp/mcp-server-declaration.schema.json",
    "mcp/cratis-chronicle-mcp.json",
    "mcp/cratis-studio-mcp.json",
    "distribution/profile-catalog.json",
];

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-mcp-declarations-"));
    try {
        for (const path of fixtureFiles) {
            const destination = join(root, path);
            mkdirSync(dirname(destination), { recursive: true });
            cpSync(join(repositoryRoot, path), destination);
        }
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(root, path) {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function writeJson(root, path, value) {
    writeFileSync(
        join(root, path),
        `${JSON.stringify(value, null, 2)}\n`,
    );
}

test("the authored MCP declarations are valid", () => {
    assert.deepEqual(validateMcpDeclarations(repositoryRoot), []);
    const declarations = loadMcpDeclarations(repositoryRoot);
    assert.deepEqual(
        declarations.map((declaration) => declaration.id),
        ["cratis-chronicle-mcp", "cratis-studio-mcp"],
    );
    for (const declaration of declarations) {
        assert.equal(
            declaration.classification.declarationContentClass,
            "passive-configuration",
        );
        assert.equal(
            declaration.classification.serverImplementationClass,
            "executable-code",
        );
        assert.equal(
            declaration.classification.assuranceLane,
            "governed-support",
        );
        assert.equal(
            declaration.authentication.credentialsEmittedByCratisAi,
            false,
        );
        assert.equal(
            declaration.authentication.credentialHandling,
            "delegated-to-host-and-server",
        );
        assert.equal(declaration.owner.distributedByCratisAi, false);
        for (const mapping of declaration.hostConfigurationMapping)
            assert.equal(mapping.emissionAllowed, false);
    }
});

test("Chronicle MCP resolves into the manifest of a profile that declares it", () => {
    const profileCatalog = readProfileCatalog(repositoryRoot);
    const manifest = resolveProfiles({
        profileCatalog,
        requested: ["cratis/chronicle"],
        mcpDeclarations: loadMcpDeclarations(repositoryRoot),
    });
    assert.deepEqual(
        manifest.mcpServers.map((server) => server.id),
        ["cratis-chronicle-mcp"],
    );
    const [server] = manifest.mcpServers;
    assert.deepEqual(server.includedBy, ["cratis/chronicle"]);
    assert.equal(server.transport, "stdio");
    assert.equal(server.authenticationType, "delegated");
    assert.equal(server.declarationPath, "mcp/cratis-chronicle-mcp.json");
    assert.equal(
        manifest.rejected.some(
            (rejection) => rejection.kind === "mcp-server",
        ),
        false,
    );
});

test("Studio MCP never appears in any resolved manifest", () => {
    const profileCatalog = readProfileCatalog(repositoryRoot);
    const mcpDeclarations = loadMcpDeclarations(repositoryRoot);
    for (const profile of [
        ...profileCatalog.publicProfiles,
        ...profileCatalog.engineeringProfiles,
    ]) {
        const manifest = resolveProfiles({
            profileCatalog,
            requested: [profile.id],
            mcpDeclarations,
        });
        assert.equal(
            manifest.mcpServers.some(
                (server) => server.id === "cratis-studio-mcp",
            ),
            false,
            profile.id,
        );
    }
    const forced = {
        publicProfiles: [
            {
                id: "public-forcing-studio",
                packageName: "@cratis/ai-forcing-studio",
                version: "0.0.0",
                products: [],
                state: "planned-composition",
                availableTargets: ["cratis-forcing-target"],
                mcpServers: ["cratis-studio-mcp", "cratis-chronicle-mcp"],
            },
        ],
        engineeringProfiles: [],
    };
    const manifest = resolveProfiles({
        profileCatalog: forced,
        requested: ["public-forcing-studio"],
        mcpDeclarations,
    });
    assert.deepEqual(
        manifest.mcpServers.map((server) => server.id),
        ["cratis-chronicle-mcp"],
    );
    assert.deepEqual(
        manifest.rejected.filter(
            (rejection) => rejection.kind === "mcp-server",
        ),
        [
            {
                kind: "mcp-server",
                id: "cratis-studio-mcp",
                requiredBy: "public-forcing-studio",
                reason: "MCP server cratis-studio-mcp has status extension-point-not-published and is never included in a resolved manifest.",
            },
        ],
    );
});

test("an undeclared MCP server is rejected with a reason instead of resolving", () => {
    const manifest = resolveProfiles({
        profileCatalog: {
            publicProfiles: [
                {
                    id: "public-missing-server",
                    packageName: "@cratis/ai-missing-server",
                    version: "0.0.0",
                    products: [],
                    state: "planned-composition",
                    availableTargets: ["cratis-missing-target"],
                    mcpServers: ["cratis-absent-mcp"],
                },
            ],
            engineeringProfiles: [],
        },
        requested: ["public-missing-server"],
        mcpDeclarations: loadMcpDeclarations(repositoryRoot),
    });
    assert.deepEqual(manifest.mcpServers, []);
    assert.match(
        manifest.rejected.find(
            (rejection) => rejection.kind === "mcp-server",
        ).reason,
        /No MCP server declaration exists under mcp\//,
    );
});

test("an incomplete MCP declaration is rejected", () => {
    withFixture((root) => {
        const declaration = readJson(root, "mcp/cratis-chronicle-mcp.json");
        delete declaration.transport;
        delete declaration.classification;
        writeJson(root, "mcp/cratis-chronicle-mcp.json", declaration);
        const errors = validateMcpDeclarations(root);
        assert(
            errors.some((error) =>
                error.includes("missing required property transport"),
            ),
            errors.join("; "),
        );
        assert(
            errors.some((error) =>
                error.includes("missing required property classification"),
            ),
        );
    });
});

test("a malformed MCP declaration cannot loosen its own boundaries", () => {
    withFixture((root) => {
        const declaration = readJson(root, "mcp/cratis-chronicle-mcp.json");
        declaration.classification.emission.invocationAllowed = true;
        declaration.hostConfigurationMapping[0].emissionAllowed = true;
        declaration.hostConfigurationMapping[0].host = "not-a-harness";
        declaration.authentication.credentialsEmittedByCratisAi = true;
        writeJson(root, "mcp/cratis-chronicle-mcp.json", declaration);
        const errors = validateMcpDeclarations(root);
        for (const expected of [
            "classification.emission.invocationAllowed",
            "hostConfigurationMapping[0].emissionAllowed",
            "unknown host not-a-harness",
            "authentication.credentialsEmittedByCratisAi",
        ])
            assert(
                errors.some((error) => error.includes(expected)),
                `${expected} not in ${errors.join("; ")}`,
            );
    });
});

test("a credential-bearing declaration is rejected", () => {
    withFixture((root) => {
        const declaration = readJson(root, "mcp/cratis-chronicle-mcp.json");
        declaration.reference.endpoint = "${CHRONICLE_MCP_URL}";
        writeJson(root, "mcp/cratis-chronicle-mcp.json", declaration);
        assert(
            validateMcpDeclarations(root).some((error) =>
                error.includes("credential-shaped placeholder"),
            ),
        );
        const withKey = readJson(root, "mcp/cratis-chronicle-mcp.json");
        delete withKey.reference.endpoint;
        withKey.reference.note = "Uses Bearer abc123 for access.";
        writeJson(root, "mcp/cratis-chronicle-mcp.json", withKey);
        assert(
            validateMcpDeclarations(root).some((error) =>
                error.includes("credential-shaped placeholder"),
            ),
        );
    });
});

test("a profile cannot require the unpublished Studio extension point", () => {
    withFixture((root) => {
        const profileCatalog = readJson(
            root,
            "distribution/profile-catalog.json",
        );
        profileCatalog.publicProfiles.find(
            (profile) => profile.id === "public-studio",
        ).mcpServers = ["cratis-studio-mcp"];
        writeJson(root, "distribution/profile-catalog.json", profileCatalog);
        const errors = validateMcpDeclarations(root);
        assert(
            errors.some((error) =>
                error.includes(
                    "requires cratis-studio-mcp, which is an unpublished extension point",
                ),
            ),
            errors.join("; "),
        );
    });
});

test("a profile cannot require an undeclared MCP server", () => {
    withFixture((root) => {
        const profileCatalog = readJson(
            root,
            "distribution/profile-catalog.json",
        );
        profileCatalog.publicProfiles.find(
            (profile) => profile.id === "public-studio",
        ).mcpServers = ["cratis-absent-mcp"];
        writeJson(root, "distribution/profile-catalog.json", profileCatalog);
        assert(
            validateMcpDeclarations(root).some((error) =>
                error.includes(
                    "public-studio: requires undeclared MCP server cratis-absent-mcp",
                ),
            ),
        );
    });
});
