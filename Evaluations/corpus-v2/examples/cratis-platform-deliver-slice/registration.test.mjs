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
    const id = '11111111-1111-4111-8111-111111111111';
    const fixture = await start({ id });
    try {
        const url = new URL(fixture.page.url());
        assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', '[::1]'].includes(url.hostname), 'Expected a loopback Authors page');
        await verifyRegistration(fixture.page);
        assert.deepEqual(await fixture.readRegistration(id), { facts: [{ source: id, name: 'Aster' }], row: { id, name: 'Aster' } });
    } finally {
        await fixture.close();
    }
});
