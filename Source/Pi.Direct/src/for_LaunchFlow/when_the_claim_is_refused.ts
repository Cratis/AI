// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { sentinelProof, thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when the claim is refused', given(a_launch, context => {
    let error: unknown;

    beforeEach(async () => {
        context.gateway.claimFails = true;
        error = await thrownBy(() => context.launch());
    });

    it('should refuse generically', () => (error as SessionRefused).code.should.equal('refused'));
    it('should not repeat the server text', () => (error as Error).message.should.not.contain(sentinelProof));
    it('should claim only once', () => context.gateway.claims.length.should.equal(1));
    it('should keep the guard closed', () => context.guard.blocks('direct_session_finish').should.equal(true));
    it('should not heartbeat', () => context.gateway.heartbeats.length.should.equal(0));
    it('should start no timers', () => context.clock.timers.size.should.equal(0));
    it('should close the connection', () => context.gateway.closed.should.equal(1));
}));
