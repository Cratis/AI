// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_workspace } from './given/a_workspace.ts';

const malformedInputs: unknown[] = [undefined, null, true, 42, '.', [], { path: null }, { path: 42 }, { path: false },
    { path: {} }, { path: [] }, { path: 'notes.txt\0' }, { path: 'file://%' }];

for (const tool of ['read', 'grep', 'find', 'ls']) {
    for (const [index, input] of malformedInputs.entries()) {
        describe(`when ${tool} receives malformed arguments ${index}`, given(a_workspace, context => {
            let allowed: boolean;
            beforeEach(() => { allowed = context.allowance.allows(tool, input, context.workspace); });
            afterEach(() => context.dispose());
            it('should fail closed', () => allowed.should.equal(false));
        }));
    }
}
