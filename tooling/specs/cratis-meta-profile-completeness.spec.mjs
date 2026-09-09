// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareOrdinal, sortedOrdinal } from "../catalog-ordering.mjs";
import {
    loadMcpDeclarations,
    resolveProfiles,
} from "../resolve-profiles.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

/** The bare id is the point: `cratis` is the whole public catalog. */
const metaProfileId = "cratis";
const publicProfileRoot = "profiles/public";

function readJson(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

/**
 * Every public profile id, read from the source tree rather than from a list
 * kept here. A profile's id is its path under `profiles/public/`, so this walks
 * the nested `cratis/*.json` nodes too and cannot go stale when someone adds a
 * profile. That is the whole guarantee: this spec discovers the new file, and
 * `cratis.json` either composes it or this spec names it as missing.
 */
function publicProfileIdsOnDisk(relativePath = "") {
    const ids = [];
    for (const entry of readdirSync(
        join(repositoryRoot, publicProfileRoot, relativePath),
        { withFileTypes: true },
    )) {
        const child = relativePath
            ? `${relativePath}/${entry.name}`
            : entry.name;
        if (entry.isDirectory()) ids.push(...publicProfileIdsOnDisk(child));
        else if (entry.isFile() && entry.name.endsWith(".json"))
            ids.push(child.slice(0, -".json".length));
    }
    return sortedOrdinal(ids);
}

function missingFrom(expected, actual) {
    const present = new Set(actual);
    return expected.filter((id) => !present.has(id));
}

function report(label, ids) {
    return `${label}:\n  ${ids.join("\n  ")}`;
}

test("the public profile source tree is the catalog the resolver sees", () => {
    // If these two ever disagree, every other assertion here is measuring the
    // wrong thing, so fail on that first and say which side is short.
    const onDisk = publicProfileIdsOnDisk();
    const inCatalog = sortedOrdinal(
        readJson("distribution/profile-catalog.json").publicProfiles.map(
            (profile) => profile.id,
        ),
    );
    const uncatalogued = missingFrom(onDisk, inCatalog);
    assert.deepEqual(
        uncatalogued,
        [],
        uncatalogued.length === 0
            ? ""
            : report(
                  `${publicProfileRoot}/ declares profiles the generated catalog does not carry. Run \`node tooling/generate-profile-catalog.mjs\``,
                  uncatalogued,
              ),
    );
    const orphaned = missingFrom(inCatalog, onDisk);
    assert.deepEqual(
        orphaned,
        [],
        orphaned.length === 0
            ? ""
            : report(
                  `distribution/profile-catalog.json carries profiles with no file under ${publicProfileRoot}/. Run \`node tooling/generate-profile-catalog.mjs\``,
                  orphaned,
              ),
    );
});

test("cratis composes every public profile except itself", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const profile = profileCatalog.publicProfiles.find(
        (entry) => entry.id === metaProfileId,
    );
    assert(profile, `${publicProfileRoot}/${metaProfileId}.json must exist`);
    const expected = publicProfileIdsOnDisk().filter(
        (id) => id !== metaProfileId,
    );
    const composes = profile.composes ?? [];
    const missing = missingFrom(expected, composes);
    assert.deepEqual(
        missing,
        [],
        missing.length === 0
            ? ""
            : report(
                  `${publicProfileRoot}/${metaProfileId}.json is not the maximal public bundle: add these ids to its "composes" array`,
                  missing,
              ),
    );
    assert.equal(
        composes.includes(metaProfileId),
        false,
        `${metaProfileId} must not compose itself`,
    );
    assert.deepEqual(
        composes,
        [...composes].sort(compareOrdinal),
        `${publicProfileRoot}/${metaProfileId}.json "composes" must stay ordinally sorted`,
    );
    assert.equal(
        new Set(composes).size,
        composes.length,
        `${publicProfileRoot}/${metaProfileId}.json "composes" must not repeat an id`,
    );
});

test("resolving cratis returns every public profile and nothing else", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const manifest = resolveProfiles({
        profileCatalog,
        requested: [metaProfileId],
    });
    const expected = publicProfileIdsOnDisk();
    const resolved = manifest.profiles.map((entry) => entry.id);
    const missing = missingFrom(expected, resolved);
    assert.deepEqual(
        missing,
        [],
        missing.length === 0
            ? ""
            : report(
                  `Resolving ${metaProfileId} misses these public profiles. Add them to ${publicProfileRoot}/${metaProfileId}.json "composes"`,
                  missing,
              ),
    );
    const unexpected = missingFrom(resolved, expected);
    assert.deepEqual(
        unexpected,
        [],
        unexpected.length === 0
            ? ""
            : report(
                  `Resolving ${metaProfileId} reached profiles that are not public profiles on disk`,
                  unexpected,
              ),
    );
    assert.deepEqual(resolved, expected);
});

test("the maximal public bundle never reaches the engineering audience", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const manifest = resolveProfiles({
        profileCatalog,
        requested: [metaProfileId],
    });
    assert.equal(manifest.audience, "public");
    const crossed = manifest.profiles.filter(
        (entry) => entry.audience !== "public",
    );
    assert.deepEqual(
        crossed.map((entry) => entry.id),
        [],
        "a public request must never pull in engineering-only content",
    );
    const engineeringIds = new Set(
        profileCatalog.engineeringProfiles.map((entry) => entry.id),
    );
    const reachedEngineering = manifest.profiles
        .map((entry) => entry.id)
        .filter((id) => engineeringIds.has(id));
    assert.deepEqual(reachedEngineering, []);
});

test("cratis is a strict superset of every other meta-profile", () => {
    // cratis/full alone reaches only part of the public profiles. The bare
    // `cratis` exists because "everything" has to mean everything, so each
    // narrower meta-profile — the unscoped products and every language-scoped
    // cell — must be a subset of it rather than a sibling with content of its
    // own. The meta ids are discovered from disk, so adding cratis/<new>
    // brings it under this guarantee without editing this file.
    const profileCatalog = readJson("distribution/profile-catalog.json");
    const everything = new Set(
        resolveProfiles({
            profileCatalog,
            requested: [metaProfileId],
        }).profiles.map((entry) => entry.id),
    );
    const narrower = publicProfileIdsOnDisk().filter(
        (id) => id.startsWith("cratis/"),
    );
    assert(narrower.length > 0, "the cratis namespace must not go empty");
    for (const meta of narrower) {
        const closure = resolveProfiles({
            profileCatalog,
            requested: [meta],
        }).profiles.map((entry) => entry.id);
        const escaped = closure.filter((id) => !everything.has(id));
        assert.deepEqual(
            escaped,
            [],
            escaped.length === 0
                ? ""
                : report(
                      `${meta} reaches profiles ${metaProfileId} does not`,
                      escaped,
                  ),
        );
        assert(
            everything.size > closure.length,
            `${metaProfileId} must be strictly larger than ${meta}`,
        );
    }
});

test("every capability any public profile offers is reachable through cratis", () => {
    const profileCatalog = readJson("distribution/profile-catalog.json");
    // The same inputs `node tooling/resolve-profiles.mjs cratis` uses, so the
    // MCP servers real profiles declare resolve here exactly as they do there.
    const manifest = resolveProfiles({
        profileCatalog,
        requested: [metaProfileId],
        mcpDeclarations: loadMcpDeclarations(repositoryRoot),
    });
    const declared = sortedOrdinal(
        new Set(
            profileCatalog.publicProfiles.flatMap(
                (profile) => profile.availableTargets ?? [],
            ),
        ),
    );
    const resolved = manifest.skills.map((skill) => skill.id);
    const missing = missingFrom(declared, resolved);
    assert.deepEqual(
        missing,
        [],
        missing.length === 0
            ? ""
            : report(
                  `Resolving ${metaProfileId} misses public capabilities that a public profile declares`,
                  missing,
              ),
    );
    assert.deepEqual(resolved, declared);
    const declaredServers = sortedOrdinal(
        new Set(
            profileCatalog.publicProfiles.flatMap(
                (profile) => profile.mcpServers ?? [],
            ),
        ),
    );
    assert.deepEqual(
        manifest.mcpServers.map((server) => server.id),
        declaredServers,
    );
    // Everything rejected is a profile that honestly carries no content yet,
    // never a capability that exists but could not be reached.
    for (const rejection of manifest.rejected)
        assert.equal(
            rejection.kind,
            "profile-capability-set",
            `${rejection.id}: ${rejection.reason}`,
        );
});
