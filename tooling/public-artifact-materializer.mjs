// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { isIP } from "node:net";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { forbiddenPathPolicy } from "./harness-registry.mjs";
import { createLogicalTree } from "./deterministic-release-tree.mjs";

const allowedSkillResourceDirectories = new Set(["references", "assets"]);
const forbiddenSegments = new Set(forbiddenPathPolicy.artifactSegments);
const secretPatterns = [
    /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bnpm_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[^\s"']{12,}/i,
    /\b(?:api[_-]?key|access[_-]?key|client[_-]?secret|password|private[_-]?token|secret|token)\s*[:=]\s*(?:"[^"\r\n]{12,}"|'[^'\r\n]{12,}'|[A-Za-z0-9_+./=-]{20,})/i,
    /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];
const privateOrLocalPatterns = [
    /(?:^|[\s("'`])\/(?:Users|home|Volumes)\//,
    /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\/i,
    /\bfile:\/\//i,
];
const httpUrlPattern = /https?:\/\/[^\s<>()"'`]+/gi;

function isPrivateIpv4(hostname) {
    const octets = hostname.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet)))
        return true;
    const [first, second] = octets;
    return (
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 198 && (second === 18 || second === 19)) ||
        first >= 224
    );
}

function isPrivateNetworkHost(hostname) {
    const normalized = hostname
        .toLocaleLowerCase("en-US")
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .replace(/\.+$/, "");
    if (
        normalized === "localhost" ||
        normalized.endsWith(".localhost") ||
        normalized.endsWith(".internal") ||
        normalized.endsWith(".local")
    ) {
        return true;
    }
    const addressKind = isIP(normalized);
    if (addressKind === 4) return isPrivateIpv4(normalized);
    if (addressKind !== 6) return false;
    if (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("::ffff:")
    ) {
        return true;
    }
    const firstGroup = Number.parseInt(normalized.split(":", 1)[0], 16);
    return (
        (firstGroup & 0xfe00) === 0xfc00 ||
        (firstGroup & 0xffc0) === 0xfe80 ||
        (firstGroup & 0xff00) === 0xff00
    );
}

function assertNoPrivateNetworkUrls(path, content) {
    for (const match of content.matchAll(httpUrlPattern)) {
        try {
            const url = new URL(match[0]);
            if (isPrivateNetworkHost(url.hostname))
                throw new Error(
                    `Private or local content is forbidden: ${path}`,
                );
        } catch (error) {
            if (error.message.startsWith("Private or local content"))
                throw error;
        }
    }
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function normalizedCollisionKey(path) {
    return path.normalize("NFC").toLocaleLowerCase("en-US");
}

function assertUniquePaths(paths, label) {
    const exact = new Set();
    const normalized = new Map();
    for (const path of paths) {
        if (exact.has(path))
            throw new Error(`${label} contains duplicate path: ${path}`);
        exact.add(path);
        const key = normalizedCollisionKey(path);
        const existing = normalized.get(key);
        if (existing && existing !== path) {
            throw new Error(
                `${label} contains a case or Unicode-normalization collision: ${existing} and ${path}`,
            );
        }
        normalized.set(key, path);
    }
}

export function validateArtifactPath(path) {
    if (typeof path !== "string" || path.length === 0) {
        throw new Error("Artifact path must be a non-empty string");
    }
    if (path.includes("\\"))
        throw new Error(`Artifact path must use forward slashes: ${path}`);
    if (isAbsolute(path) || /^[A-Za-z]:\//.test(path)) {
        throw new Error(`Absolute artifact path is forbidden: ${path}`);
    }
    const segments = path.split("/");
    if (
        segments.some(
            (segment) => segment === "" || segment === "." || segment === "..",
        )
    ) {
        throw new Error(
            `Artifact path traversal or empty segment is forbidden: ${path}`,
        );
    }
    if (segments.some((segment) => segment.startsWith("."))) {
        throw new Error(`Hidden artifact path is forbidden: ${path}`);
    }
    if (
        segments.some((segment) =>
            forbiddenSegments.has(segment.toLocaleLowerCase("en-US")),
        )
    ) {
        throw new Error(`Forbidden artifact category in path: ${path}`);
    }
    return segments;
}

function isLicenseName(name) {
    return /^LICENSE(?:[.-].+)?$/i.test(name);
}

export function validatePayloadPath(path, approvedMetadata = []) {
    const segments = validateArtifactPath(path);
    if (approvedMetadata.includes(path)) return;
    if (segments[0] !== "skills" || segments.length < 3) {
        throw new Error(
            `Runtime payload is not an approved skill path or public metadata path: ${path}`,
        );
    }
    const skillName = segments[1];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
        throw new Error(`Invalid skill directory name: ${skillName}`);
    }
    if (
        segments.length === 3 &&
        (segments[2] === "SKILL.md" || isLicenseName(segments[2]))
    )
        return;
    if (
        segments.length >= 4 &&
        allowedSkillResourceDirectories.has(segments[2])
    )
        return;
    throw new Error(`Forbidden file in skill runtime payload: ${path}`);
}

function assertContained(root, path, label) {
    const relativePath = relative(root, path);
    if (
        relativePath === "" ||
        (!relativePath.startsWith(`..${sep}`) &&
            relativePath !== ".." &&
            !isAbsolute(relativePath))
    ) {
        return;
    }
    throw new Error(`${label} escapes its root: ${path}`);
}

export function assertSafeContent(path, content) {
    if (!Buffer.isBuffer(content))
        throw new Error(`Payload content must be a byte buffer: ${path}`);
    if (content.includes(0))
        throw new Error(
            `Binary or NUL-containing payload is forbidden: ${path}`,
        );
    if (!isUtf8(content))
        throw new Error(`Invalid UTF-8 payload is forbidden: ${path}`);
    const text = content.toString("utf8");
    for (const pattern of secretPatterns) {
        if (pattern.test(text))
            throw new Error(`Secret-shaped content is forbidden: ${path}`);
    }
    for (const pattern of privateOrLocalPatterns) {
        if (pattern.test(text))
            throw new Error(`Private or local content is forbidden: ${path}`);
    }
    assertNoPrivateNetworkUrls(path, text);
}

function extractMarkdownLinks(content) {
    const links = [];
    const pattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
    for (const match of content.matchAll(pattern)) links.push(match[1]);
    return links;
}

function stripAnchor(path) {
    return path.split("#", 1)[0].split("?", 1)[0];
}

function assertSkillReferences(stageRoot, stagedPaths) {
    const pathSet = new Set(stagedPaths);
    const referencedResources = new Set();
    for (const path of stagedPaths.filter((candidate) =>
        candidate.endsWith(".md"),
    )) {
        const content = readFileSync(join(stageRoot, path), "utf8");
        const skillRoot = path.split("/").slice(0, 2).join("/");
        for (const link of extractMarkdownLinks(content)) {
            if (/^(?:[a-z]+:|#)/i.test(link)) continue;
            const targetPart = stripAnchor(link);
            if (!targetPart) continue;
            const target = resolve(`/${dirname(path)}`, targetPart)
                .slice(1)
                .split(sep)
                .join("/");
            if (target !== skillRoot && !target.startsWith(`${skillRoot}/`)) {
                throw new Error(
                    `Reference escapes skill root: ${path} -> ${link}`,
                );
            }
            if (!pathSet.has(target))
                throw new Error(
                    `Unresolved staged reference: ${path} -> ${link}`,
                );
            referencedResources.add(target);
        }
    }
    for (const path of stagedPaths) {
        const segments = path.split("/");
        if (
            segments.length >= 4 &&
            allowedSkillResourceDirectories.has(segments[2]) &&
            !referencedResources.has(path)
        ) {
            throw new Error(`Unlinked staged skill resource: ${path}`);
        }
    }
}

function walkRegularFiles(root, current = root) {
    const paths = [];
    for (const entry of readdirSync(current, { withFileTypes: true })) {
        const absolutePath = join(current, entry.name);
        const relativePath = relative(root, absolutePath).split(sep).join("/");
        const stat = lstatSync(absolutePath);
        if (stat.isSymbolicLink())
            throw new Error(
                `Staged symlink or junction is forbidden: ${relativePath}`,
            );
        if (stat.isDirectory())
            paths.push(...walkRegularFiles(root, absolutePath));
        else if (stat.isFile()) paths.push(relativePath);
        else
            throw new Error(
                `Staged special file is forbidden: ${relativePath}`,
            );
    }
    return paths;
}

export function discoverSkillPaths(root) {
    return walkRegularFiles(root)
        .filter((path) => path.endsWith("/SKILL.md"))
        .filter((path) => path.split("/").at(-3) === "skills")
        .sort();
}

export function validateStagedArtifact(stageRoot, options = {}) {
    const root = realpathSync(stageRoot);
    const paths = walkRegularFiles(root).sort();
    assertUniquePaths(paths, "Staged artifact");
    for (const path of paths) {
        validatePayloadPath(path, options.approvedMetadata ?? []);
        const absolutePath = join(root, path);
        assertContained(
            root,
            realpathSync(absolutePath),
            `Staged path ${path}`,
        );
        const content = readFileSync(absolutePath);
        assertSafeContent(path, content);
    }
    assertSkillReferences(root, paths);
    const discovered = discoverSkillPaths(root);
    const unexpected = discovered.filter(
        (path) => !/^skills\/[^/]+\/SKILL\.md$/.test(path),
    );
    if (unexpected.length > 0) {
        throw new Error(
            `Recursive skill discovery found non-public skill paths: ${unexpected.join(", ")}`,
        );
    }
    return {
        files: paths.map((path) => {
            const content = readFileSync(join(root, path));
            return { path, sha256: sha256(content), size: content.length };
        }),
        discoveredSkills: discovered,
    };
}

export function materializeFixtureArtifact(options) {
    const sourceRoot = options.sourceRoot
        ? realpathSync(options.sourceRoot)
        : undefined;
    const stageRoot = resolve(options.stageRoot);
    if (existsSync(stageRoot))
        throw new Error(
            `Staging directory must not already exist: ${stageRoot}`,
        );
    if (options.manifestPath && existsSync(options.manifestPath))
        throw new Error(
            `Manifest path must not already exist: ${options.manifestPath}`,
        );
    const approvedFiles = [...options.approvedFiles];
    assertUniquePaths(approvedFiles, "Approved source selection");
    approvedFiles.sort();
    for (const path of approvedFiles)
        validatePayloadPath(path, options.approvedMetadata ?? []);
    const logicalTree = options.approvedBuffers
        ? createLogicalTree({
              files: approvedFiles.map((path) => ({
                  path,
                  content: options.approvedBuffers.get(path),
              })),
              metrics: options.metrics,
          })
        : createLogicalTree({
              sourceRoot,
              approvedFiles,
              metrics: options.metrics,
          });
    for (const file of logicalTree.files)
        assertSafeContent(file.path, logicalTree.read(file.path));
    let stageCreated = false;
    try {
        mkdirSync(stageRoot, { recursive: false });
        stageCreated = true;
        for (const file of logicalTree.files) {
            const destination = join(stageRoot, file.path);
            assertContained(stageRoot, destination, `Destination ${file.path}`);
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, logicalTree.read(file.path), {
                flag: "wx",
            });
        }
        const manifest = validateStagedArtifact(stageRoot, options);
        if (options.manifestPath) {
            writeFileSync(
                options.manifestPath,
                `${JSON.stringify(manifest, null, 2)}\n`,
                { flag: "wx" },
            );
        }
        return manifest;
    } catch (error) {
        if (stageCreated) rmSync(stageRoot, { recursive: true, force: true });
        if (options.manifestPath && existsSync(options.manifestPath))
            rmSync(options.manifestPath, { force: true });
        throw error;
    }
}

function archiveLimits(options) {
    const limits = {
        maximumArchiveSize: options.maximumArchiveSize ?? 16 * 1024 * 1024,
        maximumEntries: options.maximumEntries ?? 1024,
        maximumEntrySize: options.maximumEntrySize ?? 1024 * 1024,
        maximumTotalSize: options.maximumTotalSize ?? 8 * 1024 * 1024,
    };
    for (const [name, value] of Object.entries(limits)) {
        if (!Number.isSafeInteger(value) || value < 1)
            throw new Error(`Archive limit ${name} must be a positive integer`);
    }
    return limits;
}

function validateArchiveEntries(archive, options) {
    if (
        archive.format !== "cratis-fixture-archive-v1" ||
        !Array.isArray(archive.entries)
    ) {
        throw new Error("Unsupported fixture archive format");
    }
    const limits = archiveLimits(options);
    if (archive.entries.length > limits.maximumEntries)
        throw new Error("Fixture archive exceeds entry-count policy");
    for (const entry of archive.entries) {
        if (
            !entry ||
            typeof entry !== "object" ||
            Array.isArray(entry) ||
            typeof entry.path !== "string"
        ) {
            throw new Error("Fixture archive contains an invalid entry");
        }
    }
    const paths = archive.entries.map((entry) => entry.path);
    assertUniquePaths(paths, "Fixture archive");
    let totalSize = 0;
    const entries = archive.entries.map((entry) => {
        validatePayloadPath(entry.path, options.approvedMetadata ?? []);
        if (
            !Number.isSafeInteger(entry.size) ||
            entry.size < 0 ||
            entry.size > limits.maximumEntrySize
        ) {
            throw new Error(`Archive entry exceeds size policy: ${entry.path}`);
        }
        totalSize += entry.size;
        if (totalSize > limits.maximumTotalSize)
            throw new Error("Fixture archive exceeds total-size policy");
        if (typeof entry.content !== "string")
            throw new Error(
                `Archive entry content must be Base64: ${entry.path}`,
            );
        const maximumEncodedSize = 4 * Math.ceil(entry.size / 3);
        if (entry.content.length > maximumEncodedSize)
            throw new Error(
                `Archive entry encoded content exceeds declared size: ${entry.path}`,
            );
        const content = Buffer.from(entry.content, "base64");
        if (content.toString("base64") !== entry.content)
            throw new Error(
                `Archive entry Base64 is not canonical: ${entry.path}`,
            );
        if (
            typeof entry.sha256 !== "string" ||
            content.length !== entry.size ||
            sha256(content) !== entry.sha256
        ) {
            throw new Error(
                `Archive entry digest or size mismatch: ${entry.path}`,
            );
        }
        assertSafeContent(entry.path, content);
        return { content, path: entry.path };
    });
    return { entries, limits };
}

function preflightArchiveStage(stageRoot, options) {
    const limits = archiveLimits(options);
    const root = realpathSync(stageRoot);
    const paths = walkRegularFiles(root);
    if (paths.length > limits.maximumEntries)
        throw new Error("Fixture archive exceeds entry-count policy");
    let totalSize = 0;
    for (const path of paths) {
        const size = lstatSync(join(root, path)).size;
        if (size > limits.maximumEntrySize)
            throw new Error(`Archive entry exceeds size policy: ${path}`);
        totalSize += size;
        if (totalSize > limits.maximumTotalSize)
            throw new Error("Fixture archive exceeds total-size policy");
    }
    return limits;
}

export function packFixtureArchive(stageRoot, archivePath, options = {}) {
    if (existsSync(archivePath))
        throw new Error(`Archive path must not already exist: ${archivePath}`);
    const partialPath = `${archivePath}.partial`;
    if (existsSync(partialPath))
        throw new Error(`Archive partial path already exists: ${partialPath}`);
    const preflightLimits = preflightArchiveStage(stageRoot, options);
    const manifest = validateStagedArtifact(stageRoot, options);
    const archive = {
        format: "cratis-fixture-archive-v1",
        entries: manifest.files.map((file) => ({
            path: file.path,
            size: file.size,
            sha256: file.sha256,
            content: readFileSync(join(stageRoot, file.path)).toString(
                "base64",
            ),
        })),
    };
    validateArchiveEntries(archive, options);
    const serialized = `${JSON.stringify(archive, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > preflightLimits.maximumArchiveSize)
        throw new Error("Fixture archive exceeds archive-size policy");
    try {
        writeFileSync(partialPath, serialized, { flag: "wx" });
        renameSync(partialPath, archivePath);
        return manifest;
    } catch (error) {
        if (existsSync(partialPath)) rmSync(partialPath, { force: true });
        throw error;
    }
}

function readFixtureArchive(archivePath, options) {
    const limits = archiveLimits(options);
    const stat = lstatSync(archivePath);
    if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Fixture archive must be a regular file");
    if (stat.size > limits.maximumArchiveSize)
        throw new Error("Fixture archive exceeds archive-size policy");
    const content = readFileSync(archivePath);
    if (content.length > limits.maximumArchiveSize)
        throw new Error("Fixture archive exceeds archive-size policy");
    if (!isUtf8(content))
        throw new Error("Fixture archive must be valid UTF-8 JSON");
    try {
        return JSON.parse(content.toString("utf8"));
    } catch (error) {
        throw new Error(
            `Fixture archive must be valid JSON: ${error.message}`,
            {
                cause: error,
            },
        );
    }
}

export function unpackFixtureArchive(
    archivePath,
    destinationRoot,
    options = {},
) {
    if (existsSync(destinationRoot))
        throw new Error(
            `Archive destination must not already exist: ${destinationRoot}`,
        );
    const archive = readFixtureArchive(archivePath, options);
    const { entries } = validateArchiveEntries(archive, options);
    let destinationCreated = false;
    try {
        mkdirSync(destinationRoot, { recursive: false });
        destinationCreated = true;
        for (const entry of entries) {
            const destination = join(destinationRoot, entry.path);
            assertContained(
                destinationRoot,
                destination,
                `Archive entry ${entry.path}`,
            );
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, entry.content, { flag: "wx" });
        }
        return validateStagedArtifact(destinationRoot, options);
    } catch (error) {
        if (destinationCreated)
            rmSync(destinationRoot, { recursive: true, force: true });
        throw error;
    }
}
