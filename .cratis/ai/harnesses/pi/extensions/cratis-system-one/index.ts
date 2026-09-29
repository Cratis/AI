// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne } from './client.ts';
import { Grant } from './Grant.ts';
import { loadConfiguration } from './configuration.ts';
import { CircuitBreaker } from './CircuitBreaker.ts';
import { DecisionOutcome } from './DecisionOutcome.ts';
import { FailureClass } from './FailureClass.ts';
import { entryType } from './entryType.ts';
import { InputSource } from './InputSource.ts';
import { NotifyLevel } from './NotifyLevel.ts';
import { EntryKind } from './EntryKind.ts';
import { show } from './output.ts';
import { eligibleSkills, questionsFor, realPathOf, stateFor } from './relevance.ts';
import { aggregateShadow, formatLast, formatReport, formatStatus } from './report.ts';
import { SessionStatistics } from './SessionStatistics.ts';
import { runSetup, turnOff } from './setup.ts';
import type { SkillCandidate } from './SkillCandidate.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import { SkipReason } from './SkipReason.ts';
import { Subcommand } from './Subcommand.ts';
import type { SystemOneDependencies } from './SystemOneDependencies.ts';
import type { SystemOneHandle } from './SystemOneHandle.ts';
import type { SystemOneOutcome } from './SystemOneOutcome.ts';
import type { SystemOneSettings } from './SystemOneSettings.ts';
import type { TurnRecord } from './TurnRecord.ts';
import type { TypedInput } from './TypedInput.ts';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const usage = `Usage: /system-one [${Object.values(Subcommand).join('|')}]`;

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
        if (context.hasUI) context.ui.notify(message, NotifyLevel.Warning);
    } catch {
        /* a notice is never worth failing a turn, and a stale context can throw */
    }
}

function isSlashInput(text: string): boolean {
    return text.trimStart().startsWith('/');
}

/**
 * True for text Pi built rather than a person typed. `pi @notes.env "review this"` puts
 * `<file name="/abs/path">` and the file's contents in front of the typed text, and a skill invocation
 * arrives as `<skill ...>`. Anything Pi wraps starts with a tag, so a prompt that starts with `<` or
 * contains a file block is never judged, even if that also skips a person who typed a tag.
 */
export function isWrapped(text: string): boolean {
    return text.trimStart().startsWith('<') || text.includes('<file name="');
}

/** Only repositories set up with Cratis AI are judged; a stray Pi session elsewhere sends nothing. */
function isCratisRepository(cwd: string): boolean {
    return existsSync(join(cwd, '.cratis', 'ai.json')) || existsSync(join(cwd, '.cratis', 'ai.manifest.json'));
}

function chunks<T>(items: readonly T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
    return groups;
}

/**
 * Skill relevance in shadow mode. At `before_agent_start` it starts a request to a System One model in the
 * background and returns at once, so a prompt is never delayed. When the answer arrives it is recorded as
 * a session entry (skill ids and probabilities, never the prompt); when the turn ends the SKILL.md files
 * the model read are recorded. It never returns a system prompt or a message, so nothing the model sees
 * changes. Every handler fails open. Nothing runs, and nothing is announced, until the user has run
 * `/system-one setup`, and prompts are judged only in interactive sessions in repositories set up with
 * Cratis AI.
 */
export function registerSystemOne(pi: ExtensionAPI, dependencies: SystemOneDependencies = {}): SystemOneHandle {
    const transport = dependencies.transport ?? fetch;
    const now = dependencies.now ?? Date.now;
    const environment = dependencies.environment ?? process.env;
    // stderr, not stdout: in print and json modes stdout carries the model's output or the JSON stream.
    const write = dependencies.write ?? ((text: string) => { process.stderr.write(`${text}\n`); });
    const agentDirectory = (): string => dependencies.agentDirectory ?? getAgentDir();
    const configure = dependencies.configure ?? ((cwd: string) => loadConfiguration(cwd, agentDirectory(), environment));
    const directory = dependencies.extensionDirectory ?? extensionDirectory;
    // The packaged copy asks about the packaged corpus; a managed copy asks about the project's own.
    const skillRoots = (cwd: string): string[] => isPackagedCopy(directory) ? [join(corpusRootOf(directory), 'skills')] : [join(cwd, '.cratis', 'ai', 'skills')];

    let statistics = new SessionStatistics();
    let breaker = new CircuitBreaker(3, now);
    let breakerOrigin: string | undefined;
    let epoch = 0;
    let configurationEpoch = 0;
    let turn = 0;
    let current: TurnRecord | undefined;
    let typedInput: TypedInput | undefined;
    const knownSkills = new Map<string, string>();
    const readSkills = new Set<string>();
    const inFlight = new Set<Promise<void>>();
    const controllers = new Set<AbortController>();

    /** A session ended or was replaced: nothing started for it may record anything, and its requests stop. */
    const retire = (): void => {
        epoch++;
        for (const controller of controllers) controller.abort();
        controllers.clear();
        current = undefined;
    };

    /**
     * The consent or the endpoint changed (setup, off, another origin): a request made under the old one
     * is aborted, and whatever it returns is dropped rather than recorded against the new configuration's
     * breaker or statistics. The new configuration starts with a fresh breaker.
     */
    const configurationChanged = (): void => {
        configurationEpoch++;
        for (const controller of controllers) controller.abort();
        controllers.clear();
        breaker = new CircuitBreaker(3, now);
        breakerOrigin = undefined;
    };

    const reset = (): void => {
        retire();
        statistics = new SessionStatistics();
        breaker = new CircuitBreaker(3, now);
        breakerOrigin = undefined;
        turn = 0;
        typedInput = undefined;
        knownSkills.clear();
        readSkills.clear();
    };

    const announce = (context: ExtensionContext, noticeClass: string, message: string): void => {
        if (statistics.firstNotice(noticeClass)) notify(context, message);
    };

    /** Runs in the background: never awaited by a turn, never throws. */
    const judge = async (owner: CircuitBreaker, record: TurnRecord, prompt: string, candidates: SkillCandidate[], settings: SystemOneSettings, context: ExtensionContext, isCurrent: () => boolean, controller: AbortController, halfOpen: boolean): Promise<void> => {
        let reported = false;
        try {
            await judgeTurn(owner, record, prompt, candidates, settings, context, isCurrent, controller, halfOpen, () => { reported = true; });
        } finally {
            // A probe that reported nothing (the session ended, the configuration changed, something threw)
            // is given back, so the breaker cannot stay stuck. One that reported has already closed or re-opened
            // it. Only the turn that was granted the probe may give it back: any other turn never held it.
            if (halfOpen && !reported) owner.release();
        }
    };

    /**
     * `owner` is the breaker the turn was started under, and `isCurrent` says whether the session and
     * configuration it was started under still stand. A result is recorded only while they do, and only
     * ever against `owner`.
     */
    const judgeTurn = async (owner: CircuitBreaker, record: TurnRecord, prompt: string, candidates: SkillCandidate[], settings: SystemOneSettings, context: ExtensionContext, isCurrent: () => boolean, controller: AbortController, halfOpen: boolean, reportedToBreaker: () => void): Promise<void> => {
        const relevance = settings.skillRelevance;
        const state = stateFor(prompt, relevance);
        const timeoutMs = dependencies.requestTimeoutMs ?? settings.timeoutMs;
        const ask = (group: SkillCandidate[]) => askSystemOne({ ...settings, timeoutMs }, state, questionsFor(group, relevance), transport, now, controller.signal);
        const groups = chunks(candidates, relevance.chunkSize);

        const outcomes: SystemOneOutcome[] = [];
        if (halfOpen && groups.length > 1) {
            // The breaker is testing the server: one request first, and the fan-out resumes only if it works.
            const probe = await ask(groups[0]);
            outcomes.push(probe);
            if (probe.ok && isCurrent()) outcomes.push(...await Promise.all(groups.slice(1).map(ask)));
        } else {
            outcomes.push(...await Promise.all(groups.map(ask)));
        }
        // A session ended or switched, or the configuration changed, while the request was running: its
        // result belongs to nobody now, and is never given to the breaker or statistics of whatever runs next.
        if (!isCurrent()) return;

        const failures = outcomes.filter((outcome): outcome is Extract<SystemOneOutcome, { ok: false }> => !outcome.ok);
        // The breaker counts turns, not requests: one turn is one success or one failure however many chunks it had.
        // A rate-limit or overload answer anywhere in the turn decides its class and its Retry-After, because
        // that is what the server asked for; otherwise the first failure does. It is told first, before anything
        // that could throw, so a failed probe always re-opens it.
        if (failures.length === 0) {
            owner.recordSuccess(halfOpen);
        } else {
            const pushedBack = failures.filter(failure => failure.failure === FailureClass.RateLimited || failure.failure === FailureClass.Overloaded);
            const deciding = pushedBack.length > 0 ? pushedBack : failures;
            const retryAfterMs = Math.max(0, ...deciding.map(failure => failure.retryAfterMs ?? 0)) || undefined;
            if (owner.recordFailure(deciding[0].failure, retryAfterMs, halfOpen)) {
                announce(context, 'breaker-open', `System One is paused for about ${Math.ceil(owner.retryInMs / 1000)} s after repeated failures. See /system-one status.`);
            }
        }
        reportedToBreaker();

        const probabilities = new Map<string, number>();
        let latencyMs = 0;
        let model: string | undefined;
        for (const outcome of outcomes) {
            latencyMs = Math.max(latencyMs, outcome.latencyMs);
            statistics.requests++;
            if (outcome.ok) {
                statistics.successes++;
                model ??= outcome.model;
                for (const [skill, probability] of outcome.probabilities) probabilities.set(skill, probability);
            } else {
                statistics.recordFailure(outcome.failure);
                pi.appendEntry(entryType, { kind: EntryKind.SkillFailure, version: 1, turnId: record.turnId, turn: record.turn, endpoint: settings.origin, failure: outcome.failure, latencyMs: outcome.latencyMs, asked: candidates.length });
                announce(context, outcome.failure, `System One skill relevance failed (${outcome.failure}). Turns continue without it. See /system-one status.`);
            }
        }

        const decision = {
            turn: record.turn,
            at: new Date(now()).toISOString(),
            endpointOrigin: settings.origin,
            latencyMs,
            asked: candidates.length,
            outcome: probabilities.size > 0 || failures.length === 0 ? DecisionOutcome.Answered : failures[0].failure,
            probabilities: [...probabilities],
            read: record.readFinal,
        };
        record.decision = decision;
        statistics.remember(decision);
        if (probabilities.size === 0) return;
        // Ids and probabilities only. The prompt never enters the session.
        pi.appendEntry(entryType, {
            kind: EntryKind.SkillRelevance,
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
        const input = typedInput;
        typedInput = undefined;
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
        // Only what a person types in an interactive session is judged: never print or json mode, and
        // so never a subagent's task, which runs in a child process without one.
        if (!context.hasUI) return statistics.recordSkip(SkipReason.NoInteractiveSession);
        // Only text a person typed. Another extension's injected message (sendUserMessage) arrives with source
        // "extension" and may carry tool output or file contents; an RPC host's prompt may be automated, and
        // when in doubt it is excluded. No input event for the turn means nobody typed anything.
        if (input === undefined || input.source !== InputSource.Interactive) return statistics.recordSkip(SkipReason.NotTypedByUser);
        if (!isCratisRepository(context.cwd)) return statistics.recordSkip(SkipReason.NotCratisRepository);
        if (breakerOrigin !== settings.origin) {
            configurationChanged();
            breakerOrigin = settings.origin;
        }

        if (isSlashInput(input.text) || isSlashInput(prompt) || prompt.startsWith('<skill ')) return statistics.recordSkip(SkipReason.SlashCommand);
        // Text Pi wrapped around what was typed (`@file` contents, skill blocks) is not what the user typed.
        if (isWrapped(input.text) || isWrapped(prompt)) return statistics.recordSkip(SkipReason.WrappedInput);
        // Judge exactly what was typed. Another extension's input handler may have rewritten it since (each
        // handler sees the previous one's output, and one that runs later can still change what the model
        // gets), and template expansion changes it too; then the prompt is not what the user typed.
        if (prompt.trim() !== input.text.trim()) return statistics.recordSkip(SkipReason.RewrittenPrompt);
        if (prompt.trim().length < relevance.minPromptChars) return statistics.recordSkip(SkipReason.ShortPrompt);

        const candidates = eligibleSkills(skills, skillRoots(context.cwd));
        if (candidates.length === 0) return statistics.recordSkip(SkipReason.NoSkills);
        // A fuse stops the call and says so. Trimming the list would silently ask about a different set.
        if (candidates.length > relevance.maxQuestions) {
            statistics.recordSkip(SkipReason.TooManySkills);
            announce(context, 'fuse', `System One skill relevance skipped: ${candidates.length} skills exceed the limit of ${relevance.maxQuestions} questions.`);
            return;
        }
        const owner = breaker;
        // One reading decides both whether to ask and whether this turn is the probe.
        const grant = owner.allow();
        if (grant === Grant.None) return statistics.recordSkip(SkipReason.BreakerOpen);
        const halfOpen = grant === Grant.Probe;

        try {
            for (const candidate of candidates) knownSkills.set(candidate.realPath, candidate.name);
            turn++;
            const record: TurnRecord = {
                turnId: randomUUID(),
                turn,
                asked: new Set(candidates.map(candidate => candidate.name)),
                read: new Set(),
                otherReads: 0,
                readEarlier: candidates.filter(candidate => readSkills.has(candidate.name)).map(candidate => candidate.name),
            };
            current = record;
            const controller = new AbortController();
            controllers.add(controller);
            const sessionEpoch = epoch;
            const startedUnder = configurationEpoch;
            const isCurrent = (): boolean => sessionEpoch === epoch && startedUnder === configurationEpoch;
            // Not awaited: a prompt is never delayed by a judgment that only feeds a measurement.
            const work = judge(owner, record, prompt, candidates, settings, context, isCurrent, controller, halfOpen)
                .catch(() => undefined)
                .finally(() => { inFlight.delete(work); controllers.delete(controller); });
            inFlight.add(work);
        } catch (error) {
            // A probe was granted but no request will report for it.
            if (halfOpen) owner.release();
            throw error;
        }
    };

    pi.on('session_start', () => {
        try { reset(); } catch { /* fail open */ }
    });

    // Pi is going away or moving to another session: stop what is running and record nothing more.
    pi.on('session_shutdown', () => {
        try { retire(); } catch { /* fail open */ }
    });

    // The raw text still has its leading slash here, and the source says who sent it; before_agent_start
    // only sees the prompt after expansion and knows neither.
    pi.on('input', event => {
        try { typedInput = typeof event?.text === 'string' ? { text: event.text, source: event.source as InputSource } : undefined; } catch { /* fail open */ }
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
            // Only corpus skills that were asked about are named. Any other skill's name (a user's own skill,
            // a project's) stays out of the entries; such a read is only counted.
            const skill = knownSkills.get(realPathOf(resolved) ?? resolved);
            if (skill === undefined) {
                if (current) current.otherReads++;
                return;
            }
            readSkills.add(skill);
            if (current?.asked.has(skill)) current.read.add(skill);
            else if (current) current.otherReads++;
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
            pi.appendEntry(entryType, { kind: EntryKind.SkillOutcome, version: 1, turnId: finished.turnId, turn: finished.turn, read: finished.readFinal, readEarlier: finished.readEarlier, otherReads: finished.otherReads });
        } catch {
            /* fail open */
        }
    });

    pi.registerCommand('system-one', {
        description: `System One skill relevance (experimental): /system-one [${Object.values(Subcommand).join('|')}]`,
        handler: async (argumentsText, context) => {
            const say = (text: string) => show(context, write, text);
            try {
                const subcommand = argumentsText.trim().split(/\s+/)[0] || Subcommand.Status;
                switch (subcommand) {
                    case Subcommand.Status:
                        say(formatStatus(configure(context.cwd), statistics, breaker.state, breaker.retryInMs));
                        break;
                    case Subcommand.Last:
                        say(formatLast(statistics));
                        break;
                    case Subcommand.Report:
                        say(formatReport(aggregateShadow(context.sessionManager.getEntries())));
                        break;
                    case Subcommand.Setup:
                        try {
                            await runSetup(context, { agentDirectory: agentDirectory(), environment, write, transport, now });
                        } finally {
                            configurationChanged();
                        }
                        break;
                    case Subcommand.Off:
                        try {
                            turnOff(context, { agentDirectory: agentDirectory(), write });
                        } finally {
                            configurationChanged();
                        }
                        break;
                    default:
                        say(usage);
                }
            } catch {
                // Never include the error text: it could carry a path, a URL or worse.
                try { show(context, write, 'System One: the command failed; nothing may have been saved.', NotifyLevel.Warning); } catch { /* fail open */ }
            }
        },
    });

    return { settled: async () => { await Promise.allSettled([...inFlight]); } };
}

/** Registers unless a managed copy in the project already provides this extension. Returns whether it registered. */
export function activate(pi: ExtensionAPI, cwd: string = process.cwd(), directory: string = extensionDirectory, dependencies: SystemOneDependencies = {}): boolean {
    if (standsDown(cwd, directory)) return false;
    registerSystemOne(pi, { extensionDirectory: directory, ...dependencies });
    return true;
}

export default function (pi: ExtensionAPI): void {
    activate(pi);
}
