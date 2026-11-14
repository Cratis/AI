// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the old deadline passes after a successful release', given(a_claimed_session, context => {
    let secondError: unknown;

    beforeEach(async () => {
        await context.claim();
        await context.session.finish('Delivered');
        await context.clock.advance(120_000);
        context.session.checkLease();
        secondError = await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should stay released', () => context.session.status().authority.should.equal('released'));
    it('should send no notification', () => context.notifications.length.should.equal(0));
    it('should still block writes', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should refuse a second finish', () => (secondError as SessionRefused).code.should.equal('already-released'));
    it('should release only once', () => context.gateway.releases.length.should.equal(1));
}));
