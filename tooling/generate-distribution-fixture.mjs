#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
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
import { createAgentPluginManifest } from "./passive-profile-adapters.mjs";
import { materializeFixtureArtifact } from "./public-artifact-materializer.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const approvedFiles = [
    "skills/cratis-fundamentals-concept/LICENSE",
    "skills/cratis-fundamentals-concept/SKILL.md",
];
const generatedTargets = [
    "canonical",
    "agent-plugin",
    "claude",
    "codex",
    "copilot",
    "cursor",
    "deepseek",
    "gemini",
    "grok",
    "junie",
    "kiro",
    "pi",
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse JSON file: ${path}`, { cause: error });
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
            throw new Error(`Generated symlink is forbidden: ${path}`);
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(`Generated special file is forbidden: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

function copyCanonicalSkill(canonicalRoot, destinationRoot) {
    for (const path of approvedFiles) {
        const source = join(canonicalRoot, path);
        const destination = join(destinationRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(source, destination, { errorOnExist: true });
    }
}

function manifestFile(root, path) {
    const content = readFileSync(join(root, path));
    return { path, sha256: sha256(content), size: content.length };
}

function assertConfiguration(
    requirements,
    matrix,
    artifacts,
    sources,
    repositoryRoot,
) {
    if (
        requirements.schemaVersion !== "1.0.0" ||
        matrix.schemaVersion !== "1.0.0"
    )
        throw new Error("Distribution configuration version changed");
    if (
        matrix.state !== "FIXTURE_ONLY_LOCAL_STAGING" ||
        matrix.publicationEligible !== false ||
        matrix.promotionEligible !== false
    )
        throw new Error(
            "Distribution fixture must remain publication and promotion ineligible",
        );
    if (matrix.repository?.status !== "INITIALIZED_PROTECTED_FIXTURE")
        throw new Error("Generated repository authority gate changed");
    if (
        JSON.stringify(matrix.canonicalSource?.approvedFiles) !==
        JSON.stringify(approvedFiles)
    )
        throw new Error("Canonical fixture allowlist changed");
    const requirementIds = new Set(
        requirements.requirements?.map((item) => item.id),
    );
    if (
        matrix.targets.some(
            (target) => !requirementIds.has(target.requirementId),
        )
    )
        throw new Error("Artifact matrix contains an unknown requirement");
    const enabledRoots = matrix.targets
        .filter((target) => target.state === "FIXTURE_GENERATION_ENABLED")
        .map((target) => target.outputRoot)
        .sort();
    if (
        JSON.stringify(enabledRoots) !==
        JSON.stringify([...generatedTargets].sort())
    )
        throw new Error("Generated fixture target inventory changed");
    if (
        matrix.targets
            .filter((target) => target.state === "BLOCKED")
            .some((target) => target.outputRoot !== null)
    )
        throw new Error("Blocked targets must not receive output roots");
    const artifact = artifacts.find(
        (candidate) => candidate.id === matrix.canonicalSource.artifactId,
    );
    const source = sources.find((candidate) => candidate.id === "add-concept");
    if (
        !artifact ||
        artifact.fixtureOnly !== true ||
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== false ||
        JSON.stringify(artifact.exactSourcePaths) !==
            JSON.stringify(approvedFiles) ||
        !source ||
        source.sourcePath !== "skills/cratis-fundamentals-concept" ||
        JSON.stringify(source.bundledPaths) !== JSON.stringify(approvedFiles) ||
        !/^[0-9a-f]{40}$/.test(source.sourceRevision)
    )
        throw new Error("Public fixture artifact authority is inconsistent");
    for (const path of approvedFiles) {
        const current = readFileSync(join(repositoryRoot, path));
        let immutable;
        try {
            immutable = execFileSync(
                "git",
                ["show", `${source.sourceRevision}:${path}`],
                { cwd: repositoryRoot },
            );
        } catch (error) {
            throw new Error(`Unable to read immutable public source: ${path}`, {
                cause: error,
            });
        }
        if (!current.equals(immutable))
            throw new Error(
                `Public fixture source drifted from revision: ${path}`,
            );
    }
    return { artifact, source };
}

export function validateDistributionConfiguration(
    repositoryRoot = defaultRepositoryRoot,
) {
    try {
        const requirements = readJson(
            join(repositoryRoot, "distribution/marketplace-requirements.json"),
        );
        const matrix = readJson(
            join(repositoryRoot, "distribution/artifact-matrix.json"),
        );
        const artifacts = readJson(
            join(repositoryRoot, "catalog/v2/artifacts.json"),
        ).artifacts;
        const sources = readJson(
            join(repositoryRoot, "catalog/v2/sources.json"),
        ).sources;
        assertConfiguration(
            requirements,
            matrix,
            artifacts,
            sources,
            repositoryRoot,
        );
        return [];
    } catch (error) {
        return [
            error instanceof Error
                ? `Distribution configuration: ${error.message}`
                : "Distribution configuration validation failed",
        ];
    }
}

export function generateDistributionFixture({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version = "0.0.0-fixture",
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Distribution stage must not exist: ${root}`);
    const requirementsPath = join(
        repositoryRoot,
        "distribution/marketplace-requirements.json",
    );
    const matrixPath = join(
        repositoryRoot,
        "distribution/artifact-matrix.json",
    );
    const requirements = readJson(requirementsPath);
    const matrix = readJson(matrixPath);
    const artifacts = readJson(
        join(repositoryRoot, "catalog/v2/artifacts.json"),
    ).artifacts;
    const sources = readJson(
        join(repositoryRoot, "catalog/v2/sources.json"),
    ).sources;
    const { source } = assertConfiguration(
        requirements,
        matrix,
        artifacts,
        sources,
        repositoryRoot,
    );

    mkdirSync(root, { recursive: false });
    try {
        const canonicalRoot = join(root, "canonical");
        materializeFixtureArtifact({
            sourceRoot: repositoryRoot,
            stageRoot: canonicalRoot,
            approvedFiles,
        });

        const portableDescription = "Passive Cratis skills fixture.";
        const agentPluginRoot = join(root, "agent-plugin");
        copyCanonicalSkill(canonicalRoot, agentPluginRoot);
        writeJson(
            join(agentPluginRoot, "plugin.json"),
            createAgentPluginManifest({
                name: "cratis",
                version,
                description: portableDescription,
            }),
        );

        const claudeRoot = join(root, "claude");
        copyCanonicalSkill(canonicalRoot, join(claudeRoot, "plugins/cratis"));
        writeJson(join(claudeRoot, ".claude-plugin/marketplace.json"), {
            name: "cratis",
            owner: { name: "Cratis" },
            metadata: {
                description: "Cratis skills-only fixture marketplace",
                version,
            },
            plugins: [
                {
                    name: "cratis",
                    description: "Passive Cratis skills fixture.",
                    version,
                    source: "./plugins/cratis",
                    strict: true,
                },
            ],
        });
        writeJson(
            join(claudeRoot, "plugins/cratis/.claude-plugin/plugin.json"),
            {
                name: "cratis",
                version,
                description: "Passive Cratis skills fixture.",
                author: { name: "Cratis" },
            },
        );

        const codexRoot = join(root, "codex");
        copyCanonicalSkill(canonicalRoot, join(codexRoot, "plugins/cratis"));
        writeJson(join(codexRoot, ".agents/plugins/marketplace.json"), {
            name: "cratis",
            interface: { displayName: "Cratis" },
            plugins: [
                {
                    name: "cratis",
                    source: { source: "local", path: "./plugins/cratis" },
                    policy: {
                        installation: "AVAILABLE",
                        authentication: "ON_INSTALL",
                    },
                    category: "Developer Tools",
                },
            ],
        });
        writeJson(join(codexRoot, "plugins/cratis/.codex-plugin/plugin.json"), {
            name: "cratis",
            version,
            description: "Passive Cratis skills fixture.",
            skills: "./skills/",
        });

        const copilotRoot = join(root, "copilot");
        copyCanonicalSkill(canonicalRoot, join(copilotRoot, "plugins/cratis"));
        writeJson(join(copilotRoot, ".github/plugin/marketplace.json"), {
            name: "cratis",
            owner: { name: "Cratis" },
            metadata: {
                description: "Cratis skills-only fixture marketplace",
                version,
            },
            plugins: [
                {
                    name: "cratis",
                    description: "Passive Cratis skills fixture.",
                    version,
                    source: "./plugins/cratis",
                    strict: true,
                },
            ],
        });
        writeJson(
            join(copilotRoot, "plugins/cratis/plugin.json"),
            createAgentPluginManifest({
                name: "cratis",
                version,
                description: portableDescription,
            }),
        );

        const cursorRoot = join(root, "cursor");
        copyCanonicalSkill(canonicalRoot, join(cursorRoot, "plugins/cratis"));
        writeJson(join(cursorRoot, ".cursor-plugin/marketplace.json"), {
            name: "cratis",
            owner: { name: "Cratis" },
            metadata: {
                description: "Cratis skills-only fixture marketplace",
                version,
            },
            plugins: [
                {
                    name: "cratis",
                    description: "Passive Cratis skills fixture.",
                    version,
                    source: "./plugins/cratis",
                },
            ],
        });
        writeJson(
            join(cursorRoot, "plugins/cratis/plugin.json"),
            createAgentPluginManifest({
                name: "cratis",
                version,
                description: portableDescription,
            }),
        );

        const deepSeekRoot = join(root, "deepseek/.dsh");
        copyCanonicalSkill(canonicalRoot, deepSeekRoot);

        const geminiRoot = join(root, "gemini");
        copyCanonicalSkill(canonicalRoot, geminiRoot);
        writeJson(join(geminiRoot, "gemini-extension.json"), {
            name: "cratis",
            version,
            description: "Passive Cratis skills fixture.",
        });

        const grokRoot = join(root, "grok/.grok");
        copyCanonicalSkill(canonicalRoot, grokRoot);

        const kiroRoot = join(root, "kiro");
        copyCanonicalSkill(canonicalRoot, kiroRoot);
        writeJson(
            join(kiroRoot, "plugin.json"),
            createAgentPluginManifest({
                name: "cratis",
                version,
                description: portableDescription,
            }),
        );

        const junieRoot = join(root, "junie/extensions/cratis");
        copyCanonicalSkill(canonicalRoot, junieRoot);
        writeJson(join(junieRoot, "extension.json"), {
            name: "cratis",
            description: "Passive Cratis skills fixture.",
        });

        const piPackageRoot = join(root, "pi/package");
        copyCanonicalSkill(canonicalRoot, piPackageRoot);
        writeJson(join(piPackageRoot, "package.json"), {
            name: "@cratis/ai",
            version,
            description: "Private passive Cratis skills fixture.",
            private: true,
            license: "MIT",
            files: ["skills"],
            keywords: ["pi-package"],
            pi: { skills: ["./skills"] },
        });

        writeJson(join(root, "provider-compatibility.json"), {
            schemaVersion: "1.0.0",
            providers: [
                {
                    id: "deepseek",
                    artifactStrategy: "USE_HARNESS_PACKAGE",
                    supportedHarnessOutputs: [
                        "claude",
                        "copilot",
                        "deepseek",
                        "pi",
                    ],
                    distinctArtifactRoot: null,
                },
            ],
        });

        const canonicalManifest = approvedFiles.map((path) =>
            manifestFile(canonicalRoot, path),
        );
        writeJson(join(root, "provenance.json"), {
            schemaVersion: "1.0.0",
            state: "FIXTURE_ONLY_NOT_AN_ATTESTATION",
            canonicalRepository: "Cratis/AI",
            sourceArtifactId: matrix.canonicalSource.artifactId,
            sourceRevision: source.sourceRevision,
            sourcePath: source.sourcePath,
            sourceContentDigest: source.contentDigest,
            generator: "tooling/generate-distribution-fixture.mjs",
            version,
            requirementsSha256: sha256(readFileSync(requirementsPath)),
            matrixSha256: sha256(readFileSync(matrixPath)),
            canonicalFiles: canonicalManifest,
            publicationEligible: false,
            promotionEligible: false,
        });

        const checksumPaths = walkFiles(root).sort();
        const checksums = checksumPaths
            .map((path) => `${sha256(readFileSync(join(root, path)))}  ${path}`)
            .join("\n");
        writeFileSync(join(root, "SHA256SUMS"), `${checksums}\n`, {
            flag: "wx",
        });
        const files = walkFiles(root)
            .sort()
            .map((path) => manifestFile(root, path));
        const manifest = {
            schemaVersion: "1.0.0",
            state: "FIXTURE_ONLY_LOCAL_STAGING",
            version,
            generatedTargets,
            files,
            publicationEligible: false,
            promotionEligible: false,
        };
        writeJson(join(root, "distribution-manifest.json"), manifest);
        validateDistributionFixture(root);
        return manifest;
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

export function validateDistributionFixture(outputRoot) {
    const root = realpathSync(outputRoot);
    const manifest = readJson(join(root, "distribution-manifest.json"));
    if (
        manifest.state !== "FIXTURE_ONLY_LOCAL_STAGING" ||
        manifest.publicationEligible !== false ||
        manifest.promotionEligible !== false
    )
        throw new Error("Generated distribution state changed");
    const actualPaths = walkFiles(root)
        .filter((path) => path !== "distribution-manifest.json")
        .sort();
    const declaredPaths = manifest.files.map((file) => file.path).sort();
    if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths))
        throw new Error("Generated distribution manifest inventory changed");
    for (const file of manifest.files) {
        const content = readFileSync(join(root, file.path));
        if (content.length !== file.size || sha256(content) !== file.sha256)
            throw new Error(
                `Generated distribution digest mismatch: ${file.path}`,
            );
    }
    const canonicalRoot = join(root, "canonical");
    const targetSkillRoots = [
        "agent-plugin",
        "claude/plugins/cratis",
        "codex/plugins/cratis",
        "copilot/plugins/cratis",
        "cursor/plugins/cratis",
        "deepseek/.dsh",
        "gemini",
        "grok/.grok",
        "junie/extensions/cratis",
        "kiro",
        "pi/package",
    ];
    for (const path of approvedFiles) {
        const canonical = readFileSync(join(canonicalRoot, path));
        for (const targetRoot of targetSkillRoots) {
            const target = readFileSync(join(root, targetRoot, path));
            if (!canonical.equals(target))
                throw new Error(
                    `Canonical byte parity failed: ${targetRoot}/${path}`,
                );
        }
    }
    const providerCompatibility = readJson(
        join(root, "provider-compatibility.json"),
    );
    if (
        JSON.stringify(providerCompatibility.providers) !==
        JSON.stringify([
            {
                id: "deepseek",
                artifactStrategy: "USE_HARNESS_PACKAGE",
                supportedHarnessOutputs: [
                    "claude",
                    "copilot",
                    "deepseek",
                    "pi",
                ],
                distinctArtifactRoot: null,
            },
        ])
    )
        throw new Error("Provider compatibility contract changed");
    if (existsSync(join(root, "deepseek-provider")))
        throw new Error(
            "DeepSeek model provider must not receive a duplicate artifact root",
        );
    const checksumLines = readFileSync(join(root, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n");
    for (const line of checksumLines) {
        const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
        if (!match || sha256(readFileSync(join(root, match[2]))) !== match[1])
            throw new Error(`Checksum verification failed: ${line}`);
    }
    return manifest;
}

export function smokeNpmDistributionFixture(outputRoot, temporaryRoot) {
    const packageRoot = join(outputRoot, "pi/package");
    const packRoot = join(temporaryRoot, "pack");
    const installRoot = join(temporaryRoot, "install");
    mkdirSync(packRoot, { recursive: true });
    mkdirSync(installRoot, { recursive: true });
    writeJson(join(installRoot, "package.json"), {
        name: "fixture-consumer",
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
                    env: { ...process.env, npm_config_ignore_scripts: "true" },
                },
            ),
        );
    } catch (error) {
        throw new Error("Unable to pack the passive npm fixture", {
            cause: error,
        });
    }
    const tarball = join(packRoot, packed[0].filename);
    execFileSync(
        "npm",
        ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"],
        {
            cwd: installRoot,
            stdio: "pipe",
        },
    );
    const installedSkill = join(
        installRoot,
        "node_modules/@cratis/ai/skills/cratis-fundamentals-concept/SKILL.md",
    );
    if (!lstatSync(installedSkill).isFile())
        throw new Error("Installed npm fixture skill is missing");
    execFileSync(
        "npm",
        [
            "uninstall",
            "@cratis/ai",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
        ],
        {
            cwd: installRoot,
            stdio: "pipe",
        },
    );
    if (existsSync(join(installRoot, "node_modules/@cratis/ai")))
        throw new Error("npm fixture uninstall left package content");
    return {
        tarball,
        installedSkill: "skills/cratis-fundamentals-concept/SKILL.md",
    };
}

function smokeDirectSkillFixture(
    outputRoot,
    temporaryRoot,
    sourceRoot,
    installedRoot,
) {
    const source = join(
        outputRoot,
        sourceRoot,
        "skills/cratis-fundamentals-concept",
    );
    const installed = join(
        temporaryRoot,
        installedRoot,
        "cratis-fundamentals-concept",
    );
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(source, installed, { recursive: true, errorOnExist: true });
    const sourceSkill = readFileSync(join(source, "SKILL.md"));
    const installedSkill = readFileSync(join(installed, "SKILL.md"));
    if (!sourceSkill.equals(installedSkill))
        throw new Error("Direct skill install changed canonical bytes");
    rmSync(installed, { recursive: true, force: false });
    if (existsSync(installed))
        throw new Error("Direct skill uninstall left installed content");
    return { installed: true, removed: true };
}

export function smokeGrokDistributionFixture(outputRoot, temporaryRoot) {
    return smokeDirectSkillFixture(
        outputRoot,
        temporaryRoot,
        "grok/.grok",
        ".grok/skills",
    );
}

export function smokeDeepSeekDistributionFixture(outputRoot, temporaryRoot) {
    return smokeDirectSkillFixture(
        outputRoot,
        temporaryRoot,
        "deepseek/.dsh",
        ".dsh/skills",
    );
}

export function smokePiDistributionFixture(
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
        throw new Error("Pi fixture install was not observable");
    execFileSync(piCommand, ["remove", packageRoot], {
        env: environment,
        stdio: "pipe",
    });
    const removed = execFileSync(piCommand, ["list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!removed.includes("No packages installed"))
        throw new Error("Pi fixture uninstall left a configured package");
    return { installed: true, removed: true };
}

export function smokeClaudeDistributionFixture(
    outputRoot,
    temporaryHome,
    claudeCommand = "claude",
) {
    const marketplaceRoot = join(outputRoot, "claude");
    const pluginRoot = join(marketplaceRoot, "plugins/cratis");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        claudeCommand,
        ["plugin", "validate", pluginRoot, "--strict"],
        {
            env: environment,
            stdio: "pipe",
        },
    );
    execFileSync(
        claudeCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        {
            env: environment,
            stdio: "pipe",
        },
    );
    execFileSync(claudeCommand, ["plugin", "install", "cratis@cratis"], {
        env: environment,
        stdio: "pipe",
    });
    const installed = execFileSync(claudeCommand, ["plugin", "list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes("cratis@cratis"))
        throw new Error("Claude fixture install was not observable");
    execFileSync(claudeCommand, ["plugin", "uninstall", "cratis@cratis"], {
        env: environment,
        stdio: "pipe",
    });
    execFileSync(claudeCommand, ["plugin", "marketplace", "remove", "cratis"], {
        env: environment,
        stdio: "pipe",
    });
    return { validated: true, installed: true, removed: true };
}

export function smokeCopilotDistributionFixture(
    outputRoot,
    temporaryHome,
    copilotCommand = "copilot",
) {
    const marketplaceRoot = join(outputRoot, "copilot");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        copilotCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        {
            env: environment,
            stdio: "pipe",
        },
    );
    execFileSync(copilotCommand, ["plugin", "install", "cratis@cratis"], {
        env: environment,
        stdio: "pipe",
    });
    const installed = execFileSync(copilotCommand, ["plugin", "list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes("cratis@cratis"))
        throw new Error("Copilot fixture install was not observable");
    execFileSync(copilotCommand, ["plugin", "uninstall", "cratis"], {
        env: environment,
        stdio: "pipe",
    });
    execFileSync(
        copilotCommand,
        ["plugin", "marketplace", "remove", "cratis"],
        {
            env: environment,
            stdio: "pipe",
        },
    );
    return { installed: true, removed: true };
}

export function smokeCodexDistributionFixture(
    outputRoot,
    temporaryHome,
    codexCommand = "codex",
) {
    const marketplaceRoot = join(outputRoot, "codex");
    const environment = { ...process.env, HOME: temporaryHome };
    execFileSync(
        codexCommand,
        ["plugin", "marketplace", "add", marketplaceRoot],
        {
            env: environment,
            stdio: "pipe",
        },
    );
    const listed = execFileSync(
        codexCommand,
        ["plugin", "marketplace", "list"],
        {
            env: environment,
            encoding: "utf8",
        },
    );
    if (!listed.includes("cratis"))
        throw new Error("Codex fixture marketplace was not observable");
    execFileSync(codexCommand, ["plugin", "marketplace", "remove", "cratis"], {
        env: environment,
        stdio: "pipe",
    });
    return { added: true, removed: true };
}

export function smokeGeminiDistributionFixture(
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
        {
            env: environment,
            stdio: "pipe",
        },
    );
    const installedRoot = join(temporaryHome, ".gemini/extensions/cratis");
    if (!existsSync(installedRoot))
        throw new Error("Gemini fixture extension was not observable");
    execFileSync(geminiCommand, ["extensions", "uninstall", "cratis"], {
        env: environment,
        stdio: "pipe",
    });
    if (existsSync(installedRoot))
        throw new Error("Gemini fixture uninstall left extension content");
    return { linked: true, removed: true };
}

function main() {
    const outputRoot = process.argv[2];
    const version = process.argv[3] ?? "0.0.0-fixture";
    if (!outputRoot) {
        process.stderr.write(
            "Usage: node tooling/generate-distribution-fixture.mjs <empty-output-path> [version]\n",
        );
        process.exitCode = 1;
        return;
    }
    if (!/^0\.0\.[0-9]+-fixture$/.test(version)) {
        process.stderr.write("Fixture version must match 0.0.N-fixture\n");
        process.exitCode = 1;
        return;
    }
    const manifest = generateDistributionFixture({ outputRoot, version });
    process.stdout.write(
        `Generated fixture-only distribution: ${manifest.files.length} files across ${manifest.generatedTargets.length} targets.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
