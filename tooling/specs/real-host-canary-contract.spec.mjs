// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { defaultRepositoryRoot } from "../catalog-validation.mjs";
import { smokePiDistributionFixture } from "../generate-distribution-fixture.mjs";
import { smokePiEngineeringFixture } from "../generate-engineering-distribution-fixture.mjs";
import {
    loadRealHostCanaryContracts,
    reportPayloadDigest,
    validateRealHostCanaryMatrix,
    validateRealHostCanaryReport,
} from "../real-host-canary-contract.mjs";

function clone(value) {
    return structuredClone(value);
}

test("real-host matrix is exact, deny-by-default, and version bound", () => {
    const contracts = loadRealHostCanaryContracts();
    assert.deepEqual(validateRealHostCanaryMatrix(contracts), []);
    assert.equal(contracts.matrix.realExecutionDefault, false);
    assert.deepEqual(
        contracts.matrix.hosts.map((host) => [host.id, host.expectedVersion]),
        [
            ["pi", "0.84.3"],
            ["claude", "2.1.245"],
            ["copilot", "1.0.80"],
            ["codex", "0.149.1"],
            ["gemini", "0.56.0"],
        ],
    );
    assert(
        contracts.matrix.hosts.every(
            (host) =>
                host.networkPolicy === "deny-required" &&
                host.credentialPolicy === "forbidden",
        ),
    );
});

test("ordinary specifications require explicit S9 opt-in before host execution", () => {
    for (const path of [
        "tooling/specs/distribution-fixture.spec.mjs",
        "tooling/specs/engineering-distribution-fixture.spec.mjs",
        "tooling/specs/fundamentals-preview-assets.spec.mjs",
    ])
        {
            const source = readFileSync(
                join(defaultRepositoryRoot, path),
                "utf8",
            );
            assert.doesNotMatch(source, /CRATIS_S9_REAL_HOST_CANARY/u);
            assert.match(source, /Real host execution/u);
        }
});

test("legacy smoke helpers cannot bypass the hardened S9 runner", () => {
    assert.throws(
        () => smokePiDistributionFixture("/unused", "/unused"),
        /moved to tooling\/run-real-host-canary/u,
    );
    assert.throws(
        () => smokePiEngineeringFixture("/unused", "/unused"),
        /moved to tooling\/run-real-host-canary/u,
    );
});

test("matrix rejects coordinated version, binding, and argv drift", () => {
    const contracts = clone(loadRealHostCanaryContracts());
    const pi = contracts.matrix.hosts.find((host) => host.id === "pi");
    pi.expectedVersion = "99.0.0";
    pi.versionPattern = "^99\\.0\\.0$";
    pi.bindingId = "openai-plugins-artifact-binding";
    pi.phases.install = ["install", "--unsafe", "<artifactRoot>"];
    const errors = validateRealHostCanaryMatrix(contracts);
    assert(errors.some((error) => error.includes("matrix differs")));
    assert(errors.some((error) => error.includes("binding identity")));
    assert(errors.some((error) => error.includes("exact expected version")));
    assert(errors.some((error) => error.includes("reviewed local fixture argv")));
});

test("report digest, phase closure, context, environment, and grant fields fail closed", () => {
    const contracts = loadRealHostCanaryContracts();
    const host = contracts.matrix.hosts[0];
    const command = {
        argv: ["/fake/pi", "--version"],
        cwd: "/tmp/consumer",
        environmentNames: ["HOME", "PATH"],
        exitCode: 0,
        timedOut: false,
        stdoutDigest: "1".repeat(64),
        stderrDigest: "2".repeat(64),
    };
    const report = {
        schemaVersion: "1.0.0",
        caseId: "s9-pi-fixture",
        state: "PASS_NON_SUPPORTING_FIXTURE",
        observedOn: "2026-08-25",
        sourceRevision: contracts.matrix.requiredSourceRevision,
        hostId: host.id,
        harnessId: host.harnessId,
        bindingId: host.bindingId,
        targetId: host.targetId,
        artifactVersion: "0.0.1-fixture",
        artifactRoot: host.artifactRoot,
        artifactDigest: "3".repeat(64),
        executable: "pi",
        resolvedExecutable: "/fake/pi",
        executableDigest: "4".repeat(64),
        expectedHostVersion: host.expectedVersion,
        observedHostVersion: host.expectedVersion,
        operatingSystem: "darwin",
        architecture: "arm64",
        runtimeVersion: "v23.11.1",
        isolation: "isolated-home-and-worktree",
        credentialMode: "forbidden",
        networkEnforcement: "sandbox-exec-deny-network",
        beforeContextDigest: "5".repeat(64),
        afterContextDigest: "5".repeat(64),
        phases: [
            "preflight",
            "artifact-validation",
            "negative-baseline",
            "collision-negative",
            "install",
            "discovery",
            "behavior-positive",
            "behavior-negative",
            "update",
            "rollback",
            "uninstall",
            "context-preservation",
            "cleanup",
        ].map((id) => {
            const pass = new Set([
                "preflight",
                "artifact-validation",
                "negative-baseline",
                "install",
                "uninstall",
                "context-preservation",
                "cleanup",
            ]).has(id);
            const commandRequired = new Set([
                "preflight",
                "negative-baseline",
                "install",
                "uninstall",
                "cleanup",
            ]).has(id);
            return {
                id,
                status: pass ? "PASS" : "BLOCKED_NO_REVIEWED_CONTRACT",
                supporting: false,
                reason: "fixture",
                command: commandRequired ? command : null,
            };
        }),
        limitations: ["fixture"],
        reportPayloadDigest: "0".repeat(64),
        installationEligible: false,
        marketplaceAvailabilityClaim: false,
        supportGranted: false,
        publicationGranted: false,
        runtimeGranted: false,
        promotionGranted: false,
    };
    report.reportPayloadDigest = reportPayloadDigest(report);
    assert.deepEqual(validateRealHostCanaryReport(report, contracts), []);

    const semanticallyFalse = clone(report);
    semanticallyFalse.resolvedExecutable = null;
    semanticallyFalse.executableDigest = null;
    semanticallyFalse.observedHostVersion = null;
    semanticallyFalse.networkEnforcement = "unavailable";
    semanticallyFalse.sourceRevision = "b".repeat(40);
    semanticallyFalse.phases.find(
        (phase) => phase.id === "discovery",
    ).status = "PASS";
    semanticallyFalse.reportPayloadDigest = reportPayloadDigest(
        semanticallyFalse,
    );
    const semanticErrors = validateRealHostCanaryReport(
        semanticallyFalse,
        contracts,
    );
    assert(
        semanticErrors.some((error) =>
            error.includes("source revision differs"),
        ),
    );
    assert(
        semanticErrors.some((error) =>
            error.includes("lacks exact executable"),
        ),
    );
    assert(
        semanticErrors.some((error) =>
            error.includes("must keep discovery blocked"),
        ),
    );

    report.phases[0].command.environmentNames.push("OPENAI_API_KEY");
    report.phases[1].supporting = true;
    report.afterContextDigest = "6".repeat(64);
    report.supportGranted = true;
    const errors = validateRealHostCanaryReport(report, contracts);
    assert(errors.some((error) => error.includes("payload digest is stale")));
    assert(errors.some((error) => error.includes("forbidden environment")));
    assert(errors.some((error) => error.includes("cannot support assurance")));
    assert(errors.some((error) => error.includes("changed project bytes")));
    assert(errors.some((error) => error.includes("cannot grant supportGranted")));
});
