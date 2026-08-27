#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { packageNativeNonSkillReviewAssets } from "./package-native-non-skill-review-assets.mjs";
import { packagePassiveCandidateAssets } from "./package-passive-candidate-assets.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const candidateVersionPattern =
    /^0\.0\.(?:0|[1-9][0-9]*)-candidate\.(?:0|[1-9][0-9]*)$/;

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink())
            throw new Error(`Candidate batch contains a symlink: ${path}`);
        if (stat.isDirectory()) return walkFiles(root, path);
        if (!stat.isFile())
            throw new Error(`Candidate batch contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function rootRecord(root, id, path, manifestPath) {
    const absoluteRoot = join(root, path);
    const files = walkFiles(absoluteRoot).sort(compareOrdinal);
    return {
        id,
        path,
        manifestPath,
        manifestSha256: sha256(
            readFileSync(join(absoluteRoot, manifestPath)),
        ),
        fileCount: files.length,
    };
}

export function packageCandidateReviewBatch({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version = "0.0.1-candidate.1",
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    if (!candidateVersionPattern.test(version))
        throw new Error(
            "Candidate batch version must match 0.0.N-candidate.N",
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Candidate batch output must not exist: ${root}`);
    mkdirSync(root, { recursive: false });
    try {
        const publicManifest = packagePassiveCandidateAssets({
            repositoryRoot,
            artifactId: "candidate-passive-public-package",
            outputRoot: join(root, "public"),
            version,
        });
        const engineeringManifest = packagePassiveCandidateAssets({
            repositoryRoot,
            artifactId: "candidate-passive-engineering-package",
            outputRoot: join(root, "engineering"),
            version,
        });
        const nativeManifest = packageNativeNonSkillReviewAssets({
            repositoryRoot,
            outputRoot: join(root, "native-non-skill"),
            version,
        });
        if (
            publicManifest.sourceCommit !== engineeringManifest.sourceCommit ||
            publicManifest.sourceCommit !== nativeManifest.sourceCommit ||
            publicManifest.componentCoverageSha256 !==
                engineeringManifest.componentCoverageSha256 ||
            publicManifest.componentCoverageSha256 !==
                nativeManifest.componentCoverageSha256
        ) {
            throw new Error("Candidate batch source or component closure differs");
        }
        const roots = [
            rootRecord(root, "public", "public", "candidate-assets.json"),
            rootRecord(
                root,
                "engineering",
                "engineering",
                "candidate-assets.json",
            ),
            rootRecord(
                root,
                "native-non-skill",
                "native-non-skill",
                "native-review-assets.json",
            ),
        ];
        const schemaPath = "distribution/candidate-review-batch.schema.json";
        const manifest = {
            schemaVersion: "1.0.0",
            schemaPath,
            schemaSha256: sha256(
                readFileSync(join(repositoryRoot, schemaPath)),
            ),
            state: "CANDIDATE_REVIEW_BATCH_ONLY",
            version,
            sourceCommit: publicManifest.sourceCommit,
            componentCount: 137,
            packagedSkillTargetCount:
                publicManifest.targetIds.length +
                engineeringManifest.targetIds.length,
            blockedSkillTargetCount:
                publicManifest.targetExclusions.length +
                engineeringManifest.targetExclusions.length,
            repositoryOnlyLegacySkillCount:
                publicManifest.repositoryOnlySkillExclusions.length +
                engineeringManifest.repositoryOnlySkillExclusions.length,
            nativeProjectedComponentCount:
                nativeManifest.projectedComponentCount,
            nativeUnprojectedComponentCount:
                nativeManifest.componentExclusions.length,
            skillAssetCount:
                publicManifest.assets.length + engineeringManifest.assets.length,
            nativeAssetCount: nativeManifest.assets.length,
            roots,
            componentCoverageSha256:
                publicManifest.componentCoverageSha256,
            approvalEligible: false,
            installationSupported: false,
            publicationEligible: false,
            runtimeEligible: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "candidate-batch.json"), manifest);
        const checksumPaths = walkFiles(root).sort(compareOrdinal);
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
    }
}

function main() {
    const [outputRoot, version] = process.argv.slice(2);
    try {
        const manifest = packageCandidateReviewBatch({
            outputRoot,
            version: version ?? "0.0.1-candidate.1",
        });
        process.stdout.write(
            `Packaged candidate review batch ${manifest.version} from ` +
                `${manifest.sourceCommit}.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Candidate batch packaging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
