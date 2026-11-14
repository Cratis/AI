// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

describe('when the lease expires with a heartbeat pending', given(an_extension, context => {
    let before: unknown;
    let after: unknown;

    beforeEach(async () => {
        context.launchWith();
        context.install();
        await context.pi.emit('session_start');
        before = context.pi.emit('tool_call', { toolName: 'direct_session_finish' });
        context.gateway.heartbeatPending = new Promise<void>(() => undefined);
        await context.clock.advance(10_000);
        await context.clock.advance(25_000);
        after = context.pi.emit('tool_call', { toolName: 'direct_session_finish' });
        context.pi.emit('tool_call', { toolName: 'direct_session_finish' });
    });
    afterEach(() => context.dispose());

    it('should allow a write before the deadline', () => (before === undefined).should.equal(true));
    it('should block a write after the deadline', () => (after as { block: boolean }).block.should.equal(true));
    it('should notify exactly once', () => context.pi.notifications.length.should.equal(1));
}));
