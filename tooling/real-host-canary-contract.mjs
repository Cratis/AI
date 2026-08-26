// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { compareOrdinal } from "./catalog-ordering.mjs";

export const realHostCanaryPaths = Object.freeze({
    matrix: "distribution/real-host-canary-matrix.json",
    matrixSchema: "distribution/real-host-canary-matrix.schema.json",
    reportSchema: "distribution/real-host-canary-report.schema.json",
    bindings: "distribution/ecosystem-artifact-bindings.json",
    hostAdapters: "catalog/host-adapters.json",
});

const expectedMatrixAnchor =
    "651045fa37b280f94bdc747e4c4893bb5d4b8d97670314bdc59320132abf65fe";
const expectedSourceRevision =
    "1a9af3d8b6e10ee61f390c4e6a5c73bde109379d";
const expectedHostVersions = new Map([
    ["pi", "0.84.3"],
    ["claude", "2.1.245"],
    ["copilot", "1.0.80"],
    ["codex", "0.149.1"],
    ["gemini", "0.56.0"],
]);
const expectedPhaseIds = [
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
const allowedEnvironmentNames = new Set([
    "HOME",
    "LANG",
    "LC_ALL",
    "NO_COLOR",
    "PATH",
    "TMPDIR",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
]);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function matrixAnchor(hosts) {
    return sha256(
        `${[...hosts]
            .sort((left, right) => compareOrdinal(left.id, right.id))
            .map((host) => JSON.stringify(host))
            .join("\n")}\n`,
    );
}

function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
    if (value && typeof value === "object")
        return `{${Object.keys(value)
            .sort(compareOrdinal)
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
            )
            .join(",")}}`;
    return JSON.stringify(value);
}

export function reportPayloadDigest(report) {
    const { reportPayloadDigest: _digest, ...payload } = report;
    return sha256(canonicalJson(payload));
}

export function loadRealHostCanaryContracts(root = defaultRepositoryRoot) {
    return {
        matrix: readCatalog(join(root, realHostCanaryPaths.matrix)),
        matrixSchema: readCatalog(join(root, realHostCanaryPaths.matrixSchema)),
        reportSchema: readCatalog(join(root, realHostCanaryPaths.reportSchema)),
        bindings: readCatalog(join(root, realHostCanaryPaths.bindings)),
        hostAdapters: readCatalog(join(root, realHostCanaryPaths.hostAdapters)),
    };
}

export function validateRealHostCanaryMatrix(
    contracts = loadRealHostCanaryContracts(),
) {
    const errors = [
        ...validateSchemaVocabulary(contracts.matrixSchema),
        ...validateSchemaVocabulary(contracts.reportSchema),
        ...validateAgainstSchema(
            contracts.matrix,
            contracts.matrixSchema,
            contracts.matrixSchema,
        ),
    ];
    if (
        matrixAnchor(contracts.matrix.hosts) !== expectedMatrixAnchor ||
        contracts.matrix.requiredSourceRevision !== expectedSourceRevision
    )
        errors.push("real-host canary matrix differs from the reviewed anchor");
    const bindingsById = new Map(
        contracts.bindings.bindings.map((binding) => [binding.id, binding]),
    );
    const adaptersById = new Map(
        contracts.hostAdapters.hosts.map((adapter) => [
            adapter.serving.artifactBindingId,
            adapter,
        ]),
    );
    const seen = new Set();
    for (const host of contracts.matrix.hosts) {
        if (seen.has(host.id)) errors.push(`duplicate canary host ${host.id}`);
        seen.add(host.id);
        const binding = bindingsById.get(host.bindingId);
        if (
            !binding ||
            binding.harnessId !== host.harnessId ||
            binding.targetId !== host.targetId
        )
            errors.push(`${host.id}: binding identity changed`);
        if (
            expectedHostVersions.get(host.id) !== host.expectedVersion ||
            adaptersById.get(host.bindingId)?.product.clientVersion !==
                host.expectedVersion
        )
            errors.push(`${host.id}: exact expected version changed`);
        if (
            host.id !== "pi" &&
            Object.values(host.phases).some((argv) => argv.length > 0)
        )
            errors.push(`${host.id}: unreviewed real-host argv was added`);
        if (
            host.id === "pi" &&
            JSON.stringify(host.phases) !==
                JSON.stringify({
                    install: ["install", "<artifactRoot>"],
                    list: ["list"],
                    uninstall: ["remove", "<artifactRoot>"],
                })
        )
            errors.push("pi: reviewed local fixture argv changed");
    }
    return errors;
}

export function validateRealHostCanaryReport(
    report,
    contracts = loadRealHostCanaryContracts(),
    root = defaultRepositoryRoot,
) {
    const errors = [
        ...validateAgainstSchema(
            report,
            contracts.reportSchema,
            contracts.reportSchema,
        ),
    ];
    const host = contracts.matrix.hosts.find(
        (candidate) => candidate.id === report.hostId,
    );
    if (
        !host ||
        host.harnessId !== report.harnessId ||
        host.bindingId !== report.bindingId ||
        host.targetId !== report.targetId ||
        host.expectedVersion !== report.expectedHostVersion
    )
        errors.push("real-host report does not match its matrix identity");
    if (report.reportPayloadDigest !== reportPayloadDigest(report))
        errors.push("real-host report payload digest is stale");
    try {
        execFileSync(
            "git",
            [
                "merge-base",
                "--is-ancestor",
                contracts.matrix.requiredSourceRevision,
                report.sourceRevision,
            ],
            { cwd: root, stdio: "pipe" },
        );
    } catch {
        errors.push(
            "real-host report source revision does not descend from the reviewed runner baseline",
        );
    }
    const phaseIds = report.phases.map((phase) => phase.id);
    if (
        JSON.stringify([...phaseIds].sort(compareOrdinal)) !==
        JSON.stringify([...expectedPhaseIds].sort(compareOrdinal))
    )
        errors.push("real-host report phase inventory is incomplete");
    const phasesById = new Map(
        report.phases.map((phase) => [phase.id, phase]),
    );
    for (const phase of report.phases) {
        if (phase.supporting)
            errors.push(`${phase.id}: fixture canary cannot support assurance`);
        if (
            phase.command?.environmentNames.some(
                (name) => !allowedEnvironmentNames.has(name),
            )
        )
            errors.push(`${phase.id}: command inherited a forbidden environment`);
        if (
            phase.status === "PASS" &&
            phase.command &&
            phase.command.exitCode !== 0
        )
            errors.push(`${phase.id}: passing command did not exit zero`);
    }
    const passState = report.state === "PASS_NON_SUPPORTING_FIXTURE";
    if (passState) {
        if (
            report.hostId !== "pi" ||
            !report.resolvedExecutable ||
            !report.executableDigest ||
            report.observedHostVersion !== report.expectedHostVersion ||
            report.networkEnforcement !== "sandbox-exec-deny-network"
        )
            errors.push(
                "passing real-host report lacks exact executable, version, or egress identity",
            );
        const requiredPass = [
            "preflight",
            "artifact-validation",
            "negative-baseline",
            "install",
            "uninstall",
            "context-preservation",
            "cleanup",
        ];
        const requiredBlocked = [
            "collision-negative",
            "discovery",
            "behavior-positive",
            "behavior-negative",
            "update",
            "rollback",
        ];
        for (const id of requiredPass)
            if (phasesById.get(id)?.status !== "PASS")
                errors.push(`passing real-host report requires ${id}`);
        for (const id of requiredBlocked)
            if (
                phasesById.get(id)?.status !==
                "BLOCKED_NO_REVIEWED_CONTRACT"
            )
                errors.push(`fixture report must keep ${id} blocked`);
        for (const id of [
            "preflight",
            "negative-baseline",
            "install",
            "uninstall",
            "cleanup",
        ])
            if (!phasesById.get(id)?.command)
                errors.push(`passing real-host report lacks ${id} command evidence`);
    } else if (
        report.state === "BLOCKED" &&
        report.phases.some((phase) => phase.status === "PASS")
    )
        errors.push("blocked real-host report cannot contain passing phases");
    const contextPhase = phasesById.get("context-preservation");
    if (
        contextPhase?.status === "PASS" &&
        report.beforeContextDigest !== report.afterContextDigest
    )
        errors.push("context-preservation passed with changed project bytes");
    for (const field of [
        "installationEligible",
        "marketplaceAvailabilityClaim",
        "supportGranted",
        "publicationGranted",
        "runtimeGranted",
        "promotionGranted",
    ])
        if (report[field]) errors.push(`real-host report cannot grant ${field}`);
    return errors;
}
