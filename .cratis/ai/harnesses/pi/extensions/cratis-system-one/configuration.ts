// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { join } from 'node:path';
import type { ConfigurationFile } from './ConfigurationFile.ts';
import type { ConfigurationInputs } from './ConfigurationInputs.ts';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { checkEndpoint, typeSafeEndpoint, typeSafeOrigin } from './endpoint.ts';
import type { EffectiveEndpoint } from './EffectiveEndpoint.ts';
import { FileState } from './FileState.ts';
import type { RepositoryNarrowing } from './RepositoryNarrowing.ts';
import type { KeyTarget } from './KeyTarget.ts';
import { modelPattern } from './modelPattern.ts';
import { Invalid } from './Invalid.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import type { UserConfiguration } from './UserConfiguration.ts';
import { readConfigurationFile, readUserConfigurationFile } from './userConfigurationFile.ts';

export const defaultModel = 'jev-1.13.0';
export const requestTimeoutMs = 5000;

const userKeys = ['enabled', 'endpoint', 'model', 'apiKey', 'consentedAt', 'skillRelevance'];
const disablingValues = new Set(['0', 'false', 'off', 'no']);

/** Fixed: nothing but the mode is configurable, and the repository can only narrow that. */
const skillRelevanceLimits = {
    maxQuestions: 128,
    chunkSize: 32,
    minPromptChars: 20,
    stateChars: 1200,
    criterionChars: 200,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function isMode(value: unknown): value is SkillRelevanceMode {
    return value === SkillRelevanceMode.Off || value === SkillRelevanceMode.Shadow;
}

/** Validates the user's file. Strict on purpose: an unknown key means a file this version does not understand. */
export function parseUserConfiguration(text: string): UserConfiguration {
    let document: unknown;
    try {
        document = JSON.parse(text);
    } catch {
        throw new Invalid('the file is not valid JSON');
    }
    if (!isRecord(document)) throw new Invalid('the file must contain an object');
    const unknown = Object.keys(document).find(key => !userKeys.includes(key));
    if (unknown !== undefined) throw new Invalid(`unknown setting '${unknown}'`);
    if (typeof document.enabled !== 'boolean') throw new Invalid("'enabled' must be true or false");
    for (const key of ['endpoint', 'model', 'apiKey'] as const) {
        if (document[key] !== undefined && (typeof document[key] !== 'string' || document[key] === '' || (document[key] as string).length > 2048)) throw new Invalid(`'${key}' must be a non-empty string`);
    }
    if (typeof document.model === 'string' && !modelPattern.test(document.model)) throw new Invalid("'model' is not a valid model name");
    if (document.enabled && (typeof document.consentedAt !== 'string' || Number.isNaN(Date.parse(document.consentedAt)))) throw new Invalid("'consentedAt' must record when consent was given");
    if (document.skillRelevance !== undefined) {
        if (!isRecord(document.skillRelevance) || Object.keys(document.skillRelevance).some(key => key !== 'mode') || !isMode(document.skillRelevance.mode)) {
            throw new Invalid("'skillRelevance' must be { mode: 'off' | 'shadow' }");
        }
    }
    return document as unknown as UserConfiguration;
}

/**
 * What the repository may say about System One: opt out, or narrow skill relevance to off. It fails
 * closed. Anything else, including an unreadable or unparseable file, `enabled: true`, an unknown key,
 * a wrong type, an endpoint, a key or a timeout, is a `problem`, and a problem switches System One off:
 * a file that may have been trying to opt out is treated as having opted out, never as silence.
 */
function repositoryNarrowing(repository: ConfigurationFile): RepositoryNarrowing {
    const none = { optOut: false, off: false };
    if (repository.state === FileState.Missing) return none;
    if (repository.state === FileState.Unreadable) return { ...none, problem: '.cratis/ai.json could not be read' };
    let document: unknown;
    try {
        document = JSON.parse(repository.text);
    } catch {
        return { ...none, problem: '.cratis/ai.json is not valid JSON' };
    }
    if (!isRecord(document)) return { ...none, problem: '.cratis/ai.json must contain an object' };
    if (document.systemOne === undefined) return none;
    const section = document.systemOne;
    const refused = (why: string) => ({ ...none, problem: `the systemOne section of .cratis/ai.json is not allowed: ${why}` });
    if (!isRecord(section)) return refused('it must be an object');
    const unknown = Object.keys(section).find(key => key !== 'enabled' && key !== 'skillRelevance');
    if (unknown !== undefined) return refused(`'${unknown}' is not a setting; a repository can only opt out or narrow`);
    if (section.enabled !== undefined && section.enabled !== false) return refused("'enabled' can only be false; a repository cannot enable System One");
    let off = false;
    if (section.skillRelevance !== undefined) {
        const relevance = section.skillRelevance;
        if (!isRecord(relevance) || Object.keys(relevance).some(key => key !== 'mode') || relevance.mode !== SkillRelevanceMode.Off) {
            return refused("'skillRelevance' can only be { mode: 'off' }");
        }
        off = true;
    }
    return { optOut: section.enabled === false, off };
}

/**
 * The only place a key is chosen. Environment keys (`SYSTEMONE_API_KEY`, then `TYPESAFE_API_KEY` for the
 * TypeSafe origin only) are never attached to any loopback endpoint (127.0.0.0/8, IPv4-mapped forms,
 * `localhost`, `*.localhost`), http or https: a local server gets a
 * key only if the user stored one for that exact endpoint. Elsewhere, a key stored in the user file is
 * bound to the origin it was stored for and is used only when that is the effective origin.
 */
export function selectKey(environment: NodeJS.ProcessEnv, target: KeyTarget, stored: { apiKey?: string; endpoint?: string }): string | undefined {
    if (!target.loopback) {
        const fromEnvironment = nonEmpty(environment.SYSTEMONE_API_KEY) ?? (target.origin === typeSafeOrigin ? nonEmpty(environment.TYPESAFE_API_KEY) : undefined);
        if (fromEnvironment !== undefined) return fromEnvironment;
    }
    const storedFor = checkEndpoint(stored.endpoint ?? typeSafeEndpoint);
    if ('error' in storedFor) return undefined;
    const sameDestination = target.loopback ? storedFor.endpoint === target.endpoint : storedFor.origin === target.origin;
    return sameDestination ? nonEmpty(stored.apiKey) : undefined;
}

/** The endpoint a user's file resolves to once `SYSTEMONE_ENDPOINT` is taken into account. */
export function effectiveEndpoint(environment: NodeJS.ProcessEnv, stored: { endpoint?: string }): EffectiveEndpoint {
    const environmentEndpoint = nonEmpty(environment.SYSTEMONE_ENDPOINT);
    return { checked: checkEndpoint(environmentEndpoint ?? stored.endpoint ?? typeSafeEndpoint), fromEnvironment: environmentEndpoint !== undefined };
}

/**
 * Pure: the single place that decides whether System One may run, where it goes and which key it uses.
 * Never throws.
 *
 * - Only the user's file can enable it. The repository can opt out or narrow, and fails closed; the
 *   environment can disable, narrow, or override endpoint, key and model, but only once the user has
 *   enabled it.
 * - An unconfigured install is silent: no notice is produced for it.
 * - Keys follow `selectKey`. Redirects are refused by the client.
 */
export function resolveConfiguration({ user: userFile, repository, environment }: ConfigurationInputs): ConfigurationResult {
    if (userFile.state === FileState.Missing) return { enabled: false, reason: 'not set up (run /system-one setup)', configured: false };
    const disabled = (reason: string, notice = false): ConfigurationResult => ({
        enabled: false,
        reason,
        configured: true,
        notice: notice ? `System One is disabled: ${reason}.` : undefined,
    });
    try {
        if (userFile.state === FileState.Unreadable) return disabled('your System One configuration file could not be read', true);
        let user: UserConfiguration;
        try {
            user = parseUserConfiguration(userFile.text);
        } catch (error) {
            return disabled(`your System One configuration is invalid (${error instanceof Invalid ? error.message : 'unreadable'})`, true);
        }
        if (!user.enabled) return disabled('turned off in your System One configuration');
        if (disablingValues.has(environment.CRATIS_SYSTEM_ONE?.trim().toLowerCase() ?? '')) return disabled('disabled by CRATIS_SYSTEM_ONE');

        const narrowing = repositoryNarrowing(repository);
        if (narrowing.problem) return disabled(`${narrowing.problem}; System One stays off until that is fixed`, true);
        if (narrowing.optOut) return disabled('the repository opted out in .cratis/ai.json');

        const { checked, fromEnvironment } = effectiveEndpoint(environment, user);
        if ('error' in checked) return disabled(`${fromEnvironment ? 'SYSTEMONE_ENDPOINT' : 'the configured endpoint'}: ${checked.error}`, true);

        const model = nonEmpty(environment.CRATIS_SYSTEM_ONE_MODEL) ?? user.model ?? defaultModel;
        if (!modelPattern.test(model)) return disabled('the model name is not valid', true);

        let mode = user.skillRelevance?.mode ?? SkillRelevanceMode.Shadow;
        if (narrowing.off || disablingValues.has(environment.CRATIS_SYSTEM_ONE_SKILL_RELEVANCE?.trim().toLowerCase() ?? '')) mode = SkillRelevanceMode.Off;
        const skillRelevance: SkillRelevanceSettings = { mode, ...skillRelevanceLimits };

        return {
            enabled: true,
            settings: {
                endpoint: checked.endpoint,
                origin: checked.origin,
                loopback: checked.loopback,
                endpointFromEnvironment: fromEnvironment,
                model,
                timeoutMs: requestTimeoutMs,
                apiKey: selectKey(environment, checked, user),
                skillRelevance,
            },
            notice: userFile.readableByOthers ? 'System One: your configuration file can be read by other users and may hold an API key. Run chmod 600 on it.' : undefined,
        };
    } catch {
        return disabled('the configuration could not be evaluated');
    }
}

/**
 * Reads the user's file from `agentDirectory` and the repository's `.cratis/ai.json` under `cwd`, then
 * resolves them. Never throws.
 */
export function loadConfiguration(cwd: string, agentDirectory: string, environment: NodeJS.ProcessEnv = process.env): ConfigurationResult {
    return resolveConfiguration({
        user: readUserConfigurationFile(agentDirectory),
        repository: readConfigurationFile(join(cwd, '.cratis', 'ai.json')),
        environment,
    });
}
