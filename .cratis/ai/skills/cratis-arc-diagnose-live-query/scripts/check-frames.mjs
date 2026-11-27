import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';

async function capture(lines, report) {
    let parts = [], count = 0;
    for await (const line of lines) {
        if (line.startsWith('data:')) parts.push(line.slice(5).trimStart());
        if (line !== '' || !parts.length) continue;
        let frame;
        try { frame = JSON.parse(parts.join('\n')); } catch { throw Error('Non-JSON SSE data frame'); }
        parts = [];
        if (frame?.isReady === false) continue;
        if (frame?.isSuccess !== true) throw Error('Received an unsuccessful query frame');
        report(++count);
        if (count === 2) return;
    }
    throw Error(`Stream ended after ${count} ready result(s); expected baseline and update`);
}
try {
    if (process.argv[2] === '--self-test') {
        const frame = ['data: {"isSuccess":true}', ''];
        const seen = [];
        await capture(['data: {"isReady":false,"isSuccess":false}', '', ...frame, ...frame], n => seen.push(n));
        assert.deepEqual(seen, [1, 2]);
        await assert.rejects(capture(frame, () => {}), /Stream ended/);
    } else {
        await capture(createInterface({input:process.stdin, crlfDelay:Infinity}), n => console.log(`Ready result ${n}`));
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }
