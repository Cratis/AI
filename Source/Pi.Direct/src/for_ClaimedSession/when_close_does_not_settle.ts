// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_claimed_session } from './given/a_claimed_session.ts';

describe('when refused confirmation close does not settle', given(a_claimed_session, context => {
    let error: unknown;
    beforeEach(async () => {
        context.gateway.heartbeatFails = true;
        context.gateway.closePending = new Promise(() => undefined);
        const launch = thrownBy(() => context.launch());
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(5_000);
        error = await launch;
    });
    it('should refuse within the cleanup bound', () => (error as SessionRefused).code.should.equal('refused'));
    it('should keep authority lost', () => context.guard.state.should.equal('lost'));
    it('should not release refused authority', () => context.gateway.releases.length.should.equal(0));
    it('should leave no timers', () => context.clock.timers.size.should.equal(0));
}));

describe('when finishing close does not settle', given(a_claimed_session, context => {
    let finished: boolean;
    beforeEach(async () => {
        finished = false;
        await context.claim();
        context.gateway.closePending = new Promise(() => undefined);
        const finish = context.session.finish('Delivered').then(() => { finished = true; });
        await new Promise(resolve => setImmediate(resolve));
        await context.clock.advance(5_000);
        await finish;
    });
    it('should finish within the cleanup bound', () => finished.should.equal(true));
    it('should keep released authority', () => context.guard.state.should.equal('released'));
    it('should leave no timers', () => context.clock.timers.size.should.equal(0));
    it('should not renew authority', () => context.gateway.heartbeats.length.should.equal(1));
}));
