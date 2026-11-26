import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Host a conversation without mixing topics", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 await page.route('**/messages',route=>route.fulfill({status:route.request().postDataJSON().body==='Reject'?503:200,body:''}));
 await expect(page.getByText('First proof',{exact:true})).toBeVisible(); const input=page.locator('textarea'); await input.fill('Approved'); await input.press('Enter'); await expect(page.getByText('Approved',{exact:true})).toBeVisible();
 await page.getByLabel('Topic').selectOption('Notes'); await expect(page.getByText('Approved',{exact:true})).toHaveCount(0); await expect(page.getByText('Margin notes')).toBeVisible();
 await input.fill('Reject'); await input.press('Enter'); await expect(page.locator('output')).toHaveText('Message not sent'); await page.getByLabel('Topic').selectOption('Books'); await expect(page.locator('output')).toBeEmpty();
});
