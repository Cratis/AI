// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isScalar, parseDocument } from 'yaml';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import { alwaysOnBudgetFindings, alwaysOnHarnessBudgets, alwaysOnHarnessBytes, type InstructionEntry, type LoadedHarnessArtifacts } from './always-on-budget.ts';
import { instructionHygieneFindings, proseLines, skillHygieneFindings } from './skill-hygiene.ts';
import { lineCount, referencesPath, skillBody } from './skill-structure.ts';

const warningOnlyRules = new Set(['description-overlap']);
const requiredRules = new Set(['description-when', 'description-voice', 'eval-coverage-ratchet', 'always-on-lines', 'always-on-harness-bytes', 'asset-reachability']);

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
            if (!/^Use (?:when|before)\s+\S/.test(value.trim())) add('description-when', 'Start with Use when or Use before followed by an invocation condition; keep summaries in the body.', line);
            // Quoted commands and inline code are examples, not the description author's voice.
            const voice = value.replace(/(`+)[\s\S]*?\1|"(?:\\.|[^"\\])*"|(?<!\w)'(?:\\.|[^'\\])*'(?!\w)|“[^”]*”|‘[^’]*’/g, ' ');
            for (const match of voice.matchAll(/\b(?:I|I'll|my|you|your)\b/gi)) add('description-voice', match[0], line);
        }
        const body = skillBody(content);
        if (body.length > 16_000) add('body-headroom', `${body.length} characters; target at most 16,000.`);
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

/** Unique lowercase ASCII word tokens from the positive trigger, excluding routing boilerplate. */
export function skillTriggerTokens(description: string): Set<string> {
    const trigger = /\b(?:Use|Load|Read) (?:this )?(?:skill )?(?:when|for|to|before|whenever|if)\b([\s\S]*)/i.exec(description)?.[1] ?? '';
    const positive = trigger.split(/\b(?:Not for|Not when|Do not use|Don't use)\b/i)[0];
    const stopWords = new Set('a an the and or for of to in on with when where how what which that this is are be as by from use skill adding changing writing building existing must needs not it its through'.split(' '));
    return new Set((positive.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? []).filter(token => !stopWords.has(token)));
}

/** Jaccard similarity >= 0.4 warns (unrounded); empty triggers never match. No allowlist. */
export const skillOverlapThreshold = 0.4;

/** Compare canonical skill entry points once per pair; negative routing cannot inflate similarity. */
export function skillOverlapFindings(entries: Array<{ file: string; content: string }>): AuthoringFinding[] {
    const skills = entries.filter(entry => /(?:^|\/)SKILL\.md$/.test(entry.file.replaceAll('\\', '/')))
        .map(entry => ({ ...entry, description: descriptionOf(entry.content) }))
        .filter(entry => entry.description !== undefined)
        .map(entry => ({ file: entry.file, line: entry.description!.line, tokens: skillTriggerTokens(entry.description!.value) }))
        .sort((left, right) => left.file.localeCompare(right.file));
    const pairs: Array<{ finding: AuthoringFinding; score: number }> = [];
    for (let index = 0; index < skills.length; index++) {
        const left = skills[index];
        if (left.tokens.size === 0) continue;
        for (const right of skills.slice(index + 1)) {
            const shared = [...left.tokens].filter(token => right.tokens.has(token)).length;
            const score = shared / (left.tokens.size + right.tokens.size - shared);
            if (score >= skillOverlapThreshold) pairs.push({ score, finding: {
                file: left.file, line: left.line, rule: 'description-overlap',
                matchedText: `${right.file}:${right.line} trigger Jaccard=${score.toFixed(3)} (>= ${skillOverlapThreshold}); sharpen triggers and sibling routing.`,
            } });
        }
    }
    return pairs.sort((left, right) => right.score - left.score || left.finding.file.localeCompare(right.finding.file) || left.finding.matchedText.localeCompare(right.finding.matchedText))
        .map(pair => pair.finding);
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

/** Warn-mode ceiling for the combined bytes of rules without `paths`, which Claude Code loads at session start. */
export const unscopedRuleBudget = 91_000;

/** Byte and unscoped-rule totals complement the hard always-on line cap. */
export function alwaysOnFindings(entries: InstructionEntry[], budgets = alwaysOnHarnessBudgets, loaded: LoadedHarnessArtifacts = {}): AuthoringFinding[] {
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
    findings.push(...alwaysOnBudgetFindings(alwaysOnHarnessBytes(entries, loaded), budgets));
    if (unscopedBytes > unscopedRuleBudget) findings.push({ file: '.cratis/ai/rules', line: 1, rule: 'unscoped-rule-bytes', matchedText: `${unscopedBytes} bytes; budget ${unscopedRuleBudget.toLocaleString('en-US')}.` });
    return findings;
}

/** Required checks fail even during warn rollout; every other check follows one switch. */
export function skillAuthoringProblems(findings: AuthoringFinding[], mode = 'warn'): string[] {
    if (!['warn', 'fail'].includes(mode)) return ['SKILL_AUTHORING_MODE must be warn or fail.'];
    return findings.filter(finding => !warningOnlyRules.has(finding.rule) && (mode === 'fail' || requiredRules.has(finding.rule)))
        .map(finding => `${finding.file}:${finding.line} [${finding.rule}] ${finding.matchedText}`);
}
