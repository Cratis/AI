// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Idiom, SuiteTask } from './Suite.ts';

/** Structured grep, not a semantic correctness claim. Strip comments so prose cannot satisfy code checks. */
export function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

export function evaluateIdiom(check: Idiom, source: string): boolean {
    const matches = new RegExp(check.pattern, 'm').test(codeOnly(source));
    return check.kind === 'present' ? matches : !matches;
}

export function scoreSources(task: SuiteTask, files: Map<string, string>): {
    passed: boolean; specsPresent: boolean; idioms: { id: string; passed: boolean }[];
} {
    const idioms = task.idioms.map(check => ({ id: check.id, passed: files.has(check.file) && evaluateIdiom(check, files.get(check.file)!) }));
    const specsPresent = task.requiredSpecs.every(path => {
        const content = codeOnly(files.get(path) ?? '');
        return /\[Fact\]|\[Theory\]|\bit\s*\(|\btest\s*\(/.test(content);
    });
    return { passed: specsPresent && idioms.every(check => check.passed), specsPresent, idioms };
}
