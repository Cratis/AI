// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Invocation } from './Invocation.ts';
import { Outcome } from './Outcome.ts';

export function diagnosticCodes(output: string): string[] {
    return [...new Set([...output.matchAll(/\b(?:error|warning|info) (PLAY\d{4}):/g)].map(match => match[1]))].sort();
}

export function versionOutcome(result: Invocation, expected: string): Outcome {
    if (result.unavailable || result.exit !== 0) return Outcome.CouldNotRun;
    return result.output.trim().replace(/\+.*$/, '') === expected ? Outcome.Clean : Outcome.Defects;
}

export function compileOutcome(result: Invocation, expectedCodes: string[]): Outcome {
    if (result.unavailable || result.exit === 2 || result.exit === null) return Outcome.CouldNotRun;
    if (result.exit !== 0 && result.exit !== 1) return Outcome.Defects;
    const codes = diagnosticCodes(result.output);
    if (JSON.stringify(codes) !== JSON.stringify([...expectedCodes].sort())) return Outcome.Defects;
    if (expectedCodes.length === 0 && (result.exit !== 0 || !/\b[1-9]\d* file\(s\) compiled - 0 error\(s\), 0 warning\(s\)/.test(result.output))) return Outcome.Defects;
    return Outcome.Clean;
}

export function testOutcome(result: Invocation, unbound: boolean): Outcome {
    if (result.unavailable || result.exit === 2 || result.exit === null) return Outcome.CouldNotRun;
    if (result.exit !== (unbound ? 3 : 0)) return Outcome.Defects;
    try {
        const report = JSON.parse(result.output) as Record<string, unknown>;
        if (unbound) return (report.outcome === 'unbound' || report.outcome === 'unsupported') && typeof report.discovered === 'number' && report.discovered > 0 ? Outcome.Clean : Outcome.Defects;
        return report.outcome === 'passed' && typeof report.selected === 'number' && report.selected > 0 && report.executed === report.selected && report.passed === report.selected && report.failed === 0 && report.unsupported === 0 ? Outcome.Clean : Outcome.Defects;
    } catch {
        return Outcome.Defects;
    }
}

export function couldNotRunProblems(required: boolean, location: string, reason: string): string[] {
    return required ? [`${location}: Screenplay could not run: ${reason}`] : [];
}
