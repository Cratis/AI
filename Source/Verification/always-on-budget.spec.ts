// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
