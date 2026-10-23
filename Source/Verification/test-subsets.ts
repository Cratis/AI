// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Named, fast subsets for iteration. The full `test` script stays the CI and final gate. */
export const subsets: Record<string, string[]> = {
    hooks: ['guard-pr-body', 'guard-pr-body-hook', 'guard-pr-body-policy', 'guard-secrets', 'guard-store-mutations', 'guard-writes', 'hook-wiring', 'codex-hooks', 'migration-reminder', 'pi-mcp-bridge', 'pi-quality-gate', 'pi-quality-gate-lifecycle', 'pi-quality-gate-bounded', 'pi-quality-gate-fingerprint', 'quality-gates', 'cleanup-worktrees', 'check-pr-callers'],
    adapters: ['agent-adapters', 'harness-setup', 'harness-loading', 'pi-plugin', 'plugin-manifest', 'pi-mcp-configuration', 'pi-mcp-servers', 'pi-mcp-transport', 'pi-subagent', 'mcp-servers', 'source-identity-helper'],
    corpus: ['always-on-budget', 'discoverability-routing', 'documentation-routing', 'evaluation-coverage', 'instruction-dependencies', 'profiled-skills', 'skill-authoring', 'skill-evaluations', 'skill-hygiene', 'skill-overlap', 'skill-references', 'skill-structure', 'pin-restatements', 'model-first-restatements', 'preferred-syntax', 'review-reports', 'screenplay-tool', 'test-subsets']
};

/** Spec files that may be absent on a branch; they are skipped when missing. */
const optionalSpecs = new Set(['check-pr-callers.spec.ts']);

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
    if (!bases) throw new Error(`Unknown subset '${name}'. Known: ${Object.keys(subsets).join(', ')}, affected, full.`);
    // check-pr-callers.spec.ts arrives on another branch; tolerate it being absent until both merge.
    return bases.map(base => `${base}.spec.ts`).filter(file => !optionalSpecs.has(file) || existsSync(resolve(here, file)));
}

/** Specs that belong to no named subset; they run only in the full suite. */
export function unassignedSpecs(files: string[]): string[] {
    const assigned = new Set(Object.keys(subsets).flatMap(subsetFiles));
    return files.filter(file => file.endsWith('.spec.ts') && !assigned.has(file)).sort();
}

/** Default wall-time budget of the full suite, in seconds. Measured at 884 s on a heavily loaded machine; override with CRATIS_TEST_BUDGET_SECONDS. */
export const defaultFullSuiteBudgetSeconds = 1200;

export interface BudgetVerdict { exceeded: boolean; fail: boolean; message: string }

/**
 * Judges a full-suite run against its wall-time budget. Wall time depends on machine load, so an overrun is a
 * loud warning locally and fails the run only when CI is set. An unparsable or non-positive override is ignored.
 */
export function judgeBudget(elapsedSeconds: number, env: NodeJS.ProcessEnv): BudgetVerdict {
    const configured = Number(env.CRATIS_TEST_BUDGET_SECONDS);
    const budget = Number.isFinite(configured) && configured > 0 ? configured : defaultFullSuiteBudgetSeconds;
    const exceeded = elapsedSeconds > budget;
    const fail = exceeded && Boolean(env.CI);
    const message = exceeded
        ? `${fail ? 'FAILED' : 'WARNING'}: the full suite took ${elapsedSeconds.toFixed(0)} s, over its ${budget} s budget. Find the slowest specs above and speed them up, or raise CRATIS_TEST_BUDGET_SECONDS for a slower runner.`
        : `Full suite took ${elapsedSeconds.toFixed(0)} s of its ${budget} s budget.`;
    return { exceeded, fail, message };
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
    /** Milliseconds clock for the full-suite budget; defaults to Date.now. */
    now?(): number;
    /** Environment for the budget (CRATIS_TEST_BUDGET_SECONDS, CI); defaults to process.env. */
    env?: NodeJS.ProcessEnv;
}

function runFullSuite(dependencies: Dependencies): number {
    const now = dependencies.now ?? Date.now;
    const started = now();
    const status = dependencies.run(dependencies.allSpecs());
    const verdict = judgeBudget((now() - started) / 1000, dependencies.env ?? process.env);
    dependencies.log(verdict.message);
    return status === 0 && verdict.fail ? 1 : status;
}

type Git = (arguments_: string[]) => string;

const repositoryRoot = resolve(here, '..', '..');

function runGit(arguments_: string[]): string {
    // Run from the repository root: `git ls-files` only lists paths under its working directory.
    const result = spawnSync('git', arguments_, { cwd: repositoryRoot, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${arguments_.join(' ')} failed: ${result.stderr}`);
    return result.stdout;
}

/** Committed, staged, unstaged and untracked changes since the merge base with `base`, deduplicated. */
export function collectChangedPaths(base: string, git: Git): string[] {
    const mergeBase = git(['merge-base', base, 'HEAD']).trim();
    const tracked = git(['diff', '--name-only', mergeBase]).split('\n');
    const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n');
    return [...new Set([...tracked, ...untracked].filter(Boolean))].sort();
}

const systemDependencies: Dependencies = {
    changedPaths: base => collectChangedPaths(base, runGit),
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
            if (affected.full) { dependencies.log('A changed path is not on the narrow subset allowlist; running the full suite.'); return runFullSuite(dependencies); }
            dependencies.log(`Affected subsets: ${affected.subsets.join(', ') || '(none)'}${affected.specs.length ? `; changed specs: ${affected.specs.join(', ')}` : ''}`);
            return dependencies.run([...new Set([...affected.subsets.flatMap(subsetFiles), ...affected.specs])]);
        }
        if (mode === 'full') return runFullSuite(dependencies);
        if (mode === 'unassigned') { dependencies.log(unassignedSpecs(dependencies.allSpecs()).join('\n')); return 0; }
        return dependencies.run(subsetFiles(mode ?? ''));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
