// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

for (const request of ['heartbeat', 'finish'] as const) {
    describe(`when a pending ${request} answers after shutdown`, given(a_claimed_session, context => {
        beforeEach(async () => {
            await context.claim();
            let answer!: () => void;
            const response = new Promise<void>(resolve => { answer = resolve; });
            let finishing: Promise<unknown> | undefined;
            if (request === 'heartbeat') {
                context.gateway.heartbeatPending = response;
                await context.clock.advance(10_000);
            } else {
                context.gateway.releasePending = response;
                finishing = thrownBy(() => context.session.finish('Delivered'));
                await new Promise(resolve => setImmediate(resolve));
            }
            await context.session.shutdown();
            answer();
            await finishing;
            await new Promise(resolve => setImmediate(resolve));
            await context.clock.advance(60_000);
        });
        it('should keep authority lost', () => context.guard.state.should.equal('lost'));
        it('should keep shell work blocked', () => context.guard.blocks('bash').should.equal(true));
        it('should leave no timers', () => context.clock.timers.size.should.equal(0));
        it('should not start another heartbeat', () => context.gateway.heartbeats.length.should.equal(request === 'heartbeat' ? 2 : 1));
        it('should not attempt another release', () => context.gateway.releases.length.should.equal(1));
        it('should close once', () => context.gateway.closed.should.equal(1));
    }));
}
