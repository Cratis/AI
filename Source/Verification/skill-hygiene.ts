// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isScalar, parseDocument } from 'yaml';
import { lineCount } from './skill-structure.ts';

const versionPattern = /(?<![\w.])v?\d+\.\d+\.\d+(?!\w|\.\d)/g;
const issuePattern = /(?<![\w#])(?:[\w.-]+\/[\w.-]+#\d+|#\d{3,})(?!\w)/g;
const sourceLinePattern = /(?<![\w.-])(?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z][\w]*:\d+(?:-\d+)?\b/g;
const hashPattern = /(?<!#)\b[\da-fA-F]{7,40}\b/g;
const descriptionMetaPattern = /\b(?:pinned|provenance|ledger|probe\w*|contradiction\w*)\b/gi;
const timePattern = /\b(?:today|currently|not yet|yet to|soon|planned|upcoming|recently|as of|new in|latest)\b/gi;
const historyPattern = /\b(?:read at v(?=\d|\b)|(?:decision 0\d{3}|ledger|drift report|historical|unreleased|released in|probed on)\b)/gi;

/** Preserve physical, one-based line numbers while excluding Requires lines and Markdown fences. */
export function proseLines(content: string, start: number) {
    let fence: { character: string; length: number } | undefined;
    return content.split(/\r?\n/).flatMap((text, index) => {
        if (index < start) return [];
        if (fence) {
            const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text);
            if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = undefined;
            return [];
        }
        const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
        if (opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
            fence = { character: opening[1][0], length: opening[1].length };
            return [];
        }
        if (/^\s*(?:(?:[-*+]|\d+[.)])\s+)?Requires /.test(text)) return [];
        return [{ text, line: index + 1 }];
    });
}

function matches(file: string, lines: Array<{ text: string; line: number }>, rule: string, pattern: RegExp) {
    return lines.flatMap(({ text, line }) => [...text.matchAll(pattern)].map(match => ({ file, line, rule, matchedText: match[0] })));
}

function descriptionFindings(file: string, content: string, closing: number, authoring: boolean) {
    const lines = content.split('\n');
    const openingOffset = lines[0].length + 1;
    const document = parseDocument(lines.slice(1, closing).join('\n') + '\n');
    // Malformed YAML is already reported by the frontmatter validator.
    if (document.errors.length > 0) return [];
    const description = document.get('description', true);
    if (!isScalar(description) || typeof description.value !== 'string' || !description.range) return [];
    const start = openingOffset + description.range[0];
    const end = openingOffset + description.range[1];
    const firstLine = content.slice(0, start).split('\n').length;
    // Scan the scalar's source range, not its folded value, to keep multiline locations accurate.
    const sourceLines = content.slice(start, end).split(/\r?\n/).map((text, index) => ({ text, line: firstLine + index }));
    return [
        ...matches(file, sourceLines, 'description-version', versionPattern),
        ...(authoring ? matches(file, sourceLines, 'description-meta', descriptionMetaPattern) : []),
    ];
}

/**
 * Findings for one SKILL.md or references/*.md file; other files are out of scope.
 * When a version budget is exceeded, every nonexempt version occurrence is reported.
 * Reference density uses all physical file lines: versions * 40 > lines, without rounding.
 */
export function skillHygieneFindings(file: string, content: string, authoring = false) {
    const path = file.replaceAll('\\', '/');
    const skill = /(?:^|\/)SKILL\.md$/.test(path);
    const reference = /(?:^|\/)references\/.+\.md$/.test(path);
    if (!skill && !reference) return [];
    const lines = content.split(/\r?\n/);
    const closing = skill && lines[0] === '---' ? lines.findIndex((line, index) => index > 0 && line === '---') : -1;
    const prose = proseLines(content, closing > 0 ? closing + 1 : 0);
    const versions = matches(file, prose, skill ? 'skill-version-budget' : 'reference-version-density', versionPattern);
    const findings = closing > 0 ? descriptionFindings(file, content, closing, authoring) : [];
    if (skill ? versions.length > 3 : versions.length * 40 > lineCount(content)) findings.push(...versions);
    findings.push(...matches(file, prose, 'issue-reference', issuePattern));
    findings.push(...matches(file, prose, 'source-line-citation', sourceLinePattern));
    if (skill) {
        findings.push(...matches(file, prose, 'commit-hash', hashPattern).filter(finding => /\d/.test(finding.matchedText) && /[a-f]/i.test(finding.matchedText)));
        findings.push(...matches(file, prose, 'history-language', historyPattern));
    }
    if (authoring) findings.push(...matches(file, prose, 'time-words', timePattern));
    return findings.sort((left, right) => left.line - right.line || left.rule.localeCompare(right.rule));
}

/** Hygiene for scoped instructions; every version is informational, without a skill-body budget. */
export function instructionHygieneFindings(file: string, content: string) {
    if (!/(?:^|\/)(?:rules|agents|prompts)\/[^/]+\.md$/.test(file.replaceAll('\\', '/'))) return [];
    const lines = content.split(/\r?\n/);
    const closing = lines[0] === '---' ? lines.findIndex((line, index) => index > 0 && line === '---') : -1;
    const prose = proseLines(content, closing > 0 ? closing + 1 : 0);
    return [
        ...matches(file, prose, 'instruction-version', versionPattern),
        ...matches(file, prose, 'issue-reference', issuePattern),
        ...matches(file, prose, 'source-line-citation', sourceLinePattern),
        ...matches(file, prose, 'history-language', historyPattern),
        ...matches(file, prose, 'time-words', timePattern),
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
