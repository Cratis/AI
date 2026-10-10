// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Fence } from './Fence.ts';
import { skillAssertionFileProblem } from '../skill-structure.ts';

export function parseFences(file: string, content: string): { fences: Fence[]; problems: string[] } {
    const fences: Fence[] = [];
    const problems: string[] = [];
    const lines = content.split(/\r?\n/);
    let opening: { character: string; length: number; line: number; information: string } | undefined;
    let number = 0;
    for (let index = 0; index < lines.length; index++) {
        if (opening) {
            const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(lines[index]);
            if (!closing || closing[1][0] !== opening.character || closing[1].length < opening.length) continue;
            if (/^screenplay(?:\s|$)/.test(opening.information)) {
                number++;
                const fence: Fence = { file, line: opening.line + 1, number, source: lines.slice(opening.line + 1, index).join('\n') + '\n', excerpt: false, expectedCodes: [], unbound: false };
                const tokens = opening.information.split(/\s+/).slice(1);
                const seen = new Set<string>();
                for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
                    const token = tokens[tokenIndex];
                    const key = token.split('=')[0];
                    if (seen.has(key)) problems.push(`${file}:${fence.line} duplicate marker '${key}'.`);
                    seen.add(key);
                    if (token === 'excerpt') fence.excerpt = true;
                    else if (token === 'expect') {
                        const codes = tokens[++tokenIndex] ?? '';
                        if (!/^PLAY\d{4}(?:,PLAY\d{4})*$/.test(codes)) problems.push(`${file}:${fence.line} expect requires comma-separated PLAY codes.`);
                        else fence.expectedCodes = [...new Set(codes.split(','))].sort();
                    } else if (token === 'test=unbound') fence.unbound = true;
                    else if (token.startsWith('parent=')) fence.parent = token.slice('parent='.length);
                    else problems.push(`${file}:${fence.line} unknown Screenplay fence marker '${token}'.`);
                }
                if (fence.parent !== undefined && (!fence.excerpt || skillAssertionFileProblem(fence.parent.split('#')[0]) || !/^[^#]+(?:#[1-9]\d*)?$/.test(fence.parent))) {
                    problems.push(`${file}:${fence.line} parent requires an excerpt and a safe skill-relative asset path (optional #fence-number).`);
                }
                if (fence.excerpt && !fence.parent && (fence.expectedCodes.length > 0 || fence.unbound)) problems.push(`${file}:${fence.line} an unparented excerpt cannot assert diagnostics or execution.`);
                if (fence.unbound && !/^[ \t]*specification\s/m.test(fence.source) && !fence.parent) problems.push(`${file}:${fence.line} test=unbound requires specifications.`);
                fences.push(fence);
            }
            opening = undefined;
            continue;
        }
        const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
        if (match && (match[1][0] !== '`' || !match[2].includes('`'))) opening = { character: match[1][0], length: match[1].length, line: index, information: match[2].trim() };
    }
    if (opening && /^screenplay(?:\s|$)/.test(opening.information)) problems.push(`${file}:${opening.line + 1} unclosed Screenplay fence.`);
    return { fences, problems };
}

export function pinnedVersion(content: string): string {
    const match = /^\| Screenplay language, standalone tool and MCP \| \*\*(\d+\.\d+\.\d+)\*\*/m.exec(content);
    if (!match) throw new Error('Standalone Screenplay pin is missing from versions.md.');
    return match[1];
}

/** Markdown parents prove a verbatim excerpt belongs to the compiled model; .play templates insert it. */
export function insideParent(source: string, parent: string): string {
    const excerpt = source.replace(/^(?:\s*\/\/[^\n]*\n)+/, '').trimEnd();
    const placeholder = /^([ \t]*)\/\/ @excerpt[ \t]*$/gm;
    const placeholders = [...parent.matchAll(placeholder)];
    if (placeholders.length > 1) throw new Error('Parent must have exactly one // @excerpt placeholder.');
    if (placeholders.length === 1) return parent.replace(placeholder, (_match, indentation: string) => excerpt.split('\n').map(line => indentation + line).join('\n'));
    // Adjacent specification excerpts can come from different slices in the same parent.
    const declarations = excerpt.split(/\n(?=specification\s)/).map(declaration => declaration.trimEnd());
    const contained = declarations.every(declaration => {
        for (let indentation = 0; indentation <= 24; indentation += 2) {
            const indented = declaration.split('\n').map(line => line ? ' '.repeat(indentation) + line : '').join('\n');
            if (`\n${parent.trimEnd()}\n`.includes(`\n${indented}\n`)) return true;
        }
        return false;
    });
    if (contained) return parent;
    throw new Error('Excerpt is not verbatim in its parent; use a .play parent with one // @excerpt placeholder for an insertion.');
}
