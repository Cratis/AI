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
 const board = page.locator('[data-cratis-component="Canvas"]');
 const item = button('Book reviews'); await expect(item).toBeVisible();
 const start = await item.boundingBox(), box = await board.boundingBox();
 const x = box.x + box.width * 0.7, y = box.y + box.height * 0.6;
 await page.mouse.move(x, y); await page.mouse.down();
 await page.mouse.move(x + 48, y + 16, { steps: 8 }); await page.mouse.up();
 await expect.poll(async () => (await item.boundingBox()).x).toBeGreaterThan(start.x + 20);
 await item.click(); await expect(page).toHaveURL(/#reviews$/);
 await expect(button('Zoom In')).toBeVisible();
});
