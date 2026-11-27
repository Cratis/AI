import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { chromium } from 'playwright';

const capture = JSON.parse(await readFile(new URL('./capture.json', import.meta.url), 'utf8'));
const html = `<!doctype html><title>Authors</title><table aria-label="Authors"><tbody></tbody></table><output></output><script type="module">
const response = await fetch('/capture' + location.search);
const { checkpoint, rows } = await response.json();
for (const author of rows) {
  const row = document.querySelector('tbody').insertRow();
  row.dataset.id = author.id;
  row.insertCell().textContent = author.name;
}
document.querySelector('output').textContent = 'Checkpoint ' + checkpoint;
</script>`;

test('same accepted request, two read-only observer snapshots', { timeout: 30000 }, async t => {
    const server = createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const index = url.searchParams.get('sample');
        if (req.method !== 'GET' || !['0','1'].includes(index)) { res.writeHead(404).end(); return; }
        if (url.pathname === '/capture') res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(capture.samples[Number(index)]));
        else if (url.pathname === '/') res.writeHead(200, {'Content-Type':'text/html'}).end(html);
        else res.writeHead(404).end();
    });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    const url = `http://127.0.0.1:${server.address().port}/?sample=`;
    await page.goto(url + '0');
    await page.getByText('Checkpoint 11', {exact:true}).waitFor();
    assert.equal(await page.getByRole('row').count(), 0);
    await page.goto(url + '1');
    await page.getByText('Checkpoint 12', {exact:true}).waitFor();
    assert.equal(await page.getByRole('row').count(), 1);
    assert.equal(await page.getByRole('row', {name:'Aster'}).getAttribute('data-id'), capture.source);
});
