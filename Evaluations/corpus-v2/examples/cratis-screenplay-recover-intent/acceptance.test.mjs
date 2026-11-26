import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const {source,scope,frames,candidate} = JSON.parse(readFileSync('observations.json','utf8'));
test('positive evidence stops at the visible list', () => {
    assert.ok(source && scope);
    const seen = candidate.find(c => c.path === 'positive');
    const [input,output] = seen.evidence.map(id => frames.find(f => f.frame === id));
    assert.equal(input.action,'submit');
    assert.deepEqual(output.names,[input.name]);
    assert.equal(seen.status,'observed');
});
test('no blank input or event trace was captured', () => {
    assert.ok(!frames.some(f => f.name === '' || f.eventSourceId));
    for (const [path,status] of [['blank','unresolved'],['write','inference']]) {
        const item = candidate.find(c => c.path === path);
        assert.equal(item.status,status);
        assert.deepEqual(item.evidence,[]);
        assert.ok(item.owner && item.next);
    }
});
