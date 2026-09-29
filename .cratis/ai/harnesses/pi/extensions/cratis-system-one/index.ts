// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne } from './client.ts';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { loadConfiguration } from './configuration.ts';
import { CircuitBreaker } from './CircuitBreaker.ts';
import type { FailureClass } from './FailureClass.ts';
import type { PendingTurn } from './PendingTurn.ts';
import { eligibleSkills, questionsFor, realPathOf, stateFor } from './relevance.ts';
import { formatLast, formatStatus } from './report.ts';
import { SessionStatistics } from './SessionStatistics.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import { SkipReason } from './SkipReason.ts';
import type { SystemOneDependencies } from './SystemOneDependencies.ts';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const entryType = 'cratis-system-one';

function corpusRootOf(directory: string): string {
    return resolve(directory, '..', '..', '..', '..');
}

/** True when this copy is the one inside the `@cratis/pi` package rather than a managed `.cratis/ai` install. */
export function isPackagedCopy(directory: string = extensionDirectory): boolean {
    return corpusRootOf(directory).endsWith(join('package', 'corpus'));
}

/**
 * The `@cratis/pi` copy stands down when the project has its own managed copy, so the extension is never
 * registered twice. It checks for the entry file, not just the manifest, as `cratis-mcp` does. A managed
 * copy never stands down for itself.
 */
export function standsDown(cwd: string, directory: string = extensionDirectory): boolean {
    return isPackagedCopy(directory) && existsSync(join(cwd, '.pi', 'extensions', 'cratis-system-one', 'index.ts'));
}

function notify(context: ExtensionContext, message: string): void {
    try {
        if (context.hasUI) context.ui.notify(message, 'warning');
    } catch {
        /* a notice is never worth failing a turn */
    }
}

function isSlashInput(text: string | undefined): boolean {
    return text !== undefined && text.trimStart().startsWith('/');
}

/**
 * Skill relevance in shadow mode. At `before_agent_start` it asks a System One model which of the corpus
 * skills Pi already loaded would help with the prompt, records the answers, and records later whether the
 * model read each skill. It returns nothing, so the system prompt and the conversation are untouched.
 * Every handler fails open: an error, a timeout or an open circuit breaker means the turn proceeds as if
 * the extension were absent.
 */
export function registerSystemOne(pi: ExtensionAPI, dependencies: SystemOneDependencies = {}): void {
    const transport = dependencies.transport ?? fetch;
    const now = dependencies.now ?? Date.now;
    const environment = dependencies.environment ?? process.env;
    const configure = dependencies.configure ?? ((cwd: string) => loadConfiguration(cwd, environment));
    const packagedRoots = dependencies.packagedSkillRoots ?? [join(corpusRootOf(extensionDirectory), 'skills')];

    let statistics = new SessionStatistics();
    let breaker = new CircuitBreaker(3, now);
    let breakerOrigin: string | undefined;
    let turn = 0;
    let pending: PendingTurn | undefined;
    let rawInput: string | undefined;
    const knownSkills = new Map<string, string>();
    const readSkills = new Set<string>();

    const reset = (): void => {
        statistics = new SessionStatistics();
        breaker = new CircuitBreaker(3, now);
        breakerOrigin = undefined;
        turn = 0;
        pending = undefined;
        rawInput = undefined;
        knownSkills.clear();
        readSkills.clear();
    };

    const announce = (context: ExtensionContext, noticeClass: string, message: string): void => {
        if (statistics.firstNotice(noticeClass)) notify(context, message);
    };

    const record = (failure: FailureClass, retryAfterMs: number | undefined, context: ExtensionContext): void => {
        statistics.recordFailure(failure);
        const opened = breaker.recordFailure(failure, retryAfterMs);
        announce(context, failure, `System One skill relevance failed (${failure}). The turn continues without it. See /system-one status.`);
        if (opened) announce(context, 'breaker-open', `System One is paused for about ${Math.ceil(breaker.retryInMs / 1000)} s after repeated failures. See /system-one status.`);
    };

    const consider = async (prompt: string, skills: Parameters<typeof eligibleSkills>[0], context: ExtensionContext): Promise<void> => {
        const raw = rawInput;
        rawInput = undefined;
        pending = undefined;
        const configuration = configure(context.cwd);
        if (!configuration.enabled) {
            if (configuration.notice) announce(context, 'configuration', configuration.notice);
            return;
        }
        const { settings } = configuration;
        const relevance = settings.skillRelevance;
        if (relevance.mode === SkillRelevanceMode.Off) return;
        if (breakerOrigin !== settings.origin) {
            breaker = new CircuitBreaker(3, now);
            breakerOrigin = settings.origin;
        }

        if (isSlashInput(raw) || isSlashInput(prompt) || prompt.startsWith('<skill ')) return statistics.recordSkip(SkipReason.SlashCommand);
        if (prompt.trim().length < relevance.minPromptChars) return statistics.recordSkip(SkipReason.ShortPrompt);

        const candidates = eligibleSkills(skills, [join(context.cwd, '.cratis', 'ai', 'skills'), ...packagedRoots]);
        if (candidates.length === 0) return statistics.recordSkip(SkipReason.NoSkills);
        // A fuse stops the call and says so. Trimming the list would silently ask about a different set.
        if (candidates.length > relevance.maxQuestions) {
            statistics.recordSkip(SkipReason.TooManySkills);
            announce(context, 'fuse', `System One skill relevance skipped: ${candidates.length} skills exceed the limit of ${relevance.maxQuestions} questions per request.`);
            return;
        }
        if (!breaker.allow()) return statistics.recordSkip(SkipReason.BreakerOpen);

        for (const candidate of candidates) knownSkills.set(candidate.realPath, candidate.name);
        turn++;
        statistics.requests++;
        const outcome = await askSystemOne(settings, stateFor(prompt, relevance), questionsFor(candidates, relevance), transport, now);
        const at = new Date(now()).toISOString();
        if (!outcome.ok) {
            statistics.remember({ turn, at, endpointOrigin: settings.origin, latencyMs: outcome.latencyMs, asked: candidates.length, outcome: outcome.failure, probabilities: [] });
            record(outcome.failure, outcome.retryAfterMs, context);
            return;
        }
        breaker.recordSuccess();
        statistics.successes++;
        const probabilities = [...outcome.probabilities];
        const decision = { turn, at, endpointOrigin: settings.origin, latencyMs: outcome.latencyMs, asked: candidates.length, outcome: 'answered' as const, probabilities };
        statistics.remember(decision);
        pending = { turn, read: new Set(), readEarlier: candidates.filter(candidate => readSkills.has(candidate.name)).map(candidate => candidate.name), decision };
        // Ids and probabilities only. The prompt never enters the session.
        pi.appendEntry(entryType, {
            kind: 'skill-relevance',
            version: 1,
            turn,
            mode: relevance.mode,
            endpoint: settings.origin,
            model: outcome.model ?? settings.model,
            latencyMs: outcome.latencyMs,
            asked: candidates.length,
            probabilities: Object.fromEntries(probabilities),
        });
    };

    pi.on('session_start', () => {
        try { reset(); } catch { /* fail open */ }
    });

    // The raw text still has its leading slash here; before_agent_start only sees it after expansion.
    pi.on('input', event => {
        try { rawInput = typeof event?.text === 'string' ? event.text : undefined; } catch { /* fail open */ }
    });

    pi.on('before_agent_start', async (event, context) => {
        try {
            await consider(event.prompt, event.systemPromptOptions?.skills, context);
        } catch {
            /* fail open: the turn proceeds as if this extension were absent */
        }
        // Shadow mode never returns a system prompt or a message.
        return undefined;
    });

    pi.on('tool_result', (event, context) => {
        try {
            if (event.toolName !== 'read' || event.isError) return;
            const value = (event.input as { path?: unknown } | undefined)?.path;
            if (typeof value !== 'string' || value.length === 0) return;
            const realPath = realPathOf(resolve(context.cwd, value.replace(/^@/, '')));
            const skill = realPath === undefined ? undefined : knownSkills.get(realPath);
            if (skill === undefined) return;
            readSkills.add(skill);
            pending?.read.add(skill);
        } catch {
            /* fail open */
        }
    });

    pi.on('agent_end', () => {
        try {
            const finished = pending;
            pending = undefined;
            if (!finished) return;
            const read = [...finished.read].sort();
            finished.decision.read = read;
            pi.appendEntry(entryType, { kind: 'skill-outcome', version: 1, turn: finished.turn, read, readEarlier: finished.readEarlier });
        } catch {
            /* fail open */
        }
    });

    pi.registerCommand('system-one', {
        description: 'Show System One status (default) or the last skill-relevance decision: /system-one [status|last]',
        handler: async (argumentsText, context) => {
            try {
                const subcommand = argumentsText.trim().split(/\s+/)[0] || 'status';
                let configuration: ConfigurationResult;
                let text: string;
                switch (subcommand) {
                    case 'status':
                        configuration = configure(context.cwd);
                        text = formatStatus(configuration, statistics, breaker.state, breaker.retryInMs);
                        break;
                    case 'last':
                        text = formatLast(statistics);
                        break;
                    default:
                        text = 'Usage: /system-one [status|last]';
                }
                context.ui.notify(text, 'info');
            } catch {
                /* fail open */
            }
        },
    });
}

/** Registers unless a managed copy in the project already provides this extension. Returns whether it registered. */
export function activate(pi: ExtensionAPI, cwd: string = process.cwd(), directory: string = extensionDirectory, dependencies: SystemOneDependencies = {}): boolean {
    if (standsDown(cwd, directory)) return false;
    registerSystemOne(pi, dependencies);
    return true;
}

export default function (pi: ExtensionAPI): void {
    activate(pi);
}
