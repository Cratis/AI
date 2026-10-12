// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Fence } from './Fence.ts';
import { diagnosticCodes } from './classify.ts';

export interface StyleDiagnostic {
    code: string;
    name: string;
    severities: string[];
    reserved: boolean;
    retired: boolean;
}

export interface StyleException {
    file: string;
    rule: string;
    text: string;
    reason: string;
}

export function styleCodes(diagnostics: StyleDiagnostic[]): string[] {
    return diagnostics.filter(diagnostic => /Legacy|Redundant|Deprecated/.test(diagnostic.name)
        && diagnostic.severities.length > 0 && !diagnostic.severities.includes('error')
        && !diagnostic.reserved && !diagnostic.retired).map(diagnostic => diagnostic.code).sort();
}

/** Only Screenplay guidance is scanned; C#/TypeScript nullable syntax is unrelated. */
export function screenplayGuidance(file: string): boolean {
    return /\/cratis-(?:screenplay-[^/]+|stage-rendering-and-sandbox|event-model-diagram)\//.test(file)
        || /\/agents\/screenplay-[^/]+\.md$/.test(file);
}

export class PreferredSyntax {
    readonly problems: string[] = [];
    readonly codes: string[];
    private readonly used = new Set<number>();
    private files = 0;
    private fences = 0;

    constructor(diagnostics: StyleDiagnostic[], private readonly exceptions: StyleException[]) {
        this.codes = styleCodes(diagnostics);
        if (!this.codes.length) this.problems.push('Preferred syntax selected zero contract diagnostics.');
        for (const entry of exceptions) {
            if (!entry.file || !entry.rule || !entry.text || !entry.reason?.trim()) this.problems.push('Preferred syntax exceptions require file, rule, exact text and a reason.');
        }
        const keys = exceptions.map(entry => JSON.stringify([entry.file, entry.rule, entry.text]));
        if (new Set(keys).size !== keys.length) this.problems.push('Preferred syntax exceptions must be unique.');
    }

    private violation(file: string, rule: string, text: string, location: string): void {
        const index = this.exceptions.findIndex(entry => entry.file === file && entry.rule === rule && entry.text === text && entry.reason?.trim());
        if (index >= 0) this.used.add(index);
        else this.problems.push(`${location}: non-preferred Screenplay syntax (${rule}); use the preferred form or a reasoned preferred-syntax-allowlist.json entry.`);
    }

    scan(file: string, content: string, fences: Fence[]): void {
        this.files++;
        this.fences += fences.length;
        const lines = content.split(/\r?\n/);
        let opening: { character: string; length: number; screenplay: boolean } | undefined;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (opening) {
                const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
                if (closing && closing[1][0] === opening.character && closing[1].length >= opening.length) {
                    opening = undefined;
                    continue;
                }
                if (!opening.screenplay) continue;
            } else {
                const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
                if (match && (match[1][0] !== '`' || !match[2].includes('`'))) {
                    opening = { character: match[1][0], length: match[1].length, screenplay: /^screenplay(?:\s|$)/.test(match[2].trim()) };
                    continue;
                }
            }
            // Compile diagnostics own complete/parented fences; scan prose and uncompiled excerpts.
            if (fences.some(fence => (!fence.excerpt || fence.parent) && index + 1 > fence.line && index + 1 <= fence.line + fence.source.trimEnd().split('\n').length)) continue;
            const rules: Array<[string, RegExp]> = [
                ['optional-suffix', /\b[A-Z][A-Za-z0-9_]*(?:\[\])?\?(?![A-Za-z0-9_])/],
                ['compliance-marker', /@(?:pii|sensitive)\b|`sensitive`|\bconcept\s+\w+\s*:\s*\w+\s+sensitive\b/],
                ['inline-code', /\bvalidate\s+csharp\b|^\s*(?:validate|handler|performer|rule|policy)\s+\w*\s*(?:csharp|typescript)\s*$/]
            ];
            for (const [rule, pattern] of rules) {
                const text = rule === 'optional-suffix' && !opening?.screenplay ? [...line.matchAll(/`([^`]+)`/g)].map(match => match[1]).join(' ') : line;
                if (pattern.test(text)) this.violation(file, rule, line.trim(), `${file}:${index + 1}`);
            }
            if (opening?.screenplay) {
                if (/^\s*sensitive(?:\s|$)/.test(line)) this.violation(file, 'compliance-marker', line.trim(), `${file}:${index + 1}`);
                if (/^\s*(?:csharp|typescript|description)\s*$/.test(line) && /^\s*`{3,}\s*$/.test(lines[index + 1] ?? '')) {
                    this.violation(file, 'inline-code', line.trim(), `${file}:${index + 1}`);
                }
            }
        }
    }

    diagnostics(fence: Fence, output: string): void {
        for (const code of diagnosticCodes(output).filter(code => this.codes.includes(code))) {
            this.violation(fence.file, code, `fence:${fence.number}`, `${fence.file}:${fence.line}`);
        }
    }

    finish(): string[] {
        if (!this.files || !this.fences) this.problems.push('Preferred syntax scanned zero files or Screenplay fences.');
        this.exceptions.forEach((entry, index) => {
            if (!this.used.has(index)) this.problems.push(`${entry.file}: stale preferred syntax exception (${entry.rule}: ${entry.text}).`);
        });
        return this.problems;
    }
}
