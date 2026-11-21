// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

for (const request of ['claim', 'confirmation', 'renewal'] as const) {
    for (const change of ['rollback', 'suspend'] as const) {
        describe(`when clocks ${change} during a pending ${request}`, given(a_claimed_session, context => {
            beforeEach(async () => {
                if (request === 'renewal') await context.claim();
                let answer!: () => void;
                const response = new Promise<void>(resolve => { answer = resolve; });
                if (request === 'claim') context.gateway.claimPending = response;
                else context.gateway.heartbeatPending = response;
                let launch: Promise<unknown> | undefined;
                if (request === 'renewal') await context.clock.advance(10_000);
                else launch = thrownBy(() => context.claim());
                await new Promise(resolve => setImmediate(resolve));
                if (change === 'suspend') context.clock.suspend(31_000);
                else {
                    context.clock.setWallTime(-60_000);
                    await context.clock.advance(1_000);
                }
                answer();
                await launch;
                await new Promise(resolve => setImmediate(resolve));
            });
            it('should not open or revive authority', () => context.guard.state.should.equal('lost'));
            it('should block shell work', () => context.guard.blocks('bash').should.equal(true));
            it('should leave no timers', () => context.clock.timers.size.should.equal(0));
            it('should not release expired authority', () => context.gateway.releases.length.should.equal(0));
        }));
    }
}
