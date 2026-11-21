// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { readArguments } from '../for_Support/given/ReadArguments.ts';
import { WorkspaceReadAllowance } from '../WorkspaceReadAllowance.ts';
import { a_workspace } from './given/a_workspace.ts';

for (const tool of ['read', 'grep', 'find', 'ls']) {
    for (const source of ['extension', 'sdk', 'unknown', '']) {
        describe(`when ${source || 'unspecified'} overrides ${tool}`, given(a_workspace, context => {
            let before: boolean;
            let after: boolean;
            beforeEach(() => {
                before = context.allowance.allows(tool, readArguments(tool), context.workspace);
                context.tools.find(candidate => candidate.name === tool)!.sourceInfo.source = source;
                after = context.allowance.allows(tool, readArguments(tool), context.workspace);
            });
            afterEach(() => context.dispose());
            it('should allow the original built-in', () => before.should.equal(true));
            it('should reject the same-named replacement using current provenance', () => after.should.equal(false));
        }));
    }
    for (const provenance of ['missing', 'duplicate', 'no metadata', 'unavailable'] as const) {
        describe(`when ${tool} provenance is ${provenance}`, given(a_workspace, context => {
            let allowed: boolean;
            beforeEach(() => {
                const index = context.tools.findIndex(candidate => candidate.name === tool);
                if (provenance === 'missing') context.tools.splice(index, 1);
                if (provenance === 'duplicate') context.tools.push(context.tools[index]);
                if (provenance === 'no metadata') context.tools[index].sourceInfo = undefined!;
                const allowance = provenance === 'unavailable'
                    ? new WorkspaceReadAllowance(context.workspace, () => { throw new Error('registry unavailable'); }) : context.allowance;
                allowed = allowance.allows(tool, readArguments(tool), context.workspace);
            });
            afterEach(() => context.dispose());
            it('should fail closed', () => allowed.should.equal(false));
        }));
    }
}

for (const tool of ['bash', 'powershell', 'write', 'edit', 'mcp_read', 'unknown']) {
    describe(`when ${tool} claims built-in provenance`, given(a_workspace, context => {
        let allowed: boolean;
        beforeEach(() => {
            context.tools.push({ ...context.tools[0], name: tool });
            allowed = context.allowance.allows(tool, readArguments(tool), context.workspace);
        });
        afterEach(() => context.dispose());
        it('should not extend the read-only exception', () => allowed.should.equal(false));
    }));
}
