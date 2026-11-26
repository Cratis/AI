import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

test('published host discovers and dispatches the real snapshot endpoint', {timeout:20000}, async t => {
  assert.ok(process.env.PUBLISHED_HOST, 'Set PUBLISHED_HOST to the published trimmed apphost');
  const host = spawn(resolve(process.env.PUBLISHED_HOST), [], {stdio:['pipe','pipe','inherit']});
  const exited = once(host,'exit');
  t.after(() => {host.stdin.end('quit\n'); const timer = setTimeout(() => host.kill(),3000); return exited.finally(() => clearTimeout(timer));});
  const lines = createInterface({input:host.stdout});
  const addr = await Promise.race([new Promise(resolve => lines.on('line', s => {if (s.startsWith('READY ')) resolve(s.slice(6));})), exited.then(() => {throw Error('Host exited before READY');}), new Promise((_,reject) => {const timer = setTimeout(() => reject(Error('No READY address')),10000); timer.unref();})]);
  const response = await fetch(new URL('/api/features/authors/listing/snapshot',addr),{signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);
  const body = await response.json(); assert.equal(body.isSuccess,true); assert.deepEqual(body.data,[]);
});
