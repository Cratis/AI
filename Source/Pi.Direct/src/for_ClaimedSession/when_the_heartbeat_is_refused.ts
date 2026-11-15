// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the heartbeat is refused', given(a_claimed_session, context => {
    let finishError: unknown;

    beforeEach(async () => {
        await context.claim();
        context.gateway.heartbeatFails = true;
        await context.clock.advance(10_000);
        await context.clock.advance(60_000);
        finishError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should lose the guard', () => context.guard.state.should.equal('lost'));
    it('should block the finish tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should notify once with a fixed message', () => context.notifications.should.deep.equal(['Claim authority for this work was lost; this session can no longer write.']));
    it('should stop beating', () => context.gateway.heartbeats.length.should.equal(1));
    it('should report lost authority', () => context.session.status().authority.should.equal('lost'));
    it('should refuse to finish', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
}));
