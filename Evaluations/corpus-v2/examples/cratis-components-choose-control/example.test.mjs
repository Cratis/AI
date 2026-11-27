import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Choose a control by its committed value", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const amount = page.getByLabel('Price', { exact: true });
 await amount.fill('12'); await amount.press('Tab'); await expect(amount).toHaveValue('12');
 await amount.fill(''); await amount.press('Tab'); await expect(amount).toHaveValue('');
});
