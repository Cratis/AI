// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { checkEndpoint, typeSafeEndpoint, typeSafeOrigin } from './endpoint.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import type { UserConfiguration } from './UserConfiguration.ts';
import { readUserConfigurationText } from './userConfigurationFile.ts';

export const defaultModel = 'jev-1.13.0';
export const requestTimeoutMs = 5000;

const modelPattern = /^[A-Za-z0-9._:/-]{1,128}$/;
const userKeys = ['enabled', 'endpoint', 'model', 'apiKey', 'consentedAt', 'skillRelevance'];

/** Fixed: nothing but the mode is configurable, and the repository can only narrow that. */
const skillRelevanceLimits = {
    maxQuestions: 128,
    chunkSize: 32,
    minPromptChars: 20,
    stateChars: 1200,
    criterionChars: 200,
};

/** A problem in what someone wrote, as opposed to "not configured", which is silent. */
class Invalid extends Error {}

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
 * What the repository may say about System One: opt out, or narrow skill relevance to off. Anything
 * else, including `enabled: true`, an endpoint, a key or a timeout, is refused so that a committed file
 * can never turn the extension on or point it anywhere.
 */
function repositoryNarrowing(repositoryText: string | undefined): { optOut: boolean; off: boolean; problem?: string } {
    const none = { optOut: false, off: false };
    if (repositoryText === undefined || !repositoryText.includes('systemOne')) return none;
    let document: unknown;
    try {
        document = JSON.parse(repositoryText);
    } catch {
        return { ...none, problem: '.cratis/ai.json is not valid JSON' };
    }
    if (!isRecord(document) || document.systemOne === undefined) return none;
    const section = document.systemOne;
    const refused = (why: string) => ({ ...none, problem: `the systemOne section of .cratis/ai.json was ignored: ${why}` });
    if (!isRecord(section)) return refused('it must be an object');
    const unknown = Object.keys(section).find(key => key !== 'enabled' && key !== 'skillRelevance');
    if (unknown !== undefined) return refused(`'${unknown}' is not allowed; a repository can only opt out or narrow`);
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

/** Everything resolution depends on, gathered by the caller. Resolution itself does no I/O. */
export interface ConfigurationInputs {
    /** The text of the user's `cratis-system-one.json`, or undefined when the user never set it up. */
    userText: string | undefined;
    /** The text of the repository's `.cratis/ai.json`, or undefined when there is none. */
    repositoryText: string | undefined;
    environment: NodeJS.ProcessEnv;
}

/**
 * Pure: the single place that decides whether System One may run, where it goes and which key it uses.
 * Never throws.
 *
 * - Only the user's file can enable it. The repository can opt out or narrow; the environment can
 *   disable, narrow, or override endpoint, key and model, but only once the user has enabled it.
 * - An unconfigured install is silent: no notice is produced for it.
 * - `TYPESAFE_API_KEY` is used only for the TypeSafe origin. Redirects are refused by the client.
 */
export function resolveConfiguration({ userText, repositoryText, environment }: ConfigurationInputs): ConfigurationResult {
    if (userText === undefined) return { enabled: false, reason: 'not set up (run /system-one setup)', configured: false };
    const disabled = (reason: string, notice = false): ConfigurationResult => ({
        enabled: false,
        reason,
        configured: true,
        notice: notice ? `System One is disabled: ${reason}.` : undefined,
    });
    try {
        let user: UserConfiguration;
        try {
            user = parseUserConfiguration(userText);
        } catch (error) {
            return disabled(`your System One configuration is invalid (${error instanceof Invalid ? error.message : 'unreadable'})`, true);
        }
        if (!user.enabled) return disabled('turned off in your System One configuration');
        if (environment.CRATIS_SYSTEM_ONE === '0') return disabled('disabled by CRATIS_SYSTEM_ONE=0');

        const repository = repositoryNarrowing(repositoryText);
        if (repository.optOut) return disabled('the repository opted out in .cratis/ai.json');

        const environmentEndpoint = nonEmpty(environment.SYSTEMONE_ENDPOINT);
        const checked = checkEndpoint(environmentEndpoint ?? user.endpoint ?? typeSafeEndpoint);
        if ('error' in checked) return disabled(`${environmentEndpoint ? 'SYSTEMONE_ENDPOINT' : 'the configured endpoint'}: ${checked.error}`, true);

        const model = nonEmpty(environment.CRATIS_SYSTEM_ONE_MODEL) ?? user.model ?? defaultModel;
        if (!modelPattern.test(model)) return disabled('the model name is not valid', true);

        let mode = user.skillRelevance?.mode ?? SkillRelevanceMode.Shadow;
        if (repository.off || environment.CRATIS_SYSTEM_ONE_SKILL_RELEVANCE === 'off') mode = SkillRelevanceMode.Off;
        const skillRelevance: SkillRelevanceSettings = { mode, ...skillRelevanceLimits };

        // Key precedence: SYSTEMONE_API_KEY, then TYPESAFE_API_KEY (TypeSafe origin only), then the user's file.
        const apiKey = nonEmpty(environment.SYSTEMONE_API_KEY)
            ?? (checked.origin === typeSafeOrigin ? nonEmpty(environment.TYPESAFE_API_KEY) : undefined)
            ?? nonEmpty(user.apiKey);

        return {
            enabled: true,
            settings: {
                endpoint: checked.endpoint,
                origin: checked.origin,
                loopback: checked.loopback,
                endpointFromEnvironment: environmentEndpoint !== undefined,
                model,
                timeoutMs: requestTimeoutMs,
                apiKey,
                skillRelevance,
            },
            // A refused repository section does not stop the user's own choice; it is announced once.
            notice: repository.problem ? `System One: ${repository.problem}.` : undefined,
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
    let repositoryText: string | undefined;
    try {
        const path = join(cwd, '.cratis', 'ai.json');
        repositoryText = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    } catch {
        repositoryText = undefined;
    }
    return resolveConfiguration({ userText: readUserConfigurationText(agentDirectory), repositoryText, environment });
}
