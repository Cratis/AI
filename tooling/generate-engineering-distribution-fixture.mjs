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
import { materializeFixtureArtifact } from "./public-artifact-materializer.mjs";

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
const generatedTargets = [
    "canonical",
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

function validateEngineeringSourceAuthority(repositoryRoot) {
    const source = readJson(
        join(repositoryRoot, "catalog/v2/sources.json"),
    ).sources.find((candidate) => candidate.id === "write-documentation");
    const expectedPaths = approvedFiles.map((path) => `engineering/${path}`);
    if (
        !source ||
        source.sourcePath !==
            "engineering/skills/cratis-engineering-docs-authoring" ||
        JSON.stringify(source.bundledPaths) !== JSON.stringify(expectedPaths) ||
        !/^[0-9a-f]{40}$/.test(source.sourceRevision)
    )
        throw new Error("Engineering source authority is inconsistent");
    for (const path of expectedPaths) {
        const current = readFileSync(join(repositoryRoot, path));
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
    return source;
}

export function validateEngineeringDistributionConfiguration(
    repositoryRoot = defaultRepositoryRoot,
) {
    try {
        const artifactMatrix = readJson(
            join(
                repositoryRoot,
                "distribution/engineering-artifact-matrix.json",
            ),
        );
        const evaluationSummary = readJson(
            join(
                repositoryRoot,
                "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
            ),
        );
        const artifacts = readJson(
            join(repositoryRoot, "catalog/v2/artifacts.json"),
        ).artifacts;
        const targets = readJson(
            join(repositoryRoot, "catalog/v2/targets.json"),
        ).targets;
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
        validateEngineeringSourceAuthority(repositoryRoot);
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
    const artifactMatrixPath = join(
        repositoryRoot,
        "distribution/engineering-artifact-matrix.json",
    );
    const evaluationSummaryPath = join(
        repositoryRoot,
        "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
    );
    const configurationErrors =
        validateEngineeringDistributionConfiguration(repositoryRoot);
    if (configurationErrors.length > 0)
        throw new Error(configurationErrors.join("; "));
    const source = validateEngineeringSourceAuthority(repositoryRoot);

    mkdirSync(root, { recursive: false });
    try {
        const canonicalRoot = join(root, "canonical");
        materializeFixtureArtifact({
            sourceRoot: join(repositoryRoot, "engineering"),
            stageRoot: canonicalRoot,
            approvedFiles,
        });

        const claudeRoot = join(root, "claude");
        copyCanonical(canonicalRoot, join(claudeRoot, `plugins/${pluginName}`));
        writeJson(join(claudeRoot, ".claude-plugin/marketplace.json"), {
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
            join(
                claudeRoot,
                `plugins/${pluginName}/.claude-plugin/plugin.json`,
            ),
            {
                name: pluginName,
                version,
                description:
                    "Fixture-only passive Cratis engineering documentation skill.",
                author: { name: "Cratis" },
            },
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
        writeJson(join(copilotRoot, `plugins/${pluginName}/plugin.json`), {
            name: pluginName,
            version,
            description:
                "Fixture-only passive Cratis engineering documentation skill.",
            skills: "skills/",
        });

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
            join(
                cursorRoot,
                `plugins/${pluginName}/.cursor-plugin/plugin.json`,
            ),
            {
                name: pluginName,
                version,
                description:
                    "Fixture-only passive Cratis engineering documentation skill.",
                skills: "./skills/",
            },
        );

        const deepSeekRoot = join(root, "deepseek/.dsh");
        copyCanonical(canonicalRoot, deepSeekRoot);

        const geminiRoot = join(root, "gemini");
        copyCanonical(canonicalRoot, geminiRoot);
        writeJson(join(geminiRoot, "gemini-extension.json"), {
            name: pluginName,
            version,
            description:
                "Fixture-only passive Cratis engineering documentation skill.",
        });

        const grokRoot = join(root, "grok/.grok");
        copyCanonical(canonicalRoot, grokRoot);

        const kiroRoot = join(root, "kiro");
        copyCanonical(canonicalRoot, kiroRoot);
        writeJson(join(kiroRoot, "plugin.json"), {
            $schema:
                "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
            name: pluginName,
            version,
            description:
                "Fixture-only passive Cratis engineering documentation skill.",
            author: { name: "Cratis" },
            license: "MIT",
        });

        const junieRoot = join(root, `junie/extensions/${pluginName}`);
        copyCanonical(canonicalRoot, junieRoot);
        writeJson(join(junieRoot, "extension.json"), {
            name: pluginName,
            description:
                "Fixture-only passive Cratis engineering documentation skill.",
        });

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
            engineeringMatrixSha256: sha256(readFileSync(artifactMatrixPath)),
            version,
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
    const targetRoots = [
        `claude/plugins/${pluginName}`,
        `codex/plugins/${pluginName}`,
        `copilot/plugins/${pluginName}`,
        `cursor/plugins/${pluginName}`,
        "deepseek/.dsh",
        "gemini",
        "grok/.grok",
        `junie/extensions/${pluginName}`,
        "kiro",
        "pi/package",
    ];
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
    for (const forbidden of [
        ".cratis/PROJECT.md",
        ".agents/PROJECT.md",
        "AGENTS.md",
        "CLAUDE.md",
        "GEMINI.md",
    ])
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

export function smokeGrokEngineeringFixture(outputRoot, temporaryRoot) {
    return smokeDirectEngineeringSkill(
        outputRoot,
        temporaryRoot,
        "grok/.grok",
        ".grok/skills",
    );
}

export function smokeDeepSeekEngineeringFixture(outputRoot, temporaryRoot) {
    return smokeDirectEngineeringSkill(
        outputRoot,
        temporaryRoot,
        "deepseek/.dsh",
        ".dsh/skills",
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
    execFileSync(
        claudeCommand,
        ["plugin", "install", `${pluginName}@${pluginName}`],
        { env: environment, stdio: "pipe" },
    );
    const installed = execFileSync(claudeCommand, ["plugin", "list"], {
        env: environment,
        encoding: "utf8",
    });
    if (!installed.includes(`${pluginName}@${pluginName}`))
        throw new Error(
            "Claude engineering fixture install was not observable",
        );
    execFileSync(
        claudeCommand,
        ["plugin", "uninstall", `${pluginName}@${pluginName}`],
        { env: environment, stdio: "pipe" },
    );
    execFileSync(
        claudeCommand,
        ["plugin", "marketplace", "remove", pluginName],
        { env: environment, stdio: "pipe" },
    );
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
    execFileSync(geminiCommand, ["extensions", "uninstall", pluginName], {
        env: environment,
        stdio: "pipe",
    });
    if (existsSync(installedRoot))
        throw new Error(
            "Gemini engineering fixture uninstall left extension content",
        );
    return { linked: true, removed: true };
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
