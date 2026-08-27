// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    chmodSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { defaultRepositoryRoot } from "../catalog-validation.mjs";
import { reportPayloadDigest } from "../real-host-canary-contract.mjs";
import { runRealHostCanary } from "../run-real-host-canary.mjs";
import {
    validateCheckedInRealHostCanaryReports,
    validateRealHostCanaryReportFile,
} from "../validate-real-host-canary-report.mjs";

function digest(value) {
    return createHash("sha256").update(value).digest("hex");
}

function fakeCommandRunner() {
    let installedRoot = null;
    return ({ executable, args, cwd, environment }) => {
        assert(
            environment.PATH.split(delimiter).includes(
                dirname(process.execPath),
            ),
        );
        let stdout = "";
        if (args[0] === "--version") stdout = "0.84.3\n";
        else if (args[0] === "install") installedRoot = args[1];
        else if (args[0] === "remove") installedRoot = null;
        else if (args[0] === "list")
            stdout = installedRoot
                ? `Installed package: ${installedRoot}\n`
                : "No packages installed\n";
        return {
            argv: [executable, ...args],
            cwd,
            environmentNames: Object.keys(environment).sort(),
            exitCode: 0,
            timedOut: false,
            stdout,
            stderr: "",
            stdoutDigest: digest(stdout),
            stderrDigest: digest(""),
            error: null,
        };
    };
}

test("runner is blocked without an installed executable", () => {
    const report = runRealHostCanary({
        hostId: "pi",
        attemptId: "missing-executable",
        commandPath: "/missing/pi",
        networkAvailable: true,
    });
    assert.equal(report.state, "BLOCKED");
    assert(
        report.phases.every(
            (phase) => phase.status === "BLOCKED_HOST_NOT_INSTALLED",
        ),
    );
    assert.equal(report.supportGranted, false);
});

test("runner executes no host command until both opt-ins are present", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-s9-no-opt-in-"));
    try {
        const executable = join(root, "pi");
        writeFileSync(executable, "#!/bin/sh\nexit 0\n");
        chmodSync(executable, 0o755);
        let calls = 0;
        const report = runRealHostCanary({
            hostId: "pi",
            attemptId: "no-opt-in",
            commandPath: executable,
            allowRealHost: true,
            environmentOptIn: false,
            networkAvailable: true,
            commandRunner: () => {
                calls += 1;
                throw new Error("must not execute");
            },
        });
        assert.equal(calls, 0);
        assert.equal(report.state, "BLOCKED");
        assert(
            report.phases.every((phase) => phase.status === "BLOCKED_NOT_RUN"),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("exact Pi fixture canary records non-supporting local lifecycle under explicit isolation", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-s9-fake-pi-"));
    try {
        const executable = join(root, "pi");
        const output = join(root, "report.json");
        writeFileSync(executable, "#!/bin/sh\nexit 0\n");
        chmodSync(executable, 0o755);
        const report = runRealHostCanary({
            hostId: "pi",
            attemptId: "fixture-success",
            outputPath: output,
            commandPath: executable,
            allowRealHost: true,
            environmentOptIn: true,
            networkAvailable: true,
            observedOn: "2026-09-01",
            commandRunner: fakeCommandRunner(),
        });
        assert.equal(report.state, "PASS_NON_SUPPORTING_FIXTURE");
        assert.equal(report.observedOn, "2026-09-01");
        for (const id of [
            "preflight",
            "artifact-validation",
            "negative-baseline",
            "install",
            "uninstall",
            "context-preservation",
            "cleanup",
        ])
            assert.equal(
                report.phases.find((phase) => phase.id === id).status,
                "PASS",
            );
        for (const id of [
            "collision-negative",
            "discovery",
            "behavior-positive",
            "behavior-negative",
            "update",
            "rollback",
        ])
            assert.equal(
                report.phases.find((phase) => phase.id === id).status,
                "BLOCKED_NO_REVIEWED_CONTRACT",
            );
        assert(
            report.phases
                .flatMap((phase) => phase.command?.environmentNames ?? [])
                .every(
                    (name) =>
                        !/(?:TOKEN|KEY|SECRET|AUTH|PROXY|CREDENTIAL)/iu.test(
                            name,
                        ),
                ),
        );
        assert.equal(report.beforeContextDigest, report.afterContextDigest);
        assert.equal(report.supportGranted, false);
        assert.deepEqual(validateRealHostCanaryReportFile(output), []);
        assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), report);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("checked-in canary reports have unique identities and path-neutral evidence", () => {
    assert.deepEqual(validateCheckedInRealHostCanaryReports(), []);
});

test("checked-in Pi attempts preserve blocked history and non-supporting success", () => {
    const blockedPath = join(
        defaultRepositoryRoot,
        "distribution/evidence/s9-pi-attempt-1-blocked-2026-08-25.json",
    );
    const supersededPath = join(
        defaultRepositoryRoot,
        "distribution/evidence/s9-pi-attempt-2-superseded-2026-08-26.json",
    );
    const successPath = join(
        defaultRepositoryRoot,
        "distribution/evidence/s9-pi-attempt-3-current-2026-08-26.json",
    );
    assert(
        validateRealHostCanaryReportFile(blockedPath).some((error) =>
            error.includes(
                "does not descend from the reviewed runner baseline",
            ),
        ),
    );
    assert(
        validateRealHostCanaryReportFile(supersededPath).some((error) =>
            error.includes(
                "does not descend from the reviewed runner baseline",
            ),
        ),
    );
    assert.deepEqual(validateRealHostCanaryReportFile(successPath), []);
    const blocked = JSON.parse(readFileSync(blockedPath, "utf8"));
    const superseded = JSON.parse(readFileSync(supersededPath, "utf8"));
    const success = JSON.parse(readFileSync(successPath, "utf8"));
    assert.equal(blocked.state, "BLOCKED");
    assert.equal(blocked.observedHostVersion, null);
    assert.equal(blocked.attemptId, "attempt-1");
    assert.equal(blocked.supersededBy, "s9-pi-local-fixture-attempt-2");
    assert.equal(superseded.state, "PASS_NON_SUPPORTING_FIXTURE");
    assert.equal(superseded.attemptId, "attempt-2");
    assert.equal(superseded.supersededBy, "s9-pi-local-fixture-attempt-3");
    assert.equal(success.state, "PASS_NON_SUPPORTING_FIXTURE");
    assert.equal(success.attemptId, "attempt-3");
    assert.equal(success.supersededBy, null);
    assert.equal(blocked.reportPayloadDigest, reportPayloadDigest(blocked));
    assert.equal(
        superseded.reportPayloadDigest,
        reportPayloadDigest(superseded),
    );
    assert.equal(success.reportPayloadDigest, reportPayloadDigest(success));
    assert.equal(success.observedHostVersion, "0.84.3");
    assert.equal(success.observedOn, "2026-08-26");
    assert(success.phases.every((phase) => phase.supporting === false));
    for (const field of [
        "installationEligible",
        "marketplaceAvailabilityClaim",
        "supportGranted",
        "publicationGranted",
        "runtimeGranted",
        "promotionGranted",
    ])
        assert.equal(success[field], false);
});

test("checked-in non-Pi preflights preserve exact version mismatches without lifecycle execution", () => {
    for (const [host, expectedObserved] of [
        ["claude", "2.1.235 (Claude Code)"],
        ["copilot", "GitHub Copilot CLI 1.0.67."],
        ["codex", "codex-cli 0.147.0"],
        ["gemini", "0.33.1"],
    ]) {
        const path = join(
            defaultRepositoryRoot,
            "distribution/evidence",
            `s9-${host}-version-preflight-blocked-2026-08-26.json`,
        );
        assert.deepEqual(validateRealHostCanaryReportFile(path), []);
        const report = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(report.state, "BLOCKED");
        assert.equal(report.attemptId, "version-preflight-1");
        assert.equal(report.supersededBy, null);
        assert.equal(report.observedHostVersion, expectedObserved);
        assert.equal(report.phases[0].status, "BLOCKED_HOST_VERSION_MISMATCH");
        assert(
            report.phases
                .slice(1)
                .every(
                    (phase) =>
                        phase.status === "BLOCKED_HOST_VERSION_MISMATCH" &&
                        phase.command === null,
                ),
        );
        assert.equal(report.supportGranted, false);
    }
});

test("version mismatch blocks every real lifecycle phase", () => {
    const root = mkdtempSync(join(tmpdir(), "cratis-s9-wrong-pi-"));
    try {
        const executable = join(root, "pi");
        writeFileSync(executable, "#!/bin/sh\nexit 0\n");
        chmodSync(executable, 0o755);
        const report = runRealHostCanary({
            hostId: "pi",
            attemptId: "version-mismatch",
            commandPath: executable,
            allowRealHost: true,
            environmentOptIn: true,
            networkAvailable: true,
            commandRunner: ({
                executable: command,
                args,
                cwd,
                environment,
            }) => {
                const stdout = args[0] === "--version" ? "0.84.2\n" : "";
                return {
                    argv: [command, ...args],
                    cwd,
                    environmentNames: Object.keys(environment).sort(),
                    exitCode: 0,
                    timedOut: false,
                    stdout,
                    stderr: "",
                    stdoutDigest: digest(stdout),
                    stderrDigest: digest(""),
                    error: null,
                };
            },
        });
        assert.equal(report.state, "BLOCKED");
        assert.equal(report.phases[0].status, "BLOCKED_HOST_VERSION_MISMATCH");
        assert(
            report.phases
                .slice(1)
                .every(
                    (phase) => phase.status === "BLOCKED_HOST_VERSION_MISMATCH",
                ),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
