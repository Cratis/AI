import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const model = path => JSON.parse(execFileSync('screenplay', ['export', path], {encoding:'utf8'}));
test('a sibling edit invalidates the reviewed model revision', t => {
    const root = mkdtempSync(join(tmpdir(), 'authors-split-'));
    t.after(() => rmSync(root, {recursive:true, force:true}));
    const copy = join(root, 'model');
    cpSync('model', copy, {recursive:true});
    const before = model(copy);
    assert.ok(before.application.eventSources.some(source => source.name === 'AuthorHistory'));
    const file = join(copy, 'identity.play');
    writeFileSync(file, readFileSync(file, 'utf8').replace('AuthorHistory', 'RegistrationHistory'));
    execFileSync('screenplay', [copy]);
    const after = model(copy);
    assert.notEqual(after.revision, before.revision);
    assert.deepEqual(before.application.modules, after.application.modules);
});
