import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Await the result of confirmation", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 let writes=0; await page.route('**/archive',route=>route.fulfill({status:++writes===1?503:200,body:''}));
 await button('Archive').click(); await button('No').click(); await expect(page.locator('output')).toHaveText('Ready'); assert.equal(writes,0);
 await button('Archive').click(); await button('Yes').click(); await expect(page.locator('output')).toHaveText('Archive failed'); await expect(button('Archive')).toBeEnabled();
 await button('Archive').click(); await button('Yes').click(); await expect(page.locator('output')).toHaveText('Archived'); assert.equal(writes,2);
});
