import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const {screens} = JSON.parse(readFileSync('screens.json', 'utf8'));
const authors = screens.find(s => s.name === 'Authors');
const add = screens.find(s => s.name === 'AddAuthor');

test('the Library list observes AllAuthors and opens Add author', () => {
    const binding = authors.data.find(d => d.query === 'AllAuthors');
    assert.equal(binding.readModel, 'Author');
    assert.ok(binding.live && binding.many && binding.queryId);
    assert.equal(authors.title, 'Authors');
    assert.ok(authors.navigation.some(n => n.screen === 'AddAuthor' && n.trigger === 'toolbar'));
    assert.match(readFileSync('model/Authors/screens.play','utf8'), /form AddAuthorForm for RegisterAuthor\s+field name label "Name"/);
});

test('the Add action submits RegisterAuthor before returning to Authors', () => {
    const action = add.actions.find(a => a.command === 'RegisterAuthor');
    assert.ok(action.commandId);
    assert.equal(action.subject, 'screen');
    assert.equal(action.then, 'Authors');
    assert.ok(action.inputs.some(i => i.name === 'name' && i.type === 'String'));
});
