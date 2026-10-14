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

/** Byte and unscoped-rule totals complement the hard always-on line cap. */
export function alwaysOnFindings(entries: Array<{ file: string; content: string }>): AuthoringFinding[] {
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
    if (unscopedBytes > 60_000) findings.push({ file: '.cratis/ai/rules', line: 1, rule: 'unscoped-rule-bytes', matchedText: `${unscopedBytes} bytes; budget 60,000.` });
    return findings;
}

/** Required checks fail even during warn rollout; every other check follows one switch. */
export function skillAuthoringProblems(findings: AuthoringFinding[], mode = 'warn'): string[] {
    if (!['warn', 'fail'].includes(mode)) return ['SKILL_AUTHORING_MODE must be warn or fail.'];
    return findings.filter(finding => mode === 'fail' || requiredRules.has(finding.rule))
        .map(finding => `${finding.file}:${finding.line} [${finding.rule}] ${finding.matchedText}`);
}
