// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne } from './client.ts';
import { AgreedKey } from './AgreedKey.ts';
import { chooseKey, effectiveEndpoint, parseUserConfiguration, requestTimeoutMs, resolveConfiguration } from './configuration.ts';
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
        `   { "enabled": true, "endpoint": "${typeSafeEndpoint}", "consentedOrigin": "${typeSafeOrigin}", "keySource": "TYPESAFE_API_KEY", "consentedAt": "<ISO time>" }`,
        '   Use "endpoint": "http://127.0.0.1:8000" for a local server such as Laya (LAYA_HOST=127.0.0.1 laya-serve).',
        '2. Provide a key: SYSTEMONE_API_KEY (or TYPESAFE_API_KEY for TypeSafe) in the environment, or "apiKey" in that file.',
        '   A key in the file is used only for the endpoint stored in it. A local http server gets a key only from that file.',
        '   "consentedOrigin" is the origin (scheme, host, port) of "endpoint": the only one that will ever receive data or a key. SYSTEMONE_ENDPOINT pointing to another origin turns System One off.',
        '   "keySource" is the credential you agree to: "none", "typed" (the "apiKey" in the file), "SYSTEMONE_API_KEY" or "TYPESAFE_API_KEY". An environment key goes to TypeSafe, or to your endpoint only if it is the one named here.',
        '   Both fields are required: a file without them is refused.',
        '3. Check it with /system-one status. Turn it off with /system-one off.',
        'By enabling it you agree that, in repositories set up with Cratis AI, skill names, the first sentence of each skill description and the first 1200 characters of each prompt you type in an interactive session are sent to that endpoint.',
    ].join('\n');
}

/** What setup records about the credential the user agreed to. */
function agreedKeyOf(source: KeySource): AgreedKey {
    switch (source) {
        case KeySource.SystemOneEnvironment: return AgreedKey.SystemOneEnvironment;
        case KeySource.TypeSafeEnvironment: return AgreedKey.TypeSafeEnvironment;
        case KeySource.Entered: return AgreedKey.Typed;
        case KeySource.None: return AgreedKey.None;
    }
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
        'Setup remembers this destination and credential: if SYSTEMONE_ENDPOINT later points to another origin, System One turns itself off until you run setup again.',
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

    // SYSTEMONE_ENDPOINT may change the path of the endpoint the user chose, and setup then discloses and probes
    // the effective URL. It may not move data to another origin, and it must be a usable endpoint: what the
    // user is agreeing to is the origin they chose, so setup stops here, before asking for a key, disclosing,
    // probing or saving anything.
    const override = effectiveEndpoint(environment, { endpoint: chosen.endpoint });
    const effective = override.checked;
    if ('error' in effective) {
        say(`System One setup stopped: SYSTEMONE_ENDPOINT: ${effective.error}. Unset or correct it. Nothing was saved.`, NotifyLevel.Warning);
        return;
    }
    if (override.fromEnvironment && effective.origin !== chosen.origin) {
        say(`System One setup stopped: SYSTEMONE_ENDPOINT points to ${effective.origin}, not ${chosen.origin}. Unset it, or choose that endpoint (Other System One provider) in setup. Nothing was saved.`, NotifyLevel.Warning);
        return;
    }

    // An environment key is used when one applies to this endpoint. Otherwise ask, and store it only in the
    // user file, bound to this endpoint. A hosted provider needs a key; a local server may not. A key for a
    // local server is sent only to the exact URL it was stored for, so when a path-only override moves data
    // elsewhere on that server no key can be sent: say so up front instead of asking for one to discard.
    let storedKey: string | undefined;
    if (chosen.loopback && effective.endpoint !== chosen.endpoint) {
        say(`A key for a local server is sent only to the exact URL; SYSTEMONE_ENDPOINT sends data to ${effective.endpoint}, so no key will be sent. Unset it and run setup again if that server needs one.`, NotifyLevel.Warning);
    } else if (chooseKey(environment, chosen, {}, AgreedKey.SystemOneEnvironment).key === undefined) {
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

    // The credential that is recorded, stored, disclosed and probed is the one that applies at the URL that
    // really receives data, worked out once here. The question above already avoids asking for a key that
    // would go unsent; this is the defensive check that keeps it so: a key that would not be sent is not
    // stored and not recorded, rather than agreed to and never used. An environment key counts as offered
    // here, and the second confirmation below is where it is agreed to. The origin recorded is the one the
    // user chose; a different origin later switches System One off instead of quietly receiving data.
    const offered = chooseKey(environment, effective, { apiKey: storedKey, endpoint: chosen.endpoint }, AgreedKey.SystemOneEnvironment);
    if (storedKey !== undefined && offered.source !== KeySource.Entered) {
        storedKey = undefined;
        say(`The key is not stored: it is bound to ${chosen.endpoint}, and SYSTEMONE_ENDPOINT sends data to ${effective.endpoint}, so it would not be sent there. Unset SYSTEMONE_ENDPOINT and run setup again if that server needs it.`, NotifyLevel.Warning);
    }
    const configuration: UserConfiguration = {
        enabled: true,
        endpoint: chosen.endpoint,
        ...(storedKey === undefined ? {} : { apiKey: storedKey }),
        consentedAt: new Date(now()).toISOString(),
        consentedOrigin: chosen.origin,
        keySource: agreedKeyOf(offered.source),
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
    const overridden: EndpointOverride | undefined = override.fromEnvironment && settings.endpoint !== chosen.endpoint ? { chosen: chosen.endpoint, effective: settings.endpoint } : undefined;

    const confirmed = await ui.confirm(`Send this to ${settings.origin}?`, disclosure(settings.origin, settings.credential, overridden));
    if (!confirmed) return cancelled();
    // A key from the environment was not given to this program for this server. Ask again, plainly, before it is used.
    if (isEnvironmentKey(settings.credential) && settings.origin !== typeSafeOrigin) {
        const usesKey = await ui.confirm(`Send ${settings.credential} to ${settings.origin}?`, `${settings.credential} was not issued for ${settings.origin}. It would go there as a bearer token with the setup probe and with every request after it. Continue only if you trust that server with this key.`);
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
