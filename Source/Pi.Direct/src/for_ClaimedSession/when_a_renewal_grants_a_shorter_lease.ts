// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when a renewal grants a shorter lease', given(a_claimed_session, context => {
    let secondsRemaining: number;
    let finishError: unknown;

    beforeEach(async () => {
        await context.claim();
        await context.clock.advance(10_000);
        context.gateway.heartbeatLeases.push(5);
        await context.clock.advance(10_000);
        secondsRemaining = context.session.status().secondsToLeaseEnd;
        await context.clock.advance(6000);
        context.session.checkLease();
        finishError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should replace the standing deadline with the shorter grant', () => secondsRemaining.should.equal(5));
    it('should adopt the renewed epoch', () => context.session.status().epoch.should.equal(4));
    it('should lose authority at the shorter deadline', () => context.guard.state.should.equal('lost'));
    it('should deny the guarded tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should refuse to finish', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
}));
