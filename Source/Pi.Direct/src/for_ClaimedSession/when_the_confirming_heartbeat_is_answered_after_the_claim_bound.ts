// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import type { GuardState } from '../WriteGuard.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the confirming heartbeat is answered after the claim bound', given(a_claimed_session, context => {
    let confirmedState: GuardState;
    let secondsRemaining: number;
    let finishError: unknown;

    beforeEach(async () => {
        let answerClaim!: () => void;
        let answerHeartbeat!: () => void;
        context.gateway.claimed.leaseSeconds = 2;
        context.gateway.claimPending = new Promise<void>(resolve => { answerClaim = resolve; });
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answerHeartbeat = resolve; });
        const launching = context.claim();
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(1500);
        answerClaim();
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(1000);
        answerHeartbeat();
        await launching;
        confirmedState = context.guard.state;
        secondsRemaining = context.session.status().secondsToLeaseEnd;
        context.gateway.heartbeatPending = new Promise<void>(() => {});
        await context.clock.advance(29_100);
        context.session.checkLease();
        finishError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should confirm the recovered claim using its own heartbeat deadline', () => confirmedState.should.equal('open'));
    it('should count the lease from the confirming send time', () => secondsRemaining.should.equal(29));
    it('should lose authority at the confirming deadline', () => context.guard.state.should.equal('lost'));
    it('should deny the guarded tool after that deadline', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should refuse to finish after that deadline', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
}));
