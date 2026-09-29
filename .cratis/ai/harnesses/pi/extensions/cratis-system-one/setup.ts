// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { askSystemOne, type Transport } from './client.ts';
import { defaultModel, requestTimeoutMs } from './configuration.ts';
import { checkEndpoint, typeSafeEndpoint, typeSafeOrigin } from './endpoint.ts';
import type { UserConfiguration } from './UserConfiguration.ts';
import { readUserConfigurationText, userConfigurationPath, writeUserConfiguration } from './userConfigurationFile.ts';
import { parseUserConfiguration } from './configuration.ts';
import { SkillRelevanceMode } from './SkillRelevanceMode.ts';

const jevChoice = 'TypeSafe Jev (recommended)';
const otherChoice = 'Other System One provider (endpoint URL)';
const localChoice = 'Local server such as Laya (loopback URL)';
const probeState = { prompt: 'Add a command that opens a bank account and validates the owner name.' };
const legalUrl = 'https://docs.typesafe.ai/legal';

export interface SetupDependencies {
    agentDirectory: string;
    environment: NodeJS.ProcessEnv;
    transport?: Transport;
    now?: () => number;
}

/** What to do without a UI: the same steps, by hand. */
export function manualSteps(agentDirectory: string): string {
    return [
        'System One setup needs an interactive session. To set it up by hand:',
        `1. Create ${userConfigurationPath(agentDirectory)} (keep it private: chmod 600) containing`,
        `   { "enabled": true, "endpoint": "${typeSafeEndpoint}", "consentedAt": "<ISO time>" }`,
        '   Use "endpoint": "http://127.0.0.1:8000" for a local server such as Laya (LAYA_HOST=127.0.0.1 laya-serve).',
        '2. Provide a key in the environment (SYSTEMONE_API_KEY, or TYPESAFE_API_KEY for TypeSafe), or add "apiKey" to that file.',
        '3. Check it with /system-one status. Turn it off with /system-one off.',
        'By enabling it you agree that skill names, the first sentence of each skill description and the first 1200 characters of each prompt are sent to that endpoint.',
    ].join('\n');
}

/** Exactly what leaves the machine, stated before the user confirms. */
export function disclosure(origin: string): string {
    return [
        `Cratis will send to ${origin}:`,
        '  - the names and first sentence of the description of the Cratis skills Pi loaded,',
        '  - the first 1200 characters of every prompt you submit (after slash-command expansion; attachments are not sent).',
        'A System One model uses this to judge which skills would help. In this version scores are only recorded in your session; they change nothing the model sees.',
        `Retention and privacy are the provider's. For TypeSafe see ${legalUrl}.`,
        'Turn it off any time with /system-one off.',
    ].join('\n');
}

/**
 * Interactive setup: choose a backend, state what is sent, confirm, probe with one tiny request, and save
 * only when the probe works (or the user insists). The key is never echoed and is stored only in the user
 * file. Nothing is written until the user has confirmed.
 */
export async function runSetup(context: Pick<ExtensionContext, 'ui' | 'hasUI'>, dependencies: SetupDependencies): Promise<void> {
    const { ui } = context;
    const { environment } = dependencies;
    const now = dependencies.now ?? Date.now;
    const cancelled = () => ui.notify('System One setup cancelled. Nothing was saved.', 'info');

    if (!context.hasUI) {
        ui.notify(manualSteps(dependencies.agentDirectory), 'info');
        return;
    }

    const choice = await ui.select('Choose a System One backend', [jevChoice, otherChoice, localChoice]);
    if (choice === undefined) return cancelled();

    let candidate: string | undefined;
    if (choice === jevChoice) {
        candidate = typeSafeEndpoint;
    } else if (choice === otherChoice) {
        candidate = await ui.input('Provider endpoint URL (https)', 'https://opencode.ai/zen/v1/systemone');
    } else {
        candidate = await ui.input('Local server URL (127.0.0.1, ::1 or localhost)', 'http://127.0.0.1:8000');
    }
    if (candidate === undefined) return cancelled();
    const checked = checkEndpoint(candidate);
    if ('error' in checked) {
        ui.notify(`System One setup stopped: ${checked.error}. Nothing was saved.`, 'warning');
        return;
    }
    if (choice === localChoice && !checked.loopback) {
        ui.notify('System One setup stopped: a local server must be on 127.0.0.1, ::1 or localhost. Choose "Other System One provider" for a remote one. Nothing was saved.', 'warning');
        return;
    }

    // An environment key wins, exactly as it does at run time; otherwise ask, and store it only in the user file.
    const environmentKey = environment.SYSTEMONE_API_KEY?.trim() || (checked.origin === typeSafeOrigin ? environment.TYPESAFE_API_KEY?.trim() : undefined) || undefined;
    let storedKey: string | undefined;
    if (environmentKey === undefined && !checked.loopback) {
        const typed = await ui.input(`API key for ${checked.origin} (stored only in ${userConfigurationPath(dependencies.agentDirectory)}, mode 600; never shown again; tip: set SYSTEMONE_API_KEY instead to store nothing)`, '');
        if (typed === undefined) return cancelled();
        storedKey = typed.trim() || undefined;
        if (storedKey === undefined) {
            ui.notify(`System One setup stopped: ${checked.origin} needs an API key. Set SYSTEMONE_API_KEY or run setup again. Nothing was saved.`, 'warning');
            return;
        }
    }

    const confirmed = await ui.confirm(`Send this to ${checked.origin}?`, disclosure(checked.origin));
    if (!confirmed) return cancelled();

    const probe = await askSystemOne(
        { endpoint: checked.endpoint, model: defaultModel, timeoutMs: requestTimeoutMs, apiKey: environmentKey ?? storedKey },
        probeState,
        { 'cratis-arc-command': { type: 'noul', instructions: 'Would the `cratis-arc-command` guidance help answer or carry out `prompt`?', criteria: { true: 'cratis-arc-command: Define an Arc command.' } } },
        dependencies.transport,
        now,
    );
    if (probe.ok) {
        ui.notify(`Probe succeeded in ${probe.latencyMs} ms: cratis-arc-command scored ${probe.probabilities.get('cratis-arc-command')?.toFixed(2)} for a command prompt.`, 'info');
    } else {
        ui.notify(`Probe failed (${probe.failure}, ${probe.latencyMs} ms).`, 'warning');
        const saveAnyway = await ui.confirm('The probe failed. Save anyway?', 'The extension will fail open (turns are never blocked) and pause itself after repeated failures. You can fix the endpoint or key and run /system-one setup again.');
        if (!saveAnyway) return cancelled();
    }

    const configuration: UserConfiguration = {
        enabled: true,
        endpoint: checked.endpoint,
        ...(storedKey === undefined ? {} : { apiKey: storedKey }),
        consentedAt: new Date(now()).toISOString(),
        skillRelevance: { mode: SkillRelevanceMode.Shadow },
    };
    const path = writeUserConfiguration(dependencies.agentDirectory, configuration);
    ui.notify(`System One enabled in shadow mode, saved to ${path}. It only records scores; nothing in your conversation changes. See /system-one status and /system-one report.`, 'info');
}

/** `/system-one off`: keeps the file (and the recorded consent) and turns the extension off. */
export function turnOff(context: Pick<ExtensionContext, 'ui'>, agentDirectory: string): void {
    const text = readUserConfigurationText(agentDirectory);
    if (text === undefined) {
        context.ui.notify('System One is not set up, so there is nothing to turn off.', 'info');
        return;
    }
    let configuration: UserConfiguration;
    try {
        configuration = parseUserConfiguration(text);
    } catch {
        configuration = { enabled: false, consentedAt: new Date(0).toISOString() };
    }
    writeUserConfiguration(agentDirectory, { ...configuration, enabled: false });
    context.ui.notify('System One is turned off. Run /system-one setup to enable it again.', 'info');
}
