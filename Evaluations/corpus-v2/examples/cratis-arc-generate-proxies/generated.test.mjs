import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('the generated routes use the same namespace policy as Catalog', async () => {
  const read = name => readFile(new URL(`./generated/Authors/${name}.ts`, import.meta.url), 'utf8');
  assert.match(await read('RegisterAuthor'), /['"]\/api\/authors['"]/);
  assert.match(await read('Author'), /['"]\/api\/authors\/all-authors['"]/);
});
