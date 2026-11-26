import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Switch the active toolbar commands", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 await expect(button('Draw shelf')).toBeVisible(); await expect(button('Add note')).toHaveCount(0);
 await button('Review mode').click(); await expect(button('Draw shelf')).toHaveCount(0);
 await page.keyboard.press('Tab'); await expect(button('Add note')).toBeFocused(); await page.keyboard.press('Enter'); await expect(page.locator('output')).toHaveText('Note');
});
