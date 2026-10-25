// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pluginManifestPath, pluginManifestProblems } from './plugin-manifest.ts';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string): Record<string, unknown> => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const marketplacePaths = ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.github/plugin/marketplace.json'];
const marketplaces = marketplacePaths.map(path => ({ path, document: read(path) as unknown }));
const manifest = read(pluginManifestPath);

test('the committed plugin manifest is valid and matches every marketplace manifest', () => {
    assert.equal(marketplaces.length, 4);
    assert.deepEqual(pluginManifestProblems(manifest, marketplaces), []);
});

test('a plugin version that drifts from a marketplace manifest fails and names that marketplace', () => {
    const problems = pluginManifestProblems({ ...manifest, version: '1.0.1' }, marketplaces);
    assert.equal(problems.length, 4);
    for (const path of marketplacePaths) assert.ok(problems.some(problem => problem.includes(path) && problem.includes("'1.0.1'")), path);
});

test('a marketplace entry without a version is not compared', () => {
    const unversioned = { plugins: [{ name: 'cratis' }] };
    assert.deepEqual(pluginManifestProblems({ ...manifest, version: '2.0.0' }, [{ path: 'unversioned.json', document: unversioned }]), []);
});

test('each planted manifest defect is reported', () => {
    const planted: Array<[string, Record<string, unknown>]> = [
        ['version', { ...manifest, version: 'v1' }],
        ['name', { ...manifest, name: 'Cratis AI' }],
        ['description', { ...manifest, description: '' }],
        ['author.name', { ...manifest, author: { url: 'https://www.cratis.io' } }],
        ['author.url', { ...manifest, author: { name: 'Cratis', url: 'http://www.cratis.io' } }],
        ['homepage', { ...manifest, homepage: undefined }],
        ['repository', { ...manifest, repository: 'https://gitlab.com/Cratis/AI' }],
        ['license', { ...manifest, license: undefined }],
        ['keywords', { ...manifest, keywords: ['Event_Sourcing'] }],
        ['keywords', { ...manifest, keywords: [] }],
        ['skills', { ...manifest, skills: './rules' }],
        ['skillz', { ...manifest, skillz: './skills' }],
    ];
    for (const [field, defective] of planted) {
        const problems = pluginManifestProblems(defective, []);
        assert.ok(problems.some(problem => problem.includes(`'${field}'`)), `${field}: ${problems.join(' | ')}`);
    }
    assert.deepEqual(pluginManifestProblems([], []), [`${pluginManifestPath} must be a JSON object.`]);
});
