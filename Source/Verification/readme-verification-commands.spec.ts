// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const readme = read('README.md');
const workflow = read('.github/workflows/publish.yml');

// Source/AgentHarnesses is excluded from the root workspace and keeps its own package-lock.json.
const standalone = 'AgentHarnesses';
const workspacePackages = new Map<string, Set<string>>();
for (const directory of readdirSync(resolve(root, 'Source'))) {
    const manifest = resolve(root, 'Source', directory, 'package.json');
    if (directory === standalone || !existsSync(manifest)) continue;
    const { name, scripts } = JSON.parse(readFileSync(manifest, 'utf8')) as { name: string; scripts?: Record<string, string> };
    workspacePackages.set(name, new Set(Object.keys(scripts ?? {})));
}

const workspaceRuns = (text: string) => [...text.matchAll(/yarn workspace ([\w@/.-]+) run ([\w:.-]+)/g)].map(match => ({ command: `yarn workspace ${match[1]} run ${match[2]}`, name: match[1], script: match[2] }));

test('every README yarn workspace command names an existing workspace package and script', () => {
    const runs = workspaceRuns(readme);
    assert.ok(runs.length > 0);
    for (const { command, name, script } of runs) {
        assert.ok(workspacePackages.has(name), `${command}: no workspace package ${name}`);
        assert.ok(workspacePackages.get(name)!.has(script), `${command}: ${name} has no script ${script}`);
    }
});

test('the README installs the workspace once from the root lockfile', () => {
    assert.ok(existsSync(resolve(root, 'yarn.lock')));
    assert.match(readme, /yarn install --immutable/);
    assert.doesNotMatch(readme, /npm (?:ci|install|run|test|pack)\b[^\n]*--prefix/);
    assert.doesNotMatch(readme, /npm pack/);
    for (const name of workspacePackages.keys()) {
        const directory = readdirSync(resolve(root, 'Source')).find(entry => existsSync(resolve(root, 'Source', entry, 'package.json'))
            && JSON.parse(read(`Source/${entry}/package.json`)).name === name);
        assert.ok(!existsSync(resolve(root, 'Source', directory!, 'package-lock.json')), `${name} carries its own package-lock.json`);
    }
    for (const line of readme.split('\n').filter(text => /\bnpm ci\b/.test(text))) {
        assert.match(line, new RegExp(standalone), `npm ci outside ${standalone}: ${line}`);
    }
    assert.ok(existsSync(resolve(root, 'Source', standalone, 'package-lock.json')));
});

test('the README lists every workspace command the CI verify job runs', () => {
    const verifyJob = /\n {2}verify:\n([\s\S]*?)\n {2}[a-z-]+:\n/.exec(workflow);
    assert.ok(verifyJob, 'the verify job');
    const documented = new Set(workspaceRuns(readme).map(run => run.command));
    const required = workspaceRuns(verifyJob[1]);
    assert.ok(required.length > 0);
    for (const { command } of required) assert.ok(documented.has(command), `README misses ${command}`);
    assert.ok(readme.includes('(cd Source/Pi.Plugin && yarn pack --dry-run)'));
});

test('the README lists the CI .NET checks as a separate phase', () => {
    const dotnetJob = /\n {2}dotnet-verify:\n([\s\S]*?)\n {2}[a-z-]+:\n/.exec(workflow);
    assert.ok(dotnetJob, 'the dotnet-verify job');
    const commands = [...dotnetJob[1].matchAll(/\n\s+run: (.+)/g)].map(match => match[1].trim());
    assert.ok(commands.length > 0);
    for (const command of commands) assert.ok(readme.includes(command), `README misses ${command}`);
});

test('the README keeps paid model evaluation optional', () => {
    assert.match(readme, /makes paid model calls and is optional, never part of\s+required verification/);
});
