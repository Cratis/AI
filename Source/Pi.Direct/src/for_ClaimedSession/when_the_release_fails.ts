// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the release fails', given(a_claimed_session, context => {
    beforeEach(async () => {
        await context.claim();
        context.gateway.release = () => Promise.reject(new Error('down'));
        await thrownBy(() => context.session.finish('Delivered'));
    });

    it('should report lost rather than released', () => context.session.status().authority.should.equal('lost'));
    it('should notify once', () => context.notifications.length.should.equal(1));
}));
