// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { LeaseDeadline } from '../LeaseDeadline.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeClock } from '../for_Support/given/Fakes.ts';

for (const change of ['rollback', 'suspend', 'forward jump'] as const) {
    describe(`when measuring a lease across a clock ${change}`, () => {
        let deadline: LeaseDeadline;
        beforeEach(async () => {
            const clock = new FakeClock();
            deadline = LeaseDeadline.start(clock, 30);
            if (change === 'rollback') {
                clock.setWallTime(-60_000);
                await clock.advance(30_000);
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
