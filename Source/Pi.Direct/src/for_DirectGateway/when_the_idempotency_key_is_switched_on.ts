// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_gateway } from './given/a_gateway.ts';

describe('when the idempotency key is switched on', given(a_gateway, context => {
    beforeEach(async () => {
        context.options = { sendIdempotencyKey: true, newIdempotencyKey: () => 'key-1' };
        await context.create().claim(context.request);
    });

    it('should send the key', () => context.calls[0].args.idempotencyKey!.should.equal('key-1'));
}));
