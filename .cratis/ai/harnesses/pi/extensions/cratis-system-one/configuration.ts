// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigurationResult } from './ConfigurationResult.ts';
import { EndpointSource } from './EndpointSource.ts';
import { checkEndpoint } from './endpoint.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';

const defaultModel = 'jev-latest';
const defaultTimeoutMs = 750;
const modelPattern = /^[A-Za-z0-9._:/-]{1,128}$/;
const systemOneKeys = ['enabled', 'endpoint', 'model', 'timeoutMs', 'skillRelevance'];
const skillRelevanceKeys = ['mode', 'maxQuestions', 'minPromptChars', 'stateChars', 'criterionChars'];

const defaults: SkillRelevanceSettings = {
    mode: SkillRelevanceMode.Shadow,
    maxQuestions: 50,
    minPromptChars: 20,
    stateChars: 1200,
    criterionChars: 200,
};

/** A problem in what someone wrote. Distinct from "not configured", which is silent. */
class Invalid extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[], where: string): void {
    const unknown = Object.keys(value).find(key => !allowed.includes(key));
    if (unknown !== undefined) throw new Invalid(`unknown setting '${where}.${unknown}'`);
}

function integer(value: unknown, name: string, minimum: number, maximum: number, fallback: number): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Invalid(`'${name}' must be a whole number from ${minimum} to ${maximum}`);
    }
    return value;
}

function skillRelevance(value: unknown): SkillRelevanceSettings {
    if (value === undefined) return { ...defaults };
    if (!isRecord(value)) throw new Invalid("'systemOne.skillRelevance' must be an object");
    rejectUnknownKeys(value, skillRelevanceKeys, 'systemOne.skillRelevance');
    const mode = value.mode ?? SkillRelevanceMode.Shadow;
    if (mode !== SkillRelevanceMode.Off && mode !== SkillRelevanceMode.Shadow) throw new Invalid("'systemOne.skillRelevance.mode' must be 'off' or 'shadow'");
    return {
        mode,
        maxQuestions: integer(value.maxQuestions, 'systemOne.skillRelevance.maxQuestions', 1, 200, defaults.maxQuestions),
        minPromptChars: integer(value.minPromptChars, 'systemOne.skillRelevance.minPromptChars', 0, 1000, defaults.minPromptChars),
        stateChars: integer(value.stateChars, 'systemOne.skillRelevance.stateChars', 100, 4000, defaults.stateChars),
        criterionChars: integer(value.criterionChars, 'systemOne.skillRelevance.criterionChars', 50, 500, defaults.criterionChars),
    };
}

function nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function build(systemOne: Record<string, unknown>, environment: NodeJS.ProcessEnv): ConfigurationResult {
    if (systemOne.enabled !== undefined && typeof systemOne.enabled !== 'boolean') throw new Invalid("'systemOne.enabled' must be true or false");
    if (systemOne.enabled !== true) return { enabled: false, reason: "systemOne.enabled is not true" };
    rejectUnknownKeys(systemOne, systemOneKeys, 'systemOne');

    // The environment can only restrict or tune. It never turns the extension on: only the repository's
    // `enabled: true` does, so a globally exported key alone sends nothing anywhere.
    if (environment.CRATIS_SYSTEM_ONE === '0') return { enabled: false, reason: 'disabled by CRATIS_SYSTEM_ONE=0' };

    const environmentEndpoint = nonEmpty(environment.CRATIS_SYSTEM_ONE_ENDPOINT);
    const userOptedIn = environment.CRATIS_SYSTEM_ONE === '1' && environmentEndpoint !== undefined;
    let candidate: string;
    let source: EndpointSource;
    if (userOptedIn) {
        candidate = environmentEndpoint;
        source = EndpointSource.Environment;
    } else if (systemOne.endpoint !== undefined) {
        if (typeof systemOne.endpoint !== 'string') throw new Invalid("'systemOne.endpoint' must be a string");
        candidate = systemOne.endpoint;
        source = EndpointSource.Repository;
    } else {
        throw new Invalid('no endpoint is configured. Set systemOne.endpoint to a loopback URL, or set CRATIS_SYSTEM_ONE=1 and CRATIS_SYSTEM_ONE_ENDPOINT yourself');
    }
    const checked = checkEndpoint(candidate, source);
    if ('error' in checked) throw new Invalid(source === EndpointSource.Environment ? `CRATIS_SYSTEM_ONE_ENDPOINT: ${checked.error}` : `systemOne.endpoint: ${checked.error}`);

    const model = nonEmpty(environment.CRATIS_SYSTEM_ONE_MODEL) ?? systemOne.model ?? defaultModel;
    if (typeof model !== 'string' || !modelPattern.test(model)) throw new Invalid('the model name is not valid');

    const environmentTimeout = nonEmpty(environment.CRATIS_SYSTEM_ONE_TIMEOUT_MS);
    const timeoutMs = environmentTimeout === undefined
        ? integer(systemOne.timeoutMs, 'systemOne.timeoutMs', 50, 5000, defaultTimeoutMs)
        : integer(/^\d+$/.test(environmentTimeout) ? Number(environmentTimeout) : Number.NaN, 'CRATIS_SYSTEM_ONE_TIMEOUT_MS', 50, 5000, defaultTimeoutMs);

    const relevance = skillRelevance(systemOne.skillRelevance);
    if (environment.CRATIS_SYSTEM_ONE_SKILL_RELEVANCE === 'off') relevance.mode = SkillRelevanceMode.Off;

    // A credential goes only to an endpoint the user chose. A hosted key (TYPESAFE_API_KEY) goes only over
    // https; a local server that wants one gets CRATIS_SYSTEM_ONE_API_KEY.
    let apiKey: string | undefined;
    if (source === EndpointSource.Environment) {
        apiKey = nonEmpty(environment.CRATIS_SYSTEM_ONE_API_KEY) ?? (checked.endpoint.startsWith('https:') ? nonEmpty(environment.TYPESAFE_API_KEY) : undefined);
    }

    return {
        enabled: true,
        settings: { endpoint: checked.endpoint, origin: checked.origin, source, loopback: checked.loopback, model, timeoutMs, apiKey, skillRelevance: relevance },
    };
}

/** Everything configuration depends on, gathered by the caller. Resolution itself does no I/O. */
export interface ConfigurationInputs {
    /** The text of `.cratis/ai.json`, or undefined when there is none. */
    repositoryText: string | undefined;
    environment: NodeJS.ProcessEnv;
}

/**
 * Pure: folds the repository's `systemOne` section and the environment into a decision. Never throws:
 * anything malformed or unknown disables the extension, and a notice is produced only when the text
 * mentions `systemOne`, so a repository that never asked for System One is not told about problems in
 * its unrelated settings. This module is the only place that decides consent; everything else consumes
 * the result.
 */
export function resolveConfiguration({ repositoryText, environment }: ConfigurationInputs): ConfigurationResult {
    if (repositoryText === undefined) return { enabled: false, reason: 'no .cratis/ai.json' };
    const mentionsSystemOne = repositoryText.includes('systemOne');
    const disabled = (reason: string): ConfigurationResult => ({
        enabled: false,
        reason,
        notice: mentionsSystemOne ? `System One is disabled: ${reason}.` : undefined,
    });
    try {
        let document: unknown;
        try {
            document = JSON.parse(repositoryText);
        } catch {
            return disabled('.cratis/ai.json is not valid JSON');
        }
        if (!isRecord(document)) return disabled('.cratis/ai.json must contain an object');
        if (document.systemOne === undefined) return { enabled: false, reason: 'no systemOne section in .cratis/ai.json' };
        if (!isRecord(document.systemOne)) return disabled("'systemOne' must be an object");
        return build(document.systemOne, environment);
    } catch (error) {
        return disabled(error instanceof Invalid ? error.message : 'the configuration could not be evaluated');
    }
}

/** Reads `.cratis/ai.json` under `cwd` (never throwing) and resolves it. */
export function loadConfiguration(cwd: string, environment: NodeJS.ProcessEnv = process.env): ConfigurationResult {
    const path = join(cwd, '.cratis', 'ai.json');
    let repositoryText: string | undefined;
    try {
        repositoryText = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    } catch {
        return { enabled: false, reason: '.cratis/ai.json could not be read' };
    }
    return resolveConfiguration({ repositoryText, environment });
}
