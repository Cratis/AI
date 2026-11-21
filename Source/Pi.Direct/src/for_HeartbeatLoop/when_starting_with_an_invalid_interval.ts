// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { HeartbeatLoop } from '../HeartbeatLoop.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeClock } from '../for_Support/given/Fakes.ts';

for (const seconds of [NaN, Infinity, -Infinity, 0, -1, 2_147_483.648, Number.MAX_VALUE]) {
    describe(`when starting heartbeats with an invalid interval of ${seconds} seconds`, () => {
        let clock: FakeClock;
        let loop: HeartbeatLoop;
        let error: unknown;
        beforeEach(() => {
            error = undefined;
            clock = new FakeClock();
            loop = new HeartbeatLoop(clock, async () => undefined, () => undefined);
            try { loop.start(seconds); } catch (caught) { error = caught; }
        });
        it('should refuse the interval', () => (error as SessionRefused).code.should.equal('refused'));
        it('should not leave the loop running', () => loop.isRunning.should.equal(false));
        it('should not schedule a timer', () => clock.timers.size.should.equal(0));
    });
}

for (const seconds of [0.001, 1.0001, 1.0006, 2.3, 2_147_483]) {
    describe(`when starting heartbeats with a valid interval of ${seconds} seconds`, () => {
        let clock: FakeClock;
        let loop: HeartbeatLoop;
        beforeEach(() => {
            clock = new FakeClock();
            loop = new HeartbeatLoop(clock, async () => undefined, () => undefined);
            loop.start(seconds);
        });
        it('should run the loop', () => loop.isRunning.should.equal(true));
        it('should schedule one timer', () => clock.timers.size.should.equal(1));
        it('should schedule at the rounded millisecond interval', () => Array.from(clock.timers.values())[0].at.should.equal(Math.round(seconds * 1000)));
    });
}
