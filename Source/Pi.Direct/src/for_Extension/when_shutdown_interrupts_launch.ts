// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

for (const pending of ['claim', 'confirmation'] as const) {
    describe(`when shutdown interrupts a pending ${pending}`, given(an_extension, context => {
        beforeEach(async () => {
            let answer!: () => void;
            const response = new Promise<void>(resolve => { answer = resolve; });
            if (pending === 'claim') context.gateway.claimPending = response;
            else context.gateway.heartbeatPending = response;
            context.launchWith();
            context.install();
            const starting = context.pi.emit('session_start');
            await new Promise(resolve => setImmediate(resolve));
            await context.pi.emit('session_shutdown');
            answer();
            await starting;
            await context.clock.advance(60_000);
        });
        afterEach(() => context.dispose());
        it('should leave no timers', () => context.clock.timers.size.should.equal(0));
        it('should not register finish', () => context.pi.tools.length.should.equal(0));
        it('should close the gateway once', () => context.gateway.closed.should.equal(1));
        it('should abandon the granted claim once', () => context.gateway.releases.map(release => release.outcome).should.deep.equal(['Abandoned']));
        it('should not send another heartbeat', () => context.gateway.heartbeats.length.should.equal(pending === 'claim' ? 0 : 1));
        it('should keep local writes blocked', () => (context.pi.emit('tool_call', { toolName: 'bash' }) as { block: boolean }).block.should.equal(true));
        it('should not announce live work', () => (context.pi.emit('before_agent_start') === undefined).should.equal(true));
    }));
}
