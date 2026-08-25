#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    claudeCompatibleHarnesses,
    fixtureOutputRoots,
    fixtureSkillRoot,
    fixtureSkillRoots,
    forbiddenPathPolicy,
    resolveHarness,
} from "./harness-registry.mjs";
import {
    createAgentPluginManifest,
    createClaudeMarketplace,
    createClaudePluginManifest,
    createPassiveFixtureProjection,
} from "./passive-profile-adapters.mjs";
import { validateProjectedRoot } from "./deterministic-release-tree.mjs";
import { materializeFixtureArtifact } from "./public-artifact-materializer.mjs";
import { buildReleaseAssuranceReceipt } from "./release-assurance-validation.mjs";
import { createReleaseContext } from "./release-context.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const skillName = "cratis-engineering-docs-authoring";
const pluginName = "cratis-engineering-fixture";
const packageName = "@cratis/ai-engineering-fixture";
const approvedFiles = [
    `skills/${skillName}/LICENSE`,
    `skills/${skillName}/SKILL.md`,
    `skills/${skillName}/references/site-format.md`,
];
const generatedTargets = fixtureOutputRoots;

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function captureCommand(command, args, environment) {
    const result = spawnSync(command, args, {
        env: environment,
        encoding: "utf8",
    });
    if (result.status !== 0)
        throw new Error(
            `Command failed: ${command} ${args.join(" ")}\n${result.stderr}`,
        );
    return `${result.stdout}${result.stderr}`;
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse engineering fixture JSON: ${path}`, {
            cause: error,
        });
    }
}

function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        if (entry.isSymbolicLink())
            throw new Error(
                `Engineering fixture symlink is forbidden: ${path}`,
            );
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(
                `Engineering fixture special file is forbidden: ${path}`,
            );
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function copyCanonical(canonicalRoot, destinationRoot) {
    for (const path of approvedFiles) {
        const destination = join(destinationRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(canonicalRoot, path), destination, { errorOnExist: true });
    }
}

function manifestFile(root, path) {
    const content = readFileSync(join(root, path));
    return { path, sha256: sha256(content), size: content.length };
}

function validateEngineeringSourceAuthority(repositoryRoot, context) {
    const releaseContext = context ?? createReleaseContext({ repositoryRoot });
    const source = releaseContext.require("sources", "write-documentation");
    const expectedPaths = approvedFiles.map((path) => `engineering/${path}`);
    if (
        !source ||
        source.sourcePath !==
            "engineering/skills/cratis-engineering-docs-authoring" ||
        JSON.stringify(source.bundledPaths) !== JSON.stringify(expectedPaths) ||
        !/^[0-9a-f]{40}$/.test(source.sourceRevision)
    )
        throw new Error("Engineering source authority is inconsistent");
    const approvedBuffers = new Map();
    for (const path of expectedPaths) {
        const current = readFileSync(join(repositoryRoot, path));
        approvedBuffers.set(path.slice("engineering/".length), current);
        let immutable;
        try {
            immutable = execFileSync(
                "git",
                ["show", `${source.sourceRevision}:${path}`],
                { cwd: repositoryRoot },
            );
        } catch (error) {
            throw new Error(
                `Unable to read immutable engineering source: ${path}`,
                { cause: error },
            );
        }
        if (!current.equals(immutable))
            throw new Error(
                `Engineering fixture source drifted from revision: ${path}`,
            );
    }
    return { source, approvedBuffers };
}

export function validateEngineeringDistributionConfiguration(
    repositoryRoot = defaultRepositoryRoot,
    context,
) {
    try {
        const releaseContext =
            context ?? createReleaseContext({ repositoryRoot });
        const artifactMatrix =
            releaseContext.catalogs.engineeringArtifactMatrix;
        const evaluationSummary = readJson(
            join(
                repositoryRoot,
                "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
            ),
        );
        const artifacts = releaseContext.catalogs.artifacts.artifacts;
        const targets = releaseContext.catalogs.targets.targets;
        const fixture = artifacts.find(
            (artifact) =>
                artifact.id === "sanitized-engineering-docs-authoring-fixture",
        );
        const planned = artifacts.find(
            (artifact) => artifact.id === "planned-passive-engineering-release",
        );
        const target = targets.find(
            (candidate) => candidate.id === "cratis-engineering-docs-authoring",
        );
        const expectedExactPaths = approvedFiles.map(
            (path) => `engineering/${path}`,
        );
        validateEngineeringSourceAuthority(repositoryRoot, releaseContext);
        if (
            artifactMatrix.firstPassiveTarget.state !==
                "REAL_CANARY_PASS_OWNER_REVIEW_PENDING" ||
            artifactMatrix.installationEligible !== false ||
            artifactMatrix.publicationEligible !== false ||
            artifactMatrix.promotionEligible !== false ||
            evaluationSummary.targetApproval !== false ||
            evaluationSummary.installationEligible !== false ||
            evaluationSummary.publicationEligible !== false ||
            evaluationSummary.promotionEligible !== false ||
            !fixture ||
            fixture.fixtureOnly !== true ||
            fixture.materializationAllowed !== true ||
            fixture.runtimeEligible !== false ||
            JSON.stringify(fixture.exactSourcePaths) !==
                JSON.stringify(expectedExactPaths) ||
            !planned ||
            planned.materializationAllowed !== false ||
            planned.runtimeEligible !== false ||
            !target ||
            target.approval?.state !== "candidate" ||
            target.includeInRuntime !== false
        )
            throw new Error("Engineering fixture authority gate changed");
        return [];
    } catch (error) {
        return [
            error instanceof Error
                ? `Engineering distribution configuration: ${error.message}`
                : "Engineering distribution configuration validation failed",
        ];
    }
}

export function generateEngineeringDistributionFixture({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version = "0.0.0-engineering-fixture",
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    if (!/^0\.0\.[0-9]+-engineering-fixture$/.test(version))
        throw new Error(
            "Engineering fixture version must match 0.0.N-engineering-fixture",
        );
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Engineering fixture stage must not exist: ${root}`);
    const context = createReleaseContext({ repositoryRoot });
    const evaluationSummaryPath = join(
        repositoryRoot,
        "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
    );
    const configurationErrors = validateEngineeringDistributionConfiguration(
        repositoryRoot,
        context,
    );
    if (configurationErrors.length > 0)
        throw new Error(configurationErrors.join("; "));
    const { source, approvedBuffers } = validateEngineeringSourceAuthority(
        repositoryRoot,
        context,
    );

    const fixtureProjection = createPassiveFixtureProjection({
        version,
        pluginName,
        portableDescription:
            "Fixture-only passive Cratis engineering documentation skill.",
        marketplaceDescription:
            "Fixture-only Cratis engineering skills marketplace",
        codexDisplayName: "Cratis Engineering Fixture",
        piPackageManifest: {
            name: packageName,
            version,
            description:
                "Private fixture-only Cratis engineering documentation skill.",
            private: true,
            license: "MIT",
            files: ["skills"],
            keywords: ["pi-package"],
            pi: { skills: ["./skills"] },
        },
        skills: [
            {
                name: skillName,
                files: approvedFiles.map((path) => ({
                    path: path.split("/").slice(2).join("/"),
                    content: approvedBuffers.get(path),
                })),
            },
        ],
    });
    mkdirSync(root, { recursive: false });
    try {
        const canonicalRoot = join(root, "canonical");
        materializeFixtureArtifact({
            stageRoot: canonicalRoot,
            approvedFiles,
            approvedBuffers,
        });

        const portableDescription =
            "Fixture-only passive Cratis engineering documentation skill.";
        const agentPluginRoot = join(root, "agent-plugin");
        copyCanonical(canonicalRoot, agentPluginRoot);
        writeJson(
            join(agentPluginRoot, "plugin.json"),
            createAgentPluginManifest({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );

        const claudeRoot = join(root, "claude");
        copyCanonical(canonicalRoot, join(claudeRoot, `plugins/${pluginName}`));
        writeJson(
            join(claudeRoot, ".claude-plugin/marketplace.json"),
            createClaudeMarketplace({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );
        writeJson(
            join(
                claudeRoot,
                `plugins/${pluginName}/.claude-plugin/plugin.json`,
            ),
            createClaudePluginManifest({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );

        const codexRoot = join(root, "codex");
        copyCanonical(canonicalRoot, join(codexRoot, `plugins/${pluginName}`));
        writeJson(join(codexRoot, ".agents/plugins/marketplace.json"), {
            name: pluginName,
            interface: { displayName: "Cratis Engineering Fixture" },
            plugins: [
                {
                    name: pluginName,
                    source: {
                        source: "local",
                        path: `./plugins/${pluginName}`,
                    },
                    policy: {
                        installation: "AVAILABLE",
                        authentication: "ON_INSTALL",
                    },
                    category: "Developer Tools",
                },
            ],
        });
        writeJson(
            join(codexRoot, `plugins/${pluginName}/.codex-plugin/plugin.json`),
            {
                name: pluginName,
                version,
                description:
                    "Fixture-only passive Cratis engineering documentation skill.",
                skills: "./skills/",
            },
        );

        const copilotRoot = join(root, "copilot");
        copyCanonical(
            canonicalRoot,
            join(copilotRoot, `plugins/${pluginName}`),
        );
        writeJson(join(copilotRoot, ".github/plugin/marketplace.json"), {
            name: pluginName,
            owner: { name: "Cratis" },
            metadata: {
                description:
                    "Fixture-only Cratis engineering skills marketplace",
                version,
            },
            plugins: [
                {
                    name: pluginName,
                    description:
                        "Fixture-only passive Cratis engineering documentation skill.",
                    version,
                    source: `./plugins/${pluginName}`,
                    strict: true,
                },
            ],
        });
        writeJson(
            join(copilotRoot, `plugins/${pluginName}/plugin.json`),
            createAgentPluginManifest({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );

        const cursorRoot = join(root, "cursor");
        copyCanonical(canonicalRoot, join(cursorRoot, `plugins/${pluginName}`));
        writeJson(join(cursorRoot, ".cursor-plugin/marketplace.json"), {
            name: pluginName,
            owner: { name: "Cratis" },
            metadata: {
                description:
                    "Fixture-only Cratis engineering skills marketplace",
                version,
            },
            plugins: [
                {
                    name: pluginName,
                    description:
                        "Fixture-only passive Cratis engineering documentation skill.",
                    version,
                    source: `./plugins/${pluginName}`,
                },
            ],
        });
        writeJson(
            join(cursorRoot, `plugins/${pluginName}/plugin.json`),
            createAgentPluginManifest({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );

        const deepCodeRoot = join(
            root,
            fixtureSkillRoot("deepcode", pluginName),
        );
        copyCanonical(canonicalRoot, deepCodeRoot);

        const deepSeekRoot = join(
            root,
            fixtureSkillRoot("deepseek-harness", pluginName),
        );
        copyCanonical(canonicalRoot, deepSeekRoot);

        const geminiRoot = join(root, fixtureSkillRoot("gemini", pluginName));
        copyCanonical(canonicalRoot, geminiRoot);
        writeJson(join(geminiRoot, "gemini-extension.json"), {
            name: pluginName,
            version,
            description:
                "Fixture-only passive Cratis engineering documentation skill.",
        });

        for (const harness of claudeCompatibleHarnesses.filter(
            (harness) => harness !== "claude",
        )) {
            const compatibleRoot = join(
                root,
                resolveHarness(harness).fixtureOutputRoot,
            );
            copyCanonical(
                canonicalRoot,
                join(compatibleRoot, `plugins/${pluginName}`),
            );
            writeJson(
                join(compatibleRoot, ".claude-plugin/marketplace.json"),
                createClaudeMarketplace({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
            writeJson(
                join(
                    compatibleRoot,
                    `plugins/${pluginName}/.claude-plugin/plugin.json`,
                ),
                createClaudePluginManifest({
                    name: pluginName,
                    version,
                    description: portableDescription,
                }),
            );
        }

        const kiroRoot = join(root, "kiro");
        copyCanonical(canonicalRoot, kiroRoot);
        writeJson(
            join(kiroRoot, "plugin.json"),
            createAgentPluginManifest({
                name: pluginName,
                version,
                description: portableDescription,
            }),
        );

        const piRoot = join(root, "pi/package");
        copyCanonical(canonicalRoot, piRoot);
        writeJson(join(piRoot, "package.json"), {
            name: packageName,
            version,
            description:
                "Private fixture-only Cratis engineering documentation skill.",
            private: true,
            license: "MIT",
            files: ["skills"],
            keywords: ["pi-package"],
            pi: { skills: ["./skills"] },
        });

        validateProjectedRoot(root, fixtureProjection);
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
                releaseManifest: "engineering-distribution-manifest.json",
                policy: context.catalogs.artifactAssurancePolicy,
            }),
        );
        writeJson(join(root, "provenance.json"), {
            schemaVersion: "1.0.0",
            state: "ENGINEERING_FIXTURE_ONLY_NOT_AN_ATTESTATION",
            canonicalRepository: "Cratis/AI",
            sourceRevision: source.sourceRevision,
            sourcePath: source.sourcePath,
            sourceContentDigest: source.contentDigest,
            evaluationSummarySha256: sha256(
                readFileSync(evaluationSummaryPath),
            ),
            engineeringMatrixSha256:
                context.catalogDigests.engineeringArtifactMatrix,
            version,
            assuranceReceiptPath,
            assuranceReceiptSha256: sha256(
                readFileSync(join(root, assuranceReceiptPath)),
            ),
            installationEligible: false,
            publicationEligible: false,
            promotionEligible: false,
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
        const manifest = {
            schemaVersion: "1.0.0",
            state: "ENGINEERING_FIXTURE_ONLY",
            version,
            skillName,
            generatedTargets,
            files: walkFiles(root)
                .sort()
                .map((path) => manifestFile(root, path)),
            installationEligible: false,
            publicationEligible: false,
            promotionEligible: false,
        };
        writeJson(
            join(root, "engineering-distribution-manifest.json"),
            manifest,
        );
        validateEngineeringDistributionFixture(root);
        return manifest;
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

export function validateEngineeringDistributionFixture(outputRoot) {
    const root = realpathSync(outputRoot);
    const manifest = readJson(
        join(root, "engineering-distribution-manifest.json"),
    );
    if (
        manifest.state !== "ENGINEERING_FIXTURE_ONLY" ||
        manifest.skillName !== skillName ||
        manifest.installationEligible !== false ||
        manifest.publicationEligible !== false ||
        manifest.promotionEligible !== false
    )
        throw new Error("Engineering fixture state changed");
    const actualPaths = walkFiles(root)
        .filter((path) => path !== "engineering-distribution-manifest.json")
        .sort();
    const declaredPaths = manifest.files.map((file) => file.path).sort();
    if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths))
        throw new Error("Engineering fixture manifest inventory changed");
    for (const file of manifest.files) {
        const content = readFileSync(join(root, file.path));
        if (content.length !== file.size || sha256(content) !== file.sha256)
            throw new Error(
                `Engineering fixture digest mismatch: ${file.path}`,
            );
    }
    const targetRoots = fixtureSkillRoots(pluginName);
    for (const path of approvedFiles) {
        const canonical = readFileSync(join(root, "canonical", path));
        for (const targetRoot of targetRoots) {
            const target = readFileSync(join(root, targetRoot, path));
            if (!canonical.equals(target))
                throw new Error(
                    `Engineering fixture byte parity failed: ${targetRoot}/${path}`,
                );
        }
    }
    for (const forbidden of forbiddenPathPolicy.projectOwnedPaths)
        if (actualPaths.some((path) => path.endsWith(forbidden)))
            throw new Error(
                `Engineering fixture contains project-owned path: ${forbidden}`,
            );
    for (const line of readFileSync(join(root, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n")) {
        const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
        if (!match || sha256(readFileSync(join(root, match[2]))) !== match[1])
            throw new Error(`Engineering fixture checksum failed: ${line}`);
    }
    return manifest;
}

export function smokeNpmEngineeringFixture(outputRoot, temporaryRoot) {
    const packageRoot = join(outputRoot, "pi/package");
    const packRoot = join(temporaryRoot, "pack");
    const installRoot = join(temporaryRoot, "install");
    mkdirSync(packRoot, { recursive: true });
    mkdirSync(installRoot, { recursive: true });
    writeJson(join(installRoot, "package.json"), {
        name: "engineering-fixture-consumer",
        version: "1.0.0",
        private: true,
    });
    let packed;
    try {
        packed = JSON.parse(
            execFileSync(
                "npm",
                ["pack", "--json", "--pack-destination", packRoot],
                {
                    cwd: packageRoot,
                    encoding: "utf8",
                    env: {
                        ...process.env,
                        npm_config_ignore_scripts: "true",
                    },
                },
            ),
        );
    } catch (error) {
        throw new Error("Unable to pack the engineering npm fixture", {
            cause: error,
        });
    }
    const tarball = join(packRoot, packed[0].filename);
    execFileSync(
        "npm",
        ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: installRoot, stdio: "pipe" },
    );
    const installedSkill = join(
        installRoot,
        `node_modules/${packageName}/skills/${skillName}/SKILL.md`,
    );
    if (!lstatSync(installedSkill).isFile())
        throw new Error("Installed engineering fixture skill is missing");
    execFileSync(
        "npm",
        [
            "uninstall",
            packageName,
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
        ],
        { cwd: installRoot, stdio: "pipe" },
    );
    if (existsSync(join(installRoot, `node_modules/${packageName}`)))
        throw new Error(
            "Engineering npm fixture uninstall left package content",
        );
    return { tarball, installedSkill: `skills/${skillName}/SKILL.md` };
}

export function smokeNpmEngineeringUpdateRollback(
    firstOutputRoot,
    secondOutputRoot,
    temporaryRoot,
) {
    const packRoot = join(temporaryRoot, "pack");
    const installRoot = join(temporaryRoot, "consumer");
    mkdirSync(packRoot, { recursive: true });
    mkdirSync(installRoot, { recursive: true });
    writeJson(join(installRoot, "package.json"), {
        name: "engineering-update-consumer",
        version: "1.0.0",
        private: true,
    });
    const projectFiles = {
        ".cratis/PROJECT.md": "# Project context\n\nKeep this project-owned.\n",
        "AGENTS.md": "# Project bootstrap\n\nRead .cratis/PROJECT.md.\n",
        "CLAUDE.md": "@.cratis/PROJECT.md\n",
        "GEMINI.md": "@.cratis/PROJECT.md\n",
    };
    for (const [path, content] of Object.entries(projectFiles)) {
        const destination = join(installRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, content);
    }
    const pack = (outputRoot, label) => {
        try {
            const packed = JSON.parse(
                execFileSync(
                    "npm",
                    ["pack", "--json", "--pack-destination", packRoot],
                    {
                        cwd: join(outputRoot, "pi/package"),
                        encoding: "utf8",
                        env: {
                            ...process.env,
                            npm_config_ignore_scripts: "true",
                        },
                    },
                ),
            );
            if (!packed[0]?.filename)
                throw new Error("npm pack returned no filename");
            return join(packRoot, packed[0].filename);
        } catch (error) {
            throw new Error(`Unable to pack ${label} engineering fixture`, {
                cause: error,
            });
        }
    };
    const firstTarball = pack(firstOutputRoot, "first");
    const secondTarball = pack(secondOutputRoot, "second");
    const install = (tarball) => {
        execFileSync(
            "npm",
            ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"],
            { cwd: installRoot, stdio: "pipe" },
        );
        return readJson(
            join(installRoot, `node_modules/${packageName}/package.json`),
        ).version;
    };
    const firstVersion = install(firstTarball);
    const secondVersion = install(secondTarball);
    const rolledBackVersion = install(firstTarball);
    for (const [path, content] of Object.entries(projectFiles))
        if (readFileSync(join(installRoot, path), "utf8") !== content)
            throw new Error(
                `Engineering package changed project context: ${path}`,
            );
    execFileSync(
        "npm",
        [
            "uninstall",
            packageName,
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
        ],
        { cwd: installRoot, stdio: "pipe" },
    );
    for (const [path, content] of Object.entries(projectFiles))
        if (readFileSync(join(installRoot, path), "utf8") !== content)
            throw new Error(
                `Engineering uninstall changed project context: ${path}`,
            );
    return {
        firstVersion,
        secondVersion,
        rolledBackVersion,
        projectContextPreserved: true,
        uninstalled: !existsSync(
            join(installRoot, `node_modules/${packageName}`),
        ),
    };
}

function smokeDirectEngineeringSkill(
    outputRoot,
    temporaryRoot,
    sourceRoot,
    installedRoot,
) {
    const source = join(outputRoot, sourceRoot, `skills/${skillName}`);
    const installed = join(temporaryRoot, installedRoot, skillName);
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(source, installed, { recursive: true, errorOnExist: true });
    const sourceSkill = readFileSync(join(source, "SKILL.md"));
    const installedSkill = readFileSync(join(installed, "SKILL.md"));
    if (!sourceSkill.equals(installedSkill))
        throw new Error("Direct engineering skill install changed bytes");
    rmSync(installed, { recursive: true, force: false });
    if (existsSync(installed))
        throw new Error("Direct engineering skill uninstall left content");
    return { installed: true, removed: true };
}

function smokeClaudeCompatibleEngineeringPlugin(
    outputRoot,
    temporaryRoot,
    sourceRoot,
    installedRoot,
) {
    const source = join(outputRoot, sourceRoot, `plugins/${pluginName}`);
    const installed = join(temporaryRoot, installedRoot, pluginName);
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(source, installed, { recursive: true, errorOnExist: true });
    const sourceSkill = readFileSync(
        join(source, `skills/${skillName}/SKILL.md`),
    );
    const installedSkill = readFileSync(
        join(installed, `skills/${skillName}/SKILL.md`),
    );
    if (!sourceSkill.equals(installedSkill))
        throw new Error(
            "Claude-compatible engineering plugin install changed bytes",
        );
    rmSync(installed, { recursive: true, force: false });
    if (existsSync(installed))
        throw new Error(
            "Claude-compatible engineering plugin uninstall left content",
        );
    return { installed: true, removed: true };
}

export function smokeGrokEngineeringFixture(outputRoot, temporaryRoot) {
    return smokeClaudeCompatibleEngineeringPlugin(
        outputRoot,
        temporaryRoot,
        resolveHarness("grok").fixtureOutputRoot,
        resolveHarness("grok").projectSkillRoot,
    );
}

export function smokeDeepCodeEngineeringFixture(outputRoot, temporaryRoot) {
    return smokeDirectEngineeringSkill(
        outputRoot,
        temporaryRoot,
        fixtureSkillRoot("deepcode", pluginName),
        resolveHarness("deepcode").projectSkillRoot,
    );
}

export function smokeDeepSeekEngineeringFixture(outputRoot, temporaryRoot) {
    return smokeDirectEngineeringSkill(
        outputRoot,
        temporaryRoot,
        fixtureSkillRoot("deepseek-harness", pluginName),
        resolveHarness("deepseek-harness").projectSkillRoot,
    );
}

export function smokePiEngineeringFixture(
    outputRoot,
    temporaryHome,
    piCommand = "pi",
) {
    const packageRoot = join(outputRoot, "pi/package");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(piCommand, ["install", packageRoot], {
        env: environment,
        stdio: "pipe",
    });
    const installed = execFileSync(piCommand, ["list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes(resolve(packageRoot)))
        throw new Error("Pi engineering fixture install was not observable");
    execFileSync(piCommand, ["remove", packageRoot], {
        env: environment,
        stdio: "pipe",
    });
    const removed = execFileSync(piCommand, ["list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!removed.includes("No packages installed"))
        throw new Error("Pi engineering fixture uninstall left configuration");
    return { installed: true, removed: true };
}

export function smokeClaudeEngineeringFixture(
    outputRoot,
    temporaryHome,
    claudeCommand = "claude",
) {
    const marketplaceRoot = join(outputRoot, "claude");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        claudeCommand,
        [
            "plugin",
            "validate",
            join(marketplaceRoot, `plugins/${pluginName}`),
            "--strict",
        ],
        { env: environment, stdio: "pipe" },
    );
    execFileSync(
        claudeCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        { env: environment, stdio: "pipe" },
    );
    execFileSync(claudeCommand, ["plugin", "install", `${pluginName}@cratis`], {
        env: environment,
        stdio: "pipe",
    });
    const installed = execFileSync(claudeCommand, ["plugin", "list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes(`${pluginName}@cratis`))
        throw new Error(
            "Claude engineering fixture install was not observable",
        );
    execFileSync(
        claudeCommand,
        ["plugin", "uninstall", `${pluginName}@cratis`],
        { env: environment, stdio: "pipe" },
    );
    execFileSync(claudeCommand, ["plugin", "marketplace", "remove", "cratis"], {
        env: environment,
        stdio: "pipe",
    });
    return { validated: true, installed: true, removed: true };
}

export function smokeCopilotEngineeringFixture(
    outputRoot,
    temporaryHome,
    copilotCommand = "copilot",
) {
    const marketplaceRoot = join(outputRoot, "copilot");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        copilotCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        { env: environment, stdio: "pipe" },
    );
    execFileSync(
        copilotCommand,
        ["plugin", "install", `${pluginName}@${pluginName}`],
        { env: environment, stdio: "pipe" },
    );
    const installed = execFileSync(copilotCommand, ["plugin", "list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes(`${pluginName}@${pluginName}`))
        throw new Error(
            "Copilot engineering fixture install was not observable",
        );
    execFileSync(copilotCommand, ["plugin", "uninstall", pluginName], {
        env: environment,
        stdio: "pipe",
    });
    execFileSync(
        copilotCommand,
        ["plugin", "marketplace", "remove", pluginName],
        { env: environment, stdio: "pipe" },
    );
    return { installed: true, removed: true };
}

export function smokeCodexEngineeringFixture(
    outputRoot,
    temporaryHome,
    codexCommand = "codex",
) {
    const marketplaceRoot = join(outputRoot, "codex");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        codexCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        { env: environment, stdio: "pipe" },
    );
    const listed = execFileSync(
        codexCommand,
        ["plugin", "marketplace", "list"],
        { env: environment, encoding: "utf8" },
    );
    if (!listed.includes(pluginName))
        throw new Error(
            "Codex engineering fixture marketplace was not observable",
        );
    execFileSync(
        codexCommand,
        ["plugin", "marketplace", "remove", pluginName],
        { env: environment, stdio: "pipe" },
    );
    return { added: true, removed: true };
}

export function smokeGeminiEngineeringFixture(
    outputRoot,
    temporaryHome,
    geminiCommand = "gemini",
) {
    const extensionRoot = join(outputRoot, "gemini");
    mkdirSync(join(temporaryHome, ".gemini"), { recursive: true });
    const environment = {
        ...process.env,
        HOME: temporaryHome,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "fixture-not-used",
    };
    execFileSync(
        geminiCommand,
        ["extensions", "link", extensionRoot, "--consent"],
        { env: environment, stdio: "pipe" },
    );
    const installedRoot = join(
        temporaryHome,
        `.gemini/extensions/${pluginName}`,
    );
    if (!existsSync(installedRoot))
        throw new Error(
            "Gemini engineering fixture extension was not observable",
        );
    const skillList = captureCommand(
        geminiCommand,
        ["skills", "list"],
        environment,
    );
    if (
        !skillList.includes(skillName) ||
        !skillList.includes(realpathSync(extensionRoot))
    )
        throw new Error(
            "Gemini engineering skill discovery was not observable",
        );
    execFileSync(geminiCommand, ["extensions", "uninstall", pluginName], {
        env: environment,
        stdio: "pipe",
    });
    if (existsSync(installedRoot))
        throw new Error(
            "Gemini engineering fixture uninstall left extension content",
        );
    const removedSkills = captureCommand(
        geminiCommand,
        ["skills", "list"],
        environment,
    );
    if (removedSkills.includes(realpathSync(extensionRoot)))
        throw new Error(
            "Gemini engineering uninstall left skill discovery state",
        );
    return { linked: true, skillDiscovered: true, removed: true };
}

function main() {
    const outputRoot = process.argv[2];
    const version = process.argv[3] ?? "0.0.0-engineering-fixture";
    if (!outputRoot) {
        process.stderr.write(
            "Usage: node tooling/generate-engineering-distribution-fixture.mjs <empty-output-path> [version]\n",
        );
        process.exitCode = 1;
        return;
    }
    try {
        const manifest = generateEngineeringDistributionFixture({
            outputRoot,
            version,
        });
        process.stdout.write(
            `Generated engineering fixture: ${manifest.files.length} files across ${manifest.generatedTargets.length} targets.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Engineering fixture generation failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
