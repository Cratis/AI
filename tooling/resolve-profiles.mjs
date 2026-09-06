#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { graphHasCycle } from "./catalog-v2-validation.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export const profileCatalogPath = "distribution/profile-catalog.json";
export const mcpDeclarationRoot = "mcp";
export const resolvedManifestSchemaVersion = "1.0.0";

/**
 * A named, machine-readable resolution failure. Every reason carries a code so
 * a caller can branch without parsing prose, and a message so a human sees the
 * exact profile that caused it.
 */
export class ProfileResolutionError extends Error {
    constructor(reasons) {
        const named = dedupeReasons(reasons);
        super(
            `Profile resolution failed: ${named.map((reason) => reason.message).join("; ")}`,
        );
        this.name = "ProfileResolutionError";
        this.reasons = named;
    }
}

function sorted(values) {
    return [...values].sort(compareOrdinal);
}

function dedupeReasons(reasons) {
    const byMessage = new Map();
    for (const reason of reasons)
        if (!byMessage.has(reason.message)) byMessage.set(reason.message, reason);
    return [...byMessage.values()].sort((left, right) =>
        compareOrdinal(left.message, right.message),
    );
}

function addParent(map, key, parent) {
    const parents = map.get(key) ?? new Set();
    if (parent) parents.add(parent);
    map.set(key, parents);
}

export function readProfileCatalog(repositoryRoot = defaultRepositoryRoot) {
    return JSON.parse(
        readFileSync(join(resolve(repositoryRoot), profileCatalogPath), "utf8"),
    );
}

/**
 * Loads every MCP server declaration under `mcp/`. Declarations are authored
 * JSON; the schema file itself is never treated as a declaration.
 */
export function loadMcpDeclarations(repositoryRoot = defaultRepositoryRoot) {
    const root = join(resolve(repositoryRoot), mcpDeclarationRoot);
    if (!existsSync(root)) return [];
    return readdirSync(root)
        .filter(
            (name) => name.endsWith(".json") && !name.endsWith(".schema.json"),
        )
        .sort(compareOrdinal)
        .map((name) => ({
            ...JSON.parse(readFileSync(join(root, name), "utf8")),
            declarationPath: `${mcpDeclarationRoot}/${name}`,
        }));
}

export function indexProfiles(profileCatalog) {
    const index = new Map();
    for (const [audience, profiles] of [
        ["public", profileCatalog.publicProfiles ?? []],
        ["cratis-engineering", profileCatalog.engineeringProfiles ?? []],
    ])
        for (const profile of profiles) {
            if (index.has(profile.id))
                throw new ProfileResolutionError([
                    {
                        code: "DUPLICATE_PROFILE",
                        id: profile.id,
                        message: `Duplicate profile id: ${profile.id}`,
                    },
                ]);
            index.set(profile.id, { profile, audience });
        }
    return index;
}

export function compositionGraph(profileCatalog) {
    const graph = new Map();
    for (const [id, entry] of indexProfiles(profileCatalog))
        graph.set(id, [...(entry.profile.composes ?? [])]);
    return graph;
}

/**
 * The single compatibility hook point. The catalog carries no compatibility
 * constraints today, so this returns an empty list; adding a
 * `compatibility.mutuallyExclusive` array to the profile catalog is the only
 * thing needed to start rejecting a combination.
 */
export function compatibilityConstraints(profileCatalog) {
    return profileCatalog.compatibility?.mutuallyExclusive ?? [];
}

function namedCycles(index) {
    const reasons = [];
    const done = new Set();
    const trail = [];
    const visit = (id) => {
        if (done.has(id)) return;
        const start = trail.indexOf(id);
        if (start >= 0) {
            reasons.push({
                code: "COMPOSITION_CYCLE",
                id,
                message: `Profile composition cycle: ${[...trail.slice(start), id].join(" -> ")}`,
            });
            return;
        }
        trail.push(id);
        for (const dependency of sorted(index.get(id)?.profile.composes ?? []))
            if (index.has(dependency)) visit(dependency);
        trail.pop();
        done.add(id);
    };
    for (const id of sorted([...index.keys()])) visit(id);
    return reasons;
}

/**
 * Validates the whole composition graph: unknown dependencies by name,
 * audience crossings, and cycles named by their exact path.
 */
export function validateComposition(profileCatalog) {
    const index = indexProfiles(profileCatalog);
    const reasons = [];
    for (const [id, entry] of index)
        for (const dependency of entry.profile.composes ?? []) {
            if (!index.has(dependency)) {
                reasons.push({
                    code: "UNKNOWN_PROFILE",
                    id: dependency,
                    requiredBy: id,
                    message: `${id}: unknown composed profile ${dependency}`,
                });
                continue;
            }
            if (index.get(dependency).audience !== entry.audience)
                reasons.push({
                    code: "AUDIENCE_MISMATCH",
                    id: dependency,
                    requiredBy: id,
                    message: `${id}: composition crosses public and engineering audiences through ${dependency}`,
                });
        }
    reasons.push(...namedCycles(index));
    if (
        graphHasCycle(compositionGraph(profileCatalog)) &&
        !reasons.some((reason) => reason.code === "COMPOSITION_CYCLE")
    )
        reasons.push({
            code: "COMPOSITION_CYCLE",
            id: null,
            message: "Profile composition graph is not acyclic",
        });
    return dedupeReasons(reasons);
}

/**
 * Every profile's full transitive capability closure, keyed by profile id.
 * This is the one expansion the human catalog, the packagers, and the release
 * planner all share.
 */
export function resolveTargetsByProfile(profileCatalog) {
    const index = indexProfiles(profileCatalog);
    const faults = validateComposition(profileCatalog);
    if (faults.length > 0) throw new ProfileResolutionError(faults);
    const cache = new Map();
    const expand = (id) => {
        if (cache.has(id)) return cache.get(id);
        const targets = new Set(index.get(id).profile.availableTargets ?? []);
        for (const dependency of index.get(id).profile.composes ?? [])
            for (const targetId of expand(dependency)) targets.add(targetId);
        const value = sorted(targets);
        cache.set(id, value);
        return value;
    };
    for (const id of sorted([...index.keys()])) expand(id);
    return cache;
}

function closureOf(index, requestedIds) {
    const seen = new Set();
    const depth = new Map();
    const visit = (id, level) => {
        const known = depth.get(id);
        if (known === undefined || level < known) depth.set(id, level);
        if (seen.has(id)) return;
        seen.add(id);
        for (const dependency of sorted(index.get(id).profile.composes ?? []))
            visit(dependency, level + 1);
    };
    for (const id of sorted(requestedIds)) visit(id, 0);
    return { ids: sorted(seen), depth };
}

function resolveMcpServers(closureIds, index, declarations, rejected) {
    const declarationsById = new Map(
        declarations.map((declaration) => [declaration.id, declaration]),
    );
    const includedBy = new Map();
    const resolvedDeclarations = new Map();
    for (const profileId of closureIds)
        for (const serverId of sorted(
            index.get(profileId).profile.mcpServers ?? [],
        )) {
            const declaration = declarationsById.get(serverId);
            if (!declaration) {
                rejected.push({
                    kind: "mcp-server",
                    id: serverId,
                    requiredBy: profileId,
                    reason: `No MCP server declaration exists under ${mcpDeclarationRoot}/ for ${serverId}.`,
                });
                continue;
            }
            if (declaration.resolvable !== true) {
                rejected.push({
                    kind: "mcp-server",
                    id: serverId,
                    requiredBy: profileId,
                    reason: `MCP server ${serverId} has status ${declaration.status} and is never included in a resolved manifest.`,
                });
                continue;
            }
            addParent(includedBy, serverId, profileId);
            resolvedDeclarations.set(serverId, declaration);
        }
    return sorted([...includedBy.keys()]).map((id) => {
        const declaration = resolvedDeclarations.get(id);
        return {
            id,
            status: declaration.status,
            transport: declaration.transport?.declared ?? null,
            authenticationType: declaration.authentication?.type ?? null,
            declarationContentClass:
                declaration.classification?.declarationContentClass ?? null,
            serverImplementationClass:
                declaration.classification?.serverImplementationClass ?? null,
            declarationPath: declaration.declarationPath ?? null,
            includedBy: sorted(includedBy.get(id)),
        };
    });
}

/**
 * Resolves one or more requested profiles into a deterministic, explainable
 * manifest. Cycles, unknown profiles, audience crossings, and declared
 * incompatible combinations throw a `ProfileResolutionError` naming the cause.
 * Everything that is merely excluded is reported in `rejected` with a reason.
 */
export function resolveProfiles({
    profileCatalog,
    requested,
    mcpDeclarations = [],
}) {
    const requestedIds = sorted(new Set(requested ?? []));
    if (requestedIds.length === 0)
        throw new ProfileResolutionError([
            {
                code: "NO_PROFILE_REQUESTED",
                id: null,
                message: "At least one profile must be requested",
            },
        ]);
    const index = indexProfiles(profileCatalog);
    const faults = validateComposition(profileCatalog);
    for (const id of requestedIds)
        if (!index.has(id))
            faults.push({
                code: "UNKNOWN_PROFILE",
                id,
                message: `Unknown requested profile: ${id}`,
            });
    if (faults.length > 0) throw new ProfileResolutionError(faults);
    const audiences = new Set(
        requestedIds.map((id) => index.get(id).audience),
    );
    if (audiences.size > 1)
        throw new ProfileResolutionError([
            {
                code: "AUDIENCE_MISMATCH",
                id: null,
                message: `Requested profiles cross audiences: ${sorted(audiences).join(", ")}`,
            },
        ]);
    const { ids: closureIds, depth } = closureOf(index, requestedIds);
    const closure = new Set(closureIds);
    for (const constraint of compatibilityConstraints(profileCatalog))
        if (
            (constraint.profiles ?? []).length > 1 &&
            constraint.profiles.every((id) => closure.has(id))
        )
            throw new ProfileResolutionError([
                {
                    code: "INCOMPATIBLE_COMBINATION",
                    id: constraint.id ?? null,
                    message: `Incompatible profile combination ${sorted(constraint.profiles).join(" + ")}: ${constraint.reason ?? "declared mutually exclusive"}`,
                },
            ]);
    const parents = new Map(closureIds.map((id) => [id, new Set()]));
    for (const id of closureIds)
        for (const dependency of index.get(id).profile.composes ?? [])
            if (closure.has(dependency)) addParent(parents, dependency, id);
    const skillParents = new Map();
    for (const id of closureIds)
        for (const targetId of index.get(id).profile.availableTargets ?? [])
            addParent(skillParents, targetId, id);
    const rejected = [];
    for (const id of closureIds) {
        const { profile } = index.get(id);
        if ((profile.availableTargets ?? []).length === 0)
            rejected.push({
                kind: "profile-capability-set",
                id,
                requiredBy: id,
                reason: `Profile ${id} contributes no capability of its own yet (state: ${profile.state}).`,
            });
    }
    const mcpServers = resolveMcpServers(
        closureIds,
        index,
        mcpDeclarations,
        rejected,
    );
    return {
        schemaVersion: resolvedManifestSchemaVersion,
        state: "RESOLVED",
        audience: [...audiences][0],
        requested: requestedIds,
        profiles: closureIds.map((id) => {
            const { profile, audience } = index.get(id);
            return {
                id,
                audience,
                packageName: profile.packageName ?? null,
                version: profile.version ?? null,
                state: profile.state,
                depth: depth.get(id),
                requestedDirectly: requestedIds.includes(id),
                composes: sorted(profile.composes ?? []),
                includedBy: sorted(parents.get(id) ?? []),
            };
        }),
        versions: closureIds.map((id) => ({
            profileId: id,
            version: index.get(id).profile.version ?? null,
        })),
        skills: sorted([...skillParents.keys()]).map((id) => ({
            id,
            includedBy: sorted(skillParents.get(id)),
        })),
        mcpServers,
        rejected: rejected.sort(
            (left, right) =>
                compareOrdinal(left.kind, right.kind) ||
                compareOrdinal(left.id, right.id) ||
                compareOrdinal(left.requiredBy ?? "", right.requiredBy ?? ""),
        ),
    };
}

function main() {
    const requested = process.argv.slice(2);
    if (requested.length === 0) {
        process.stderr.write(
            "Usage: node tooling/resolve-profiles.mjs <profile-id> [profile-id ...]\n",
        );
        process.exitCode = 1;
        return;
    }
    try {
        const manifest = resolveProfiles({
            profileCatalog: readProfileCatalog(),
            requested,
            mcpDeclarations: loadMcpDeclarations(),
        });
        process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
