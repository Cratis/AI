// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when a renewal response is already expired', given(a_claimed_session, context => {
    let finishError: unknown;

    beforeEach(async () => {
        let answer!: () => void;
        await context.claim();
        await context.clock.advance(10_000);
        context.gateway.heartbeatLeases.push(15);
        context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
        await context.clock.advance(10_000);
        await context.clock.advance(16_000);
        answer();
        await new Promise(resolve => setImmediate(resolve));
        finishError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should reject the expired grant before the standing deadline', () => context.guard.state.should.equal('lost'));
    it('should not adopt the expired epoch', () => context.session.status().epoch.should.equal(3));
    it('should deny the guarded tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should refuse to finish', () => (finishError as SessionRefused).code.should.equal('authority-lost'));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
    it('should stop the loop', () => context.clock.timers.size.should.equal(0));
}));
