// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { packageProblems, retiredSkills } from './corpus-shape.ts';
import { verifyCorpus } from './verify.ts';

const marketplace = { plugins: [{ name: 'cratis', version: '1.0.0', source: { path: '.cratis/ai' }, skills: './skills' }] };
const skill = (name: string, description = 'Use when adding a demo.', body = 'Body.') => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${body}\n`;

/** A complete, valid repository: one profile, one skill, one rule, one install fixture. */
function validRepository(): Record<string, string> {
    const json = (value: unknown) => JSON.stringify(value);
    return {
        '.cratis/ai/manifest.json': json({ profiles: ['cratis/application'], profileCatalog: 'profile-catalog.json' }),
        '.cratis/ai/profile-catalog.json': json({ publicProfiles: [{ id: 'cratis/application', availableTargets: ['demo-skill'] }] }),
        '.cratis/ai/mcp-servers.json': json({ schemaVersion: '1.0', servers: [{ id: 'demo', profiles: ['cratis/application'], transport: 'stdio', command: 'demo', args: [], description: 'Demo.' }] }),
        '.cratis/ai/plugin.json': json({ name: 'cratis', description: 'Demo.', version: '1.0.0', author: { name: 'Cratis' }, homepage: 'https://www.cratis.io', repository: 'https://github.com/Cratis/AI', license: 'MIT', keywords: ['cratis'], skills: './skills' }),
        '.cratis/ai/rules/general.md': 'Choose the **demo-skill** skill.\n',
        '.cratis/ai/skills/demo-skill/SKILL.md': skill('demo-skill'),
        '.claude-plugin/marketplace.json': json(marketplace),
        '.cursor-plugin/marketplace.json': json(marketplace),
        '.agents/plugins/marketplace.json': json(marketplace),
        '.github/plugin/marketplace.json': json(marketplace),
        'Evaluations/conformance/demo/fixture.json': json({ name: 'demo', profiles: ['cratis/application'], checks: [{ type: 'file_exists', phase: 'install', path: '.cratis/ai/rules/general.md' }] }),
    };
}

describe('verify corpus', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'verify-corpus-')); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    async function failuresFor(change: (files: Record<string, string | undefined>) => void): Promise<string[]> {
        const files: Record<string, string | undefined> = validRepository();
        change(files);
        for (const [path, content] of Object.entries(files)) {
            if (content === undefined) continue;
            await mkdir(dirname(join(root, path)), { recursive: true });
            await writeFile(join(root, path), content);
        }
        return (await verifyCorpus(root)).failures;
    }

    it('should pass a complete corpus', async () => {
        assert.deepEqual(await failuresFor(() => undefined), []);
    });

    it('should accept a module version pin and unlabelled authoring cases', async () => {
        assert.deepEqual(await failuresFor(files => {
            files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', undefined, 'Run `go get github.com/cratis/arc.go@v0.1.4`.');
            files['Evaluations/corpus-v2/skills/demo-skill/trigger.json'] = JSON.stringify([{ query: 'Add a demo.', shouldTrigger: true }]);
        }), []);
    });

    it('should fail when the corpus directory is missing', async () => {
        assert.match((await verifyCorpus(root)).failures[0], /\.cratis\/ai is missing/);
    });

    it('measures the general cap in UTF-8 bytes', async () => {
        const general = '.cratis/ai/rules/general.md';
        assert.deepEqual(await failuresFor(files => { files[general] = 'é'.repeat(2150); }), []);
        assert.equal((await failuresFor(files => { files[general] = 'é'.repeat(2150) + '!'; })).length, 1);
    });

    const catalog = (profile: object) => JSON.stringify({ publicProfiles: [{ id: 'cratis/application', availableTargets: ['demo-skill'], ...profile }] });
    const defects: Array<[string, (files: Record<string, string | undefined>) => void, RegExp]> = [
        ['an empty skill tree', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = undefined; files['.cratis/ai/profile-catalog.json'] = catalog({ availableTargets: [] }); files['.cratis/ai/rules/general.md'] = 'Rule.\n'; }, /contains no skills/],
        ['a profile edge to an unknown profile', files => { files['.cratis/ai/profile-catalog.json'] = catalog({ composes: ['cratis/gone'] }); }, /composes unknown profile 'cratis\/gone'/],
        ['a profile target without a skill', files => { files['.cratis/ai/profile-catalog.json'] = catalog({ availableTargets: ['demo-skill', 'gone'] }); }, /targets missing skill 'gone'/],
        ['a skill no profile installs', files => { files['.cratis/ai/skills/other-skill/SKILL.md'] = skill('other-skill'); }, /'other-skill' is not reachable from any profile/],
        ['a manifest that omits a catalog profile', files => { files['.cratis/ai/manifest.json'] = JSON.stringify({ profiles: [] }); }, /manifest\.profiles is missing catalog profile/],
        ['a skill named differently from its directory', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('other-name'); }, /name must match its directory/],
        ['a description without an invocation condition', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', 'Adds a demo.'); }, /must start with 'Use when' or 'Use before'/],
        ['a broken relative link', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', undefined, 'See [next](../gone/SKILL.md).'); }, /links to '\.\.\/gone\/SKILL\.md', which does not exist/],
        ['a reference the skill never names', files => { files['.cratis/ai/skills/demo-skill/references/detail.md'] = '# Detail\n'; }, /must directly reference 'references\/detail\.md'/],
        ['a checkout-only path in skill content', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', undefined, 'Run the example in `Evaluations/corpus-v2/examples/demo/`.'); }, /SKILL\.md:\d+: skill content contains a checkout-only path/],
        ['a file-and-line citation in skill content', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', undefined, 'See Handler.cs:12 for proof.'); }, /SKILL\.md:\d+: skill content contains a source citation/],
        ['a product version citation in skill content', files => { files['.cratis/ai/skills/demo-skill/SKILL.md'] = skill('demo-skill', undefined, 'Verified against Arc@v20.65.0.'); }, /skill content contains a source citation/],
        ['a rule naming a skill that does not exist', files => { files['.cratis/ai/rules/general.md'] = 'Choose the **gone-skill** skill.\n'; }, /gone-skill/],
        ['a missing general rule', files => { files['.cratis/ai/rules/general.md'] = undefined; files['.cratis/ai/rules/framework.md'] = 'Rule.\n'; }, /rules\/general\.md is missing/],
        ['an MCP server for an unknown profile', files => { files['.cratis/ai/mcp-servers.json'] = files['.cratis/ai/mcp-servers.json']!.replace('cratis/application', 'cratis/gone'); }, /must select known profiles/],
        ['a marketplace pointing outside the corpus', files => { files['.claude-plugin/marketplace.json'] = JSON.stringify({ plugins: [{ source: { path: 'elsewhere' }, skills: './skills' }] }); }, /\.claude-plugin\/marketplace\.json must expose the canonical/],
        ['no install fixture', files => { files['Evaluations/conformance/demo/fixture.json'] = undefined; }, /requires at least one install fixture/],
        ['fixtures without an install-phase check', files => { files['Evaluations/conformance/demo/fixture.json'] = JSON.stringify({ name: 'demo', checks: [{ type: 'file_exists', phase: 'result', path: 'a' }] }); }, /requires at least one install-phase check/],
        ['an install fixture for an unknown profile', files => { files['Evaluations/conformance/demo/fixture.json'] = files['Evaluations/conformance/demo/fixture.json']!.replace('cratis/application', 'cratis/gone'); }, /selects unknown profile 'cratis\/gone'/],
        ['an example for a skill that does not exist', files => { files['Evaluations/corpus-v2/examples/gone-skill/README.md'] = 'Example.\n'; }, /examples\/gone-skill names no skill/],
        ['authoring cases naming another skill', files => { files['Evaluations/corpus-v2/skills/demo-skill/trigger.json'] = JSON.stringify({ skill: 'other', queries: [] }); }, /trigger\.json must name the skill 'demo-skill'/],
    ];

    for (const [name, change, expected] of defects) {
        it(`should reject ${name}`, async () => {
            const failures = await failuresFor(change);
            assert.ok(failures.some(failure => expected.test(failure)), failures.join('\n') || 'no failures');
        });
    }
});

it('rejects an installed retired skill and an otherwise valid competing description', () => {
    const files = new Map([['skills/demo/SKILL.md', skill('demo')]]);
    assert.deepEqual(packageProblems(files, retiredSkills), []);
    const retired = retiredSkills.values().next().value!;
    assert.equal(packageProblems(new Map([...files, [`skills/${retired}/LICENSE`, 'text']]), retiredSkills).length, 1);
    assert.equal(packageProblems(new Map([...files, ['skills/another/SKILL.md', skill('another')]]), retiredSkills).length, 1);
});
