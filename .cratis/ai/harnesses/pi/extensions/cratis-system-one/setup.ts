// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne } from './client.ts';
import { chooseKey, effectiveEndpoint, parseUserConfiguration, requestTimeoutMs, resolveConfiguration, selectKey } from './configuration.ts';
import { BackendChoice } from './BackendChoice.ts';
import type { ConfigurationFile } from './ConfigurationFile.ts';
import { checkEndpoint, typeSafeEndpoint, typeSafeOrigin } from './endpoint.ts';
import { FileState } from './FileState.ts';
import { KeySource } from './KeySource.ts';
import { NotifyLevel } from './NotifyLevel.ts';
import { show } from './output.ts';
import type { EndpointOverride } from './EndpointOverride.ts';
import type { SetupDependencies } from './SetupDependencies.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';
import type { UserConfiguration } from './UserConfiguration.ts';
import { readUserConfigurationFile, userConfigurationPath, writeUserConfiguration } from './userConfigurationFile.ts';

const probeState = { prompt: 'Add a command that opens a bank account and validates the owner name.' };
const legalUrl = 'https://docs.typesafe.ai/legal';

/** What to do without a UI: the same steps, by hand. */
export function manualSteps(agentDirectory: string): string {
    return [
        'System One setup needs an interactive session. To set it up by hand:',
        `1. Create ${userConfigurationPath(agentDirectory)} (keep it private: chmod 600) containing`,
        `   { "enabled": true, "endpoint": "${typeSafeEndpoint}", "consentedAt": "<ISO time>" }`,
        '   Use "endpoint": "http://127.0.0.1:8000" for a local server such as Laya (LAYA_HOST=127.0.0.1 laya-serve).',
        '2. Provide a key: SYSTEMONE_API_KEY (or TYPESAFE_API_KEY for TypeSafe) in the environment, or "apiKey" in that file.',
        '   A key in the file is used only for the endpoint stored in it. A local http server gets a key only from that file.',
        '3. Check it with /system-one status. Turn it off with /system-one off.',
        'By enabling it you agree that, in repositories set up with Cratis AI, skill names, the first sentence of each skill description and the first 1200 characters of each prompt you type in an interactive session are sent to that endpoint.',
    ].join('\n');
}

/** True when the credential comes from the environment rather than from the user's own entry. */
function isEnvironmentKey(source: KeySource): boolean {
    return source === KeySource.SystemOneEnvironment || source === KeySource.TypeSafeEnvironment;
}

/**
 * Exactly what leaves the machine, stated before the user confirms: the destination, the data, and which
 * credential goes with it (never its value). Kept accurate rather than absolute: whatever reaches Pi as
 * typed interactive input is sent, wherever the text came from.
 */
export function disclosure(origin: string, credential: KeySource, override?: EndpointOverride): string {
    return [
        `Cratis will send to ${origin}:`,
        ...(override === undefined ? [] : [`  (SYSTEMONE_ENDPOINT in your environment overrides the endpoint you chose, ${override.chosen}. Data goes to ${override.effective}.)`]),
        '  - the names and first sentence of the description of the Cratis skills Pi loaded,',
        '  - the first 1200 characters of each prompt you type in an interactive session, in repositories set up with Cratis AI,',
        `  - with each request, ${credential === KeySource.None ? 'no credential' : `a credential: ${credential} (the value is never shown)`}.`,
        'Skipped, never sent: slash commands, skill and template invocations, subagent tasks, prompts Pi built around @file arguments or that start with "<", prompts rewritten after this extension saw them, and prompts from extensions, RPC hosts or sessions without a UI. This extension does not read tool result content.',
        'Anything else that reaches Pi as typed interactive input is sent: pasted text, text you resubmit from /tree or /fork, and text produced by another extension\'s editor or earlier input handler.',
        'A System One model uses this to judge which skills would help. In this version scores are only recorded in your session; they change nothing the model sees.',
        `Retention and privacy are the provider's. For TypeSafe see ${legalUrl}.`,
        'Turn it off any time with /system-one off.',
    ].join('\n');
}

/**
 * Interactive setup: choose a backend, state what is sent and where, confirm, probe the endpoint that
 * will really be used, and save only when the probe works (or the user insists). The key is never echoed
 * and is stored only in the user file. Nothing is written until the user has confirmed. What is probed and
 * disclosed is computed by the same resolution the extension uses at run time, so the user confirms where
 * data actually goes, including an override from `SYSTEMONE_ENDPOINT`.
 */
export async function runSetup(context: Pick<ExtensionContext, 'ui' | 'hasUI'>, dependencies: SetupDependencies): Promise<void> {
    const { ui } = context;
    const { environment } = dependencies;
    const now = dependencies.now ?? Date.now;
    const say = (text: string, level: NotifyLevel = NotifyLevel.Info) => show(context, dependencies.write, text, level);
    const cancelled = () => say('System One setup cancelled. Nothing was saved.');

    if (!context.hasUI) {
        say(manualSteps(dependencies.agentDirectory));
        return;
    }

    const choice = await ui.select('Choose a System One backend', Object.values(BackendChoice));
    if (choice === undefined) return cancelled();

    let candidate: string | undefined;
    if (choice === BackendChoice.TypeSafe) candidate = typeSafeEndpoint;
    else if (choice === BackendChoice.Other) candidate = await ui.input('Provider endpoint URL (https)', 'https://opencode.ai/zen/v1/systemone');
    else candidate = await ui.input('Local server URL (127.0.0.1, ::1 or localhost)', 'http://127.0.0.1:8000');
    if (candidate === undefined) return cancelled();
    const chosen = checkEndpoint(candidate);
    if ('error' in chosen) {
        say(`System One setup stopped: ${chosen.error}. Nothing was saved.`, NotifyLevel.Warning);
        return;
    }
    if (choice === BackendChoice.Local && !chosen.loopback) {
        say('System One setup stopped: a local server must be on 127.0.0.1, ::1 or localhost. Choose "Other System One provider" for a remote one. Nothing was saved.', NotifyLevel.Warning);
        return;
    }

    // An environment key is used when one applies to this endpoint. Otherwise ask, and store it only in the
    // user file, bound to this endpoint. A hosted provider needs a key; a local server may not.
    let storedKey: string | undefined;
    if (selectKey(environment, chosen, {}) === undefined) {
        const keyPrompt = chosen.loopback
            ? `API key for ${chosen.origin}, or leave blank for none (stored only in ${userConfigurationPath(dependencies.agentDirectory)}, mode 600, used only for this endpoint)`
            : `API key for ${chosen.origin} (stored only in ${userConfigurationPath(dependencies.agentDirectory)}, mode 600, used only for this endpoint; never shown again; tip: set SYSTEMONE_API_KEY instead to store nothing)`;
        const typed = await ui.input(keyPrompt, '');
        if (typed === undefined) return cancelled();
        storedKey = typed.trim() || undefined;
        if (storedKey === undefined && !chosen.loopback) {
            say(`System One setup stopped: ${chosen.origin} needs an API key. Set SYSTEMONE_API_KEY or run setup again. Nothing was saved.`, NotifyLevel.Warning);
            return;
        }
    }

    const configuration: UserConfiguration = {
        enabled: true,
        endpoint: chosen.endpoint,
        ...(storedKey === undefined ? {} : { apiKey: storedKey }),
        consentedAt: new Date(now()).toISOString(),
        skillRelevance: { mode: SkillRelevanceMode.Shadow },
    };
    // Exactly what would run: the same resolution, with this machine's environment but no repository.
    const user: ConfigurationFile = { state: FileState.Present, text: JSON.stringify(configuration) };
    const resolved = resolveConfiguration({ user, repository: { state: FileState.Missing }, environment });
    if (!resolved.enabled) {
        say(`System One setup stopped: it would not run here (${resolved.reason}). Nothing was saved.`, NotifyLevel.Warning);
        return;
    }
    const { settings } = resolved;
    // Whenever the environment sends data anywhere but the URL the user chose, however similar, say so.
    const overridden: EndpointOverride | undefined = effectiveEndpoint(environment, configuration).fromEnvironment && settings.endpoint !== chosen.endpoint ? { chosen: chosen.endpoint, effective: settings.endpoint } : undefined;

    const credential = chooseKey(environment, settings, configuration);
    const confirmed = await ui.confirm(`Send this to ${settings.origin}?`, disclosure(settings.origin, credential.source, overridden));
    if (!confirmed) return cancelled();
    // A key from the environment was not given to this program for this server. Ask again, plainly, before it is used.
    if (isEnvironmentKey(credential.source) && settings.origin !== typeSafeOrigin) {
        const usesKey = await ui.confirm(`Send ${credential.source} to ${settings.origin}?`, `${credential.source} was not issued for ${settings.origin}. It would go there as a bearer token with the setup probe and with every request after it. Continue only if you trust that server with this key.`);
        if (!usesKey) return cancelled();
    }

    const probe = await askSystemOne(
        { endpoint: settings.endpoint, model: settings.model, timeoutMs: requestTimeoutMs, apiKey: settings.apiKey },
        probeState,
        { 'cratis-arc-command': { type: 'noul', instructions: 'Would the `cratis-arc-command` guidance help answer or carry out `prompt`?', criteria: { true: 'cratis-arc-command: Define an Arc command.' } } },
        dependencies.transport,
        now,
    );
    if (probe.ok) {
        say(`Probe of ${settings.origin} succeeded in ${probe.latencyMs} ms: cratis-arc-command scored ${probe.probabilities.get('cratis-arc-command')?.toFixed(2)} for a command prompt.`);
    } else {
        say(`Probe of ${settings.origin} failed (${probe.failure}, ${probe.latencyMs} ms).`, NotifyLevel.Warning);
        const saveAnyway = await ui.confirm('The probe failed. Save anyway?', 'The extension will fail open (turns are never blocked) and pause itself after repeated failures. You can fix the endpoint or key and run /system-one setup again.');
        if (!saveAnyway) return cancelled();
    }

    const path = writeUserConfiguration(dependencies.agentDirectory, configuration);
    say(`System One enabled in shadow mode, saved to ${path}${overridden === undefined ? '' : ` (SYSTEMONE_ENDPOINT overrides its endpoint while it is set)`}. It only records scores; nothing in your conversation changes. See /system-one status and /system-one report.`);
}

/** `/system-one off`: keeps the file (and the recorded consent) and turns the extension off. */
export function turnOff(context: Pick<ExtensionContext, 'ui' | 'hasUI'>, dependencies: Pick<SetupDependencies, 'agentDirectory' | 'write'>): void {
    const say = (text: string) => show(context, dependencies.write, text);
    const file = readUserConfigurationFile(dependencies.agentDirectory);
    if (file.state === FileState.Missing) {
        say('System One is not set up, so there is nothing to turn off.');
        return;
    }
    let configuration: UserConfiguration;
    try {
        if (file.state === FileState.Unreadable) throw new Error('unreadable');
        configuration = parseUserConfiguration(file.text);
    } catch {
        configuration = { enabled: false, consentedAt: new Date(0).toISOString() };
    }
    writeUserConfiguration(dependencies.agentDirectory, { ...configuration, enabled: false });
    say('System One is turned off. Run /system-one setup to enable it again.');
}
