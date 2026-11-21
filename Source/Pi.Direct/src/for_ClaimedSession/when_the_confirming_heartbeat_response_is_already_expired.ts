// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import type { GuardState } from '../WriteGuard.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when the confirming heartbeat response is already expired', given(a_launch, context => {
    let error: unknown;
    let pendingState: GuardState;

    beforeEach(async () => {
        let answerClaim!: () => void;
        let answerHeartbeat!: () => void;
        context.gateway.claimPending = new Promise<void>(resolve => { answerClaim = resolve; });
        context.gateway.claimed = { ...context.gateway.claimed, heartbeatSeconds: 0.5 };
        context.gateway.heartbeatLeaseSeconds = 1;
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answerHeartbeat = resolve; });
        const launching = thrownBy(() => context.launch());
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(1500);
        answerClaim();
        await new Promise(resolve => setImmediate(resolve));
        pendingState = context.guard.state;
        await context.clock.advance(1500);
        answerHeartbeat();
        error = await launching;
    });

    it('should not open while confirming', () => pendingState.should.equal('pending'));
    it('should refuse the expired confirmation', () => (error as SessionRefused).code.should.equal('refused'));
    it('should leave the guard terminal', () => context.guard.state.should.equal('lost'));
    it('should deny the guarded tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should start no timers', () => context.clock.timers.size.should.equal(0));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
    it('should close the connection', () => context.gateway.closed.should.equal(1));
}));
