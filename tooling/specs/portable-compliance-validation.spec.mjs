// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
    formatComplianceDiagnostics,
    parseAgentSkillFrontmatter,
    validateAgentPluginArtifact,
    validateCratisPassiveProfile,
    validateMcpConfiguration,
    validatePluginManifest,
    validateSpecificationLock,
} from "../portable-compliance-validation.mjs";

const fixtureRoot = resolve("tooling/fixtures/portable-compliance");
const pluginSchema =
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-portable-compliance-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function copyFixture(root, name = "passive-one-skill") {
    const destination = join(root, "plugin");
    cpSync(join(fixtureRoot, name), destination, { recursive: true });
    return destination;
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function codes(result) {
    return result.diagnostics.map((entry) => entry.code);
}

function assertCode(result, code) {
    assert(
        codes(result).includes(code),
        `${code}: ${codes(result).join(", ")}`,
    );
}

function validatePassive(root) {
    return validateCratisPassiveProfile(root, {
        profileId: "public-example",
        version: "1.2.3",
    });
}

test("official specification locks verify exact offline bytes and published 1.0.0", () => {
    assert.deepEqual(validateSpecificationLock(), []);
    const lock = readJson(
        "tooling/specifications/agent-plugins/1.0.0/specification-lock.json",
    );
    assert.equal(lock.version, "1.0.0");
    assert.equal(lock.status, "published");
    assert.equal(lock.runtimeNetworkAllowed, false);
    assert.deepEqual(
        lock.sources.map((source) => [source.role, source.sha256]),
        [
            [
                "plugin-schema",
                "0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883",
            ],
            [
                "mcp-schema",
                "6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb",
            ],
            [
                "normative-specification",
                "97a658b7dca3ce1b4c2266b95da300fa51d9dc4ade59d73168e5f9104272da18",
            ],
        ],
    );
    const skillContract = readJson(
        "tooling/specifications/agent-skills/current/contract.json",
    );
    assert.equal(
        skillContract.source.sha256,
        "2b1dbb4fd80c31748d15812c4ebd3e66c09383d0c792801f617718684489e40d",
    );
    assert.equal(skillContract.status, "current-unversioned-specification");
});

test("specification and skill contract JSON reject falsy top-level documents", () => {
    for (const raw of ["null", "false", "0", '""']) {
        withTemporaryDirectory((root) => {
            cpSync(
                "tooling/specifications",
                join(root, "tooling/specifications"),
                { recursive: true },
            );
            writeFileSync(
                join(
                    root,
                    "tooling/specifications/agent-plugins/1.0.0/specification-lock.json",
                ),
                `${raw}\n`,
            );
            let diagnostics = validateSpecificationLock({
                repositoryRoot: root,
            });
            assertCode({ diagnostics }, "SPEC_LOCK_CONTRACT_INVALID");

            cpSync(
                "tooling/specifications/agent-plugins/1.0.0/specification-lock.json",
                join(
                    root,
                    "tooling/specifications/agent-plugins/1.0.0/specification-lock.json",
                ),
                { force: true },
            );
            writeFileSync(
                join(
                    root,
                    "tooling/specifications/agent-skills/current/contract.json",
                ),
                `${raw}\n`,
            );
            diagnostics = validateSpecificationLock({
                repositoryRoot: root,
            });
            assertCode({ diagnostics }, "SKILL_CONTRACT_INVALID");
        });
    }
});

test("specification lock rejects changed locked bytes offline", () => {
    withTemporaryDirectory((root) => {
        cpSync("tooling/specifications", join(root, "tooling/specifications"), {
            recursive: true,
        });
        writeFileSync(
            join(
                root,
                "tooling/specifications/agent-plugins/1.0.0/plugin.schema.json",
            ),
            "{}\n",
        );
        const diagnostics = validateSpecificationLock({
            repositoryRoot: root,
        });
        assertCode({ diagnostics }, "SPEC_LOCK_DIGEST_MISMATCH");
    });
});

test("manifest-only plugin passes universal and fails passive only for skills", () => {
    const root = join(fixtureRoot, "manifest-only");
    const universal = validateAgentPluginArtifact(root);
    assert.equal(universal.conformant, true);
    assert.equal(universal.loadable, true);
    assert.deepEqual(universal.diagnostics, []);
    assert.equal(universal.mcp.present, false);
    const passive = validateCratisPassiveProfile(root, {
        profileId: "public-manifest-only",
        version: "1.0.0",
    });
    assert.deepEqual(codes(passive), ["PASSIVE_SKILL_REQUIRED"]);
    assert.equal(passive.loadable, true);
});

test("golden plugin, extension, optional MCP, skills forms, and sibling isolation validate", () => {
    for (const name of [
        "passive-one-skill",
        "valid-mcp",
        "reverse-domain-extension",
        "all-skill-options",
    ]) {
        const result = validateAgentPluginArtifact(join(fixtureRoot, name));
        assert.equal(result.conformant, true, `${name}: ${codes(result)}`);
        assert.equal(result.loadable, true);
    }
    const passive = validatePassive(join(fixtureRoot, "passive-one-skill"));
    assert.equal(passive.conformant, true);
    assert.equal(passive.releaseBlocking, false);
    const allOptions = validateAgentPluginArtifact(
        join(fixtureRoot, "all-skill-options"),
    );
    assert.equal(
        allOptions.skills[0].frontmatter.description.includes(
            "folded scalar behavior",
        ),
        true,
    );
    assert.equal(
        allOptions.skills[0].frontmatter.compatibility.endsWith("host."),
        true,
    );
    assert.deepEqual(allOptions.skills[0].frontmatter.metadata, {
        owner: "Cratis",
        release: "fixture",
    });
    const sibling = validateAgentPluginArtifact(
        join(fixtureRoot, "sibling-isolation"),
    );
    assert.equal(sibling.loadable, true);
    assert.equal(sibling.skills.length, 2);
    assert.equal(
        sibling.skills.find((skill) => skill.name === "valid-sibling").valid,
        true,
    );
    assert.equal(
        sibling.skills.find((skill) => skill.name === "invalid-sibling").valid,
        false,
    );
    assertCode(sibling, "SKILL_NAME_DIRECTORY_MISMATCH");
});

test("frontmatter parser rejects ambiguous YAML while retaining safe metadata keys", () => {
    for (const source of [
        "---\nname:value\ndescription: Test.\n---\n",
        "---\nname: test\ndescription: # comment\n---\n",
        "---\nname: test\ndescription: 0x41\n---\n",
        "---\nname: test\ndescription: 0o10\n---\n",
        "---\nname: test\ndescription: .5\n---\n",
        "---\nname: test\ndescription: |bogus\n---\n",
        "---\nname: test\ndescription: 'safe'junk'\n---\n",
        '---\nname: test\ndescription: "safe"junk"\n---\n',
        '---\nname: test\ndescription: "\\uD800"\n---\n',
        "---\nname: test\ndescription: >\n  first\n    more indented\n---\n",
    ]) {
        const result = parseAgentSkillFrontmatter(source);
        assert.equal(result.valid, false, source);
    }

    const metadata = parseAgentSkillFrontmatter(
        "---\nname: metadata\ndescription: Safe.\nmetadata:\n  # retained comment\n  owner: one\n  owner : two\n  __proto__: safe\n---\n",
    );
    assertCode(metadata, "SKILL_METADATA_DUPLICATE_KEY");
    assert.equal(
        Object.hasOwn(metadata.frontmatter.metadata, "__proto__"),
        true,
    );
    assert.equal(metadata.frontmatter.metadata.__proto__, "safe");
    assert.equal(
        Object.getPrototypeOf(metadata.frontmatter.metadata),
        Object.prototype,
    );
});

test("frontmatter parser is bounded, typed, duplicate-safe, and byte preserving", () => {
    const source = Buffer.from(
        "---\r\nname: quoted-skill\r\ndescription: >-\r\n  A folded\r\n  description.\r\nlicense: 'LICENSE''S'\r\ncompatibility: |\r\n  Node 24\r\nmetadata:\r\n  owner: \"Cratis\"\r\nallowed-tools: Read Grep\r\n---\r\n\r\n# Body\r\n",
    );
    const parsed = parseAgentSkillFrontmatter(source);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.sourceBytes.equals(source), true);
    assert.equal(parsed.frontmatter.description, "A folded description.");
    assert.equal(parsed.frontmatter.license, "LICENSE'S");
    assert.equal(parsed.frontmatter.compatibility, "Node 24\n");
    assert.deepEqual(parsed.frontmatter.metadata, { owner: "Cratis" });
    assert.match(parsed.body, /# Body/);

    const duplicate = parseAgentSkillFrontmatter(
        "---\nname: duplicate\nname: duplicate\ndescription: Test.\n---\n",
    );
    assertCode(duplicate, "SKILL_FRONTMATTER_DUPLICATE_KEY");
    const metadataDuplicate = parseAgentSkillFrontmatter(
        "---\nname: duplicate\ndescription: Test.\nmetadata:\n  owner: one\n  owner: two\n---\n",
    );
    assertCode(metadataDuplicate, "SKILL_METADATA_DUPLICATE_KEY");
    const wrongYaml = parseAgentSkillFrontmatter(
        "---\nname: &anchor invalid\ndescription: [not, a, string]\nunknown: value\n---\n",
    );
    assertCode(wrongYaml, "SKILL_YAML_SCALAR_INVALID");
    assertCode(wrongYaml, "SKILL_FRONTMATTER_UNKNOWN_FIELD");
});

test("JSON inputs reject falsy roots duplicate keys and invalid UTF-8", () => {
    withTemporaryDirectory((root) => {
        const plugin = join(root, "plugin");
        mkdirSync(plugin);
        for (const raw of ["null", "false", "0", '""']) {
            writeFileSync(join(plugin, "plugin.json"), `${raw}\n`);
            const result = validatePluginManifest(plugin);
            assertCode(result, "AP_MANIFEST_TOP_LEVEL_INVALID");
            assert.equal(result.loadable, false);
        }

        writeFileSync(
            join(plugin, "plugin.json"),
            `{"$schema":${JSON.stringify(pluginSchema)},"name":"first","name":"second"}\n`,
        );
        assertCode(
            validatePluginManifest(plugin),
            "JSON_DUPLICATE_KEY",
        );

        writeFileSync(
            join(plugin, "plugin.json"),
            Buffer.from([
                0x7b,
                0x22,
                0x6e,
                0x61,
                0x6d,
                0x65,
                0x22,
                0x3a,
                0x22,
                0xff,
                0x22,
                0x7d,
            ]),
        );
        assertCode(
            validatePluginManifest(plugin),
            "JSON_ENCODING_INVALID",
        );

        writeJson(join(plugin, "plugin.json"), {
            $schema: pluginSchema,
            name: "valid",
        });
        for (const raw of ["null", "false", "0", '""']) {
            writeFileSync(join(plugin, "mcp.json"), `${raw}\n`);
            assertCode(
                validateMcpConfiguration(plugin, {
                    pluginManifest: readJson(join(plugin, "plugin.json")),
                }),
                "MCP_TOP_LEVEL_INVALID",
            );
        }
        writeFileSync(
            join(plugin, "mcp.json"),
            '{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{"x":{"type":"stdio","command":"bad","command":"node"}}}\n',
        );
        assertCode(
            validateMcpConfiguration(plugin, {
                pluginManifest: readJson(join(plugin, "plugin.json")),
            }),
            "JSON_DUPLICATE_KEY",
        );
    });
});

test("missing malformed renamed and closed manifest failures have exact boundaries", () => {
    withTemporaryDirectory((root) => {
        const plugin = join(root, "plugin");
        mkdirSync(plugin);
        let result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_MANIFEST_MISSING");
        assert.equal(result.loadable, false);
        writeFileSync(join(plugin, "manifest.json"), "{}\n");
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_MANIFEST_MISSING");
        writeFileSync(join(plugin, "plugin.json"), "{not-json\n");
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_MANIFEST_JSON_INVALID");
        writeJson(join(plugin, "plugin.json"), {
            $schema: pluginSchema,
            name: "valid-name",
            author: { company: "Unknown" },
        });
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_MANIFEST_AUTHOR_INVALID");
        assert.equal(result.loadable, false);
    });
});

test("wrong fixed component kinds are isolated from the valid manifest", () => {
    withTemporaryDirectory((root) => {
        const plugin = join(root, "plugin");
        mkdirSync(plugin);
        writeJson(join(plugin, "plugin.json"), {
            $schema: pluginSchema,
            name: "component-kinds",
        });
        writeFileSync(join(plugin, "skills"), "not a directory\n");
        mkdirSync(join(plugin, "mcp.json"));
        const result = validateAgentPluginArtifact(plugin);
        assert.equal(result.loadable, true);
        assertCode(result, "AP_SKILLS_COMPONENT_INVALID");
        assertCode(result, "MCP_COMPONENT_PATH_INVALID");
    });
});

test("unknown security-like fields and non-object extensions remain loadable but block passive", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root);
        const path = join(plugin, "plugin.json");
        const manifest = readJson(path);
        Object.assign(manifest, {
            signature: "not-portable",
            publicKey: "not-portable",
            security: { sandbox: true },
            extensions: "not-an-object",
        });
        writeJson(path, manifest);
        const universal = validateAgentPluginArtifact(plugin);
        assert.equal(universal.loadable, true);
        assert.equal(universal.conformant, false);
        assert.equal(
            codes(universal).filter(
                (code) => code === "AP_MANIFEST_UNKNOWN_FIELD",
            ).length,
            3,
        );
        assertCode(universal, "AP_EXTENSIONS_NON_OBJECT_IGNORED");
        assert.equal(
            universal.diagnostics.every((entry) => entry.fatal === false),
            true,
        );
        const passive = validatePassive(plugin);
        assert.equal(passive.releaseBlocking, true);
        assertCode(passive, "AP_MANIFEST_UNKNOWN_FIELD");
        assertCode(passive, "AP_EXTENSIONS_NON_OBJECT_IGNORED");
    });
});

test("extension namespaces and exact directory names are diagnosed", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root, "reverse-domain-extension");
        const path = join(plugin, "plugin.json");
        const manifest = readJson(path);
        manifest.extensions = { invalid: {} };
        writeJson(path, manifest);
        let result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_EXTENSION_NAMESPACE_INVALID");
        manifest.extensions = { "com.cratis.fixture": {} };
        writeJson(path, manifest);
        rmSync(join(plugin, "com.cratis.fixture"), { recursive: true });
        mkdirSync(join(plugin, "Com.Cratis.Fixture"));
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "AP_EXTENSION_DIRECTORY_MISMATCH");
        assertCode(result, "AP_EXTENSION_DIRECTORY_NAMESPACE_INVALID");
    });
});

test("skill limits, nesting, directory parity, types, and passive allowed-tools are enforced", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root, "all-skill-options");
        let result = validateAgentPluginArtifact(plugin);
        assert.equal(result.skills.length, 1);
        assert.equal(result.skills[0].valid, true);
        const skillPath = join(plugin, "skills/all-options/SKILL.md");
        writeFileSync(
            skillPath,
            `---\nname: all-options\ndescription: ${"x".repeat(1025)}\ncompatibility: ${"y".repeat(501)}\nallowed-tools: Read\n---\n`,
        );
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "SKILL_DESCRIPTION_LENGTH_INVALID");
        assertCode(result, "SKILL_COMPATIBILITY_INVALID");
        writeFileSync(
            skillPath,
            "---\nname: all-options\ndescription: |\n---\n",
        );
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "SKILL_DESCRIPTION_LENGTH_INVALID");
        writeFileSync(
            skillPath,
            "---\nname: all-options\ndescription: Valid.\nallowed-tools: Read\n---\n",
        );
        const passive = validateCratisPassiveProfile(plugin, {
            profileId: "all-skill-options",
            version: undefined,
        });
        assertCode(passive, "PASSIVE_ALLOWED_TOOLS_FORBIDDEN");
        mkdirSync(join(plugin, "skills/container/nested"), { recursive: true });
        writeFileSync(
            join(plugin, "skills/container/nested/SKILL.md"),
            "---\nname: nested\ndescription: Not discovered.\n---\n",
        );
        result = validateAgentPluginArtifact(plugin);
        assert.equal(
            result.skills.some((skill) => skill.name === "nested"),
            false,
        );
    });
});

test("MCP variants isolate malformed siblings and reject mixed fields paths env URLs and headers", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root, "valid-mcp");
        const path = join(plugin, "mcp.json");
        const configuration = readJson(path);
        Object.assign(configuration.mcpServers, {
            mixed: {
                type: "stdio",
                command: "node --eval bad",
                url: "https://example.com/mcp",
            },
            reserved: {
                type: "stdio",
                command: "node",
                cwd: "../escape",
                env: {
                    PLUGIN_ROOT: "bad",
                    token: "abcdefghijklmnopqrstuvwxyz123456",
                },
            },
            placeholders: {
                type: "stdio",
                command: "node",
                args: ["${UNSUPPORTED}/file"],
                env: { CONFIG: "${OTHER}" },
            },
            cwdSymlink: {
                type: "stdio",
                command: "node",
                cwd: "${PLUGIN_ROOT}/link",
            },
            insecure: {
                type: "streamable-http",
                url: "http://example.com/mcp#fragment",
                headers: {
                    Authorization: "Basic dXNlcjpwYXNzd29yZA==",
                    authorization: "duplicate",
                    "X-Control": "ok\u0001bad",
                },
            },
        });
        mkdirSync(join(root, "outside"));
        symlinkSync(join(root, "outside"), join(plugin, "link"));
        writeJson(path, configuration);
        let result = validateAgentPluginArtifact(plugin);
        assert.equal(result.loadable, true);
        assert.equal(
            result.mcp.servers.find((server) => server.name === "local").valid,
            true,
        );
        assert.equal(
            result.mcp.servers.find((server) => server.name === "mixed").valid,
            false,
        );
        for (const code of [
            "MCP_COMMAND_INVALID",
            "MCP_SERVER_FIELD_INVALID",
            "MCP_CWD_INVALID",
            "MCP_ENV_RESERVED",
            "MCP_PLACEHOLDER_INVALID",
            "MCP_URL_INVALID",
            "MCP_HEADER_DUPLICATE_CASE_INSENSITIVE",
            "MCP_HEADER_LITERAL_INVALID",
            "MCP_SECRET_LITERAL_FORBIDDEN",
        ])
            assertCode(result, code);
        writeFileSync(path, "{broken\n");
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "MCP_JSON_INVALID");
        assert.equal(result.loadable, true);
        writeJson(path, {
            $schema: "https://agent-plugins.org/schemas/1.1.0/mcp.schema.json",
            mcpServers: {},
        });
        result = validateAgentPluginArtifact(plugin);
        assertCode(result, "MCP_TOP_LEVEL_INVALID");
    });
});

test("passive mode forbids executable categories files extension content and unsafe payload", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root);
        mkdirSync(join(plugin, "skills/example-skill/scripts"));
        const script = join(plugin, "skills/example-skill/scripts/run.sh");
        writeFileSync(script, "#!/bin/sh\nexit 0\n");
        chmodSync(script, 0o755);
        mkdirSync(join(plugin, "evals"));
        writeFileSync(join(plugin, "evals/case.json"), "{}\n");
        mkdirSync(join(plugin, "hooks"));
        writeFileSync(join(plugin, "hooks/lifecycle.json"), "{}\n");
        const manifestPath = join(plugin, "plugin.json");
        const manifest = readJson(manifestPath);
        manifest.extensions = { "com.cratis.fixture": {} };
        writeJson(manifestPath, manifest);
        writeFileSync(
            join(plugin, "skills/example-skill/assets/secret.txt"),
            "token=abcdefghijklmnopqrstuvwxyz123456\napi_key=sk_live_abcdefghijklmnopqrstuvwxyz123456\nAuthorization: Basic dXNlcjpwYXNzd29yZA==\n",
        );
        writeFileSync(
            join(plugin, "skills/example-skill/assets/run.rb"),
            'system("touch /tmp/pwned")\n',
        );
        const result = validatePassive(plugin);
        for (const code of [
            "PASSIVE_EXECUTABLE_CATEGORY_FORBIDDEN",
            "PASSIVE_EXECUTABLE_FILE_FORBIDDEN",
            "PASSIVE_EXECUTABLE_CONTENT_FORBIDDEN",
            "PASSIVE_FILE_TYPE_FORBIDDEN",
            "PASSIVE_PAYLOAD_PATH_FORBIDDEN",
            "PASSIVE_EXTENSION_CONTENT_FORBIDDEN",
            "PASSIVE_CONTENT_SAFETY_INVALID",
        ])
            assertCode(result, code);
        assert.equal(result.releaseBlocking, true);
    });
});

test("passive mode rejects symlinks special files and realpath escapes without execution", () => {
    withTemporaryDirectory((root) => {
        const plugin = copyFixture(root);
        const outside = join(root, "outside.txt");
        const marker = join(root, "executed.marker");
        writeFileSync(outside, `touch ${marker}\n`);
        symlinkSync(
            outside,
            join(plugin, "skills/example-skill/assets/link.txt"),
        );
        symlinkSync(
            join(plugin, "skills/example-skill/references/guide.md"),
            join(plugin, "skills/example-skill/assets/internal-link.md"),
        );
        const fifo = join(plugin, "skills/example-skill/assets/special.fifo");
        execFileSync("mkfifo", [fifo]);
        const universal = validateAgentPluginArtifact(plugin);
        assertCode(universal, "AP_PACKAGE_PATH_ESCAPE");
        assertCode(universal, "AP_PACKAGE_SYMLINK_FORBIDDEN");
        assertCode(universal, "AP_PACKAGE_SPECIAL_FILE_FORBIDDEN");
        assert.equal(
            universal.receipt.files.some((file) => file.path.endsWith("link.txt")),
            false,
        );

        const result = validatePassive(plugin);
        assertCode(result, "PASSIVE_SYMLINK_FORBIDDEN");
        assertCode(result, "PASSIVE_SPECIAL_FILE_FORBIDDEN");
        assert.equal(existsSync(marker), false);

        const escapedPlugin = join(root, "escaped-plugin");
        mkdirSync(escapedPlugin);
        symlinkSync(
            join(plugin, "plugin.json"),
            join(escapedPlugin, "plugin.json"),
        );
        const escaped = validateAgentPluginArtifact(escapedPlugin);
        assertCode(escaped, "AP_MANIFEST_PATH_ESCAPE");
        assert.equal(escaped.loadable, false);
    });
});

test("diagnostics and receipts are ordinal deterministic and never grant release claims", () => {
    const result = validateAgentPluginArtifact(
        join(fixtureRoot, "sibling-isolation"),
    );
    const formatted = formatComplianceDiagnostics(result.diagnostics);
    assert.match(formatted, /^ERROR SKILL_NAME_DIRECTORY_MISMATCH /);
    assert.equal(result.receipt.executionPerformed, false);
    assert.equal(result.receipt.networkAccessPerformed, false);
    assert.equal(result.receipt.approvalGranted, false);
    assert.equal(result.receipt.supportGranted, false);
    assert.equal(result.receipt.publicationGranted, false);
    assert.match(result.receipt.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(
        validateAgentPluginArtifact(join(fixtureRoot, "sibling-isolation"))
            .receipt,
        result.receipt,
    );
});
