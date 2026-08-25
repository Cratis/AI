#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { generatePassiveProfileAdapters } from "../passive-profile-adapters.mjs";
import { createReleaseContext } from "../release-context.mjs";

const repositoryRoot = resolve(
    fileURLToPath(new URL("../..", import.meta.url)),
);

export function benchmarkReleaseGeneration({ concurrency = 1 } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
        throw new Error(
            "Benchmark concurrency must be an integer from 1 through 4",
        );
    const context = createReleaseContext({ repositoryRoot });
    const sourcePaths = [
        "skills/cratis-fundamentals-concept/LICENSE",
        "skills/cratis-fundamentals-concept/SKILL.md",
    ];
    const sourceFiles = sourcePaths.map((path) => ({
        path: path.split("/").slice(2).join("/"),
        content: readFileSync(join(repositoryRoot, path)),
    }));
    const metrics = {
        sourceReads: sourceFiles.length,
        finalReads: 0,
        bytesHashed: 0,
    };
    const temporary = mkdtempSync(join(tmpdir(), "cratis-release-benchmark-"));
    const outputRoot = join(temporary, "candidate");
    const started = performance.now();
    try {
        const manifest = generatePassiveProfileAdapters({
            outputRoot,
            version: "0.0.0-benchmark",
            profileId: "public-fundamentals",
            packageName: "@cratis/ai-fundamentals",
            description: "Deterministic release generation benchmark",
            skills: [
                { name: "cratis-fundamentals-concept", files: sourceFiles },
            ],
            concurrency,
            metrics,
        });
        return {
            schemaVersion: "1.0.0",
            benchmark: "deterministic-release-generation",
            reads: {
                catalogsAndSchemas: context.readCount,
                approvedSources: metrics.sourceReads,
                finalFiles: metrics.finalReads,
                total:
                    context.readCount +
                    metrics.sourceReads +
                    metrics.finalReads,
            },
            bytesHashed: metrics.bytesHashed,
            generationDurationMilliseconds: Number(
                (performance.now() - started).toFixed(3),
            ),
            concurrency: 1,
            requestedConcurrency: concurrency,
            roots: Object.values(manifest.declaredRoots).flat().length,
            filesValidated: manifest.files.length,
            correctnessThresholdMilliseconds: null,
            persistentCacheUsed: false,
        };
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const concurrency = process.argv[2] ? Number(process.argv[2]) : 1;
    const outputPath = process.argv[3];
    const result = benchmarkReleaseGeneration({ concurrency });
    const content = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath) writeFileSync(outputPath, content, { flag: "wx" });
    else process.stdout.write(content);
}
