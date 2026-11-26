import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const timeline = JSON.parse(await readFile(new URL('timeline.json', import.meta.url)));
test('the single visible row can be reconstructed from the accepted fact', () => {
    const { actor, intent, accepted } = timeline;
    assert.equal(actor, 'catalog editor');
    assert.equal(intent.type, 'RegisterAuthor');
    assert.deepEqual(accepted.facts, [{ type: 'AuthorRegistered', source: intent.id, name: intent.name }]);
    assert.deepEqual(accepted.rows, accepted.facts.map(({ source, name }) => ({ id: source, name })));
});
test('refusal has no fact and does not add a row', () => {
    assert.deepEqual(timeline.refused, { input: '', errorMember: 'Name', facts: [], rows: [] });
});
