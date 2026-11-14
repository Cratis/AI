// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isScalar, parseDocument } from 'yaml';
import { lineCount } from './skill-structure.ts';
import type { HygieneSource } from './HygieneSource.ts';

const versionPattern = /(?<![\w.])v?\d+\.\d+\.\d+(?!\w|\.\d)/g;
const issuePattern = /(?<![\w#])(?:[\w.-]+\/[\w.-]+#\d+|#\d{3,})(?!\w)/g;
const sourceLinePattern = /(?<![\w.-])(?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z][\w]*:\d+(?:-\d+)?\b/g;
const hashPattern = /(?<!#)\b[\da-fA-F]{7,40}\b/g;
const descriptionMetaPattern = /\b(?:pinned|provenance|ledger|probe\w*|contradiction\w*)\b/gi;
const timePattern = /\b(?:today|currently|not yet|yet to|soon|planned|upcoming|recently|as of|new in|latest)\b/gi;
const historyPattern = /\b(?:read at v(?=\d|\b)|(?:decision 0\d{3}|ledger|drift report|historical|unreleased|released in|probed on)\b)/gi;

interface Fence { character: string; length: number }

function fenceOpening({ text }: { text: string }): Fence | undefined {
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (!opening) return undefined;
    if (opening[1][0] === '`' && opening[2].includes('`')) return undefined;
    return { character: opening[1][0], length: opening[1].length };
}

function closesFence({ text }: { text: string }, fence: Fence): boolean {
    const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text);
    return closing !== null && closing[1][0] === fence.character && closing[1].length >= fence.length;
}

/** Preserve physical, one-based line numbers while excluding Requires lines and Markdown fences. */
export function proseLines(content: string, start: number) {
    let fence: Fence | undefined;
    return content.split(/\r?\n/).flatMap((text, index) => {
        if (index < start) return [];
        const line = { text, line: index + 1 };
        if (fence) {
            if (closesFence(line, fence)) fence = undefined;
            return [];
        }
        fence = fenceOpening(line);
        if (fence || /^\s*(?:(?:[-*+]|\d+[.)])\s+)?Requires /.test(text)) return [];
        return [line];
    });
}

function matches({ file }: HygieneSource, lines: Array<{ text: string; line: number }>, rule: string, pattern: RegExp) {
    return lines.flatMap(({ text, line }) => [...text.matchAll(pattern)].map(match => ({ file, line, rule, matchedText: match[0] })));
}

function descriptionFindings(source: HygieneSource, closing: number) {
    const { content, authoring } = source;
    const lines = content.split('\n');
    const openingOffset = lines[0].length + 1;
    const document = parseDocument(lines.slice(1, closing).join('\n') + '\n');
    // Malformed YAML is already reported by the frontmatter validator.
    if (document.errors.length > 0) return [];
    const description = document.get('description', true);
    if (!isScalar(description)) return [];
    if (typeof description.value !== 'string') return [];
    if (!description.range) return [];
    const [rangeStart, rangeEnd] = description.range;
    const start = openingOffset + rangeStart;
    const end = openingOffset + rangeEnd;
    const firstLine = content.slice(0, start).split('\n').length;
    // Scan the scalar's source range, not its folded value, to keep multiline locations accurate.
    const sourceLines = content.slice(start, end).split(/\r?\n/).map((text, index) => ({ text, line: firstLine + index }));
    return [
        ...matches(source, sourceLines, 'description-version', versionPattern),
        ...(authoring ? matches(source, sourceLines, 'description-meta', descriptionMetaPattern) : []),
    ];
}

/** Index of the closing `---` of the frontmatter, or -1 when the content has none. */
function frontmatterClosing({ content }: HygieneSource): number {
    const lines = content.split(/\r?\n/);
    return lines[0] === '---' ? lines.findIndex((line, index) => index > 0 && line === '---') : -1;
}

function isSkillSource({ file }: HygieneSource): boolean {
    return /(?:^|\/)SKILL\.md$/.test(file.replaceAll('\\', '/'));
}

function versionsExceedBudget(source: HygieneSource, versions: ReturnType<typeof matches>): boolean {
    return isSkillSource(source) ? versions.length > 3 : versions.length * 40 > lineCount(source.content);
}

function skillOnlyFindings(source: HygieneSource, prose: Array<{ text: string; line: number }>) {
    return [
        ...matches(source, prose, 'commit-hash', hashPattern).filter(finding => /\d/.test(finding.matchedText) && /[a-f]/i.test(finding.matchedText)),
        ...matches(source, prose, 'history-language', historyPattern),
    ];
}

/**
 * Findings for one SKILL.md or references/*.md file; other files are out of scope.
 * When a version budget is exceeded, every nonexempt version occurrence is reported.
 * Reference density uses all physical file lines: versions * 40 > lines, without rounding.
 */
export function skillHygieneFindings(file: string, content: string, authoring = false) {
    const source = { file, content, authoring };
    const reference = /(?:^|\/)references\/.+\.md$/.test(file.replaceAll('\\', '/'));
    if (!isSkillSource(source) && !reference) return [];
    return scopedSkillFindings(source);
}

function scopedSkillFindings(source: HygieneSource) {
    const closing = isSkillSource(source) ? frontmatterClosing(source) : -1;
    const prose = proseLines(source.content, closing > 0 ? closing + 1 : 0);
    const findings = closing > 0 ? descriptionFindings(source, closing) : [];
    findings.push(...bodyFindings(source, prose));
    return findings.sort((left, right) => left.line - right.line || left.rule.localeCompare(right.rule));
}

function bodyFindings(source: HygieneSource, prose: Array<{ text: string; line: number }>) {
    const skill = isSkillSource(source);
    const versions = matches(source, prose, skill ? 'skill-version-budget' : 'reference-version-density', versionPattern);
    return [
        ...(versionsExceedBudget(source, versions) ? versions : []),
        ...matches(source, prose, 'issue-reference', issuePattern),
        ...matches(source, prose, 'source-line-citation', sourceLinePattern),
        ...(skill ? skillOnlyFindings(source, prose) : []),
        ...(source.authoring ? matches(source, prose, 'time-words', timePattern) : []),
    ];
}

/** Hygiene for scoped instructions; every version is informational, without a skill-body budget. */
export function instructionHygieneFindings(file: string, content: string) {
    if (!/(?:^|\/)(?:rules|agents|prompts)\/[^/]+\.md$/.test(file.replaceAll('\\', '/'))) return [];
    const source = { file, content, authoring: true };
    const closing = frontmatterClosing(source);
    const prose = proseLines(content, closing > 0 ? closing + 1 : 0);
    return [
        ...matches(source, prose, 'instruction-version', versionPattern),
        ...matches(source, prose, 'issue-reference', issuePattern),
        ...matches(source, prose, 'source-line-citation', sourceLinePattern),
        ...matches(source, prose, 'history-language', historyPattern),
        ...matches(source, prose, 'time-words', timePattern),
    ];
}

/** Deterministic totals for the informational verifier report, with busiest files first. */
export function skillHygieneReport(findings: ReturnType<typeof skillHygieneFindings>) {
    const counts = (key: 'rule' | 'file') => {
        const totals = new Map<string, number>();
        for (const finding of findings) totals.set(finding[key], (totals.get(finding[key]) ?? 0) + 1);
        return [...totals].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    };
    return { total: findings.length, perRule: counts('rule'), perFile: counts('file') };
}

/** Warn is the default rollout mode; fail promotes findings to ordinary verifier failures. */
export function skillHygieneProblems(findings: ReturnType<typeof skillHygieneFindings>, mode = 'warn'): string[] {
    if (mode !== 'warn' && mode !== 'fail') return ['SKILL_HYGIENE_MODE must be warn or fail.'];
    return mode === 'warn' ? [] : findings.map(finding => `${finding.file}:${finding.line} [${finding.rule}] ${finding.matchedText}`);
}
