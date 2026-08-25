#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    generatePassiveProfileAdapters,
    readSkillFrontmatter,
} from "./passive-profile-adapters.mjs";
import { presentProfile } from "./profile-presentation.mjs";
import { buildReleaseAssuranceReceipt } from "./release-assurance-validation.mjs";
import { createReleaseContext } from "./release-context.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

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
            throw new Error(
                `Approved release contains a special file: ${path}`,
            );
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function exactSemVer(version) {
    return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
        version,
    );
}

export function buildReleaseSupportMatrix(plan, harnesses) {
    return {
        schemaVersion: "1.0.0",
        profileId: plan.profileId,
        version: plan.version,
        definitions: {
            generated:
                "The canonical approved skill bytes are present in the host package.",
            staticallyValidated:
                "Manifest shape, file inventory, safety boundaries, and canonical byte parity passed repository specifications.",
            hostTested:
                "The named host version completed install, discovery, update or reinstall, and removal evidence for this exact release.",
        },
        hosts: harnesses.map((harness) => ({
            harness,
            generated: true,
            staticallyValidated: true,
            hostTested: false,
            releaseCanary:
                harness === "pi" ? "required-before-publication" : "not-run",
            support: "generated-not-yet-supported-by-this-release",
        })),
        claim: "Generation and static validation do not by themselves establish host support.",
    };
}

export function buildReleaseInstructions(plan, harnesses) {
    const archiveLines = harnesses
        .filter((harness) => harness !== "pi")
        .map(
            (harness) =>
                `- ${harness}: \`cratis-ai-${plan.profileId}-${plan.version}-${harness}.tar.gz\``,
        );
    return [
        `# ${plan.displayName} ${plan.version}`,
        "",
        plan.description,
        "",
        "## Verify downloads",
        "",
        "Download `SHA256SUMS` with the selected artifacts, place them in one directory, and run:",
        "",
        "```bash",
        "sha256sum -c SHA256SUMS",
        "```",
        "",
        "## Pi",
        "",
        "Install the exact profile package in project scope:",
        "",
        "```bash",
        `pi install -l npm:${plan.packageName}@${plan.version}`,
        "pi list",
        "```",
        "",
        "Remove the exact package source:",
        "",
        "```bash",
        `pi remove npm:${plan.packageName}@${plan.version}`,
        "```",
        "",
        "Update or roll back by changing both the project subscription and package source to another exact version, then rerun the repository gates.",
        "",
        "## Other hosts",
        "",
        "Use the root-native archive for the selected host. Review `support-matrix.json` before treating a generated wrapper as supported:",
        "",
        ...archiveLines,
        "",
        "Install, update, and remove through that host's native local-plugin or marketplace flow. Do not point a host at the mixed Cratis/AI authoring repository.",
        "",
    ].join("\n");
}

export function buildApprovedProfileReleasePlan({
    profileId,
    version,
    profileCatalog,
    targets,
    sources,
    sourceContracts,
    authoringContracts,
    artifacts,
}) {
    const blockers = [];
    if (!exactSemVer(version)) blockers.push("VERSION_NOT_EXACT_SEMVER");
    const publicProfile = profileCatalog.publicProfiles.find(
        (profile) => profile.id === profileId,
    );
    const engineeringProfile = profileCatalog.engineeringProfiles.find(
        (profile) => profile.id === profileId,
    );
    const profile = publicProfile ?? engineeringProfile;
    if (!profile) blockers.push("UNKNOWN_PROFILE");
    if (profile && profile.state !== "approved")
        blockers.push("PROFILE_NOT_APPROVED");
    const targetIds = profile?.availableTargets ?? [];
    if (targetIds.length === 0) blockers.push("PROFILE_HAS_NO_TARGETS");
    const selectedTargets = targetIds
        .map((id) => targets.find((target) => target.id === id))
        .filter(Boolean);
    if (selectedTargets.length !== targetIds.length)
        blockers.push("PROFILE_TARGET_MISSING");
    const audience = publicProfile ? "public" : "cratis-engineering";
    const presentation = profile ? presentProfile(profile, audience) : null;
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const sourceContractById = new Map(
        sourceContracts.map((contract) => [contract.id, contract]),
    );
    const authoringContractById = new Map(
        authoringContracts.map((contract) => [contract.id, contract]),
    );
    const selectedSources = [];
    for (const target of selectedTargets) {
        if (target.audience !== audience)
            blockers.push(`${target.id}:TARGET_AUDIENCE_MISMATCH`);
        if (
            target.capabilityKind === "unclassified" ||
            target.invocation === "unclassified" ||
            target.trust?.assessmentState !== "assessed" ||
            target.dependencyClassificationState !== "classified" ||
            target.sourceContractState !== "classified" ||
            target.authoringContractState !== "classified" ||
            [
                target.architectures,
                target.personas,
                target.surfaces,
                target.repositoryProfiles,
            ].some((dimension) => dimension?.state === "unclassified")
        )
            blockers.push(`${target.id}:TARGET_CLASSIFICATION_INCOMPLETE`);
        if (
            target.approval?.state !== "approved" ||
            target.includeInRuntime !== true ||
            target.lifecycle !== "approved"
        )
            blockers.push(`${target.id}:TARGET_NOT_RUNTIME_APPROVED`);
        if (
            !target.approval?.reviewer ||
            !target.approval?.approvedOn ||
            !target.approval?.sourceRevision ||
            !target.approval?.contentDigest ||
            (target.approval?.evidenceIds?.length ?? 0) === 0
        )
            blockers.push(`${target.id}:APPROVAL_EVIDENCE_INCOMPLETE`);
        if (
            target.security?.disposition !== "accepted" ||
            target.security.evidenceIds.length === 0
        )
            blockers.push(`${target.id}:SECURITY_NOT_ACCEPTED`);
        const evaluationEntries = Object.entries(target.evaluations ?? {});
        if (
            JSON.stringify(evaluationEntries.map(([name]) => name).sort()) !==
            JSON.stringify(
                [
                    "behavior",
                    "collision",
                    "negativeTrigger",
                    "positiveTrigger",
                ].sort(),
            )
        )
            blockers.push(`${target.id}:EVALUATION_SET_INCOMPLETE`);
        for (const [, evaluation] of evaluationEntries)
            if (
                evaluation.status !== "passing" ||
                evaluation.evidenceIds.length === 0
            )
                blockers.push(`${target.id}:EVALUATION_NOT_PASSING`);
        if ((target.sourceContractIds?.length ?? 0) === 0)
            blockers.push(`${target.id}:SOURCE_CONTRACTS_MISSING`);
        for (const id of target.sourceContractIds ?? []) {
            const contract = sourceContractById.get(id);
            if (
                !contract ||
                contract.verificationState !== "verified" ||
                contract.distributionInputAllowed !== true
            )
                blockers.push(`${target.id}:SOURCE_CONTRACT_NOT_VERIFIED`);
        }
        if (
            (target.authoringContractIds?.length ?? 0) === 0 ||
            !target.authoringContractIds.includes("cratis-skill-clean-room-v1")
        )
            blockers.push(`${target.id}:AUTHORING_CONTRACTS_MISSING`);
        for (const id of target.authoringContractIds ?? []) {
            const contract = authoringContractById.get(id);
            if (!contract || contract.state !== "active")
                blockers.push(`${target.id}:AUTHORING_CONTRACT_NOT_ACTIVE`);
        }
        if (target.sourceSkillIds.length !== 1) {
            blockers.push(`${target.id}:COMPOSED_SOURCE_NOT_SUPPORTED`);
            continue;
        }
        const source = sourceById.get(target.sourceSkillIds[0]);
        if (
            !source ||
            !/^[0-9a-f]{40}$/.test(source.sourceRevision) ||
            !/^[0-9a-f]{64}$/.test(source.contentDigest)
        ) {
            blockers.push(`${target.id}:SOURCE_PROVENANCE_INVALID`);
            continue;
        }
        if (source.audience !== audience)
            blockers.push(`${target.id}:SOURCE_AUDIENCE_MISMATCH`);
        if (
            target.approval.sourceRevision !== source.sourceRevision ||
            target.approval.contentDigest !== source.contentDigest
        )
            blockers.push(`${target.id}:APPROVAL_SOURCE_BINDING_MISMATCH`);
        selectedSources.push({ target, source });
    }
    const artifactId =
        audience === "public"
            ? "planned-passive-public-release"
            : "planned-passive-engineering-release";
    const artifact = artifacts.find((candidate) => candidate.id === artifactId);
    if (
        !artifact ||
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== true ||
        artifact.requiresApprovedTargets !== true
    )
        blockers.push("ARTIFACT_NOT_RUNTIME_ENABLED");
    if (
        artifact &&
        targetIds.some(
            (targetId) =>
                !artifact.componentInventory.skills.includes(targetId),
        )
    )
        blockers.push("PROFILE_TARGET_NOT_IN_ARTIFACT");
    return {
        schemaVersion: "1.0.0",
        state:
            blockers.length === 0 ? "READY_FOR_BOT_MATERIALIZATION" : "BLOCKED",
        profileId,
        packageName: profile?.packageName ?? null,
        displayName: presentation?.displayName ?? null,
        description: presentation?.description ?? null,
        audience,
        version,
        artifactId,
        targetIds,
        selectedSources,
        blockers: [...new Set(blockers)].sort(),
        publicationEligible: false,
        promotionEligible: false,
    };
}

function readRepositoryInputs(repositoryRoot) {
    const context = createReleaseContext({ repositoryRoot });
    return {
        context,
        profileCatalog: context.catalogs.profileCatalog,
        targets: context.catalogs.targets.targets,
        sources: context.catalogs.sources.sources,
        sourceContracts: context.catalogs.sourceContracts.contracts,
        authoringContracts: context.catalogs.authoringContracts.contracts,
        artifacts: context.catalogs.artifacts.artifacts,
    };
}

function immutableSkill(repositoryRoot, target, source) {
    const prefix = `${source.sourcePath}/`;
    const files = source.bundledPaths.map((path) => {
        if (!path.startsWith(prefix))
            throw new Error(`${source.id}: bundled path escaped source root`);
        const relativePath = path.slice(prefix.length);
        const content = execFileSync(
            "git",
            ["show", `${source.sourceRevision}:${path}`],
            { cwd: repositoryRoot },
        );
        return { path: relativePath, content };
    });
    const digest = createHash("sha256");
    for (const [index, path] of source.bundledPaths.entries()) {
        digest.update(path);
        digest.update("\0");
        digest.update(files[index].content);
        digest.update("\0");
    }
    if (digest.digest("hex") !== source.contentDigest)
        throw new Error(`${source.id}: immutable source digest mismatch`);
    const skillFile = files.find((file) => file.path === "SKILL.md");
    if (!skillFile)
        throw new Error(`${source.id}: immutable source has no SKILL.md`);
    readSkillFrontmatter(skillFile.content, target.id);
    return { name: target.id, files };
}

export function generateApprovedProfileRelease({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    profileId,
    version,
    releaseMode = false,
} = {}) {
    if (!outputRoot || !profileId || !version)
        throw new Error("outputRoot, profileId, and version are required");
    const inputs = readRepositoryInputs(repositoryRoot);
    const plan = buildApprovedProfileReleasePlan({
        profileId,
        version,
        ...inputs,
    });
    if (plan.state !== "READY_FOR_BOT_MATERIALIZATION")
        throw new Error(
            `Approved profile release is blocked: ${plan.blockers.join(", ")}`,
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Approved release output must not exist: ${root}`);
    const skills = plan.selectedSources.map(({ target, source }) =>
        immutableSkill(repositoryRoot, target, source),
    );
    try {
        const adapterManifest = generatePassiveProfileAdapters({
            outputRoot: root,
            version,
            profileId,
            packageName: plan.packageName,
            description: plan.description,
            skills,
        });
        const deterministicManifestPath = "deterministic-release-manifest.json";
        writeJson(
            join(root, deterministicManifestPath),
            adapterManifest.deterministicManifest,
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
                releaseManifest: deterministicManifestPath,
                policy: inputs.context.catalogs.artifactAssurancePolicy,
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
        writeJson(
            join(root, "support-matrix.json"),
            buildReleaseSupportMatrix(plan, adapterManifest.harnesses),
        );
        writeFileSync(
            join(root, "release-instructions.md"),
            buildReleaseInstructions(plan, adapterManifest.harnesses),
            { flag: "wx" },
        );
        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: repositoryRoot,
            encoding: "utf8",
        }).trim();
        const generatorPaths = [
            "tooling/deterministic-release-tree.mjs",
            "tooling/generate-approved-profile-release.mjs",
            "tooling/harness-registry.mjs",
            "tooling/passive-profile-adapters.mjs",
            "tooling/portable-compliance-validation.mjs",
            "tooling/profile-presentation.mjs",
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
        writeJson(join(root, "provenance.json"), {
            schemaVersion: "1.0.0",
            state: "APPROVED_PROFILE_RELEASE_PROVENANCE",
            sourceRepository: "https://github.com/Cratis/AI",
            sourceCommit,
            generatorPaths,
            generatorDigest: generatorHash.digest("hex"),
            testedHostVersions: {
                state: "pending-canary",
                versions: {},
            },
            profileId,
            profileDisplayName: plan.displayName,
            profileDescription: plan.description,
            version,
            artifactId: plan.artifactId,
            deterministicReleaseTree: {
                manifestPath: deterministicManifestPath,
                manifestSha256: sha256(
                    readFileSync(join(root, deterministicManifestPath)),
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
            targets: plan.selectedSources.map(({ target, source }) => ({
                targetId: target.id,
                sourceId: source.id,
                sourcePath: source.sourcePath,
                sourceRevision: source.sourceRevision,
                contentDigest: source.contentDigest,
                approval: target.approval,
            })),
            publicationEligible: releaseMode,
            promotionEligible: false,
        });
        const payloadFiles = walkFiles(root)
            .sort()
            .map((path) => {
                const content = readFileSync(join(root, path));
                return { path, size: content.length, sha256: sha256(content) };
            });
        const releaseManifest = {
            schemaVersion: "1.0.0",
            state: releaseMode
                ? "APPROVED_PROFILE_RELEASE"
                : "APPROVED_PROFILE_RELEASE_CANDIDATE",
            profileId,
            profileDisplayName: plan.displayName,
            profileDescription: plan.description,
            packageName: plan.packageName,
            audience: plan.audience,
            version,
            artifactId: plan.artifactId,
            targetIds: plan.targetIds,
            harnessRoots: adapterManifest.roots,
            files: payloadFiles,
            checksumFile: "SHA256SUMS",
            instructionsFile: "release-instructions.md",
            supportMatrixFile: "support-matrix.json",
            complianceReceiptFile: complianceReceiptPath,
            deterministicManifestFile: deterministicManifestPath,
            assuranceReceiptFile: assuranceReceiptPath,
            publicationEligible: releaseMode,
            runtimeEligible: false,
            promotionEligible: false,
        };
        writeJson(join(root, "release-manifest.json"), releaseManifest);
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
        return releaseManifest;
    } catch (error) {
        if (existsSync(root)) rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

function main() {
    const [outputRoot, profileId, version, mode] = process.argv.slice(2);
    if (!outputRoot || !profileId || !version) {
        process.stderr.write(
            "Usage: node tooling/generate-approved-profile-release.mjs <output> <profile-id> <exact-version> [release]\n",
        );
        process.exitCode = 1;
        return;
    }
    const manifest = generateApprovedProfileRelease({
        outputRoot,
        profileId,
        version,
        releaseMode: mode === "release",
    });
    process.stdout.write(
        `Generated approved profile release ${manifest.profileId}@${manifest.version}.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
