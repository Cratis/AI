// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Harness } from './Harness.ts';
import type { Options } from './Options.ts';

export function harnessEnvironment(environment: NodeJS.ProcessEnv, listingBudget?: number): NodeJS.ProcessEnv {
    const clean = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('PI_')));
    // An inherited budget would make the default condition differ across hosts.
    delete clean.SLASH_COMMAND_TOOL_CHAR_BUDGET;
    if (listingBudget !== undefined) clean.SLASH_COMMAND_TOOL_CHAR_BUDGET = String(listingBudget);
    return clean;
}

export function harnessCommand(options: Pick<Options, 'harness' | 'model' | 'thinking'>, prompt: string, skillsDirectory?: string): string[] {
    if (options.harness === Harness.Claude) return [
        'claude', '-p', prompt, '--model', options.model, '--output-format', 'stream-json', '--verbose',
        '--no-session-persistence', '--setting-sources', 'project', '--disallowedTools',
        'Edit', 'Write', 'Bash', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Agent', 'Task',
    ];
    return [
        'pi', '-p', '--mode', 'json', '--no-session', '--no-context-files', '--no-extensions', '--no-mcp',
        '--no-prompt-templates', '--no-themes', '--tools', 'read,grep,find,ls', '--no-skills',
        ...(skillsDirectory ? ['--skill', skillsDirectory] : []), '--model', options.model, '--thinking', options.thinking, prompt,
    ];
}

export function graderCommand(prompt: string, model: string): string[] {
    return ['claude', '-p', prompt, '--model', model, '--output-format', 'stream-json', '--verbose',
        '--no-session-persistence', '--setting-sources', 'project', '--tools', ''];
}
