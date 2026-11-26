import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

function check(before, after, run) {
    const compilation = run([after]);
    const scenarios = JSON.parse(run(['test', after, '--format', 'json']));
    if (!(scenarios.discovered > 0 && scenarios.discovered === scenarios.executed && scenarios.executed === scenarios.passed)) {
        throw new Error('Not every discovered scenario executed and passed. Inspect screenplay test output.');
    }
    const diff = JSON.parse(run(['diff', before, after, '--format', 'json']));
    if (!diff.difference) throw new Error('Semantic diff did not report a difference object.');
    return { compilation, scenarios, diff };
}

try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--self-test') {
        const run = ([cmd]) => JSON.stringify(cmd === 'diff' ? { difference: {} } : { discovered: 1, executed: 1, passed: 1 });
        assert.equal(check('before', 'after', run).scenarios.passed, 1);
        assert.throws(() => check('before', 'after', () => '{}'), /scenario/);
    } else {
        if (args.length !== 2) throw new Error('Usage: check-model.mjs <baseline-directory> <candidate-directory>');
        console.log(JSON.stringify(check(...args, argv => execFileSync('screenplay', argv, { encoding: 'utf8' }))));
    }
} catch (error) {
    console.error(error.stdout || error.message);
    process.exitCode = error.status || 1;
}
