// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when the first heartbeat is refused', given(a_launch, context => {
    let error: unknown;

    beforeEach(async () => {
        context.gateway.heartbeatFails = true;
        error = await thrownBy(() => context.launch());
    });

    it('should refuse generically', () => (error as SessionRefused).code.should.equal('refused'));
    it('should leave the guard terminal', () => context.guard.state.should.equal('lost'));
    it('should deny the guarded tool', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should start no timers', () => context.clock.timers.size.should.equal(0));
    it('should close the connection', () => context.gateway.closed.should.equal(1));
    it('should not release', () => context.gateway.releases.length.should.equal(0));
    it('should not add a notification', () => context.notifications.length.should.equal(0));
}));
