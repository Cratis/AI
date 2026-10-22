// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Named, fast subsets for iteration. The full `test` script stays the CI and final gate. */
export const subsets: Record<string, string[]> = {
    hooks: ['guard-pr-body', 'guard-secrets', 'guard-store-mutations', 'guard-writes', 'hook-wiring', 'codex-hooks', 'migration-reminder', 'pi-mcp-bridge', 'pi-quality-gate', 'quality-gates', 'cleanup-worktrees'],
    adapters: ['agent-adapters', 'harness-setup', 'harness-loading', 'pi-plugin', 'plugin-manifest', 'pi-mcp-configuration', 'pi-mcp-servers', 'pi-mcp-transport', 'pi-subagent', 'mcp-servers', 'source-identity-helper'],
    corpus: ['always-on-budget', 'discoverability-routing', 'documentation-routing', 'evaluation-coverage', 'instruction-dependencies', 'profiled-skills', 'skill-authoring', 'skill-evaluations', 'skill-hygiene', 'skill-overlap', 'skill-references', 'skill-structure', 'pin-restatements', 'model-first-restatements', 'preferred-syntax', 'review-reports', 'screenplay-tool', 'test-subsets']
};

export type Mapping = { pattern: RegExp; subsets: string[] };

/**
 * Deny-by-default allowlist. A path selects a subset only when every spec that reads it is in that subset
 * (verified by grepping the specs for the path); any other path needs the full suite.
 */
export const mappings: Mapping[] = [
    // Read only by guard-*, codex-hooks, hook-wiring, cleanup-worktrees specs, all in `hooks`. hook-lib.sh is excluded: discoverability-routing sources it.
    { pattern: /^\.cratis\/ai\/hooks\/scripts\/(cratis-guard-(writes|secrets|pr-body|store-mutations)\.sh|cratis-check-pr\.mjs|cratis-store-mutations\.json|cratis-cleanup-worktrees\.sh)$/, subsets: ['hooks'] },
    // Imported only by agent-adapters, harness-loading and harness-setup specs, all in `adapters`.
    { pattern: /^Source\/Harness\.Setup\/[^/]+\.ts$/, subsets: ['adapters'] }
];

/** A changed spec runs itself; every other unmapped path means the full suite. */
export function affectedSubsets(paths: string[]): { subsets: string[]; specs: string[]; full: boolean } {
    const names = new Set<string>();
    const specs = new Set<string>();
    let full = false;
    for (const path of paths) {
        const spec = /^Source\/Verification\/([^/]+\.spec\.ts)$/.exec(path);
        if (spec) { specs.add(spec[1]); continue; }
        const mapping = mappings.find(candidate => candidate.pattern.test(path));
        if (mapping) mapping.subsets.forEach(name => names.add(name));
        else full = true;
    }
    return { subsets: [...names].sort(), specs: [...specs].sort(), full };
}

export function subsetFiles(name: string): string[] {
    const bases = subsets[name];
    if (!bases) throw new Error(`Unknown subset '${name}'. Known: ${Object.keys(subsets).join(', ')}, affected.`);
    return bases.map(base => `${base}.spec.ts`);
}

/** Specs that belong to no named subset; they run only in the full suite. */
export function unassignedSpecs(files: string[]): string[] {
    const assigned = new Set(Object.keys(subsets).flatMap(subsetFiles));
    return files.filter(file => file.endsWith('.spec.ts') && !assigned.has(file)).sort();
}

function runFiles(files: string[]): number {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=./slowest-reporter.ts', '--test-reporter-destination=stdout', ...files], { cwd: here, stdio: 'inherit' });
    return result.status ?? 1;
}

export interface Dependencies {
    changedPaths(base: string): string[];
    allSpecs(): string[];
    run(files: string[]): number;
    log(message: string): void;
}

const systemDependencies: Dependencies = {
    changedPaths: base => {
        const diff = spawnSync('git', ['diff', '--name-only', `${base}...`], { cwd: here, encoding: 'utf8' });
        if (diff.status !== 0) throw new Error(`git diff against ${base} failed: ${diff.stderr}`);
        return diff.stdout.split('\n').filter(Boolean);
    },
    allSpecs: () => readdirSync(here).filter(file => file.endsWith('.spec.ts')).sort(),
    run: runFiles,
    log: message => console.log(message)
};

/** Returns the process exit status. `affected` runs the full suite unless a narrower subset is proven. */
export function main(arguments_: string[], dependencies: Dependencies = systemDependencies): number {
    const [mode, base = 'origin/main'] = arguments_;
    try {
        if (mode === 'affected') {
            const paths = dependencies.changedPaths(base);
            if (!paths.length) { dependencies.log('No changed paths; nothing to run. The full suite is still the final gate.'); return 0; }
            const affected = affectedSubsets(paths);
            if (affected.full) { dependencies.log('A changed path is not on the narrow subset allowlist; running the full suite.'); return dependencies.run(dependencies.allSpecs()); }
            dependencies.log(`Affected subsets: ${affected.subsets.join(', ') || '(none)'}${affected.specs.length ? `; changed specs: ${affected.specs.join(', ')}` : ''}`);
            return dependencies.run([...new Set([...affected.subsets.flatMap(subsetFiles), ...affected.specs])]);
        }
        if (mode === 'unassigned') { dependencies.log(unassignedSpecs(dependencies.allSpecs()).join('\n')); return 0; }
        return dependencies.run(subsetFiles(mode ?? ''));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
