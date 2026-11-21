// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { readArguments } from '../for_Support/given/ReadArguments.ts';
import { a_workspace } from './given/a_workspace.ts';

for (const [tool, field] of [['read', 'path'], ['grep', 'pattern'], ['find', 'pattern']]) {
    const inputs = [{}, ...[undefined, null, 42, false, {}, []].map(value => ({ [field]: value }))];
    for (const [index, input] of inputs.entries()) {
        describe(`when required ${tool}.${field} is malformed ${index}`, given(a_workspace, context => {
            let allowed: boolean;
            beforeEach(() => { allowed = context.allowance.allows(tool, input, context.workspace); });
            afterEach(() => context.dispose());
            it('should fail closed', () => allowed.should.equal(false));
        }));
    }
}

const optionalFields: Array<[string, string, unknown]> = [
    ['read', 'offset', '1'], ['read', 'limit', '1'], ['grep', 'path', 42], ['grep', 'glob', 42],
    ['grep', 'ignoreCase', 'true'], ['grep', 'literal', 1], ['grep', 'context', '1'], ['grep', 'limit', '1'],
    ['find', 'path', 42], ['find', 'limit', '1'], ['ls', 'path', 42], ['ls', 'limit', '1']
];

for (const [tool, field, wrongType] of optionalFields) {
    for (const [index, value] of [wrongType, null, {}, []].entries()) {
        describe(`when optional ${tool}.${field} has the wrong type ${index}`, given(a_workspace, context => {
            let allowed: boolean;
            beforeEach(() => {
                allowed = context.allowance.allows(tool, { ...readArguments(tool), [field]: value }, context.workspace);
            });
            afterEach(() => context.dispose());
            it('should fail closed', () => allowed.should.equal(false));
        }));
    }
}

const validInputs: Array<[string, Record<string, unknown>]> = [
    ['read', { path: '.', offset: 1, limit: 5 }],
    ['grep', { pattern: '', glob: '*.ts', ignoreCase: false, literal: true, context: 0, limit: 10 }],
    ['find', { pattern: '**/*', limit: 1 }],
    ['ls', { limit: 10 }]
];

for (const [tool, input] of validInputs) {
    describe(`when ${tool} receives schema-valid optional arguments`, given(a_workspace, context => {
        let allowed: boolean;
        beforeEach(() => { allowed = context.allowance.allows(tool, input, context.workspace); });
        afterEach(() => context.dispose());
        it('should allow the built-in within the workspace', () => allowed.should.equal(true));
    }));
}
