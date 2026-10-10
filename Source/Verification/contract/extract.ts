// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Contract } from './Contract.ts';
import { Kind } from './Kind.ts';
import type { Subject } from './Subject.ts';

/** Expand endpoints as well as the interior; never silently truncate an invalid range. */
export function expandCodes(first: string, last?: string): string[] {
    if (![first, last ?? first].every(endpoint => /^(?:PLAY)?\d{4}$/.test(endpoint))) throw new Error(`Malformed diagnostic range ${first}–${last ?? first}.`);
    const start = Number(first.replace('PLAY', ''));
    const end = Number((last ?? first).replace('PLAY', ''));
    if (end < start) throw new Error(`Descending diagnostic range ${first}–${last}.`);
    return Array.from({ length: end - start + 1 }, (_, index) => `PLAY${String(start + index).padStart(4, '0')}`);
}

/**
 * Tool slots are Tools table cells, an explicit MCP/tool prefix, and name(arguments).
 * Additionally recognize published names in an MCP paragraph/heading, not arbitrary view names.
 * Only named parameters inside that same invocation span are claims about tool input schemas.
 */
export function extract(file: string, content: string, contract: Contract, problems: string[] = []): Subject[] {
    const subjects: Subject[] = [];
    const lines = content.split(/\r?\n/);
    const toolNames = new Set(contract.mcpTools.map(tool => tool.name));
    let headings: Array<{ level: number; text: string }> = [];
    let toolColumn = -1;
    const tableCommands = new Map<number, string>();
    for (let index = 0; index < lines.length; index++) {
        const text = lines[index];
        const add = (kind: Kind, value: string, owner?: string) => {
            if (!subjects.some(subject => subject.line === index + 1 && subject.kind === kind && subject.value === value && subject.owner === owner)) {
                subjects.push({ file, line: index + 1, text, kind, value, ...(owner ? { owner } : {}) });
            }
        };
        // Strip only Markdown delimiters for matching; subjects retain the original text and line.
        const diagnosticText = text.replaceAll('`', '');
        for (const match of diagnosticText.matchAll(/\bPLAY(\d\w*)\b(?:\s*(?:[–—-]|\bto\b)\s*((?:PLAY)?\d\w*|PLAY[A-Za-z]\w*)\b)?((?:\/(?:PLAY)?\d{4}\b)*)/g)) {
            try {
                for (const code of expandCodes(match[1], match[2])) add(Kind.Diagnostic, code);
            } catch (error) {
                problems.push(`${file}:${index + 1} ${error instanceof Error ? error.message : String(error)}`);
                // Still check valid endpoints rather than abandoning the line after a malformed range.
                if (/^\d{4}$/.test(match[1])) add(Kind.Diagnostic, `PLAY${match[1]}`);
                if (/^(?:PLAY)?\d{4}$/.test(match[2] ?? '')) add(Kind.Diagnostic, `PLAY${match[2].replace('PLAY', '')}`);
            }
            for (const code of match[3].matchAll(/\/(?:PLAY)?(\d{4})/g)) add(Kind.Diagnostic, `PLAY${code[1]}`);
        }
        const heading = /^(#{1,6})\s+(.+)/.exec(text);
        if (heading) headings = [...headings.filter(item => item.level < heading[1].length), { level: heading[1].length, text: heading[2] }];
        const cells = text.startsWith('|') ? text.split('|') : [];
        const headerColumn = cells.findIndex(cell => /^\s*Tools?\s*$/i.test(cell));
        if (headerColumn >= 0) toolColumn = headerColumn;
        if (cells.length === 0) {
            toolColumn = -1;
            tableCommands.clear();
        }
        // A new table must not inherit the preceding table's command ownership.
        if (cells.some(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) tableCommands.clear();
        let paragraphStart = index;
        let paragraphEnd = index;
        while (paragraphStart > 0 && lines[paragraphStart - 1].trim()) paragraphStart--;
        while (paragraphEnd + 1 < lines.length && lines[paragraphEnd + 1].trim()) paragraphEnd++;
        const context = [...headings.map(item => item.text), ...lines.slice(paragraphStart, paragraphEnd + 1)].join('\n');
        const mcpContext = /\bMCP\b|tools\/list|stdio transcript/i.test(context);
        for (const count of text.matchAll(/(?<![\w./])(\d+)(?:\/(\d+))?\s+tools\b/g)) {
            if (mcpContext) {
                add(Kind.ToolCount, count[1]);
                if (count[2]) add(Kind.ToolCount, count[2]);
            }
        }
        for (const span of text.matchAll(/`([^`\n]+)`/g)) {
            const invocation = /^([a-z]+(?:-[a-z]+)*)(?:\(([^)]*)\)|(\s+.*))?$/.exec(span[1]);
            if (invocation) {
                const name = invocation[1];
                const before = text.slice(0, span.index);
                const column = before.split('|').length - 1;
                const explicit = /(?:\bMCP\s+tool|\btools?(?:\s+(?:named|called))?)\s*$/i.test(before);
                const toolSlot = cells.length > 0 && column === toolColumn;
                if (mcpContext && (explicit || toolSlot || invocation[2] !== undefined || toolNames.has(name))) {
                    add(Kind.McpTool, name);
                    const parameters = invocation[2] ?? invocation[3] ?? '';
                    // Bare names in tool(a, b), or key: / key=; quoted values are not parameters.
                    const unquoted = parameters.replace(/"[^"]*"|'[^']*'/g, '');
                    for (const parameter of unquoted.matchAll(/\b([a-zA-Z][a-zA-Z0-9]*)(?=\s*[:=])/g)) add(Kind.McpParameter, parameter[1], name);
                    if (invocation[2] !== undefined && /^[\w\s,]*$/.test(parameters)) {
                        for (const parameter of parameters.split(',').map(value => value.trim()).filter(Boolean)) add(Kind.McpParameter, parameter, name);
                    }
                }
            }
        }
        // A command stays inside its code span/physical shell line. cratis screenplay is a different CLI.
        const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(match => ({ text: match[1], index: match.index }));
        if (/^\s*(?:\$\s*)?screenplay\b/.test(text)) spans.push({ text: text.trim().replace(/^\$\s*/, ''), index: 0 });
        let paragraphCommand: string | undefined;
        // Option-only spans inherit only an actual earlier command in the same paragraph.
        for (const previous of lines.slice(paragraphStart, index).join('\n').matchAll(/`([^`\n]+)`/g)) {
            if (/^cratis\b/.test(previous[1])) paragraphCommand = undefined;
            const command = /^screenplay\s+(\S+)/.exec(previous[1]);
            if (command) paragraphCommand = /^[a-z][a-z-]*$/.test(command[1]) ? command[1] : '';
        }
        for (const span of spans) {
            const column = text.slice(0, span.index).split('|').length - 1;
            if (/^cratis\b/.test(span.text)) {
                paragraphCommand = undefined;
                tableCommands.delete(column);
                continue;
            }
            const command = /^\s*(?:\$\s*)?screenplay\s+([^`\n;]+)/.exec(span.text);
            if (command) {
                const arguments_ = command[1].split(/\s+(?:or|and)\s+/)[0];
                const first = arguments_.trim().split(/\s+/)[0];
                const name = /^[a-z][a-z-]*$/.test(first) ? first : '';
                paragraphCommand = name;
                if (cells.length) tableCommands.set(column, name);
                add(Kind.CliCommand, name);
                for (const option of arguments_.matchAll(/--[a-z][a-z-]*\b/g)) add(Kind.CliOption, option[0], name || 'validate');
            } else if (/^--[a-z]/.test(span.text)) {
                const owner = cells.length ? tableCommands.get(column) : paragraphCommand;
                if (owner !== undefined) for (const option of span.text.matchAll(/--[a-z][a-z-]*\b/g)) add(Kind.CliOption, option[0], owner || 'validate');
            }
        }
    }
    return subjects;
}
