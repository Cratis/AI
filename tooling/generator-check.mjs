// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";

// The read-only half of the README validation gate. A generator builds its
// outputs in memory and this compares them byte for byte with the tracked
// files, so the gate can run on a clean checkout without dirtying the tree and
// a contributor can tell their own edits from generator drift.
//
// Exit codes are the repository's usual three: 0 ran clean, 1 found drift,
// 2 could not run. "Could not run" is never reported as a pass.
export const generatorCheckExitCodes = Object.freeze({
    current: 0,
    drift: 1,
    couldNotRun: 2,
});

export function checkModeRequested(argv = process.argv.slice(2)) {
    return argv.includes("--check");
}

export function serializeJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function asBuffer(content) {
    return Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
}

// `build` returns either a Map of repository-relative path to expected bytes,
// or `{ outputs, unexpected }` when the generator also owns the inventory of
// its output directory. It must not write.
export function runGeneratorCheck({ name, root, build }) {
    let result = null;
    try {
        result = build();
    } catch (error) {
        process.stderr.write(
            `${name} --check could not run: ${
                error instanceof Error ? error.message : String(error)
            }\n`,
        );
        return generatorCheckExitCodes.couldNotRun;
    }
    const outputs = result instanceof Map ? result : result.outputs;
    const unexpected = result instanceof Map ? [] : (result.unexpected ?? []);
    const drifted = [...unexpected];
    for (const [path, expected] of outputs) {
        let actual = null;
        try {
            actual = readFileSync(join(root, path));
        } catch {
            drifted.push(path);
            continue;
        }
        if (!actual.equals(asBuffer(expected))) drifted.push(path);
    }
    if (drifted.length > 0) {
        process.stderr.write(
            `${name} --check found ${drifted.length} stale generated output(s):\n`,
        );
        for (const path of [...new Set(drifted)].sort(compareOrdinal))
            process.stderr.write(`- ${path}\n`);
        return generatorCheckExitCodes.drift;
    }
    process.stdout.write(
        `${name} --check: ${outputs.size} generated output(s) are current.\n`,
    );
    return generatorCheckExitCodes.current;
}
