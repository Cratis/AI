// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import type { ToolInfo } from '@earendil-works/pi-coding-agent';
import { builtinReadPath } from './BuiltinReadPath.ts';
import { requestedPath } from './ReadToolArguments.ts';
import { usesRipgrepConfiguration } from './ReadToolEnvironment.ts';
import { readOnlyTools } from './WriteGuard.ts';

type ToolProvenance = Pick<ToolInfo, 'name' | 'sourceInfo'>;

/** The restricted-session exception: current built-in readers, confined to the initial workspace. */
export class WorkspaceReadAllowance {
    private readonly workspace: string | undefined;

    constructor(workspace: string, private readonly getTools: () => readonly ToolProvenance[]) {
        try { this.workspace = realpathSync(workspace); } catch { /* An unresolved workspace cannot grant read access. */ }
    }

    allows(toolName: string, input: unknown, cwd: string): boolean {
        if (!this.workspace || !readOnlyTools.has(toolName)) return false;
        try {
            const tools = this.getTools().filter(tool => tool.name === toolName);
            if (tools.length !== 1 || tools[0].sourceInfo?.source !== 'builtin') return false;
            if (usesRipgrepConfiguration(tools[0])) return false;
            const path = requestedPath(toolName, input);
            if (path === undefined) return false;
            const target = canonicalPath(builtinReadPath(toolName, path, cwd));
            return contains(this.workspace, target);
        } catch { return false; }
    }
}

function contains(workspace: string, target: string): boolean {
    const path = relative(workspace, target);
    return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function canonicalPath(path: string): string {
    try { return realpathSync(path); } catch (error) {
        if (!isMissing(error) || !isAbsent(path)) throw error;
        const parent = dirname(path);
        if (parent === path) throw error;
        return join(canonicalPath(parent), basename(path));
    }
}

function isAbsent(path: string): boolean {
    try { lstatSync(path); return false; } catch (error) {
        if (isMissing(error)) return true;
        throw error;
    }
}

function isMissing(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}
