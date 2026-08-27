#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { readTarGzip } from "./package-fundamentals-preview-assets.mjs";

const requiredMetadata = Object.freeze([
    "artifact-assurance-receipt.json",
    "compliance-receipts.json",
    "deterministic-release-manifest.json",
    "provenance.json",
    "release-instructions.md",
    "release-manifest.json",
    "support-matrix.json",
]);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function walk(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        return entry.isDirectory()
            ? walk(root, path)
            : [relative(root, path).replaceAll("\\", "/")];
    });
}

function inventory(root) {
    return walk(root)
        .sort(compareOrdinal)
        .map((path) => {
            const content = readFileSync(join(root, path));
            return { path, size: content.length, sha256: sha256(content) };
        });
}

function assertArchiveEqualsRoot(archivePath, root, prefix = "") {
    const archive = readTarGzip(readFileSync(archivePath));
    const expected = inventory(root);
    const expectedPaths = expected.map((file) =>
        prefix ? `${prefix}/${file.path}` : file.path,
    );
    const actualPaths = [...archive.keys()].sort(compareOrdinal);
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths))
        throw new Error(
            `Release archive inventory differs from ${basename(root)}`,
        );
    for (const file of expected) {
        const archivePathName = prefix ? `${prefix}/${file.path}` : file.path;
        const content = archive.get(archivePathName);
        if (
            !content ||
            content.length !== file.size ||
            sha256(content) !== file.sha256
        )
            throw new Error(`Release archive byte mismatch: ${archivePathName}`);
    }
}

function assertMetadataEqualsCandidate(candidateRoot, assetsRoot) {
    for (const path of requiredMetadata) {
        const source = join(candidateRoot, path);
        const asset = join(assetsRoot, path);
        if (!existsSync(source) || !existsSync(asset))
            throw new Error(`Required release metadata is missing: ${path}`);
        if (!readFileSync(source).equals(readFileSync(asset)))
            throw new Error(`Release metadata differs from candidate: ${path}`);
    }
}

export function finalizeApprovedProfileAssets({
    candidateRoot,
    assetsRoot,
    profileId,
    version,
}) {
    const candidate = resolve(candidateRoot);
    const assets = resolve(assetsRoot);
    const harnessRoot = join(candidate, "harnesses");
    const harnesses = readdirSync(harnessRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareOrdinal);
    if (harnesses.length === 0)
        throw new Error("Approved profile candidate has no harness roots");

    const piArchives = readdirSync(assets)
        .filter((path) => path.endsWith(".tgz"))
        .sort(compareOrdinal);
    if (piArchives.length !== 1)
        throw new Error("Release assets require exactly one Pi npm archive");

    for (const harness of harnesses) {
        const root = join(harnessRoot, harness);
        if (harness === "pi") {
            assertArchiveEqualsRoot(join(assets, piArchives[0]), root, "package");
            continue;
        }
        const archive = join(
            assets,
            `cratis-ai-${profileId}-${version}-${harness}.tar.gz`,
        );
        if (!existsSync(archive))
            throw new Error(`Release archive is missing for ${harness}`);
        assertArchiveEqualsRoot(archive, root);
    }
    assertMetadataEqualsCandidate(candidate, assets);

    const allowedBeforeManifest = new Set([
        ...harnesses.map((harness) =>
            harness === "pi"
                ? piArchives[0]
                : `cratis-ai-${profileId}-${version}-${harness}.tar.gz`,
        ),
        ...requiredMetadata,
    ]);
    const actualBeforeManifest = walk(assets).sort(compareOrdinal);
    if (
        JSON.stringify(actualBeforeManifest) !==
        JSON.stringify([...allowedBeforeManifest].sort(compareOrdinal))
    )
        throw new Error("Release assets contain an undeclared file");

    const files = inventory(assets);
    const verifierPath = fileURLToPath(import.meta.url);
    const releaseManifest = {
        schemaVersion: "1.0.0",
        state: "APPROVED_PROFILE_RELEASE_ASSETS_VALIDATED",
        profileId,
        version,
        harnesses,
        candidateProvenanceSha256: sha256(
            readFileSync(join(candidate, "provenance.json")),
        ),
        candidateReleaseManifestSha256: sha256(
            readFileSync(join(candidate, "release-manifest.json")),
        ),
        verifier: {
            path: "tooling/verify-approved-profile-assets.mjs",
            sha256: sha256(readFileSync(verifierPath)),
        },
        files,
        fileCount: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        supportGranted: false,
        publicationGranted: false,
        runtimeGranted: false,
        promotionGranted: false,
    };
    const manifestPath = join(assets, "release-assets-manifest.json");
    writeFileSync(manifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, {
        flag: "wx",
    });
    const checksumFiles = inventory(assets);
    writeFileSync(
        join(assets, "SHA256SUMS"),
        `${checksumFiles
            .map((file) => `${file.sha256}  ${file.path}`)
            .join("\n")}\n`,
        { flag: "wx" },
    );

    const finalPaths = walk(assets).sort(compareOrdinal);
    const expectedFinalPaths = [
        ...files.map((file) => file.path),
        "release-assets-manifest.json",
        "SHA256SUMS",
    ].sort(compareOrdinal);
    if (JSON.stringify(finalPaths) !== JSON.stringify(expectedFinalPaths))
        throw new Error("Final release asset inventory differs from its manifest");
    for (const line of readFileSync(join(assets, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n")) {
        const match = /^([a-f0-9]{64}) {2}(.+)$/u.exec(line);
        if (!match || sha256(readFileSync(join(assets, match[2]))) !== match[1])
            throw new Error(`Release asset checksum mismatch: ${line}`);
    }
    return releaseManifest;
}

function main() {
    const [candidateRoot, assetsRoot, profileId, version] = process.argv.slice(2);
    if (!candidateRoot || !assetsRoot || !profileId || !version) {
        process.stderr.write(
            "Usage: node tooling/verify-approved-profile-assets.mjs <candidate-root> <assets-root> <profile-id> <version>\n",
        );
        process.exitCode = 1;
        return;
    }
    const result = finalizeApprovedProfileAssets({
        candidateRoot,
        assetsRoot,
        profileId,
        version,
    });
    process.stdout.write(
        `Verified ${result.fileCount} immutable release assets across ${result.harnesses.length} harnesses.\n`,
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    main();
