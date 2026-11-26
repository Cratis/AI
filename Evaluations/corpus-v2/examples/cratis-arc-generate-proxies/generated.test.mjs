import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('the generated routes retain Features and the slice after skipping Library', async () => {
  const read = name => readFile(new URL(`./generated/Features/Authors/${name}.ts`, import.meta.url), 'utf8');
  assert.match(await read('Registration/RegisterAuthor'), /['"]\/api\/features\/authors\/registration['"]/);
  assert.match(await read('Listing/Author'), /['"]\/api\/features\/authors\/listing\/all-authors['"]/);
});
