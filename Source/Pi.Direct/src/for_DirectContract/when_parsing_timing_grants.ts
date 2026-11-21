// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { parseHeartbeatResult, parseWorkClaimed } from '../DirectContract.ts';
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
