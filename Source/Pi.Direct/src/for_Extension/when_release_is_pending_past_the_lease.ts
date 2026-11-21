// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { an_extension } from './given/an_extension.ts';

for (const toolWhilePending of [true, false]) {
    describe(`when release is pending past the lease ${toolWhilePending ? 'with' : 'without'} an intervening tool call`, given(an_extension, context => {
        let atExpiry: unknown;
        let afterAnswer: unknown;
        let error: unknown;
        beforeEach(async () => {
            context.launchWith();
            context.install();
            await context.pi.emit('session_start');
            let answer!: () => void;
            context.gateway.releasePending = new Promise<void>(resolve => { answer = resolve; });
            const finishing = thrownBy(() => context.pi.tools[0].execute('call-1', { outcome: 'Delivered' }));
            await context.clock.advance(30_000);
            if (toolWhilePending) atExpiry = context.pi.emit('tool_call', { toolName: 'bash' });
            answer();
            error = await finishing;
            afterAnswer = context.pi.emit('tool_call', { toolName: 'bash' });
        });
        afterEach(() => context.dispose());
        if (toolWhilePending) it('should block shell work at expiry', () => (atExpiry as { block: boolean }).block.should.equal(true));
        it('should not reopen shell work after the answer', () => (afterAnswer as { block: boolean }).block.should.equal(true));
        it('should surface authority loss from finish', () => (error as SessionRefused).code.should.equal('authority-lost'));
        it('should send release only once', () => context.gateway.releases.length.should.equal(1));
        it('should leave no timeouts', () => context.clock.timers.size.should.equal(0));
        it('should leave no intervals', () => context.clock.intervals.size.should.equal(0));
        it('should close once', () => context.gateway.closed.should.equal(1));
    }));
}
