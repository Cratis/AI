// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne } from './client.ts';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { loadConfiguration } from './configuration.ts';
import { CircuitBreaker } from './CircuitBreaker.ts';
import type { FailureClass } from './FailureClass.ts';
import { eligibleSkills, questionsFor, realPathOf, stateFor } from './relevance.ts';
import { aggregateShadow, formatLast, formatReport, formatStatus } from './report.ts';
import { SessionStatistics } from './SessionStatistics.ts';
import { runSetup, turnOff } from './setup.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import { SkipReason } from './SkipReason.ts';
import type { SystemOneDependencies } from './SystemOneDependencies.ts';
import type { SystemOneSettings } from './SystemOneSettings.ts';
import type { TurnRecord } from './TurnRecord.ts';
import type { SkillCandidate } from './SkillCandidate.ts';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const entryType = 'cratis-system-one';
const usage = 'Usage: /system-one [status|last|report|setup|off]';

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
        /* a notice is never worth failing a turn, and a stale context can throw */
    }
}

function isSlashInput(text: string | undefined): boolean {
    return text !== undefined && text.trimStart().startsWith('/');
}

function chunks<T>(items: readonly T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
    return groups;
}

export interface SystemOneHandle {
    /** Resolves when every background request has finished. Only specs need this. */
    settled(): Promise<void>;
}

/**
 * Skill relevance in shadow mode. At `before_agent_start` it starts a request to a System One model in the
 * background and returns at once, so a prompt is never delayed. When the answer arrives it is recorded as
 * a session entry (skill ids and probabilities, never the prompt); when the turn ends the SKILL.md files
 * the model read are recorded. It never returns a system prompt or a message, so nothing the model sees
 * changes. Every handler fails open. Nothing runs, and nothing is announced, until the user has run
 * `/system-one setup`.
 */
export function registerSystemOne(pi: ExtensionAPI, dependencies: SystemOneDependencies = {}): SystemOneHandle {
    const transport = dependencies.transport ?? fetch;
    const now = dependencies.now ?? Date.now;
    const environment = dependencies.environment ?? process.env;
    const agentDirectory = (): string => dependencies.agentDirectory ?? getAgentDir();
    const configure = dependencies.configure ?? ((cwd: string) => loadConfiguration(cwd, agentDirectory(), environment));
    const packagedRoots = dependencies.packagedSkillRoots ?? [join(corpusRootOf(extensionDirectory), 'skills')];

    let statistics = new SessionStatistics();
    let breaker = new CircuitBreaker(3, now);
    let breakerOrigin: string | undefined;
    let epoch = 0;
    let turn = 0;
    let current: TurnRecord | undefined;
    let rawInput: string | undefined;
    const knownSkills = new Map<string, string>();
    const readSkills = new Set<string>();
    const inFlight = new Set<Promise<void>>();

    const reset = (): void => {
        epoch++;
        statistics = new SessionStatistics();
        breaker = new CircuitBreaker(3, now);
        breakerOrigin = undefined;
        turn = 0;
        current = undefined;
        rawInput = undefined;
        knownSkills.clear();
        readSkills.clear();
    };

    const announce = (context: ExtensionContext, noticeClass: string, message: string): void => {
        if (statistics.firstNotice(noticeClass)) notify(context, message);
    };

    const failed = (record: TurnRecord, settings: SystemOneSettings, asked: number, failure: FailureClass, latencyMs: number, retryAfterMs: number | undefined, context: ExtensionContext): void => {
        statistics.recordFailure(failure);
        const opened = breaker.recordFailure(failure, retryAfterMs);
        pi.appendEntry(entryType, { kind: 'skill-failure', version: 1, turnId: record.turnId, turn: record.turn, endpoint: settings.origin, failure, latencyMs, asked });
        announce(context, failure, `System One skill relevance failed (${failure}). Turns continue without it. See /system-one status.`);
        if (opened) announce(context, 'breaker-open', `System One is paused for about ${Math.ceil(breaker.retryInMs / 1000)} s after repeated failures. See /system-one status.`);
    };

    /** Runs in the background: never awaited by a turn, never throws. */
    const judge = async (record: TurnRecord, prompt: string, candidates: SkillCandidate[], settings: SystemOneSettings, context: ExtensionContext, sessionEpoch: number): Promise<void> => {
        const relevance = settings.skillRelevance;
        const state = stateFor(prompt, relevance);
        const timeoutMs = dependencies.requestTimeoutMs ?? settings.timeoutMs;
        const outcomes = await Promise.all(chunks(candidates, relevance.chunkSize).map(chunk =>
            askSystemOne({ ...settings, timeoutMs }, state, questionsFor(chunk, relevance), transport, now)));
        // A session switch while the request was running: its result belongs to nobody now.
        if (sessionEpoch !== epoch) return;

        const probabilities = new Map<string, number>();
        let latencyMs = 0;
        let model: string | undefined;
        for (const outcome of outcomes) {
            latencyMs = Math.max(latencyMs, outcome.latencyMs);
            if (outcome.ok) {
                breaker.recordSuccess();
                statistics.successes++;
                model ??= outcome.model;
                for (const [skill, probability] of outcome.probabilities) probabilities.set(skill, probability);
            } else {
                failed(record, settings, candidates.length, outcome.failure, outcome.latencyMs, outcome.retryAfterMs, context);
            }
        }
        const firstFailure = outcomes.find(outcome => !outcome.ok);
        const decision = {
            turn: record.turn,
            at: new Date(now()).toISOString(),
            endpointOrigin: settings.origin,
            latencyMs,
            asked: candidates.length,
            outcome: probabilities.size > 0 ? 'answered' as const : (firstFailure && !firstFailure.ok ? firstFailure.failure : 'answered' as const),
            probabilities: [...probabilities],
            read: record.readFinal,
        };
        record.decision = decision;
        statistics.remember(decision);
        if (probabilities.size === 0) return;
        // Ids and probabilities only. The prompt never enters the session.
        pi.appendEntry(entryType, {
            kind: 'skill-relevance',
            version: 1,
            turnId: record.turnId,
            turn: record.turn,
            mode: relevance.mode,
            endpoint: settings.origin,
            model: model ?? settings.model,
            latencyMs,
            asked: candidates.length,
            answered: probabilities.size,
            probabilities: Object.fromEntries(probabilities),
        });
    };

    const start = (prompt: string, skills: Parameters<typeof eligibleSkills>[0], context: ExtensionContext): void => {
        const raw = rawInput;
        rawInput = undefined;
        current = undefined;
        const configuration = configure(context.cwd);
        if (!configuration.enabled) {
            if (configuration.notice) announce(context, 'configuration', configuration.notice);
            return;
        }
        if (configuration.notice) announce(context, 'configuration', configuration.notice);
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
            announce(context, 'fuse', `System One skill relevance skipped: ${candidates.length} skills exceed the limit of ${relevance.maxQuestions} questions.`);
            return;
        }
        if (!breaker.allow()) return statistics.recordSkip(SkipReason.BreakerOpen);

        for (const candidate of candidates) knownSkills.set(candidate.realPath, candidate.name);
        turn++;
        statistics.requests += Math.ceil(candidates.length / relevance.chunkSize);
        const record: TurnRecord = {
            turnId: randomUUID(),
            turn,
            read: new Set(),
            readEarlier: candidates.filter(candidate => readSkills.has(candidate.name)).map(candidate => candidate.name),
        };
        current = record;
        // Not awaited: a prompt is never delayed by a judgement that only feeds a measurement.
        const work = judge(record, prompt, candidates, settings, context, epoch).catch(() => undefined).finally(() => { inFlight.delete(work); });
        inFlight.add(work);
    };

    pi.on('session_start', () => {
        try { reset(); } catch { /* fail open */ }
    });

    // The raw text still has its leading slash here; before_agent_start only sees it after expansion.
    pi.on('input', event => {
        try { rawInput = typeof event?.text === 'string' ? event.text : undefined; } catch { /* fail open */ }
    });

    pi.on('before_agent_start', (event, context) => {
        try {
            start(event.prompt, event.systemPromptOptions?.skills, context);
        } catch {
            /* fail open: the turn proceeds as if this extension were absent */
        }
        // Shadow mode never returns a system prompt or a message, and never waits.
        return undefined;
    });

    pi.on('tool_result', (event, context) => {
        try {
            if (event.toolName !== 'read' || event.isError) return;
            const value = (event.input as { path?: unknown } | undefined)?.path;
            if (typeof value !== 'string' || basename(value) !== 'SKILL.md') return;
            const resolved = resolve(context.cwd, value.replace(/^@/, ''));
            const skill = knownSkills.get(realPathOf(resolved) ?? resolved) ?? basename(dirname(resolved));
            readSkills.add(skill);
            current?.read.add(skill);
        } catch {
            /* fail open */
        }
    });

    pi.on('agent_end', () => {
        try {
            const finished = current;
            current = undefined;
            if (!finished) return;
            finished.readFinal = [...finished.read].sort();
            if (finished.decision) finished.decision.read = finished.readFinal;
            pi.appendEntry(entryType, { kind: 'skill-outcome', version: 1, turnId: finished.turnId, turn: finished.turn, read: finished.readFinal, readEarlier: finished.readEarlier });
        } catch {
            /* fail open */
        }
    });

    pi.registerCommand('system-one', {
        description: 'System One skill relevance (experimental): /system-one [status|last|report|setup|off]',
        handler: async (argumentsText, context) => {
            try {
                const subcommand = argumentsText.trim().split(/\s+/)[0] || 'status';
                let configuration: ConfigurationResult;
                switch (subcommand) {
                    case 'status':
                        configuration = configure(context.cwd);
                        context.ui.notify(formatStatus(configuration, statistics, breaker.state, breaker.retryInMs), 'info');
                        break;
                    case 'last':
                        context.ui.notify(formatLast(statistics), 'info');
                        break;
                    case 'report':
                        context.ui.notify(formatReport(aggregateShadow(context.sessionManager.getEntries())), 'info');
                        break;
                    case 'setup':
                        await runSetup(context, { agentDirectory: agentDirectory(), environment, transport, now });
                        break;
                    case 'off':
                        turnOff(context, agentDirectory());
                        break;
                    default:
                        context.ui.notify(usage, 'info');
                }
            } catch {
                /* fail open */
            }
        },
    });

    return { settled: async () => { await Promise.allSettled([...inFlight]); } };
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
