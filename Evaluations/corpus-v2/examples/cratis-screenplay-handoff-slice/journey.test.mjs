import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {verifyRegistration} from '../cratis-platform-deliver-slice/registration.mjs';

test('accepted registration reaches the authorized isolated target', {timeout:90000}, async t => {
    const accepted = JSON.parse(readFileSync('accepted.esm.json','utf8'));
    const example = JSON.parse(readFileSync('registration-example.json','utf8'));
    assert.equal(example.revision,accepted.revision);
    const exported = JSON.parse(execFileSync('screenplay',['export','model','--scope','Catalog.Authors'],{encoding:'utf8'}));
    assert.deepEqual(exported,accepted);
    assert.ok(process.env.AUTHORS_TARGET_ADAPTER, 'Supply the approved local target adapter; no mock fallback. See README.md.');
    const {startIsolatedAuthors} = await import(process.env.AUTHORS_TARGET_ADAPTER);
    const target = await startIsolatedAuthors({revision:accepted.revision,authorId:example.success.input.Id});
    t.after(() => target.close());
    const url = new URL(target.authorsUrl);
    assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({storageState:target.editorStorageState});
        await page.goto(url.href);
        await verifyRegistration(page);
    } finally { await browser.close(); }
});
