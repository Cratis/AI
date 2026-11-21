// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

for (const leaseSeconds of [10, 5]) {
    describe(`when a renewal grants ${leaseSeconds} seconds for a ten-second heartbeat interval`, given(a_claimed_session, context => {
        let secondsRemaining: number;
        let finishError: unknown;

        beforeEach(async () => {
            await context.claim();
            await context.clock.advance(10_000);
            context.gateway.heartbeatLeases.push(leaseSeconds);
            await context.clock.advance(10_000);
            secondsRemaining = context.session.status().secondsToLeaseEnd;
            await context.clock.advance(60_000);
            finishError = await thrownBy(() => context.session.finish('Delivered'));
        });

        it('should lose authority', () => context.session.status().authority.should.equal('lost'));
        it('should leave the guard lost', () => context.guard.state.should.equal('lost'));
        it('should not adopt the invalid deadline', () => secondsRemaining.should.equal(20));
        it('should not adopt the renewal epoch', () => context.session.status().epoch.should.equal(3));
        it('should stop sending heartbeats', () => context.gateway.heartbeats.length.should.equal(3));
        it('should stop the heartbeat timer', () => context.clock.timers.size.should.equal(0));
        it('should stop the lease observer', () => context.clock.intervals.size.should.equal(0));
        it('should notify once', () => context.notifications.length.should.equal(1));
        it('should block local writes', () => context.guard.blocks('write').should.equal(true));
        it('should allow local reads', () => context.guard.blocks('read').should.equal(false));
        it('should refuse to finish', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
        it('should not release', () => context.gateway.releases.length.should.equal(0));
    }));
}
