import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { verifyKeyboardRegistration } from './Features/Authors/Registration/verifyKeyboardRegistration.mjs';

test('keyboard registration reaches the open Authors list', { timeout: 60000 }, async () => {
    const path = process.env.AUTHORS_FIXTURE_ADAPTER;
    assert.ok(path && isAbsolute(path), 'Set AUTHORS_FIXTURE_ADAPTER to the absolute path of the disposable local adapter');
    const { start } = await import(pathToFileURL(path).href);
    const fixture = await start();
    try {
        const url = new URL(fixture.page.url());
        assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', '[::1]'].includes(url.hostname), 'Expected a loopback Authors page');
        await verifyKeyboardRegistration(fixture.page, 'Aster');
    } finally {
        await fixture.close();
    }
});
