// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync, type spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { selectedServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/configuration.ts';
import { childEnvironment, startConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/process.ts';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { fakeChild, projectFixture } from './pi-mcp-helpers.ts';

test('Screenplay is inactive without explicit or composed profile selection', () => {
    for (const configuration of [{}, { profiles: [] }, { profiles: ['other'] }]) {
        const fixture = projectFixture(configuration);
        assert.equal(selectedServer(fixture.project, fixture.corpus), undefined);
    }
    const fixture = projectFixture();
    unlinkSync(join(fixture.project, '.cratis', 'ai.json'));
    assert.equal(selectedServer(fixture.project, fixture.corpus), undefined);
});

test('Screenplay expands catalog composition and honors explicit opt-out', () => {
    const fixture = projectFixture({ profiles: ['composed'], languages: ['typescript'] });
    const selected = selectedServer(fixture.project, fixture.corpus);
    assert.ok(selected);
    assert.equal(selected.root, undefined);
    assert.equal(selected.composedOnly, false, 'pre-existing non-application composition still requires MCP');
    fixture.configure({ profiles: ['cratis/application'] });
    assert.equal(selectedServer(fixture.project, fixture.corpus)?.composedOnly, true);
    fixture.configure({ profiles: ['composed', 'cratis/screenplay'] });
    assert.equal(selectedServer(fixture.project, fixture.corpus)?.composedOnly, false);
    assert.equal(existsSync(join(fixture.project, '.cratis', 'screenplay')), false);
    fixture.configure({ profiles: ['composed'], mcpServers: { screenplay: { enabled: false } } });
    assert.equal(selectedServer(fixture.project, fixture.corpus), undefined);
});

test('Screenplay quiet startup requires every selected path to pass through application composition', () => {
    const fixture = projectFixture();
    for (const [profiles, composedOnly] of [
        [['indirect-application'], true],
        [['cratis/application', 'other'], true],
        [['mixed-paths'], false],
        [['cratis/application', 'composed'], false],
        [['composed', 'cratis/application'], false],
        [['cratis/application', 'cratis/screenplay'], false],
        [['cratis/screenplay', 'cratis/application'], false],
    ] as const) {
        fixture.configure({ profiles, languages: ['csharp'] });
        assert.equal(selectedServer(fixture.project, fixture.corpus)?.composedOnly, composedOnly, profiles.join(' + '));
    }
});

test('Screenplay supports a physical configured subdirectory without writing model files', () => {
    const fixture = projectFixture({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { root: 'models/app' } } });
    mkdirSync(join(fixture.project, 'models/app'), { recursive: true });
    writeFileSync(join(fixture.project, 'models/app/model.play'), 'Application Example');
    const before = readdirSync(fixture.project, { recursive: true });
    assert.equal(selectedServer(fixture.project, fixture.corpus)?.root, join(fixture.project, 'models/app'));
    assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before);
    assert.equal(readFileSync(join(fixture.project, 'models/app/model.play'), 'utf8'), 'Application Example');
});

test('Screenplay refuses escaping, absolute, project-wide and symlinked model roots', () => {
    const fixture = projectFixture();
    symlinkSync(fixture.corpus, join(fixture.project, 'linked'));
    for (const root of ['../outside', '/outside', '.', 'linked', 'linked/child']) {
        fixture.configure({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { root } } });
        assert.throws(() => selectedServer(fixture.project, fixture.corpus), /inside|relative|symlink/);
    }
});

test('Screenplay does not create an absent configured root on discovery', () => {
    const fixture = projectFixture({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { root: 'new-model' } } });
    assert.throws(() => selectedServer(fixture.project, fixture.corpus), /discovery never creates/);
    assert.equal(existsSync(join(fixture.project, 'new-model')), false);
});

test('Screenplay rejects foreign descriptor commands and environments', () => {
    for (const override of [{ command: 'npx' }, { args: ['screenplay', 'mcp', '--other'] }, { env: { TOKEN: 'value' } }, { transport: 'http' }]) {
        const fixture = projectFixture();
        Object.assign(fixture.descriptor.servers[0], override);
        writeFileSync(join(fixture.corpus, 'mcp-servers.json'), JSON.stringify(fixture.descriptor));
        assert.throws(() => selectedServer(fixture.project, fixture.corpus), /Only the distributed/);
    }
});

const distributedCorpus = resolve(import.meta.dirname, '../../.cratis/ai');
const distributedCatalog = JSON.parse(readFileSync(join(distributedCorpus, 'profile-catalog.json'), 'utf8')) as {
    publicProfiles: Array<{ id: string; availableTargets?: string[] }>;
};
const screenplaySkills = distributedCatalog.publicProfiles.find(profile => profile.id === 'cratis/screenplay')?.availableTargets ?? [];

function assertApplicationConsumer(t: TestContext, fixture: ReturnType<typeof projectFixture>, root?: string) {
    t.after(() => rmSync(fixture.project, { recursive: true, force: true }));
    const before = readdirSync(fixture.project, { recursive: true });
    const skills = selectedSkillPaths(fixture.project).map(path => path.split('/').pop());
    assert.ok(screenplaySkills.length > 0, 'the distributed Screenplay profile declares skills');
    for (const skill of screenplaySkills) assert.ok(skills.includes(skill), skill);
    assert.ok(!skills.includes('cratis-stage-rendering-and-sandbox'), 'application profiles do not compose Stage');
    const selected = selectedServer(fixture.project, fixture.corpus);
    assert.ok(selected, 'the distributed MCP descriptor is active');
    assert.equal(selected.project, fixture.project);
    assert.equal(selected.root, root);
    assert.equal(selected.composedOnly, root === undefined);

    // Inspect the real launch configuration with a fake child; CLI folder creation is covered by CLI v3.46.1 specs.
    const child = fakeChild();
    let invocation: unknown[] = [];
    const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
    const connection = startConnection(selected.project, launch);
    t.after(() => connection.dispose());
    assert.equal(invocation[0], 'cratis');
    assert.deepEqual(invocation[1], ['screenplay', 'mcp', '--project-root', fixture.project]);
    const options = invocation[2] as { cwd: string; env: NodeJS.ProcessEnv; shell: boolean };
    assert.equal(options.cwd, fixture.project);
    assert.equal(options.shell, false);
    assert.deepEqual(options.env, childEnvironment());
    assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before, 'discovery and launch configuration leave the project unchanged');
}

for (const [profile, language] of [
    ['cratis/application', 'csharp'],
    ['cratis/application/csharp', 'csharp'],
    ['cratis/application/typescript', 'typescript'],
    ['cratis/application/elixir', 'elixir'],
    ['cratis/application/kotlin', 'kotlin'],
    ['cratis/application/java', 'java'],
    ['cratis/application/arc-chronicle', 'csharp'],
    ['cratis/application/arc-only', 'csharp'],
    ['cratis/application/chronicle-dotnet', 'csharp'],
]) {
    test(`${profile} selects Screenplay without a model or configured root`, t => {
        const fixture = projectFixture({ profiles: [profile], languages: [language] }, distributedCorpus);
        assertApplicationConsumer(t, fixture);
        assert.equal(existsSync(join(fixture.project, 'Screenplay')), false);
        assert.equal(existsSync(join(fixture.project, 'Source')), false);
        assert.equal(existsSync(join(fixture.project, '.cratis/screenplay')), false);
        assert.equal('mcpServers' in JSON.parse(readFileSync(join(fixture.project, '.cratis/ai.json'), 'utf8')), false);
    });
}

test('an application with a committed model keeps its opt-in evidence on discovery and launch configuration', t => {
    const fixture = projectFixture({ profiles: ['cratis/application/csharp'], languages: ['csharp'] }, distributedCorpus);
    mkdirSync(join(fixture.project, 'Source'));
    const source = 'module Example\n';
    writeFileSync(join(fixture.project, 'Source/model.play'), source);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: fixture.project, encoding: 'utf8' });
    git('init', '--initial-branch=main');
    git('add', 'Source/model.play');
    git('-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Accept the fixture model');
    assert.equal(git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'Source').trim(), 'Source/model.play');
    assertApplicationConsumer(t, fixture);
    assert.equal(readFileSync(join(fixture.project, 'Source/model.play'), 'utf8'), source);
    assert.equal(existsSync(join(fixture.project, 'Screenplay')), false);
});

test('an application with a configured alternate root preserves the root and project launch argument', t => {
    const fixture = projectFixture({
        profiles: ['cratis/application/csharp'], languages: ['csharp'],
        mcpServers: { screenplay: { root: 'models/app' } },
    }, distributedCorpus);
    mkdirSync(join(fixture.project, 'models/app'), { recursive: true });
    assertApplicationConsumer(t, fixture, join(fixture.project, 'models/app'));
    assert.deepEqual(readdirSync(join(fixture.project, 'models/app')), [], 'an explicitly configured empty root is opt-in without a draft');
    assert.equal(existsSync(join(fixture.project, 'Screenplay')), false);
});

test('the frontend-only React application profile selects neither Screenplay skills nor its MCP descriptor', t => {
    const fixture = projectFixture({ profiles: ['cratis/application/react'], languages: ['csharp', 'react', 'typescript'] }, distributedCorpus);
    t.after(() => rmSync(fixture.project, { recursive: true, force: true }));
    const before = readdirSync(fixture.project, { recursive: true });
    const skills = selectedSkillPaths(fixture.project).map(path => path.split('/').pop());
    assert.ok(screenplaySkills.length > 0);
    for (const skill of screenplaySkills) assert.ok(!skills.includes(skill), skill);
    assert.ok(!skills.includes('cratis-stage-rendering-and-sandbox'));
    assert.equal(selectedServer(fixture.project, fixture.corpus), undefined);
    assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before);
});

test('Screenplay child does not inherit secrets or loader injection from the parent environment', () => {
    assert.deepEqual(childEnvironment({ PATH: '/usr/bin', HOME: '/home/user', DOTNET_ROOT: '/dotnet', API_TOKEN: 'secret', NODE_OPTIONS: '--require evil.js', LD_PRELOAD: 'evil.so' }), {
        PATH: '/usr/bin', HOME: '/home/user', DOTNET_ROOT: '/dotnet',
    });
});
