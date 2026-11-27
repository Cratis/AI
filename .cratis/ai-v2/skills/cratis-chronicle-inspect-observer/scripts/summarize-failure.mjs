import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const knownKinds = new Set(['Unknown', 'Handling', 'Timeout', 'Disconnected']);

function summarize(attempts) {
    if (!Array.isArray(attempts)) throw new Error('Expected a JSON array of attempts.');
    return attempts.map(attempt => {
        if (!Number.isSafeInteger(attempt?.sequenceNumber) || attempt.sequenceNumber < 0 || typeof attempt.kind !== 'string') {
            throw new Error('Each attempt needs a nonnegative safe integer sequenceNumber and a string kind.');
        }
        return { sequenceNumber: attempt.sequenceNumber, kind: knownKinds.has(attempt.kind) ? attempt.kind : 'Unknown' };
    });
}

async function load(path) {
    let input;
    try { input = await readFile(path, 'utf8'); } catch { throw new Error('Cannot read attempts file.'); }
    try { return JSON.parse(input); } catch { throw new Error('Attempts file is not valid JSON.'); }
}

try {
    const [path, ...extra] = process.argv.slice(2);
    if (!path || extra.length) throw new Error('Usage: node summarize-failure.mjs <attempts.json> | --self-test');
    if (path === '--self-test') {
        assert.deepEqual(summarize([{ sequenceNumber: 9, kind: 'Timeout', stack: 'private' }, { sequenceNumber: 10, kind: 'private' }]),
            [{ sequenceNumber: 9, kind: 'Timeout' }, { sequenceNumber: 10, kind: 'Unknown' }]);
        assert.throws(() => summarize([{ sequenceNumber: -1, kind: 'Handling' }]));
        console.log('Self-test passed.');
    } else {
        console.log(JSON.stringify(summarize(await load(path))));
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
