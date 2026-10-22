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

/** Changed path → subsets to run. Order matters only for readability; results are de-duplicated. */
export const mappings: Mapping[] = [
    { pattern: /^\.cratis\/ai\/hooks\/|^\.claude\/hooks\/|^\.codex\/|^\.pi\/extensions\//, subsets: ['hooks'] },
    { pattern: /^\.cratis\/ai\/(harnesses|agents)\/|^Source\/(Harness\.Setup|Pi\.Plugin)\/|^\.(claude|cursor|opencode|github)\/agents\/|^\.(claude|cursor|pi|agents)\/|^\.claude-plugin\/|^\.cursor-plugin\//, subsets: ['adapters'] },
    { pattern: /^\.cratis\/ai\/(skills|rules|prompts|workflows)\/|^\.cratis\/ai\/[^/]+\.json$|^Documentation\/|^(AGENTS|CLAUDE)\.md$|^\.github\/(instructions|skills|prompts|copilot-instructions\.md)/, subsets: ['corpus'] }
];

/** Maps changed paths to subset names, or `all` when a verification source change needs the full suite. */
export function affectedSubsets(paths: string[]): { subsets: string[]; specs: string[]; full: boolean } {
    const names = new Set<string>();
    const specs = new Set<string>();
    let full = false;
    for (const path of paths) {
        const spec = /^Source\/Verification\/([^/]+\.spec\.ts)$/.exec(path);
        if (spec) { specs.add(spec[1]); continue; }
        if (/^Source\/Verification\/(?!screenplay-tool\.spec)/.test(path)) { full = true; continue; }
        for (const mapping of mappings) if (mapping.pattern.test(path)) mapping.subsets.forEach(name => names.add(name));
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [mode, base = 'origin/main'] = process.argv.slice(2);
    try {
        if (mode === 'affected') {
            const diff = spawnSync('git', ['diff', '--name-only', `${base}...`], { cwd: here, encoding: 'utf8' });
            if (diff.status !== 0) throw new Error(`git diff against ${base} failed: ${diff.stderr}`);
            const affected = affectedSubsets(diff.stdout.split('\n').filter(Boolean));
            if (affected.full) { console.log('A Source/Verification change needs the full suite: yarn workspace @cratis/ai-verification run test'); process.exit(0); }
            const files = [...new Set([...affected.subsets.flatMap(subsetFiles), ...affected.specs])];
            if (!files.length) { console.log('No changed path maps to a subset; nothing to run. The full suite is still the final gate.'); process.exit(0); }
            console.log(`Affected subsets: ${affected.subsets.join(', ') || '(none)'}${affected.specs.length ? `; changed specs: ${affected.specs.join(', ')}` : ''}`);
            process.exit(runFiles(files));
        }
        if (mode === 'unassigned') { console.log(unassignedSpecs(readdirSync(here)).join('\n')); process.exit(0); }
        process.exit(runFiles(subsetFiles(mode ?? '')));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
    }
}
