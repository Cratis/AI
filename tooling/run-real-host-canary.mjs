#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    writeFileSync,
    symlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { generateDistributionFixture } from "./generate-distribution-fixture.mjs";
import {
    commandEvidence,
    createIsolatedEnvironment,
    executableDigest,
    networkSandboxAvailable,
    resolveExecutable,
    runSandboxedCommand,
} from "./real-host-canary-adapters.mjs";
import {
    loadRealHostCanaryContracts,
    reportPayloadDigest,
    validateRealHostCanaryMatrix,
    validateRealHostCanaryReport,
} from "./real-host-canary-contract.mjs";
import { snapshotProjectContext } from "./real-host-project-context-snapshot.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const phaseIds = [
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
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function artifactInventory(root) {
    const files = [];
    const visit = (current) => {
        for (const name of readdirSync(current).sort(compareOrdinal)) {
            const absolute = join(current, name);
            const stat = lstatSync(absolute);
            const path = relative(root, absolute).split(sep).join("/");
            if (stat.isSymbolicLink())
                throw new Error(`Canary artifact contains symlink ${path}`);
            if (stat.isDirectory()) visit(absolute);
            else if (stat.isFile()) {
                const content = readFileSync(absolute);
                files.push({ path, size: content.length, sha256: sha256(content) });
            } else throw new Error(`Canary artifact contains special path ${path}`);
        }
    };
    visit(root);
    const digest = sha256(
        `${files.map((file) => `${file.path}\0${file.sha256}`).join("\n")}\n`,
    );
    return { files, digest };
}

function seedConsumer(root) {
    for (const path of [".cratis", ".agents", "unrelated", "empty-directory"])
        mkdirSync(join(root, path), { recursive: true });
    for (const [path, content] of [
        [".cratis/PROJECT.md", "private project context\n"],
        [".agents/PROJECT.md", "agent project context\n"],
        ["AGENTS.md", "project agents\n"],
        ["CLAUDE.md", "project claude\n"],
        ["GEMINI.md", "project gemini\n"],
        ["unrelated/file.txt", "unrelated\n"],
    ])
        writeFileSync(join(root, path), content);
    symlinkSync("file.txt", join(root, "unrelated/link.txt"));
}

function phase(id, status, reason, command = null) {
    return { id, status, supporting: false, reason, command };
}

function blockedPhases(status, reason) {
    return phaseIds.map((id) => phase(id, status, reason));
}

function replaceArtifactRoot(args, artifactRoot) {
    return args.map((argument) =>
        argument === "<artifactRoot>" ? artifactRoot : argument,
    );
}

function normalizeVersion(output) {
    return output.trim().split(/\r?\n/u)[0]?.trim() ?? "";
}

export function runRealHostCanary({
    hostId,
    outputPath,
    allowRealHost = false,
    root = repositoryRoot,
    commandPath,
    spawn,
    commandRunner = runSandboxedCommand,
    networkAvailable = networkSandboxAvailable(),
    environmentOptIn = process.env.CRATIS_S9_REAL_HOST_CANARY === "1",
    observedOn = new Date().toISOString().slice(0, 10),
}) {
    const contracts = loadRealHostCanaryContracts(root);
    const matrixErrors = validateRealHostCanaryMatrix(contracts);
    if (matrixErrors.length > 0)
        throw new Error(`Real-host matrix invalid: ${matrixErrors.join("; ")}`);
    const host = contracts.matrix.hosts.find((candidate) => candidate.id === hostId);
    if (!host) throw new Error(`Unknown real-host canary ${hostId}`);
    const runRoot = mkdtempSync(join(tmpdir(), `cratis-s9-${host.id}-`));
    try {
        const home = join(runRoot, "home");
        const temporaryRoot = join(runRoot, "tmp");
        const consumer = join(runRoot, "consumer");
        const fixture = join(runRoot, "fixture");
        for (const path of [home, temporaryRoot, consumer]) mkdirSync(path);
        seedConsumer(consumer);
        const before = snapshotProjectContext(consumer);
        generateDistributionFixture({
            repositoryRoot: root,
            outputRoot: fixture,
            version: "0.0.1-fixture",
        });
        const artifactRoot = realpathSync(join(fixture, host.artifactRoot));
        const artifact = artifactInventory(artifactRoot);
        const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: root,
            encoding: "utf8",
        }).trim();
        const resolvedExecutable = commandPath
            ? resolveExecutable(commandPath, dirname(commandPath))
            : resolveExecutable(host.executable);
        const base = {
            schemaVersion: "1.0.0",
            caseId: `s9-${host.id}-local-fixture`,
            state: "BLOCKED",
            observedOn,
            sourceRevision,
            hostId: host.id,
            harnessId: host.harnessId,
            bindingId: host.bindingId,
            targetId: host.targetId,
            artifactVersion: "0.0.1-fixture",
            artifactRoot: host.artifactRoot,
            artifactDigest: artifact.digest,
            executable: host.executable,
            resolvedExecutable,
            executableDigest: resolvedExecutable
                ? executableDigest(resolvedExecutable)
                : null,
            expectedHostVersion: host.expectedVersion,
            observedHostVersion: null,
            operatingSystem: process.platform,
            architecture: process.arch,
            runtimeVersion: process.version,
            isolation: "isolated-home-and-worktree",
            credentialMode: "forbidden",
            networkEnforcement: networkAvailable
                ? "sandbox-exec-deny-network"
                : "unavailable",
            beforeContextDigest: before.digest,
            afterContextDigest: before.digest,
            phases: [],
            limitations: [
                "The tested artifact is a synthetic local fixture and cannot satisfy install-tested or higher support assurance.",
                "Package listing is not treated as skill discovery.",
                "No positive or negative model behavior case is admitted.",
                "No genuine host-managed update or rollback contract is admitted.",
            ],
            reportPayloadDigest: "0".repeat(64),
            installationEligible: false,
            marketplaceAvailabilityClaim: false,
            supportGranted: false,
            publicationGranted: false,
            runtimeGranted: false,
            promotionGranted: false,
        };
        if (!resolvedExecutable) {
            base.phases = blockedPhases(
                "BLOCKED_HOST_NOT_INSTALLED",
                "Exact host executable is not installed.",
            );
        } else if (!allowRealHost || !environmentOptIn) {
            base.phases = blockedPhases(
                "BLOCKED_NOT_RUN",
                "Real-host execution requires both environment and API opt-in.",
            );
        } else if (!networkAvailable) {
            base.phases = blockedPhases(
                "BLOCKED_NETWORK_ENFORCEMENT_UNAVAILABLE",
                "OS-level denied egress is unavailable.",
            );
        } else {
            const environment = createIsolatedEnvironment({
                executable: resolvedExecutable,
                home,
                temporaryRoot,
            });
            const execute = (args) =>
                commandRunner({
                    executable: resolvedExecutable,
                    args,
                    cwd: consumer,
                    environment,
                    spawn,
                });
            const versionCommand = execute(host.versionArgs);
            const observedVersion = normalizeVersion(
                versionCommand.stdout || versionCommand.stderr,
            );
            base.observedHostVersion = observedVersion;
            if (!new RegExp(host.versionPattern, "u").test(observedVersion)) {
                base.phases = blockedPhases(
                    "BLOCKED_HOST_VERSION_MISMATCH",
                    `Installed version does not match ${host.expectedVersion}.`,
                );
                base.phases[0] = phase(
                    "preflight",
                    "BLOCKED_HOST_VERSION_MISMATCH",
                    `Observed ${observedVersion || "no version"}.`,
                    commandEvidence(versionCommand),
                );
            } else if (host.id !== "pi") {
                base.phases = blockedPhases(
                    "BLOCKED_NO_REVIEWED_CONTRACT",
                    "This host has no hardened reviewed local lifecycle argv.",
                );
            } else {
                const commands = {};
                commands.version = versionCommand;
                commands.baseline = execute(host.phases.list);
                commands.install = execute(
                    replaceArtifactRoot(host.phases.install, artifactRoot),
                );
                commands.list = execute(host.phases.list);
                commands.uninstall = execute(
                    replaceArtifactRoot(host.phases.uninstall, artifactRoot),
                );
                commands.cleanup = execute(host.phases.list);
                const baselineAbsent =
                    commands.baseline.exitCode === 0 &&
                    !commands.baseline.stdout.includes(artifactRoot);
                const installed =
                    commands.install.exitCode === 0 &&
                    commands.list.exitCode === 0 &&
                    commands.list.stdout.includes(artifactRoot);
                const removed =
                    commands.uninstall.exitCode === 0 &&
                    commands.cleanup.exitCode === 0 &&
                    !commands.cleanup.stdout.includes(artifactRoot);
                const after = snapshotProjectContext(consumer);
                base.afterContextDigest = after.digest;
                base.phases = [
                    phase("preflight", "PASS", "Exact Pi version and denied egress confirmed.", commandEvidence(commands.version)),
                    phase("artifact-validation", "PASS", "Synthetic passive fixture inventory validated."),
                    phase("negative-baseline", baselineAbsent ? "PASS" : "FAIL", "Candidate package was absent before install.", commandEvidence(commands.baseline)),
                    phase("collision-negative", "BLOCKED_NO_REVIEWED_CONTRACT", "Pi package collision semantics are not admitted."),
                    phase("install", installed ? "PASS" : "FAIL", "Local fixture package install and package listing checked.", commandEvidence(commands.install)),
                    phase("discovery", "BLOCKED_NO_REVIEWED_CONTRACT", "Pi package listing is not skill discovery proof.", commandEvidence(commands.list)),
                    phase("behavior-positive", "BLOCKED_NO_REVIEWED_CONTRACT", "No positive behavior contract is admitted."),
                    phase("behavior-negative", "BLOCKED_NO_REVIEWED_CONTRACT", "No negative behavior contract is admitted."),
                    phase("update", "BLOCKED_NO_REVIEWED_CONTRACT", "No genuine update contract is admitted."),
                    phase("rollback", "BLOCKED_NO_REVIEWED_CONTRACT", "No genuine rollback contract is admitted."),
                    phase("uninstall", removed ? "PASS" : "FAIL", "Local fixture package removal checked.", commandEvidence(commands.uninstall)),
                    phase("context-preservation", before.digest === after.digest ? "PASS" : "FAIL", "Complete consumer context snapshot compared."),
                    phase("cleanup", removed ? "PASS" : "FAIL", "No package registration remained in isolated home.", commandEvidence(commands.cleanup)),
                ];
                base.state = baselineAbsent && installed && removed && before.digest === after.digest
                    ? "PASS_NON_SUPPORTING_FIXTURE"
                    : "FAIL";
            }
        }
        base.reportPayloadDigest = reportPayloadDigest(base);
        const errors = validateRealHostCanaryReport(base, contracts);
        if (errors.length > 0)
            throw new Error(`Real-host report invalid: ${errors.join("; ")}`);
        if (outputPath)
            writeFileSync(outputPath, `${JSON.stringify(base, null, 2)}\n`, {
                flag: "wx",
            });
        return Object.freeze(base);
    } finally {
        rmSync(runRoot, { recursive: true, force: true });
    }
}

function parseArguments(argv) {
    const options = { allowRealHost: false };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        if (value === "--host") options.hostId = argv[++index];
        else if (value === "--output") options.outputPath = argv[++index];
        else if (value === "--allow-real-host") options.allowRealHost = true;
        else throw new Error(`Unknown argument ${value}`);
    }
    if (!options.hostId) throw new Error("--host is required");
    if (!options.outputPath) throw new Error("--output is required");
    return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (
            options.allowRealHost &&
            process.env.CRATIS_S9_REAL_HOST_CANARY !== "1"
        )
            throw new Error(
                "--allow-real-host requires CRATIS_S9_REAL_HOST_CANARY=1",
            );
        const report = runRealHostCanary(options);
        process.stdout.write(`${report.state}\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
