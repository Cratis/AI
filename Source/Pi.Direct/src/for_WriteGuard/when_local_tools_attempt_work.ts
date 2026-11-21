// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { WriteGuard } from '../WriteGuard.ts';

for (const state of ['unclaimed', 'pending', 'open', 'lost', 'released'] as const) {
    describe(`when local tools attempt work with ${state} authority`, () => {
        let guard: WriteGuard;
        beforeEach(() => {
            guard = new WriteGuard(new Set(['direct_session_finish']));
            if (state === 'pending') guard.markPending();
            else if (state !== 'unclaimed') guard.open();
            if (state === 'lost') { guard.markLost(); guard.acknowledge(); guard.open(); }
            if (state === 'released') guard.markReleased();
        });
        for (const tool of ['bash', 'powershell', 'edit', 'write', 'some_mcp_tool']) {
            it(`should ${state === 'pending' || state === 'lost' ? 'block' : 'allow'} ${tool}`, () => guard.blocks(tool).should.equal(state === 'pending' || state === 'lost'));
        }
        for (const tool of ['read', 'grep', 'find', 'ls']) {
            it(`should allow ${tool}`, () => guard.blocks(tool).should.equal(false));
        }
    });
}
