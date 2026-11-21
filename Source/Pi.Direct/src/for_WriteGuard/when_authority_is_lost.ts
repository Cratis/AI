// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { WriteGuard } from '../WriteGuard.ts';

class context {
    readonly guard = new WriteGuard(new Set(['write']));
}

describe('when authority is lost', given(context, context => {
    beforeEach(() => {
        context.guard.open();
        context.guard.markLost();
        context.guard.acknowledge();
        context.guard.open();
    });

    it('should stay lost', () => context.guard.state.should.equal('lost'));
    it('should block guarded tools', () => context.guard.blocks('write').should.equal(true));
    it('should allow verified reads', () => context.guard.blocks('read', () => true).should.equal(false));
    it('should block unverified reads', () => context.guard.blocks('read').should.equal(true));
    it('should be opened again only by a new guard', () => {
        const fresh = new WriteGuard(new Set(['write']));
        fresh.open();
        fresh.state.should.equal('open');
    });
}));
