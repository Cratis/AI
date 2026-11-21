// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the heartbeat is due', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        await context.clock.advance(10_000);
    });

    it('should heartbeat with the claim and epoch', () => context.gateway.heartbeats.should.deep.equal([
        { workHandle: 'work-1', claimId: 'claim-1', epoch: 1 },
        { workHandle: 'work-1', claimId: 'claim-1', epoch: 2 }
    ]));
    it('should adopt the new epoch', () => context.session.status().epoch.should.equal(3));
    it('should extend the lease from the renewal send time', () => context.session.status().secondsToLeaseEnd.should.equal(30));
    it('should stay live', () => context.session.status().authority.should.equal('live'));
    it('should schedule the next beat', () => context.clock.timers.size.should.equal(1));
}));
