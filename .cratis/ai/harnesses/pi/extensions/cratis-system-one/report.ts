// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BreakerState } from './BreakerState.ts';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { EndpointSource } from './EndpointSource.ts';
import type { RecentDecision } from './RecentDecision.ts';
import type { SessionStatistics } from './SessionStatistics.ts';

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
        const from = settings.source === EndpointSource.Environment ? 'your environment' : 'repository configuration';
        lines.push(
            'State: enabled',
            `Endpoint: ${settings.origin} (from ${from}${settings.loopback ? ', loopback' : ''}; ${settings.apiKey ? 'credential attached' : 'no credential sent'})`,
            `Model: ${settings.model}, timeout ${settings.timeoutMs} ms`,
            `Skill relevance: ${settings.skillRelevance.mode} (fuse ${settings.skillRelevance.maxQuestions} questions, prompt text capped at ${settings.skillRelevance.stateChars} characters)`,
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
