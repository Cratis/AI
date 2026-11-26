import test from 'node:test';
import {readFileSync} from 'node:fs';
import {chromium, expect} from '@playwright/test';
import {createServer} from 'vite';

function registrationServer() {
    const source = readFileSync(new URL('./generated/Features/Authors/Registration/RegisterAuthor.ts', import.meta.url),'utf8');
    const path = source.match(/readonly route:\s*string\s*=\s*'([^']+)'/)?.[1];
    if (!path) throw new Error('Missing RegisterAuthor route');
    return {name:'registration',configureServer(server){server.middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url,'http://localhost');
        if(req.method!=='POST'||![path,path+'/validate'].includes(url.pathname))return next();
        let body='';for await(const chunk of req)body+=chunk;
        const invalid=!JSON.parse(body).name;
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({isSuccess:!invalid,isAuthorized:true,isValid:!invalid,hasExceptions:false,exceptionMessages:[],
            validationResults:invalid?[{message:'Name is required',members:['name'],severity:'error'}]:[]}));
    });}};
}
test('Open the registration dialog and submit an author', {timeout:120000},async t=>{
    const server=await createServer({server:{host:'127.0.0.1',port:0},plugins:[registrationServer()]});
    await server.listen();let browser;t.after(async()=>{try{await browser?.close();}finally{await server.close();}});
    browser=await chromium.launch();const page=await browser.newPage();
    await page.route('**/.cratis/me',r=>r.fulfill({status:401,body:''}));await page.goto(server.resolvedUrls.local[0]);
    const trigger=page.getByRole('button',{name:'Add author',exact:true});await trigger.click();
    const name=page.getByRole('textbox');await name.fill('Aster');await page.getByRole('button',{name:'Add',exact:true}).click();
    await expect(name).toBeHidden();await expect(trigger).toBeFocused();
});
