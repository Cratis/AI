// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const skills = resolve(import.meta.dirname, '../../.cratis/ai/skills');
const scripts = readdirSync(skills, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(entry => {
    const directory = join(skills, entry.name, 'scripts');
    if (!existsSync(directory)) return [];
    return readdirSync(directory).filter(name => name.endsWith('.mjs') && !name.endsWith('-self-test.mjs'))
        .filter(name => /['"]--self-test['"]/.test(readFileSync(join(directory, name), 'utf8')))
        .map(name => ({ name: `${entry.name}/${name}`, path: join(directory, name) }));
}).sort((left, right) => left.name.localeCompare(right.name));

test('skill script self-tests include fidelity and process drift', () => {
    assert.ok(scripts.some(script => script.name.endsWith('/score-fidelity.mjs')));
    assert.ok(scripts.some(script => script.name.endsWith('/drift-scope.mjs')));
});

for (const script of scripts) {
    test(`skill script self-test: ${script.name}`, t => {
        const result = spawnSync(process.execPath, [script.path, '--self-test'], { encoding: 'utf8', timeout: 20000 });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        t.diagnostic(result.stdout.trim());
    });
}
