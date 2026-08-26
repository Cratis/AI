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
import { compareOrdinal } from "./catalog-ordering.mjs";
import { passiveHarnesses } from "./harness-registry.mjs";
import {
    generatePassiveProfileAdapters,
    readSkillFrontmatter,
} from "./passive-profile-adapters.mjs";
import {
    createTarGzip,
    readTarGzip,
} from "./package-fundamentals-preview-assets.mjs";
import { parseAgentSkillFrontmatter } from "./portable-compliance-validation.mjs";
import { buildReleaseAssuranceReceipt } from "./release-assurance-validation.mjs";
import { createReleaseContext } from "./release-context.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export const passiveCandidateConfigurations = Object.freeze({
    "candidate-passive-public-package": Object.freeze({
        audience: "public",
        bundleId: "public-all-candidate",
        packageName: "@cratis/ai-public-candidate",
        description:
            "Non-publishable review bundle of every currently modeled public-safe passive Cratis skill candidate.",
    }),
    "candidate-passive-engineering-package": Object.freeze({
        audience: "cratis-engineering",
        bundleId: "engineering-all-candidate",
        packageName: "@cratis/ai-engineering-candidate",
        description:
            "Non-publishable review bundle of every currently modeled public-safe passive Cratis engineering skill candidate.",
    }),
});

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
            throw new Error(`Candidate asset contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
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

function immutableSkill(repositoryRoot, source) {
    const contents = new Map(
        source.bundledPaths.map((path) => [
            path,
            execFileSync("git", ["show", `${source.sourceRevision}:${path}`], {
                cwd: repositoryRoot,
            }),
        ]),
    );
    if (sourceDigest(source.bundledPaths, contents) !== source.contentDigest)
        throw new Error(`${source.id}: immutable source digest changed`);
    const prefix = `${source.sourcePath}/`;
    const sourceFiles = source.bundledPaths.map((path) => {
        if (!path.startsWith(prefix))
            throw new Error(`${source.id}: bundled path escaped source root`);
        return {
            sourcePath: path,
            path: path.slice(prefix.length),
            content: contents.get(path),
        };
    });
    const files = sourceFiles.filter((file) =>
        /^(?:SKILL\.md|LICENSE[^/]*|references\/.+|assets\/.+)$/.test(
            file.path,
        ),
    );
    const skillFile = files.find((file) => file.path === "SKILL.md");
    if (!skillFile) throw new Error(`${source.id}: immutable source has no SKILL.md`);
    const parsed = parseAgentSkillFrontmatter(skillFile.content, {
        path: `${source.sourcePath}/SKILL.md`,
    });
    if (
        parsed.diagnostics.length > 0 ||
        typeof parsed.frontmatter.name !== "string"
    ) {
        throw new Error(`${source.id}: immutable source frontmatter is invalid`);
    }
    readSkillFrontmatter(skillFile.content, parsed.frontmatter.name);
    return {
        name: parsed.frontmatter.name,
        files: files.map(({ path, content }) => ({ path, content })),
        packagedSourcePaths: files.map((file) => file.sourcePath),
        excludedSourcePaths: sourceFiles
            .filter((file) => !files.includes(file))
            .map((file) => file.sourcePath),
    };
}

export function loadPassiveCandidateAuthority(
    repositoryRoot,
    artifactId,
) {
    const configuration = passiveCandidateConfigurations[artifactId];
    if (!configuration)
        throw new Error(`Unknown passive candidate artifact: ${artifactId}`);
    const context = createReleaseContext({ repositoryRoot });
    const artifact = context.require("artifacts", artifactId);
    if (
        artifact.materializationClass !== "review-candidate" ||
        artifact.fixtureOnly !== false ||
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== false ||
        artifact.requiresApprovedTargets !== false ||
        artifact.audience !== configuration.audience
    ) {
        throw new Error(`${artifactId}: passive candidate authority changed`);
    }
    for (const [kind, ids] of Object.entries(artifact.componentInventory)) {
        if (kind !== "skills" && ids.length > 0)
            throw new Error(`${artifactId}: candidate contains non-skill components`);
    }
    const targetIds = [...artifact.componentInventory.skills].sort(
        compareOrdinal,
    );
    if (targetIds.length === 0)
        throw new Error(`${artifactId}: candidate contains no targets`);
    const targets = targetIds.map((targetId) =>
        context.require("targets", targetId),
    );
    for (const target of targets) {
        if (
            target.audience !== configuration.audience ||
            target.lifecycle !== "candidate" ||
            target.approval?.state !== "candidate" ||
            target.includeInRuntime !== false ||
            target.trust?.class !== "passive" ||
            target.sourceSkillIds.length === 0
        ) {
            throw new Error(`${target.id}: target is not a passive review candidate`);
        }
    }
    const sourceIds = [
        ...new Set(targets.flatMap((target) => target.sourceSkillIds)),
    ].sort(compareOrdinal);
    const sources = sourceIds.map((sourceId) =>
        context.require("sources", sourceId),
    );
    for (const source of sources) {
        if (
            source.audience !== configuration.audience ||
            !/^[0-9a-f]{40}$/.test(source.sourceRevision) ||
            !/^[0-9a-f]{64}$/.test(source.contentDigest) ||
            source.publicationApproval !== false ||
            source.bundledPaths.length === 0
        ) {
            throw new Error(`${source.id}: source is not candidate-safe`);
        }
    }
    const exactSourcePaths = [
        ...new Set(sources.flatMap((source) => source.bundledPaths)),
    ].sort(compareOrdinal);
    if (
        JSON.stringify(exactSourcePaths) !==
        JSON.stringify([...artifact.exactSourcePaths].sort(compareOrdinal))
    ) {
        throw new Error(`${artifactId}: exact source inventory changed`);
    }
    const skills = sources.map((source) =>
        immutableSkill(repositoryRoot, source),
    );
    if (new Set(skills.map((skill) => skill.name)).size !== skills.length)
        throw new Error(`${artifactId}: canonical skill names are not unique`);
    return {
        context,
        configuration,
        artifact,
        targets,
        sources,
        skills,
    };
}

function reviewNotice(authority, version) {
    return `# Passive candidate review bundle\n\n` +
        `Artifact: \`${authority.artifact.id}\`  \n` +
        `Version: \`${version}\`  \n` +
        `Packaged targets: ${authority.targets.length}  \n` +
        `Excluded targets: ${authority.artifact.targetExclusions.length}  \n` +
        `Canonical skills: ${authority.skills.length}\n\n` +
        `This deterministic bundle exists for static review only. It is not an ` +
        `installation recommendation, supported package, release, marketplace ` +
        `listing, runtime approval, or publication grant.\n`;
}

function targetReviewRecord(target) {
    return {
        targetId: target.id,
        sourceSkillIds: target.sourceSkillIds,
        capabilityKind: target.capabilityKind,
        trustClass: target.trust.class,
        trustAssessmentState: target.trust.assessmentState,
        securityDisposition: target.security.disposition,
        evaluationStates: Object.fromEntries(
            Object.entries(target.evaluations).map(([name, evaluation]) => [
                name,
                evaluation.status,
            ]),
        ),
        approvalState: target.approval.state,
        runtimeIncluded: target.includeInRuntime,
    };
}

export function packagePassiveCandidateAssets({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    artifactId,
    version = "0.0.1-candidate.1",
} = {}) {
    if (!outputRoot || !artifactId)
        throw new Error("outputRoot and artifactId are required");
    if (!candidateVersionPattern.test(version))
        throw new Error(
            "Passive candidate version must match 0.0.N-candidate.N",
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Passive candidate output must not exist: ${root}`);
    const authority = loadPassiveCandidateAuthority(
        repositoryRoot,
        artifactId,
    );
    const temporaryRoot = mkdtempSync(
        join(tmpdir(), "cratis-passive-candidate-"),
    );
    const stageRoot = join(temporaryRoot, "stage");
    mkdirSync(root, { recursive: false });
    try {
        const adapterManifest = generatePassiveProfileAdapters({
            outputRoot: stageRoot,
            version,
            profileId: authority.configuration.bundleId,
            packageName: authority.configuration.packageName,
            description: authority.configuration.description,
            skills: authority.skills,
            codexInstallationPolicy: "NOT_AVAILABLE",
            piPrivate: true,
        });
        const assets = [];
        for (const harness of passiveHarnesses) {
            const harnessRoot = join(stageRoot, adapterManifest.roots[harness]);
            const paths = walkFiles(harnessRoot).sort(compareOrdinal);
            const extension = harness === "pi" ? "tgz" : "tar.gz";
            const filename =
                `cratis-ai-${authority.configuration.bundleId}-${version}-` +
                `${harness}.${extension}`;
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
                ) {
                    throw new Error(`${harness}: candidate archive byte parity failed`);
                }
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
        const assetManifestPath = "candidate-asset-manifest.json";
        const assetManifest = {
            schemaVersion: "1.0.0",
            state: "DETERMINISTIC_RELEASE_TREE_VALIDATED",
            artifactId,
            audience: authority.configuration.audience,
            bundleId: authority.configuration.bundleId,
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
            approvalGranted: false,
            supportGranted: false,
            publicationGranted: false,
            runtimeGranted: false,
            promotionGranted: false,
        };
        writeJson(join(root, assetManifestPath), assetManifest);
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
                    path: assetManifestPath,
                    manifest: assetManifest,
                },
                policy: authority.context.catalogs.artifactAssurancePolicy,
            }),
        );
        const complianceReceiptPath = "compliance-receipts.json";
        writeJson(
            join(root, complianceReceiptPath),
            adapterManifest.compliance,
        );
        writeJson(join(root, "candidate-support-matrix.json"), {
            schemaVersion: "1.0.0",
            state: "STATIC_CANDIDATE_VALIDATION_ONLY",
            artifactId,
            targetCount: authority.targets.length,
            excludedTargetCount: authority.artifact.targetExclusions.length,
            sourceSkillCount: authority.sources.length,
            targets: authority.targets.map(targetReviewRecord),
            targetExclusions: authority.artifact.targetExclusions,
            harnesses: passiveHarnesses.map((harness) => ({
                harness,
                staticallyValidated: true,
                hostTested: false,
                lifecycleTested: false,
                supported: false,
            })),
            approvalGranted: false,
            supportGranted: false,
            publicationGranted: false,
            runtimeGranted: false,
            promotionGranted: false,
        });
        writeFileSync(
            join(root, "REVIEW.md"),
            reviewNotice(authority, version),
            { flag: "wx" },
        );
        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: repositoryRoot,
            encoding: "utf8",
        }).trim();
        const generatorPaths = [
            "tooling/catalog-ordering.mjs",
            "tooling/catalog-validation.mjs",
            "tooling/deterministic-release-tree.mjs",
            "tooling/harness-registry.mjs",
            "tooling/package-fundamentals-preview-assets.mjs",
            "tooling/package-passive-candidate-assets.mjs",
            "tooling/passive-profile-adapters.mjs",
            "tooling/portable-compliance-validation.mjs",
            "tooling/public-artifact-materializer.mjs",
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
        const candidateManifest = {
            schemaVersion: "1.0.0",
            state: "PASSIVE_CANDIDATE_REVIEW_ONLY",
            artifactId,
            audience: authority.configuration.audience,
            bundleId: authority.configuration.bundleId,
            packageName: authority.configuration.packageName,
            version,
            sourceCommit,
            generatorPaths,
            generatorDigest: generatorHash.digest("hex"),
            targetIds: authority.targets.map((target) => target.id),
            targetExclusions: authority.artifact.targetExclusions,
            sourceSkills: authority.sources.map((source, index) => ({
                sourceId: source.id,
                sourcePath: source.sourcePath,
                sourceRevision: source.sourceRevision,
                contentDigest: source.contentDigest,
                sourceContractPaths: source.bundledPaths,
                packagedSourcePaths:
                    authority.skills[index].packagedSourcePaths,
                excludedSourcePaths:
                    authority.skills[index].excludedSourcePaths,
            })),
            assets,
            deterministicReleaseTree: {
                manifestPath: deterministicManifestPath,
                manifestSha256: sha256(
                    readFileSync(join(root, deterministicManifestPath)),
                ),
                assetManifestPath,
                assetManifestSha256: sha256(
                    readFileSync(join(root, assetManifestPath)),
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
                receiptSha256: sha256(
                    readFileSync(join(root, complianceReceiptPath)),
                ),
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
            runtimeEligible: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "candidate-assets.json"), candidateManifest);
        writeJson(join(root, "candidate-sbom.json"), {
            schemaVersion: "1.0.0",
            format: "cratis-passive-candidate-sbom-v1",
            artifactId,
            audience: authority.configuration.audience,
            bundleId: authority.configuration.bundleId,
            version,
            targetExclusions: authority.artifact.targetExclusions,
            components: authority.sources.map((source, index) => ({
                type: "agent-skill",
                name: authority.skills[index].name,
                sourceId: source.id,
                sourcePath: source.sourcePath,
                sourceRevision: source.sourceRevision,
                contentDigest: source.contentDigest,
                sourceContractPaths: source.bundledPaths,
                packagedSourcePaths:
                    authority.skills[index].packagedSourcePaths,
                excludedSourcePaths:
                    authority.skills[index].excludedSourcePaths,
                targetIds: authority.targets
                    .filter((target) =>
                        target.sourceSkillIds.includes(source.id),
                    )
                    .map((target) => target.id),
                license: "MIT",
            })),
            dependencies: [],
            executableComponents: [],
            assets: assets.map((asset) => ({
                harness: asset.harness,
                filename: asset.filename,
                sha256: asset.sha256,
            })),
        });
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
        return candidateManifest;
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    const [artifactId, outputRoot, version] = process.argv.slice(2);
    try {
        const manifest = packagePassiveCandidateAssets({
            artifactId,
            outputRoot,
            version: version ?? "0.0.1-candidate.1",
        });
        process.stdout.write(
            `Packaged ${manifest.targetIds.length} passive candidate targets ` +
                `into ${manifest.assets.length} review assets.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Passive candidate packaging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
