#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fileURLToPath } from "node:url";
import { validateSourceEvidenceContract } from "./source-evidence-loader.mjs";

export { validateSourceEvidenceContract } from "./source-evidence-loader.mjs";

function main() {
    const errors = validateSourceEvidenceContract();
    if (errors.length > 0) {
        process.stderr.write(
            `Source evidence contract validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Source evidence contract validation passed: contract-only registry has no admissions.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
