// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { readArguments } from '../for_Support/given/ReadArguments.ts';
import { a_workspace } from './given/a_workspace.ts';

const malformedPaths: unknown[] = [null, 42, false, {}, [], 'notes.txt\0', 'file://%'];

for (const tool of ['read', 'grep', 'find', 'ls']) {
    const malformedInputs = [undefined, null, true, 42, '.', [],
        ...malformedPaths.map(path => ({ ...readArguments(tool), path }))];
    for (const [index, input] of malformedInputs.entries()) {
        describe(`when ${tool} receives malformed arguments ${index}`, given(a_workspace, context => {
            let allowed: boolean;
            beforeEach(() => { allowed = context.allowance.allows(tool, input, context.workspace); });
            afterEach(() => context.dispose());
            it('should fail closed', () => allowed.should.equal(false));
        }));
    }
}
