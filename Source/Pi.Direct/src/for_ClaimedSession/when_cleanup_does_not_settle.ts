// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

for (const operation of ['release', 'close'] as const) {
    describe(`when failed confirmation cleanup ${operation} does not settle`, given(a_claimed_session, context => {
        let rejected: boolean;
        beforeEach(async () => {
            rejected = false;
            context.gateway.heartbeatFails = true;
            context.gateway[operation] = () => new Promise(() => undefined);
            const launch = context.launch().catch(() => { rejected = true; });
            await new Promise(resolve => setImmediate(resolve));
            await context.clock.advance(5_000);
            await launch;
        });
        it('should reject the claim within the cleanup bound', () => rejected.should.equal(true));
        it('should keep authority lost', () => context.guard.state.should.equal('lost'));
        it('should leave no timers', () => context.clock.timers.size.should.equal(0));
        it('should not renew authority', () => context.gateway.heartbeats.length.should.equal(1));
    }));
}

for (const operation of ['release', 'close'] as const) {
    describe(`when shutdown cleanup ${operation} does not settle`, given(a_claimed_session, context => {
        let resolved: boolean;
        beforeEach(async () => {
            resolved = false;
            await context.claim();
            context.gateway[operation] = () => new Promise(() => undefined);
            const shutdown = context.session.shutdown().then(() => { resolved = true; });
            await new Promise(resolve => setImmediate(resolve));
            await context.clock.advance(5_000);
            await shutdown;
        });
        it('should finish shutdown within the cleanup bound', () => resolved.should.equal(true));
        it('should leave no timers', () => context.clock.timers.size.should.equal(0));
        it('should not leave live authority', () => (context.guard.state === 'open').should.equal(false));
        it('should not renew authority', () => context.gateway.heartbeats.length.should.equal(1));
    }));
}
