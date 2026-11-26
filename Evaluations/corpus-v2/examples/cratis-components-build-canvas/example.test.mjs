import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Keep world and screen coordinates separate", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 const canvas=page.locator('canvas').first(), overlay=button('Center pin'); await expect(canvas).toBeVisible(); const box=await canvas.boundingBox(), anchor=await overlay.boundingBox();
 await page.mouse.click(box.x+64,box.y+48); await expect(page.locator('output')).toHaveText('Pin'); await overlay.click();
 await expect(async()=>{await page.mouse.click(box.x+box.width/2,box.y+box.height/2); await expect(page.locator('output')).toHaveText('PinPin',{timeout:250});}).toPass({timeout:5000});
 await page.mouse.click(box.x+64,box.y+48); await expect(page.locator('output')).toHaveText('PinPin'); assert.deepEqual(await overlay.boundingBox(),anchor);
});
