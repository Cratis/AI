// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A managed project loads its own copy of this extension from `.pi/extensions`. The copy shipped in
 * `@cratis/pi` stands down when that installation exists, so a rule or hint is never delivered twice.
 * The managed copy never stands down.
 */
export function standsDown(packaged: boolean, cwd: string): boolean {
    if (!packaged) return false;
    const managedEntry = join(cwd, '.pi', 'extensions', 'cratis-path-guidance', 'index.ts');
    return existsSync(join(cwd, '.cratis', 'ai.manifest.json')) && existsSync(managedEntry);
}
