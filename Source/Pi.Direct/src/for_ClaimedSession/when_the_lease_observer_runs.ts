// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when the observer sees rollback before a suspend', given(a_claimed_session, context => {
    let observedState: string;
    beforeEach(async () => {
        await context.claim();
        context.clock.setWallTime(-60_000);
        await context.clock.advance(1000);
        observedState = context.guard.state;
        context.clock.suspend(61_000);
    });
    it('should lose authority before any tool or status check', () => observedState.should.equal('lost'));
    it('should cover a final combined wall step that is forward', () => context.clock.now().should.equal(2000));
    it('should keep shell work blocked after suspend', () => context.guard.blocks('bash').should.equal(true));
    it('should stop the observer', () => context.clock.intervals.size.should.equal(0));
    it('should stop the heartbeat', () => context.clock.timers.size.should.equal(0));
}));

for (const terminal of ['release', 'shutdown'] as const) {
    describe(`when the lease observer stops after ${terminal}`, given(a_claimed_session, context => {
        let observersAfterOpening: number;
        let observersAfterEnding: number;
        beforeEach(async () => {
            await context.claim();
            observersAfterOpening = context.clock.intervals.size;
            if (terminal === 'release') await context.session.finish('Delivered');
            else await context.session.shutdown();
            observersAfterEnding = context.clock.intervals.size;
            await context.session.shutdown();
            await context.session.shutdown();
            await context.clock.advance(60_000);
        });
        it('should start one observer when authority opens', () => observersAfterOpening.should.equal(1));
        it('should stop the observer at the terminal transition', () => observersAfterEnding.should.equal(0));
        it('should leave no interval after repeated stop', () => context.clock.intervals.size.should.equal(0));
        it('should leave no timeout', () => context.clock.timers.size.should.equal(0));
        it('should not restart heartbeats', () => context.gateway.heartbeats.length.should.equal(1));
        it('should release at most once', () => context.gateway.releases.length.should.equal(1));
    }));
}
