import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { backend } from './authors-server.mjs';

test('Show empty and updated author results', {timeout:120000}, async t => {
    const server = await createServer({ server:{host:'127.0.0.1',port:0}, plugins:[backend()] });
    await server.listen(); let browser;
    t.after(async () => { try { await browser?.close(); } finally { await server.close(); } });
    browser = await chromium.launch(); const page = await browser.newPage();
    await page.route('**/.cratis/me', route => route.fulfill({status:401,body:''}));
    await page.goto(server.resolvedUrls.local[0]);
    await expect(page.getByText('No authors yet.')).toBeVisible();
    await expect(page.getByText('Enter an author name.')).toBeVisible();
    await page.request.post(new URL('/fixture-seed',page.url()).href);
    await expect(page.getByRole('listitem')).toHaveText(['Fern','Aster']);
});
