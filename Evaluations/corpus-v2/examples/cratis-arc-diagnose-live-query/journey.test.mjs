import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {chromium} from 'playwright';

test('inspect storage snapshot, direct SSE and rendered result', {timeout: 40000}, async t => {
  const assembly = '../cratis-arc-host-application/Host/bin/Release/net11.0/Host.dll';
  const host = spawn('dotnet', [assembly], {stdio:['pipe','pipe','inherit']});
  const exited = once(host,'exit');
  t.after(() => {host.stdin.end('quit\n'); const timer = setTimeout(() => host.kill(),3000); return exited.finally(() => clearTimeout(timer));});
  const lines = createInterface({input:host.stdout});
  const url = await Promise.race([new Promise(resolve => lines.on('line', s => {if (s.startsWith('READY ')) resolve(s.slice(6));})), exited.then(() => {throw Error('Host exited before READY');}), new Promise((_,reject) => {const timer = setTimeout(() => reject(Error('No READY address')),15000); timer.unref();})]);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(url);
  await page.evaluate(() => {
    const source = new EventSource('/api/authors/all-authors');
    source.onmessage = event => {
      const frame = JSON.parse(event.data);
      if (!frame.isSuccess) throw Error('Query failed');
      document.querySelector('main').textContent = frame.data.map(row => `${row.id}: ${row.name}`).join(', ') || 'Ready: empty';
    };
  });
  await page.getByText('Ready: empty',{exact:true}).waitFor({timeout:8000});
  host.stdin.write('register\n');
  const id = '11111111-1111-4111-8111-111111111111';
  await page.getByText(`${id}: Aster`,{exact:true}).waitFor({timeout:8000});
  const snapshot = await page.request.get(`${url}/api/authors/snapshot`);
  assert.equal(snapshot.ok(),true); assert.deepEqual((await snapshot.json()).data,[{id,name:'Aster'}]);
});
