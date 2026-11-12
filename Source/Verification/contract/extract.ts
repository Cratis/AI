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

/** Match the longest published command by whole words; retain unknown first words for validation. */
function cliCommandName(arguments_: string, commandNames: string[]): string {
    const words = arguments_.trim().split(/\s+/);
    const published = commandNames.find(name => name.split(/\s+/).every((word, index) => word === words[index]));
    if (published !== undefined) return published;
    return /^[a-z][a-z-]*$/.test(words[0]) ? words[0] : '';
}

type Add = (kind: Kind, value: string, owner?: string) => void;

/** What the scan carries from one line to the next: headings and the table's tool column and command owners. */
interface Scan {
    file: string;
    lines: string[];
    toolNames: Set<string>;
    commandNames: string[];
    subjects: Subject[];
    problems: string[];
    headings: Array<{ level: number; text: string }>;
    toolColumn: number;
    tableCommands: Map<number, string>;
}

interface Line {
    index: number;
    text: string;
    cells: string[];
    add: Add;
}

const diagnosticReference = /\bPLAY(\d\w*)\b(?:\s*(?:[–—-]|\bto\b)\s*((?:PLAY)?\d\w*|PLAY[A-Za-z]\w*)\b)?((?:\/(?:PLAY)?\d{4}\b)*)/g;

function addDiagnosticRange(scan: Scan, line: Line, match: RegExpMatchArray): void {
    try {
        for (const code of expandCodes(match[1], match[2])) line.add(Kind.Diagnostic, code);
    } catch (error) {
        scan.problems.push(`${scan.file}:${line.index + 1} ${error instanceof Error ? error.message : String(error)}`);
        // Still check valid endpoints rather than abandoning the line after a malformed range.
        if (/^\d{4}$/.test(match[1])) line.add(Kind.Diagnostic, `PLAY${match[1]}`);
        if (/^(?:PLAY)?\d{4}$/.test(match[2] ?? '')) line.add(Kind.Diagnostic, `PLAY${match[2].replace('PLAY', '')}`);
    }
}

function scanDiagnostics(scan: Scan, line: Line): void {
    // Strip only Markdown delimiters for matching; subjects retain the original text and line.
    for (const match of line.text.replaceAll('`', '').matchAll(diagnosticReference)) {
        addDiagnosticRange(scan, line, match);
        for (const code of match[3].matchAll(/\/(?:PLAY)?(\d{4})/g)) line.add(Kind.Diagnostic, `PLAY${code[1]}`);
    }
}

function updateHeadings(scan: Scan, text: string): void {
    const heading = /^(#{1,6})\s+(.+)/.exec(text);
    if (heading) scan.headings = [...scan.headings.filter(item => item.level < heading[1].length), { level: heading[1].length, text: heading[2] }];
}

function updateTable(scan: Scan, cells: string[]): void {
    const headerColumn = cells.findIndex(cell => /^\s*Tools?\s*$/i.test(cell));
    if (headerColumn >= 0) scan.toolColumn = headerColumn;
    if (cells.length === 0) {
        scan.toolColumn = -1;
        scan.tableCommands.clear();
    }
    // A new table must not inherit the preceding table's command ownership.
    if (cells.some(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) scan.tableCommands.clear();
}

function paragraphStartOf(lines: string[], index: number): number {
    let start = index;
    while (start > 0 && lines[start - 1].trim()) start--;
    return start;
}

function paragraphEndOf(lines: string[], index: number): number {
    let end = index;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    return end;
}

function scanToolCounts(line: Line): void {
    for (const count of line.text.matchAll(/(?<![\w./])(\d+)(?:\/(\d+))?\s+tools\b/g)) {
        line.add(Kind.ToolCount, count[1]);
        if (count[2]) line.add(Kind.ToolCount, count[2]);
    }
}

function isToolClaim(scan: Scan, line: Line, spanIndex: number, invocation: RegExpExecArray): boolean {
    const before = line.text.slice(0, spanIndex);
    const column = before.split('|').length - 1;
    const explicit = /(?:\bMCP\s+tool|\btools?(?:\s+(?:named|called))?)\s*$/i.test(before);
    const toolSlot = line.cells.length > 0 && column === scan.toolColumn;
    return explicit || toolSlot || invocation[2] !== undefined || scan.toolNames.has(invocation[1]);
}

function addToolClaim(line: Line, invocation: RegExpExecArray): void {
    const name = invocation[1];
    line.add(Kind.McpTool, name);
    const parameters = invocation[2] ?? invocation[3] ?? '';
    // Bare names in tool(a, b), or key: / key=; quoted values are not parameters.
    const unquoted = parameters.replace(/"[^"]*"|'[^']*'/g, '');
    for (const parameter of unquoted.matchAll(/\b([a-zA-Z][a-zA-Z0-9]*)(?=\s*[:=])/g)) line.add(Kind.McpParameter, parameter[1], name);
    if (invocation[2] !== undefined && /^[\w\s,]*$/.test(parameters)) {
        for (const parameter of parameters.split(',').map(value => value.trim()).filter(Boolean)) line.add(Kind.McpParameter, parameter, name);
    }
}

function scanToolInvocations(scan: Scan, line: Line): void {
    for (const span of line.text.matchAll(/`([^`\n]+)`/g)) {
        const invocation = /^([a-z]+(?:-[a-z]+)*)(?:\(([^)]*)\)|(\s+.*))?$/.exec(span[1]);
        if (invocation && isToolClaim(scan, line, span.index ?? 0, invocation)) addToolClaim(line, invocation);
    }
}

/** A command stays inside its code span/physical shell line. cratis screenplay is a different CLI. */
function commandSpans(text: string): Array<{ text: string; index: number }> {
    const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(match => ({ text: match[1], index: match.index ?? 0 }));
    if (/^\s*(?:\$\s*)?screenplay\b/.test(text)) spans.push({ text: text.trim().replace(/^\$\s*/, ''), index: 0 });
    return spans;
}

/** Option-only spans inherit only an actual earlier command in the same paragraph. */
function earlierParagraphCommand(scan: Scan, paragraphStart: number, index: number): string | undefined {
    let paragraphCommand: string | undefined;
    for (const previous of scan.lines.slice(paragraphStart, index).join('\n').matchAll(/`([^`\n]+)`/g)) {
        if (/^cratis\b/.test(previous[1])) paragraphCommand = undefined;
        const command = /^screenplay\s+(.+)/.exec(previous[1]);
        if (command) paragraphCommand = cliCommandName(command[1], scan.commandNames);
    }
    return paragraphCommand;
}

/** Records the span's CLI claims and returns the paragraph's command owner afterwards. */
function scanCommandSpan(scan: Scan, line: Line, span: { text: string; index: number }, paragraphCommand: string | undefined): string | undefined {
    const column = line.text.slice(0, span.index).split('|').length - 1;
    if (/^cratis\b/.test(span.text)) {
        scan.tableCommands.delete(column);
        return undefined;
    }
    const command = /^\s*(?:\$\s*)?screenplay\s+([^`\n;]+)/.exec(span.text);
    if (command) {
        const arguments_ = command[1].split(/\s+(?:or|and)\s+/)[0];
        const name = cliCommandName(arguments_, scan.commandNames);
        if (line.cells.length) scan.tableCommands.set(column, name);
        line.add(Kind.CliCommand, name);
        for (const option of arguments_.matchAll(/--[a-z][a-z-]*\b/g)) line.add(Kind.CliOption, option[0], name || 'validate');
        return name;
    }
    if (/^--[a-z]/.test(span.text)) {
        const owner = line.cells.length ? scan.tableCommands.get(column) : paragraphCommand;
        if (owner !== undefined) for (const option of span.text.matchAll(/--[a-z][a-z-]*\b/g)) line.add(Kind.CliOption, option[0], owner || 'validate');
    }
    return paragraphCommand;
}

function scanCliCommands(scan: Scan, line: Line, paragraphStart: number): void {
    let paragraphCommand = earlierParagraphCommand(scan, paragraphStart, line.index);
    for (const span of commandSpans(line.text)) paragraphCommand = scanCommandSpan(scan, line, span, paragraphCommand);
}

function scanLine(scan: Scan, index: number): void {
    const text = scan.lines[index];
    const add: Add = (kind, value, owner) => {
        if (!scan.subjects.some(subject => subject.line === index + 1 && subject.kind === kind && subject.value === value && subject.owner === owner)) {
            scan.subjects.push({ file: scan.file, line: index + 1, text, kind, value, ...(owner ? { owner } : {}) });
        }
    };
    const line: Line = { index, text, cells: text.startsWith('|') ? text.split('|') : [], add };
    scanDiagnostics(scan, line);
    updateHeadings(scan, text);
    updateTable(scan, line.cells);
    const paragraphStart = paragraphStartOf(scan.lines, index);
    const context = [...scan.headings.map(item => item.text), ...scan.lines.slice(paragraphStart, paragraphEndOf(scan.lines, index) + 1)].join('\n');
    if (/\bMCP\b|tools\/list|stdio transcript/i.test(context)) {
        scanToolCounts(line);
        scanToolInvocations(scan, line);
    }
    scanCliCommands(scan, line, paragraphStart);
}

/**
 * Tool slots are Tools table cells, an explicit MCP/tool prefix, and name(arguments).
 * Additionally recognize published names in an MCP paragraph/heading, not arbitrary view names.
 * Only named parameters inside that same invocation span are claims about tool input schemas.
 */
export function extract(file: string, content: string, contract: Contract, problems: string[] = []): Subject[] {
    const lines = content.split(/\r?\n/);
    const commandNames = [...new Set(contract.cliCommands.flatMap(command => [command.name, ...command.aliases]))]
        .filter(name => /^[a-z][a-z-]*(?:\s+[a-z][a-z-]*)*$/.test(name))
        .sort((left, right) => right.split(/\s+/).length - left.split(/\s+/).length);
    const scan: Scan = {
        file, lines, commandNames, problems, subjects: [], headings: [], toolColumn: -1, tableCommands: new Map(),
        toolNames: new Set(contract.mcpTools.map(tool => tool.name)),
    };
    for (let index = 0; index < lines.length; index++) scanLine(scan, index);
    return scan.subjects;
}
