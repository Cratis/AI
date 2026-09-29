// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UserConfiguration } from './UserConfiguration.ts';

export function userConfigurationPath(agentDirectory: string): string {
    return join(agentDirectory, 'cratis-system-one.json');
}

/** The file's text, or undefined when there is none. An unreadable file is reported as text that cannot parse. */
export function readUserConfigurationText(agentDirectory: string): string | undefined {
    const path = userConfigurationPath(agentDirectory);
    try {
        return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    } catch {
        return '\u0000unreadable';
    }
}

/**
 * Writes the user's configuration atomically (temp file, then rename) with mode 0600, because it may
 * hold an API key. The temp file is created private, so the key is never briefly world-readable.
 */
export function writeUserConfiguration(agentDirectory: string, configuration: UserConfiguration): string {
    const path = userConfigurationPath(agentDirectory);
    mkdirSync(agentDirectory, { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(configuration, null, 2)}\n`, { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
    return path;
}
