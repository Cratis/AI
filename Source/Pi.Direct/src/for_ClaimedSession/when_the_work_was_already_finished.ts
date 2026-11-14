// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the session shuts down after finishing', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        await context.session.finish('Delivered');
        await context.session.shutdown();
    });

    it('should not release again', () => context.gateway.releases.length.should.equal(1));
    it('should keep the delivered outcome', () => context.gateway.releases[0].outcome.should.equal('Delivered'));
}));
