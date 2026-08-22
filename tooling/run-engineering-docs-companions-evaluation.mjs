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
    "evals/cratis-engineering-docs-companions",
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
const runsRoot = join(evaluationRoot, heldOut ? "held-out-runs" : "runs");
const sourcePaths = [
    join(
        repositoryRoot,
        "engineering/skills/cratis-engineering-docs-add-page/SKILL.md",
    ),
    join(
        repositoryRoot,
        "engineering/skills/cratis-engineering-docs-add-page/references/ownership-and-navigation.md",
    ),
    join(
        repositoryRoot,
        "engineering/skills/cratis-engineering-docs-edit-page/SKILL.md",
    ),
    join(
        repositoryRoot,
        "engineering/skills/cratis-engineering-docs-edit-page/references/source-discovery.md",
    ),
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse companion evaluation JSON: ${path}`, {
            cause: error,
        });
    }
}

function assertDigest(path, expected) {
    if (sha256(readFileSync(path)) !== expected)
        throw new Error(`Frozen companion evaluation digest changed: ${path}`);
}

const plan = readJson(planPath);
if (plan.state !== "FROZEN_PENDING_RUNS")
    throw new Error(`Companion evaluation plan is not runnable: ${plan.state}`);
if (existsSync(runsRoot))
    throw new Error(`Companion evaluation runs already exist: ${runsRoot}`);
for (const [path, expected] of [
    [sourcePaths[0], plan.addSourceSha256],
    [sourcePaths[1], plan.addReferenceSha256],
    [sourcePaths[2], plan.editSourceSha256],
    [sourcePaths[3], plan.editReferenceSha256],
    [casesPath, plan.casesSha256],
    [promptPath, plan.promptSha256],
])
    assertDigest(path, expected);

const prompt = readFileSync(promptPath, "utf8");
const skillContract = [
    "The following frozen Cratis companion skills and references are authoritative for this condition.",
    ...sourcePaths.map((path) => readFileSync(path, "utf8")),
].join("\n\n");
const systemPrompt = [
    "You are a bounded Cratis documentation companion routing evaluator.",
    "Use only the supplied prompt and any explicitly appended skill contract.",
    "Do not use tools, files, network access, memory, or external product facts.",
    "Return exactly the requested JSON array and no other text.",
].join(" ");

mkdirSync(runsRoot, { recursive: false });
const temporaryCwd = mkdtempSync(join(tmpdir(), "cratis-docs-companion-eval-"));
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
                    condition === "COMPANION_SKILLS_WITH_OUTPUT_CONTRACT"
                        ? "skills"
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
                if (condition === "COMPANION_SKILLS_WITH_OUTPUT_CONTRACT")
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
                const output = result.stdout ?? "";
                writeFileSync(join(runRoot, "output.txt"), output);
                if (result.status !== 0)
                    writeFileSync(
                        join(runRoot, "failure.txt"),
                        result.stderr ?? "unknown failure",
                    );
                const metadata = {
                    schemaVersion: "1.0.0",
                    runId,
                    condition,
                    provider,
                    model,
                    repetition,
                    startedAt,
                    durationMilliseconds: Math.round(
                        performance.now() - started,
                    ),
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
                    throw new Error(
                        `Companion evaluation run failed: ${runId}`,
                    );
            }
        }
    }
    writeFileSync(
        join(runsRoot, "manifest.json"),
        `${JSON.stringify(
            {
                schemaVersion: "1.0.0",
                evaluationPass,
                sourceRevision: plan.sourceRevision,
                promptSha256: plan.promptSha256,
                runs,
            },
            null,
            2,
        )}\n`,
    );
} finally {
    rmSync(temporaryCwd, { recursive: true, force: true });
}
process.stdout.write(
    `Completed ${runs.length} ${evaluationPass} companion evaluation runs.\n`,
);
