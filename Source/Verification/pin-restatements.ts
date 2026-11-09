// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Keeps current dependency pins in one place: the CLI bundle and Stage scaffold tables in `Documentation/compatibility.md`
 * (maintainer page, not agent-loaded).
 * Skills describe behavior and never restate a current pin, so a release bump edits those tables instead of sweeping the corpus.
 *
 * Design: only the dependency pins are policed (the scaffold's Arc, Chronicle, Components, Scene and `@cratis/arc`, and
 * the bundled Cratis.Arc.Screenplay). The CLI, Stage and bundled Screenplay version tokens are deliberately NOT banned:
 * they qualify capability claims ("refused at Stage 4.73.1", "enum numbers since Screenplay 4.137.0"), which stay true
 * after the next bump. A dependency version that is itself the subject of a claim ("verified at Arc v22.68.0") is
 * listed in `pin-restatement-exceptions.json` with a reason; an entry that matches nothing fails, so the list shrinks.
 */

export const scaffoldTable = 'Documentation/compatibility.md';
export const bundleTable = 'Documentation/compatibility.md';

export interface Pin {
    label: string;
    value: string;
}

export interface PinException {
    file: string;
    text: string;
    reason: string;
}

export interface SourceFile {
    path: string;
    content: string;
}

export interface PinReport {
    problems: string[];
    pins: number;
    scanned: number;
    allowed: number;
}

const versionSource = '\\d+\\.\\d+\\.\\d+';
const firstVersion = (text: string) => text.match(new RegExp(versionSource))?.[0];

function tableRows(content: string): string[][] {
    return content.split('\n')
        .filter(line => line.startsWith('|'))
        .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
}

/** The scaffold dependency pins from the "Scaffold pins" table, read from the table so a bump only edits it. */
export function scaffoldPins(content: string): Pin[] {
    const pins: Pin[] = [];
    for (const [item, value] of tableRows(content).filter(row => row.length >= 2)) pins.push(...scaffoldRowPins(item, value));
    return pins;
}

function scaffoldRowPins(item: string, value: string): Pin[] {
    if (item.startsWith('Arc packages')) return pinOf('Arc', firstVersion(value));
    if (item.startsWith('Chronicle client')) return pinOf('Chronicle', firstVersion(value));
    return item === 'Frontend' ? value.split(';').flatMap(frontendSegmentPins) : [];
}

function frontendSegmentPins(segment: string): Pin[] {
    const label = ['@cratis/arc', '@cratis/components', '@cratis/scene.*'].find(name => segment.includes(`\`${name}\``));
    return label ? pinOf(label, firstVersion(segment)) : [];
}

function pinOf(label: string, value: string | undefined): Pin[] {
    return value ? [{ label, value }] : [];
}

/** The bundled Cratis.Arc.Screenplay pin from the CLI table. */
export function bundlePins(content: string): Pin[] {
    return tableRows(content).filter(row => row.length >= 2)
        .flatMap(([source, pin]) => source.startsWith('Bundled Cratis.Arc.Screenplay') ? pinOf('Cratis.Arc.Screenplay', firstVersion(pin)) : []);
}

const occurrence = (value: string) => new RegExp(`(?<![\\w.])v?${value.replaceAll('.', '\\.')}(?!\\w|\\.\\d)`);

/** Blanks out each excepted text in the line, recording which exceptions were used; returns the remaining line and the count removed. */
function withoutExceptions(line: string, path: string, pins: Pin[], exceptions: PinException[], used: Set<PinException>): { remaining: string; removed: number } {
    let remaining = line;
    let removed = 0;
    for (const entry of exceptions.filter(candidate => candidate.file === path && pins.some(pin => occurrence(pin.value).test(candidate.text)))) {
        while (remaining.includes(entry.text)) {
            remaining = remaining.replace(entry.text, ' ');
            used.add(entry);
            removed++;
        }
    }
    return { remaining, removed };
}

function exceptionProblems(exceptions: PinException[], used: Set<PinException>): string[] {
    return exceptions.flatMap(entry => [
        ...entry.reason?.trim() ? [] : [`Pin exception for ${entry.file} ('${entry.text}') has no reason.`],
        ...used.has(entry) ? [] : [`Pin exception for ${entry.file} ('${entry.text}') matches nothing any more; remove it.`],
    ]);
}

/** Messages for each occurrence of a current pin outside the two central tables that no exception covers, and for each stale exception. */
export function pinRestatements(files: SourceFile[], pins: Pin[], exceptions: PinException[]): PinReport {
    const problems: string[] = [];
    if (pins.length === 0) problems.push('No dependency pins were parsed from the CLI and scaffold tables; the check would pass vacuously.');
    const scanned = files.filter(file => file.path !== scaffoldTable && file.path !== bundleTable);
    if (scanned.length === 0) problems.push('No skill files were scanned for restated pins; the check would pass vacuously.');
    const used = new Set<PinException>();
    let allowed = 0;
    for (const file of scanned) {
        file.content.split('\n').forEach((line, index) => {
            const { remaining, removed } = withoutExceptions(line, file.path, pins, exceptions, used);
            allowed += removed;
            for (const pin of pins.filter(candidate => occurrence(candidate.value).test(remaining))) {
                problems.push(`${file.path}:${index + 1} restates the current ${pin.label} pin ${pin.value}; describe the behavior without the pin (current value in ${pin.label === 'Cratis.Arc.Screenplay' ? bundleTable : scaffoldTable}) or list a reasoned exception.`);
            }
        });
    }
    problems.push(...exceptionProblems(exceptions, used));
    return { problems, pins: pins.length, scanned: scanned.length, allowed };
}

export function pinSummary(report: PinReport): string {
    return `Pin restatements: ${report.pins} pins, ${report.scanned} files scanned, ${report.allowed} reasoned exceptions, ${report.problems.length} problems.`;
}
