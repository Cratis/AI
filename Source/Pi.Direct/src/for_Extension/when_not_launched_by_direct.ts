// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

describe('when not launched by direct', given(an_extension, context => {
    beforeEach(async () => {
        context.install();
        await context.pi.emit('session_start');
    });
    afterEach(() => context.dispose());

    it('should not claim', () => context.gateway.claims.length.should.equal(0));
    it('should not register the finish tool', () => context.pi.tools.length.should.equal(0));
    it('should not announce work', () => (context.pi.emit('before_agent_start') === undefined).should.equal(true));
    it('should start no timers', () => context.clock.timers.size.should.equal(0));
}));
