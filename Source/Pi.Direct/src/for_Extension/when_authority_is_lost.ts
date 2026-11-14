// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

describe('when authority is lost', given(an_extension, context => {
    let blocked: unknown;

    beforeEach(async () => {
        context.launchWith();
        context.install();
        await context.pi.emit('session_start');
        context.gateway.heartbeatFails = true;
        await context.clock.advance(10_000);
        blocked = context.pi.emit('tool_call', { toolName: 'direct_session_finish' });
    });
    afterEach(() => context.dispose());

    it('should block every registered direct tool', () => context.pi.tools.every(tool => (context.pi.emit('tool_call', { toolName: tool.name }) as { block: boolean }).block).should.equal(true));
    it('should register at least one direct tool', () => context.pi.tools.length.should.be.greaterThan(0));
    it('should block the finish tool', () => (blocked as { block: boolean }).block.should.equal(true));
    it('should tell the person once', () => context.pi.notifications.length.should.equal(1));
    it('should not block unrelated tools', () => (context.pi.emit('tool_call', { toolName: 'read' }) === undefined).should.equal(true));
}));
