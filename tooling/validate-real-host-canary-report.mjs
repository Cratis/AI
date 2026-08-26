#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    loadRealHostCanaryContracts,
    reportPayloadDigest,
    validateRealHostCanaryMatrix,
    validateRealHostCanaryReport,
} from "./real-host-canary-contract.mjs";
import {
    defaultRepositoryRoot,
    validateAgainstSchema,
} from "./catalog-validation.mjs";

export function validateCheckedInRealHostCanaryReports(
    root = defaultRepositoryRoot,
) {
    const contracts = loadRealHostCanaryContracts(root);
    const directory = join(root, "distribution/evidence");
    const names = readdirSync(directory)
        .filter((name) => name.startsWith("s9-") && name.endsWith(".json"))
        .sort();
    const errors = [];
    const reports = [];
    for (const name of names) {
        try {
            const report = JSON.parse(
                readFileSync(join(directory, name), "utf8"),
            );
            reports.push({ name, report });
            errors.push(
                ...validateAgainstSchema(
                    report,
                    contracts.reportSchema,
                    contracts.reportSchema,
                    name,
                ),
            );
            if (report.reportPayloadDigest !== reportPayloadDigest(report))
                errors.push(`${name}: report payload digest is stale`);
            if (
                JSON.stringify(report).includes("/Users/") ||
                JSON.stringify(report).includes("/home/")
            )
                errors.push(`${name}: report exposes a local user home path`);
        } catch (error) {
            errors.push(`${name}: cannot parse report: ${error.message}`);
        }
    }
    const caseIds = new Set();
    for (const { name, report } of reports) {
        if (caseIds.has(report.caseId))
            errors.push(`${name}: duplicate canary caseId ${report.caseId}`);
        caseIds.add(report.caseId);
    }
    for (const { name, report } of reports)
        if (report.supersededBy && !caseIds.has(report.supersededBy))
            errors.push(
                `${name}: supersededBy references unknown case ${report.supersededBy}`,
            );
    return errors;
}

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
        process.stderr.write(
            "Usage: node tooling/validate-real-host-canary-report.mjs <report.json>\n",
        );
        process.exitCode = 1;
    } else {
        const errors = validateRealHostCanaryReportFile(path);
        if (errors.length > 0) {
            for (const error of errors) process.stderr.write(`- ${error}\n`);
            process.exitCode = 1;
        } else
            process.stdout.write(
                "Real-host canary report validation passed.\n",
            );
    }
}
