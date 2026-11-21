// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import type { GuardState } from '../WriteGuard.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the first heartbeat is pending', given(a_claimed_session, context => {
    let pendingState: GuardState;
    let writeBlocked: boolean;
    let pendingTimers: number;

    beforeEach(async () => {
        let answer!: () => void;
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
        const launching = context.claim();
        await new Promise(resolve => setImmediate(resolve));
        pendingState = context.guard.state;
        writeBlocked = context.guard.blocks('direct_session_finish');
        pendingTimers = context.clock.timers.size;
        answer();
        await launching;
    });

    it('should keep the guard pending until confirmation', () => pendingState.should.equal('pending'));
    it('should deny the guarded tool until confirmation', () => writeBlocked.should.equal(true));
    it('should not schedule renewals before confirmation', () => pendingTimers.should.equal(0));
    it('should send exactly one confirming heartbeat', () => context.gateway.heartbeats.should.deep.equal([
        { workHandle: 'work-1', claimId: 'claim-1', epoch: 1 }
    ]));
    it('should open only after confirmation', () => context.guard.state.should.equal('open'));
    it('should adopt the confirming epoch', () => context.session.status().epoch.should.equal(2));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
}));
