// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

const tools = ['write', 'edit', 'bash', 'powershell', 'some_mcp_tool', 'direct_session_finish'];

describe('when a tool microtask follows an invalid renewal', given(an_extension, context => {
    let observedTools: Record<string, unknown>;
    let observedAt: number;
    let observedIntervals: number;
    let observedNotifications: number;

    beforeEach(async () => {
        context.launchWith();
        context.install();
        await context.pi.emit('session_start');
        let answer!: () => void;
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
        context.gateway.heartbeatLeases.push(5);
        const heartbeat = context.gateway.heartbeat.bind(context.gateway);
        context.gateway.heartbeat = request => {
            const response = heartbeat(request);
            // Register before beat's await: this tool runs after beat resumes but before tick's catch.
            void response.then(() => queueMicrotask(() => {
                observedAt = context.clock.monotonic();
                observedTools = Object.fromEntries([...tools, 'read'].map(tool => [tool, context.pi.emit('tool_call', { toolName: tool })]));
                observedIntervals = context.clock.intervals.size;
                observedNotifications = context.pi.notifications.length;
            }));
            return response;
        };
        await context.clock.advance(10_000);
        await context.clock.advance(6000);
        answer();
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(60_000);
    });
    afterEach(() => context.dispose());

    for (const tool of tools) {
        it(`should already block ${tool} in the response microtask`, () => (observedTools[tool] as { block: boolean }).block.should.equal(true));
    }
    it('should observe the response before the old lease expires', () => observedAt.should.equal(16_000));
    it('should still allow reads in that microtask', () => (observedTools.read === undefined).should.equal(true));
    it('should already have stopped observing the lease', () => observedIntervals.should.equal(0));
    it('should already have notified authority loss', () => observedNotifications.should.equal(1));
    it('should send no further heartbeats', () => context.gateway.heartbeats.length.should.equal(2));
}));
