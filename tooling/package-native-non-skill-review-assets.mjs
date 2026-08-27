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
import { buildCandidateComponentCoverage } from "./candidate-component-coverage.mjs";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { generateNativeNonSkillProjectionFixture } from "./native-non-skill-projections.mjs";
import {
    createTarGzip,
    readTarGzip,
} from "./package-fundamentals-preview-assets.mjs";

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
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(`Native review asset contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

export function packageNativeNonSkillReviewAssets({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version = "0.0.1-candidate.1",
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    if (!candidateVersionPattern.test(version))
        throw new Error(
            "Native review version must match 0.0.N-candidate.N",
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Native review output must not exist: ${root}`);
    const temporaryRoot = mkdtempSync(
        join(tmpdir(), "cratis-native-non-skill-review-"),
    );
    const stageRoot = join(temporaryRoot, "stage");
    mkdirSync(root, { recursive: false });
    try {
        const generated = generateNativeNonSkillProjectionFixture(
            stageRoot,
            repositoryRoot,
        );
        const coverage = buildCandidateComponentCoverage(repositoryRoot);
        const projectedComponentIds = new Set(
            generated.receipt.projections.map(
                (projection) => projection.componentId,
            ),
        );
        const componentRecords = coverage.records.filter((record) =>
            projectedComponentIds.has(record.componentId),
        );
        const componentExclusions = coverage.records
            .filter(
                (record) =>
                    ["rule", "instruction"].includes(record.kind) &&
                    !projectedComponentIds.has(record.componentId),
            )
            .map((record) => ({
                componentId: record.componentId,
                kind: record.kind,
                reason: record.reason,
            }));
        if (
            componentRecords.length !== 35 ||
            componentExclusions.length !== 2
        ) {
            throw new Error("Native review component accounting changed");
        }
        const assets = [];
        for (const candidate of generated.receipt.roots) {
            const nativeRoot = join(stageRoot, candidate.outputRoot);
            const paths = walkFiles(nativeRoot).sort(compareOrdinal);
            const filename =
                `cratis-ai-native-${candidate.id}-${version}.tar.gz`;
            const content = createTarGzip(nativeRoot, paths);
            const archiveFiles = readTarGzip(content);
            for (const path of paths) {
                if (
                    !archiveFiles.has(path) ||
                    !archiveFiles
                        .get(path)
                        .equals(readFileSync(join(nativeRoot, path)))
                ) {
                    throw new Error(
                        `${candidate.id}: native archive byte parity failed`,
                    );
                }
            }
            writeFileSync(join(root, filename), content, { flag: "wx" });
            assets.push({
                rootId: candidate.id,
                filename,
                format: "tar+gzip",
                fileCount: paths.length,
                size: content.length,
                sha256: sha256(content),
                packageIdentity: null,
                hostActivation: "none",
            });
        }
        writeJson(join(root, "projection-receipt.json"), generated.receipt);
        writeJson(join(root, "component-coverage.json"), coverage);
        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: repositoryRoot,
            encoding: "utf8",
        }).trim();
        const manifestSchemaPath =
            "distribution/native-non-skill-review-assets.schema.json";
        const manifest = {
            schemaVersion: "1.0.0",
            schemaPath: manifestSchemaPath,
            schemaSha256: sha256(
                readFileSync(join(repositoryRoot, manifestSchemaPath)),
            ),
            state: "NATIVE_NON_SKILL_REVIEW_ONLY",
            version,
            sourceRepository: "https://github.com/Cratis/AI",
            sourceCommit,
            generatedBy:
                "tooling/package-native-non-skill-review-assets.mjs",
            rootCount: generated.receipt.rootCount,
            projectedFileCount: generated.receipt.fileCount,
            projectedComponentCount: componentRecords.length,
            componentExclusions,
            assets,
            projectionReceiptPath: "projection-receipt.json",
            projectionReceiptSha256: sha256(
                readFileSync(join(root, "projection-receipt.json")),
            ),
            componentCoveragePath: "component-coverage.json",
            componentCoverageSha256: sha256(
                readFileSync(join(root, "component-coverage.json")),
            ),
            approvalEligible: false,
            installationSupported: false,
            packageIdentity: null,
            publicationEligible: false,
            runtimeEligible: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "native-review-assets.json"), manifest);
        writeJson(join(root, "native-review-sbom.json"), {
            schemaVersion: "1.0.0",
            format: "cratis-native-non-skill-review-sbom-v1",
            version,
            components: componentRecords.map((record) => ({
                type: record.kind,
                name: record.componentId,
                disposition: record.disposition,
                generatedStaticProjectionCount:
                    record.generatedStaticProjectionCount,
            })),
            componentExclusions,
            dependencies: [],
            executableComponents: [],
            assets: assets.map((asset) => ({
                rootId: asset.rootId,
                filename: asset.filename,
                sha256: asset.sha256,
            })),
        });
        writeFileSync(
            join(root, "REVIEW.md"),
            `# Native non-skill review snapshots\n\n` +
                `- Version: \`${version}\`\n` +
                `- Projected components: ${componentRecords.length}\n` +
                `- Excluded components: ${componentExclusions.length}\n` +
                `- Native roots: ${assets.length}\n\n` +
                `These repository-only snapshots validate static rule and ` +
                `instruction layouts. They are not installable packages, ` +
                `host behavior evidence, marketplace listings, or support.\n`,
            { flag: "wx" },
        );
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
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    const [outputRoot, version] = process.argv.slice(2);
    try {
        const manifest = packageNativeNonSkillReviewAssets({
            outputRoot,
            version: version ?? "0.0.1-candidate.1",
        });
        process.stdout.write(
            `Packaged ${manifest.projectedComponentCount} native non-skill ` +
                `components into ${manifest.assets.length} review snapshots.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Native review packaging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
