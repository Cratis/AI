import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const timeline = await readFile(new URL('Features/Authors/Registration/timeline.md', import.meta.url), 'utf8');
test('registration, owner, visible result and unresolved rule are explicit', () => {
    assert.match(timeline,/librarian submits `RegisterAuthor`/);
    assert.match(timeline,/11111111-1111-4111-8111-111111111111/);
    assert.match(timeline,/`AuthorRegistered` records Aster on that author ID/);
    assert.match(timeline,/One row with the requested author ID and Aster/);
    assert.match(timeline,/`AuthorRegistered.Name`/);
    assert.match(timeline,/Confirm the blank-name refusal/);
});
