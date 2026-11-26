import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

test("Submit a generated command from fields", {timeout:120000}, async t=>{
 const host=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{entries:['index.html']},plugins:[catalog()]});
 await host.listen(); let browser; t.after(async()=>{try{await browser?.close();}finally{await host.close();}});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.route('**/.cratis/me',route=>route.fulfill({status:401,body:''}));
 await page.goto(host.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 const field=page.getByRole('textbox'); await field.fill('Taken'); await button('Register').click();
 await expect(page.getByText('Name unavailable',{exact:true}).first()).toBeVisible(); await expect(field).toHaveValue('Taken');
 await field.fill('Aster'); await button('Register').click(); await expect(page.locator('output')).toHaveText('Registered');
 assert.equal(await (await page.request.get(new URL('/fixture-count',page.url()).href)).text(),'1');
});
function catalog(){return {name:'catalog-responses',configureServer(server){const clients=new Set(),rows=[];let accepted=0;const flags={isSuccess:true,isReady:true,isAuthorized:true,isValid:true,hasExceptions:false,validationResults:[],exceptionMessages:[],exceptionStackTrace:'',authorizationFailureReason:''};const frame=()=> 'data: '+JSON.stringify({...flags,data:rows,paging:{page:0,size:rows.length,totalItems:rows.length,totalPages:1}})+'\n\n';server.middlewares.use(async(req,res,next)=>{const path=req.url.split('?')[0];if(path==='/fixture-count'){res.end(String(accepted));return;}if(path==='/api/authors/all-authors'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.write(frame());clients.add(res);res.on('close',()=>clients.delete(res));return;}if(path==='/fixture-seed'){rows.push({id:'00000000-0000-4000-8000-000000000002',name:'Fern'},{id:'00000000-0000-4000-8000-000000000003',name:'Aster'});for(const c of clients)c.write(frame());res.end();return;}if((path==='/api/authors'||path==='/api/authors/validate')&&req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const validate=path.endsWith('/validate');const ok=validate||body.name==='Aster';if(ok&&!validate){accepted++;rows.push({id:body.id,name:body.name});for(const c of clients)c.write(frame());}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...flags,isSuccess:ok,isValid:ok,correlationId:'00000000-0000-4000-8000-000000000001',response:null,validationResults:ok?[]:[{severity:0,message:'Name unavailable',members:['name'],state:{}}]}));return;}next();});}}}