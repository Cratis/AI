// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigurationFile } from './ConfigurationFile.ts';
import { FileState } from './FileState.ts';
import type { UserConfiguration } from './UserConfiguration.ts';

export function userConfigurationPath(agentDirectory: string): string {
    return join(agentDirectory, 'cratis-system-one.json');
}

/** Reads a file as resolution needs it: missing, unreadable (a distinct answer), or its text. */
export function readConfigurationFile(path: string, checkMode = false): ConfigurationFile {
    try {
        if (!existsSync(path)) return { state: FileState.Missing };
        const text = readFileSync(path, 'utf8');
        // The file may hold an API key. Mode bits mean nothing on Windows, so it is not checked there.
        const readableByOthers = checkMode && process.platform !== 'win32' && (statSync(path).mode & 0o077) !== 0;
        return { state: FileState.Present, text, readableByOthers };
    } catch {
        return { state: FileState.Unreadable };
    }
}

export function readUserConfigurationFile(agentDirectory: string): ConfigurationFile {
    return readConfigurationFile(userConfigurationPath(agentDirectory), true);
}

/**
 * Writes the user's configuration atomically (temp file, then rename) with mode 0600, because it may
 * hold an API key. The temp file is created exclusively and private, so the key is never briefly
 * world-readable and an existing file or a planted link is never written through. A failed rename
 * removes the temp file.
 */
export function writeUserConfiguration(agentDirectory: string, configuration: UserConfiguration): string {
    const path = userConfigurationPath(agentDirectory);
    mkdirSync(agentDirectory, { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    try {
        writeFileSync(temporary, `${JSON.stringify(configuration, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        chmodSync(temporary, 0o600);
        renameSync(temporary, path);
    } catch (error) {
        rmSync(temporary, { force: true });
        throw error;
    }
    return path;
}
