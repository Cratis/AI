#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";

const toolingRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const specsRoot = join(toolingRoot, "specs");

export const governedOnlySpecBasenames = Object.freeze([
    "real-host-canary-contract.spec.mjs",
    "real-host-canary-runner.spec.mjs",
    "real-host-project-context-snapshot.spec.mjs",
    "release-approval.spec.mjs",
    "release-merge-topology.spec.mjs",
    "release-request.spec.mjs",
    "s10-release-gate.spec.mjs",
    "support-validation.spec.mjs",
]);

export function specsForMode(mode, root = specsRoot) {
    if (!new Set(["basic", "governed"]).has(mode))
        throw new Error(`Unknown specification mode: ${mode}`);
    const all = readdirSync(root)
        .filter((path) => path.endsWith(".spec.mjs"))
        .sort(compareOrdinal);
    const governedOnly = new Set(governedOnlySpecBasenames);
    for (const path of governedOnly)
        if (!all.includes(path))
            throw new Error(`Governed-only specification is missing: ${path}`);
    const selected =
        mode === "basic"
            ? all.filter((path) => !governedOnly.has(path))
            : all;
    return selected.map((path) => join(root, path));
}

function main() {
    const [argument] = process.argv.slice(2);
    let mode = null;
    if (argument === "--basic") mode = "basic";
    if (argument === "--governed") mode = "governed";
    if (!mode || process.argv.length !== 3) {
        process.stderr.write(
            "Usage: node tooling/run-spec-suite.mjs --basic|--governed\n",
        );
        process.exitCode = 1;
        return;
    }
    try {
        const specs = specsForMode(mode);
        process.stdout.write(
            `Running ${specs.length} ${mode} specification files.\n`,
        );
        execFileSync(process.execPath, ["--test", ...specs], {
            cwd: resolve(toolingRoot, ".."),
            stdio: "inherit",
        });
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Specification suite failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
