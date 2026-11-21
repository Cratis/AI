// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

for (const grant of ['too short', 'already expired'] as const) {
    describe(`when shutdown follows a ${grant} confirmation with epoch 99`, given(an_extension, context => {
        beforeEach(async () => {
            context.launchWith();
            let answer!: () => void;
            context.gateway.heartbeatPending = new Promise<void>(resolve => { answer = resolve; });
            context.gateway.heartbeatLeaseSeconds = grant === 'too short' ? 5 : 15;
            const heartbeat = context.gateway.heartbeat.bind(context.gateway);
            context.gateway.heartbeat = request => {
                const response = heartbeat(request).then(result => ({ ...result, epoch: 99 }));
                // Shutdown runs after confirmation validation, before claim's failure cleanup.
                void response.then(() => queueMicrotask(() => { void context.pi.emit('session_shutdown'); }));
                return response;
            };
            context.install();
            const starting = context.pi.emit('session_start');
            await new Promise(resolve => setImmediate(resolve));
            if (grant === 'already expired') await context.clock.advance(16_000);
            answer();
            await starting;
        });
        afterEach(() => context.dispose());

        it('should abandon only with the last valid epoch', () => context.gateway.releases.should.deep.equal([
            { workHandle: 'work-1', claimId: 'claim-1', epoch: 1, outcome: 'Abandoned' }
        ]));
        it('should not expose the finish tool', () => context.pi.tools.length.should.equal(0));
        it('should leave writes restricted', () => (context.pi.emit('tool_call', { toolName: 'write' }) as { block: boolean }).block.should.equal(true));
        it('should leave no heartbeat timer', () => context.clock.timers.size.should.equal(0));
        it('should leave no lease observer', () => context.clock.intervals.size.should.equal(0));
    }));
}
