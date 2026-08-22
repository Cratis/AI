#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evaluationRoot = join(
    repositoryRoot,
    "evals/cratis-engineering-docs-authoring",
);
const evaluationPass = process.argv[2] ?? "calibration";
if (!["calibration", "held-out"].includes(evaluationPass))
    throw new Error(`Unknown evaluation pass: ${evaluationPass}`);
const heldOut = evaluationPass === "held-out";
const planPath = join(
    evaluationRoot,
    heldOut ? "held-out-evaluation-plan.json" : "evaluation-plan.json",
);
const promptPath = join(
    evaluationRoot,
    heldOut ? "held-out-prompt.md" : "frozen-prompt.md",
);
const casesPath = join(
    evaluationRoot,
    heldOut ? "held-out-cases.jsonl" : "cases.jsonl",
);
const skillPath = join(
    repositoryRoot,
    "engineering/skills/cratis-engineering-docs-authoring/SKILL.md",
);
const referencePath = join(
    repositoryRoot,
    "engineering/skills/cratis-engineering-docs-authoring/references/site-format.md",
);
const runsRoot = join(evaluationRoot, heldOut ? "held-out-runs" : "runs");

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse evaluation JSON: ${path}`, {
            cause: error,
        });
    }
}

function assertDigest(path, expected) {
    const actual = sha256(readFileSync(path));
    if (actual !== expected)
        throw new Error(`Frozen evaluation digest changed: ${path}`);
}

const plan = readJson(planPath);
if (plan.state !== "FROZEN_PENDING_RUNS")
    throw new Error(`Evaluation plan state is not runnable: ${plan.state}`);
if (existsSync(runsRoot))
    throw new Error(`Evaluation runs already exist: ${runsRoot}`);
assertDigest(skillPath, plan.sourceSha256);
assertDigest(referencePath, plan.referenceSha256);
assertDigest(casesPath, plan.casesSha256);
assertDigest(promptPath, plan.promptSha256);

const prompt = readFileSync(promptPath, "utf8");
const skill = readFileSync(skillPath, "utf8");
const reference = readFileSync(referencePath, "utf8");
const systemPrompt = [
    "You are a bounded Cratis documentation routing evaluator.",
    "Use only the supplied prompt and any explicitly appended skill contract.",
    "Do not use tools, files, network access, memory, or external product facts.",
    "Return exactly the requested JSON array and no other text.",
].join(" ");
const skillContract = [
    "The following frozen Cratis skill and reference are authoritative for this condition.",
    skill,
    reference,
].join("\n\n");

mkdirSync(runsRoot, { recursive: false });
const temporaryCwd = mkdtempSync(join(tmpdir(), "cratis-docs-eval-"));
const runs = [];
try {
    for (const modelName of plan.models) {
        const [provider, ...modelParts] = modelName.split("/");
        const model = modelParts.join("/");
        for (const condition of plan.conditions) {
            for (
                let repetition = 1;
                repetition <= plan.repetitionsPerModelCondition;
                repetition++
            ) {
                const runId = [
                    condition === "SKILL_WITH_OUTPUT_CONTRACT"
                        ? "skill"
                        : "baseline",
                    provider,
                    model.replaceAll(/[^a-zA-Z0-9]+/g, "-"),
                    `r${repetition}`,
                ].join("-");
                const runRoot = join(runsRoot, runId);
                mkdirSync(runRoot);
                const arguments_ = [
                    "--provider",
                    provider,
                    "--model",
                    model,
                    "--thinking",
                    "low",
                    "--mode",
                    "text",
                    "--print",
                    "--no-tools",
                    "--no-extensions",
                    "--no-skills",
                    "--no-context-files",
                    "--no-prompt-templates",
                    "--no-themes",
                    "--no-session",
                    "--system-prompt",
                    systemPrompt,
                ];
                if (condition === "SKILL_WITH_OUTPUT_CONTRACT")
                    arguments_.push("--append-system-prompt", skillContract);
                arguments_.push(prompt);
                const startedAt = new Date().toISOString();
                const started = performance.now();
                const result = spawnSync("pi", arguments_, {
                    cwd: temporaryCwd,
                    encoding: "utf8",
                    maxBuffer: 4 * 1024 * 1024,
                    env: process.env,
                });
                const durationMilliseconds = Math.round(
                    performance.now() - started,
                );
                const output = result.stdout ?? "";
                writeFileSync(join(runRoot, "output.txt"), output);
                if (result.status !== 0) {
                    writeFileSync(
                        join(runRoot, "failure.txt"),
                        result.stderr ?? "unknown failure",
                    );
                }
                const metadata = {
                    schemaVersion: "1.0.0",
                    runId,
                    condition,
                    provider,
                    model,
                    repetition,
                    startedAt,
                    durationMilliseconds,
                    exitCode: result.status ?? 1,
                    signal: result.signal ?? null,
                    toolsEnabled: false,
                    contextFilesEnabled: false,
                    outputSha256: sha256(output),
                };
                writeFileSync(
                    join(runRoot, "metadata.json"),
                    `${JSON.stringify(metadata, null, 2)}\n`,
                );
                runs.push(metadata);
                if (result.status !== 0)
                    throw new Error(`Evaluation run failed: ${runId}`);
            }
        }
    }
    const manifest = {
        schemaVersion: "1.0.0",
        evaluationPass,
        sourceRevision: plan.sourceRevision,
        promptSha256: plan.promptSha256,
        runs,
    };
    writeFileSync(
        join(runsRoot, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
    );
} finally {
    rmSync(temporaryCwd, { recursive: true, force: true });
}

process.stdout.write(
    `Completed ${runs.length} ${evaluationPass} evaluation runs.\n`,
);
