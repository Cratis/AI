// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve the path Pi's built-in readers actually use, including read's filename fallbacks. */
export function builtinReadPath(toolName: string, path: string, cwd: string): string {
    const normalized = path.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/^@/, '');
    const resolved = resolve(expandPath(cwd), expandPath(normalized));
    if (toolName !== 'read') return resolved;
    const nfd = resolved.normalize('NFD');
    const candidates = [
        resolved,
        resolved.replace(/ (AM|PM)\./gi, '\u202F$1.'),
        nfd,
        resolved.replace(/'/g, '\u2019'),
        nfd.replace(/'/g, '\u2019')
    ];
    return candidates.find(candidate => existsSync(candidate)) ?? resolved;
}

function expandPath(path: string): string {
    const native = windowsPath(path);
    if (native === '~') return homedir();
    const homePrefix = process.platform === 'win32' ? /^~[/\\]/ : /^~\//;
    if (homePrefix.test(native)) return join(homedir(), native.slice(2));
    return /^file:\/\//.test(native) ? fileURLToPath(native) : native;
}

function windowsPath(path: string): string {
    if (process.platform !== 'win32') return path;
    if (path.startsWith('//')) return path;
    if (path.includes('\\')) return path;
    const match = path.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
    return match ? `${match[1].toUpperCase()}:\\${match[2]?.replaceAll('/', '\\') ?? ''}` : path;
}
