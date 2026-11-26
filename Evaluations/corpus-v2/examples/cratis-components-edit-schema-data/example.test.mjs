import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Edit values against a schema", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']}});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 const field=page.getByRole('textbox',{name:'name'}),save=button('Save').first(); await page.getByText('Contract',{exact:true}).click(); const contract=await page.locator('pre').textContent();
 await field.fill('Aster'); await save.click(); await expect(page.locator('output')).toHaveText('{"name":"Aster"}'); await expect(save).toBeEnabled();
 await field.fill(''); await expect(field).toHaveAttribute('aria-invalid','true'); await expect(save).toBeDisabled(); assert.equal(await page.locator('pre').textContent(),contract);
 await page.getByText('Edit schema draft').click();
 await expect(page.locator('[data-cratis-component="SchemaEditor"]')).toBeVisible();
});
