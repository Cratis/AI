// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { copilotInstructions } from '../Harness.Setup/copilot-instructions.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';
import { alwaysOnBudgetFindings, alwaysOnHarnessBudgets, alwaysOnHarnessBytes, alwaysOnInputs } from './always-on-budget.ts';

const corpus = join(import.meta.dirname, '..', '..', '.cratis', 'ai');

test('per-harness always-on budget counts what each harness loads at session start', () => {
    const scoped = (scope: string) => `---\n${scope}\n---\n${'x'.repeat(100)}`;
    const entries = [
        { file: '.cratis/ai/rules/general.md', content: 'g'.repeat(1_000) },
        { file: '.cratis/ai/rules/none.md', content: 'n'.repeat(500) },
        { file: '.cratis/ai/rules/everything.md', content: scoped('applyTo: "**/*"') },
        { file: '.cratis/ai/rules/everything-paths.md', content: scoped('applyTo: "**/*"\npaths:\n  - "**/*"') },
        { file: '.cratis/ai/rules/narrow.md', content: scoped('applyTo: "**/*.cs,**/*.csproj"\npaths:\n  - "**/*.cs"\n  - "**/*.csproj"') },
    ];
    const adapter = scoped('applyTo: "**/*"') + 'a'.repeat(10);
    const totals = alwaysOnHarnessBytes(entries, { copilotAdapters: [{ file: 'everything.instructions.md', content: adapter }], cursorRule: 'c'.repeat(50) });
    // general.md arrives twice for Claude Code (CLAUDE.md and the rules directory) and for Pi (AGENTS.md context file and the system prompt).
    assert.equal(totals['claude-code'], 2 * 1_000 + 500 + Buffer.byteLength(entries[2].content));
    assert.equal(totals.copilot, 1_000 + Buffer.byteLength(adapter));
    assert.equal(totals.pi, 2 * 1_000 + 500 + Buffer.byteLength(entries[2].content) + Buffer.byteLength(entries[3].content));
    assert.equal(totals.cursor, 1_000 + 50);
    assert.equal(totals['codex-opencode'], 1_000);
});

test('the corpus stays within every harness budget and measures something for each', async () => {
    const { entries, loaded } = await alwaysOnInputs(corpus);
    const totals = alwaysOnHarnessBytes(entries, loaded);
    const before = entries.map(entry => ({ ...entry, content: execFileSync('git', ['show', `HEAD:${entry.file}`], { cwd: join(corpus, '../..'), encoding: 'utf8' }) }));
    const previousArtifacts = {
        copilotAdapters: loaded.copilotAdapters?.map(entry => ({ ...entry, content: execFileSync('git', ['show', `HEAD:.cratis/ai/harnesses/copilot/instructions/${entry.file}`], { cwd: join(corpus, '../..'), encoding: 'utf8' }) })),
        cursorRule: execFileSync('git', ['show', 'HEAD:.cratis/ai/harnesses/cursor/rules/cratis.mdc'], { cwd: join(corpus, '../..'), encoding: 'utf8' }),
    };
    console.log('HEAD startup bytes (HEAD adapters):', alwaysOnHarnessBytes(before, previousArtifacts));
    console.log('Working-tree startup bytes (stored adapters; regeneration may be pending):', totals);
    const prospective = alwaysOnHarnessBytes(entries, { ...loaded, copilotAdapters: copilotInstructions(corpus).map(adapter => ({ file: adapter.path, content: adapter.content })) });
    console.log('Prospective startup bytes after Copilot setup (in-memory adapter generation, not written):', prospective);
    assert.deepEqual(alwaysOnBudgetFindings(prospective), []);
    console.log('Canonical fallback bytes (not a generated-adapter measurement):', alwaysOnHarnessBytes(entries));
    for (const harness of Object.keys(alwaysOnHarnessBudgets)) assert.ok(totals[harness] > 0, harness);
    assert.deepEqual(alwaysOnBudgetFindings(totals), []);
});

test('the Pi total matches what the Pi rules extension puts in the system prompt, plus AGENTS.md', async () => {
    const { entries, loaded } = await alwaysOnInputs(corpus);
    const general = entries.find(entry => entry.file.endsWith('/general.md'));
    assert.ok(general);
    // A directory without `.cratis/ai.json` selects no profile, so the extension keeps every rule: the measured upper bound.
    const empty = mkdtempSync(join(tmpdir(), 'always-on-'));
    try {
        const systemPrompt = universalRules(empty).reduce((sum, rule) => sum + Buffer.byteLength(rule.content), 0);
        assert.equal(alwaysOnHarnessBytes(entries, loaded).pi, systemPrompt + Buffer.byteLength(general.content));
    } finally {
        rmSync(empty, { recursive: true, force: true });
    }
});

test('representative managed Pi universal-rule payload stays below 60,000 bytes with safety contracts', () => {
    const project = mkdtempSync(join(tmpdir(), 'always-on-selection-'));
    try {
        mkdirSync(join(project, '.cratis/ai'), { recursive: true });
        cpSync(join(corpus, 'rules'), join(project, '.cratis/ai/rules'), { recursive: true });
        writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/engineering/csharp', 'cratis/application/csharp', 'cratis/application/react', 'cratis/documentation'], languages: ['csharp', 'typescript'] }));
        const rules = universalRules(project);
        const bytes = rules.reduce((sum, rule) => sum + Buffer.byteLength(rule.content), 0);
        const general = rules.find(rule => rule.name === 'general.md');
        assert.ok(general);
        console.log(`Representative Pi universalRules payload: ${bytes} bytes; modeled startup rule context including AGENTS.md: ${bytes + Buffer.byteLength(general.content)} bytes. Payload is not total context.`);
        assert.ok(bytes < 60_000, `${bytes} must be below 60,000`);
        for (const name of ['general.md', 'capability-is-not-authority.md', 'browser.md', 'secrets.md', 'verification-discipline.md', 'git-commits.md', 'pull-requests.md', 'issue-assignment.md', 'local-work-artifacts.md']) {
            assert.ok(rules.some(rule => rule.name === name), `${name} remains always on`);
        }
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('managed Pi universal rule bytes stay bounded across every catalog profile', () => {
    const project = mkdtempSync(join(tmpdir(), 'always-on-profiles-'));
    try {
        mkdirSync(join(project, '.cratis/ai'), { recursive: true });
        cpSync(join(corpus, 'rules'), join(project, '.cratis/ai/rules'), { recursive: true });
        const catalog = JSON.parse(readFileSync(join(corpus, 'profile-catalog.json'), 'utf8'));
        const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
        assert.ok(profiles.length > 0);
        let largest = 0;
        for (const profile of profiles) {
            writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: [profile.id], languages: profile.languages ?? [] }));
            const rules = universalRules(project);
            const bytes = rules.reduce((sum, rule) => sum + Buffer.byteLength(rule.content), 0);
            largest = Math.max(largest, bytes);
            assert.ok(bytes < 60_000, `${profile.id}: ${bytes} bytes`);
            for (const name of ['general.md', 'capability-is-not-authority.md', 'browser.md', 'secrets.md', 'verification-discipline.md', 'git-commits.md', 'pull-requests.md', 'local-work-artifacts.md']) {
                assert.ok(rules.some(rule => rule.name === name), `${profile.id}: ${name}`);
            }
        }
        console.log(`Managed corpus: ${profiles.length} profiles; largest universalRules payload ${largest} bytes. Does not certify packaged-Pi language selection.`);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a harness over its budget fails with the remedy', () => {
    const findings = alwaysOnBudgetFindings({ ...alwaysOnHarnessBudgets, pi: alwaysOnHarnessBudgets.pi + 1 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'always-on-harness-bytes');
    assert.match(findings[0].matchedText, /^pi loads \d+ rule bytes at session start; budget \d+\. Displace or demote text to an on-demand skill, or raise the budget in .+ in a reviewed change\.$/);
    assert.deepEqual(alwaysOnBudgetFindings(alwaysOnHarnessBudgets), []);
});

test('measuring no rules fails rather than passing vacuously', () => {
    const findings = alwaysOnBudgetFindings(alwaysOnHarnessBytes([]));
    assert.equal(findings.length, Object.keys(alwaysOnHarnessBudgets).length);
    assert.ok(findings.every(finding => finding.rule === 'always-on-harness-bytes' && finding.matchedText.includes('measured no always-on rule bytes')));
    assert.equal(alwaysOnBudgetFindings({}, { unknown: 1 }).length, 1);
});
