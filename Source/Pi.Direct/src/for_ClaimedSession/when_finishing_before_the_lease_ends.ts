// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when finishing before the lease ends with a heartbeat pending', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        context.gateway.heartbeatPending = new Promise<void>(() => undefined);
        await context.clock.advance(10_000);
        await context.clock.advance(19_000);
        context.session.checkLease();
        await context.session.finish('Delivered');
    });

    it('should release', () => context.gateway.releases.length.should.equal(1));
    it('should report released', () => context.session.status().authority.should.equal('released'));
    it('should not notify', () => context.notifications.length.should.equal(0));
}));
