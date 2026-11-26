import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
const run = (...args) => JSON.parse(execFileSync('screenplay', args, {encoding:'utf8'}));

test('a changed rejection is not covered by the previous review', t => {
    const base = run('export','model','--scope','Library.Authors');
    const names = base.application.modules[0].features[0].slices.flatMap(s => s.specifications.map(x => x.name));
    assert.deepEqual(names.sort(), ['ListingAster','RegisteringAster','RejectingAnEmptyName']);
    const temp = mkdtempSync(join(tmpdir(),'authors-admission-'));
    t.after(() => rmSync(temp,{recursive:true,force:true}));
    const next = join(temp,'model');
    cpSync('model',next,{recursive:true});
    const path = join(next,'authors.play');
    writeFileSync(path,readFileSync(path,'utf8').replaceAll('Name is required','Missing label'));
    execFileSync('screenplay',['model']);
    execFileSync('screenplay',[next]);
    run('test',next,'--format','json');
    const changed = run('export',next,'--scope','Library.Authors');
    assert.notEqual(changed.revision,base.revision);
    const {difference} = run('diff','model',next,'--format','json');
    assert.ok(JSON.stringify(difference).includes('RejectingAnEmptyName'));
    const reviewed = new Set([base.revision]);
    assert.equal(reviewed.has(changed.revision), false);
});
