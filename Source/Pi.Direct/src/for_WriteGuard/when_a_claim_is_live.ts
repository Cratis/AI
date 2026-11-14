// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { WriteGuard } from '../WriteGuard.ts';

class context {
    readonly guard = new WriteGuard(new Set(['write']));
}

describe('when a claim is live', given(context, context => {
    it('should block before the claim', () => context.guard.blocks('write').should.equal(true));

    it('should allow after the claim', () => {
        context.guard.open();
        context.guard.blocks('write').should.equal(false);
    });
}));
