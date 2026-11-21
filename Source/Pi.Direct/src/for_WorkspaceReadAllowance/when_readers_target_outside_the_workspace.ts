// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { given } from '../given.ts';
import { readArguments } from '../for_Support/given/ReadArguments.ts';
import { WorkspaceReadAllowance } from '../WorkspaceReadAllowance.ts';
import { a_workspace } from './given/a_workspace.ts';

for (const tool of ['read', 'grep', 'find', 'ls']) {
    describe(`when built-in ${tool} targets outside the workspace`, given(a_workspace, context => {
        let allowed: boolean[];
        beforeEach(() => {
            const paths = [context.outside, '../workspace-other/secret.txt', join(context.outside, 'missing/file'),
                'escape/secret.txt', 'escape/missing/deep/file', 'dangling', 'cycle',
                `@${context.outside}/secret.txt`, pathToFileURL(context.outside).href,
                `~/${relative(homedir(), context.outside)}`, 'space\u2000escape/secret.txt'];
            allowed = paths.map(path => context.allowance.allows(tool, { ...readArguments(tool), path }, context.workspace));
        });
        afterEach(() => context.dispose());

        it('should reject an absolute sibling with a shared prefix', () => allowed[0].should.equal(false));
        it('should reject traversal out of the workspace', () => allowed[1].should.equal(false));
        it('should reject missing targets outside the boundary', () => allowed[2].should.equal(false));
        it('should reject symlink escapes', () => allowed[3].should.equal(false));
        it('should reject missing targets below an escaping symlink', () => allowed[4].should.equal(false));
        it('should fail closed on a dangling symlink', () => allowed[5].should.equal(false));
        it('should fail closed on a symlink cycle', () => allowed[6].should.equal(false));
        it('should not bypass containment with an at prefix', () => allowed[7].should.equal(false));
        it('should not bypass containment with a file URL', () => allowed[8].should.equal(false));
        it('should not bypass containment with tilde expansion', () => allowed[9].should.equal(false));
        it('should not bypass containment with Unicode spaces', () => allowed[10].should.equal(false));
    }));
}

describe('when read falls back to another filename', given(a_workspace, context => {
    let allowed: boolean;
    beforeEach(() => { allowed = context.allowance.allows('read', { path: "author's.txt" }, context.workspace); });
    afterEach(() => context.dispose());
    it('should reject a fallback that is an escaping symlink', () => allowed.should.equal(false));
}));

for (const missingWorkspace of [true, false]) {
    describe(`when ${missingWorkspace ? 'the initial workspace is unresolved' : 'the tool cwd moves outside'}`, given(a_workspace, context => {
        let allowed: boolean;
        beforeEach(() => {
            const allowance = missingWorkspace ? new WorkspaceReadAllowance(join(context.root, 'missing'), () => context.tools) : context.allowance;
            allowed = allowance.allows('ls', {}, context.outside);
        });
        afterEach(() => context.dispose());
        it('should not grant access to the new location', () => allowed.should.equal(false));
    }));
}
