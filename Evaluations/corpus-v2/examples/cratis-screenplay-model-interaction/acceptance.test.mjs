import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const {contract, screens} = JSON.parse(readFileSync('screens.json', 'utf8'));
const authors = screens.find(s => s.name === 'Authors');
const add = screens.find(s => s.name === 'AddAuthor');

test('list opens input; submit binds the real command before returning', () => {
    assert.equal(contract, 'screenplay-ui/1');
    const binding = authors.data.find(d => d.query === 'AllAuthors');
    assert.equal(binding.readModel, 'Author');
    assert.ok(binding.many && binding.queryId);
    assert.ok(authors.navigation.some(n => n.screen === 'AddAuthor' && n.trigger === 'click'));
    const action = add.actions.find(a => a.command === 'RegisterAuthor');
    assert.ok(action.commandId);
    assert.equal(action.subject, 'screen');
    assert.equal(action.then, 'Authors');
    assert.ok(action.inputs.some(i => i.name === 'name' && i.type === 'String'));
});

test('authored Add availability excludes a performer outside CatalogEditors', () => {
    // screenplay-ui/1 omits the audience predicate. Check the source, not a guessed JSON field.
    const source = readFileSync('model/screens.play', 'utf8');
    const gate = /action RegisterAuthor for screen\n +label "Add"\n +available for (\w+)/.exec(source)?.[1];
    assert.equal(gate, 'CatalogEditors');
    assert.ok(source.includes(`persona CatalogEditor\n  audience ${gate}`));
    assert.equal(new Set(['Readers']).has(gate), false);
});
