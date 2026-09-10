// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function readJson(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

function listJsonDocuments(directory) {
    const documents = [];
    for (const entry of readdirSync(join(repositoryRoot, directory), {
        withFileTypes: true,
    })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) documents.push(...listJsonDocuments(path));
        else if (entry.name.endsWith(".json")) documents.push(path);
    }
    return documents;
}

function* stringValues(value, path = "") {
    if (typeof value === "string") yield [path, value];
    else if (Array.isArray(value))
        for (const [index, item] of value.entries())
            yield* stringValues(item, `${path}[${index}]`);
    else if (value && typeof value === "object")
        for (const [key, item] of Object.entries(value))
            yield* stringValues(item, path ? `${path}.${key}` : key);
}

const workflowReference = /^\.github\/workflows\/[A-Za-z0-9._-]+\.yml$/;

// A blocker code is only "resolved" when the repository state that would
// resolve it is actually observable. Nothing here trusts a state document's
// own claim about itself: each predicate reads the file that owns the fact.
const resolutionPredicates = new Map([
    [
        "NO_NPM_PACKAGE_OWNERSHIP_OR_TRUSTED_PUBLISHER",
        () => {
            const contract = readJson("distribution/npm-stage-contract.json");
            return (
                contract.package.publicOwnershipConfirmed === true &&
                contract.workflow.trustedPublisherConfigured === true
            );
        },
    ],
    [
        "NO_APPROVED_PUBLIC_TARGETS",
        () =>
            readJson("distribution/release-approvals.json").targetApprovals
                .length > 0,
    ],
    [
        "NO_APPROVED_PRODUCT_SOURCE_CONTRACTS",
        () =>
            readJson("distribution/release-approvals.json")
                .sourceContractApprovals.length > 0,
    ],
    [
        "NO_PRODUCTION_CANARY",
        () =>
            readJson("distribution/rollout-policy.json").canary
                .productionTargetsEnabled === true,
    ],
    [
        "NO_PRODUCTION_CANARY_OR_ROLLBACK_EVIDENCE",
        () =>
            readJson("distribution/rollout-policy.json").canary
                .productionTargetsEnabled === true,
    ],
]);

function blockerLists() {
    const remoteState = readJson("distribution/remote-repository-state.json");
    const rollout = readJson("distribution/rollout-policy.json");
    return [
        [
            "distribution/remote-repository-state.json:remainingBlockers",
            remoteState.remainingBlockers,
        ],
        [
            "distribution/rollout-policy.json:legacyRetirement.blockedOn",
            rollout.legacyRetirement.blockedOn,
        ],
    ];
}

test("no blocker is listed as remaining while the state that resolves it holds", () => {
    const lists = blockerLists();
    assert(lists.length > 0, "no blocker lists were found to cross-check");
    let checked = 0;
    for (const [origin, codes] of lists) {
        assert(
            Array.isArray(codes) && codes.length > 0,
            `${origin} carries no blocker codes; the cross-check would pass vacuously`,
        );
        for (const code of codes) {
            const predicate = resolutionPredicates.get(code);
            if (!predicate) continue;
            checked += 1;
            assert.equal(
                predicate(),
                false,
                `${origin} lists ${code} as remaining, but the repository state that resolves it holds`,
            );
        }
    }
    assert(
        checked >= 4,
        `only ${checked} blocker codes were cross-checked against a resolution predicate`,
    );
});

test("every blocker recorded as resolved is actually resolved", () => {
    const remoteState = readJson("distribution/remote-repository-state.json");
    const resolved = remoteState.resolvedBlockers ?? [];
    assert(
        resolved.length > 0,
        "remote-repository-state.json records no resolved blockers; the check would pass vacuously",
    );
    for (const entry of resolved) {
        const predicate = resolutionPredicates.get(entry.code);
        assert(
            predicate,
            `${entry.code} is recorded as resolved but has no resolution predicate`,
        );
        assert.equal(
            predicate(),
            true,
            `${entry.code} is recorded as resolved in remote-repository-state.json, but the state that resolves it does not hold`,
        );
        assert(
            typeof entry.recordedIn === "string" &&
                existsSync(join(repositoryRoot, entry.recordedIn)),
            `${entry.code} names a missing evidence file ${entry.recordedIn}`,
        );
    }
    const remaining = new Set(remoteState.remainingBlockers);
    for (const entry of resolved)
        assert.equal(
            remaining.has(entry.code),
            false,
            `${entry.code} is recorded as both remaining and resolved`,
        );
});

test("distribution state documents never name a workflow that does not exist", () => {
    // A `supersedingDecision` block is this repository's convention for text
    // that records a retired model on purpose, so it may name a deleted
    // workflow. Every other field is read as a claim about what runs today.
    let references = 0;
    let historical = 0;
    for (const document of listJsonDocuments("distribution")) {
        for (const [property, value] of stringValues(readJson(document))) {
            if (!workflowReference.test(value)) continue;
            if (property.split(".").includes("supersedingDecision")) {
                historical += 1;
                continue;
            }
            references += 1;
            assert(
                existsSync(join(repositoryRoot, value)),
                `${document}:${property} names ${value}, which does not exist; a field outside a supersedingDecision block must name a workflow that runs today`,
            );
        }
    }
    assert(
        references >= 3,
        `only ${references} live workflow references were examined; the scan is not seeing the state documents`,
    );
    assert(
        historical > 0,
        "no historical workflow references were seen; the supersedingDecision exemption is matching nothing",
    );
});

test("every workflow recorded as retired is really gone", () => {
    const retired = readJson(
        "distribution/generated-repository-contract.json",
    ).supersedingDecision.retired.filter((path) =>
        workflowReference.test(path),
    );
    assert(
        retired.length > 0,
        "no retired workflows are recorded; the sibling check would pass vacuously",
    );
    for (const path of retired)
        assert.equal(
            existsSync(join(repositoryRoot, path)),
            false,
            `${path} is recorded as retired but exists again; remove it from the retired list or delete the workflow`,
        );
});

test("the preview asset workflow asserts the readiness the generator produces", () => {
    const readinessPath = "distribution/preview-readiness.json";
    const readiness = readJson(readinessPath);
    const workflow = readFileSync(
        join(
            repositoryRoot,
            ".github/workflows/distribution-fundamentals-preview-assets.yml",
        ),
        "utf8",
    );
    const assertions = [
        ...workflow.matchAll(
            /require\('\.\/distribution\/preview-readiness\.json'\)\.([A-Za-z.]+)"\)"\s*=\s*"([^"]*)"/g,
        ),
    ];
    assert(
        assertions.length >= 3,
        `only ${assertions.length} readiness assertions were found in the preview asset workflow`,
    );
    for (const [, property, expected] of assertions) {
        const actual = property
            .split(".")
            .reduce((value, key) => value?.[key], readiness);
        assert.equal(
            String(actual),
            expected,
            `the workflow asserts ${relative(".", readinessPath)} ${property} is "${expected}", but the generated file carries "${String(actual)}"`,
        );
    }
});
