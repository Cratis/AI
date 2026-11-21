// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { an_extension } from './given/an_extension.ts';

const restrictedTools = ['write', 'edit', 'bash', 'powershell', 'some_mcp_tool', 'direct_session_finish'];
const readOnlyTools = ['read', 'grep', 'find', 'ls'];

for (const launched of [true, false]) {
    describe(`when ${launched ? 'Direct credentials are pending' : 'an unlaunched session starts'}`, given(an_extension, context => {
        let immediateTools: Record<string, unknown>;
        let pendingTools: Record<string, unknown>;
        let retrievingCredentials: boolean;
        let pendingClaims: number;

        beforeEach(async () => {
            retrievingCredentials = false;
            let answer!: () => void;
            const credentials = new Promise<void>(resolve => { answer = resolve; });
            if (launched) context.launchWith();
            context.install(async (command, args) => {
                retrievingCredentials = true;
                await credentials;
                return context.runner.run(command, args);
            });
            const starting = context.pi.emit('session_start');
            immediateTools = Object.fromEntries([...restrictedTools, ...readOnlyTools].map(tool => [tool, context.pi.emit('tool_call', { toolName: tool })]));
            await new Promise(resolve => setImmediate(resolve));
            pendingTools = Object.fromEntries([...restrictedTools, ...readOnlyTools].map(tool => [tool, context.pi.emit('tool_call', { toolName: tool })]));
            pendingClaims = context.gateway.claims.length;
            answer();
            await starting;
        });
        afterEach(() => context.dispose());

        for (const tool of restrictedTools) {
            const blockedWhilePending = launched || tool === 'direct_session_finish';
            const blockedAfterStartup = !launched && tool === 'direct_session_finish';
            it(`should ${blockedWhilePending ? 'block' : 'allow'} ${tool} immediately at session start`, () => ((immediateTools[tool] as { block: boolean } | undefined)?.block === true).should.equal(blockedWhilePending));
            it(`should ${blockedWhilePending ? 'block' : 'allow'} ${tool} during credential retrieval`, () => ((pendingTools[tool] as { block: boolean } | undefined)?.block === true).should.equal(blockedWhilePending));
            it(`should ${blockedAfterStartup ? 'block' : 'allow'} ${tool} after startup`, () => ((context.pi.emit('tool_call', { toolName: tool }) as { block: boolean } | undefined)?.block === true).should.equal(blockedAfterStartup));
        }
        for (const tool of readOnlyTools) {
            it(`should allow ${tool} immediately at session start`, () => (immediateTools[tool] === undefined).should.equal(true));
            it(`should allow ${tool} during credential retrieval`, () => (pendingTools[tool] === undefined).should.equal(true));
        }
        it('should retrieve credentials only for a Direct launch', () => retrievingCredentials.should.equal(launched));
        it('should not claim before credential retrieval completes', () => pendingClaims.should.equal(0));
        it('should register finish only after a confirmed Direct launch', () => context.pi.tools.length.should.equal(launched ? 1 : 0));
    }));
}
