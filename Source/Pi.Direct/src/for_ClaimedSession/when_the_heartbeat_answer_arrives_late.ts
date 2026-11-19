// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the heartbeat answer arrives late', given(a_claimed_session, context => {
    let secondsRemaining: number;
    let finishError: unknown;

    beforeEach(async () => {
        let answer!: () => void;
        await context.claim();
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
        await context.clock.advance(10_000);
        await context.clock.advance(15_000);
        answer();
        await new Promise(resolve => setImmediate(resolve));
        secondsRemaining = context.session.status().secondsToLeaseEnd;
        context.gateway.heartbeatPending = new Promise<void>(() => {});
        await context.clock.advance(15_000);
        context.session.checkLease();
        finishError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should count the renewed lease from the send time', () => secondsRemaining.should.equal(15));
    it('should lose authority at the send-anchored deadline', () => context.guard.state.should.equal('lost'));
    it('should deny the guarded tool at that deadline', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should refuse to finish', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
}));
