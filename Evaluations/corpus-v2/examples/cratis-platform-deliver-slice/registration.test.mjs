import assert from 'node:assert/strict';
import test from 'node:test';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyRegistration } from './registration.mjs';

// A trusted local fixture, never a remote URL or a general application endpoint.
test('a single permitted registration reaches the live Authors list', { timeout: 60000 }, async () => {
    const path = process.env.AUTHORS_FIXTURE_ADAPTER;
    assert.ok(path && isAbsolute(path), 'Set AUTHORS_FIXTURE_ADAPTER to the absolute path of the disposable local adapter');
    const { start } = await import(pathToFileURL(path).href);
    const fixture = await start();
    try {
        const url = new URL(fixture.page.url());
        assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', '[::1]'].includes(url.hostname), 'Expected a loopback Authors page');
        await verifyRegistration(fixture.page);
        const { facts, rows } = await fixture.readRegistrations();
        assert.equal(facts.length, 1);
        assert.equal(facts[0].name, 'Aster');
        assert.deepEqual(rows, [{ id: facts[0].source, name: 'Aster' }]);
    } finally {
        await fixture.close();
    }
});
