import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('keyboard submission restores focus to Add author', { timeout: 30000 }, async t => {
    const js = await readFile(new URL('dist/authors.js', import.meta.url));
    const host = createServer((req, res) => {
        if (req.url === '/authors.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); return; }
        res.setHeader('Content-Type', 'text/html');
        res.end('<main></main><script type="module">import {renderAuthors} from "/authors.js"; renderAuthors(document.querySelector("main"), () => {});</script>');
    });
    host.listen(0, '127.0.0.1');
    await once(host, 'listening');
    t.after(() => { host.closeAllConnections(); return new Promise(resolve => host.close(resolve)); });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`http://127.0.0.1:${host.address().port}`);
        const trigger = page.getByRole('button', { name: 'Add author' });
        await trigger.press('Enter');
        const name = page.getByRole('textbox', { name: 'Name' });
        assert.ok(await name.evaluate(el => el === el.ownerDocument.activeElement));
        await name.fill('Aster');
        await name.press('Enter');
        assert.equal(await page.getByRole('listitem').innerText(), 'Aster');
        assert.ok(await trigger.evaluate(el => el === el.ownerDocument.activeElement));
    } finally { await browser.close(); }
});
