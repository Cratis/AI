// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolInfo } from '@earendil-works/pi-coding-agent';
import { WorkspaceReadAllowance } from '../../WorkspaceReadAllowance.ts';

/** Real filesystem targets, including links that cross the workspace boundary. */
export class a_workspace {
    readonly root: string;
    readonly workspace: string;
    readonly outside: string;
    readonly tools: Array<Pick<ToolInfo, 'name' | 'sourceInfo'>> = ['read', 'grep', 'find', 'ls'].map(name => ({
        name, sourceInfo: { path: `<builtin:${name}>`, source: 'builtin', scope: 'temporary', origin: 'top-level' }
    }));
    readonly allowance: WorkspaceReadAllowance;

    constructor() {
        const artifacts = fileURLToPath(new URL('../../../../../.ai-work/1291/', import.meta.url));
        mkdirSync(artifacts, { recursive: true });
        this.root = realpathSync(mkdtempSync(join(artifacts, 'read-allowance-')));
        this.workspace = join(this.root, 'workspace');
        this.outside = join(this.root, 'workspace-other');
        mkdirSync(join(this.workspace, 'nested'), { recursive: true });
        mkdirSync(this.outside);
        writeFileSync(join(this.workspace, 'notes.txt'), 'workspace');
        writeFileSync(join(this.outside, 'secret.txt'), 'outside');
        symlinkSync(this.outside, join(this.workspace, 'escape'));
        symlinkSync(this.outside, join(this.workspace, 'space escape'));
        symlinkSync(this.workspace, join(this.root, 'alias'));
        symlinkSync(join(this.workspace, 'notes.txt'), join(this.workspace, 'inside-link'));
        symlinkSync(join(this.outside, 'missing'), join(this.workspace, 'dangling'));
        symlinkSync('cycle', join(this.workspace, 'cycle'));
        symlinkSync(join(this.outside, 'secret.txt'), join(this.workspace, 'author\u2019s.txt'));
        this.allowance = new WorkspaceReadAllowance(this.workspace, () => this.tools);
    }

    dispose(): void { rmSync(this.root, { recursive: true, force: true }); }
}
