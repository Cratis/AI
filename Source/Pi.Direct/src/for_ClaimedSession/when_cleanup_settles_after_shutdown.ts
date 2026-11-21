// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

for (const operation of ['release', 'close'] as const) {
    for (const settlement of ['resolve', 'reject'] as const) {
        describe(`when shutdown ${operation} cleanup ${settlement}s after its bound`, given(a_claimed_session, context => {
            beforeEach(async () => {
                await context.claim();
                let resolve!: () => void;
                let reject!: (error: Error) => void;
                context.gateway[`${operation}Pending`] = new Promise<void>((accept, refuse) => { resolve = accept; reject = refuse; });
                const shutdown = context.session.shutdown();
                await new Promise(done => setImmediate(done));
                await context.clock.advance(5_000);
                await shutdown;
                if (settlement === 'resolve') resolve();
                else reject(new Error('late cleanup failure'));
                await new Promise(done => setImmediate(done));
                await context.clock.advance(60_000);
                await context.session.shutdown();
            });
            it('should keep authority lost', () => context.guard.state.should.equal('lost'));
            it('should keep shell work blocked', () => context.guard.blocks('bash').should.equal(true));
            it('should leave no timers', () => context.clock.timers.size.should.equal(0));
            it('should not renew', () => context.gateway.heartbeats.length.should.equal(1));
            it('should abandon at most once', () => context.gateway.releases.map(release => release.outcome).should.deep.equal(['Abandoned']));
            it('should close once', () => context.gateway.closed.should.equal(1));
        }));
    }
}
