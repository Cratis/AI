// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the session shuts down after the lease expired', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        context.gateway.heartbeatPending = new Promise<void>(() => undefined);
        await context.clock.advance(40_000);
        await context.session.shutdown();
        await context.session.shutdown();
    });

    it('should not attempt a release', () => context.gateway.releases.length.should.equal(0));
    it('should notify once', () => context.notifications.length.should.equal(1));
    it('should report lost', () => context.session.status().authority.should.equal('lost'));
    it('should close the connection', () => context.gateway.closed.should.be.greaterThan(0));
}));
