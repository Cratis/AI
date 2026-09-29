// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Whether a managed `cratis-rules` still delivers path-scoped rules itself, as versions before `cratis-path-guidance` did. */
function managedRulesDeliverPaths(cwd: string): boolean {
    try {
        return readFileSync(join(cwd, '.pi', 'extensions', 'cratis-rules', 'index.ts'), 'utf8').includes("'tool_result'");
    } catch {
        return false;
    }
}

/**
 * A managed installation (`.cratis/ai.manifest.json`) loads its own extensions from `.pi/extensions`. The copy
 * shipped in `@cratis/pi` stands down when that installation already delivers path guidance, so a rule or hint
 * is never delivered twice, whichever versions are mixed:
 *
 * - the managed `cratis-path-guidance` exists: it delivers rules and hints;
 * - an older managed `cratis-rules` exists, which delivers path-scoped rules on `tool_result` itself: the packaged
 *   copy would repeat every rule, so it yields until `cratis ai update` installs the managed copy;
 * - a managed `cratis-rules` that only injects universal rules, or no managed Pi extensions at all: nothing else
 *   delivers path guidance, so the packaged copy stays active.
 *
 * The managed copy never stands down.
 */
export function standsDown(packaged: boolean, cwd: string): boolean {
    if (!packaged || !existsSync(join(cwd, '.cratis', 'ai.manifest.json'))) return false;
    return existsSync(join(cwd, '.pi', 'extensions', 'cratis-path-guidance', 'index.ts')) || managedRulesDeliverPaths(cwd);
}
