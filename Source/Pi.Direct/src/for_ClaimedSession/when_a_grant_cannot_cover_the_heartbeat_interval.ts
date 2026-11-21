// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

for (const grant of ['claim', 'confirmation'] as const) {
    for (const leaseSeconds of [10, 5]) {
        describe(`when the ${grant} grants ${leaseSeconds} seconds for a ten-second heartbeat interval`, given(a_launch, context => {
            let error: unknown;

            beforeEach(async () => {
                if (grant === 'claim') context.gateway.claimed = { ...context.gateway.claimed, leaseSeconds };
                else context.gateway.heartbeatLeaseSeconds = leaseSeconds;
                error = await thrownBy(() => context.launch());
            });

            it('should refuse the unusable grant', () => (error as SessionRefused).code.should.equal('refused'));
            it('should leave the guard lost', () => context.guard.state.should.equal('lost'));
            it('should block local writes', () => context.guard.blocks('write').should.equal(true));
            it('should allow local reads', () => context.guard.blocks('read').should.equal(false));
            it('should start no heartbeat timer', () => context.clock.timers.size.should.equal(0));
            it('should start no lease observer', () => context.clock.intervals.size.should.equal(0));
            it('should not release', () => context.gateway.releases.length.should.equal(0));
            it('should close the connection', () => context.gateway.closed.should.equal(1));
        }));
    }
}
