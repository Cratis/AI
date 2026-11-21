// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

for (const cause of ['claim refusal', 'heartbeat refusal', 'pending heartbeat expiry', 'wall rollback', 'suspend'] as const) {
    describe(`when local authority is lost through ${cause}`, given(an_extension, context => {
        beforeEach(async () => {
            context.launchWith();
            context.install();
            context.gateway.claimFails = cause === 'claim refusal';
            await context.pi.emit('session_start');
            if (cause === 'heartbeat refusal') {
                context.gateway.heartbeatFails = true;
                await context.clock.advance(10_000);
            }
            if (cause === 'pending heartbeat expiry' || cause === 'wall rollback') {
                context.gateway.heartbeatPending = new Promise(() => undefined);
                if (cause === 'wall rollback') context.clock.setWallTime(-60_000);
                await context.clock.advance(30_000);
            }
            if (cause === 'suspend') context.clock.suspend(30_000);
        });
        afterEach(() => context.dispose());
        for (const tool of ['bash', 'powershell', 'edit', 'write', 'some_mcp_tool']) {
            it(`should block ${tool}`, () => (context.pi.emit('tool_call', { toolName: tool }) as { block: boolean }).block.should.equal(true));
        }
        for (const tool of ['read', 'grep', 'find', 'ls']) {
            it(`should allow ${tool}`, () => (context.pi.emit('tool_call', { toolName: tool }) === undefined).should.equal(true));
        }
    }));
}

for (const launched of [false, true]) {
    describe(`when local work is ${launched ? 'live' : 'not launched'}`, given(an_extension, context => {
        beforeEach(async () => {
            if (launched) context.launchWith();
            context.install();
            await context.pi.emit('session_start');
        });
        afterEach(() => context.dispose());
        it('should allow bash', () => (context.pi.emit('tool_call', { toolName: 'bash' }) === undefined).should.equal(true));
    }));
}
