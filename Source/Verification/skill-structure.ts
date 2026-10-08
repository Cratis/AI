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

export function skillStructureProblems(subject: string, content: string): string[] {
    const problems: string[] = [];
    const lines = linesOf(content);
    const closing = lines.findIndex((line, index) => index > 0 && line.text === '---');
    if (lines[0].text === '---' && closing > 0) {
        const document = parseDocument(content.slice(lines[0].end, lines[closing].start));
        // The existing frontmatter validator reports malformed YAML, so do not duplicate that diagnostic.
        if (document.errors.length === 0) {
            let fields: unknown;
            try { fields = document.toJS(); } catch { fields = undefined; }
            if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
                const { name, description, compatibility } = fields as Record<string, unknown>;
                if (typeof name !== 'string' || name.length < 1 || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || /anthropic|claude/.test(name)) {
                    problems.push(`${subject} name must be 1–64 lowercase letters, digits or hyphens, with no leading/trailing hyphen, consecutive hyphens, 'anthropic' or 'claude'.`);
                }
                if (typeof description !== 'string' || description.length < 1 || description.length > 1024) {
                    problems.push(`${subject} description must be a string of 1–1024 characters.`);
                } else if (/<[^>]*>/.test(description)) {
                    problems.push(`${subject} description must not contain XML/HTML tags (including generic type text).`);
                }
                if (Object.hasOwn(fields, 'compatibility') && (typeof compatibility !== 'string' || compatibility.length < 1 || compatibility.length > 500)) {
                    problems.push(`${subject} compatibility must be a string of 1–500 characters when present.`);
                }
            }
        }
    }
    const body = skillBody(content);
    if (lineCount(body) > maximumSkillBodyLines) problems.push(`${subject} body exceeds ${maximumSkillBodyLines} lines (${lineCount(body)}).`);
    if (body.length > maximumSkillBodyCharacters) problems.push(`${subject} body exceeds ~5000-token budget (${maximumSkillBodyCharacters} chars; ${body.length} found).`);
    return problems;
}

export function skillReferenceProblems(subject: string, body: string, paths: string[]): string[] {
    return paths.filter(path => !body.includes(path)).map(path =>
        `${subject} must directly reference '${path}'; that file is only reachable through another file, or not at all.`);
}

/** ATX headings outside backtick/tilde fences, including fences with language/info strings. */
export function markdownHeadings(content: string) {
    let fence: { character: string; length: number } | undefined;
    return linesOf(content).flatMap((line, index) => {
        if (fence) {
            const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line.text);
            if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = undefined;
            return [];
        }
        const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
        if (opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
            fence = { character: opening[1][0], length: opening[1].length };
            return [];
        }
        const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/.exec(line.text);
        return heading ? [{ level: heading[1].length, text: (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim(), line: index, start: line.start, end: line.end }] : [];
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
    let fence: { character: string; length: number } | undefined;
    let fenced = 0;
    let firstFence: number | undefined;
    const lines = linesOf(content);
    lines.forEach((line, index) => {
        if (fence) {
            fenced++;
            const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line.text);
            if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = undefined;
            return;
        }
        const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
        if (opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
            fence = { character: opening[1][0], length: opening[1].length };
            fenced++;
            firstFence ??= index;
        }
    });
    return firstFence !== undefined && firstFence < exampleListingIntroductionLines && fenced / lines.length >= exampleListingFencedShare;
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
    const section = sections[0];
    const actual = content.slice(section.end, section.sectionEnd).split(/\r?\n/).filter(line => line.trim() !== '');
    const secondLevel = markdownHeadings(content).filter(heading => heading.level === 2 && heading.text !== 'Contents');
    // Nested H3 navigation is optional when H2s are sufficient; it must still be a bullet list.
    const relevant = secondLevel.length >= 2 ? actual.filter(line => !/^  - /.test(line)) : actual;
    if (actual.some(line => !/^(?:  )?- .+/.test(line)) || JSON.stringify(relevant) !== JSON.stringify(entries)) {
        return [`${subject} Contents entries must exactly match its H2 headings in order (H3 fallback when fewer than two H2 headings).`];
    }
    return [];
}

/** Returns unchanged text when correct; only the Contents section is replaced, never the rest of the file. */
export function withReferenceContents(content: string): string {
    if (referenceContentsProblems('reference', content).length === 0) return content;
    const entries = contentsEntries(content);
    if (entries.length === 0) return content;
    const sections = contentsSections(content);
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const block = ['## Contents', '', ...entries, ''].join(newline) + newline;
    if (sections.length > 0) {
        const section = sections[0];
        if (sections.length === 1 && section.start === contentsPosition(content)) {
            const ending = section.sectionEnd === content.length && !content.endsWith('\n') ? block.replace(/(?:\r?\n)+$/, '') : block;
            return content.slice(0, section.start) + ending + content.slice(section.sectionEnd);
        }
        // Remove only misplaced/duplicate lists, then insert at the title; all prose remains untouched.
        let withoutContents = content;
        for (const existing of [...sections].reverse()) {
            withoutContents = withoutContents.slice(0, existing.start) + withoutContents.slice(existing.sectionEnd);
        }
        return withReferenceContents(withoutContents);
    }
    const position = contentsPosition(content);
    const needsBlank = position > 0 && !content.slice(0, position).endsWith(newline + newline);
    const ending = position === content.length && !content.endsWith('\n') ? block.replace(/(?:\r?\n)+$/, '') : block;
    return content.slice(0, position) + (needsBlank ? newline : '') + ending + content.slice(position);
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
