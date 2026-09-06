#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// One place that knows how large the component corpus is.
//
// These counts used to be hand-maintained literals restated in eight places — the coverage builder,
// two distribution schemas, the batch packager, a workflow and several specs. Every content
// migration bumped all of them, so every migration conflicted with every sibling migration, and
// each conflict had to be resolved by re-deriving the real sum rather than trusting either side.
// The `137` in the workflow proved the failure mode: it was never bumped at all and had been wrong
// for 45 components.
//
// The split here is deliberate. The *real* counts are derived from the inventory, because a count
// whose only job is to agree with reality has no business being typed by hand. The *reviewed*
// counts live in exactly one tracked file, `distribution/candidate-component-coverage.seals.json`,
// because growth of the corpus is a thing a human is supposed to notice and approve — that is what
// the original literals were for, and dropping the checkpoint would throw away the only signal that
// says "someone looked". So: one derivation, one seal, one diff. A migration edits the seal file
// and nothing else.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";

export const componentInventorySealPath =
    "distribution/candidate-component-coverage.seals.json";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export function readComponentInventorySeals(root = defaultRepositoryRoot) {
    const path = join(resolve(root), componentInventorySealPath);
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(
            `Unable to read the component inventory seal: ${componentInventorySealPath}`,
            { cause: error },
        );
    }
}

// The counts the coverage records actually carry. Derived, never typed. Keys are ordinally sorted
// because these objects are emitted into the coverage document, whose bytes have to be stable.
export function componentInventoryCounts(records) {
    const tally = (selector) => {
        const counts = new Map();
        for (const record of records) {
            const value = selector(record);
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return Object.fromEntries(
            [...counts].sort(([left], [right]) => compareOrdinal(left, right)),
        );
    };
    const byKind = tally((record) => record.kind);
    return {
        componentCount: records.length,
        byKind,
        byDisposition: tally((record) => record.disposition),
        // Records carrying one of the three skill dispositions. Counted from the disposition rather
        // than from `kind` on purpose: comparing it against `byKind.skill` is what proves no skill
        // escaped into a non-skill disposition and no non-skill landed in a skill one.
        skillDispositionCount: records.filter((record) =>
            skillDispositions.has(record.disposition),
        ).length,
    };
}

const skillDispositions = new Set([
    "skill-packaged-candidate",
    "skill-blocked-candidate",
    "skill-legacy-repository-only",
]);

// Every way the derived counts can disagree with the seal, as one labeled line each. A single
// "closure changed" line forced the reader to re-derive all eight values to find out which moved.
export function componentInventorySealMismatches(counts, seals) {
    const errors = [];
    const compare = (label, expected, computed) => {
        if (expected !== computed)
            errors.push(
                `${label}: reviewed ${expected} but the inventory has ${computed}`,
            );
    };
    compare("componentCount", seals.componentCount, counts.componentCount);
    compare(
        "skillDispositionCount",
        seals.skillDispositionCount,
        counts.skillDispositionCount,
    );
    for (const [kind, expected] of Object.entries(seals.byKind))
        compare(`byKind.${kind}`, expected, counts.byKind[kind] ?? 0);
    for (const kind of Object.keys(counts.byKind))
        if (!(kind in seals.byKind))
            errors.push(
                `byKind.${kind}: the inventory has ${counts.byKind[kind]} of a kind the seal does not review`,
            );
    // Only the sealed dispositions are compared. `floatingDispositions` names the two that move when
    // a skill is promoted from blocked to packaged without the corpus changing size; their total is
    // covered by `skillDispositionCount`, so sealing them individually would demand a review for a
    // change that adds nothing.
    const floating = new Set(seals.floatingDispositions?.ids ?? []);
    for (const [disposition, expected] of Object.entries(seals.byDisposition))
        compare(
            `byDisposition.${disposition}`,
            expected,
            counts.byDisposition[disposition] ?? 0,
        );
    for (const disposition of Object.keys(counts.byDisposition))
        if (!(disposition in seals.byDisposition) && !floating.has(disposition))
            errors.push(
                `byDisposition.${disposition}: the inventory has ${counts.byDisposition[disposition]} of a disposition the seal neither reviews nor declares floating`,
            );
    const sealedTotal = Object.values(seals.byKind).reduce(
        (total, count) => total + count,
        0,
    );
    if (sealedTotal !== seals.componentCount)
        errors.push(
            `the seal is internally inconsistent: byKind sums to ${sealedTotal} but componentCount is ${seals.componentCount}`,
        );
    // Not a reviewed size but a derivation invariant: every skill component, and only a skill
    // component, must carry one of the three skill dispositions.
    if (counts.skillDispositionCount !== (counts.byKind.skill ?? 0))
        errors.push(
            `skill dispositions cover ${counts.skillDispositionCount} records but the inventory has ${counts.byKind.skill ?? 0} skill components`,
        );
    return errors;
}

export function assertComponentInventorySeals(
    counts,
    root = defaultRepositoryRoot,
) {
    const seals = readComponentInventorySeals(root);
    const errors = componentInventorySealMismatches(counts, seals);
    if (errors.length > 0)
        throw new Error(
            `Component inventory differs from the reviewed seal in ${componentInventorySealPath}. ` +
                `Read the diff, confirm the growth is intended, then update that one file:\n- ${errors.join("\n- ")}`,
        );
    return seals;
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    // Deliberately not a top-level `await`: the coverage builder imports this module, so awaiting
    // its import here before this module has finished evaluating deadlocks the cycle.
    void import("./candidate-component-coverage.mjs").then(
        ({ buildCandidateComponentCoverage }) => {
            if (process.argv.includes("--print")) {
                // Re-derives with the seal assertion off, so it can report the real counts after a
                // migration precisely when the seal is stale — a printer that refuses to print
                // until the seal is already right would be useless for its one job.
                const coverage = buildCandidateComponentCoverage(
                    defaultRepositoryRoot,
                    { assertSeals: false },
                );
                const counts = componentInventoryCounts(coverage.records);
                process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
                return;
            }
            buildCandidateComponentCoverage();
            const seals = readComponentInventorySeals();
            process.stdout.write(
                `Component inventory matches the reviewed seal: ${seals.componentCount} components.\n`,
            );
        },
    );
}
