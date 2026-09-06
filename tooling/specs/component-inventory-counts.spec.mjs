// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildCandidateComponentCoverage } from "../candidate-component-coverage.mjs";
import { defaultRepositoryRoot } from "../catalog-validation.mjs";
import {
    assertComponentInventorySeals,
    componentInventoryCounts,
    componentInventorySealMismatches,
    componentInventorySealPath,
    readComponentInventorySeals,
} from "../component-inventory-counts.mjs";

function clone(value) {
    return structuredClone(value);
}

function realCounts() {
    return componentInventoryCounts(buildCandidateComponentCoverage().records);
}

test("the reviewed seal matches the real inventory, and says how large it is", () => {
    const seals = readComponentInventorySeals();
    const counts = realCounts();
    assert.deepEqual(componentInventorySealMismatches(counts, seals), []);
    // Non-vacuity: a seal comparison over an empty corpus would agree with anything.
    assert(counts.componentCount > 0);
    assert(Object.keys(counts.byKind).length > 0);
    assert(Object.keys(counts.byDisposition).length > 0);
    assert.equal(counts.componentCount, seals.componentCount);
});

test("the seal still bites: every drifted value is reported by name", () => {
    const counts = realCounts();

    const grown = clone(readComponentInventorySeals());
    grown.componentCount -= 1;
    assert.deepEqual(componentInventorySealMismatches(counts, grown), [
        `componentCount: reviewed ${grown.componentCount} but the inventory has ${counts.componentCount}`,
        `the seal is internally inconsistent: byKind sums to ${counts.componentCount} but componentCount is ${grown.componentCount}`,
    ]);

    const kindDrift = clone(readComponentInventorySeals());
    kindDrift.byKind.skill += 1;
    kindDrift.componentCount += 1;
    assert(
        componentInventorySealMismatches(counts, kindDrift).some((error) =>
            error.startsWith(
                `byKind.skill: reviewed ${kindDrift.byKind.skill} but the inventory has`,
            ),
        ),
    );

    const dispositionDrift = clone(readComponentInventorySeals());
    dispositionDrift.byDisposition["executable-blocked"] += 1;
    assert(
        componentInventorySealMismatches(counts, dispositionDrift).some(
            (error) => error.startsWith("byDisposition.executable-blocked:"),
        ),
    );

    const skillDrift = clone(readComponentInventorySeals());
    skillDrift.skillDispositionCount += 1;
    assert(
        componentInventorySealMismatches(counts, skillDrift).some((error) =>
            error.startsWith("skillDispositionCount:"),
        ),
    );
});

test("a kind or disposition the seal never reviewed cannot pass unnoticed", () => {
    const seals = readComponentInventorySeals();

    const unreviewedKind = clone(realCounts());
    unreviewedKind.byKind["fixture-kind"] = 2;
    assert(
        componentInventorySealMismatches(unreviewedKind, seals).some((error) =>
            error.includes(
                "byKind.fixture-kind: the inventory has 2 of a kind the seal does not review",
            ),
        ),
    );

    const unreviewedDisposition = clone(realCounts());
    unreviewedDisposition.byDisposition["fixture-disposition"] = 1;
    assert(
        componentInventorySealMismatches(unreviewedDisposition, seals).some(
            (error) =>
                error.includes(
                    "byDisposition.fixture-disposition: the inventory has 1 of a disposition the seal neither reviews nor declares floating",
                ),
        ),
    );

    // The two candidate dispositions move without the corpus changing size, so they are declared
    // floating and must stay exempt — otherwise promoting one skill would demand a seal review.
    for (const disposition of seals.floatingDispositions.ids)
        assert.equal(disposition in seals.byDisposition, false);
    assert.deepEqual(componentInventorySealMismatches(realCounts(), seals), []);
});

test("the coverage builder refuses to emit a document that outgrew its seal", () => {
    const counts = clone(realCounts());
    counts.componentCount += 1;
    assert.throws(
        () => assertComponentInventorySeals(counts),
        (error) =>
            error.message.includes(componentInventorySealPath) &&
            error.message.includes("componentCount: reviewed"),
    );
});

// The whole point of the seal is that the corpus size is written down once. A literal that creeps
// back into a consumer restores the eight-copies-that-must-agree problem this replaced, and it does
// so silently — nothing else would fail — so the seal needs a sibling check that fails when one
// reappears. It matches only `componentCount`, the number that was actually duplicated eight ways
// and the one Cratis/AI#260 says a grep must stop finding: the smaller per-kind counts collide with
// ordinary array lengths and indexes, and a matcher with false positives is one people learn to
// ignore. Comments and JSON `$comment` prose are stripped, because explaining a removed literal is
// exactly what those are for.
test("no consumer restates the corpus size as a literal", () => {
    const size = readComponentInventorySeals().componentCount;
    const consumers = [
        "tooling/candidate-component-coverage.mjs",
        "tooling/package-candidate-review-batch.mjs",
        "tooling/component-inventory-counts.mjs",
        "distribution/candidate-component-coverage.schema.json",
        "distribution/candidate-review-batch.schema.json",
        ".github/workflows/package-passive-candidate-assets.yml",
        "tooling/specs/passive-candidate-assets.spec.mjs",
        "tooling/specs/candidate-review-batch.spec.mjs",
        "tooling/specs/candidate-contract-schemas.spec.mjs",
        "tooling/specs/component-catalog.spec.mjs",
        "tooling/specs/native-non-skill-review-assets.spec.mjs",
        "tooling/specs/component-inventory-counts.spec.mjs",
    ];
    const literal = new RegExp(`(?<![\\w.])${size}(?![\\w.])`);
    const offenders = [];
    let scanned = 0;
    for (const path of consumers) {
        const code = readFileSync(join(defaultRepositoryRoot, path), "utf8")
            .split("\n")
            .filter(
                (line) => !/^\s*(\/\/|#)/.test(line) && !/"\$comment"/.test(line),
            )
            .join("\n");
        scanned += 1;
        if (literal.test(code)) offenders.push(`${path} restates ${size}`);
    }
    // Prove the matcher still matches, so a green run cannot mean "the pattern stopped working".
    assert(literal.test(`componentCount: ${size},`));
    assert.equal(literal.test("componentCount: coverage.componentCount,"), false);
    assert.equal(scanned, consumers.length);
    assert.deepEqual(offenders, []);
});
