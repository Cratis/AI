// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when finishing', given(a_claimed_session, context => {
    let secondError: unknown;

    beforeEach(async () => {
        await context.claim();
        await context.session.finish('Blocked', 'needs input');
        secondError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should release once with the outcome and reason', () => context.gateway.releases.should.deep.equal([
        { workHandle: 'work-1', claimId: 'claim-1', epoch: 2, outcome: 'Blocked', reason: 'needs input' }
    ]));
    it('should refuse a second finish', () => (secondError as SessionRefused).code.should.equal('already-released'));
    it('should stop the heartbeat', () => context.clock.timers.size.should.equal(0));
    it('should close the connection', () => context.gateway.closed.should.equal(1));
    it('should report released', () => context.session.status().authority.should.equal('released'));
}));
