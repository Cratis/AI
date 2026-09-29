// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BreakerState } from './BreakerState.ts';
import { entryType } from './entryType.ts';
import { EntryKind } from './EntryKind.ts';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import type { RecentDecision } from './RecentDecision.ts';
import type { SessionStatistics } from './SessionStatistics.ts';
import type { ShadowReport } from './ShadowReport.ts';

const listedSkills = 10;

/**
 * The text of `/system-one status`. Shows the effective endpoint origin and whether a credential is
 * attached, never the credential itself.
 */
export function formatStatus(configuration: ConfigurationResult, statistics: SessionStatistics, breaker: BreakerState, retryInMs: number): string {
    const lines = ['System One (experimental, advisory only)'];
    if (!configuration.enabled) {
        lines.push(`State: disabled (${configuration.reason})`);
    } else {
        const settings = configuration.settings;
        const from = settings.endpointFromEnvironment ? 'SYSTEMONE_ENDPOINT' : 'your configuration';
        lines.push(
            'State: enabled',
            `Endpoint: ${settings.origin} (from ${from}${settings.loopback ? ', loopback' : ''}; ${settings.apiKey ? 'credential attached' : 'no credential sent'})`,
            `Model: ${settings.model}, timeout ${settings.timeoutMs} ms`,
            `Skill relevance: ${settings.skillRelevance.mode} (${settings.skillRelevance.chunkSize} questions per request, fuse ${settings.skillRelevance.maxQuestions}, prompt text capped at ${settings.skillRelevance.stateChars} characters)`,
        );
    }
    const failures = [...statistics.failures].map(([failure, count]) => `${failure} ${count}`).join(', ');
    lines.push(`Requests: ${statistics.requests}, succeeded ${statistics.successes}, failed ${statistics.failureCount}${failures ? ` (${failures})` : ''}`);
    const skipped = [...statistics.skipped].map(([reason, count]) => `${reason} ${count}`).join(', ');
    lines.push(`Turns not asked: ${skipped || 'none'}`);
    lines.push(`Circuit breaker: ${breaker}${retryInMs > 0 ? `, retry in ${Math.ceil(retryInMs / 1000)} s` : ''}`);
    return lines.join('\n');
}

/** The text of `/system-one last`: the most recent decision, highest probabilities first. Never the prompt. */
export function formatLast(statistics: SessionStatistics): string {
    const decision: RecentDecision | undefined = statistics.recent.at(-1);
    if (!decision) return 'System One has not been asked anything in this session.';
    const lines = [`Turn ${decision.turn} at ${decision.at}: ${decision.outcome}, ${decision.latencyMs} ms, ${decision.asked} skills asked, ${decision.endpointOrigin}`];
    const ranked = [...decision.probabilities].sort((left, right) => right[1] - left[1]);
    for (const [skill, probability] of ranked.slice(0, listedSkills)) {
        const read = decision.read === undefined ? 'turn in progress' : decision.read.includes(skill) ? 'read' : 'not read';
        lines.push(`  ${probability.toFixed(2)}  ${skill}  (${read})`);
    }
    if (ranked.length > listedSkills) lines.push(`  ... and ${ranked.length - listedSkills} more`);
    lines.push('Shadow mode: these scores were recorded only. They changed nothing the model saw.');
    return lines.join('\n');
}

const suggestionThreshold = 0.5;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function percentile(sorted: number[], fraction: number): number | undefined {
    return sorted.length === 0 ? undefined : sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

/** Aggregates this session's `cratis-system-one` custom entries. Entries that do not parse are ignored. */
export function aggregateShadow(entries: readonly unknown[]): ShadowReport {
    const judged = new Map<string, { answered: string[]; suggested: string[] }>();
    const otherReads = new Map<string, number>();
    const outcomes = new Map<string, string[]>();
    const latencies: number[] = [];
    const failures = new Map<string, number>();
    for (const entry of entries) {
        if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== entryType || !isRecord(entry.data)) continue;
        const data = entry.data;
        if (typeof data.turnId !== 'string') continue;
        if (data.kind === EntryKind.SkillRelevance && isRecord(data.probabilities)) {
            const scored = Object.entries(data.probabilities).filter((pair): pair is [string, number] => typeof pair[1] === 'number');
            judged.set(data.turnId, { answered: scored.map(([name]) => name), suggested: scored.filter(([, probability]) => probability >= suggestionThreshold).map(([name]) => name) });
            if (typeof data.latencyMs === 'number') latencies.push(data.latencyMs);
        } else if (data.kind === EntryKind.SkillOutcome) {
            outcomes.set(data.turnId, stringList(data.read));
            if (typeof data.otherReads === 'number') otherReads.set(data.turnId, data.otherReads);
        } else if (data.kind === EntryKind.SkillFailure && typeof data.failure === 'string') {
            failures.set(data.failure, (failures.get(data.failure) ?? 0) + 1);
        }
    }
    const report: ShadowReport = { turnsJudged: judged.size, turnsAwaitingOutcome: 0, suggested: 0, suggestedAndRead: 0, readNotSuggested: 0, askedUnansweredRead: 0, otherSkillReads: 0, failures };
    for (const [turnId, { answered, suggested }] of judged) {
        const recorded = outcomes.get(turnId);
        if (recorded === undefined) {
            report.turnsAwaitingOutcome++;
            continue;
        }
        // Only a skill that was asked about and answered in this turn can be a hit or a miss. A read of any other
        // skill says nothing about the model's judgment, so it is counted apart and never as "not suggested".
        const read = recorded.filter(name => answered.includes(name));
        report.suggested += suggested.length;
        report.suggestedAndRead += suggested.filter(name => read.includes(name)).length;
        report.readNotSuggested += read.filter(name => !suggested.includes(name)).length;
        // The entry names only asked skills, so a recorded name that got no answer was asked and unanswered.
        report.askedUnansweredRead += recorded.length - read.length;
        report.otherSkillReads += otherReads.get(turnId) ?? 0;
    }
    latencies.sort((left, right) => left - right);
    report.latencyP50Ms = percentile(latencies, 0.5);
    report.latencyP95Ms = percentile(latencies, 0.95);
    return report;
}

/** The text of `/system-one report`. Counts and ratios only; no skill scores, no prompt. */
export function formatReport(report: ShadowReport): string {
    if (report.turnsJudged === 0 && report.failures.size === 0) return 'No skill-relevance turns are recorded in this session yet.';
    const share = report.suggested === 0 ? 'n/a' : `${Math.round(100 * report.suggestedAndRead / report.suggested)}%`;
    const failures = [...report.failures].map(([failure, count]) => `${failure} ${count}`).join(', ');
    return [
        'System One shadow report for this session (experimental; nothing was changed for the model)',
        `Turns judged: ${report.turnsJudged}${report.turnsAwaitingOutcome > 0 ? ` (${report.turnsAwaitingOutcome} still running, not counted below)` : ''}`,
        `Skills suggested at ${suggestionThreshold} or above: ${report.suggested}`,
        `  of those, read by the model: ${report.suggestedAndRead} (${share})`,
        `Skills read that were not suggested: ${report.readNotSuggested}`,
        `Asked but unanswered skills read (a request failed; not counted above): ${report.askedUnansweredRead}`,
        `Other skill reads (not in the corpus, or not asked about; not counted above): ${report.otherSkillReads}`,
        `Backend latency: p50 ${report.latencyP50Ms ?? 'n/a'} ms, p95 ${report.latencyP95Ms ?? 'n/a'} ms`,
        `Failures: ${failures || 'none'}`,
        'Reads are counted only through the read tool; a skill file read with cat in bash is not counted.',
    ].join('\n');
}
