// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

const restrictedTools = ['bash', 'powershell', 'edit', 'write', 'some_mcp_tool', 'direct_session_finish'];
const readOnlyTools = ['read', 'grep', 'find', 'ls'];

for (const pending of ['claim', 'confirmation'] as const) {
    for (const outcome of ['granted', 'refused'] as const) {
        describe(`when tools run during a pending ${pending} that is ${outcome}`, given(an_extension, context => {
            let whilePending: Record<string, unknown>;

            beforeEach(async () => {
                let answer!: () => void;
                const response = new Promise<void>(resolve => { answer = resolve; });
                if (pending === 'claim') {
                    context.gateway.claimPending = response;
                    context.gateway.claimFails = outcome === 'refused';
                } else {
                    context.gateway.heartbeatPending = response;
                    context.gateway.heartbeatFails = outcome === 'refused';
                }
                context.launchWith();
                context.install();
                const starting = context.pi.emit('session_start');
                await new Promise(resolve => setImmediate(resolve));
                whilePending = Object.fromEntries([...restrictedTools, ...readOnlyTools].map(tool => [tool, context.pi.emit('tool_call', { toolName: tool })]));
                answer();
                await starting;
            });
            afterEach(() => context.dispose());

            for (const tool of restrictedTools) {
                it(`should block ${tool} while pending`, () => (whilePending[tool] as { block: boolean }).block.should.equal(true));
                it(`should ${outcome === 'granted' ? 'allow' : 'block'} ${tool} after the response`, () => ((context.pi.emit('tool_call', { toolName: tool }) as { block: boolean } | undefined)?.block === true).should.equal(outcome === 'refused'));
            }
            for (const tool of readOnlyTools) {
                it(`should allow ${tool} while pending`, () => (whilePending[tool] === undefined).should.equal(true));
                it(`should allow ${tool} after the response`, () => (context.pi.emit('tool_call', { toolName: tool }) === undefined).should.equal(true));
            }
            it('should only register finish after confirmation', () => context.pi.tools.length.should.equal(outcome === 'granted' ? 1 : 0));
        }));
    }
}
