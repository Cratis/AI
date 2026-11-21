// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when a fractional renewal rounds to the heartbeat interval', given(a_claimed_session, context => {
    beforeEach(async () => {
        context.gateway.claimed = { ...context.gateway.claimed, heartbeatSeconds: 1.0001 };
        await context.claim();
        context.gateway.heartbeatLeases.push(1.0004);
        await context.clock.advance(1000);
    });

    it('should lose authority at the rounded heartbeat time', () => context.session.status().authority.should.equal('lost'));
    it('should restrict writes', () => context.guard.blocks('write').should.equal(true));
    it('should not adopt the fractional grant epoch', () => context.session.status().epoch.should.equal(2));
    it('should retain the old deadline', () => context.session.status().secondsToLeaseEnd.should.equal(29));
    it('should have sent the rounded heartbeat', () => context.gateway.heartbeats.length.should.equal(2));
    it('should stop heartbeats', () => context.clock.timers.size.should.equal(0));
    it('should stop observing the lease', () => context.clock.intervals.size.should.equal(0));
}));
