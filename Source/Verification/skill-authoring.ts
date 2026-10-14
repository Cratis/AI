// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isScalar, parseDocument } from 'yaml';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import { instructionHygieneFindings, proseLines, skillHygieneFindings } from './skill-hygiene.ts';
import { lineCount, referencesPath, skillBody } from './skill-structure.ts';

const requiredRules = new Set(['description-when', 'description-voice', 'eval-coverage-ratchet', 'always-on-lines', 'asset-reachability']);

/** Skill assets allowed to stay unnamed in SKILL.md, each with a reason; a linked or removed asset makes its exception fail as stale. */
export const assetExceptions: { file: string; reason: string }[] = [];

/** Parse folded/quoted descriptions without scanning nested metadata or the body. */
function descriptionOf(content: string): { value: string; line: number } | undefined {
    const lines = content.split(/\r?\n/);
    const closing = lines[0] === '---' ? lines.findIndex((line, index) => index > 0 && line === '---') : -1;
    if (closing < 1) return undefined;
    const source = lines.slice(1, closing).join('\n');
    const document = parseDocument(source);
    if (document.errors.length > 0) return undefined;
    const node = document.get('description', true);
    if (!isScalar(node) || typeof node.value !== 'string') return undefined;
    return { value: node.value, line: source.slice(0, node.range?.[0] ?? 0).split('\n').length + 1 };
}

/** Routing and headroom checks apply only to entry points; meta-doc checks apply to all skill Markdown. */
export function skillAuthoringFindings(file: string, content: string): AuthoringFinding[] {
    const path = file.replaceAll('\\', '/');
    const findings: AuthoringFinding[] = [];
    const add = (rule: string, matchedText: string, line = 1) => findings.push({ file, line, rule, matchedText });
    if (/(?:^|\/)SKILL\.md$/.test(path)) {
        const description = descriptionOf(content);
        if (description) {
            const { value, line } = description;
            if (!/\b(?:(?:Use|Load|Read) (?:this )?(?:skill )?(?:when|for|to|before|whenever|if)|Trigger)\b/i.test(value)) add('description-when', 'Add an explicit Use when clause.', line);
            if (!/\b(?:Not for|Not when|Do not use|Don't use)\b|\buse `[^`]+` instead/i.test(value)) add('description-when-not', 'Add a negative routing boundary.', line);
            // Quoted commands and inline code are examples, not the description author's voice.
            const voice = value.replace(/(`+)[\s\S]*?\1|"(?:\\.|[^"\\])*"|(?<!\w)'(?:\\.|[^'\\])*'(?!\w)|“[^”]*”|‘[^’]*’/g, ' ');
            for (const match of voice.matchAll(/\b(?:I|I'll|my|you|your)\b/gi)) add('description-voice', match[0], line);
        }
        const body = skillBody(content);
        if (body.length >= 18_000) add('body-headroom', `${body.length} characters; target at most 16,000.`);
    }
    if (/(?:^|\/)(?:provenance|doc-contradictions|drift-and-ledger|release-baseline)\.md$/.test(path)) add('no-meta-docs', path.split('/').pop()!);
    for (const { text, line } of proseLines(content, 0)) {
        if (/^## Verified (?:product )?sources\b/i.test(text)) add('no-meta-docs', text, line);
    }
    const hygiene = skillHygieneFindings(file, content, true);
    findings.push(...hygiene.filter(finding => ['description-version', 'description-meta', 'time-words'].includes(finding.rule))
        .map(finding => finding.rule === 'description-version' ? { ...finding, rule: 'description-meta' } : finding));
    return findings;
}

/** Every shipped non-Markdown asset is directly named; Markdown reachability already has a hard gate. */
export function assetReachabilityFindings(skillFile: string, body: string, paths: string[], exceptions = assetExceptions): AuthoringFinding[] {
    const directory = skillFile.slice(0, -'SKILL.md'.length);
    const assets = paths.filter(path => !path.endsWith('.md') && !['LICENSE', 'NOTICE', 'verification.json'].includes(path));
    const findings: AuthoringFinding[] = [];
    for (const path of assets) {
        const file = directory + path;
        const exception = exceptions.find(entry => entry.file === file);
        const reachable = referencesPath(body, path);
        if (exception && (!exception.reason.trim() || reachable)) findings.push({ file, line: 1, rule: 'asset-reachability', matchedText: 'Remove the unnecessary exception or supply its reason.' });
        if (!reachable && !exception) findings.push({ file: skillFile, line: 1, rule: 'asset-reachability', matchedText: `Directly reference '${path}'.` });
    }
    for (const exception of exceptions.filter(entry => entry.file.startsWith(directory))) {
        if (!assets.includes(exception.file.slice(directory.length))) findings.push({ file: exception.file, line: 1, rule: 'asset-reachability', matchedText: 'Remove the exception for an absent asset.' });
    }
    return findings;
}

/** Instructions share the hygiene patterns but use the authoring rollout switch, not SKILL_HYGIENE_MODE. */
export function instructionAuthoringFindings(file: string, content: string): AuthoringFinding[] {
    return instructionHygieneFindings(file, content);
}

/** Warn-mode ceilings, set just above today's totals, for the rule bytes each harness loads at session start. */
export const alwaysOnHarnessBudgets: Record<string, number> = { 'claude-code': 113_000, copilot: 91_000, pi: 115_000, cursor: 23_000, 'codex-opencode': 23_000 };

/** Warn-mode ceiling for the combined bytes of rules without `paths`, which Claude Code loads at session start. */
export const unscopedRuleBudget = 91_000;

const universalGlobs = new Set(['**', '**/*', '*']);

function scopes(header: string, key: string): string[] {
    const block = new RegExp(`^${key}:[ \\t]*([^\\n]*)((?:\\n[ \\t]+[^\\n]*)*)`, 'm').exec(header);
    if (!block) return [];
    return `${block[1]}\n${block[2]}`.split(/[\n,]/).map(part => part.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

/** What a harness loads besides the canonical rules: the generated Copilot adapters and the Cursor rule file. */
export interface LoadedHarnessArtifacts {
    copilotAdapters?: Array<{ file: string; content: string }>;
    cursorRule?: string;
}

/**
 * Rule bytes loaded at session start per harness, counting the artifacts each one reads:
 * Claude Code reads CLAUDE.md (general.md) and every `.claude/rules` file without `paths`, so general.md arrives twice;
 * Copilot reads copilot-instructions.md (general.md) and the generated adapters whose `applyTo` covers every file;
 * Pi reads AGENTS.md (general.md) as a context file and puts every universal rule in the system prompt, so general.md is counted twice;
 * Cursor reads its always-apply rule file and the general.md it references; Codex and OpenCode read AGENTS.md (general.md).
 */
export function alwaysOnHarnessBytes(entries: Array<{ file: string; content: string }>, loaded: LoadedHarnessArtifacts = {}): Record<string, number> {
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

/** Byte and unscoped-rule totals complement the hard always-on line cap. */
export function alwaysOnFindings(entries: Array<{ file: string; content: string }>, budgets = alwaysOnHarnessBudgets, loaded: LoadedHarnessArtifacts = {}): AuthoringFinding[] {
    const findings: AuthoringFinding[] = [];
    let unscopedBytes = 0;
    for (const { file, content } of entries) {
        const body = skillBody(content);
        const header = content.slice(0, content.length - body.length);
        if (!/^paths:/m.test(header)) unscopedBytes += Buffer.byteLength(content);
        const add = (rule: string, matchedText: string) => findings.push({ file, line: 1, rule, matchedText });
        if (file.endsWith('/general.md')) {
            if (lineCount(content) > 200) add('always-on-lines', `${lineCount(content)} lines; maximum 200.`);
            if (Buffer.byteLength(content) > 24_000) add('always-on-bytes', `${Buffer.byteLength(content)} bytes; budget 24,000.`);
        }
        if (/^applyTo:\s*["']?\*\*\/\*["']?\s*$/m.test(header) && content.length > 4_000) add('copilot-budget', `${content.length} characters; review above 4,000.`);
    }
    const totals = alwaysOnHarnessBytes(entries, loaded);
    for (const [harness, budget] of Object.entries(budgets)) {
        if (totals[harness] > budget) findings.push({ file: '.cratis/ai/rules', line: 1, rule: 'always-on-harness-bytes', matchedText: `${harness} loads ${totals[harness]} rule bytes at session start; budget ${budget}.` });
    }
    if (unscopedBytes > unscopedRuleBudget) findings.push({ file: '.cratis/ai/rules', line: 1, rule: 'unscoped-rule-bytes', matchedText: `${unscopedBytes} bytes; budget ${unscopedRuleBudget.toLocaleString('en-US')}.` });
    return findings;
}

/** Required checks fail even during warn rollout; every other check follows one switch. */
export function skillAuthoringProblems(findings: AuthoringFinding[], mode = 'warn'): string[] {
    if (!['warn', 'fail'].includes(mode)) return ['SKILL_AUTHORING_MODE must be warn or fail.'];
    return findings.filter(finding => mode === 'fail' || requiredRules.has(finding.rule))
        .map(finding => `${finding.file}:${finding.line} [${finding.rule}] ${finding.matchedText}`);
}
