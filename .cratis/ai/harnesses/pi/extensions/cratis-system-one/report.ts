// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BreakerState } from './BreakerState.ts';
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
    const judged = new Map<string, string[]>();
    const outcomes = new Map<string, string[]>();
    const latencies: number[] = [];
    const failures = new Map<string, number>();
    for (const entry of entries) {
        if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== 'cratis-system-one' || !isRecord(entry.data)) continue;
        const data = entry.data;
        if (typeof data.turnId !== 'string') continue;
        if (data.kind === 'skill-relevance' && isRecord(data.probabilities)) {
            judged.set(data.turnId, Object.entries(data.probabilities).filter(([, probability]) => typeof probability === 'number' && probability >= suggestionThreshold).map(([name]) => name));
            if (typeof data.latencyMs === 'number') latencies.push(data.latencyMs);
        } else if (data.kind === 'skill-outcome') {
            outcomes.set(data.turnId, stringList(data.read));
        } else if (data.kind === 'skill-failure' && typeof data.failure === 'string') {
            failures.set(data.failure, (failures.get(data.failure) ?? 0) + 1);
        }
    }
    const report: ShadowReport = { turnsJudged: judged.size, turnsAwaitingOutcome: 0, suggested: 0, suggestedAndRead: 0, readNotSuggested: 0, failures };
    for (const [turnId, suggested] of judged) {
        const read = outcomes.get(turnId);
        if (read === undefined) {
            report.turnsAwaitingOutcome++;
            continue;
        }
        report.suggested += suggested.length;
        report.suggestedAndRead += suggested.filter(name => read.includes(name)).length;
        report.readNotSuggested += read.filter(name => !suggested.includes(name)).length;
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
        `Backend latency: p50 ${report.latencyP50Ms ?? 'n/a'} ms, p95 ${report.latencyP95Ms ?? 'n/a'} ms`,
        `Failures: ${failures || 'none'}`,
        'Reads are counted only through the read tool; a skill file read with cat in bash is not counted.',
    ].join('\n');
}
