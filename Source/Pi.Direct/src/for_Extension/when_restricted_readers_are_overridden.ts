// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { given } from '../given.ts';
import { readArguments } from '../for_Support/given/ReadArguments.ts';
import { an_extension } from './given/an_extension.ts';

for (const state of ['pending', 'lost'] as const) {
    for (const tool of ['read', 'grep', 'find', 'ls']) {
        describe(`when ${tool} is overridden with ${state} authority`, given(an_extension, context => {
            let builtin: unknown;
            let outside: unknown;
            let malformed: unknown;
            let overridden: unknown;
            let configured: unknown;
            beforeEach(async () => {
                vi.stubEnv('RIPGREP_CONFIG_PATH', undefined);
                context.launchWith();
                context.pi.context.cwd = join(context.folder, 'workspace');
                mkdirSync(context.pi.context.cwd);
                let complete = (): void => {};
                if (state === 'pending') context.gateway.claimPending = new Promise<void>(resolve => { complete = resolve; });
                else context.gateway.claimFails = true;
                context.install();
                const starting = context.pi.emit('session_start');
                await new Promise(resolve => setImmediate(resolve));
                const input = readArguments(tool);
                builtin = context.pi.emit('tool_call', { toolName: tool, input });
                outside = context.pi.emit('tool_call', { toolName: tool, input: { ...input, path: dirname(context.pi.context.cwd) } });
                malformed = context.pi.emit('tool_call', { toolName: tool, input: undefined });
                vi.stubEnv('RIPGREP_CONFIG_PATH', '/external/ripgrep.conf');
                configured = context.pi.emit('tool_call', { toolName: tool, input });
                vi.stubEnv('RIPGREP_CONFIG_PATH', undefined);
                context.pi.toolDefinitions.find(candidate => candidate.name === tool)!.sourceInfo.source = 'extension';
                overridden = context.pi.emit('tool_call', { toolName: tool, input });
                complete();
                await starting;
            });
            afterEach(() => { vi.unstubAllEnvs(); context.dispose(); });

            it('should allow the built-in within the workspace', () => (builtin === undefined).should.equal(true));
            it('should block an outside path', () => (outside as { block: boolean }).block.should.equal(true));
            it('should block malformed arguments', () => (malformed as { block: boolean }).block.should.equal(true));
            it('should block the same-named extension tool', () => (overridden as { block: boolean }).block.should.equal(true));
            it('should deny only grep when external rg configuration is inherited', () => ((configured as { block: boolean } | undefined)?.block === true).should.equal(tool === 'grep'));
        }));
    }
}

for (const state of ['unlaunched', 'open', 'released'] as const) {
    describe(`when read provenance is unavailable in an ${state} session`, given(an_extension, context => {
        let result: unknown;
        let grep: unknown;
        beforeEach(async () => {
            vi.stubEnv('RIPGREP_CONFIG_PATH', '/external/ripgrep.conf');
            if (state !== 'unlaunched') context.launchWith();
            context.install();
            await context.pi.emit('session_start');
            if (state === 'released') await context.pi.tools[0].execute('finish', { outcome: 'Delivered' });
            context.pi.api.getAllTools = () => { throw new Error('must not inspect unrestricted tools'); };
            result = context.pi.emit('tool_call', { toolName: 'read', input: { path: '/' } });
            grep = context.pi.emit('tool_call', { toolName: 'grep', input: { pattern: '.' } });
        });
        afterEach(() => { vi.unstubAllEnvs(); context.dispose(); });
        it('should leave personal and authorized work unaffected', () => (result === undefined).should.equal(true));
        it('should leave configured grep unaffected', () => (grep === undefined).should.equal(true));
    }));
}
