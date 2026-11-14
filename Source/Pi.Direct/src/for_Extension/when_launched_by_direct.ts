// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { sentinelProof, sentinelToken } from '../for_Support/given/Fakes.ts';
import { an_extension } from './given/an_extension.ts';

describe('when launched by direct', given(an_extension, context => {
    let first: unknown;
    let second: unknown;
    let result: { content: Array<{ text: string }> };
    const logs: unknown[][] = [];
    const spies = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const originals = spies.map(name => console[name]);

    beforeEach(async () => {
        spies.forEach(name => { console[name] = (...args: unknown[]) => { logs.push(args); }; });
        context.launchWith();
        context.install();
        await context.pi.emit('session_start');
        first = context.pi.emit('before_agent_start');
        second = context.pi.emit('before_agent_start');
        result = await context.pi.tools[0].execute('call-1', { outcome: 'Delivered' });
    });
    afterEach(() => {
        spies.forEach((name, index) => { console[name] = originals[index] as never; });
        context.dispose();
    });

    it('should claim once', () => context.gateway.claims.length.should.equal(1));
    it('should register the finish tool', () => context.pi.tools[0].name.should.equal('direct_session_finish'));
    it('should announce the work once', () => JSON.stringify(first).should.contain('Fix the thing'));
    it('should not announce it again', () => (second === undefined).should.equal(true));
    it('should release when finished', () => context.gateway.releases[0].outcome.should.equal('Delivered'));
    it('should answer the tool with a fixed message', () => result.content[0].text.should.equal('Released as Delivered.'));
    it('should leak neither secret into anything shown', () => {
        const shown = JSON.stringify([context.pi.notifications, first, result, logs]);
        shown.should.not.contain(sentinelProof);
        shown.should.not.contain(sentinelToken);
    });
}));
