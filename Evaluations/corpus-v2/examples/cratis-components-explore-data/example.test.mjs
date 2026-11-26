import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Explore a collection by dimension", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 await expect(page.getByText('3 editions')).toBeVisible(); await page.getByRole('button',{name:/filter/i}).first().click();
 await page.getByRole('button',{name:/Region/}).click(); await page.getByText('East',{exact:true}).first().click(); await expect(page.getByText('2 editions')).toBeVisible();
});
