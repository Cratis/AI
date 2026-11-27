import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Scope the host theme", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 const preview=button('Preview'),outside=button('Outside'); await expect(preview).toHaveCSS('color','rgb(101, 29, 155)');
 await expect(outside).not.toHaveCSS('color','rgb(101, 29, 155)'); await page.keyboard.press('Tab'); await expect(preview).toBeFocused();
 assert.ok(await preview.evaluate(el=>el.matches(':focus-visible') && (getComputedStyle(el).boxShadow!=='none'||getComputedStyle(el).outlineStyle!=='none')));
});
