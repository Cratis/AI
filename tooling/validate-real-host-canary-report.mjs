#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    loadRealHostCanaryContracts,
    validateRealHostCanaryMatrix,
    validateRealHostCanaryReport,
} from "./real-host-canary-contract.mjs";

export function validateRealHostCanaryReportFile(path) {
    const contracts = loadRealHostCanaryContracts();
    const errors = validateRealHostCanaryMatrix(contracts);
    let report;
    try {
        report = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        return [...errors, `Cannot parse real-host report: ${error.message}`];
    }
    errors.push(...validateRealHostCanaryReport(report, contracts));
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const path = process.argv[2];
    if (!path) {
        process.stderr.write("Usage: node tooling/validate-real-host-canary-report.mjs <report.json>\n");
        process.exitCode = 1;
    } else {
        const errors = validateRealHostCanaryReportFile(path);
        if (errors.length > 0) {
            for (const error of errors) process.stderr.write(`- ${error}\n`);
            process.exitCode = 1;
        } else process.stdout.write("Real-host canary report validation passed.\n");
    }
}
