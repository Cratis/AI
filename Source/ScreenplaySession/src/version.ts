// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');

/** The standalone Screenplay version the corpus is verified against, from Documentation/compatibility.md. */
export function pinnedScreenplayVersion(root: string = repositoryRoot): string {
    const compatibility = readFileSync(join(root, 'Documentation/compatibility.md'), 'utf8');
    const match = /^\| Screenplay language, standalone tool and MCP \| \*\*(\d+\.\d+\.\d+)\*\*/m.exec(compatibility);
    if (!match) throw new Error('The standalone Screenplay pin is missing from Documentation/compatibility.md.');
    return match[1];
}
