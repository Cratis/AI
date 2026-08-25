#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from "node:fs";
import { isIP } from "node:net";
import {
    basename,
    dirname,
    isAbsolute,
    join,
    relative,
    resolve,
    sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    assertSafeContent,
    validatePayloadPath,
} from "./public-artifact-materializer.mjs";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = resolve(moduleDirectory, "..");
const pluginSchemaUrl =
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchemaUrl = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const passiveProfile = "cratis-passive-v1";
const pluginFields = new Set([
    "$schema",
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "extensions",
]);
const skillFields = new Set([
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
]);
const extensionNamespacePattern =
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const passiveStaticExtensions = new Set([
    ".css",
    ".csv",
    ".html",
    ".json",
    ".jsonc",
    ".md",
    ".mdx",
    ".svg",
    ".toml",
    ".tsv",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
]);
const pluginNamePattern = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const exactSemVerPattern =
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const secretLiteralPatterns = [
    /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bnpm_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[^\s"']{12,}/i,
    /\b(?:api[_-]?key|access[_-]?key|client[_-]?secret|password|private[_-]?token|secret|token)\s*[:=]\s*["']?[^\s"']{12,}/i,
    /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];
const expectedSpecificationSources = Object.freeze([
    {
        role: "plugin-schema",
        url: pluginSchemaUrl,
        localPath:
            "tooling/specifications/agent-plugins/1.0.0/plugin.schema.json",
        sha256: "0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883",
    },
    {
        role: "mcp-schema",
        url: mcpSchemaUrl,
        localPath: "tooling/specifications/agent-plugins/1.0.0/mcp.schema.json",
        sha256: "6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb",
    },
    {
        role: "normative-specification",
        url: "https://raw.githubusercontent.com/agentplugins/agent-plugins-spec/main/spec/1.0.0.md",
        localPath:
            "tooling/specifications/agent-plugins/1.0.0/specification.snapshot",
        sha256: "97a658b7dca3ce1b4c2266b95da300fa51d9dc4ade59d73168e5f9104272da18",
    },
]);
const expectedAgentSkillsSource = Object.freeze({
    url: "https://agentskills.io/specification.md",
    localPath:
        "tooling/specifications/agent-skills/current/specification.snapshot",
    sha256: "2b1dbb4fd80c31748d15812c4ebd3e66c09383d0c792801f617718684489e40d",
});

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function diagnostic(
    code,
    path,
    message,
    { severity = "error", fatal = false, releaseBlocking = true } = {},
) {
    return { code, severity, path, message, fatal, releaseBlocking };
}

function sortDiagnostics(diagnostics) {
    return [...diagnostics].sort((left, right) =>
        compareOrdinal(
            `${left.code}\0${left.path}\0${left.message}`,
            `${right.code}\0${right.path}\0${right.message}`,
        ),
    );
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsSecretLiteral(value) {
    return secretLiteralPatterns.some((pattern) => pattern.test(value));
}

function containsUnsupportedPlaceholder(value) {
    return [...String(value).matchAll(/\$\{([^}]+)\}/gu)].some(
        ([, name]) => !["PLUGIN_ROOT", "PLUGIN_DATA"].includes(name),
    );
}

function strictJsonParse(text) {
    let index = 0;
    const fail = (message, code) => {
        const error = new Error(`${message} at character ${index}`);
        if (code) error.code = code;
        throw error;
    };
    const skipWhitespace = () => {
        while ([" ", "\t", "\n", "\r"].includes(text[index])) index++;
    };
    const validateUnicodeScalars = (value) => {
        for (let offset = 0; offset < value.length; offset++) {
            const unit = value.charCodeAt(offset);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                const next = value.charCodeAt(offset + 1);
                if (!(next >= 0xdc00 && next <= 0xdfff))
                    fail("JSON string contains an unpaired high surrogate");
                offset++;
            } else if (unit >= 0xdc00 && unit <= 0xdfff) {
                fail("JSON string contains an unpaired low surrogate");
            }
        }
    };
    const parseString = () => {
        if (text[index] !== '"') fail("Expected JSON string");
        const start = index++;
        while (index < text.length) {
            const character = text[index++];
            if (character === '"') {
                const value = JSON.parse(text.slice(start, index));
                validateUnicodeScalars(value);
                return value;
            }
            if (character === "\\") {
                if (index >= text.length) fail("Trailing JSON escape");
                const escape = text[index++];
                if (escape === "u") {
                    const hexadecimal = text.slice(index, index + 4);
                    if (!/^[0-9a-fA-F]{4}$/u.test(hexadecimal))
                        fail("Invalid JSON Unicode escape");
                    index += 4;
                } else if (!'"\\/bfnrt'.includes(escape)) {
                    fail(`Invalid JSON escape \\${escape}`);
                }
            } else if (character.charCodeAt(0) < 0x20) {
                fail("JSON string contains a control character");
            }
        }
        fail("Unterminated JSON string");
    };
    const parseValue = () => {
        skipWhitespace();
        const character = text[index];
        if (character === '"') return parseString();
        if (character === "{") {
            index++;
            const value = Object.create(null);
            const keys = new Set();
            skipWhitespace();
            if (text[index] === "}") {
                index++;
                return value;
            }
            while (index < text.length) {
                skipWhitespace();
                const key = parseString();
                if (keys.has(key))
                    fail(`Duplicate JSON object key ${JSON.stringify(key)}`, "JSON_DUPLICATE_KEY");
                keys.add(key);
                skipWhitespace();
                if (text[index++] !== ":") fail("Expected colon after JSON object key");
                value[key] = parseValue();
                skipWhitespace();
                const delimiter = text[index++];
                if (delimiter === "}") return value;
                if (delimiter !== ",") fail("Expected comma or closing brace");
            }
            fail("Unterminated JSON object");
        }
        if (character === "[") {
            index++;
            const value = [];
            skipWhitespace();
            if (text[index] === "]") {
                index++;
                return value;
            }
            while (index < text.length) {
                value.push(parseValue());
                skipWhitespace();
                const delimiter = text[index++];
                if (delimiter === "]") return value;
                if (delimiter !== ",") fail("Expected comma or closing bracket");
            }
            fail("Unterminated JSON array");
        }
        for (const [literal, value] of [
            ["true", true],
            ["false", false],
            ["null", null],
        ]) {
            if (text.startsWith(literal, index)) {
                index += literal.length;
                return value;
            }
        }
        const number = text
            .slice(index)
            .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u)?.[0];
        if (number) {
            index += number.length;
            return Number(number);
        }
        fail("Invalid JSON value");
    };
    const value = parseValue();
    skipWhitespace();
    if (index !== text.length) fail("Unexpected trailing JSON content");
    return value;
}

function readJson(path, code, diagnostics, options = {}) {
    let content;
    try {
        content = readFileSync(path);
    } catch (error) {
        diagnostics.push(
            diagnostic(code, path, `Unable to read JSON: ${error.message}`, {
                ...options,
                fatal: options.fatal ?? true,
            }),
        );
        return {};
    }
    if (!isUtf8(content)) {
        diagnostics.push(
            diagnostic(
                "JSON_ENCODING_INVALID",
                path,
                "JSON input must be valid UTF-8.",
                { ...options, fatal: options.fatal ?? true },
            ),
        );
        return { content };
    }
    try {
        return { content, value: strictJsonParse(content.toString("utf8")) };
    } catch (error) {
        diagnostics.push(
            diagnostic(
                error.code ?? code,
                path,
                `Malformed JSON: ${error.message}`,
                { ...options, fatal: options.fatal ?? true },
            ),
        );
        return { content };
    }
}

function isContained(root, candidate) {
    const difference = relative(root, candidate);
    return (
        difference === "" ||
        (!difference.startsWith(`..${sep}`) &&
            difference !== ".." &&
            !isAbsolute(difference))
    );
}

function resolvedContained(root, path) {
    const resolvedRoot = realpathSync(root);
    const resolvedPath = realpathSync(path);
    return isContained(resolvedRoot, resolvedPath);
}

function fileDigestRecord(root, path) {
    const content = readFileSync(join(root, path));
    return { path, size: content.length, sha256: sha256(content) };
}

export function validateSpecificationLock({
    repositoryRoot = defaultRepositoryRoot,
} = {}) {
    const diagnostics = [];
    const lockPath = join(
        repositoryRoot,
        "tooling/specifications/agent-plugins/1.0.0/specification-lock.json",
    );
    const lockRead = readJson(lockPath, "SPEC_LOCK_MALFORMED", diagnostics, {
        fatal: true,
    });
    const lock = lockRead.value;
    if (lock !== undefined) {
        if (
            !isObject(lock) ||
            lock.schemaVersion !== "1.0.0" ||
            lock.version !== "1.0.0" ||
            lock.status !== "published" ||
            lock.verifiedOn !== lock.retrievedOn ||
            lock.runtimeNetworkAllowed !== false ||
            !Array.isArray(lock.sources)
        ) {
            diagnostics.push(
                diagnostic(
                    "SPEC_LOCK_CONTRACT_INVALID",
                    lockPath,
                    "The Agent Plugins lock must bind published 1.0.0 and forbid runtime network access.",
                    { fatal: true },
                ),
            );
        } else {
            for (const expected of expectedSpecificationSources) {
                const source = lock.sources.find(
                    (candidate) => candidate.role === expected.role,
                );
                if (
                    !source ||
                    source.url !== expected.url ||
                    source.version !== "1.0.0" ||
                    source.status !== "published" ||
                    source.localPath !== expected.localPath ||
                    source.sha256 !== expected.sha256 ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(source.retrievedOn) ||
                    source.verifiedOn !== source.retrievedOn
                ) {
                    diagnostics.push(
                        diagnostic(
                            "SPEC_LOCK_SOURCE_INVALID",
                            lockPath,
                            `Locked ${expected.role} authority differs from the approved 1.0.0 source.`,
                            { fatal: true },
                        ),
                    );
                    continue;
                }
                const localPath = join(repositoryRoot, source.localPath);
                try {
                    if (sha256(readFileSync(localPath)) !== source.sha256)
                        diagnostics.push(
                            diagnostic(
                                "SPEC_LOCK_DIGEST_MISMATCH",
                                source.localPath,
                                `Locked ${source.role} bytes do not match SHA-256 ${source.sha256}.`,
                                { fatal: true },
                            ),
                        );
                } catch (error) {
                    diagnostics.push(
                        diagnostic(
                            "SPEC_LOCK_FILE_MISSING",
                            source.localPath,
                            `Locked ${source.role} bytes are unavailable: ${error.message}`,
                            { fatal: true },
                        ),
                    );
                }
            }
            if (lock.sources.length !== expectedSpecificationSources.length)
                diagnostics.push(
                    diagnostic(
                        "SPEC_LOCK_SOURCE_SET_INVALID",
                        lockPath,
                        "The Agent Plugins lock source set is not closed.",
                        { fatal: true },
                    ),
                );
        }
    }

    const contractPath = join(
        repositoryRoot,
        "tooling/specifications/agent-skills/current/contract.json",
    );
    const contractRead = readJson(
        contractPath,
        "SKILL_CONTRACT_MALFORMED",
        diagnostics,
        { fatal: true },
    );
    const contract = contractRead.value;
    if (
        contract !== undefined &&
        (!isObject(contract) ||
            contract.schemaVersion !== "1.0.0" ||
            contract.id !== "agent-skills-current" ||
            contract.status !== "current-unversioned-specification" ||
            contract.source?.url !== expectedAgentSkillsSource.url ||
            contract.source?.localPath !==
                expectedAgentSkillsSource.localPath ||
            contract.source?.sha256 !== expectedAgentSkillsSource.sha256 ||
            contract.source?.verifiedOn !== contract.source?.retrievedOn ||
            contract.frontmatter?.unknownFieldsAllowed !== false ||
            contract.frontmatter?.fields?.["allowed-tools"]?.universalMode !==
                "accepted" ||
            contract.frontmatter?.fields?.["allowed-tools"]
                ?.cratisPassiveMode !== "forbidden")
    )
        diagnostics.push(
            diagnostic(
                "SKILL_CONTRACT_INVALID",
                contractPath,
                "The source-owned Agent Skills contract differs from its approved closed contract.",
                { fatal: true },
            ),
        );
    if (contract?.source) {
        try {
            const content = readFileSync(
                join(repositoryRoot, contract.source.localPath),
            );
            if (sha256(content) !== contract.source.sha256)
                diagnostics.push(
                    diagnostic(
                        "SKILL_CONTRACT_DIGEST_MISMATCH",
                        contract.source.localPath,
                        `Agent Skills source bytes do not match SHA-256 ${contract.source.sha256}.`,
                        { fatal: true },
                    ),
                );
        } catch (error) {
            diagnostics.push(
                diagnostic(
                    "SKILL_CONTRACT_SOURCE_MISSING",
                    contract.source.localPath,
                    `Agent Skills source snapshot is unavailable: ${error.message}`,
                    { fatal: true },
                ),
            );
        }
    }
    return sortDiagnostics(diagnostics);
}

function yamlDoubleQuoted(value) {
    let result = "";
    for (let index = 1; index < value.length - 1; index++) {
        const character = value[index];
        if (character !== "\\") {
            if (character === '"')
                throw new Error("unescaped quote in double-quoted scalar");
            result += character;
            continue;
        }
        index++;
        if (index >= value.length - 1) throw new Error("trailing escape");
        const escape = value[index];
        const simple = {
            0: "\0",
            a: "\x07",
            b: "\b",
            t: "\t",
            n: "\n",
            v: "\v",
            f: "\f",
            r: "\r",
            e: "\x1b",
            " ": " ",
            '"': '"',
            "/": "/",
            "\\": "\\",
            N: "\u0085",
            _: "\u00a0",
            L: "\u2028",
            P: "\u2029",
        };
        if (Object.hasOwn(simple, escape)) {
            result += simple[escape];
            continue;
        }
        const lengths = { x: 2, u: 4, U: 8 };
        const length = lengths[escape];
        if (!length) throw new Error(`unsupported escape \\${escape}`);
        const hexadecimal = value.slice(index + 1, index + 1 + length);
        if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hexadecimal))
            throw new Error("invalid Unicode escape");
        const codePoint = Number.parseInt(hexadecimal, 16);
        if (
            codePoint > 0x10ffff ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff)
        )
            throw new Error("Unicode escape is not a scalar value");
        result += String.fromCodePoint(codePoint);
        index += length;
    }
    return result;
}

function parseScalar(value) {
    if (value.startsWith("'")) {
        if (!value.endsWith("'") || value.length < 2)
            throw new Error("unclosed single-quoted scalar");
        let result = "";
        for (let index = 1; index < value.length - 1; index++) {
            if (value[index] !== "'") {
                result += value[index];
                continue;
            }
            if (value[index + 1] !== "'")
                throw new Error("single quote must be doubled");
            result += "'";
            index++;
        }
        return result;
    }
    if (value.startsWith('"')) {
        if (!value.endsWith('"') || value.length < 2)
            throw new Error("unclosed double-quoted scalar");
        return yamlDoubleQuoted(value);
    }
    if (/^[&*!|>{}[\],%@`]/.test(value) || /^[-?:](?:\s|$)/.test(value))
        throw new Error("unsupported YAML scalar feature");
    if (/(?:^|\s)#/.test(value) || /:\s/.test(value))
        throw new Error(
            "plain scalars containing YAML comments or mappings must be quoted",
        );
    if (
        /^(?:~|null|true|false|[-+]?(?:0x[0-9a-f_]+|0o[0-7_]+|0b[01_]+|(?:[0-9][0-9_]*(?:\.[0-9_]*)?|\.[0-9_]+)(?:e[-+]?[0-9]+)?|\.inf|\.nan)|[0-9]{4}-[0-9]{2}-[0-9]{2}(?:[Tt ].*)?)$/i.test(
            value,
        )
    )
        throw new Error("non-string YAML scalar must be quoted");
    return value;
}

function splitMappingLine(line) {
    let quote = null;
    for (let index = 0; index < line.length; index++) {
        const character = line[index];
        if (quote === "'") {
            if (character === "'" && line[index + 1] === "'") index++;
            else if (character === "'") quote = null;
            continue;
        }
        if (quote === '"') {
            if (character === "\\") index++;
            else if (character === '"') quote = null;
            continue;
        }
        if (character === "'" || character === '"') {
            quote = character;
            continue;
        }
        if (
            character === ":" &&
            (index === line.length - 1 ||
                [" ", "\t"].includes(line[index + 1]))
        )
            return [line.slice(0, index).trim(), line.slice(index + 1).trimStart()];
    }
    throw new Error("mapping entry has no colon");
}

function blockScalar(lines, start, parentIndent, indicator) {
    let end = start;
    while (end < lines.length) {
        const line = lines[end];
        if (line.trim() && line.match(/^ */)[0].length <= parentIndent) break;
        end++;
    }
    const source = lines.slice(start, end);
    const nonEmpty = source.filter((line) => line.trim());
    const indent = nonEmpty.length
        ? Math.min(...nonEmpty.map((line) => line.match(/^ */)[0].length))
        : parentIndent + 1;
    if (indent <= parentIndent)
        throw new Error("block scalar indentation is invalid");
    if (
        source.some(
            (line) =>
                line.trim() && line.match(/^ */u)[0].length !== indent,
        )
    )
        throw new Error(
            "bounded block scalars require uniform indentation",
        );
    const values = source.map((line) =>
        line.trim() ? line.slice(indent) : "",
    );
    let value;
    if (indicator[0] === "|") value = values.join("\n");
    else {
        value = "";
        for (let index = 0; index < values.length; index++) {
            value += values[index];
            if (index === values.length - 1) continue;
            value +=
                values[index] === "" || values[index + 1] === "" ? "\n" : " ";
        }
    }
    if (source.length > 0) value += "\n";
    const chomping = indicator[1] ?? "";
    if (chomping === "-") value = value.replace(/\n+$/u, "");
    else if (chomping === "") value = `${value.replace(/\n+$/u, "")}\n`;
    return { value, next: end };
}

function parseFrontmatterLines(lines, diagnostics, path) {
    const frontmatter = {};
    const keys = new Set();
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim() || line.trimStart().startsWith("#")) {
            index++;
            continue;
        }
        if (line.includes("\t") || line.startsWith(" ")) {
            diagnostics.push(
                diagnostic(
                    "SKILL_YAML_STRUCTURE_UNSUPPORTED",
                    path,
                    `Unsupported top-level YAML indentation at frontmatter line ${index + 2}.`,
                    { fatal: true },
                ),
            );
            index++;
            continue;
        }
        let key;
        let rawValue;
        try {
            [key, rawValue] = splitMappingLine(line);
        } catch (error) {
            diagnostics.push(
                diagnostic(
                    "SKILL_YAML_STRUCTURE_UNSUPPORTED",
                    path,
                    `${error.message} at frontmatter line ${index + 2}.`,
                    { fatal: true },
                ),
            );
            index++;
            continue;
        }
        if (!/^[a-z][a-z-]*$/.test(key) || !skillFields.has(key)) {
            diagnostics.push(
                diagnostic(
                    "SKILL_FRONTMATTER_UNKNOWN_FIELD",
                    path,
                    `Unknown or unsupported frontmatter field ${key}.`,
                    { fatal: true },
                ),
            );
        }
        if (keys.has(key)) {
            diagnostics.push(
                diagnostic(
                    "SKILL_FRONTMATTER_DUPLICATE_KEY",
                    path,
                    `Duplicate frontmatter key ${key}.`,
                    { fatal: true },
                ),
            );
            index++;
            continue;
        }
        keys.add(key);
        if (key === "metadata") {
            if (rawValue !== "") {
                diagnostics.push(
                    diagnostic(
                        "SKILL_METADATA_WRONG_TYPE",
                        path,
                        "metadata must be an indented string-to-string map.",
                        { fatal: true },
                    ),
                );
                frontmatter[key] = rawValue;
                index++;
                continue;
            }
            const metadata = {};
            const metadataKeys = new Set();
            index++;
            let count = 0;
            while (index < lines.length) {
                const metadataLine = lines[index];
                if (
                    !metadataLine.trim() ||
                    metadataLine.trimStart().startsWith("#")
                ) {
                    index++;
                    continue;
                }
                const indentation = metadataLine.match(/^ */)[0].length;
                if (indentation === 0) break;
                if (indentation !== 2 || metadataLine.includes("\t")) {
                    diagnostics.push(
                        diagnostic(
                            "SKILL_YAML_STRUCTURE_UNSUPPORTED",
                            path,
                            `metadata must use exactly two-space indentation at frontmatter line ${index + 2}.`,
                            { fatal: true },
                        ),
                    );
                    index++;
                    continue;
                }
                try {
                    const [rawMetadataKey, metadataValue] = splitMappingLine(
                        metadataLine.slice(2),
                    );
                    const metadataKey = parseScalar(rawMetadataKey);
                    if (metadataKeys.has(metadataKey))
                        diagnostics.push(
                            diagnostic(
                                "SKILL_METADATA_DUPLICATE_KEY",
                                path,
                                `Duplicate metadata key ${metadataKey}.`,
                                { fatal: true },
                            ),
                        );
                    else metadataKeys.add(metadataKey);
                    if (
                        metadataValue === "" ||
                        /^[|>][+-]?$/.test(metadataValue)
                    )
                        throw new Error(
                            "metadata values must be one-line strings",
                        );
                    Object.defineProperty(metadata, metadataKey, {
                        value: parseScalar(metadataValue),
                        enumerable: true,
                        configurable: true,
                        writable: true,
                    });
                    count++;
                } catch (error) {
                    diagnostics.push(
                        diagnostic(
                            "SKILL_METADATA_WRONG_TYPE",
                            path,
                            `${error.message} at frontmatter line ${index + 2}.`,
                            { fatal: true },
                        ),
                    );
                }
                index++;
            }
            if (count === 0)
                diagnostics.push(
                    diagnostic(
                        "SKILL_METADATA_WRONG_TYPE",
                        path,
                        "metadata must contain at least one string entry.",
                        { fatal: true },
                    ),
                );
            frontmatter[key] = metadata;
            continue;
        }
        if (/^[|>][+-]?$/.test(rawValue)) {
            try {
                const parsed = blockScalar(lines, index + 1, 0, rawValue);
                frontmatter[key] = parsed.value;
                index = parsed.next;
            } catch (error) {
                diagnostics.push(
                    diagnostic(
                        "SKILL_YAML_SCALAR_INVALID",
                        path,
                        `${key}: ${error.message}.`,
                        { fatal: true },
                    ),
                );
                index++;
            }
            continue;
        }
        if (rawValue === "") {
            diagnostics.push(
                diagnostic(
                    "SKILL_FRONTMATTER_WRONG_TYPE",
                    path,
                    `${key} must be a scalar string.`,
                    { fatal: true },
                ),
            );
            frontmatter[key] = undefined;
            index++;
            continue;
        }
        try {
            frontmatter[key] = parseScalar(rawValue);
        } catch (error) {
            diagnostics.push(
                diagnostic(
                    "SKILL_YAML_SCALAR_INVALID",
                    path,
                    `${key}: ${error.message}.`,
                    { fatal: true },
                ),
            );
        }
        index++;
    }
    return frontmatter;
}

export function parseAgentSkillFrontmatter(
    content,
    { path = "SKILL.md" } = {},
) {
    const sourceBytes = Buffer.isBuffer(content)
        ? Buffer.from(content)
        : Buffer.from(String(content), "utf8");
    const diagnostics = [];
    if (!isUtf8(sourceBytes) || sourceBytes.includes(0)) {
        diagnostics.push(
            diagnostic(
                "SKILL_SOURCE_ENCODING_INVALID",
                path,
                "SKILL.md must be UTF-8 text without NUL bytes.",
                { fatal: true },
            ),
        );
        return { sourceBytes, frontmatter: {}, body: "", diagnostics };
    }
    const text = sourceBytes.toString("utf8");
    if (text.startsWith("\ufeff"))
        diagnostics.push(
            diagnostic(
                "SKILL_FRONTMATTER_DELIMITER_INVALID",
                path,
                "SKILL.md must begin directly with the --- frontmatter delimiter.",
                { fatal: true },
            ),
        );
    const normalized = text.replaceAll("\r\n", "\n");
    if (normalized.includes("\r"))
        diagnostics.push(
            diagnostic(
                "SKILL_LINE_ENDING_INVALID",
                path,
                "SKILL.md may use only LF or CRLF line endings.",
                { fatal: true },
            ),
        );
    const lines = normalized.split("\n");
    if (lines[0] !== "---") {
        diagnostics.push(
            diagnostic(
                "SKILL_FRONTMATTER_DELIMITER_INVALID",
                path,
                "SKILL.md is missing its opening --- delimiter.",
                { fatal: true },
            ),
        );
        return { sourceBytes, frontmatter: {}, body: normalized, diagnostics };
    }
    const closing = lines.indexOf("---", 1);
    if (closing < 0) {
        diagnostics.push(
            diagnostic(
                "SKILL_FRONTMATTER_UNCLOSED",
                path,
                "SKILL.md is missing its closing --- delimiter.",
                { fatal: true },
            ),
        );
        return { sourceBytes, frontmatter: {}, body: "", diagnostics };
    }
    const frontmatter = parseFrontmatterLines(
        lines.slice(1, closing),
        diagnostics,
        path,
    );
    return {
        sourceBytes,
        frontmatter,
        body: lines.slice(closing + 1).join("\n"),
        diagnostics: sortDiagnostics(diagnostics),
        valid: diagnostics.length === 0,
    };
}

function characters(value) {
    return [...value].length;
}

export function validateAgentSkill(
    skillRoot,
    { mode = "universal", pluginRoot } = {},
) {
    const root = resolve(skillRoot);
    const path = join(root, "SKILL.md");
    const diagnostics = [];
    let parsed = { sourceBytes: Buffer.alloc(0), frontmatter: {}, body: "" };
    try {
        const rootStat = lstatSync(root);
        if (!rootStat.isDirectory() && !rootStat.isSymbolicLink())
            throw new Error("skill root is not a directory");
        const stat = lstatSync(path);
        if (!stat.isFile() && !stat.isSymbolicLink())
            throw new Error("SKILL.md is not a regular file");
        const containmentRoot = pluginRoot ? resolve(pluginRoot) : root;
        if (!resolvedContained(containmentRoot, path)) {
            diagnostics.push(
                diagnostic(
                    "SKILL_PATH_ESCAPE",
                    path,
                    "SKILL.md resolves outside the plugin root.",
                    { fatal: true },
                ),
            );
            return { root, path, diagnostics, valid: false, loadable: false };
        }
        parsed = parseAgentSkillFrontmatter(readFileSync(path), { path });
        diagnostics.push(...parsed.diagnostics);
    } catch (error) {
        diagnostics.push(
            diagnostic(
                "SKILL_FILE_INVALID",
                path,
                `Unable to load a regular contained SKILL.md: ${error.message}`,
                { fatal: true },
            ),
        );
        return { root, path, diagnostics, valid: false, loadable: false };
    }
    const values = parsed.frontmatter;
    for (const field of ["name", "description"])
        if (!Object.hasOwn(values, field) || typeof values[field] !== "string")
            diagnostics.push(
                diagnostic(
                    "SKILL_REQUIRED_FIELD_INVALID",
                    path,
                    `Required string field ${field} is missing or invalid.`,
                    { fatal: true },
                ),
            );
    if (typeof values.name === "string") {
        if (
            characters(values.name) < 1 ||
            characters(values.name) > 64 ||
            !skillNamePattern.test(values.name)
        )
            diagnostics.push(
                diagnostic(
                    "SKILL_NAME_INVALID",
                    path,
                    "name must contain 1-64 lowercase ASCII letters, digits, or single interior hyphens.",
                    { fatal: true },
                ),
            );
        if (values.name !== basename(root))
            diagnostics.push(
                diagnostic(
                    "SKILL_NAME_DIRECTORY_MISMATCH",
                    path,
                    `name ${values.name} does not match parent directory ${basename(root)}.`,
                    { fatal: true },
                ),
            );
    }
    if (
        typeof values.description === "string" &&
        (values.description.trim().length === 0 ||
            characters(values.description) > 1024)
    )
        diagnostics.push(
            diagnostic(
                "SKILL_DESCRIPTION_LENGTH_INVALID",
                path,
                "description must contain 1-1024 characters.",
                { fatal: true },
            ),
        );
    if (Object.hasOwn(values, "license") && typeof values.license !== "string")
        diagnostics.push(
            diagnostic(
                "SKILL_LICENSE_WRONG_TYPE",
                path,
                "license must be a string.",
                { fatal: true },
            ),
        );
    if (Object.hasOwn(values, "compatibility")) {
        if (
            typeof values.compatibility !== "string" ||
            values.compatibility.trim().length === 0 ||
            characters(values.compatibility) > 500
        )
            diagnostics.push(
                diagnostic(
                    "SKILL_COMPATIBILITY_INVALID",
                    path,
                    "compatibility must be a string containing 1-500 characters.",
                    { fatal: true },
                ),
            );
    }
    if (Object.hasOwn(values, "metadata")) {
        if (
            !isObject(values.metadata) ||
            Object.entries(values.metadata).some(
                ([key, value]) =>
                    typeof key !== "string" || typeof value !== "string",
            )
        )
            diagnostics.push(
                diagnostic(
                    "SKILL_METADATA_WRONG_TYPE",
                    path,
                    "metadata must map strings to strings.",
                    { fatal: true },
                ),
            );
    }
    if (
        Object.hasOwn(values, "allowed-tools") &&
        typeof values["allowed-tools"] !== "string"
    )
        diagnostics.push(
            diagnostic(
                "SKILL_ALLOWED_TOOLS_WRONG_TYPE",
                path,
                "allowed-tools must be one space-separated string.",
                { fatal: true },
            ),
        );
    if (mode === passiveProfile && Object.hasOwn(values, "allowed-tools"))
        diagnostics.push(
            diagnostic(
                "PASSIVE_ALLOWED_TOOLS_FORBIDDEN",
                path,
                "The experimental allowed-tools field is forbidden by cratis-passive-v1.",
                { fatal: true },
            ),
        );
    const sorted = sortDiagnostics(diagnostics);
    return {
        root,
        path,
        ...parsed,
        diagnostics: sorted,
        valid: sorted.length === 0,
        loadable: !sorted.some((entry) => entry.fatal),
    };
}

export function validatePluginManifest(
    pluginRoot,
    { mode = "universal" } = {},
) {
    const root = resolve(pluginRoot);
    const manifestPath = join(root, "plugin.json");
    const diagnostics = [];
    try {
        const stat = lstatSync(manifestPath);
        if (!stat.isFile() && !stat.isSymbolicLink())
            throw new Error("plugin.json is not a regular file");
        if (!resolvedContained(root, manifestPath))
            diagnostics.push(
                diagnostic(
                    "AP_MANIFEST_PATH_ESCAPE",
                    manifestPath,
                    "plugin.json resolves outside the plugin root.",
                    { fatal: true },
                ),
            );
    } catch (error) {
        diagnostics.push(
            diagnostic(
                "AP_MANIFEST_MISSING",
                manifestPath,
                `Root plugin.json is required: ${error.message}`,
                { fatal: true },
            ),
        );
        return {
            root,
            manifestPath,
            diagnostics: sortDiagnostics(diagnostics),
            loadable: false,
            conformant: false,
        };
    }
    const manifestRead = readJson(
        manifestPath,
        "AP_MANIFEST_JSON_INVALID",
        diagnostics,
        { fatal: true },
    );
    const manifest = manifestRead.value;
    if (manifest === undefined)
        return {
            root,
            manifestPath,
            diagnostics: sortDiagnostics(diagnostics),
            loadable: false,
            conformant: false,
        };
    if (isObject(manifest)) {
        for (const key of Object.keys(manifest))
            if (!pluginFields.has(key))
                diagnostics.push(
                    diagnostic(
                        "AP_MANIFEST_UNKNOWN_FIELD",
                        `${manifestPath}#/${key}`,
                        `Unknown top-level field ${key} is ignored in universal mode.`,
                        {
                            severity: "warning",
                            fatal: false,
                            releaseBlocking: mode === passiveProfile,
                        },
                    ),
                );
        if (manifest.$schema !== pluginSchemaUrl)
            diagnostics.push(
                diagnostic(
                    "AP_MANIFEST_SCHEMA_INVALID",
                    `${manifestPath}#/$schema`,
                    `Required $schema must equal ${pluginSchemaUrl}.`,
                    { fatal: true },
                ),
            );
        if (
            typeof manifest.name !== "string" ||
            characters(manifest.name) < 1 ||
            characters(manifest.name) > 64 ||
            !pluginNamePattern.test(manifest.name)
        )
            diagnostics.push(
                diagnostic(
                    "AP_MANIFEST_NAME_INVALID",
                    `${manifestPath}#/name`,
                    "Required name violates the Agent Plugins 1.0.0 name contract.",
                    { fatal: true },
                ),
            );
        for (const key of [
            "version",
            "description",
            "homepage",
            "repository",
            "license",
        ])
            if (
                Object.hasOwn(manifest, key) &&
                typeof manifest[key] !== "string"
            )
                diagnostics.push(
                    diagnostic(
                        "AP_MANIFEST_FIELD_TYPE_INVALID",
                        `${manifestPath}#/${key}`,
                        `${key} must be a string.`,
                        { fatal: true },
                    ),
                );
        if (Object.hasOwn(manifest, "keywords")) {
            if (
                !Array.isArray(manifest.keywords) ||
                manifest.keywords.some((value) => typeof value !== "string")
            )
                diagnostics.push(
                    diagnostic(
                        "AP_MANIFEST_KEYWORDS_INVALID",
                        `${manifestPath}#/keywords`,
                        "keywords must be an array of strings.",
                        { fatal: true },
                    ),
                );
        }
        if (Object.hasOwn(manifest, "author")) {
            if (isObject(manifest.author)) {
                for (const [key, value] of Object.entries(manifest.author)) {
                    if (
                        !["name", "email", "url"].includes(key) ||
                        typeof value !== "string"
                    )
                        diagnostics.push(
                            diagnostic(
                                "AP_MANIFEST_AUTHOR_INVALID",
                                `${manifestPath}#/author/${key}`,
                                "author is closed to string name, email, and url fields.",
                                { fatal: true },
                            ),
                        );
                }
            } else {
                diagnostics.push(
                    diagnostic(
                        "AP_MANIFEST_AUTHOR_INVALID",
                        `${manifestPath}#/author`,
                        "author must be an object.",
                        { fatal: true },
                    ),
                );
            }
        }
        if (Object.hasOwn(manifest, "extensions")) {
            if (isObject(manifest.extensions)) {
                for (const [namespace, value] of Object.entries(
                    manifest.extensions,
                )) {
                    if (!extensionNamespacePattern.test(namespace))
                        diagnostics.push(
                            diagnostic(
                                "AP_EXTENSION_NAMESPACE_INVALID",
                                `${manifestPath}#/extensions/${namespace}`,
                                `${namespace} is not a reverse-domain extension namespace.`,
                                { fatal: true },
                            ),
                        );
                    if (!isObject(value))
                        diagnostics.push(
                            diagnostic(
                                "AP_EXTENSION_VALUE_INVALID",
                                `${manifestPath}#/extensions/${namespace}`,
                                "An extension namespace value must be an object.",
                                { fatal: true },
                            ),
                        );
                }
            } else {
                diagnostics.push(
                    diagnostic(
                        "AP_EXTENSIONS_NON_OBJECT_IGNORED",
                        `${manifestPath}#/extensions`,
                        "Non-object extensions is reported and ignored.",
                        {
                            severity: "warning",
                            fatal: false,
                            releaseBlocking: mode === passiveProfile,
                        },
                    ),
                );
            }
        }
    } else {
        diagnostics.push(
            diagnostic(
                "AP_MANIFEST_TOP_LEVEL_INVALID",
                manifestPath,
                "plugin.json must contain a top-level object.",
                { fatal: true },
            ),
        );
    }
    const sorted = sortDiagnostics(diagnostics);
    return {
        root,
        manifestPath,
        manifest,
        manifestBytes: manifestRead.content,
        diagnostics: sorted,
        loadable: !sorted.some((entry) => entry.fatal),
        conformant: sorted.length === 0,
    };
}

function validateHeaderMap(headers, path, diagnostics) {
    if (!isObject(headers)) {
        diagnostics.push(
            diagnostic(
                "MCP_HEADERS_INVALID",
                path,
                "headers must be an object of literal HTTP strings.",
                { fatal: true },
            ),
        );
        return;
    }
    const names = new Set();
    for (const [name, value] of Object.entries(headers)) {
        const normalized = name.toLowerCase();
        if (names.has(normalized))
            diagnostics.push(
                diagnostic(
                    "MCP_HEADER_DUPLICATE_CASE_INSENSITIVE",
                    `${path}/${name}`,
                    `Header ${name} duplicates a case-insensitive name.`,
                    { fatal: true },
                ),
            );
        names.add(normalized);
        if (
            !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
            typeof value !== "string" ||
            /[\u0000-\u0008\u000a-\u001f\u007f]/u.test(value) ||
            /\$\{[^}]+\}/.test(name) ||
            /\$\{[^}]+\}/.test(value)
        )
            diagnostics.push(
                diagnostic(
                    "MCP_HEADER_LITERAL_INVALID",
                    `${path}/${name}`,
                    "Header names and values must be valid literal HTTP fields without placeholders.",
                    { fatal: true },
                ),
            );
        if (
            typeof value === "string" &&
            containsSecretLiteral(`${name}: ${value}`)
        )
            diagnostics.push(
                diagnostic(
                    "MCP_SECRET_LITERAL_FORBIDDEN",
                    `${path}/${name}`,
                    "MCP headers must not embed credential or secret literals.",
                    { fatal: true },
                ),
            );
    }
}

function isLoopbackHostname(hostname) {
    const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (normalized === "localhost") return true;
    const kind = isIP(normalized);
    if (kind === 4) return normalized.split(".")[0] === "127";
    return kind === 6 && normalized === "::1";
}

function validateRemoteServer(server, path, diagnostics) {
    const allowed = new Set(["type", "url", "headers"]);
    for (const key of Object.keys(server))
        if (!allowed.has(key))
            diagnostics.push(
                diagnostic(
                    "MCP_SERVER_FIELD_INVALID",
                    `${path}/${key}`,
                    `Field ${key} is not allowed for ${server.type}.`,
                    { fatal: true },
                ),
            );
    if (typeof server.url !== "string" || server.url.length === 0) {
        diagnostics.push(
            diagnostic(
                "MCP_URL_INVALID",
                `${path}/url`,
                "Remote MCP url must be a non-empty absolute HTTP(S) URL.",
                { fatal: true },
            ),
        );
    } else {
        try {
            const url = new URL(server.url);
            if (
                !["http:", "https:"].includes(url.protocol) ||
                url.username ||
                url.password ||
                url.hash ||
                /\$\{[^}]+\}/.test(server.url) ||
                (url.protocol !== "https:" && !isLoopbackHostname(url.hostname))
            )
                throw new Error("URL violates transport security rules");
        } catch (error) {
            diagnostics.push(
                diagnostic(
                    "MCP_URL_INVALID",
                    `${path}/url`,
                    `Remote MCP url is invalid: ${error.message}`,
                    { fatal: true },
                ),
            );
        }
    }
    if (Object.hasOwn(server, "headers"))
        validateHeaderMap(server.headers, `${path}/headers`, diagnostics);
}

function lexicalRelativeContained(value) {
    if (!value.startsWith("./")) return false;
    const normalized = resolve("/plugin", value.slice(2));
    return isContained("/plugin", normalized);
}

function existingPathContained(root, value) {
    const resolvedRoot = realpathSync(root);
    const candidate = resolve(resolvedRoot, value.slice(2));
    if (!isContained(resolvedRoot, candidate)) return false;
    if (!existsSync(candidate)) return true;
    return isContained(resolvedRoot, realpathSync(candidate));
}

function validateStdioServer(server, root, path, diagnostics) {
    const allowed = new Set(["type", "command", "args", "env", "cwd"]);
    for (const key of Object.keys(server))
        if (!allowed.has(key))
            diagnostics.push(
                diagnostic(
                    "MCP_SERVER_FIELD_INVALID",
                    `${path}/${key}`,
                    `Field ${key} is not allowed for stdio.`,
                    { fatal: true },
                ),
            );
    if (
        typeof server.command !== "string" ||
        server.command.length === 0 ||
        /\s/.test(server.command) ||
        /\$\{[^}]+\}/.test(server.command) ||
        (!/^[^/\\]+$/.test(server.command) &&
            !lexicalRelativeContained(server.command))
    )
        diagnostics.push(
            diagnostic(
                "MCP_COMMAND_INVALID",
                `${path}/command`,
                "command must be one bare executable token or one contained ./ path without expansion.",
                { fatal: true },
            ),
        );
    else if (
        server.command.startsWith("./") &&
        !existingPathContained(root, server.command)
    )
        diagnostics.push(
            diagnostic(
                "MCP_COMMAND_PATH_ESCAPE",
                `${path}/command`,
                "Plugin-relative command resolves outside the plugin root.",
                { fatal: true },
            ),
        );
    if (Object.hasOwn(server, "args")) {
        if (
            !Array.isArray(server.args) ||
            server.args.some((value) => typeof value !== "string")
        )
            diagnostics.push(
                diagnostic(
                    "MCP_ARGS_INVALID",
                    `${path}/args`,
                    "args must be an array of strings.",
                    { fatal: true },
                ),
            );
        else
            for (const [index, value] of server.args.entries())
                if (containsUnsupportedPlaceholder(value))
                    diagnostics.push(
                        diagnostic(
                            "MCP_PLACEHOLDER_INVALID",
                            `${path}/args/${index}`,
                            "Only PLUGIN_ROOT and PLUGIN_DATA placeholders are portable.",
                            { fatal: true },
                        ),
                    );
    }
    if (Object.hasOwn(server, "env")) {
        if (
            !isObject(server.env) ||
            Object.values(server.env).some((value) => typeof value !== "string")
        )
            diagnostics.push(
                diagnostic(
                    "MCP_ENV_INVALID",
                    `${path}/env`,
                    "env must map names to strings.",
                    { fatal: true },
                ),
            );
        else
            for (const [key, value] of Object.entries(server.env)) {
                if (["PLUGIN_ROOT", "PLUGIN_DATA"].includes(key.toUpperCase()))
                    diagnostics.push(
                        diagnostic(
                            "MCP_ENV_RESERVED",
                            `${path}/env/${key}`,
                            `${key} conflicts with a client-provided reserved environment variable.`,
                            { fatal: true },
                        ),
                    );
                if (containsUnsupportedPlaceholder(value))
                    diagnostics.push(
                        diagnostic(
                            "MCP_PLACEHOLDER_INVALID",
                            `${path}/env/${key}`,
                            "Only PLUGIN_ROOT and PLUGIN_DATA placeholders are portable.",
                            { fatal: true },
                        ),
                    );
                if (containsSecretLiteral(`${key}=${value}`))
                    diagnostics.push(
                        diagnostic(
                            "MCP_SECRET_LITERAL_FORBIDDEN",
                            `${path}/env/${key}`,
                            "MCP environment values must not embed credential or secret literals.",
                            { fatal: true },
                        ),
                    );
            }
    }
    if (Object.hasOwn(server, "cwd")) {
        if (typeof server.cwd === "string") {
            let valid = false;
            if (server.cwd.startsWith("./"))
                valid =
                    lexicalRelativeContained(server.cwd) &&
                    existingPathContained(root, server.cwd);
            else if (
                server.cwd === "${PLUGIN_ROOT}" ||
                server.cwd.startsWith("${PLUGIN_ROOT}/")
            ) {
                const suffix = server.cwd.slice("${PLUGIN_ROOT}".length);
                const relativeCwd = `.${suffix || "/"}`;
                valid =
                    lexicalRelativeContained(relativeCwd) &&
                    existingPathContained(root, relativeCwd);
            } else if (
                server.cwd === "${PLUGIN_DATA}" ||
                server.cwd.startsWith("${PLUGIN_DATA}/")
            ) {
                const suffix = server.cwd.slice("${PLUGIN_DATA}".length);
                valid = lexicalRelativeContained(`.${suffix || "/"}`);
            }
            if (!valid)
                diagnostics.push(
                    diagnostic(
                        "MCP_CWD_INVALID",
                        `${path}/cwd`,
                        "cwd must remain within ./, ${PLUGIN_ROOT}, or ${PLUGIN_DATA}.",
                        { fatal: true },
                    ),
                );
        } else {
            diagnostics.push(
                diagnostic(
                    "MCP_CWD_INVALID",
                    `${path}/cwd`,
                    "cwd must be a supported string path form.",
                    { fatal: true },
                ),
            );
        }
    }
}

export function validateMcpConfiguration(
    pluginRoot,
    { pluginManifest, mode = "universal" } = {},
) {
    const root = resolve(pluginRoot);
    const path = join(root, "mcp.json");
    const diagnostics = [];
    if (!existsSync(path))
        return {
            root,
            path,
            present: false,
            valid: true,
            loadable: true,
            servers: [],
            diagnostics,
        };
    try {
        const stat = lstatSync(path);
        if (!stat.isFile() && !stat.isSymbolicLink())
            throw new Error("mcp.json is not a regular file");
        if (!resolvedContained(root, path)) throw new Error("mcp.json escapes");
    } catch (error) {
        diagnostics.push(
            diagnostic(
                "MCP_COMPONENT_PATH_INVALID",
                path,
                `MCP component is invalid: ${error.message}`,
                { fatal: true },
            ),
        );
        return {
            root,
            path,
            present: true,
            valid: false,
            loadable: false,
            servers: [],
            diagnostics,
        };
    }
    if (mode === passiveProfile)
        diagnostics.push(
            diagnostic(
                "PASSIVE_MCP_FORBIDDEN",
                path,
                "mcp.json is forbidden by cratis-passive-v1.",
                { fatal: true },
            ),
        );
    const read = readJson(path, "MCP_JSON_INVALID", diagnostics, {
        fatal: true,
    });
    const configuration = read.value;
    if (configuration === undefined)
        return {
            root,
            path,
            present: true,
            valid: false,
            loadable: false,
            servers: [],
            diagnostics: sortDiagnostics(diagnostics),
        };
    let topLevelValid = true;
    if (isObject(configuration)) {
        if (
            configuration.$schema !== mcpSchemaUrl ||
            !isObject(configuration.mcpServers) ||
            Object.keys(configuration).some(
                (key) => !["$schema", "mcpServers"].includes(key),
            )
        )
            topLevelValid = false;
        if (pluginManifest?.$schema !== pluginSchemaUrl)
            diagnostics.push(
                diagnostic(
                    "MCP_SCHEMA_VERSION_MISMATCH",
                    `${path}#/$schema`,
                    "mcp.json and plugin.json do not target the same supported specification version.",
                    { fatal: true },
                ),
            );
    } else topLevelValid = false;
    if (!topLevelValid)
        diagnostics.push(
            diagnostic(
                "MCP_TOP_LEVEL_INVALID",
                path,
                "mcp.json must be a closed 1.0.0 object with $schema and mcpServers.",
                { fatal: true },
            ),
        );
    const servers = [];
    if (topLevelValid)
        for (const [name, server] of Object.entries(configuration.mcpServers)) {
            const serverDiagnostics = [];
            const serverPath = `${path}#/mcpServers/${name}`;
            if (!isObject(server))
                serverDiagnostics.push(
                    diagnostic(
                        "MCP_SERVER_INVALID",
                        serverPath,
                        "Each MCP server must be an object.",
                        { fatal: true },
                    ),
                );
            else if (server.type === "stdio")
                validateStdioServer(
                    server,
                    root,
                    serverPath,
                    serverDiagnostics,
                );
            else if (["streamable-http", "sse"].includes(server.type))
                validateRemoteServer(server, serverPath, serverDiagnostics);
            else
                serverDiagnostics.push(
                    diagnostic(
                        "MCP_SERVER_TYPE_INVALID",
                        `${serverPath}/type`,
                        "type must be stdio, streamable-http, or sse.",
                        { fatal: true },
                    ),
                );
            const sorted = sortDiagnostics(serverDiagnostics);
            diagnostics.push(...sorted);
            servers.push({
                name,
                valid: sorted.length === 0,
                diagnostics: sorted,
            });
        }
    const sorted = sortDiagnostics(diagnostics);
    return {
        root,
        path,
        present: true,
        configuration,
        servers,
        diagnostics: sorted,
        valid: sorted.length === 0,
        loadable: topLevelValid,
    };
}

function discoverSkills(root, mode, diagnostics) {
    const skillsPath = join(root, "skills");
    if (!existsSync(skillsPath)) return [];
    try {
        const stat = lstatSync(skillsPath);
        if (!stat.isDirectory() && !stat.isSymbolicLink())
            throw new Error("skills is not a directory");
        if (!resolvedContained(root, skillsPath))
            throw new Error("skills escapes");
    } catch (error) {
        diagnostics.push(
            diagnostic(
                "AP_SKILLS_COMPONENT_INVALID",
                skillsPath,
                `Skills component is invalid: ${error.message}`,
                { fatal: false },
            ),
        );
        return [];
    }
    const results = [];
    for (const entry of readdirSync(skillsPath, { withFileTypes: true }).sort(
        (left, right) => compareOrdinal(left.name, right.name),
    )) {
        const child = join(skillsPath, entry.name);
        const directory = entry.isDirectory() || entry.isSymbolicLink();
        if (!directory) continue;
        const skillFile = join(child, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        const result = validateAgentSkill(child, { mode, pluginRoot: root });
        diagnostics.push(...result.diagnostics);
        results.push({ name: entry.name, ...result });
    }
    return results;
}

function validateExtensionDirectories(root, manifest, diagnostics) {
    const entries = readdirSync(root, { withFileTypes: true });
    const declared = isObject(manifest?.extensions)
        ? Object.keys(manifest.extensions)
        : [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.includes(".")) continue;
        if (!extensionNamespacePattern.test(entry.name))
            diagnostics.push(
                diagnostic(
                    "AP_EXTENSION_DIRECTORY_NAMESPACE_INVALID",
                    join(root, entry.name),
                    "Dotted extension directories must use a reverse-domain namespace.",
                    { fatal: false },
                ),
            );
    }
    for (const namespace of declared) {
        const caseMatch = entries.find(
            (entry) =>
                entry.name.toLowerCase() === namespace.toLowerCase() &&
                entry.name !== namespace,
        );
        if (caseMatch)
            diagnostics.push(
                diagnostic(
                    "AP_EXTENSION_DIRECTORY_MISMATCH",
                    join(root, caseMatch.name),
                    `Extension directory must be named exactly ${namespace}.`,
                    { fatal: false },
                ),
            );
    }
}

function walkPassive(root, current, diagnostics, files, collisions) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
        (left, right) => compareOrdinal(left.name, right.name),
    )) {
        const path = join(current, entry.name);
        const relativePath = relative(root, path).replaceAll("\\", "/");
        const stat = lstatSync(path);
        const collisionKey = relativePath.normalize("NFC").toLowerCase();
        if (collisions.has(collisionKey))
            diagnostics.push(
                diagnostic(
                    "PASSIVE_PATH_COLLISION",
                    relativePath,
                    "Case or Unicode-normalization path collision is forbidden.",
                    { fatal: true },
                ),
            );
        collisions.add(collisionKey);
        if (stat.isSymbolicLink()) {
            diagnostics.push(
                diagnostic(
                    "PASSIVE_SYMLINK_FORBIDDEN",
                    relativePath,
                    "All symlinks and equivalent indirection are forbidden.",
                    { fatal: true },
                ),
            );
            continue;
        }
        if (stat.isDirectory()) {
            if (
                ["scripts", "evals", "hooks"].includes(entry.name.toLowerCase())
            )
                diagnostics.push(
                    diagnostic(
                        "PASSIVE_EXECUTABLE_CATEGORY_FORBIDDEN",
                        relativePath,
                        `${entry.name} directories are forbidden.`,
                        { fatal: true },
                    ),
                );
            walkPassive(root, path, diagnostics, files, collisions);
            continue;
        }
        if (!stat.isFile()) {
            diagnostics.push(
                diagnostic(
                    "PASSIVE_SPECIAL_FILE_FORBIDDEN",
                    relativePath,
                    "Special files are forbidden.",
                    { fatal: true },
                ),
            );
            continue;
        }
        files.push(relativePath);
        if ((stat.mode & 0o111) !== 0)
            diagnostics.push(
                diagnostic(
                    "PASSIVE_EXECUTABLE_FILE_FORBIDDEN",
                    relativePath,
                    "Executable file mode is forbidden.",
                    { fatal: true },
                ),
            );
        const content = readFileSync(path);
        if (
            /\.(?:apk|app|bat|bin|class|cmd|com|cjs|dll|dylib|exe|fish|jar|js|jsx|lua|mjs|msi|php|pl|pm|ps1|py|pyc|pyo|rb|sh|so|tcl|ts|tsx|vbs|wasm|zsh)$/i.test(
                relativePath,
            ) ||
            content.subarray(0, 2).toString("utf8") === "#!"
        )
            diagnostics.push(
                diagnostic(
                    "PASSIVE_EXECUTABLE_CONTENT_FORBIDDEN",
                    relativePath,
                    "Script, lifecycle, or executable extension content is forbidden.",
                    { fatal: true },
                ),
            );
        const allowed =
            relativePath === "plugin.json" ||
            /^skills\/[^/]+\/(?:SKILL\.md|LICENSE[^/]*|references\/.+|assets\/.+)$/.test(
                relativePath,
            );
        if (
            /\/(?:references|assets)\//u.test(relativePath) &&
            !passiveStaticExtensions.has(
                relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase(),
            )
        )
            diagnostics.push(
                diagnostic(
                    "PASSIVE_FILE_TYPE_FORBIDDEN",
                    relativePath,
                    "Passive references and assets must use a reviewed static text format.",
                    { fatal: true },
                ),
            );
        if (!allowed)
            diagnostics.push(
                diagnostic(
                    "PASSIVE_PAYLOAD_PATH_FORBIDDEN",
                    relativePath,
                    "Passive payload allows only plugin.json and SKILL.md, LICENSE*, references/**, or assets/** skill files.",
                    { fatal: true },
                ),
            );
        try {
            if (relativePath !== "plugin.json")
                validatePayloadPath(relativePath);
            assertSafeContent(relativePath, content);
        } catch (error) {
            diagnostics.push(
                diagnostic(
                    "PASSIVE_CONTENT_SAFETY_INVALID",
                    relativePath,
                    error.message,
                    { fatal: true },
                ),
            );
        }
    }
}

export function validateCratisPassiveProfile(
    pluginRoot,
    { profileId, version, artifactId, repositoryRoot } = {},
) {
    return validateAgentPluginArtifact(pluginRoot, {
        mode: passiveProfile,
        expectedProfileId: profileId,
        expectedVersion: version,
        artifactId,
        repositoryRoot,
        skipPassiveDelegation: true,
    });
}

function buildReceipt(result, artifactId) {
    const files =
        result.pluginRoot && existsSync(result.pluginRoot)
            ? result.fileInventory
            : [];
    const receipt = {
        schemaVersion: "1.0.0",
        contract: result.mode,
        artifactId,
        plugin: {
            name: result.manifest?.name ?? null,
            version: result.manifest?.version ?? null,
        },
        specifications: {
            agentPlugins: {
                version: "1.0.0",
                status: "published",
                pluginSchemaSha256: expectedSpecificationSources[0].sha256,
                mcpSchemaSha256: expectedSpecificationSources[1].sha256,
                normativeSpecificationSha256:
                    expectedSpecificationSources[2].sha256,
            },
            agentSkills: {
                status: "current-unversioned-specification",
                specificationSha256: expectedAgentSkillsSource.sha256,
            },
        },
        files,
        diagnosticCodes: result.diagnostics.map((entry) => entry.code),
        conformant: result.conformant,
        loadable: result.loadable,
        releaseBlocking: result.releaseBlocking,
        executionPerformed: false,
        networkAccessPerformed: false,
        approvalGranted: false,
        supportGranted: false,
        publicationGranted: false,
    };
    return { ...receipt, sha256: sha256(`${JSON.stringify(receipt)}\n`) };
}

export function validateAgentPluginArtifact(
    pluginRoot,
    {
        mode = "universal",
        expectedProfileId,
        expectedVersion,
        artifactId = basename(resolve(pluginRoot)),
        repositoryRoot = defaultRepositoryRoot,
        skipPassiveDelegation = false,
    } = {},
) {
    if (mode === passiveProfile && !skipPassiveDelegation)
        return validateCratisPassiveProfile(pluginRoot, {
            profileId: expectedProfileId,
            version: expectedVersion,
            artifactId,
            repositoryRoot,
        });
    const root = resolve(pluginRoot);
    const diagnostics = [];
    const lockDiagnostics = validateSpecificationLock({ repositoryRoot });
    diagnostics.push(...lockDiagnostics);
    let rootValid = true;
    try {
        const rootStat = lstatSync(root);
        const resolvedRoot = realpathSync(root);
        if (!lstatSync(resolvedRoot).isDirectory())
            throw new Error("not a directory");
        if (mode === passiveProfile && rootStat.isSymbolicLink())
            diagnostics.push(
                diagnostic(
                    "PASSIVE_SYMLINK_FORBIDDEN",
                    root,
                    "A passive plugin root must not itself be a symlink.",
                    { fatal: true },
                ),
            );
    } catch (error) {
        rootValid = false;
        diagnostics.push(
            diagnostic(
                "AP_PLUGIN_ROOT_INVALID",
                root,
                `Plugin root is invalid: ${error.message}`,
                { fatal: true },
            ),
        );
    }
    const manifestResult = rootValid
        ? validatePluginManifest(root, { mode })
        : { diagnostics: [], loadable: false };
    diagnostics.push(...manifestResult.diagnostics);
    let skills = [];
    let mcp = {
        present: false,
        valid: true,
        loadable: true,
        servers: [],
        diagnostics: [],
    };
    if (rootValid && manifestResult.loadable) {
        validateExtensionDirectories(
            root,
            manifestResult.manifest,
            diagnostics,
        );
        skills = discoverSkills(root, mode, diagnostics);
        mcp = validateMcpConfiguration(root, {
            pluginManifest: manifestResult.manifest,
            mode,
        });
        diagnostics.push(...mcp.diagnostics);
    }
    const fileInventory = [];
    if (rootValid && mode === passiveProfile) {
        if (
            typeof expectedProfileId !== "string" ||
            !/^(?:public|engineering)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
                expectedProfileId,
            )
        )
            diagnostics.push(
                diagnostic(
                    "PASSIVE_EXPECTED_PROFILE_INVALID",
                    root,
                    "cratis-passive-v1 requires an exact expected profile id.",
                    { fatal: true },
                ),
            );
        if (
            typeof expectedVersion !== "string" ||
            !exactSemVerPattern.test(expectedVersion)
        )
            diagnostics.push(
                diagnostic(
                    "PASSIVE_EXPECTED_VERSION_INVALID",
                    root,
                    "cratis-passive-v1 requires an exact expected SemVer.",
                    { fatal: true },
                ),
            );
        if (manifestResult.manifest?.name !== expectedProfileId)
            diagnostics.push(
                diagnostic(
                    "PASSIVE_PROFILE_PARITY_MISMATCH",
                    manifestResult.manifestPath ?? root,
                    "plugin name does not match the expected passive profile id.",
                    { fatal: true },
                ),
            );
        if (manifestResult.manifest?.version !== expectedVersion)
            diagnostics.push(
                diagnostic(
                    "PASSIVE_VERSION_PARITY_MISMATCH",
                    manifestResult.manifestPath ?? root,
                    "plugin version does not match the expected passive release version.",
                    { fatal: true },
                ),
            );
        if (skills.filter((skill) => skill.valid).length === 0)
            diagnostics.push(
                diagnostic(
                    "PASSIVE_SKILL_REQUIRED",
                    join(root, "skills"),
                    "cratis-passive-v1 requires at least one valid Agent Skill.",
                    { fatal: true },
                ),
            );
        if (
            isObject(manifestResult.manifest?.extensions) &&
            Object.keys(manifestResult.manifest.extensions).length > 0
        )
            diagnostics.push(
                diagnostic(
                    "PASSIVE_EXTENSION_CONTENT_FORBIDDEN",
                    `${manifestResult.manifestPath}#/extensions`,
                    "Client extension content is forbidden in passive artifacts.",
                    { fatal: true },
                ),
            );
        walkPassive(root, root, diagnostics, [], new Set());
    }
    if (rootValid) {
        const collect = (current) => {
            for (const entry of readdirSync(current, {
                withFileTypes: true,
            }).sort((left, right) => compareOrdinal(left.name, right.name))) {
                const path = join(current, entry.name);
                const relativePath = relative(root, path).replaceAll("\\", "/");
                if (entry.isSymbolicLink()) {
                    if (!resolvedContained(root, path))
                        diagnostics.push(
                            diagnostic(
                                "AP_PACKAGE_PATH_ESCAPE",
                                relativePath,
                                "Package symlink resolves outside the plugin root.",
                                { fatal: true },
                            ),
                        );
                    else
                        diagnostics.push(
                            diagnostic(
                                "AP_PACKAGE_SYMLINK_FORBIDDEN",
                                relativePath,
                                "Cratis portable validation rejects symlinks so release inventory cannot omit indirection.",
                                { fatal: true },
                            ),
                        );
                } else if (entry.isDirectory()) collect(path);
                else if (entry.isFile())
                    fileInventory.push(fileDigestRecord(root, relativePath));
                else
                    diagnostics.push(
                        diagnostic(
                            "AP_PACKAGE_SPECIAL_FILE_FORBIDDEN",
                            relativePath,
                            "Portable package inventory rejects special files.",
                            { fatal: true },
                        ),
                    );
            }
        };
        collect(root);
    }
    const sorted = sortDiagnostics(diagnostics);
    const result = {
        mode,
        pluginRoot: root,
        manifest: manifestResult.manifest,
        skills,
        mcp,
        fileInventory,
        diagnostics: sorted,
        conformant: sorted.length === 0,
        loadable:
            rootValid &&
            manifestResult.loadable === true &&
            !sorted.some(
                (entry) => entry.fatal && entry.code.startsWith("SPEC_"),
            ),
        releaseBlocking: sorted.some((entry) => entry.releaseBlocking),
    };
    result.receipt = buildReceipt(result, artifactId);
    return result;
}

export function formatComplianceDiagnostics(diagnostics) {
    return sortDiagnostics(diagnostics)
        .map(
            (entry) =>
                `${entry.severity.toUpperCase()} ${entry.code} ${entry.path}: ${entry.message}`,
        )
        .join("\n");
}

function main() {
    const [argument, mode, expectedProfileId, expectedVersion] =
        process.argv.slice(2);
    if (!argument || argument === "--verify-lock") {
        const diagnostics = validateSpecificationLock();
        if (diagnostics.length > 0) {
            process.stderr.write(
                `${formatComplianceDiagnostics(diagnostics)}\n`,
            );
            process.exitCode = 1;
        } else process.stdout.write("Portable specification locks verified.\n");
        return;
    }
    const result = validateAgentPluginArtifact(argument, {
        mode: mode ?? "universal",
        expectedProfileId,
        expectedVersion,
    });
    if (result.diagnostics.length > 0)
        process.stderr.write(
            `${formatComplianceDiagnostics(result.diagnostics)}\n`,
        );
    process.stdout.write(`${JSON.stringify(result.receipt, null, 2)}\n`);
    if (result.releaseBlocking) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

export {
    expectedAgentSkillsSource,
    expectedSpecificationSources,
    mcpSchemaUrl,
    passiveProfile,
    pluginSchemaUrl,
};
