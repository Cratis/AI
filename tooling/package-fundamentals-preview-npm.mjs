#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
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
import { isDeepStrictEqual } from "node:util";
import { compareOrdinal } from "./catalog-ordering.mjs";
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
const profileId = "cratis/fundamentals";
const packageName = "@cratis/ai-fundamentals";
const bundleDescription =
    "Cratis AI skills for building event-sourced and CQRS applications";
const publicSkillsRoot = "skills";

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
            throw new Error(
                `Preview npm stage contains a special file: ${path}`,
            );
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

/**
 * The npm package is the Pi delivery of the whole public skills directory —
 * byte-identical content to what the committed marketplace manifests install
 * for Claude Code, Codex, GitHub Copilot, and Cursor.
 */
export function loadPublicBundleSkills(
    repositoryRoot = defaultRepositoryRoot,
) {
    const root = join(resolve(repositoryRoot), publicSkillsRoot);
    const skills = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareOrdinal)
        .map((name) => {
            const files = walkFiles(join(root, name))
                .sort(compareOrdinal)
                .map((path) => ({
                    path,
                    content: readFileSync(join(root, name, path)),
                }));
            if (!files.some((file) => file.path === "SKILL.md"))
                throw new Error(`Public skill is missing SKILL.md: ${name}`);
            return { name, files };
        });
    if (skills.length === 0)
        throw new Error(`No public skills found under ${publicSkillsRoot}/`);
    return skills;
}

function bundleContentDigest(skills) {
    const hash = createHash("sha256");
    for (const skill of skills) {
        hash.update(skill.name);
        hash.update("\0");
        for (const file of skill.files) {
            hash.update(file.path);
            hash.update("\0");
            hash.update(file.content);
            hash.update("\0");
        }
    }
    return hash.digest("hex");
}

/**
 * The pinned preview authority keeps anchoring the release: the bundled
 * fundamentals concept skill must still be byte-identical to the immutable
 * source revision recorded in the catalog.
 */
function assertAuthorityParity(bundleSkills, authority) {
    const bundled = bundleSkills.find(
        (skill) => skill.name === authority.skill.name,
    );
    if (!bundled)
        throw new Error(
            `Bundled public skills are missing the pinned authority skill: ${authority.skill.name}`,
        );
    const authorityPaths = authority.skill.files
        .map((file) => file.path)
        .sort(compareOrdinal);
    const bundledPaths = bundled.files
        .map((file) => file.path)
        .sort(compareOrdinal);
    if (JSON.stringify(authorityPaths) !== JSON.stringify(bundledPaths))
        throw new Error(
            "Bundled fundamentals concept skill differs from the pinned authority",
        );
    for (const file of authority.skill.files) {
        const bundledFile = bundled.files.find(
            (candidate) => candidate.path === file.path,
        );
        if (!bundledFile || !bundledFile.content.equals(file.content))
            throw new Error(
                "Bundled fundamentals concept skill differs from the pinned authority",
            );
    }
}

function packageReadme(supported) {
    return `<!--
Copyright (c) Cratis. All rights reserved.
Licensed under the MIT license. See LICENSE in this package for full license information.
-->

# @cratis/ai-fundamentals

Passive AI skills for the Cratis ecosystem: the same public skill set the
Cratis marketplace installs deliver, wrapped as a Pi npm package. Fundamentals,
Chronicle, Arc, Components, specifications, reviews, and more arrive as
passive markdown skills — no hooks, no executable code, no MCP server.

## Install

Install globally:

\`\`\`bash
pi install npm:@cratis/ai-fundamentals
\`\`\`

Install it for one trusted project:

\`\`\`bash
pi install -l npm:@cratis/ai-fundamentals
\`\`\`

Try it for one Pi run without changing settings:

\`\`\`bash
pi -e npm:@cratis/ai-fundamentals
\`\`\`

## Update or remove

Update to the latest published release with \`pi install npm:@cratis/ai-fundamentals\`.
Remove the package with \`pi remove npm:@cratis/ai-fundamentals\`.

## Status

${
          supported
              ? `This is a supported stable release. Review skill instructions before use.`
              : `This \`0.x\` package is an unsupported evaluation release. Packaging, provenance,
and lifecycle checks do not grant a support claim. Review skill instructions before use.`
      }
`;
}

export function materializeFundamentalsPreviewNpmAsset({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version,
    readiness,
    request,
} = {}) {
    if (!outputRoot || !version || !readiness || !request)
        throw new Error(
            "outputRoot, version, readiness, and request are required",
        );
    if (
        readiness.state !== "READY_FOR_PREVIEW_REQUEST" ||
        readiness.assuranceMode !== "basic" ||
        readiness.profileId !== profileId ||
        readiness.packageName !== packageName ||
        readiness.previewRequestEligible !== true ||
        readiness.supportGranted !== true
    )
        throw new Error(
            "Basic preview readiness does not authorize npm staging",
        );
    const isPreview = version.includes("-preview.");
    // The preview lane stays on 0.x; the release lane ships stable 1.0.0+.
    const versionPattern = isPreview
        ? /^0\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-preview\.(?:0|[1-9][0-9]*)$/
        : /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/;
    if (!versionPattern.test(version))
        throw new Error(
            "npm version must match MAJOR.MINOR.PATCH for a release or 0.MINOR.PATCH-preview.N for a preview",
        );
    if (
        request.state !==
            (isPreview ? "preview-on-merge" : "release-on-merge") ||
        request.profileId !== profileId ||
        request.packageName !== packageName ||
        request.version !== version ||
        request.assuranceMode !== "basic" ||
        request.supportClaim !== !isPreview
    )
        throw new Error("Release input does not authorize this npm artifact");
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Preview npm output must not exist: ${root}`);
    const authority = loadPreviewAuthority(repositoryRoot);
    const repositoryUrl =
        authority.context.catalogs.profileCatalog.sourceRepository;
    const homepage = authority.context.catalogs.profileCatalog.homepage;
    if (
        request.sourceRevision !== authority.source.sourceRevision ||
        request.sourceContentDigest !== authority.source.contentDigest
    )
        throw new Error(
            "Preview request source does not match immutable authority",
        );
    const bundleSkills = loadPublicBundleSkills(repositoryRoot);
    assertAuthorityParity(bundleSkills, authority);
    const digest = bundleContentDigest(bundleSkills);
    const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repositoryRoot,
        encoding: "utf8",
    }).trim();
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-preview-npm-"));
    const stageRoot = join(temporaryRoot, "stage");
    mkdirSync(root, { recursive: false });
    try {
        const adapters = generatePassiveProfileAdapters({
            outputRoot: stageRoot,
            version,
            profileId,
            packageName,
            description: bundleDescription,
            skills: bundleSkills,
            codexInstallationPolicy: "NOT_AVAILABLE",
            piPrivate: false,
        });
        const piRoot = join(stageRoot, adapters.roots.pi);
        writeFileSync(
            join(piRoot, "README.md"),
            packageReadme(request.supportClaim),
            {
            flag: "wx",
        });
        const paths = walkFiles(piRoot).sort();
        const packageJson = JSON.parse(
            readFileSync(join(piRoot, "package.json"), "utf8"),
        );
        const expectedPackageJson = {
            name: packageName,
            version,
            description: bundleDescription,
            private: false,
            license: "MIT",
            repository: {
                type: "git",
                url: repositoryUrl,
            },
            homepage,
            files: ["skills"],
            keywords: ["pi-package", "cratis"],
            pi: {
                skills: ["./skills"],
            },
        };
        if (!isDeepStrictEqual(packageJson, expectedPackageJson))
            throw new Error("Generated npm package metadata is unsafe");
        const filename = `cratis-ai-fundamentals-${version}.tgz`;
        const content = createTarGzip(piRoot, paths, "package");
        const archive = readTarGzip(content);
        for (const path of paths) {
            const archivePath = `package/${path}`;
            if (
                !archive.has(archivePath) ||
                !archive
                    .get(archivePath)
                    .equals(readFileSync(join(piRoot, path)))
            )
                throw new Error(`npm archive byte drift: ${path}`);
        }
        writeFileSync(join(root, filename), content, { flag: "wx" });
        const manifest = {
            schemaVersion: 1,
            state: "PASSIVE_NPM_STAGED",
            profileId,
            packageName,
            version,
            sourceRevision: authority.source.sourceRevision,
            sourceContentDigest: authority.source.contentDigest,
            sourceCommit,
            bundledSkillCount: bundleSkills.length,
            bundledSkillIds: bundleSkills.map((skill) => skill.name),
            bundleContentDigest: digest,
            requestId: request.id,
            filename,
            size: content.length,
            sha256: sha256(content),
            repositoryUrl: packageJson.repository.url,
            lifecycleScripts: false,
            dependencies: false,
            distTag: isPreview ? "preview" : "latest",
            publicationEligible: true,
            previewPublicationEligible: isPreview,
            supportGranted: request.supportClaim,
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

export function packageFundamentalsNpmRelease({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version,
} = {}) {
    const authority = loadPreviewAuthority(repositoryRoot);
    return materializeFundamentalsPreviewNpmAsset({
        repositoryRoot,
        outputRoot,
        version,
        readiness: buildPreviewReadiness(repositoryRoot),
        request: {
            id: `cratis-fundamentals-${version.replaceAll(".", "-")}`,
            state: "release-on-merge",
            profileId,
            packageName,
            version,
            sourceRevision: authority.source.sourceRevision,
            sourceContentDigest: authority.source.contentDigest,
            assuranceMode: "basic",
            supportClaim: true,
        },
    });
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
    const [outputRoot, version, mode = "preview"] = process.argv.slice(2);
    try {
        const manifest =
            mode === "release"
                ? packageFundamentalsNpmRelease({ outputRoot, version })
                : packageFundamentalsPreviewNpm({ outputRoot, version });
        process.stdout.write(
            `Staged ${manifest.packageName}@${manifest.version} for npm publication.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "npm staging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
