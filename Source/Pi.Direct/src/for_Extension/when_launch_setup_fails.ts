// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

for (const failure of ['missing token', 'invalid environment'] as const) {
    describe(`when Direct launch setup fails with ${failure}`, given(an_extension, context => {
        let shell: unknown;
        let read: unknown;
        beforeEach(async () => {
            context.launchWith();
            if (failure === 'missing token') context.runner.results.clear();
            else delete context.env.DIRECT_TENANT_ID;
            context.install();
            await context.pi.emit('session_start');
            shell = context.pi.emit('tool_call', { toolName: 'bash' });
            read = context.pi.emit('tool_call', { toolName: 'read' });
        });
        afterEach(() => context.dispose());
        it('should block shell work', () => (shell as { block: boolean }).block.should.equal(true));
        it('should allow read-only inspection', () => (read === undefined).should.equal(true));
        it('should never send a claim', () => context.gateway.claims.length.should.equal(0));
        it('should not register finish', () => context.pi.tools.length.should.equal(0));
    }));
}
