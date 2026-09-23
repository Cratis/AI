// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { selectedServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/configuration.ts';
import { childEnvironment } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/process.ts';
import { projectFixture } from './pi-mcp-helpers.ts';

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
    assert.equal(selectedServer(fixture.project, fixture.corpus)?.root, join(fixture.project, '.cratis', 'screenplay'));
    fixture.configure({ profiles: ['composed'], mcpServers: { screenplay: { enabled: false } } });
    assert.equal(selectedServer(fixture.project, fixture.corpus), undefined);
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

test('Screenplay child does not inherit secrets or loader injection from the parent environment', () => {
    assert.deepEqual(childEnvironment({ PATH: '/usr/bin', HOME: '/home/user', DOTNET_ROOT: '/dotnet', API_TOKEN: 'secret', NODE_OPTIONS: '--require evil.js', LD_PRELOAD: 'evil.so' }), {
        PATH: '/usr/bin', HOME: '/home/user', DOTNET_ROOT: '/dotnet',
    });
});
