// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { leaseMilliseconds, parseHeartbeatResult, parseWorkClaimed } from '../DirectContract.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeGateway } from '../for_Support/given/Fakes.ts';

for (const seconds of [NaN, Infinity, 0, -1, 1e308, 86_401, 0.0001]) {
    describe(`when parsing an invalid timing grant of ${seconds} seconds`, () => {
        it('should refuse the claim lease', () => (() => parseWorkClaimed({ ...new FakeGateway().claimed, leaseSeconds: seconds })).should.throw(SessionRefused));
        it('should refuse the heartbeat lease', () => (() => parseHeartbeatResult({ epoch: 1, leaseSeconds: seconds })).should.throw(SessionRefused));
        it('should refuse the heartbeat interval', () => (() => parseWorkClaimed({ ...new FakeGateway().claimed, heartbeatSeconds: seconds })).should.throw(SessionRefused));
    });
}
for (const seconds of [30, 31, 2_147_484]) {
    describe(`when parsing a heartbeat interval of ${seconds} seconds that cannot renew`, () => {
        it('should refuse the claim', () => (() => parseWorkClaimed({ ...new FakeGateway().claimed, heartbeatSeconds: seconds })).should.throw(SessionRefused));
    });
}

describe('when parsing valid timing grants', () => {
    it('should accept the maximum lease', () => parseHeartbeatResult({ epoch: 1, leaseSeconds: 86_400 }).leaseSeconds.should.equal(86_400));
    it('should accept an interval shorter than the lease', () => parseWorkClaimed(new FakeGateway().claimed).heartbeatSeconds.should.equal(10));
});

describe('when parsing fractional-second grants', () => {
    it('should round milliseconds without floating-point refusal', () => leaseMilliseconds(2.3).should.equal(2_300));
    it('should accept a fractional heartbeat lease', () => parseHeartbeatResult({ epoch: 1, leaseSeconds: 2.3 }).leaseSeconds.should.equal(2.3));
    it('should accept a fractional claim lease', () => parseWorkClaimed({ ...new FakeGateway().claimed, leaseSeconds: 2.3, heartbeatSeconds: 1 }).leaseSeconds.should.equal(2.3));
    it('should accept a fractional interval', () => parseWorkClaimed({ ...new FakeGateway().claimed, heartbeatSeconds: 2.3 }).heartbeatSeconds.should.equal(2.3));
});
