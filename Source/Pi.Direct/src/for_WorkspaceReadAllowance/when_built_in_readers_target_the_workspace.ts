// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { given } from '../given.ts';
import { WorkspaceReadAllowance } from '../WorkspaceReadAllowance.ts';
import { a_workspace } from './given/a_workspace.ts';

for (const tool of ['read', 'grep', 'find', 'ls']) {
    describe(`when built-in ${tool} targets the workspace`, given(a_workspace, context => {
        let allowed: boolean[];
        beforeEach(() => {
            const paths = [undefined, '.', 'notes.txt', 'nested/../notes.txt', 'missing/deep/file', 'inside-link', context.workspace,
                join(context.workspace, 'notes.txt'), join(context.root, 'alias/notes.txt'), `@${context.workspace}/notes.txt`,
                pathToFileURL(join(context.workspace, 'notes.txt')).href];
            allowed = paths.map(path => context.allowance.allows(tool, { path }, context.workspace));
        });
        afterEach(() => context.dispose());

        it('should allow the omitted path as cwd', () => allowed[0].should.equal(true));
        it('should allow dot as cwd', () => allowed[1].should.equal(true));
        it('should allow a relative file', () => allowed[2].should.equal(true));
        it('should allow contained traversal', () => allowed[3].should.equal(true));
        it('should resolve missing targets through their existing parent', () => allowed[4].should.equal(true));
        it('should allow links that stay inside', () => allowed[5].should.equal(true));
        it('should allow the workspace root', () => allowed[6].should.equal(true));
        it('should allow absolute workspace paths', () => allowed[7].should.equal(true));
        it('should compare canonical rather than lexical paths', () => allowed[8].should.equal(true));
        it('should understand Pi at-prefixed paths', () => allowed[9].should.equal(true));
        it('should understand Pi file URLs', () => allowed[10].should.equal(true));
    }));
}

describe('when the initial workspace is a symlink', given(a_workspace, context => {
    let allowed: boolean;
    beforeEach(() => {
        const workspace = join(context.root, 'alias');
        const allowance = new WorkspaceReadAllowance(workspace, () => context.tools);
        allowed = allowance.allows('read', { path: 'notes.txt' }, workspace);
    });
    afterEach(() => context.dispose());
    it('should use the canonical workspace boundary', () => allowed.should.equal(true));
}));
