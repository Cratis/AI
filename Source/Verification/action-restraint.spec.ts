// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import { browserTool } from './captured-tool-calls.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const adapterNames = ['pi', 'opencode'];
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

type Adapter = { name: string; content: string };

function grantedNames(value: unknown): string[] {
    if (typeof value === 'string') return value.split(',').map(name => name.trim()).filter(Boolean);
    if (Array.isArray(value)) return value.map(String);
    assert.ok(value && typeof value === 'object', 'tool grants must be declared');
    return Object.entries(value).filter(([, grant]) => grant !== false && grant !== 'deny').map(([name]) => name);
}

function assertNoBrowserGrants(content: string): void {
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
    assert.ok(match, 'agent frontmatter must exist');
    const metadata = parse(match[1]);
    assert.ok(metadata && typeof metadata === 'object', 'agent metadata must exist');
    const names = [metadata.tools, metadata.permission].filter(value => value !== undefined).flatMap(grantedNames);
    assert.ok(names.length > 0, 'agent must declare tool grants');
    for (const name of names) assert.doesNotMatch(name, browserTool, `browser tool grant: ${name}`);
}

function assertFrontendContract(canonical: string | undefined, adapters: Adapter[]): void {
    assert.ok(canonical, 'canonical frontend-developer agent must exist');
    assert.deepEqual(adapters.map(adapter => adapter.name).sort(), [...adapterNames].sort(), 'Pi and OpenCode adapters must exist');
    for (const content of [canonical, ...adapters.map(adapter => adapter.content)]) assertNoBrowserGrants(content);
}

const agent = (grants: string) => `---\n${grants}\n---\nFrontend developer\n`;

describe('frontend browser tool-grant restraint (static contract, not live tool-call evidence)', () => {
    it('should grant no browser tools to the canonical frontend agent or either shipped adapter', () => {
        const canonical = read('.cratis/ai/agents/frontend-developer.md');
        const adapters = adapterNames.map(name => ({ name, content: read(`.cratis/ai/harnesses/${name}/agents/frontend-developer.md`) }));
        assertFrontendContract(canonical, adapters);
    });

    it('should reject a missing canonical agent', () => {
        assert.throws(() => assertFrontendContract(undefined, []), /canonical frontend-developer agent must exist/);
    });

    it('should reject an empty adapter list', () => {
        assert.throws(() => assertFrontendContract(agent('tools: Read'), []), /Pi and OpenCode adapters must exist/);
    });

    it('should reject a missing Pi or OpenCode adapter', () => {
        for (const name of adapterNames) {
            assert.throws(() => assertFrontendContract(agent('tools: Read'), [{ name, content: agent('tools: read') }]), /Pi and OpenCode adapters must exist/);
        }
    });

    it('should reject absent or empty tool declarations', () => {
        for (const grants of ['name: Frontend Developer', 'tools: []', 'tools: {}', 'tools: ""']) {
            assert.throws(() => assertNoBrowserGrants(agent(grants)), /agent must declare tool grants/);
        }
    });

    it('should detect browser grants in canonical, Pi and OpenCode frontmatter', () => {
        const violatingGrants = [
            'tools:\n  - Read\n  - browser_click',
            'tools: read, mcp__playwright__browser_snapshot',
            'tools: read, clickElement, typeInPage',
            'tools:\n  browser_click: true',
            'permission:\n  edit: allow\n  browser_click: allow',
            'permission:\n  browser_*:\n    "*": allow',
            'permission:\n  "*": allow'
        ];
        for (const grants of violatingGrants) {
            assert.throws(() => assertNoBrowserGrants(agent(grants)), /browser tool grant/, grants);
        }
    });

    it('should permit explicit browser denials rather than treating them as grants', () => {
        assertNoBrowserGrants(agent('tools:\n  read: true\n  browser_click: false\npermission:\n  playwright: deny'));
    });

    it('should retain the unavailable-operator, production and human sign-in instructions', () => {
        for (const path of ['agents/frontend-developer.md', ...adapterNames.map(name => `harnesses/${name}/agents/frontend-developer.md`)]) {
            const content = read(`.cratis/ai/${path}`);
            assert.match(content, /browser-operator/);
            assert.match(content, /unverified/i);
            assert.match(content, /production stays read-only/i);
            assert.match(content, /sign-in stops for a human/i);
        }
    });

    it('should link the unavailable-operator fixture to the static contract and recorded-session restraint specs', () => {
        const fixture = JSON.parse(read('Evaluations/conformance/typescript-frontend-browser-operator-unavailable/fixture.json'));
        assert.match(fixture.description, /action-restraint\.spec\.ts/);
        assert.match(fixture.description, /text only/);
        assert.match(fixture.description, /captured-tool-calls\.spec\.ts/);
    });
});
