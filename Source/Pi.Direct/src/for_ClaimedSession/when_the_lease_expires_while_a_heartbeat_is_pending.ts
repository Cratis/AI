// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the lease expires while a heartbeat is pending', given(a_claimed_session, context => {
    let finishError: unknown;
    let answer: () => void;

    beforeEach(async () => {
        await context.claim();
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
        await context.clock.advance(10_000);
        await context.clock.advance(25_000);
        finishError = await thrownBy(() => context.session.finish('Delivered'));
        answer();
        await new Promise(resolve => setImmediate(resolve));
    });

    it('should refuse the write', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should block the guarded tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
    it('should stay lost after the late heartbeat succeeds', () => context.guard.state.should.equal('lost'));
    it('should not adopt the late epoch', () => context.session.status().epoch.should.equal(1));
    it('should notify once', () => context.notifications.length.should.equal(1));
}));
