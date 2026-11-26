import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Go command pipeline returns the typed native response', async t => {
    const cwd = await mkdtemp(join(tmpdir(), 'native-reply-'));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    for (const name of ['command_test.go', 'go.mod']) await copyFile(new URL(name, import.meta.url), join(cwd, name));
    const run = spawnSync('go', ['test', '-mod=mod', '-count=1', '-json', '.'], {
        cwd, env: { ...process.env, GOWORK: 'off' }, encoding: 'utf8', timeout: 120000
    });
    if (run.error) throw run.error;
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.ok(run.stdout.trim().split('\n').map(line => JSON.parse(line)).some(event => event.Action === 'pass' && event.Test === 'TestNativeReply'));
});
