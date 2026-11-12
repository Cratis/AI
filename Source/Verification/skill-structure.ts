// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { parseDocument } from 'yaml';

/** Anthropic recommends keeping SKILL.md under 500 lines for progressive disclosure. */
export const maximumSkillBodyLines = 500;
/** Agent Skills recommends <5000 tokens; 20000 characters is a deliberately approximate budget. */
export const maximumSkillBodyCharacters = 20_000;
export const longReferenceLines = 100;

/** Line offsets retain the original bytes when a Contents block is inserted or replaced. */
function linesOf(content: string) {
    let offset = 0;
    return content.split('\n').map(line => {
        const start = offset;
        offset += line.length + 1;
        return { text: line.replace(/\r$/, ''), start, end: Math.min(offset, content.length) };
    });
}

export function lineCount(content: string): number {
    if (content === '') return 0;
    return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

/** Frontmatter delimiters, rather than YAML values, decide where the body begins. */
export function skillBody(content: string): string {
    const lines = linesOf(content);
    if (lines[0].text !== '---') return content;
    const closing = lines.findIndex((line, index) => index > 0 && line.text === '---');
    return closing < 0 ? content : content.slice(lines[closing].end);
}

/** Parsed frontmatter mapping, or undefined when absent, malformed (reported by the frontmatter validator) or not a mapping. */
function frontmatterFields(content: string): Record<string, unknown> | undefined {
    const lines = linesOf(content);
    const closing = lines.findIndex((line, index) => index > 0 && line.text === '---');
    if (lines[0].text !== '---' || closing <= 0) return undefined;
    const document = parseDocument(content.slice(lines[0].end, lines[closing].start));
    // The existing frontmatter validator reports malformed YAML, so do not duplicate that diagnostic.
    if (document.errors.length > 0) return undefined;
    let fields: unknown;
    try { fields = document.toJS(); } catch { fields = undefined; }
    return typeof fields === 'object' && fields !== null && !Array.isArray(fields) ? fields as Record<string, unknown> : undefined;
}

function isTextWithin(value: unknown, maximum: number): value is string {
    return typeof value === 'string' && value.length >= 1 && value.length <= maximum;
}

function isValidSkillName(name: unknown): boolean {
    return isTextWithin(name, 64) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && !/anthropic|claude/.test(name);
}

function descriptionProblems(subject: string, description: unknown): string[] {
    if (!isTextWithin(description, 1024)) return [`${subject} description must be a string of 1–1024 characters.`];
    return /<[^>]*>/.test(description) ? [`${subject} description must not contain XML/HTML tags (including generic type text).`] : [];
}

function frontmatterProblems(subject: string, fields: Record<string, unknown>): string[] {
    const problems: string[] = [];
    if (!isValidSkillName(fields.name)) {
        problems.push(`${subject} name must be 1–64 lowercase letters, digits or hyphens, with no leading/trailing hyphen, consecutive hyphens, 'anthropic' or 'claude'.`);
    }
    problems.push(...descriptionProblems(subject, fields.description));
    if (Object.hasOwn(fields, 'compatibility') && !isTextWithin(fields.compatibility, 500)) {
        problems.push(`${subject} compatibility must be a string of 1–500 characters when present.`);
    }
    return problems;
}

function bodySizeProblems(subject: string, body: string): string[] {
    const problems: string[] = [];
    if (lineCount(body) > maximumSkillBodyLines) problems.push(`${subject} body exceeds ${maximumSkillBodyLines} lines (${lineCount(body)}).`);
    if (body.length > maximumSkillBodyCharacters) problems.push(`${subject} body exceeds ~5000-token budget (${maximumSkillBodyCharacters} chars; ${body.length} found).`);
    return problems;
}

export function skillStructureProblems(subject: string, content: string): string[] {
    const fields = frontmatterFields(content);
    return [...fields ? frontmatterProblems(subject, fields) : [], ...bodySizeProblems(subject, skillBody(content))];
}

/**
 * True when the body names the skill-relative path itself, not the same path inside another skill
 * (`other-skill/references/x.md`): the path must not follow a path-segment character, except an optional `./`.
 */
export function referencesPath(body: string, path: string): boolean {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\w./-])(?:\\./)?${escaped}(?![\\w/-]|\\.\\w)`).test(body);
}

export function skillReferenceProblems(subject: string, body: string, paths: string[]): string[] {
    return paths.filter(path => !referencesPath(body, path)).map(path =>
        `${subject} must directly reference '${path}'; that file is only reachable through another file, or not at all.`);
}

interface Fence { character: string; length: number }

function fenceOpening(text: string): Fence | undefined {
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) return undefined;
    return { character: opening[1][0], length: opening[1].length };
}

function closesFence(text: string, fence: Fence): boolean {
    const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text);
    return closing !== null && closing[1][0] === fence.character && closing[1].length >= fence.length;
}

function headingOf(line: { text: string; start: number; end: number }, index: number) {
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/.exec(line.text);
    return heading ? [{ level: heading[1].length, text: (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim(), line: index, start: line.start, end: line.end }] : [];
}

/** ATX headings outside backtick/tilde fences, including fences with language/info strings. */
export function markdownHeadings(content: string) {
    let fence: Fence | undefined;
    return linesOf(content).flatMap((line, index) => {
        if (fence) {
            if (closesFence(line.text, fence)) fence = undefined;
            return [];
        }
        fence = fenceOpening(line.text);
        return fence ? [] : headingOf(line, index);
    });
}

function contentsEntries(content: string) {
    const headings = markdownHeadings(content).filter(heading => heading.level === 2 || heading.level === 3).filter(heading => !(heading.level === 2 && heading.text === 'Contents'));
    const secondLevel = headings.filter(heading => heading.level === 2);
    // With too few H2s, H3s carry the navigation. A sole H2 retains its H3 hierarchy.
    let underSecondLevel = false;
    return (secondLevel.length >= 2 ? secondLevel : headings).map(heading => {
        if (heading.level === 2) underSecondLevel = true;
        return `${heading.level === 3 && underSecondLevel ? '  ' : ''}- ${heading.text}`;
    });
}

function contentsPosition(content: string): number {
    const title = markdownHeadings(content).find(heading => heading.level === 1);
    if (!title) return 0;
    const following = linesOf(content)[title.line + 1];
    return following?.text === '' ? following.end : title.end;
}

function contentsSections(content: string) {
    const lines = linesOf(content);
    return markdownHeadings(content).filter(heading => heading.level === 2 && heading.text === 'Contents').map(heading => {
        let sectionEnd = heading.end;
        for (const line of lines.slice(heading.line + 1)) {
            if (line.text.trim() !== '' && !/^\s*[-*+]\s/.test(line.text)) break;
            sectionEnd = line.end;
        }
        return { ...heading, sectionEnd };
    });
}

/** Share of lines that must sit inside fences for a heading-less reference to count as one example listing. */
export const exampleListingFencedShare = 0.8;
/** A partial read previews about the first 100 lines; the listing's description must come well before that. */
export const exampleListingIntroductionLines = 30;

/**
 * A long reference that is one complete example (for example a whole `.play` model) has no sections to list:
 * its scope is stated by the prose before the fence, which a partial read sees. Headings inside the listing
 * would change the example itself, so it is exempt from Contents when nearly all of it is fenced and the
 * first fence opens within the introduction window.
 */
export function isExampleListing(content: string): boolean {
    let fence: Fence | undefined;
    let fenced = 0;
    let firstFence: number | undefined;
    const lines = linesOf(content);
    lines.forEach((line, index) => {
        if (fence) {
            fenced++;
            if (closesFence(line.text, fence)) fence = undefined;
            return;
        }
        fence = fenceOpening(line.text);
        if (fence) {
            fenced++;
            firstFence ??= index;
        }
    });
    return firstFence !== undefined && firstFence < exampleListingIntroductionLines && fenced / lines.length >= exampleListingFencedShare;
}

function contentsListMatches(content: string, section: { end: number; sectionEnd: number }, entries: string[]): boolean {
    const actual = content.slice(section.end, section.sectionEnd).split(/\r?\n/).filter(line => line.trim() !== '');
    const secondLevel = markdownHeadings(content).filter(heading => heading.level === 2 && heading.text !== 'Contents');
    // Nested H3 navigation is optional when H2s are sufficient; it must still be a bullet list.
    const relevant = secondLevel.length >= 2 ? actual.filter(line => !/^  - /.test(line)) : actual;
    return actual.every(line => /^(?:  )?- .+/.test(line)) && JSON.stringify(relevant) === JSON.stringify(entries);
}

export function referenceContentsProblems(subject: string, content: string): string[] {
    if (lineCount(content) <= longReferenceLines) return [];
    const entries = contentsEntries(content);
    if (entries.length === 0) {
        if (isExampleListing(content)) return [];
        return [`${subject} is a long reference with no H2/H3 headings outside fences and is not a single example listing; add headings so a Contents list can be generated.`];
    }
    const sections = contentsSections(content);
    if (sections.length !== 1 || sections[0].start !== contentsPosition(content)) {
        return [`${subject} requires one '## Contents' list at the top, directly after its H1 title and blank line (or at line 1 without an H1).`];
    }
    return contentsListMatches(content, sections[0], entries) ? [] : [`${subject} Contents entries must exactly match its H2 headings in order (H3 fallback when fewer than two H2 headings).`];
}

/** A block ending the file keeps a file that had no trailing newline without one. */
function blockForEnd(block: string, content: string, atEnd: boolean): string {
    return atEnd && !content.endsWith('\n') ? block.replace(/(?:\r?\n)+$/, '') : block;
}

function insertContentsBlock(content: string, block: string, newline: string): string {
    const position = contentsPosition(content);
    const needsBlank = position > 0 && !content.slice(0, position).endsWith(newline + newline);
    return content.slice(0, position) + (needsBlank ? newline : '') + blockForEnd(block, content, position === content.length) + content.slice(position);
}

function removeContentsSections(content: string, sections: { start: number; sectionEnd: number }[]): string {
    let remaining = content;
    for (const existing of [...sections].reverse()) {
        remaining = remaining.slice(0, existing.start) + remaining.slice(existing.sectionEnd);
    }
    return remaining;
}

/** Returns unchanged text when correct; only the Contents section is replaced, never the rest of the file. */
export function withReferenceContents(content: string): string {
    if (referenceContentsProblems('reference', content).length === 0) return content;
    const entries = contentsEntries(content);
    if (entries.length === 0) return content;
    const sections = contentsSections(content);
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const block = ['## Contents', '', ...entries, ''].join(newline) + newline;
    if (sections.length === 0) return insertContentsBlock(content, block, newline);
    const section = sections[0];
    if (sections.length === 1 && section.start === contentsPosition(content)) {
        return content.slice(0, section.start) + blockForEnd(block, content, section.sectionEnd === content.length) + content.slice(section.sectionEnd);
    }
    // Remove only misplaced/duplicate lists, then insert at the title; all prose remains untouched.
    return withReferenceContents(removeContentsSections(content, sections));
}

/** Check both POSIX and Windows spellings regardless of the verifier's host platform. */
export function skillAssertionFileProblem(file: unknown): string | undefined {
    if (typeof file !== 'string' || file.length === 0) return 'file must be a non-empty skill-relative path';
    if (/^(?:[\\/]|[A-Za-z]:)/.test(file) || file.split(/[\\/]/).includes('..')) return 'file must not escape the skill directory (absolute paths and .. are forbidden)';
    return undefined;
}

export function skillContainsAssertionProblems(subject: string, assertion: { kind: string; value: string; file?: string }, content: string | undefined): string[] {
    if (assertion.file !== undefined) {
        const problem = skillAssertionFileProblem(assertion.file);
        if (problem) return [`${subject} assertion failed: ${JSON.stringify(assertion)}; ${problem}.`];
        if (content === undefined) return [`${subject} assertion failed: ${JSON.stringify(assertion)}; file does not exist in the skill directory.`];
    }
    return assertion.kind === 'skill-contains' && typeof assertion.value === 'string' && content?.includes(assertion.value)
        ? [] : [`${subject} assertion failed: ${JSON.stringify(assertion)}.`];
}

/** Markdown link targets outside code, without their anchors; schemes and same-file anchors are left out. */
function proseLinkTargets(content: string): string[] {
    const prose = content.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/(`+)[^`\n]*?\1/g, '');
    return [...prose.matchAll(/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)]
        .map(match => match[1].split('#')[0])
        .filter(target => target !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(target));
}

/** Relative Markdown link targets outside code; site-absolute paths, schemes and same-file anchors are not files. */
export function relativeLinkTargets(content: string): string[] {
    return proseLinkTargets(content).filter(target => !target.startsWith('/'));
}

/** Site-absolute link targets such as `/arc/backend/`; they resolve only on a documentation site, never from disk. */
export function siteAbsoluteLinkTargets(content: string): string[] {
    return proseLinkTargets(content).filter(target => target.startsWith('/'));
}

/**
 * A link moved into references/ without rewriting resolves against the wrong directory and sends the agent nowhere,
 * and a site-absolute path sends an agent reading the skill from disk nowhere at all.
 */
export function brokenRelativeLinkProblems(subject: string, content: string, exists: (target: string) => boolean): string[] {
    return [
        ...siteAbsoluteLinkTargets(content)
            .map(target => `${subject} links to the site path '${target}'; use the absolute documentation URL (https://www.cratis.io${target}).`),
        ...relativeLinkTargets(content).filter(target => !exists(target))
            .map(target => `${subject} links to '${target}', which does not exist relative to the file.`),
    ];
}
