import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

function liveChat(subscribed) {
    return { name: 'chat-data', configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const url = new URL(req.url, 'http://localhost');
            if (!['/topics', '/topic-messages'].includes(url.pathname)) return next();
            const topicId = url.searchParams.get('topicId');
            subscribed.push([url.pathname, topicId]);
            const data = url.pathname === '/topics' ? [{ id: 'books', name: 'Books' }] : [{
                id: 'first', authorId: 'editor', topicId, body: 'First proof', timestamp: new Date(),
            }];
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
            res.write('data: ' + JSON.stringify({ data, isSuccess: true, isAuthorized: true, isValid: true,
                isReady: true, hasExceptions: false, validationResults: [], exceptionMessages: [],
                paging: { page: 0, size: data.length, totalItems: data.length, totalPages: 1 } }) + '\n\n');
        });
    } };
}

test('Subscribe to messages only for the open topic', { timeout: 120000 }, async t => {
    const subscribed = [];
    const host = await createServer({ server: { host: '127.0.0.1', port: 0 }, plugins: [liveChat(subscribed)] });
    await host.listen(); let browser;
    t.after(async () => { try { await browser?.close(); } finally { await host.close(); } });
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.route('**/.cratis/me', route => route.fulfill({ status: 401, body: '' }));
    await page.route('**/messages', route => route.fulfill({ status: 503, body: '' }));
    await page.goto(host.resolvedUrls.local[0]);
    const books = page.getByText('Books', { exact: true });
    await expect(books).toBeVisible();
    assert.ok(subscribed.every(([path]) => path === '/topics'));
    await books.click();
    await expect(page.getByText('First proof', { exact: true })).toBeVisible();
    assert.ok(subscribed.some(([path, id]) => path === '/topic-messages' && id === 'books'));
    const input = page.locator('textarea'); await input.fill('Reject'); await input.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Message not sent to books.');
});
