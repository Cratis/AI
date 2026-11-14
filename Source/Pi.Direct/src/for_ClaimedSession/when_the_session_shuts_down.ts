// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the session shuts down', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        await context.session.shutdown();
        await context.session.shutdown();
    });

    it('should release as abandoned exactly once', () => context.gateway.releases.map(release => release.outcome).should.deep.equal(['Abandoned']));
    it('should start no timers', () => context.clock.timers.size.should.equal(0));
}));
