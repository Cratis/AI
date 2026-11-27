import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Python contract consumer', () => {
    const run = spawnSync('python3', ['-m', 'unittest', 'test_contract'], { cwd: import.meta.dirname, encoding: 'utf8' });
    if (run.error) throw run.error;
    assert.equal(run.status, 0, run.stderr);
});
