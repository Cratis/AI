// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { sentinelProof } from '../for_Support/given/Fakes.ts';
import { a_gateway } from './given/a_gateway.ts';

describe('when claiming', given(a_gateway, context => {
    let result: Awaited<ReturnType<ReturnType<a_gateway['create']>['claim']>>;

    beforeEach(async () => { result = await context.create().claim(context.request); });

    it('should call the claim tool', () => context.calls[0].name.should.equal('direct_work_claim'));
    it('should send camel case arguments with the proof as read', () => context.calls[0].args.should.deep.equal({
        workHandle: 'work-1', session: 'session-1', harness: 'pi', launchProof: sentinelProof
    }));
    it('should not send an idempotency key by default', () => context.calls[0].args.should.not.have.property('idempotencyKey'));
    it('should parse the claim', () => result.claimId.should.equal('claim-1'));
}));
