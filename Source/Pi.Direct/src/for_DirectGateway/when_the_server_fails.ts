// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { sentinelProof, thrownBy } from '../for_Support/given/Fakes.ts';
import { a_gateway } from './given/a_gateway.ts';

describe('when the server fails', given(a_gateway, context => {
    let error: unknown;

    beforeEach(async () => {
        context.fails = true;
        error = await thrownBy(() => context.create().claim(context.request));
    });

    it('should refuse generically', () => (error as SessionRefused).code.should.equal('refused'));
    it('should not repeat the server text', () => (error as Error).message.should.not.contain(sentinelProof));
}));
