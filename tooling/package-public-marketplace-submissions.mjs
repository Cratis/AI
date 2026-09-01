#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const pluginName = "public-cratis-ai";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read JSON: ${path}`, { cause: error });
    }
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

export function packagePublicMarketplaceSubmissions({
    marketplaceRoot,
    outputRoot,
} = {}) {
    if (!marketplaceRoot || !existsSync(marketplaceRoot))
        throw new Error("marketplaceRoot must exist");
    if (!outputRoot) throw new Error("outputRoot is required");
    const sourceRoot = resolve(marketplaceRoot);
    const root = resolve(outputRoot);
    if (existsSync(root)) throw new Error(`Submission output already exists: ${root}`);
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-submission-"));
    mkdirSync(root, { recursive: false });
    try {
        const release = readJson(join(sourceRoot, "marketplace-release.json"));
        const openAi = readJson(join(sourceRoot, "submissions/openai.json"));
        const cursor = readJson(join(sourceRoot, "submissions/cursor.json"));
        if (
            release.state !== "PUBLIC_EVALUATION_MARKETPLACE" ||
            openAi.submissionType !== "skills-only" ||
            openAi.positiveTests?.length < 5 ||
            openAi.negativeTests?.length < 3 ||
            openAi.portalReadiness !==
                "OWNER_IDENTITY_AND_LEGAL_METADATA_REQUIRED" ||
            !Array.isArray(openAi.requiredOwnerInputs) ||
            openAi.requiredOwnerInputs.length === 0 ||
            openAi.supportGranted !== false ||
            cursor.supportGranted !== false
        )
            throw new Error("Marketplace submission metadata is incomplete");
        const pluginRoot = join(temporaryRoot, pluginName);
        mkdirSync(pluginRoot, { recursive: true });
        cpSync(
            join(sourceRoot, `plugins/${pluginName}/.codex-plugin`),
            join(pluginRoot, ".codex-plugin"),
            { recursive: true, errorOnExist: true },
        );
        cpSync(
            join(sourceRoot, `plugins/${pluginName}/skills`),
            join(pluginRoot, "skills"),
            { recursive: true, errorOnExist: true },
        );
        cpSync(
            join(sourceRoot, `plugins/${pluginName}/assets`),
            join(pluginRoot, "assets"),
            { recursive: true, errorOnExist: true },
        );
        cpSync(join(sourceRoot, "LICENSE"), join(pluginRoot, "LICENSE"), {
            errorOnExist: true,
        });
        cpSync(join(sourceRoot, "README.md"), join(pluginRoot, "README.md"), {
            errorOnExist: true,
        });
        const archiveName = `${pluginName}-${release.version}-openai.zip`;
        const archivePath = join(root, archiveName);
        const python = String.raw`
import os, pathlib, stat, sys, zipfile
source = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
base = source.parent
files = sorted(path for path in source.rglob('*') if path.is_file())
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        relative = path.relative_to(base).as_posix()
        info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
`;
        execFileSync("python3", ["-c", python, pluginRoot, archivePath], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        const archive = readFileSync(archivePath);
        const manifest = {
            schemaVersion: "1.0.0",
            state: "VENDOR_PORTAL_HANDOFF_PREPARED",
            version: release.version,
            sourceCommit: release.sourceCommit,
            openAi: {
                archive: archiveName,
                sha256: sha256(archive),
                pluginRoot: pluginName,
                positiveTestCount: openAi.positiveTests.length,
                negativeTestCount: openAi.negativeTests.length,
                interactivePortalRequired: true,
                ownerMetadataRequired: true,
                requiredOwnerInputs: openAi.requiredOwnerInputs,
                reviewRequired: true,
            },
            cursor: {
                repository: cursor.repository,
                pluginManifest: cursor.pluginManifest,
                interactivePortalRequired: true,
                reviewRequired: true,
            },
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "vendor-portal-handoff.json"), manifest);
        writeFileSync(
            join(root, "SHA256SUMS"),
            `${manifest.openAi.sha256}  ${archiveName}\n${sha256(
                readFileSync(join(root, "vendor-portal-handoff.json")),
            )}  vendor-portal-handoff.json\n`,
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
    const [marketplaceRoot, outputRoot] = process.argv.slice(2);
    try {
        const result = packagePublicMarketplaceSubmissions({
            marketplaceRoot,
            outputRoot,
        });
        process.stdout.write(
            `Packaged OpenAI and Cursor portal handoffs for ${result.version}.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Submission packaging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
