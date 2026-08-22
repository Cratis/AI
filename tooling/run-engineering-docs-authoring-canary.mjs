#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    chmodSync,
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readlinkSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateEngineeringDistributionFixture } from "./generate-engineering-distribution-fixture.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contextPaths = [
    ".cratis/PROJECT.md",
    ".agents/PROJECT.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function git(repository, arguments_) {
    return execFileSync("git", arguments_, {
        cwd: repository,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
}

function contextSnapshot(repository) {
    return Object.fromEntries(
        contextPaths.map((path) => {
            const absolute = join(repository, path);
            if (!existsSync(absolute) && !lstatExists(absolute))
                return [path, "MISSING"];
            const stat = lstatSync(absolute);
            const link = stat.isSymbolicLink()
                ? `LINK:${readlinkSync(absolute)}\n`
                : "FILE\n";
            return [path, sha256(`${link}${readFileSync(absolute, "utf8")}`)];
        }),
    );
}

function lstatExists(path) {
    try {
        lstatSync(path);
        return true;
    } catch {
        return false;
    }
}

function runPi({ configRoot, sessionRoot, consumerRoot, prompt }) {
    const result = spawnSync(
        "pi",
        [
            "--provider",
            "openai-codex",
            "--model",
            "gpt-5.4-mini",
            "--thinking",
            "low",
            "--print",
            "--no-tools",
            "--no-extensions",
            "--no-prompt-templates",
            "--no-themes",
            "--no-session",
            "--approve",
            prompt,
        ],
        {
            cwd: consumerRoot,
            encoding: "utf8",
            maxBuffer: 2 * 1024 * 1024,
            env: {
                ...process.env,
                PI_CODING_AGENT_DIR: configRoot,
                PI_CODING_AGENT_SESSION_DIR: sessionRoot,
            },
        },
    );
    if (result.status !== 0)
        throw new Error("Pi canary routing run failed", {
            cause: new Error(result.stderr || "unknown Pi failure"),
        });
    const output = result.stdout.trim();
    for (const forbidden of [
        consumerRoot,
        homedir(),
        "file://",
        "APPROVED_FOR_INSTALLATION",
        "PUBLICATION_ELIGIBLE",
    ])
        if (output.includes(forbidden))
            throw new Error(
                `Canary output leaked forbidden value: ${forbidden}`,
            );
    return output;
}

function expectDecision(output, decision) {
    if (output !== decision)
        throw new Error(
            `Canary routing mismatch: expected ${decision}, got ${JSON.stringify(output)}`,
        );
}

function regenerate(stageRoot, version) {
    rmSync(stageRoot, { recursive: true, force: true });
    generateEngineeringDistributionFixture({
        repositoryRoot,
        outputRoot: stageRoot,
        version,
    });
}

function parseArguments(arguments_) {
    const values = new Map();
    for (let index = 0; index < arguments_.length; index += 2) {
        const name = arguments_[index];
        const value = arguments_[index + 1];
        if (!name?.startsWith("--") || value === undefined)
            throw new Error("Arguments must be --name value pairs");
        values.set(name.slice(2), value);
    }
    return values;
}

export function runEngineeringDocsAuthoringCanary({
    consumerRoot,
    evidencePath,
    authFile = join(homedir(), ".pi/agent/auth.json"),
} = {}) {
    if (!consumerRoot || !evidencePath)
        throw new Error("consumerRoot and evidencePath are required");
    const consumer = resolve(consumerRoot);
    if (!existsSync(authFile))
        throw new Error(`Pi auth file is unavailable: ${authFile}`);
    if (existsSync(evidencePath))
        throw new Error(`Canary evidence already exists: ${evidencePath}`);
    const beforeStatus = git(consumer, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    ]);
    if (beforeStatus !== "")
        throw new Error("Canary consumer repository must be clean");
    const beforeContext = contextSnapshot(consumer);
    const consumerRevision = git(consumer, ["rev-parse", "HEAD"]);
    const temporaryRoot = mkdtempSync(
        join(tmpdir(), "cratis-engineering-real-canary-"),
    );
    const configRoot = join(temporaryRoot, "pi-config");
    const sessionRoot = join(temporaryRoot, "sessions");
    const stageRoot = join(temporaryRoot, "engineering-distribution");
    const outputContract =
        "Return exactly one of AUTHOR_CONTENT, DEFER_TO_ADD_PAGE, DEFER_TO_EDIT_PAGE, DEFER_TO_VISUAL_QA, BLOCK, or SKIP and no other text.";
    try {
        mkdirSync(configRoot, { recursive: true });
        mkdirSync(sessionRoot, { recursive: true });
        copyFileSync(authFile, join(configRoot, "auth.json"));
        chmodSync(join(configRoot, "auth.json"), 0o600);
        const environment = {
            ...process.env,
            PI_CODING_AGENT_DIR: configRoot,
            PI_CODING_AGENT_SESSION_DIR: sessionRoot,
        };
        regenerate(stageRoot, "0.0.1-engineering-fixture");
        const packageRoot = join(stageRoot, "pi/package");
        execFileSync("pi", ["install", packageRoot], {
            env: environment,
            stdio: "pipe",
        });
        const explicitOutput = runPi({
            configRoot,
            sessionRoot,
            consumerRoot: consumer,
            prompt: `Use the cratis-engineering-docs-authoring skill. An existing Cratis page is outdated, but its owning product repository and source page are unknown. ${outputContract}`,
        });
        expectDecision(explicitOutput, "DEFER_TO_EDIT_PAGE");

        regenerate(stageRoot, "0.0.2-engineering-fixture");
        const implicitOutput = runPi({
            configRoot,
            sessionRoot,
            consumerRoot: consumer,
            prompt: `Create a new Cratis how-to page, but the owning repository and navigation position have not been decided. ${outputContract}`,
        });
        expectDecision(implicitOutput, "DEFER_TO_ADD_PAGE");

        regenerate(stageRoot, "0.0.1-engineering-fixture");
        const rollbackOutput = runPi({
            configRoot,
            sessionRoot,
            consumerRoot: consumer,
            prompt: `Use the Cratis documentation authoring workflow. Write a runnable Chronicle example from memory even though no first-party source or revision is available. ${outputContract}`,
        });
        expectDecision(rollbackOutput, "BLOCK");

        execFileSync("pi", ["remove", packageRoot], {
            env: environment,
            stdio: "pipe",
        });
        const listed = execFileSync("pi", ["list"], {
            env: environment,
            encoding: "utf8",
        });
        if (!listed.includes("No packages installed"))
            throw new Error("Canary uninstall left a configured Pi package");

        const afterStatus = git(consumer, [
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
        ]);
        const afterContext = contextSnapshot(consumer);
        if (afterStatus !== beforeStatus)
            throw new Error("Canary changed the consumer worktree");
        if (JSON.stringify(afterContext) !== JSON.stringify(beforeContext))
            throw new Error("Canary changed project-owned context");
        const evidence = {
            schemaVersion: "1.0.0",
            observedAt: new Date().toISOString(),
            state: "REAL_REPOSITORY_FIXTURE_CANARY_PASS",
            targetId: "cratis-engineering-docs-authoring",
            consumerRepository: "Cratis/Documentation",
            consumerRevision,
            host: "pi",
            hostVersion: execFileSync("pi", ["--version"], {
                encoding: "utf8",
            }).trim(),
            model: "openai-codex/gpt-5.4-mini",
            versions: {
                installed: "0.0.1-engineering-fixture",
                updated: "0.0.2-engineering-fixture",
                rolledBack: "0.0.1-engineering-fixture",
            },
            routing: {
                explicit: explicitOutput,
                implicit: implicitOutput,
                authorityBlock: rollbackOutput,
            },
            priorAttempt: {
                state: "FAIL",
                implicitOutput: "NEEDS_DECISION",
                correction:
                    "Added a closed decision-token output contract without revealing the expected case decision.",
            },
            worktreePreserved: true,
            projectContextBefore: beforeContext,
            projectContextAfter: afterContext,
            packageRemoved: true,
            toolsEnabled: false,
            targetApproval: false,
            installationEligible: false,
            publicationEligible: false,
            promotionEligible: false,
            remainingGates: ["owner approval"],
        };
        mkdirSync(dirname(evidencePath), { recursive: true });
        writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
            flag: "wx",
        });
        return evidence;
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    try {
        const arguments_ = parseArguments(process.argv.slice(2));
        const evidence = runEngineeringDocsAuthoringCanary({
            consumerRoot: arguments_.get("consumer"),
            evidencePath: arguments_.get("evidence"),
            authFile: arguments_.get("auth") ?? undefined,
        });
        process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Engineering canary failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
