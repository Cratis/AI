#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { passiveHarnesses } from "./harness-registry.mjs";
import { generatePassiveProfileAdapters } from "./passive-profile-adapters.mjs";
import { buildReleaseAssuranceReceipt } from "./release-assurance-validation.mjs";
import { createReleaseContext } from "./release-context.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const profileId = "public-fundamentals";
const targetId = "cratis-fundamentals-concept";
const sourceId = "add-concept";
const artifactId = "cratis-fundamentals-concept-preview";
const packageName = "@cratis/ai-fundamentals";
const requiredSourceRevision = "b53caa555b9a3f05ba1462b86202fe3ccb8a9470";
const requiredSourceContentDigest =
    "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(`Preview asset contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function writeOctal(header, offset, length, value) {
    const encoded = value.toString(8).padStart(length - 1, "0");
    if (encoded.length >= length)
        throw new Error(`Tar numeric value exceeds field size: ${value}`);
    header.write(encoded, offset, length - 1, "ascii");
    header[offset + length - 1] = 0;
}

function splitTarPath(path) {
    if (Buffer.byteLength(path) <= 100) return { name: path, prefix: "" };
    for (
        let index = path.lastIndexOf("/");
        index > 0;
        index = path.lastIndexOf("/", index - 1)
    ) {
        const prefix = path.slice(0, index);
        const name = path.slice(index + 1);
        if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155)
            return { name, prefix };
    }
    throw new Error(`Tar path is too long: ${path}`);
}

function tarHeader(path, size) {
    const header = Buffer.alloc(512, 0);
    const { name, prefix } = splitTarPath(path);
    header.write(name, 0, 100, "utf8");
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, size);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header.write("0", 156, 1, "ascii");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    header.write("Cratis", 265, 32, "ascii");
    header.write("Cratis", 297, 32, "ascii");
    if (prefix) header.write(prefix, 345, 155, "utf8");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const encodedChecksum = checksum.toString(8).padStart(6, "0");
    header.write(encodedChecksum, 148, 6, "ascii");
    header[154] = 0;
    header[155] = 0x20;
    return header;
}

function createTarGzip(root, paths, pathPrefix = "") {
    const chunks = [];
    for (const path of paths) {
        const content = readFileSync(join(root, path));
        const archivePath = pathPrefix ? `${pathPrefix}/${path}` : path;
        chunks.push(tarHeader(archivePath, content.length), content);
        const remainder = content.length % 512;
        if (remainder) chunks.push(Buffer.alloc(512 - remainder, 0));
    }
    chunks.push(Buffer.alloc(1024, 0));
    return gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
}

function parseOctal(buffer) {
    const value = buffer.toString("ascii").replaceAll("\0", "").trim();
    if (!/^[0-7]*$/.test(value)) throw new Error("Tar field is not octal");
    return value ? Number.parseInt(value, 8) : 0;
}

export function readTarGzip(content) {
    const tar = gunzipSync(content);
    const files = new Map();
    let offset = 0;
    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);
        if (header.every((byte) => byte === 0)) break;
        const expectedChecksum = parseOctal(header.subarray(148, 156));
        const checksumHeader = Buffer.from(header);
        checksumHeader.fill(0x20, 148, 156);
        const actualChecksum = checksumHeader.reduce(
            (sum, byte) => sum + byte,
            0,
        );
        if (actualChecksum !== expectedChecksum)
            throw new Error("Tar header checksum mismatch");
        const name = header
            .subarray(0, 100)
            .toString("utf8")
            .replace(/\0.*$/u, "");
        const prefix = header
            .subarray(345, 500)
            .toString("utf8")
            .replace(/\0.*$/u, "");
        const path = prefix ? `${prefix}/${name}` : name;
        if (
            !path ||
            path.startsWith("/") ||
            path.split("/").includes("..") ||
            files.has(path) ||
            header.subarray(156, 157).toString("ascii") !== "0"
        )
            throw new Error(`Unsafe tar entry: ${path}`);
        const size = parseOctal(header.subarray(124, 136));
        const start = offset + 512;
        const end = start + size;
        if (end > tar.length) throw new Error(`Truncated tar entry: ${path}`);
        files.set(path, Buffer.from(tar.subarray(start, end)));
        offset = start + Math.ceil(size / 512) * 512;
    }
    return files;
}

function sourceDigest(paths, contents) {
    const hash = createHash("sha256");
    for (const path of paths) {
        hash.update(path);
        hash.update("\0");
        hash.update(contents.get(path));
        hash.update("\0");
    }
    return hash.digest("hex");
}

function loadPreviewAuthority(repositoryRoot) {
    const context = createReleaseContext({ repositoryRoot });
    const profile = context.require("profileCatalog", profileId);
    const target = context.require("targets", targetId);
    const source = context.require("sources", sourceId);
    const artifact = context.require("artifacts", artifactId);
    if (
        profile?.state !== "preview-source-candidate" ||
        JSON.stringify(profile.availableTargets) !==
            JSON.stringify([targetId]) ||
        target?.approval?.state !== "candidate" ||
        target.includeInRuntime !== false ||
        target.sourceSkillIds.length !== 1 ||
        target.sourceSkillIds[0] !== sourceId ||
        source?.audience !== "public" ||
        source.sourceRevision !== requiredSourceRevision ||
        source.contentDigest !== requiredSourceContentDigest ||
        source.publicationApproval !== false ||
        artifact?.fixtureOnly !== true ||
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== false ||
        JSON.stringify(artifact.componentInventory.skills) !==
            JSON.stringify([targetId]) ||
        JSON.stringify(artifact.exactSourcePaths) !==
            JSON.stringify(source.bundledPaths)
    )
        throw new Error("Fundamentals preview authority changed");
    const contents = new Map(
        source.bundledPaths.map((path) => [
            path,
            execFileSync("git", ["show", `${source.sourceRevision}:${path}`], {
                cwd: repositoryRoot,
            }),
        ]),
    );
    if (sourceDigest(source.bundledPaths, contents) !== source.contentDigest)
        throw new Error("Fundamentals preview immutable source digest changed");
    const prefix = `${source.sourcePath}/`;
    return {
        context,
        profile,
        target,
        source,
        artifact,
        skill: {
            name: targetId,
            files: source.bundledPaths.map((path) => ({
                path: path.slice(prefix.length),
                content: contents.get(path),
            })),
        },
    };
}

export function packageFundamentalsPreviewAssets({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version = "0.1.0-preview.1",
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    if (
        !/^0\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-preview\.(0|[1-9][0-9]*)$/.test(
            version,
        )
    )
        throw new Error(
            "Preview asset version must match 0.MINOR.PATCH-preview.N",
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Preview asset output must not exist: ${root}`);
    const authority = loadPreviewAuthority(repositoryRoot);
    const temporaryRoot = mkdtempSync(
        join(tmpdir(), "cratis-fundamentals-preview-"),
    );
    const stageRoot = join(temporaryRoot, "stage");
    mkdirSync(root, { recursive: false });
    try {
        const adapterManifest = generatePassiveProfileAdapters({
            outputRoot: stageRoot,
            version,
            profileId,
            packageName,
            description: "Cratis Fundamentals concept preview",
            skills: [authority.skill],
            codexInstallationPolicy: "NOT_AVAILABLE",
            piPrivate: true,
        });
        const assets = [];
        for (const harness of passiveHarnesses) {
            const harnessRoot = join(stageRoot, adapterManifest.roots[harness]);
            const paths = walkFiles(harnessRoot).sort();
            const extension = harness === "pi" ? "tgz" : "tar.gz";
            const filename = `cratis-ai-${profileId}-${version}-${harness}.${extension}`;
            const pathPrefix = harness === "pi" ? "package" : "";
            const content = createTarGzip(harnessRoot, paths, pathPrefix);
            const archiveFiles = readTarGzip(content);
            for (const path of paths) {
                const archivePath = pathPrefix ? `${pathPrefix}/${path}` : path;
                if (
                    !archiveFiles.has(archivePath) ||
                    !archiveFiles
                        .get(archivePath)
                        .equals(readFileSync(join(harnessRoot, path)))
                )
                    throw new Error(`${harness}: archive byte parity failed`);
            }
            writeFileSync(join(root, filename), content, { flag: "wx" });
            assets.push({
                harness,
                filename,
                format: "tar+gzip",
                root: adapterManifest.roots[harness],
                size: content.length,
                sha256: sha256(content),
            });
        }
        const deterministicManifestPath = "deterministic-release-manifest.json";
        writeJson(
            join(root, deterministicManifestPath),
            adapterManifest.deterministicManifest,
        );
        const releaseAssetManifestPath = "release-asset-manifest.json";
        const releaseAssetManifest = {
            schemaVersion: "1.0.0",
            state: "DETERMINISTIC_RELEASE_TREE_VALIDATED",
            profileId,
            version,
            files: assets
                .map((asset) => ({
                    path: asset.filename,
                    size: asset.size,
                    sha256: asset.sha256,
                }))
                .sort((left, right) => compareOrdinal(left.path, right.path)),
            fileCount: assets.length,
            totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
            supportGranted: false,
            publicationGranted: false,
            runtimeGranted: false,
            promotionGranted: false,
        };
        writeJson(
            join(root, releaseAssetManifestPath),
            releaseAssetManifest,
        );
        const assuranceReceiptPath = "artifact-assurance-receipt.json";
        writeJson(
            join(root, assuranceReceiptPath),
            buildReleaseAssuranceReceipt({
                artifactClasses: [
                    "passive-skill-package",
                    "passive-native-metadata",
                    "marketplace-index",
                ],
                assurances: [
                    "canonical-parity",
                    "immutable-source",
                    "path-scanning",
                    "secret-scanning",
                    "sha256-inventory",
                ],
                releaseManifest: {
                    path: releaseAssetManifestPath,
                    manifest: releaseAssetManifest,
                },
                policy: authority.context.catalogs.artifactAssurancePolicy,
            }),
        );
        const complianceReceiptPath = "compliance-receipts.json";
        writeJson(
            join(root, complianceReceiptPath),
            adapterManifest.compliance,
        );
        const complianceReceiptSha256 = sha256(
            readFileSync(join(root, complianceReceiptPath)),
        );
        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: repositoryRoot,
            encoding: "utf8",
        }).trim();
        const generatorPaths = [
            "tooling/deterministic-release-tree.mjs",
            "tooling/harness-registry.mjs",
            "tooling/package-fundamentals-preview-assets.mjs",
            "tooling/passive-profile-adapters.mjs",
            "tooling/portable-compliance-validation.mjs",
            "tooling/release-assurance-validation.mjs",
            "tooling/release-context.mjs",
        ];
        const generatorHash = createHash("sha256");
        for (const path of generatorPaths) {
            generatorHash.update(path);
            generatorHash.update("\0");
            generatorHash.update(readFileSync(join(repositoryRoot, path)));
            generatorHash.update("\0");
        }
        const generatorDigest = generatorHash.digest("hex");
        const manifest = {
            schemaVersion: "1.0.0",
            state: "PREVIEW_ASSETS_APPROVAL_PENDING",
            profileId,
            packageName,
            version,
            artifactId,
            targetId,
            sourceId,
            sourcePath: authority.source.sourcePath,
            sourceRevision: authority.source.sourceRevision,
            sourceContentDigest: authority.source.contentDigest,
            sourceCommit,
            generatorPaths,
            generatorDigest,
            assets,
            deterministicReleaseTree: {
                sourceProjectionManifestPath: deterministicManifestPath,
                sourceProjectionManifestSha256: sha256(
                    readFileSync(join(root, deterministicManifestPath)),
                ),
                releaseAssetManifestPath,
                releaseAssetManifestSha256: sha256(
                    readFileSync(join(root, releaseAssetManifestPath)),
                ),
                assuranceReceiptPath,
                assuranceReceiptSha256: sha256(
                    readFileSync(join(root, assuranceReceiptPath)),
                ),
            },
            portableCompliance: {
                profile: adapterManifest.compliance.profile,
                profileDigest: adapterManifest.compliance.profileDigest,
                specifications: adapterManifest.compliance.specifications,
                receiptPath: complianceReceiptPath,
                receiptSha256: complianceReceiptSha256,
                staticValidationInput:
                    adapterManifest.compliance.staticValidationInput,
                approvalGranted: false,
                supportGranted: false,
                publicationGranted: false,
                runtimeGranted: false,
                promotionGranted: false,
            },
            approvalEligible: false,
            installationSupported: false,
            publicationEligible: false,
            promotionEligible: false,
        };
        writeJson(join(root, "preview-assets.json"), manifest);
        writeJson(join(root, "preview-sbom.json"), {
            schemaVersion: "1.0.0",
            format: "cratis-passive-profile-sbom-v1",
            profileId,
            version,
            components: [
                {
                    type: "agent-skill",
                    name: targetId,
                    sourcePath: authority.source.sourcePath,
                    sourceRevision: authority.source.sourceRevision,
                    contentDigest: authority.source.contentDigest,
                    files: authority.source.bundledPaths,
                    license: "MIT",
                },
            ],
            dependencies: [],
            executableComponents: [],
            assets: assets.map((asset) => ({
                harness: asset.harness,
                filename: asset.filename,
                sha256: asset.sha256,
            })),
        });
        const checksumPaths = walkFiles(root).sort();
        writeFileSync(
            join(root, "SHA256SUMS"),
            `${checksumPaths
                .map(
                    (path) =>
                        `${sha256(readFileSync(join(root, path)))}  ${path}`,
                )
                .join("\n")}\n`,
            { flag: "wx" },
        );
        return manifest;
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    const [outputRoot, version] = process.argv.slice(2);
    if (!outputRoot) {
        process.stderr.write(
            "Usage: node tooling/package-fundamentals-preview-assets.mjs <output> [exact-preview-version]\n",
        );
        process.exitCode = 1;
        return;
    }
    const manifest = packageFundamentalsPreviewAssets({
        outputRoot,
        version: version ?? "0.1.0-preview.1",
    });
    process.stdout.write(
        `Packaged ${manifest.assets.length} approval-pending preview assets.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
