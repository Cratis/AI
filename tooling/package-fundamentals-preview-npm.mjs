#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
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
import { generatePassiveProfileAdapters } from "./passive-profile-adapters.mjs";
import {
    createTarGzip,
    loadPreviewAuthority,
    readTarGzip,
} from "./package-fundamentals-preview-assets.mjs";
import { buildPreviewReadiness } from "./preview-readiness.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const profileId = "public-fundamentals";
const packageName = "@cratis/ai-fundamentals";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink())
            throw new Error(`Preview npm stage contains a symlink: ${path}`);
        if (stat.isDirectory()) return walkFiles(root, path);
        if (!stat.isFile())
            throw new Error(`Preview npm stage contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

export function materializeFundamentalsPreviewNpmAsset({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version,
    readiness,
    request,
} = {}) {
    if (!outputRoot || !version || !readiness || !request)
        throw new Error("outputRoot, version, readiness, and request are required");
    if (
        readiness.state !== "READY_FOR_PREVIEW_REQUEST" ||
        readiness.assuranceMode !== "basic" ||
        readiness.profileId !== profileId ||
        readiness.packageName !== packageName ||
        readiness.previewRequestEligible !== true ||
        readiness.supportGranted !== false
    )
        throw new Error("Basic preview readiness does not authorize npm staging");
    if (!/^0\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-preview\.(?:0|[1-9][0-9]*)$/.test(version))
        throw new Error("Preview npm version must match 0.MINOR.PATCH-preview.N");
    if (
        request.state !== "preview-on-merge" ||
        request.profileId !== profileId ||
        request.packageName !== packageName ||
        request.version !== version ||
        request.assuranceMode !== "basic" ||
        request.supportClaim !== false
    )
        throw new Error("Preview request does not authorize this npm artifact");
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Preview npm output must not exist: ${root}`);
    const authority = loadPreviewAuthority(repositoryRoot);
    if (
        request.sourceRevision !== authority.source.sourceRevision ||
        request.sourceContentDigest !== authority.source.contentDigest
    )
        throw new Error("Preview request source does not match immutable authority");
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-preview-npm-"));
    const stageRoot = join(temporaryRoot, "stage");
    mkdirSync(root, { recursive: false });
    try {
        const adapters = generatePassiveProfileAdapters({
            outputRoot: stageRoot,
            version,
            profileId,
            packageName,
            description: "Preview of Cratis Fundamentals concept guidance",
            skills: [authority.skill],
            codexInstallationPolicy: "NOT_AVAILABLE",
            piPrivate: false,
        });
        const piRoot = join(stageRoot, adapters.roots.pi);
        const paths = walkFiles(piRoot).sort();
        const packageJson = JSON.parse(
            readFileSync(join(piRoot, "package.json"), "utf8"),
        );
        const allowedPackageFields = [
            "description",
            "files",
            "homepage",
            "keywords",
            "license",
            "name",
            "pi",
            "private",
            "repository",
            "version",
        ];
        const packageFields = Object.keys(packageJson).sort();
        if (
            JSON.stringify(packageFields) !==
                JSON.stringify(allowedPackageFields) ||
            packageJson.name !== packageName ||
            packageJson.version !== version ||
            packageJson.private !== false ||
            packageJson.license !== "MIT" ||
            JSON.stringify(packageJson.repository) !==
                JSON.stringify({
                    type: "git",
                    url: "https://github.com/Cratis/AI",
                }) ||
            packageJson.homepage !== "https://cratis.io/ai" ||
            JSON.stringify(packageJson.files) !== JSON.stringify(["skills"]) ||
            JSON.stringify(packageJson.pi?.skills) !==
                JSON.stringify(["./skills"]) ||
            [
                "scripts",
                "dependencies",
                "devDependencies",
                "optionalDependencies",
                "peerDependencies",
                "bundledDependencies",
                "bundleDependencies",
            ].some((field) => packageJson[field] !== undefined)
        )
            throw new Error("Generated preview npm package metadata is unsafe");
        const filename = `cratis-ai-fundamentals-${version}.tgz`;
        const content = createTarGzip(piRoot, paths, "package");
        const archive = readTarGzip(content);
        for (const path of paths) {
            const archivePath = `package/${path}`;
            if (
                !archive.has(archivePath) ||
                !archive.get(archivePath).equals(readFileSync(join(piRoot, path)))
            )
                throw new Error(`Preview npm archive byte drift: ${path}`);
        }
        writeFileSync(join(root, filename), content, { flag: "wx" });
        const manifest = {
            schemaVersion: 1,
            state: "PASSIVE_PREVIEW_NPM_STAGED",
            profileId,
            packageName,
            version,
            sourceRevision: authority.source.sourceRevision,
            sourceContentDigest: authority.source.contentDigest,
            requestId: request.id,
            filename,
            size: content.length,
            sha256: sha256(content),
            repositoryUrl: packageJson.repository.url,
            lifecycleScripts: false,
            dependencies: false,
            previewPublicationEligible: true,
            supportGranted: false,
            stablePromotionEligible: false,
        };
        writeJson(join(root, "preview-npm-manifest.json"), manifest);
        writeFileSync(
            join(root, "SHA256SUMS"),
            `${manifest.sha256}  ${filename}\n${sha256(
                readFileSync(join(root, "preview-npm-manifest.json")),
            )}  preview-npm-manifest.json\n`,
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

export function packageFundamentalsPreviewNpm({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version,
} = {}) {
    let requests;
    try {
        requests = JSON.parse(
            readFileSync(
                join(repositoryRoot, "distribution/preview-requests.json"),
                "utf8",
            ),
        ).requests;
    } catch (error) {
        throw new Error("Unable to read passive preview requests", {
            cause: error,
        });
    }
    if (!Array.isArray(requests) || requests.length === 0)
        throw new Error("No passive preview request exists");
    return materializeFundamentalsPreviewNpmAsset({
        repositoryRoot,
        outputRoot,
        version,
        readiness: buildPreviewReadiness(repositoryRoot),
        request: requests.at(-1),
    });
}

function main() {
    const [outputRoot, version] = process.argv.slice(2);
    try {
        const manifest = packageFundamentalsPreviewNpm({
            outputRoot,
            version,
        });
        process.stdout.write(
            `Staged ${manifest.packageName}@${manifest.version} for protected preview publication.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Preview npm staging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
