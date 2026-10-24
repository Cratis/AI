// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import type { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import type { CorpusServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/CorpusServer.ts';
import { childEnvironment, startServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/process.ts';
import { fakeChild } from './pi-mcp-helpers.ts';

const server: CorpusServer = {
    id: 'playwright', command: 'npx', args: ['--yes', '@playwright/mcp@0.0.68'], env: { MCP_TEST_SETTING: 'literal value' },
};
const entryPoint = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');

for (const command of ['npx', 'npx.cmd', 'NPX.CMD']) {
    test(`when launching ${command} on Windows it should use Node and npm's entry point without a shell`, t => {
        const child = fakeChild();
        let invocation: unknown[] = [];
        const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
        const checked: string[] = [];

        const connection = startServer('/physical/project with spaces', { ...server, command }, launch, 'win32', path => {
            checked.push(path);
            return true;
        });
        t.after(() => connection.dispose());

        assert.deepEqual(checked, [entryPoint]);
        assert.deepEqual(invocation, [process.execPath, [entryPoint, ...server.args], {
            cwd: '/physical/project with spaces', env: { ...childEnvironment(), ...server.env },
            shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        }]);
    });
}

test('when the Windows npx entry point is missing it should fail clearly before spawning', () => {
    let launches = 0;
    const launch = (() => { launches++; return fakeChild().child; }) as unknown as typeof spawn;
    assert.throws(() => startServer('/project', server, launch, 'win32', () => false), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("MCP server 'playwright'"));
        assert.ok(error.message.includes(entryPoint));
        assert.match(error.message, /Install Node\.js with npm/);
        return true;
    });
    assert.equal(launches, 0);
});

for (const platform of ['darwin', 'linux'] as const) {
    test(`when launching npx on ${platform} it should preserve the original command and arguments`, t => {
        const child = fakeChild();
        let invocation: unknown[] = [];
        const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
        const connection = startServer('/project', server, launch, platform, () => assert.fail('must not resolve npx on other platforms'));
        t.after(() => connection.dispose());

        assert.deepEqual(invocation, ['npx', server.args, {
            cwd: '/project', env: { ...childEnvironment(), ...server.env },
            shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        }]);
        assert.equal(invocation[1], server.args);
    });
}

test('when launching a native server on Windows it should leave the invocation untouched', t => {
    const child = fakeChild();
    let invocation: unknown[] = [];
    const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
    const connection = startServer('/project', { ...server, command: 'cratis' }, launch, 'win32', () => assert.fail('must not resolve native servers'));
    t.after(() => connection.dispose());

    assert.equal(invocation[0], 'cratis');
    assert.equal(invocation[1], server.args);
    assert.equal((invocation[2] as { shell: boolean }).shell, false);
});

test('when launching Windows npx with shell metacharacters it should pass literal array arguments unchanged', t => {
    const child = fakeChild();
    let invocation: unknown[] = [];
    const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
    const args = ['--yes', '@playwright/mcp@0.0.68', 'path with spaces', '& echo unexpected', '$(unexpected)', '"quoted"', '%PATH%', 'a|b', '^'];
    const connection = startServer('/project', { ...server, args }, launch, 'win32', () => true);
    t.after(() => connection.dispose());

    assert.deepEqual(invocation[1], [entryPoint, ...args]);
    assert.deepEqual(args, ['--yes', '@playwright/mcp@0.0.68', 'path with spaces', '& echo unexpected', '$(unexpected)', '"quoted"', '%PATH%', 'a|b', '^']);
    assert.equal((invocation[2] as { shell: boolean }).shell, false);
});
