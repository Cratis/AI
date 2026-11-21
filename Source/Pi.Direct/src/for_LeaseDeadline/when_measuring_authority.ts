// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { LeaseDeadline } from '../LeaseDeadline.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeClock } from '../for_Support/given/Fakes.ts';

for (const change of ['rollback', 'rollback and suspend', 'suspend', 'forward jump'] as const) {
    describe(`when measuring a lease across a clock ${change}`, () => {
        let deadline: LeaseDeadline;
        beforeEach(() => {
            const clock = new FakeClock();
            deadline = LeaseDeadline.start(clock, 30);
            if (change === 'rollback' || change === 'rollback and suspend') {
                clock.setWallTime(-60_000);
                if (change === 'rollback and suspend') clock.suspend(31_000);
            } else if (change === 'suspend') clock.suspend(30_000);
            else clock.setWallTime(30_000);
        });
        it('should expire authority', () => deadline.expired().should.equal(true));
        it('should report no remaining authority', () => deadline.remainingMs().should.equal(0));
    });
}
for (const seconds of [NaN, Infinity, 0, -1, 1e308, 86_401, 0.0001]) {
    describe(`when starting a lease with invalid duration ${seconds}`, () => {
        it('should refuse the grant', () => (() => LeaseDeadline.start(new FakeClock(), seconds)).should.throw(SessionRefused));
    });
}

describe('when applying a delayed response grant', () => {
    let deadline: LeaseDeadline;
    let remaining: number;
    beforeEach(async () => {
        const clock = new FakeClock();
        const sent = LeaseDeadline.start(clock, 30);
        await clock.advance(15_000);
        deadline = sent.withGrant(20);
        remaining = deadline.remainingMs();
        await clock.advance(5_000);
    });
    it('should retain the request send-time anchors', () => remaining.should.equal(5_000));
    it('should expire at the send-time deadline', () => deadline.expired().should.equal(true));
});

describe('when wall time rolls back after observed expiry', () => {
    let deadline: LeaseDeadline;
    beforeEach(() => {
        const clock = new FakeClock();
        deadline = LeaseDeadline.start(clock, 30);
        clock.setWallTime(30_000);
        deadline.expired();
        clock.setWallTime(0);
    });
    it('should never restore authority', () => deadline.expired().should.equal(true));
});

for (const jitter of [500, 999, 1000]) {
    describe(`when wall time moves backward by ${jitter} milliseconds`, () => {
        let deadline: LeaseDeadline;
        beforeEach(() => {
            const clock = new FakeClock();
            deadline = LeaseDeadline.start(clock, 30);
            clock.setWallTime(-jitter);
        });
        it('should tolerate the small backward jitter', () => deadline.expired().should.equal(false));
        it('should never add authority', () => deadline.remainingMs().should.equal(30_000));
    });
}

describe('when suspend is followed by tolerated jitter and monotonic progress', () => {
    let deadline: LeaseDeadline;
    let remaining: number;
    beforeEach(async () => {
        const clock = new FakeClock();
        deadline = LeaseDeadline.start(clock, 30);
        clock.suspend(15_000);
        deadline.remainingMs();
        clock.setWallTime(14_500);
        await clock.advance(14_500);
        remaining = deadline.remainingMs();
        await clock.advance(500);
    });
    it('should accumulate the larger step from each observation', () => remaining.should.equal(500));
    it('should expire without waiting for either absolute clock delta', () => deadline.expired().should.equal(true));
});

describe('when a grant follows observed rollback', () => {
    let deadline: LeaseDeadline;
    beforeEach(() => {
        const clock = new FakeClock();
        const sent = LeaseDeadline.start(clock, 30);
        clock.setWallTime(-60_000);
        sent.expired();
        clock.setWallTime(0);
        deadline = sent.withGrant(60);
    });
    it('should keep expiry terminal', () => deadline.expired().should.equal(true));
});
