// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readJson(root, path) {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function duplicates(values) {
    const seen = new Set();
    return [
        ...new Set(
            values.filter((value) => seen.has(value) || !seen.add(value)),
        ),
    ];
}

function completeApproval(approval) {
    return (
        typeof approval.reviewer === "string" &&
        approval.reviewer.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(approval.approvedOn) &&
        /^[a-f0-9]{40}$/.test(approval.sourceRevision) &&
        /^[a-f0-9]{64}$/.test(approval.contentDigest) &&
        Array.isArray(approval.scope) &&
        approval.scope.length > 0 &&
        Array.isArray(approval.evidenceIds) &&
        approval.evidenceIds.length > 0
    );
}

export function validateReleaseApprovals(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    const approvals = readJson(
        repositoryRoot,
        "distribution/release-approvals.json",
    );
    const profiles = readJson(
        repositoryRoot,
        "distribution/profile-catalog.json",
    );
    const targets = readJson(repositoryRoot, "catalog/v2/targets.json").targets;
    const contracts = readJson(
        repositoryRoot,
        "catalog/v2/source-contracts.json",
    ).contracts;
    const evidenceIds = new Set(
        readJson(repositoryRoot, "catalog/v2/evidence.json").evidence.map(
            (evidence) => evidence.id,
        ),
    );
    if (
        approvals.schemaVersion !== "1.0.0" ||
        approvals.defaultPolicy !== "deny"
    )
        errors.push("Release approval catalog contract changed");
    const allProfiles = [
        ...profiles.publicProfiles,
        ...profiles.engineeringProfiles,
    ];
    const knownIdsByKind = new Map([
        ["profile", new Set(allProfiles.map((profile) => profile.id))],
        ["target", new Set(targets.map((target) => target.id))],
        ["source contract", new Set(contracts.map((contract) => contract.id))],
    ]);
    for (const [name, records, key] of [
        ["profile", approvals.profileApprovals, "profileId"],
        ["target", approvals.targetApprovals, "targetId"],
        ["source contract", approvals.sourceContractApprovals, "contractId"],
    ]) {
        if (!Array.isArray(records)) {
            errors.push(`Release ${name} approvals must be an array`);
            continue;
        }
        if (duplicates(records.map((record) => record[key])).length)
            errors.push(`Release approval catalog contains duplicate ${name}s`);
        for (const record of records) {
            if (!knownIdsByKind.get(name).has(record[key]))
                errors.push(`${record[key]}: unknown ${name} approval`);
            if (!completeApproval(record))
                errors.push(`${record[key]}: incomplete ${name} approval`);
            for (const evidenceId of record.evidenceIds ?? [])
                if (!evidenceIds.has(evidenceId))
                    errors.push(
                        `${record[key]}: unknown evidence ${evidenceId}`,
                    );
        }
    }
    const profileApprovals = new Map(
        approvals.profileApprovals.map((approval) => [
            approval.profileId,
            approval,
        ]),
    );
    for (const profile of allProfiles) {
        const approval = profileApprovals.get(profile.id);
        if ((profile.state === "approved") !== Boolean(approval))
            errors.push(
                `${profile.id}: profile approval state is inconsistent`,
            );
    }
    const targetApprovals = new Map(
        approvals.targetApprovals.map((approval) => [
            approval.targetId,
            approval,
        ]),
    );
    for (const target of targets) {
        const approval = targetApprovals.get(target.id);
        if ((target.approval.state === "approved") !== Boolean(approval))
            errors.push(`${target.id}: target approval state is inconsistent`);
        if (
            approval &&
            (target.approval.reviewer !== approval.reviewer ||
                target.approval.approvedOn !== approval.approvedOn ||
                target.approval.sourceRevision !== approval.sourceRevision ||
                target.approval.contentDigest !== approval.contentDigest ||
                JSON.stringify(target.approval.evidenceIds) !==
                    JSON.stringify(approval.evidenceIds))
        )
            errors.push(`${target.id}: generated target approval differs`);
    }
    const contractApprovals = new Map(
        approvals.sourceContractApprovals.map((approval) => [
            approval.contractId,
            approval,
        ]),
    );
    for (const contract of contracts) {
        const approval = contractApprovals.get(contract.id);
        const admitted =
            contract.verificationState === "verified" &&
            contract.distributionInputAllowed === true;
        if (admitted !== Boolean(approval))
            errors.push(
                `${contract.id}: source contract approval is inconsistent`,
            );
    }
    return [...new Set(errors)].sort();
}
