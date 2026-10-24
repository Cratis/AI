// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import { skillBody } from './skill-structure.ts';

/**
 * Ceilings for the rule bytes each harness loads at session start, measured over every rule in the corpus.
 * A profile selection only removes profile-specific rules, so no selection loads more than these.
 * Exceeding one fails verification.
 * Raised by the 88-byte general.md routing row for discoverability.md (Claude Code and Pi count general.md twice).
 * Cratis/AI#859 browser.md + general.md routing row: +2425 bytes (claude-code, pi), +2454 (copilot), +97 (cursor, codex-opencode).
 * Cratis/AI#863 secrets.md + general.md routing row + local-work-artifacts.md scan bullet: +2525 bytes (claude-code, pi), +2541 (copilot), +116 (cursor, codex-opencode).
 * Cratis/AI#871 secrets.md hook-limits bullet: +321 bytes (claude-code, copilot, pi).
 * Cratis/AI#855 pull-requests.md hook-change release-note line: +197 bytes (claude-code, copilot, pi).
 * Cratis/AI#909 method pointers in pull-requests.md, issue-assignment.md, review-reports.md, profiles.md: +1087 bytes (claude-code, pi), +1002 (copilot).
 */
export const alwaysOnHarnessBudgets: Record<string, number> = { 'claude-code': 123_159, copilot: 98_935, pi: 125_355, cursor: 23_291, 'codex-opencode': 22_998 };

const remedy = 'Displace or demote text to an on-demand skill, or raise the budget in Source/Verification/always-on-budget.ts in a reviewed change.';

export const universalGlobs = new Set(['**', '**/*', '*']);

export function scopes(header: string, key: string): string[] {
    const block = new RegExp(`^${key}:[ \\t]*([^\\n]*)((?:\\n[ \\t]+[^\\n]*)*)`, 'm').exec(header);
    if (!block) return [];
    return `${block[1]}\n${block[2]}`.split(/[\n,]/).map(part => part.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

/** One instruction file, named relative to the repository root. */
export interface InstructionEntry {
    file: string;
    content: string;
}

/** What a harness loads besides the canonical rules: the generated Copilot adapters and the Cursor rule file. */
export interface LoadedHarnessArtifacts {
    copilotAdapters?: InstructionEntry[];
    cursorRule?: string;
}

/**
 * Rule bytes loaded at session start per harness, counting the artifacts each one reads:
 * Claude Code reads CLAUDE.md (general.md) and every `.claude/rules` file without `paths`, so general.md arrives twice;
 * Copilot reads copilot-instructions.md (general.md) and the generated adapters whose `applyTo` covers every file;
 * Pi reads AGENTS.md (general.md) as a context file and puts every universal rule in the system prompt, so general.md is counted twice;
 * Cursor reads its always-apply rule file and the general.md it references; Codex and OpenCode read AGENTS.md (general.md).
 */
export function alwaysOnHarnessBytes(entries: InstructionEntry[], loaded: LoadedHarnessArtifacts = {}): Record<string, number> {
    const totals: Record<string, number> = { 'claude-code': 0, copilot: 0, pi: 0, cursor: 0, 'codex-opencode': 0 };
    const universal = (header: string): boolean => scopes(header, 'applyTo').some(glob => universalGlobs.has(glob));
    for (const { file, content } of entries) {
        const header = content.slice(0, content.length - skillBody(content).length);
        const bytes = Buffer.byteLength(content);
        const applyTo = scopes(header, 'applyTo');
        const paths = scopes(header, 'paths');
        const general = file.endsWith('/general.md');
        if (general) {
            totals['claude-code'] += bytes;
            totals.pi += bytes;
            totals.cursor += bytes + Buffer.byteLength(loaded.cursorRule ?? '');
            totals['codex-opencode'] += bytes;
        }
        if (paths.length === 0) totals['claude-code'] += bytes;
        if (general || (!loaded.copilotAdapters && universal(header))) totals.copilot += bytes;
        if ((applyTo.length === 0 && paths.length === 0) || [...applyTo, ...paths].some(glob => universalGlobs.has(glob))) totals.pi += bytes;
    }
    for (const { content } of loaded.copilotAdapters ?? []) {
        if (universal(content.slice(0, content.length - skillBody(content).length))) totals.copilot += Buffer.byteLength(content);
    }
    return totals;
}

/** A budgeted harness that measured nothing fails too, so a moved or empty corpus cannot pass vacuously. */
export function alwaysOnBudgetFindings(totals: Record<string, number>, budgets = alwaysOnHarnessBudgets): AuthoringFinding[] {
    const finding = (matchedText: string): AuthoringFinding => ({ file: '.cratis/ai/rules', line: 1, rule: 'always-on-harness-bytes', matchedText });
    return Object.entries(budgets).flatMap(([harness, budget]) => {
        const total = totals[harness] ?? 0;
        if (total === 0) return [finding(`${harness} measured no always-on rule bytes; the measurement found nothing to check.`)];
        return total > budget ? [finding(`${harness} loads ${total} rule bytes at session start; budget ${budget}. ${remedy}`)] : [];
    });
}

/** Reads the canonical rules and the generated harness artifacts the measurement counts. */
export async function alwaysOnInputs(corpus: string): Promise<{ entries: InstructionEntry[]; loaded: LoadedHarnessArtifacts }> {
    const markdown = async (directory: string, prefix: string) => Promise.all((await readdir(directory)).filter(name => name.endsWith('.md')).sort()
        .map(async name => ({ file: `${prefix}${name}`, content: await readFile(join(directory, name), 'utf8') })));
    return {
        entries: await markdown(join(corpus, 'rules'), '.cratis/ai/rules/'),
        loaded: {
            copilotAdapters: await markdown(join(corpus, 'harnesses', 'copilot', 'instructions'), ''),
            cursorRule: await readFile(join(corpus, 'harnesses', 'cursor', 'rules', 'cratis.mdc'), 'utf8'),
        },
    };
}

export function alwaysOnSummary(totals: Record<string, number>, budgets = alwaysOnHarnessBudgets): string {
    return `Always-on rule bytes per harness: ${Object.entries(budgets).map(([harness, budget]) => `${harness} ${totals[harness] ?? 0}/${budget}`).join(', ')}.`;
}
