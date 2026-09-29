// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { askSystemOne, retryAfterMs, validateAnswers } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/client.ts';
import { loadConfiguration, parseUserConfiguration, resolveConfiguration } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/configuration.ts';
import { ConfigurationNotice } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/ConfigurationNotice.ts';
import { checkEndpoint, typeSafeEndpoint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/endpoint.ts';
import { BreakerState } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/BreakerState.ts';
import { CircuitBreaker } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/CircuitBreaker.ts';
import { Grant } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/Grant.ts';
import { FileState } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/FileState.ts';
import { FailureClass } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/FailureClass.ts';
import { aggregateShadow, formatReport } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/report.ts';
import { SkillRelevanceMode } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/SkillRelevanceMode.ts';
import { readUserConfigurationFile, userConfigurationPath, writeUserConfiguration } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/userConfigurationFile.ts';
import { answering, answerBody, enabledProject, fakeServer, host, json, originOf, projectFixture, promptText, skillsIn } from './pi-system-one-helpers.ts';

const secret = 'sk-test-secret-value-1234567890';
const consentedAt = '2026-01-01T00:00:00.000Z';
/** What setup records for TypeSafe with no key of its own: the parts of a complete file besides `enabled` and `consentedAt`. */
const recorded = { consentedOrigin: 'https://api.typesafe.ai', keySource: 'none' };
type Server = Awaited<ReturnType<typeof fakeServer>>;

async function withServer<T>(behavior: Parameters<typeof fakeServer>[0], run: (server: Server) => Promise<T>): Promise<T> {
    const server = await fakeServer(behavior);
    try {
        return await run(server);
    } finally {
        await server.close();
    }
}

const failOnCall = async (): Promise<Response> => { throw new Error('the transport must not be called'); };

// ---------------------------------------------------------------- unconfigured: completely silent

test('an unconfigured install sends nothing and says nothing, whatever the repository or environment offers', async () => {
    await withServer(answering(0.9), async server => {
        const environment = { CRATIS_SYSTEM_ONE: '1', SYSTEMONE_ENDPOINT: server.endpoint, SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret };
        const repositories: Array<[string, unknown]> = [
            ['no ai.json', undefined],
            ['no systemOne section', { profiles: ['cratis/documentation'] }],
            ['a repository that tries to enable and point somewhere', { systemOne: { enabled: true, endpoint: server.endpoint, apiKey: secret } }],
            ['a broken section', '{ "systemOne": '],
        ];
        for (const [name, repository] of repositories) {
            const project = projectFixture(repository);
            try {
                const session = host(project, { environment });
                const { result, unchanged } = session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                await session.settled();
                assert.equal(result, undefined, name);
                assert.ok(unchanged(), name);
                assert.deepEqual(session.entries, [], name);
                assert.deepEqual(session.notices, [], `${name}: no nags`);
                assert.match(await session.command('status'), /State: disabled \(not set up/, name);
                assert.match(await session.command('last'), /not been asked/, name);
                assert.match(await session.command('report'), /No skill-relevance turns/, name);
                assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false, `${name}: nothing was written`);
            } finally {
                project.cleanup();
            }
        }
        assert.equal(server.requests.length, 0, 'the server must receive nothing');
    });
});

test('the extension registers only the /system-one command and never touches tools or messages', () => {
    const project = projectFixture();
    try {
        const session = host(project);
        assert.deepEqual([...session.commands.keys()], ['system-one']);
        assert.deepEqual(session.misuse, []);
        assert.deepEqual([...session.handlers.keys()].sort(), ['agent_end', 'before_agent_start', 'input', 'session_shutdown', 'session_start', 'tool_result']);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- only the user enables

test('a repository can never enable System One or point it anywhere, and trying switches it off', async () => {
    await withServer(answering(0.9), async repositoryServer => {
        await withServer(answering(0.9), async userServer => {
            const enabling = { systemOne: { enabled: true, endpoint: repositoryServer.endpoint, model: 'x', apiKey: secret, timeoutMs: 100 } };

            // Nothing set up, or the user turned it off: the repository cannot change that.
            for (const user of [undefined, { enabled: false, endpoint: userServer.endpoint, consentedAt }]) {
                const project = projectFixture(enabling, user);
                try {
                    const session = host(project);
                    await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                    assert.deepEqual(session.entries, []);
                } finally {
                    project.cleanup();
                }
            }

            // The user enabled a different endpoint. The repository's attempt fails closed: nothing goes to the
            // repository's endpoint, nothing goes to the user's, and the user hears about it once.
            const project = enabledProject(userServer.endpoint, {}, enabling);
            try {
                const session = host(project);
                await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                assert.equal(repositoryServer.requests.length, 0);
                assert.equal(userServer.requests.length, 0);
                assert.equal(session.notices.length, 1, 'one notice');
                assert.match(session.notices[0], /System One is disabled: the systemOne section of \.cratis\/ai\.json is not allowed/);
                assert.equal(session.notices[0].includes(secret), false);
            } finally {
                project.cleanup();
            }
        });
    });
});

test('a repository can opt out or narrow, and any problem in .cratis/ai.json fails closed with one notice', async () => {
    await withServer(answering(0.9), async server => {
        const cases: Array<[string, unknown, { requests: number; notices: number }]> = [
            ['opt out', { systemOne: { enabled: false } }, { requests: 0, notices: 0 }],
            ['narrow to off', { systemOne: { skillRelevance: { mode: 'off' } } }, { requests: 0, notices: 0 }],
            ['both', { systemOne: { enabled: false, skillRelevance: { mode: 'off' } } }, { requests: 0, notices: 0 }],
            ['an unrelated ai.json', { profiles: ['cratis/documentation'] }, { requests: 1, notices: 0 }],
            ['no systemOne section', {}, { requests: 1, notices: 0 }],
            ['section is a string', { systemOne: 'off' }, { requests: 0, notices: 1 }],
            ['enabled true', { systemOne: { enabled: true } }, { requests: 0, notices: 1 }],
            ['enabled is not a boolean', { systemOne: { enabled: 'no' } }, { requests: 0, notices: 1 }],
            ['unknown key beside an opt-out', { systemOne: { enabled: false, sendEverything: true } }, { requests: 0, notices: 1 }],
            ['mode shadow', { systemOne: { skillRelevance: { mode: 'shadow' } } }, { requests: 0, notices: 1 }],
            ['unknown mode', { systemOne: { skillRelevance: { mode: 'hint' } } }, { requests: 0, notices: 1 }],
            ['an endpoint', { systemOne: { endpoint: 'http://127.0.0.1:1' } }, { requests: 0, notices: 1 }],
            ['a timeout', { systemOne: { timeoutMs: 1 } }, { requests: 0, notices: 1 }],
            ['invalid JSON that mentions systemOne', '{ "systemOne": { "enabled": ', { requests: 0, notices: 1 }],
            ['invalid JSON that never mentions it', '{ "profiles": [ ', { requests: 0, notices: 1 }],
            ['a JSON array', '[]', { requests: 0, notices: 1 }],
        ];
        for (const [name, repository, expected] of cases) {
            const before = server.requests.length;
            const project = enabledProject(server.endpoint, {}, repository);
            try {
                const session = host(project);
                const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
                await session.askAndSettle(promptText, skills);
                await session.askAndSettle(promptText, skills);
                assert.equal((server.requests.length - before) / 2, expected.requests, name);
                assert.equal(session.notices.length, expected.notices, `${name}: ${session.notices.join(' | ')}`);
                if (expected.notices > 0) assert.match(session.notices[0], /System One is disabled: .*stays off until that is fixed/, name);
            } finally {
                project.cleanup();
            }
        }
    });

    // A file that cannot be read is a problem too, not silence; and an unconfigured user still hears nothing.
    const project = enabledProject('http://127.0.0.1:1');
    try {
        rmSync(join(project.directory, '.cratis', 'ai.json'));
        mkdirSync(join(project.directory, '.cratis', 'ai.json'));
        const session = host(project, { transport: failOnCall });
        await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.equal(session.notices.length, 1);
        assert.match(session.notices[0], /could not be read/);
    } finally {
        project.cleanup();
    }
});

test('the environment can disable, narrow and override, but never enable', async () => {
    await withServer(answering(0.9), async server => {
        // Never enable: every variable set, nothing configured or the user turned it off.
        const environment = { CRATIS_SYSTEM_ONE: '1', SYSTEMONE_ENDPOINT: server.endpoint, SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret, CRATIS_SYSTEM_ONE_MODEL: 'jev-x' };
        for (const user of [undefined, { enabled: false, consentedAt }]) {
            const project = projectFixture({ systemOne: {} }, user);
            try {
                assert.equal(loadConfiguration(project.directory, project.agentDirectory, environment).enabled, false);
            } finally {
                project.cleanup();
            }
        }
        assert.equal(server.requests.length, 0);

        const project = enabledProject('https://example.invalid/v1/systemone');
        try {
            const configuration = (environment: NodeJS.ProcessEnv) => loadConfiguration(project.directory, project.agentDirectory, environment);
            for (const value of ['0', 'false', 'off', 'no', 'FALSE', ' Off ', 'No']) assert.equal(configuration({ CRATIS_SYSTEM_ONE: value }).enabled, false, value);
            for (const value of ['1', 'true', 'yes', '']) assert.equal(configuration({ CRATIS_SYSTEM_ONE: value }).enabled, true, value);
            // Like CRATIS_SYSTEM_ONE: trimmed, case-insensitive, and off, 0, false or no all mean off.
            for (const value of ['off', '0', 'false', 'no', 'OFF', ' Off ', 'False', 'NO', '\tno\n']) {
                const off = configuration({ CRATIS_SYSTEM_ONE_SKILL_RELEVANCE: value });
                assert.ok(off.enabled && off.settings.skillRelevance.mode === SkillRelevanceMode.Off, JSON.stringify(value));
            }
            for (const value of ['shadow', '1', 'true', 'yes', '', 'offline']) {
                const other = configuration({ CRATIS_SYSTEM_ONE_SKILL_RELEVANCE: value });
                assert.ok(other.enabled && other.settings.skillRelevance.mode === SkillRelevanceMode.Shadow, JSON.stringify(value));
            }

            // The endpoint may be overridden within the origin the user set up (another path), not to another origin.
            const overridden = configuration({ SYSTEMONE_ENDPOINT: 'https://example.invalid/custom/v1/systemone', CRATIS_SYSTEM_ONE_MODEL: 'laya' });
            assert.ok(overridden.enabled);
            assert.equal(overridden.settings.endpoint, 'https://example.invalid/custom/v1/systemone');
            assert.equal(overridden.settings.endpointFromEnvironment, true);
            assert.equal(overridden.settings.model, 'laya');
            const refused = configuration({ SYSTEMONE_ENDPOINT: 'http://example.invalid' });
            assert.ok(!refused.enabled && /SYSTEMONE_ENDPOINT/.test(refused.reason) && refused.notice);
        } finally {
            project.cleanup();
        }
    });
});

// ---------------------------------------------------------------- keys

test('a key is only ever sent to the endpoint it was meant for', async () => {
    const project = enabledProject('https://example.invalid/v1/systemone');
    try {
        const sent: Array<{ url: string; authorization?: string }> = [];
        const transport = async (input: string | URL | Request, init?: RequestInit) => {
            sent.push({ url: String(input), authorization: (init?.headers as Record<string, string>).authorization });
            return new Response(JSON.stringify(answerBody({ body: { questions: { 'skill-a': {} } } } as never, 0.5)), { status: 200 });
        };
        const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
        const run = async (user: Record<string, unknown>, environment: NodeJS.ProcessEnv) => {
            project.writeUser({ enabled: true, consentedAt, consentedOrigin: originOf(String(user.endpoint ?? typeSafeEndpoint)), keySource: user.apiKey === undefined ? 'none' : 'typed', ...user });
            const session = host(project, { transport, environment });
            await session.askAndSettle(promptText, skills);
            return session;
        };

        // A global TypeSafe key alone goes nowhere but TypeSafe.
        await run({ endpoint: 'https://example.invalid/v1/systemone' }, { TYPESAFE_API_KEY: secret });
        assert.deepEqual(sent.at(-1), { url: 'https://example.invalid/v1/systemone', authorization: undefined });
        await run({ endpoint: 'https://api.typesafe.ai.evil.example/v1/systemone' }, { TYPESAFE_API_KEY: secret });
        assert.equal(sent.at(-1)?.authorization, undefined, 'a look-alike host is not TypeSafe');
        await run({}, { TYPESAFE_API_KEY: secret });
        assert.deepEqual(sent.at(-1), { url: typeSafeEndpoint, authorization: `Bearer ${secret}` });

        // Environment keys are never attached to any loopback endpoint, http or https, whatever the variable.
        for (const endpoint of ['https://127.0.0.1:9443', 'https://localhost:9443/v1/systemone', 'https://[::1]:9443']) {
            await run({ endpoint }, { SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret });
            assert.equal(sent.at(-1)?.authorization, undefined, endpoint);
        }
        await run({ endpoint: 'https://127.0.0.1:9443/v1/systemone', apiKey: 'local-key' }, { SYSTEMONE_API_KEY: secret });
        assert.equal(sent.at(-1)?.authorization, 'Bearer local-key', 'the stored key for that exact endpoint, not the environment one');
        await run({ endpoint: 'https://127.0.0.1:9443/v1/systemone', apiKey: 'local-key' }, { SYSTEMONE_ENDPOINT: 'https://127.0.0.1:9443/other/v1/systemone' });
        assert.equal(sent.at(-1)?.authorization, undefined, 'a loopback key is bound to the exact endpoint, not just the origin');
        // Environment keys are never attached to a loopback http endpoint, whatever the variable.
        for (const environment of [{ TYPESAFE_API_KEY: secret }, { SYSTEMONE_API_KEY: secret }, { SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret }]) {
            await run({ endpoint: 'http://127.0.0.1:8000' }, environment);
            assert.deepEqual(sent.at(-1), { url: 'http://127.0.0.1:8000/v1/systemone', authorization: undefined }, JSON.stringify(Object.keys(environment)));
        }
        // ... and a loopback server gets a key only if the user stored one for that exact endpoint.
        await run({ endpoint: 'http://127.0.0.1:8000', apiKey: 'local-key' }, { SYSTEMONE_API_KEY: secret });
        assert.equal(sent.at(-1)?.authorization, 'Bearer local-key');
        for (const endpoint of ['https://127.0.0.1:9443', 'http://127.0.0.1:8000']) {
            await run({ endpoint, keySource: 'SYSTEMONE_API_KEY' }, { SYSTEMONE_API_KEY: secret });
            assert.equal(sent.at(-1)?.authorization, undefined, `${endpoint}: not even when the user agreed to that key`);
        }
        const beforeMoved = sent.length;
        await run({ endpoint: 'http://127.0.0.1:8000' }, { SYSTEMONE_ENDPOINT: 'http://127.0.0.1:9000', SYSTEMONE_API_KEY: secret });
        assert.equal(sent.length, beforeMoved, 'another origin than the one set up: nothing is sent');

        // Precedence for https: SYSTEMONE_API_KEY (only where the user agreed to it, or TypeSafe), then TYPESAFE_API_KEY (TypeSafe only), then the user's file.
        await run({ endpoint: 'https://example.invalid/v1/systemone', apiKey: 'from-file', keySource: 'SYSTEMONE_API_KEY' }, { SYSTEMONE_API_KEY: 'from-environment', TYPESAFE_API_KEY: 'typesafe' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer from-environment');
        await run({ endpoint: 'https://example.invalid/v1/systemone', apiKey: 'from-file', keySource: 'typed' }, { SYSTEMONE_API_KEY: 'from-environment' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer from-file', 'the agreed typed key, never an exported environment key');
        await run({ endpoint: 'https://example.invalid/v1/systemone', apiKey: 'from-file' }, { SYSTEMONE_API_KEY: 'from-environment' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer from-file', 'environment keys go to TypeSafe unless the user agreed to one for this origin');
        await run({ endpoint: 'https://example.invalid/v1/systemone' }, { SYSTEMONE_API_KEY: 'from-environment' });
        assert.equal(sent.at(-1)?.authorization, undefined);
        await run({ endpoint: typeSafeEndpoint, apiKey: 'from-file', keySource: 'typed' }, { SYSTEMONE_API_KEY: 'from-environment' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer from-environment', 'TypeSafe keeps the environment precedence');
        await run({ apiKey: 'from-file' }, { TYPESAFE_API_KEY: 'typesafe' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer typesafe');
        await run({ endpoint: 'https://example.invalid/v1/systemone', apiKey: 'from-file' }, { TYPESAFE_API_KEY: 'typesafe' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer from-file');
        await run({ endpoint: 'http://127.0.0.1:8000' }, {});
        assert.equal(sent.at(-1)?.authorization, undefined, 'no key is fine for loopback');

        // A stored key is bound to the endpoint it was stored for. SYSTEMONE_ENDPOINT moving the destination
        // elsewhere must not carry the key along, however the origin is spelled.
        // Since another origin than the one set up switches System One off, nothing is sent at all.
        const bound = { endpoint: 'https://example.invalid/v1/systemone', apiKey: 'stored-key' };
        for (const moved of ['https://other.invalid/v1/systemone', 'https://example.invalid:8443/v1/systemone', 'http://127.0.0.1:8000']) {
            const before = sent.length;
            await run(bound, { SYSTEMONE_ENDPOINT: moved });
            assert.equal(sent.length, before, `${moved}: another origin, so nothing is sent, and the key stays home`);
        }
        await run(bound, { SYSTEMONE_ENDPOINT: 'https://example.invalid/other/v1/systemone' });
        assert.equal(sent.at(-1)?.authorization, 'Bearer stored-key', 'same origin, so the same key');
        const beforeDefault = sent.length;
        await run({ apiKey: 'stored-key' }, { SYSTEMONE_ENDPOINT: 'https://other.invalid/v1/systemone' });
        assert.equal(sent.length, beforeDefault, 'a key stored for the TypeSafe default stays with TypeSafe');

        // No key ever reaches status, entries or notices.
        const session = await run({ endpoint: 'https://example.invalid/v1/systemone', apiKey: 'file-key-value' }, { SYSTEMONE_API_KEY: 'env-key-value' });
        const shown = [await session.command('status'), await session.command('last'), await session.command('report'), JSON.stringify(session.entries), session.notices.join('\n')].join('\n');
        for (const key of [secret, 'file-key-value', 'env-key-value', 'stored-key']) assert.equal(shown.includes(key), false, key);
        assert.match(shown, /credential attached/);
    } finally {
        project.cleanup();
    }
});

test('a redirect is refused, so a server cannot forward the prompt or the key', async () => {
    await withServer(answering(0.5), async target => {
        await withServer((_request, response) => { response.writeHead(307, { location: `${target.endpoint}/v1/systemone` }); response.end(); }, async redirecting => {
            const project = enabledProject(redirecting.endpoint, { apiKey: secret });
            try {
                const session = host(project);
                await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                assert.equal(target.requests.length, 0);
                assert.deepEqual(session.entries.map(entry => entry.data.failure), ['network']);
            } finally {
                project.cleanup();
            }
        });
    });
});

// ---------------------------------------------------------------- endpoints and the user file

test('endpoints must be https, or http only for loopback, and bare origins get the standard path', () => {
    for (const endpoint of ['http://127.0.0.1:8000', 'http://localhost:8000/', 'http://[::1]:8000', 'https://127.0.0.1:9443/base', 'https://api.typesafe.ai/v1/systemone', 'https://opencode.ai/zen/v1/systemone']) {
        const checked = checkEndpoint(endpoint);
        assert.ok(!('error' in checked), endpoint);
    }
    for (const endpoint of ['http://example.invalid', 'http://0.0.0.0', 'http://0.0.0.0:8000', 'http://[::ffff:127.0.0.1]:8000', 'http://[::ffff:7f00:1]', 'http://10.0.0.5:8000', 'http://127.0.0.1@example.invalid', 'http://localhost.example.invalid', 'http://127.0.0.1.example.invalid', 'http://user:pass@127.0.0.1:8000', 'ftp://127.0.0.1', 'http://127.0.0.1:8000/?x=1', 'https://example.invalid/#x', 'not a url']) {
        assert.ok('error' in checkEndpoint(endpoint), endpoint);
    }
    const bare = checkEndpoint('http://localhost:8000');
    assert.ok(!('error' in bare));
    assert.equal(bare.endpoint, 'http://localhost:8000/v1/systemone');
    assert.equal(bare.origin, 'http://localhost:8000');
    assert.equal(bare.loopback, true);
    const full = checkEndpoint('https://example.invalid/custom/v1/systemone/');
    assert.ok(!('error' in full));
    assert.equal(full.endpoint, 'https://example.invalid/custom/v1/systemone');
    assert.equal(full.loopback, false);
});

test('every loopback form is loopback for keys, and unspecified addresses are refused', async () => {
    // What the URL parser makes of each form is what is checked, so every spelling is covered.
    const loopbackForms = ['https://127.0.0.2', 'https://127.255.255.254:9443', 'https://127.1', 'https://2130706433', 'https://0x7f.0.0.1', 'https://[::1]', 'https://[0:0:0:0:0:0:0:1]', 'https://[::ffff:127.0.0.1]', 'https://[::ffff:7f00:1]', 'https://[::ffff:7f00:2]', 'https://[0:0:0:0:0:ffff:7f00:1]', 'https://[::127.0.0.1]', 'https://localhost', 'https://localhost.', 'https://LOCALHOST', 'https://a.localhost', 'https://a.b.localhost.', 'https://api.localhost:8443/v1/systemone'];
    for (const endpoint of loopbackForms) {
        const checked = checkEndpoint(endpoint);
        assert.ok(!('error' in checked), endpoint);
        assert.equal(checked.loopback, true, endpoint);
        const project = enabledProject(endpoint);
        try {
            const configuration = loadConfiguration(project.directory, project.agentDirectory, { SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret });
            assert.ok(configuration.enabled, endpoint);
            assert.equal(configuration.settings.apiKey, undefined, `${endpoint}: an environment key never goes to loopback`);
            project.writeUser({ enabled: true, endpoint, consentedAt, consentedOrigin: originOf(endpoint), keySource: 'SYSTEMONE_API_KEY' });
            const agreed = loadConfiguration(project.directory, project.agentDirectory, { SYSTEMONE_API_KEY: secret });
            assert.ok(agreed.enabled && agreed.settings.apiKey === undefined, `${endpoint}: not even one the user agreed to`);
        } finally {
            project.cleanup();
        }
    }
    // Only addresses that are certainly this machine, and the name localhost, may use plain http.
    for (const endpoint of ['http://127.0.0.2:8000', 'http://127.1:8000', 'http://localhost.:8000', 'http://[::1]:8000', 'http://LOCALHOST:8000']) assert.ok(!('error' in checkEndpoint(endpoint)), endpoint);
    for (const endpoint of ['http://a.localhost:8000', 'http://[::ffff:7f00:1]:8000', 'http://[::127.0.0.1]:8000', 'http://128.0.0.1:8000']) assert.ok('error' in checkEndpoint(endpoint), endpoint);
    // Not loopback: a look-alike, or a neighbor of one, still gets the environment key and needs https.
    for (const endpoint of ['https://128.0.0.1', 'https://126.255.255.255', 'https://[::ffff:8000:1]', 'https://localhost.example.invalid', 'https://notlocalhost', 'https://localhost-x.example.invalid', 'https://a-localhost.invalid']) {
        const checked = checkEndpoint(endpoint);
        assert.ok(!('error' in checked), endpoint);
        assert.equal(checked.loopback, false, endpoint);
    }
    const project = enabledProject('https://128.0.0.1', { keySource: 'SYSTEMONE_API_KEY' });
    try {
        const configuration = loadConfiguration(project.directory, project.agentDirectory, { SYSTEMONE_API_KEY: secret });
        assert.ok(configuration.enabled && configuration.settings.apiKey === secret, 'control: a non-loopback https endpoint still gets the key');
    } finally {
        project.cleanup();
    }
    // Unspecified addresses mean "any address here", so they are refused outright, over http or https.
    for (const endpoint of ['http://0.0.0.0', 'https://0.0.0.0', 'https://0.0.0.0:8443/v1/systemone', 'https://0', 'https://0x0', 'https://0.1.2.3', 'http://[::]', 'https://[::]', 'https://[0:0:0:0:0:0:0:0]', 'https://[::ffff:0.0.0.0]', 'https://[::ffff:0:0]']) {
        const checked = checkEndpoint(endpoint);
        assert.ok('error' in checked && /unspecified address/.test(checked.error), endpoint);
    }
});

test('an endpoint the user configured but that is not allowed disables System One with one notice and sends nothing', async () => {
    for (const endpoint of ['http://example.invalid', 'http://0.0.0.0:8000', 'http://[::ffff:127.0.0.1]:8000', 'https://user:pass@example.invalid', 'ftp://example.invalid']) {
        const project = enabledProject(endpoint);
        try {
            const session = host(project, { transport: failOnCall });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle(promptText, skills);
            await session.askAndSettle(promptText, skills);
            assert.equal(session.notices.length, 1, endpoint);
            assert.match(session.notices[0], /System One is disabled/);
            assert.deepEqual(session.entries, []);
        } finally {
            project.cleanup();
        }
    }
});

test('each kind of configuration notice is announced once, and one never hides another later in the session', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            chmodSync(join(project.agentDirectory, 'cratis-system-one.json'), 0o644);
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle(promptText, skills);
            await session.askAndSettle(promptText, skills);
            assert.equal(session.notices.length, 1, 'the same notice raised twice is shown once');
            assert.match(session.notices[0], /can be read by other users.*chmod 600/);

            // The repository later refuses to be trusted: a different kind of notice, which must still be heard.
            project.configure({ systemOne: { enabled: true } });
            await session.askAndSettle(promptText, skills);
            await session.askAndSettle(promptText, skills);
            assert.equal(session.notices.length, 2, session.notices.join(' | '));
            assert.match(session.notices[1], /System One is disabled: .*stays off until that is fixed/);

            // The repository is fixed, but the user's file now predates this version: yet another kind.
            project.configure({});
            project.writeUser({ enabled: true, consentedAt });
            await session.askAndSettle(promptText, skills);
            await session.askAndSettle(promptText, skills);
            assert.equal(session.notices.length, 3, session.notices.join(' | '));
            assert.match(session.notices[2], /your settings predate this version/);
        } finally {
            project.cleanup();
        }
    });
});

test('every configuration notice names its own kind', () => {
    const user = (fields: Record<string, unknown>) => ({ state: FileState.Present as const, text: JSON.stringify({ enabled: true, consentedAt, ...recorded, ...fields }) });
    const resolve = (inputs: Partial<Parameters<typeof resolveConfiguration>[0]>) => resolveConfiguration({ user: user({}), repository: { state: FileState.Missing }, environment: {}, ...inputs });
    const kinds = [
        resolve({ user: { ...user({}), readableByOthers: true } }),
        resolve({ user: user({ consentedOrigin: undefined, keySource: undefined }) }),
        resolve({ user: user({ endpoint: 'https://other.invalid/v1/systemone' }) }),
        resolve({ repository: { state: FileState.Present, text: '[]' } }),
        resolve({ user: { state: FileState.Present, text: '[]' } }),
        resolve({ user: { state: FileState.Unreadable } }),
        resolve({ user: user({ endpoint: 'http://example.invalid' }) }),
        resolve({ environment: { CRATIS_SYSTEM_ONE_MODEL: 'a b; c' } }),
    ].map(result => result.noticeClass);
    assert.ok(kinds.every(kind => kind !== undefined), `every notice has a kind: ${kinds.join(', ')}`);
    assert.equal(new Set(kinds).size, Object.keys(ConfigurationNotice).length, 'each kind of notice has its own class');
    assert.equal(resolve({}).noticeClass, undefined, 'no notice, no class');
});

test('the user file is validated strictly, and defaults are the TypeSafe endpoint and jev-1.13.0', async () => {
    const project = projectFixture();
    try {
        const bad: Array<[string, unknown]> = [
            ['invalid JSON', '{ "enabled": true, '],
            ['an array', '[]'],
            ['unknown key', { enabled: true, consentedAt, timeoutMs: 1 }],
            ['enabled missing', { consentedAt }],
            ['enabled not boolean', { enabled: 'yes', consentedAt }],
            ['consent not recorded', { enabled: true }],
            ['consent not a date', { enabled: true, consentedAt: 'yesterday' }],
            ['empty key', { enabled: true, consentedAt, apiKey: '' }],
            ['non-string endpoint', { enabled: true, consentedAt, endpoint: 8000 }],
            ['bad mode', { enabled: true, consentedAt, skillRelevance: { mode: 'hint' } }],
            ['extra relevance key', { enabled: true, consentedAt, skillRelevance: { mode: 'shadow', maxQuestions: 500 } }],
            ['bad model', { enabled: true, consentedAt, model: 'a b; c' }],
        ];
        for (const [name, user] of bad) {
            project.writeUser(user);
            assert.throws(() => parseUserConfiguration(typeof user === 'string' ? user : JSON.stringify(user)), name);
            const result = loadConfiguration(project.directory, project.agentDirectory, {});
            assert.equal(result.enabled, false, name);
            assert.ok(!result.enabled && result.configured && result.notice, `${name}: one notice for a configured user`);
        }

        project.writeUser({ enabled: true, consentedAt, ...recorded });
        const defaults = loadConfiguration(project.directory, project.agentDirectory, {});
        assert.ok(defaults.enabled);
        assert.equal(defaults.settings.endpoint, typeSafeEndpoint);
        assert.equal(defaults.settings.model, 'jev-1.13.0');
        assert.equal(defaults.settings.timeoutMs, 5000);
        assert.deepEqual(defaults.settings.skillRelevance, { mode: 'shadow', maxQuestions: 128, chunkSize: 32, minPromptChars: 20, stateChars: 1200, criterionChars: 200 });

        // resolveConfiguration is pure: the same inputs give the same answer with no files at all.
        assert.deepEqual(resolveConfiguration({ user: { state: FileState.Present, text: JSON.stringify({ enabled: true, consentedAt, ...recorded }) }, repository: { state: FileState.Missing }, environment: {} }), defaults);
        assert.equal(resolveConfiguration({ user: { state: FileState.Missing }, repository: { state: FileState.Present, text: '{ "systemOne": { "enabled": true } }' }, environment: { CRATIS_SYSTEM_ONE: '1' } }).enabled, false);
    } finally {
        project.cleanup();
    }
});

test('the user file is written atomically with mode 0600 and round-trips', () => {
    const project = projectFixture();
    try {
        const path = userConfigurationPath(project.agentDirectory);
        writeFileSync(path, '{}');
        chmodSync(path, 0o644);
        assert.equal(statSync(path).mode & 0o777, 0o644);

        const written = writeUserConfiguration(project.agentDirectory, { enabled: true, endpoint: 'https://example.invalid/v1/systemone', apiKey: secret, consentedAt, skillRelevance: { mode: SkillRelevanceMode.Shadow } });
        assert.equal(written, path);
        assert.equal(statSync(path).mode & 0o777, 0o600, 'an existing file is replaced by a private one');
        assert.deepEqual(readdirSync(project.agentDirectory), ['cratis-system-one.json'], 'no temp file is left behind');
        assert.deepEqual(parseUserConfiguration((readUserConfigurationFile(project.agentDirectory) as { text: string }).text), { enabled: true, endpoint: 'https://example.invalid/v1/systemone', apiKey: secret, consentedAt, skillRelevance: { mode: 'shadow' } });

        const nested = join(project.agentDirectory, 'a', 'b');
        writeUserConfiguration(nested, { enabled: false, consentedAt });
        assert.equal(statSync(userConfigurationPath(nested)).mode & 0o777, 0o600);
    } finally {
        project.cleanup();
    }
});

test('an unreadable user file is reported as unreadable, and a file others can read is flagged once', () => {
    const project = projectFixture();
    try {
        // A directory where the file should be cannot be read.
        mkdirSync(userConfigurationPath(project.agentDirectory));
        assert.equal(readUserConfigurationFile(project.agentDirectory).state, FileState.Unreadable);
        const unreadable = loadConfiguration(project.directory, project.agentDirectory, {});
        assert.ok(!unreadable.enabled && unreadable.configured);
        assert.match(unreadable.enabled ? '' : unreadable.reason, /could not be read/);
        assert.match(unreadable.enabled ? '' : unreadable.notice ?? '', /could not be read/);
        rmSync(userConfigurationPath(project.agentDirectory), { recursive: true });

        const path = userConfigurationPath(project.agentDirectory);
        writeFileSync(path, JSON.stringify({ enabled: true, consentedAt, ...recorded, apiKey: secret }));
        chmodSync(path, 0o644);
        const open = loadConfiguration(project.directory, project.agentDirectory, {});
        assert.ok(open.enabled);
        assert.match(open.notice ?? '', /can be read by other users.*chmod 600/);
        assert.equal((open.notice ?? '').includes(secret), false);
        chmodSync(path, 0o600);
        const closed = loadConfiguration(project.directory, project.agentDirectory, {});
        assert.ok(closed.enabled && closed.notice === undefined);
    } finally {
        project.cleanup();
    }
});

test('a failed write leaves no temp file behind and the old file intact', () => {
    const project = projectFixture();
    try {
        // A non-empty directory where the file should go makes the final rename fail.
        const path = userConfigurationPath(project.agentDirectory);
        mkdirSync(join(path, 'inside'), { recursive: true });
        assert.throws(() => writeUserConfiguration(project.agentDirectory, { enabled: true, apiKey: secret, consentedAt }));
        assert.deepEqual(readdirSync(project.agentDirectory), ['cratis-system-one.json'], 'the temp file was removed');
        assert.equal(existsSync(join(path, 'inside')), true);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- /system-one setup and off

const setupSkills = 'cratis-arc-command';
const local = 'Local server such as Laya (loopback URL)';
const typeSafe = 'TypeSafe Jev (recommended)';
const other = 'Other System One provider (endpoint URL)';

test('setup states what is sent, confirms, probes, and only then saves a private file', async () => {
    await withServer(answering(0.97), async server => {
        const project = projectFixture();
        try {
            const session = host(project, {}, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true] } });
            const output = await session.command('setup');

            assert.equal(server.requests.length, 1, 'exactly one probe request');
            const probe = server.requests[0];
            assert.deepEqual(Object.keys(probe.body.questions), [setupSkills]);
            assert.equal(probe.body.questions[setupSkills].type, 'noul');
            assert.equal(probe.headers.authorization, undefined);

            const confirm = session.prompts.find(prompt => prompt.kind === 'confirm');
            assert.ok(confirm);
            assert.equal(confirm.userFileExisted, false, 'nothing is saved before the user confirms');
            assert.ok(confirm.detail?.includes(server.endpoint), 'names the destination');
            assert.match(confirm.detail!, /first 1200 characters of each prompt you type in an interactive session/);
            assert.match(confirm.detail!, /in repositories set up with Cratis AI/);
            assert.match(confirm.detail!, /names and first sentence/);
            // Accurate rather than absolute: what is skipped is listed, and so is what still goes.
            assert.match(confirm.detail!, /Skipped, never sent: slash commands, skill and template invocations, subagent tasks, prompts Pi built around @file arguments or that start with "<", prompts rewritten after this extension saw them, and prompts from extensions, RPC hosts or sessions without a UI\. This extension does not read tool result content\./);
            assert.doesNotMatch(confirm.detail!, /tool output/i, 'no claim about tool output');
            assert.match(confirm.detail!, /Anything else that reaches Pi as typed interactive input is sent: pasted text, text you resubmit from \/tree or \/fork, and text produced by another extension's editor or earlier input handler\./);
            assert.doesNotMatch(confirm.detail!, /file contents are never sent/i, 'no claim the residuals contradict');
            assert.match(confirm.detail!, /with each request, no credential\./);
            assert.match(confirm.detail!, /Setup remembers this destination and credential: if SYSTEMONE_ENDPOINT later points to another origin, System One turns itself off until you run setup again\./);
            assert.doesNotMatch(confirm.detail!, /after slash-command expansion/);
            assert.match(confirm.detail!, /\/system-one off/);

            assert.match(output, /Probe of http:\/\/127\.0\.0\.1:\d+ succeeded in \d+ ms: cratis-arc-command scored 0\.97/);
            assert.match(output, /System One enabled in shadow mode/);
            const path = userConfigurationPath(project.agentDirectory);
            assert.equal(statSync(path).mode & 0o777, 0o600);
            const saved = JSON.parse(readFileSync(path, 'utf8'));
            assert.equal(saved.enabled, true);
            assert.equal(saved.endpoint, `${server.endpoint}/v1/systemone`);
            assert.equal(saved.apiKey, undefined);
            assert.ok(!Number.isNaN(Date.parse(saved.consentedAt)));
            assert.deepEqual(saved.skillRelevance, { mode: 'shadow' });

            // And it now works: a turn is asked about.
            project.configure({});
            await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(server.requests.length, 2);
        } finally {
            project.cleanup();
        }
    });
});

test('setup for TypeSafe stores a typed key only in the private file, and never echoes it', async () => {
    const project = projectFixture();
    try {
        const sent: Array<{ url: string; authorization?: string }> = [];
        const transport = async (input: string | URL | Request, init?: RequestInit) => {
            sent.push({ url: String(input), authorization: (init?.headers as Record<string, string>).authorization });
            return new Response(JSON.stringify({ model: 'jev-1.13.0', answers: { [setupSkills]: { type: 'noul', noul: 0.88 } } }), { status: 200 });
        };
        const session = host(project, { transport }, { script: { select: typeSafe, inputs: [secret], confirms: [true] } });
        const output = await session.command('setup');
        assert.deepEqual(sent, [{ url: typeSafeEndpoint, authorization: `Bearer ${secret}` }]);
        const confirm = session.prompts.find(prompt => prompt.kind === 'confirm')!;
        assert.match(confirm.detail!, /https:\/\/api\.typesafe\.ai/);
        assert.match(confirm.detail!, /docs\.typesafe\.ai\/legal/);
        const shown = [output, ...session.prompts.map(prompt => `${prompt.title} ${prompt.detail ?? ''}`)].join('\n');
        assert.equal(shown.includes(secret), false, 'the key is never displayed');
        const path = userConfigurationPath(project.agentDirectory);
        assert.equal(JSON.parse(readFileSync(path, 'utf8')).apiKey, secret);
        assert.equal(statSync(path).mode & 0o777, 0o600);
    } finally {
        project.cleanup();
    }
});

test('setup uses an environment key without asking for one or storing it', async () => {
    const project = projectFixture();
    try {
        const sent: Array<string | undefined> = [];
        const transport = async (_input: string | URL | Request, init?: RequestInit) => {
            sent.push((init?.headers as Record<string, string>).authorization);
            return new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
        };
        const session = host(project, { transport, environment: { TYPESAFE_API_KEY: secret } }, { script: { select: typeSafe, confirms: [true] } });
        await session.command('setup');
        assert.deepEqual(sent, [`Bearer ${secret}`]);
        assert.equal(session.prompts.some(prompt => prompt.kind === 'input'), false, 'no key prompt');
        assert.equal(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8').includes(secret), false);
    } finally {
        project.cleanup();
    }
});

test('setup names the credential that goes with the requests, and never shows its value', async () => {
    const cases: Array<[string, string, NodeJS.ProcessEnv, string[], RegExp]> = [
        ['TypeSafe with TYPESAFE_API_KEY', typeSafe, { TYPESAFE_API_KEY: secret }, [], /a credential: your TYPESAFE_API_KEY from the environment \(the value is never shown\)/],
        ['TypeSafe with SYSTEMONE_API_KEY', typeSafe, { SYSTEMONE_API_KEY: secret }, [], /a credential: your SYSTEMONE_API_KEY from the environment/],
        ['TypeSafe with a typed key', typeSafe, {}, [secret], /a credential: the key you entered/],
    ];
    for (const [name, choice, environment, inputs, expected] of cases) {
        const project = projectFixture();
        try {
            const transport = async () => new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
            const session = host(project, { transport, environment }, { script: { select: choice, inputs, confirms: [true] } });
            const output = await session.command('setup');
            const confirm = session.prompts.find(prompt => prompt.kind === 'confirm')!;
            assert.match(confirm.detail!, expected, name);
            assert.equal([output, ...session.prompts.map(prompt => `${prompt.title} ${prompt.detail ?? ''}`)].join('\n').includes(secret), false, `${name}: the value is never shown`);
            assert.equal(session.prompts.filter(prompt => prompt.kind === 'confirm').length, 1, `${name}: TypeSafe's own origin needs no extra confirmation`);
        } finally {
            project.cleanup();
        }
    }
});

test('an environment key headed for an origin other than TypeSafe needs a second, explicit confirmation before anything is sent', async () => {
    const endpoint = 'https://opencode.ai/zen/v1/systemone';
    const environment = { SYSTEMONE_API_KEY: secret };
    const project = projectFixture();
    try {
        const sent: Array<string | undefined> = [];
        const transport = async (_input: string | URL | Request, init?: RequestInit) => {
            sent.push((init?.headers as Record<string, string>).authorization);
            return new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
        };
        // Declining the second question stops before the probe and saves nothing.
        const declined = host(project, { transport, environment }, { script: { select: other, inputs: [endpoint], confirms: [true, false] } });
        const output = await declined.command('setup');
        const questions = declined.prompts.filter(prompt => prompt.kind === 'confirm');
        assert.equal(questions.length, 2);
        assert.match(questions[0].detail!, /a credential: your SYSTEMONE_API_KEY from the environment/);
        assert.match(questions[1].title, /Send your SYSTEMONE_API_KEY from the environment to https:\/\/opencode\.ai\?/);
        assert.match(questions[1].detail!, /was not issued for https:\/\/opencode\.ai/);
        assert.deepEqual(sent, [], 'nothing was sent');
        assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false, 'nothing was saved');
        assert.match(output, /cancelled/);
        assert.equal([output, ...declined.prompts.map(prompt => `${prompt.title} ${prompt.detail ?? ''}`)].join('\n').includes(secret), false);

        // Agreeing sends the probe with that key.
        const agreed = host(project, { transport, environment }, { script: { select: other, inputs: [endpoint], confirms: [true, true] } });
        await agreed.command('setup');
        assert.deepEqual(sent, [`Bearer ${secret}`]);
        assert.equal(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8').includes(secret), false, 'the environment key is not stored');
    } finally {
        project.cleanup();
    }
});

test('a key the user typed, and no key at all, are named without the extra confirmation', async () => {
    await withServer(answering(0.5), async server => {
        const project = projectFixture();
        try {
            const transport = async () => new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
            const typed = host(project, { transport }, { script: { select: other, inputs: ['https://opencode.ai/zen/v1/systemone', 'zen-key'], confirms: [true] } });
            await typed.command('setup');
            const confirms = typed.prompts.filter(prompt => prompt.kind === 'confirm');
            assert.equal(confirms.length, 1);
            assert.match(confirms[0].detail!, /a credential: the key you entered \(the value is never shown\)/);
            assert.equal(confirms[0].detail!.includes('zen-key'), false);

            const none = host(project, {}, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true] } });
            await none.command('setup');
            assert.match(none.prompts.find(prompt => prompt.kind === 'confirm')!.detail!, /with each request, no credential\./);
        } finally {
            project.cleanup();
        }
    });
});

async function setUpAndCapture(project: ReturnType<typeof projectFixture>, script: { select: string; inputs?: string[]; confirms: boolean[] }, environment: NodeJS.ProcessEnv): Promise<Array<string | undefined>> {
    const sent: Array<string | undefined> = [];
    const transport = async (_input: string | URL | Request, init?: RequestInit) => {
        sent.push((init?.headers as Record<string, string>).authorization);
        return new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
    };
    await host(project, { transport, environment }, { script }).command('setup');
    return sent;
}

test('setup records the consented origin and the agreed credential, and status names the source without its value', async () => {
    const cases: Array<[string, string, string[], NodeJS.ProcessEnv, string, string, RegExp]> = [
        ['a typed key', other, ['https://opencode.ai/zen/v1/systemone', 'zen-key'], {}, 'typed', 'https://opencode.ai', /Credential: stored key$/m],
        ['SYSTEMONE_API_KEY', other, ['https://opencode.ai/zen/v1/systemone'], { SYSTEMONE_API_KEY: secret }, 'SYSTEMONE_API_KEY', 'https://opencode.ai', /Credential: SYSTEMONE_API_KEY from the environment$/m],
        ['TYPESAFE_API_KEY', typeSafe, [], { TYPESAFE_API_KEY: secret }, 'TYPESAFE_API_KEY', 'https://api.typesafe.ai', /Credential: TYPESAFE_API_KEY from the environment$/m],
    ];
    for (const [name, choice, inputs, environment, keySource, origin, credentialLine] of cases) {
        const project = projectFixture();
        try {
            const confirms = keySource === 'SYSTEMONE_API_KEY' ? [true, true] : [true];
            await setUpAndCapture(project, { select: choice, inputs, confirms }, environment);
            const saved = JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8'));
            assert.equal(saved.consentedOrigin, origin, name);
            assert.equal(saved.keySource, keySource, name);
            const status = await host(project, { environment }).command('status');
            assert.match(status, credentialLine, name);
            assert.equal(status.includes(secret) || status.includes('zen-key'), false, `${name}: never the value`);
        } finally {
            project.cleanup();
        }
    }
    const project = projectFixture();
    try {
        await setUpAndCapture(project, { select: local, inputs: ['http://127.0.0.1:8000', ''], confirms: [true] }, {});
        const saved = JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8'));
        assert.deepEqual([saved.consentedOrigin, saved.keySource], ['http://127.0.0.1:8000', 'none']);
        assert.match(await host(project, {}).command('status'), /Credential: none$/m);
    } finally {
        project.cleanup();
    }
});

test('a typed key agreed for one origin is what is sent, even when SYSTEMONE_API_KEY is exported later', async () => {
    const project = projectFixture();
    try {
        await setUpAndCapture(project, { select: other, inputs: ['https://opencode.ai/zen/v1/systemone', 'zen-key'], confirms: [true] }, {});
        const sent: Array<string | undefined> = [];
        const transport = async (_input: string | URL | Request, init?: RequestInit) => {
            sent.push((init?.headers as Record<string, string>).authorization);
            return new Response(JSON.stringify(answerBody({ body: { questions: { 'skill-a': {} } } } as never, 0.5)), { status: 200 });
        };
        const session = host(project, { transport, environment: { SYSTEMONE_API_KEY: 'exported-later', TYPESAFE_API_KEY: 'typesafe-later' } });
        // The project needs to be a Cratis repository for turns to be judged.
        project.configure({});
        await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.deepEqual(sent, ['Bearer zen-key'], 'the typed key, never the exported one');
        const status = await session.command('status');
        assert.match(status, /Credential: stored key \(SYSTEMONE_API_KEY is set in the environment but ignored: you did not agree to it for https:\/\/opencode\.ai in setup\)/);
        assert.equal(['exported-later', 'typesafe-later', 'zen-key'].some(value => status.includes(value)), false);
    } finally {
        project.cleanup();
    }
});

test('an origin the user never set up switches System One off, with one notice and nothing sent', async () => {
    const project = projectFixture();
    try {
        // Set up TypeSafe (the default endpoint), then point SYSTEMONE_ENDPOINT somewhere else.
        await setUpAndCapture(project, { select: typeSafe, confirms: [true] }, { TYPESAFE_API_KEY: secret });
        project.configure({});
        const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
        const environment = { SYSTEMONE_ENDPOINT: 'https://other.invalid/v1/systemone', SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret };
        const moved = host(project, { transport: failOnCall, environment });
        await moved.askAndSettle(promptText, skills);
        await moved.askAndSettle(promptText, skills);
        assert.deepEqual(moved.notices, ['System One: SYSTEMONE_ENDPOINT points to https://other.invalid, which you did not set up; run /system-one setup to use it.'], 'one notice');
        assert.deepEqual(moved.entries, []);
        assert.match(await moved.command('status'), /State: disabled \(SYSTEMONE_ENDPOINT points to https:\/\/other\.invalid, which you did not set up/);

        // The same origin with another path is the same destination, and TypeSafe's own key still applies there.
        const sent: Array<{ url: string; authorization?: string }> = [];
        const transport = async (input: string | URL | Request, init?: RequestInit) => {
            sent.push({ url: String(input), authorization: (init?.headers as Record<string, string>).authorization });
            return new Response(JSON.stringify(answerBody({ body: { questions: { 'skill-a': {} } } } as never, 0.5)), { status: 200 });
        };
        await host(project, { transport, environment: { SYSTEMONE_ENDPOINT: 'https://api.typesafe.ai/custom/v1/systemone', TYPESAFE_API_KEY: secret } }).askAndSettle(promptText, skills);
        assert.deepEqual(sent, [{ url: 'https://api.typesafe.ai/custom/v1/systemone', authorization: `Bearer ${secret}` }]);
    } finally {
        project.cleanup();
    }
});

test('setup refuses a SYSTEMONE_ENDPOINT that points to another origin, before asking, disclosing, probing or saving', async () => {
    const cases: Array<[string, { select: string; inputs?: string[]; confirms: boolean[] }, NodeJS.ProcessEnv, RegExp]> = [
        ['TypeSafe with its key, overridden to another origin', { select: typeSafe, confirms: [true] }, { TYPESAFE_API_KEY: secret, SYSTEMONE_ENDPOINT: 'https://other.invalid/v1/systemone' }, /SYSTEMONE_ENDPOINT points to https:\/\/other\.invalid, not https:\/\/api\.typesafe\.ai\. Unset it, or choose that endpoint \(Other System One provider\) in setup\. Nothing was saved\./],
        ['another provider, overridden to TypeSafe', { select: other, inputs: ['https://opencode.ai/zen/v1/systemone', 'zen-key'], confirms: [true] }, { SYSTEMONE_ENDPOINT: typeSafeEndpoint }, /SYSTEMONE_ENDPOINT points to https:\/\/api\.typesafe\.ai, not https:\/\/opencode\.ai\./],
        ['a local server, overridden to another port', { select: local, inputs: ['http://127.0.0.1:8000', ''], confirms: [true] }, { SYSTEMONE_ENDPOINT: 'http://127.0.0.1:9000' }, /SYSTEMONE_ENDPOINT points to http:\/\/127\.0\.0\.1:9000, not http:\/\/127\.0\.0\.1:8000\./],
    ];
    for (const [name, script, environment, expected] of cases) {
        const project = projectFixture();
        try {
            const session = host(project, { transport: failOnCall, environment }, { script });
            const output = await session.command('setup');
            assert.match(output, expected, name);
            assert.deepEqual(session.prompts.filter(prompt => prompt.kind !== 'select' && !(prompt.kind === 'input' && /URL/.test(prompt.title))), [], `${name}: no key question, no disclosure`);
            assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false, `${name}: nothing saved`);
            assert.equal([output, ...session.prompts.map(prompt => `${prompt.title} ${prompt.detail ?? ''}`)].join('\n').includes(secret), false, name);
        } finally {
            project.cleanup();
        }
    }
});

test('setup with a path-only SYSTEMONE_ENDPOINT records the chosen origin and runs at the effective URL', async () => {
    await withServer(answering(0.6), async server => {
        const project = projectFixture();
        try {
            const environment = { SYSTEMONE_ENDPOINT: `${server.endpoint}/elsewhere/v1/systemone` };
            await host(project, { environment }, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true] } }).command('setup');
            const saved = JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8'));
            assert.equal(saved.consentedOrigin, new URL(server.endpoint).origin);
            assert.equal(saved.endpoint, `${server.endpoint}/v1/systemone`, 'the file keeps the user\'s choice');
            project.configure({});
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);

            // With the same override it keeps running against the origin the user agreed to, at that path.
            await host(project, { environment }).askAndSettle(promptText, skills);
            assert.equal(server.requests.at(-1)?.url, '/elsewhere/v1/systemone');
            // Without it the chosen path on the same origin is fine too.
            await host(project, {}).askAndSettle(promptText, skills);
            assert.equal(server.requests.at(-1)?.url, '/v1/systemone');
        } finally {
            project.cleanup();
        }
    });
});

test('a user file that predates the recorded origin and credential is refused with one notice, and nothing is sent', async () => {
    const legacy: Array<[string, Record<string, unknown>]> = [
        ['neither field', { enabled: true, consentedAt }],
        ['an endpoint and a key but neither field', { enabled: true, consentedAt, endpoint: 'https://opencode.ai/zen/v1/systemone', apiKey: 'zen-key' }],
        ['only consentedOrigin', { enabled: true, consentedAt, consentedOrigin: 'https://api.typesafe.ai' }],
        ['only keySource', { enabled: true, consentedAt, keySource: 'none' }],
    ];
    const notice = 'System One: your settings predate this version; run /system-one setup again.';
    for (const [name, user] of legacy) {
        const project = projectFixture({}, user);
        try {
            const session = host(project, { transport: failOnCall, environment: { SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret } });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle(promptText, skills);
            await session.askAndSettle(promptText, skills);
            assert.deepEqual(session.notices, [notice], `${name}: one notice`);
            assert.deepEqual(session.entries, [], name);
            assert.match(await session.command('status'), /State: disabled \(your settings predate this version; run \/system-one setup again\)/, name);
        } finally {
            project.cleanup();
        }
    }
    // A file that is turned off stays quiet, and /system-one off still works on an old file.
    const project = projectFixture({}, { enabled: false, consentedAt });
    try {
        const session = host(project, { transport: failOnCall });
        await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.deepEqual(session.notices, []);
        project.writeUser({ enabled: true, consentedAt });
        await host(project, {}).command('off');
        assert.equal(JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8')).enabled, false);
    } finally {
        project.cleanup();
    }
});

test('the recorded origin and credential are validated', () => {
    const project = projectFixture({}, undefined);
    try {
        for (const bad of [{ consentedOrigin: 'https://api.typesafe.ai/v1/systemone' }, { consentedOrigin: 'not a url' }, { consentedOrigin: 7 }, { consentedOrigin: 'https://0.0.0.0' }, { keySource: 'env' }, { keySource: 7 }]) {
            project.writeUser({ enabled: true, consentedAt, ...bad });
            const configuration = loadConfiguration(project.directory, project.agentDirectory, {});
            assert.ok(!configuration.enabled && /invalid/.test(configuration.reason), JSON.stringify(bad));
        }
        for (const good of [{ consentedOrigin: 'https://api.typesafe.ai', keySource: 'none' }, { endpoint: 'http://127.0.0.1:8000', consentedOrigin: 'http://127.0.0.1:8000', keySource: 'typed' }, { consentedOrigin: 'https://api.typesafe.ai', keySource: 'SYSTEMONE_API_KEY' }, { consentedOrigin: 'https://api.typesafe.ai', keySource: 'TYPESAFE_API_KEY' }]) {
            project.writeUser({ enabled: true, consentedAt, ...good });
            assert.ok(loadConfiguration(project.directory, project.agentDirectory, {}).enabled, JSON.stringify(good));
        }
    } finally {
        project.cleanup();
    }
});

test('setup for a local server never uses an environment key, and stores a typed one for that endpoint only', async () => {
    await withServer(answering(0.5), async server => {
        const environment = { SYSTEMONE_API_KEY: secret, TYPESAFE_API_KEY: secret };
        const project = projectFixture();
        try {
            // The environment key does not apply to loopback http, so setup asks; blank means none.
            const none = host(project, { environment }, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true] } });
            await none.command('setup');
            assert.ok(none.prompts.some(prompt => prompt.kind === 'input' && /API key/.test(prompt.title)), 'the key question is asked');
            assert.equal(server.requests[0].headers.authorization, undefined);
            assert.equal(JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8')).apiKey, undefined);

            const keyed = host(project, { environment }, { script: { select: local, inputs: [server.endpoint, 'local-key'], confirms: [true] } });
            const output = await keyed.command('setup');
            assert.equal(server.requests[1].headers.authorization, 'Bearer local-key');
            const saved = JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8'));
            assert.equal(saved.apiKey, 'local-key');
            assert.equal(statSync(userConfigurationPath(project.agentDirectory)).mode & 0o777, 0o600);
            assert.equal([output, ...keyed.prompts.map(prompt => prompt.title)].join('\n').includes('local-key'), false);
        } finally {
            project.cleanup();
        }
    });
});

test('setup with another provider probes its endpoint', async () => {
    const project = projectFixture();
    try {
        const urls: string[] = [];
        const transport = async (input: string | URL | Request) => {
            urls.push(String(input));
            return new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } }), { status: 200 });
        };
        const session = host(project, { transport }, { script: { select: other, inputs: ['https://opencode.ai/zen/v1/systemone', 'zen-key'], confirms: [true] } });
        await session.command('setup');
        assert.deepEqual(urls, ['https://opencode.ai/zen/v1/systemone']);
        assert.equal(JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8')).endpoint, 'https://opencode.ai/zen/v1/systemone');
    } finally {
        project.cleanup();
    }
});

test('setup discloses an override even when only the path differs', async () => {
    await withServer(answering(0.6), async server => {
        const project = projectFixture();
        try {
            const environment = { SYSTEMONE_ENDPOINT: `${server.endpoint}/elsewhere/v1/systemone` };
            const session = host(project, { environment }, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true] } });
            const output = await session.command('setup');
            const confirm = session.prompts.find(prompt => prompt.kind === 'confirm')!;
            assert.match(confirm.detail!, /SYSTEMONE_ENDPOINT in your environment overrides the endpoint you chose/);
            assert.ok(confirm.detail!.includes(`you chose, ${server.endpoint}/v1/systemone. Data goes to ${server.endpoint}/elsewhere/v1/systemone`));
            assert.equal(server.requests[0].url, '/elsewhere/v1/systemone');
            assert.match(output, /SYSTEMONE_ENDPOINT overrides its endpoint while it is set/);
        } finally {
            project.cleanup();
        }
    });
    // No override, no mention.
    const plain = projectFixture();
    try {
        const session = host(plain, { transport: async () => new Response(JSON.stringify({ answers: { [setupSkills]: { type: 'noul', noul: 0.5 } } })) }, { script: { select: typeSafe, inputs: [secret], confirms: [true] } });
        await session.command('setup');
        assert.doesNotMatch(session.prompts.find(prompt => prompt.kind === 'confirm')!.detail!, /overrides/);
    } finally {
        plain.cleanup();
    }
});

test('setup stops when the environment would keep it from running', async () => {
    const project = projectFixture();
    try {
        const session = host(project, { environment: { CRATIS_SYSTEM_ONE: '0' }, transport: failOnCall }, { script: { select: typeSafe, inputs: [secret], confirms: [true] } });
        const output = await session.command('setup');
        assert.match(output, /would not run here \(disabled by CRATIS_SYSTEM_ONE\)/);
        assert.equal(session.prompts.some(prompt => prompt.kind === 'confirm'), false, 'nothing to confirm');
        assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false);
    } finally {
        project.cleanup();
    }
});

test('setup stops before the key question when SYSTEMONE_ENDPOINT is not a usable endpoint', async () => {
    for (const value of ['http://example.invalid', 'not-a-url']) {
        const project = projectFixture();
        try {
            let requests = 0;
            const transport = async (): Promise<Response> => { requests++; throw new Error('the transport must not be called'); };
            const session = host(project, { environment: { SYSTEMONE_ENDPOINT: value }, transport }, { script: { select: typeSafe, inputs: [secret], confirms: [true] } });
            const output = await session.command('setup');
            assert.match(output, /System One setup stopped: SYSTEMONE_ENDPOINT: .+\. Unset or correct it\. Nothing was saved\./, value);
            assert.deepEqual(session.prompts.map(prompt => prompt.kind), ['select'], `${value}: no key question, no disclosure`);
            assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false, `${value}: nothing saved`);
            assert.equal(requests, 0, `${value}: no request`);
            assert.equal(output.includes(secret), false, value);
        } finally {
            project.cleanup();
        }
    }
});

test('a local server that a path-only override moves is not asked for a key, and none is stored or recorded', async () => {
    await withServer(answering(0.6), async server => {
        const project = projectFixture();
        try {
            const environment = { SYSTEMONE_ENDPOINT: `${server.endpoint}/elsewhere/v1/systemone` };
            const session = host(project, { environment }, { script: { select: local, inputs: [server.endpoint, 'typed-local-key'], confirms: [true] } });
            const output = await session.command('setup');
            assert.deepEqual(session.prompts.filter(prompt => prompt.kind === 'input').map(prompt => prompt.title), ['Local server URL (127.0.0.1, ::1 or localhost)'], 'no key question');
            assert.ok(output.includes(`A key for a local server is sent only to the exact URL; SYSTEMONE_ENDPOINT sends data to ${server.endpoint}/elsewhere/v1/systemone, so no key will be sent. Unset it and run setup again if that server needs one.`), 'the explanation is shown up front');
            const confirm = session.prompts.find(prompt => prompt.kind === 'confirm')!;
            // The disclosure, the probe and the agreement all say the same thing: no credential.
            assert.match(confirm.detail!, /with each request, no credential\./);
            assert.equal(server.requests.length, 1);
            assert.equal(server.requests[0].url, '/elsewhere/v1/systemone');
            assert.equal(server.requests[0].headers.authorization, undefined, 'the probe carried no credential');
            const text = readFileSync(userConfigurationPath(project.agentDirectory), 'utf8');
            const saved = JSON.parse(text);
            assert.equal(saved.keySource, 'none');
            assert.equal('apiKey' in saved, false, 'a key that is not sent is not stored');
            assert.equal(text.includes('typed-local-key'), false);
            assert.equal(output.includes('typed-local-key'), false);
            // Run time agrees: with and without the override, nothing carries a credential.
            project.configure({});
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await host(project, { environment }).askAndSettle(promptText, skills);
            await host(project, {}).askAndSettle(promptText, skills);
            assert.deepEqual(server.requests.map(request => request.headers.authorization), [undefined, undefined, undefined]);
        } finally {
            project.cleanup();
        }
    });
    // Without an override the same typed key is stored, recorded and sent.
    await withServer(answering(0.6), async server => {
        const project = projectFixture();
        try {
            const session = host(project, {}, { script: { select: local, inputs: [server.endpoint, 'typed-local-key'], confirms: [true] } });
            await session.command('setup');
            assert.match(session.prompts.find(prompt => prompt.kind === 'confirm')!.detail!, /a credential: the key you entered/);
            assert.equal(server.requests[0].headers.authorization, 'Bearer typed-local-key');
            const saved = JSON.parse(readFileSync(userConfigurationPath(project.agentDirectory), 'utf8'));
            assert.equal(saved.keySource, 'typed');
            assert.equal(saved.apiKey, 'typed-local-key');
        } finally {
            project.cleanup();
        }
    });
});

test('a failed probe saves nothing unless the user insists', async () => {
    await withServer((_request, response) => json(response, 401, { detail: 'no' }), async server => {
        for (const [insist, saved] of [[false, false], [true, true]] as const) {
            const project = projectFixture();
            try {
                const session = host(project, {}, { script: { select: local, inputs: [server.endpoint, ''], confirms: [true, insist] } });
                const output = await session.command('setup');
                assert.match(output, /Probe of http:\/\/127\.0\.0\.1:\d+ failed \(unauthorized/);
                assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), saved);
                assert.match(output, saved ? /System One enabled/ : /cancelled/);
            } finally {
                project.cleanup();
            }
        }
    });
});

test('setup stops without saving or sending when the user declines, cancels, or gives an unusable endpoint', async () => {
    const cases: Array<[string, { select?: string; inputs?: Array<string | undefined>; confirms?: boolean[] }, RegExp]> = [
        ['declines the disclosure', { select: typeSafe, inputs: [secret], confirms: [false] }, /cancelled/],
        ['cancels the backend choice', {}, /cancelled/],
        ['cancels the endpoint', { select: other, inputs: [undefined] }, /cancelled/],
        ['cancels the key', { select: typeSafe, inputs: [undefined] }, /cancelled/],
        ['gives no key for a hosted provider', { select: typeSafe, inputs: [''] }, /needs an API key/],
        ['gives http for a remote provider', { select: other, inputs: ['http://example.invalid'] }, /https/],
        ['gives 0.0.0.0 for a local server', { select: local, inputs: ['http://0.0.0.0:8000'] }, /unspecified address/],
        ['gives :: for a local server', { select: local, inputs: ['https://[::]:8000'] }, /unspecified address/],
        ['gives an IPv4-mapped loopback address', { select: local, inputs: ['http://[::ffff:127.0.0.1]:8000'] }, /https/],
        ['gives a remote URL for a local server', { select: local, inputs: ['https://example.invalid'] }, /local server must be on 127\.0\.0\.1/],
    ];
    for (const [name, script, expected] of cases) {
        const project = projectFixture();
        try {
            const session = host(project, { transport: failOnCall }, { script });
            const output = await session.command('setup');
            assert.match(output, expected, name);
            assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false, name);
        } finally {
            project.cleanup();
        }
    }
});

test('setup without a UI prints the manual steps to the terminal and writes nothing', async () => {
    const project = projectFixture();
    try {
        const session = host(project, { transport: failOnCall }, { hasUI: false });
        const output = await session.command('setup');
        assert.deepEqual(session.notices, [], 'notify does nothing without a UI');
        assert.equal(session.terminal.length, 1);
        assert.match(output, /cratis-system-one\.json/);
        assert.match(output, /chmod 600/);
        assert.match(output, /first 1200 characters of each prompt you type in an interactive session/);
        assert.match(output, /repositories set up with Cratis AI/);
        assert.equal(session.prompts.length, 0);
        assert.equal(existsSync(userConfigurationPath(project.agentDirectory)), false);
    } finally {
        project.cleanup();
    }
});

test('/system-one off turns it off, keeps the file private and the consent record, and can be re-enabled', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint, { apiKey: secret });
        try {
            const session = host(project);
            assert.match(await session.command('off'), /turned off/);
            const path = userConfigurationPath(project.agentDirectory);
            assert.equal(statSync(path).mode & 0o777, 0o600);
            const saved = JSON.parse(readFileSync(path, 'utf8'));
            assert.equal(saved.enabled, false);
            assert.equal(saved.consentedAt, consentedAt);
            assert.equal(saved.apiKey, secret);
            await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(server.requests.length, 0);
            assert.match(await session.command('status'), /State: disabled \(turned off/);
        } finally {
            project.cleanup();
        }
    });
    const unset = projectFixture();
    try {
        assert.match(await host(unset).command('off'), /not set up/);
        assert.equal(existsSync(userConfigurationPath(unset.agentDirectory)), false);
    } finally {
        unset.cleanup();
    }
});

test('a command that fails says so without the error text', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const session = host(project, { configure: () => { throw new Error(`boom at /private/path with ${secret}`); } });
        const output = await session.command('status');
        assert.equal(output, 'System One: the command failed; nothing may have been saved.');
        assert.equal(output.includes(secret), false);
        assert.equal(output.includes('/private/path'), false);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- only interactive sessions in Cratis repositories

test('without a UI (print, json, RPC without one, subagent children) nothing is ever asked, and output goes to the terminal', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project, {}, { hasUI: false });
            const { result } = await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(result, undefined);
            assert.equal(server.requests.length, 0);
            assert.deepEqual(session.entries, []);
            const status = await session.command('status');
            assert.match(status, /no interactive session 1/);
            assert.match(status, /State: enabled/);
            assert.deepEqual(session.notices, []);
            assert.equal(session.terminal.length, 1, 'status went to the terminal');
            assert.match(await session.command('last'), /not been asked/);
            assert.match(await session.command('report'), /No skill-relevance turns/);
            assert.match(await session.command('bogus'), /Usage: /);
            assert.equal(session.terminal.length, 4);
        } finally {
            project.cleanup();
        }
    });
});

test('only what the user typed is judged: extension-injected and RPC prompts are skipped, and so is a turn with no input event', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const injected = 'Here is the tool output another extension wants the model to see: SECRET-FILE-CONTENT and more text to pass the length check.';

            // sendUserMessage from another extension: an input event with source "extension".
            session.input(injected, 'extension');
            await session.askAndSettle(injected, skills);
            // An RPC host's prompt may be automated, so it is excluded too.
            session.input(promptText, 'rpc');
            await session.askAndSettle(promptText, skills);
            // No input event at all for this turn (the helper fires one by default; suppress it).
            const { result } = session.ask(promptText, skills, 'base', false);
            await session.settled();
            assert.equal(result, undefined);

            assert.equal(server.requests.length, 0, 'nothing was sent');
            assert.equal(JSON.stringify(server.requests).includes('SECRET-FILE-CONTENT'), false);
            assert.deepEqual(session.entries, []);
            const status = await session.command('status');
            assert.match(status, /not typed by the user 3/, 'extension, rpc and missing input are each recorded');

            // A typed prompt still works afterwards.
            session.input(promptText, 'interactive');
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 1);
        } finally {
            project.cleanup();
        }
    });
});

test('text Pi wrapped around the typed prompt is never judged: @file contents, attachments and skill blocks', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);

            // `pi @notes.env "explain this please"` in interactive mode: the first prompt is the file block
            // plus the typed text, and it reaches the input event as an interactive prompt with no source.
            const withFile = '<file name="/x/secret.txt">\nSECRET\n</file>\nexplain this please';
            session.input(withFile);
            await session.askAndSettle(withFile, skills);
            // An image argument: only a file tag with no contents, but still Pi's, not the user's.
            const withImage = '<file name="/x/diagram.png"></file>\nexplain the diagram in this picture';
            session.input(withImage);
            await session.askAndSettle(withImage, skills);
            // Several files, then the typed text.
            const withFiles = '<file name="/x/one.env">\nSECRET-ONE\n</file>\n<file name="/x/two.env">\nSECRET-TWO\n</file>\nplease compare these two files';
            session.input(withFiles);
            await session.askAndSettle(withFiles, skills);
            // A file block anywhere in the text, not only at the start.
            const embedded = 'please summarize what follows in detail <file name="/x/late.txt">SECRET-LATE</file>';
            session.input(embedded);
            await session.askAndSettle(embedded, skills);
            // The typed text is clean, yet the prompt Pi built carries a file block.
            session.input('review this file for me please');
            await session.askAndSettle('<file name="/x/hidden.txt">\nSECRET-HIDDEN\n</file>\nreview this file for me please', skills);
            // Any other tag Pi (or another tool) wrapped around the text.
            session.input('  <context>SECRET-CONTEXT</context> and then explain the design in detail');
            await session.askAndSettle('  <context>SECRET-CONTEXT</context> and then explain the design in detail', skills);
            // A skill block is Pi's expansion of a skill invocation.
            const skillBlock = '<skill name="cratis-arc-command" location="/x/SKILL.md">\nSECRET-SKILL\n</skill>\n\nadd a command please';
            session.input(skillBlock);
            await session.askAndSettle(skillBlock, skills);

            assert.equal(server.requests.length, 0, 'nothing was sent');
            const wire = JSON.stringify(server.requests);
            for (const marker of ['SECRET', '/x/', '<file']) assert.equal(wire.includes(marker), false, marker);
            assert.deepEqual(session.entries, []);
            const status = await session.command('status');
            assert.match(status, /file attachment or other wrapped input 6/);
            assert.match(status, /slash command 1/, 'a skill block is still counted as a skill invocation');

            // Typed text that merely mentions a file, and the path the editor inserts for an @file or a pasted
            // image, are the user's own words: a path, never contents.
            const mention = 'please review @src/notes.env and /tmp/pi-clipboard-1234.png for problems';
            session.input(mention);
            await session.askAndSettle(mention, skills);
            assert.equal(server.requests.length, 1);
            assert.equal(server.requests[0].body.state.prompt, mention);
        } finally {
            project.cleanup();
        }
    });
});

test('only the prompt the user typed is judged: one another extension rewrote is skipped', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);

            // Another extension's input handler returned {action: 'transform'}: before_agent_start sees its text.
            session.input('summarize the meeting notes for the standup please');
            await session.askAndSettle('summarize the meeting notes for the standup please. Also include SECRET-INJECTED details from the vault.', skills);
            // The reverse: it replaced the text and the typed text is the one that reaches the input event.
            session.input('SECRET-ORIGINAL plus enough words to pass the length check');
            await session.askAndSettle('a completely different prompt written by an extension, long enough to pass', skills);
            assert.equal(server.requests.length, 0);
            assert.equal(JSON.stringify(server.requests).includes('SECRET'), false);
            assert.deepEqual(session.entries, []);
            assert.match(await session.command('status'), /prompt changed since it was typed 2/);

            // Whitespace Pi or the terminal added around the same text is not a rewrite.
            session.input(`  ${promptText}\n`);
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 1);
            assert.equal(server.requests[0].body.state.prompt, promptText);
        } finally {
            project.cleanup();
        }
    });
});

test('only repositories set up with Cratis AI are asked about, quietly', async () => {
    await withServer(answering(0.9), async server => {
        const project = enabledProject(server.endpoint);
        try {
            rmSync(join(project.directory, '.cratis', 'ai.json'));
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 0);
            assert.deepEqual(session.notices, []);
            assert.match(await session.command('status'), /not a repository set up with Cratis AI 1/);

            // A managed install (its manifest) counts as much as .cratis/ai.json.
            writeFileSync(join(project.directory, '.cratis', 'ai.manifest.json'), '{}');
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 1);
        } finally {
            project.cleanup();
        }
    });
});

// ---------------------------------------------------------------- never delays a prompt

test('before_agent_start returns at once even when the server hangs, and the request is recorded as a failure later', async () => {
    await withServer(() => { /* accept the request and never answer */ }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project, { requestTimeoutMs: 250 });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const started = Date.now();
            const { result, unchanged } = session.ask(promptText, skills);
            // The handler is synchronous: it returned nothing (not a promise) while the request could not have
            // finished, because the server never answers. That is the whole guarantee, with no clock involved.
            assert.equal(result, undefined, 'the handler returns nothing, synchronously');
            assert.ok(unchanged());
            assert.equal(session.entries.length, 0, 'nothing is recorded yet');

            await session.settled();
            assert.ok(Date.now() - started >= 230, 'the request ran to its own timeout in the background');
            assert.deepEqual(session.entriesOfKind('skill-failure').map(entry => entry.failure), ['timeout']);
        } finally {
            project.cleanup();
        }
    });
});

test('the circuit breaker opens after three failures and then no request is made', async () => {
    await withServer(() => { /* hang */ }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project, { requestTimeoutMs: 80 });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            for (let turn = 0; turn < 3; turn++) await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 3);
            const status = await session.command('status');
            assert.match(status, /failed 3 \(timeout 3\)/);
            assert.match(status, /Circuit breaker: open, retry in/);

            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 3, 'no request while the breaker is open');
            assert.match(await session.command('status'), /circuit breaker open 1/);
            assert.equal(session.notices.filter(notice => /failed \(timeout\)/.test(notice)).length, 1, 'one notice per error class');
            assert.equal(session.notices.filter(notice => /paused/.test(notice)).length, 1);
        } finally {
            project.cleanup();
        }
    });
});

test('ending the session cancels in-flight requests and nothing is recorded afterwards', async () => {
    await withServer(() => { /* never answer */ }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            // The default 5 s timeout stays: only the shutdown can end this request early.
            const session = host(project);
            session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            while (server.requests.length === 0) await new Promise(resolve => setTimeout(resolve, 10));
            const started = Date.now();
            session.shutdown();
            await session.settled();
            assert.ok(Date.now() - started < 2500, 'the request was aborted, not waited for');
            assert.deepEqual(session.entries, [], 'no entry after shutdown');
            assert.deepEqual(session.notices, []);
        } finally {
            project.cleanup();
        }
    });
});

test('the breaker counts turns, not chunks, and half-open sends one probe request before the fan-out resumes', async () => {
    let healthy = false;
    await withServer((request, response) => healthy ? json(response, 200, answerBody(request, 0.5)) : json(response, 500, 'down'), async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, Array.from({ length: 70 }, (_unused, index) => ({ name: `skill-${index}` })));
            const requests = () => server.requests.length;

            // Each failing turn fans out to three chunks, yet three turns, not three chunks, open the breaker.
            await session.askAndSettle(promptText, skills);
            assert.equal(requests(), 3);
            assert.match(await session.command('status'), /Circuit breaker: closed/, 'three failed chunks are one failed turn');
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: closed/);
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: open/);
            assert.equal(requests(), 9);

            // Open: nothing is sent. Half-open, server still down: exactly one probe request, no fan-out.
            await session.askAndSettle(promptText, skills);
            assert.equal(requests(), 9);
            clock += 31_000;
            await session.askAndSettle(promptText, skills);
            assert.equal(requests(), 10, 'one probe of one chunk');
            assert.equal(Object.keys(server.requests[9].body.questions).length, 32);
            assert.match(await session.command('status'), /Circuit breaker: open/);

            // Half-open again, server recovered: the probe succeeds, then the remaining chunks go out.
            healthy = true;
            clock += 61_000;
            await session.askAndSettle(promptText, skills);
            assert.equal(requests(), 13, 'the probe plus the other two chunks');
            const [judgment] = session.entriesOfKind('skill-relevance');
            assert.equal(judgment.answered, 70);
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a probe that reports nothing is given back, so the breaker cannot stay half-open forever', async () => {
    let mode: 'down' | 'hang' | 'up' = 'down';
    await withServer((request, response) => {
        if (mode === 'hang') return;
        if (mode === 'down') json(response, 500, 'down');
        else json(response, 200, answerBody(request, 0.5));
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            for (let turn = 0; turn < 3; turn++) await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: open/);

            // Half-open: the probe goes out and hangs, then the session ends before it reports anything.
            clock += 31_000;
            mode = 'hang';
            const before = server.requests.length;
            session.ask(promptText, skills);
            while (server.requests.length === before) await new Promise(resolve => setTimeout(resolve, 10));
            session.shutdown();
            await session.settled();

            // The breaker must allow another probe, and a healthy answer closes it.
            mode = 'up';
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, before + 2, 'a new probe was allowed');
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

/** Opens a breaker with three failing turns against `server`, then moves the clock past the back-off. */
async function halfOpenAfterThreeFailures(session: ReturnType<typeof host>, skills: ReturnType<typeof skillsIn>, advance: () => void): Promise<void> {
    for (let turn = 0; turn < 3; turn++) await session.askAndSettle(promptText, skills);
    assert.match(await session.command('status'), /Circuit breaker: open/);
    advance();
    assert.match(await session.command('status'), /Circuit breaker: half-open/);
}

test('a failed probe re-opens the breaker with a fresh back-off, even when a rate limit opened it after one failure', async () => {
    let seen = 0;
    await withServer((_request, response) => {
        seen++;
        if (seen === 1) json(response, 429, {}, { 'retry-after': '1' });
        else json(response, 500, 'down');
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: open, retry in 1 s/, 'one rate-limit answer opens it');

            clock += 1_500;
            assert.match(await session.command('status'), /Circuit breaker: half-open/);
            // Only one failure was counted before the probe, fewer than the threshold: it must still re-open.
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 2, 'the probe');
            assert.match(await session.command('status'), /Circuit breaker: open, retry in 60 s/, 'a longer back-off, not an immediate second probe');
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 2, 'no request while it is open again');

            clock += 59_000;
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 2, 'still inside the fresh back-off');
            clock += 2_000;
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 3, 'the next probe, once the back-off has passed');
        } finally {
            project.cleanup();
        }
    });
});

test('a probe that fails, in the first chunk or a later one, re-opens the breaker; one that succeeds closes it', async () => {
    let answer: 'down' | 'up' | 'second-chunk-down' = 'down';
    let chunkSeen = 0;
    await withServer((request, response) => {
        if (answer === 'up') return json(response, 200, answerBody(request, 0.5));
        if (answer === 'second-chunk-down' && chunkSeen++ === 0) return json(response, 200, answerBody(request, 0.5));
        json(response, 500, 'down');
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, Array.from({ length: 70 }, (_unused, index) => ({ name: `skill-${index}` })));
            await halfOpenAfterThreeFailures(session, skills, () => { clock += 31_000; });

            // The probe (first chunk) works but a chunk of the resumed fan-out fails: that is a failed probe.
            answer = 'second-chunk-down';
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: open, retry in 60 s/);

            clock += 61_000;
            answer = 'up';
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a turn skipped before it asks anything does not use up the half-open probe', async () => {
    let healthy = false;
    await withServer((request, response) => healthy ? json(response, 200, answerBody(request, 0.5)) : json(response, 500, 'down'), async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await halfOpenAfterThreeFailures(session, skills, () => { clock += 31_000; });
            const before = server.requests.length;

            // The fuse (too many skills), no eligible skills and a short prompt each stop the turn before the breaker is asked.
            await session.askAndSettle(promptText, skillsIn(project.directory, Array.from({ length: 129 }, (_unused, index) => ({ name: `many-${index}` }))));
            await session.askAndSettle(promptText, []);
            await session.askAndSettle('fix it', skills);
            assert.equal(server.requests.length, before, 'nothing was sent');
            assert.match(await session.command('status'), /Circuit breaker: half-open/, 'the probe is still there');

            healthy = true;
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, before + 1, 'the next real turn is the probe');
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a probe whose judgment throws is given back, and the next turn probes again', async () => {
    let healthy = false;
    let armed = false;
    let broken = false;
    let clock = 1_000_000;
    // The transport fails and, on the way out, makes the clock throw: askSystemOne rejects, which it never does
    // in practice, so the turn's judgment throws before it can tell the breaker anything.
    const transport = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (armed) {
            broken = true;
            throw new Error('network');
        }
        return fetch(url, init);
    };
    await withServer((request, response) => healthy ? json(response, 200, answerBody(request, 0.5)) : json(response, 500, 'down'), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project, { transport, now: () => { if (broken) throw new Error('clock'); return clock; } });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await halfOpenAfterThreeFailures(session, skills, () => { clock += 31_000; });

            armed = true;
            await session.askAndSettle(promptText, skills);
            broken = false;
            armed = false;
            assert.deepEqual(session.entriesOfKind('skill-relevance'), []);
            assert.match(await session.command('status'), /Circuit breaker: half-open/, 'given back, not stuck');

            healthy = true;
            const before = server.requests.length;
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, before + 1, 'a new probe was allowed');
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a probe from a replaced session reports to nobody, and the new session starts with a closed breaker', async () => {
    let release: (() => void) | undefined;
    let held = false;
    await withServer((request, response) => {
        if (!held) return json(response, 500, 'down');
        release = () => json(response, 500, 'down');
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await halfOpenAfterThreeFailures(session, skills, () => { clock += 31_000; });

            held = true;
            const before = server.requests.length;
            session.ask(promptText, skills);
            while (server.requests.length === before) await new Promise(resolve => setTimeout(resolve, 10));
            session.sessionStart();
            release?.();
            await session.settled();
            const status = await session.command('status');
            assert.match(status, /Requests: 0,/, 'the old session\'s probe recorded nothing');
            assert.match(status, /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('only the turn granted the probe decides it: a late turn from before the breaker opened neither closes it nor frees a second probe', async () => {
    const held: Array<(status: number) => void> = [];
    await withServer((request, response) => {
        const number = held.length;
        // Request 0 is the closed-era turn, 1 to 3 fail and open the breaker, 4 is the probe: both are held.
        if (number === 0 || number === 4) { held.push(status => status === 200 ? json(response, 200, answerBody(request, 0.5)) : json(response, status, {}, { 'retry-after': '1' })); return; }
        held.push(() => undefined);
        if (number <= 3) json(response, 500, 'down');
        else json(response, 200, answerBody(request, 0.5));
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const until = async (condition: () => boolean) => { while (!condition()) await new Promise(resolve => setTimeout(resolve, 10)); };

            // A turn starts while the breaker is closed and is still waiting for its answer.
            session.ask(promptText, skills);
            await until(() => server.requests.length === 1);
            // Three other turns fail and open the breaker while it waits; then the back-off passes.
            for (let turn = 0; turn < 3; turn++) session.ask(promptText, skills);
            await until(() => server.requests.length === 4);
            while (!/Circuit breaker: open/.test(await session.command('status'))) await new Promise(resolve => setTimeout(resolve, 10));
            clock += 31_000;

            // The probe goes out.
            session.ask(promptText, skills);
            await until(() => server.requests.length === 5);
            // The closed-era turn now fails with a rate limit, and its Retry-After passes.
            held[0](429);
            await until(() => session.entriesOfKind('skill-failure').length === 4);
            clock += 5_000;
            // No second probe: the one in flight is still the only one.
            const before = server.requests.length;
            session.ask(promptText, skills);
            assert.equal(server.requests.length, before, 'no second probe while the first is in flight');
            assert.match(await session.command('status'), /circuit breaker open 1/);

            // The probe's own result decides, and a success closes the breaker.
            held[4](200);
            await session.settled();
            assert.match(await session.command('status'), /Circuit breaker: closed/);
            assert.equal(session.entriesOfKind('skill-relevance').length, 1);
        } finally {
            project.cleanup();
        }
    });
});

test('allow() reads the clock once, so the grant says whether the caller holds the probe', () => {
    // The back-off ends between two readings: the first sees it still open, the second sees it over.
    let reopenAt = 0;
    let readings: number[] = [];
    let clock = 1_000;
    const breaker = new CircuitBreaker(3, () => readings.length > 0 ? readings.shift()! : clock);
    for (let index = 0; index < 3; index++) breaker.recordFailure(FailureClass.ServerError, undefined, false);
    reopenAt = clock + breaker.retryInMs;

    // One reading, taken just before the end: no request, and no probe is left taken.
    readings = [reopenAt - 1];
    assert.equal(breaker.allow(), Grant.None);
    assert.equal(readings.length, 0, 'allow() made exactly one reading');
    clock = reopenAt;
    assert.equal(breaker.state, BreakerState.HalfOpen);

    // One reading, taken just after the end: it is the probe, whatever a later reading says.
    readings = [reopenAt, reopenAt - 1];
    assert.equal(breaker.allow(), Grant.Probe);
    assert.equal(readings.length, 1, 'allow() made exactly one reading');
    readings = [];
    assert.equal(breaker.allow(), Grant.None, 'and it is the only one');
    breaker.recordSuccess(true);
    assert.equal(breaker.allow(), Grant.Closed);
});

test('a back-off that ends while a turn starts never leaves the breaker stuck', async () => {
    let healthy = false;
    await withServer((request, response) => healthy ? json(response, 200, answerBody(request, 0.5)) : json(response, 500, 'down'), async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            let readings: number[] = [];
            const session = host(project, { now: () => readings.length > 0 ? readings.shift()! : clock });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            for (let turn = 0; turn < 3; turn++) await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: open, retry in 30 s/);
            const opened = server.requests.length;

            // The first reading the turn takes is one millisecond short of the end of the back-off, later ones are past it.
            const reopenAt = clock + 30_000;
            readings = [reopenAt - 1];
            clock = reopenAt;
            healthy = true;
            await session.askAndSettle(promptText, skills);
            readings = [];
            // Whether that turn was skipped or the probe, the breaker is not stuck: the next turn gets through and a success closes it.
            await session.askAndSettle(promptText, skills);
            assert.ok(server.requests.length > opened, 'a request went out');
            assert.match(await session.command('status'), /Circuit breaker: closed/);
            await session.askAndSettle(promptText, skills);
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a turn that never held the probe cannot give it back', async () => {
    const held: Array<(status: number) => void> = [];
    await withServer((request, response) => {
        const number = held.length;
        // Request 0 is a turn from before the breaker opened, 1 to 3 fail and open it, 4 is the probe: 0 and 4 are held.
        if (number === 0 || number === 4) { held.push(() => json(response, 200, answerBody(request, 0.5))); return; }
        held.push(() => undefined);
        if (number <= 3) json(response, 500, 'down');
        else json(response, 200, answerBody(request, 0.5));
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            let clock = 1_000_000;
            let broken = false;
            const session = host(project, { now: () => { if (broken) throw new Error('clock'); return clock; } });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const until = async (condition: () => boolean) => { while (!condition()) await new Promise(resolve => setTimeout(resolve, 10)); };

            session.ask(promptText, skills);
            await until(() => server.requests.length === 1);
            for (let turn = 0; turn < 3; turn++) session.ask(promptText, skills);
            await until(() => server.requests.length === 4);
            while (!/Circuit breaker: open/.test(await session.command('status'))) await new Promise(resolve => setTimeout(resolve, 10));
            clock += 31_000;
            session.ask(promptText, skills);
            await until(() => server.requests.length === 5);

            // The old turn now ends without reporting anything: its judgment throws before it can tell the breaker.
            broken = true;
            held[0](200);
            await new Promise(resolve => setTimeout(resolve, 150));
            broken = false;

            // It never held the probe, so the probe is still taken: no second one goes out.
            const before = server.requests.length;
            session.ask(promptText, skills);
            assert.equal(server.requests.length, before, 'no second probe');
            assert.match(await session.command('status'), /circuit breaker open 1/);

            held[4](200);
            await session.settled();
            assert.match(await session.command('status'), /Circuit breaker: closed/);
        } finally {
            project.cleanup();
        }
    });
});

test('a late success from before the breaker opened does not close it, and a late failure changes nothing', () => {
    let clock = 1_000;
    const breaker = new CircuitBreaker(3, () => clock);
    for (let index = 0; index < 3; index++) breaker.recordFailure(FailureClass.ServerError, undefined, false);
    assert.equal(breaker.state, BreakerState.Open);
    breaker.recordSuccess(false);
    assert.equal(breaker.state, BreakerState.Open, 'a late success is not the probe');

    clock += 30_000;
    assert.equal(breaker.allow(), Grant.Probe, 'the probe');
    assert.equal(breaker.recordFailure(FailureClass.RateLimited, 500, false), false, 'a late failure is not the probe');
    clock += 5_000;
    assert.equal(breaker.state, BreakerState.HalfOpen, 'the back-off is unchanged');
    assert.equal(breaker.allow(), Grant.None, 'and it does not free a second probe');
    breaker.recordSuccess(true);
    assert.equal(breaker.state, BreakerState.Closed, 'the probe decides');
    assert.equal(breaker.allow(), Grant.Closed);
});

test('a rate-limit answer anywhere in a turn decides the breaker class and its Retry-After', async () => {
    let seen = 0;
    await withServer((request, response) => {
        seen++;
        if (seen === 1) json(response, 500, 'oops');
        else if (seen === 2) json(response, 429, {}, { 'retry-after': '2' });
        else json(response, 200, answerBody(request, 0.5));
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const clock = 1_000_000;
            const session = host(project, { now: () => clock });
            const skills = skillsIn(project.directory, Array.from({ length: 70 }, (_unused, index) => ({ name: `skill-${index}` })));
            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 3);
            // Had the first failure (a 500) decided, one failed turn would leave the breaker closed.
            const status = await session.command('status');
            assert.match(status, /Circuit breaker: open, retry in 2 s/);
            assert.match(status, /rate-limited 1/);
            assert.match(status, /server-error 1/);
        } finally {
            project.cleanup();
        }
    });
});

test('the circuit breaker honors Retry-After, allows one probe, and closes on success', () => {
    let clock = 1_000;
    const breaker = new CircuitBreaker(3, () => clock);
    assert.equal(breaker.state, BreakerState.Closed);
    assert.equal(breaker.recordFailure(FailureClass.Timeout, undefined, false), false);
    assert.equal(breaker.recordFailure(FailureClass.Network, undefined, false), false);
    assert.equal(breaker.allow(), Grant.Closed);
    assert.equal(breaker.recordFailure(FailureClass.ServerError, undefined, false), true, 'the third consecutive failure opens it');
    assert.equal(breaker.state, BreakerState.Open);
    assert.equal(breaker.allow(), Grant.None);
    clock += 29_999;
    assert.equal(breaker.allow(), Grant.None);
    clock += 1;
    assert.equal(breaker.state, BreakerState.HalfOpen);
    assert.equal(breaker.allow(), Grant.Probe, 'one probe');
    assert.equal(breaker.allow(), Grant.None, 'only one');
    assert.equal(breaker.recordFailure(FailureClass.Timeout, undefined, true), true, 'a failed probe re-opens it with a longer back-off');
    assert.equal(breaker.retryInMs, 60_000);
    breaker.recordSuccess(true);
    assert.equal(breaker.state, BreakerState.Closed);

    assert.equal(breaker.recordFailure(FailureClass.RateLimited, 2_000, false), true);
    assert.equal(breaker.retryInMs, 2_000);
    clock += 2_000;
    assert.equal(breaker.state, BreakerState.HalfOpen);
    breaker.recordSuccess(true);
    assert.equal(breaker.recordFailure(FailureClass.Overloaded, undefined, false), true);
    assert.equal(breaker.retryInMs, 30_000, 'without Retry-After the back-off applies');
});

test('a failed probe always re-opens the breaker, however few failures came before it', () => {
    let clock = 1_000;
    const breaker = new CircuitBreaker(3, () => clock);
    // A rate limit opens it after one failure; the probe then fails with an ordinary error.
    assert.equal(breaker.recordFailure(FailureClass.RateLimited, 2_000, false), true);
    clock += 2_000;
    assert.equal(breaker.allow(), Grant.Probe);
    assert.equal(breaker.recordFailure(FailureClass.ServerError, undefined, true), true);
    assert.equal(breaker.state, BreakerState.Open);
    assert.equal(breaker.retryInMs, 60_000, 'a fresh, longer back-off');
    assert.equal(breaker.allow(), Grant.None);

    // A probe that reports nothing is given back and can be granted again.
    clock += 60_000;
    assert.equal(breaker.allow(), Grant.Probe);
    breaker.release();
    assert.equal(breaker.state, BreakerState.HalfOpen);
    assert.equal(breaker.allow(), Grant.Probe);
    breaker.recordSuccess(true);
    assert.equal(breaker.state, BreakerState.Closed);
    assert.equal(breaker.recordFailure(FailureClass.Timeout, undefined, false), false, 'and a closed breaker still needs the threshold');
});

test('Retry-After and retry-after-ms are read', () => {
    assert.equal(retryAfterMs(new Headers({ 'retry-after-ms': '1500' })), 1500);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '7' })), 7000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': new Date(10_000).toUTCString() }), () => 4_000), 6000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': 'soon' })), undefined);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '99999' })), 600_000, 'capped');
    assert.equal(retryAfterMs(new Headers()), undefined);
});

// ---------------------------------------------------------------- every failure path fails open

const failures: Array<[string, Parameters<typeof fakeServer>[0], FailureClass]> = [
    ['401', (_request, response) => json(response, 401, { detail: 'nope' }), FailureClass.Unauthorized],
    ['413', (_request, response) => json(response, 413, { detail: 'too many questions' }), FailureClass.InvalidRequest],
    ['422', (_request, response) => json(response, 422, { detail: 'bad' }), FailureClass.InvalidRequest],
    ['429', (_request, response) => json(response, 429, { detail: 'slow down' }, { 'retry-after': '1' }), FailureClass.RateLimited],
    ['529', (_request, response) => json(response, 529, { detail: 'busy' }, { 'retry-after-ms': '500' }), FailureClass.Overloaded],
    ['500', (_request, response) => json(response, 500, 'oops'), FailureClass.ServerError],
    ['not JSON', (_request, response) => json(response, 200, '<html>hello</html>'), FailureClass.MalformedResponse],
    ['no answers', (_request, response) => json(response, 200, { model: 'x' }), FailureClass.MalformedResponse],
    ['missing id', (_request, response) => json(response, 200, { answers: {} }), FailureClass.MalformedResponse],
    ['unknown id', (request, response) => json(response, 200, { answers: { ...(answerBody(request, 0.5) as { answers: object }).answers, extra: { type: 'noul', noul: 0.5 } } }), FailureClass.MalformedResponse],
    ['wrong type', (request, response) => json(response, 200, { answers: Object.fromEntries(Object.keys(request.body.questions).map(id => [id, { type: 'score', noul: 0.5 }])) }), FailureClass.MalformedResponse],
    ['string probability', (request, response) => json(response, 200, { answers: Object.fromEntries(Object.keys(request.body.questions).map(id => [id, { type: 'noul', noul: '0.5' }])) }), FailureClass.MalformedResponse],
    ['probability above 1', (request, response) => json(response, 200, answerBody(request, 1.5)), FailureClass.InvalidProbability],
    ['negative probability', (request, response) => json(response, 200, answerBody(request, -0.1)), FailureClass.InvalidProbability],
    ['infinite probability', (request, response) => json(response, 200, JSON.stringify(answerBody(request, 0.5)).replace('0.5', '1e999')), FailureClass.InvalidProbability],
    ['oversized body', (_request, response) => json(response, 200, JSON.stringify({ padding: 'x'.repeat(300 * 1024) })), FailureClass.MalformedResponse],
];

for (const [name, behavior, expected] of failures) {
    test(`a ${name} answer fails open with one notice and records a failure, never suggestions`, async () => {
        await withServer(behavior, async server => {
            const project = enabledProject(server.endpoint);
            try {
                const session = host(project);
                const skills = skillsIn(project.directory, [{ name: 'skill-a' }, { name: 'skill-b' }]);
                for (let turn = 0; turn < 2; turn++) {
                    const { result, unchanged } = await session.askAndSettle(promptText, skills);
                    assert.equal(result, undefined);
                    assert.ok(unchanged());
                }
                assert.deepEqual(session.entriesOfKind('skill-relevance'), []);
                assert.ok(session.entriesOfKind('skill-failure').length >= 1);
                assert.ok(session.entriesOfKind('skill-failure').every(entry => entry.failure === expected));
                assert.deepEqual(session.misuse, []);
                assert.equal(session.notices.filter(notice => notice.includes(`(${expected})`)).length, 1, `one notice for ${expected}: ${session.notices.join(' | ')}`);
                assert.match(await session.command('status'), new RegExp(`${expected} [12]`));
                assert.match(await session.command('report'), new RegExp(`Failures: .*${expected} [12]`));
            } finally {
                project.cleanup();
            }
        });
    });
}

test('a refused connection fails open as a network failure', async () => {
    const server = await fakeServer();
    const { endpoint } = server;
    await server.close();
    const project = enabledProject(endpoint);
    try {
        const session = host(project);
        const { result } = await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.equal(result, undefined);
        assert.match(await session.command('status'), /network 1/);
    } finally {
        project.cleanup();
    }
});

test('a transport that throws or ignores the abort signal still fails open within the timeout', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
        const throwing = host(project, { transport: async () => { throw new TypeError('boom'); } });
        await throwing.askAndSettle(promptText, skills);
        assert.match(await throwing.command('status'), /network 1/);

        const ignoring = host(project, { requestTimeoutMs: 100, transport: () => new Promise<Response>(() => { /* never settles */ }) });
        const started = Date.now();
        await ignoring.askAndSettle(promptText, skills);
        assert.ok(Date.now() - started < 3000, 'the timeout ends a transport that ignores the abort signal');
        assert.match(await ignoring.command('status'), /timeout 1/);
    } finally {
        project.cleanup();
    }
});

test('a rate-limited answer reports how long the server asked to wait', async () => {
    await withServer((_request, response) => json(response, 429, {}, { 'retry-after-ms': '2500' }), async server => {
        const outcome = await askSystemOne({ endpoint: `${server.endpoint}/v1/systemone`, model: 'jev-latest', timeoutMs: 1000 }, { prompt: 'x' }, { a: { type: 'noul', instructions: 'a', criteria: { true: 'a' } } });
        assert.ok(!outcome.ok && outcome.failure === FailureClass.RateLimited && outcome.retryAfterMs === 2500);
    });
});

test('a model name the server reports is kept only when it looks like one; the answer is used either way', async () => {
    const accepted = validateAnswers({ model: 'fake-1', answers: { a: { type: 'noul', noul: 0.5 } } }, ['a']);
    assert.ok(typeof accepted === 'object' && accepted.model === 'fake-1');
    for (const model of ['x'.repeat(129), 'has space', '<script>alert(1)</script>', 'a\nb', '', 'ключ', 7, null, { name: 'x' }]) {
        const validated = validateAnswers({ model, answers: { a: { type: 'noul', noul: 0.5 } } }, ['a']);
        assert.ok(typeof validated === 'object', `the answer is still good for ${JSON.stringify(model)}`);
        assert.equal(validated.model, undefined, JSON.stringify(model));
    }

    for (const reported of ['x'.repeat(4096), 'bad model!', '<b>secret</b>']) {
        await withServer((request, response) => json(response, 200, { ...answerBody(request, 0.7) as object, model: reported }), async server => {
            const project = enabledProject(server.endpoint, { model: 'configured-1' });
            try {
                const session = host(project);
                await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
                const [judgment] = session.entriesOfKind('skill-relevance');
                assert.equal(judgment.model, 'configured-1', 'falls back to the configured model instead of failing the request');
                assert.deepEqual(judgment.probabilities, { 'skill-a': 0.7 });
                assert.equal(JSON.stringify(session.entries).includes(reported), false, 'the server text is never persisted');
                assert.match(await session.command('status'), /Requests: 1, succeeded 1, failed 0/);
            } finally {
                project.cleanup();
            }
        });
    }
});

test('response validation accepts exactly the asked ids with probabilities in [0, 1]', () => {
    const good = validateAnswers({ model: 'm', answers: { a: { type: 'noul', noul: 0 }, b: { type: 'noul', noul: 1 } } }, ['a', 'b']);
    assert.ok(typeof good !== 'string');
    assert.deepEqual([...good.probabilities], [['a', 0], ['b', 1]]);
    assert.equal(validateAnswers(null, ['a']), FailureClass.MalformedResponse);
    assert.equal(validateAnswers({ answers: [] }, ['a']), FailureClass.MalformedResponse);
    assert.equal(validateAnswers({ answers: { a: { type: 'noul', noul: null } } }, ['a']), FailureClass.MalformedResponse);
    assert.equal(validateAnswers({ answers: { a: { type: 'noul', noul: Number.NaN } } }, ['a']), FailureClass.InvalidProbability);
    assert.equal(validateAnswers({ answers: { a: { type: 'noul', noul: 0.4 }, constructor: { type: 'noul', noul: 0.4 } } }, ['a']), FailureClass.MalformedResponse);
});

// ---------------------------------------------------------------- what is asked

test('requests are chunked to at most 32 questions and sent concurrently', async () => {
    // The server answers only once all chunks have arrived, so sequential sending would time out.
    const waiting: Array<() => void> = [];
    await withServer((request, response) => {
        waiting.push(() => json(response, 200, answerBody(request, id => id === 'skill-0' ? 0.9 : 0.1)));
        if (waiting.length === 3) waiting.forEach(release => release());
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, Array.from({ length: 70 }, (_unused, index) => ({ name: `skill-${index}` })));
            const started = Date.now();
            await session.askAndSettle(promptText, skills);
            assert.ok(Date.now() - started < 3000);

            assert.equal(server.requests.length, 3);
            const sizes = server.requests.map(request => Object.keys(request.body.questions).length).sort((left, right) => right - left);
            assert.deepEqual(sizes, [32, 32, 6]);
            const asked = server.requests.flatMap(request => Object.keys(request.body.questions));
            assert.equal(new Set(asked).size, 70, 'every skill exactly once');
            assert.equal(new Set(server.requests.map(request => request.body.state.prompt)).size, 1);

            const [judgment] = session.entriesOfKind('skill-relevance');
            assert.equal(judgment.asked, 70);
            assert.equal(judgment.answered, 70);
            assert.equal(Object.keys(judgment.probabilities as object).length, 70);
            assert.equal(session.entriesOfKind('skill-relevance').length, 1, 'one record per turn');
            assert.match(await session.command('status'), /Requests: 3, succeeded 3, failed 0/);
        } finally {
            project.cleanup();
        }
    });
});

test('a failed chunk is recorded as a failure while the answered chunks are kept', async () => {
    let seen = 0;
    await withServer((request, response) => {
        seen++;
        if (seen === 2) json(response, 413, { detail: 'too many' });
        else json(response, 200, answerBody(request, 0.4));
    }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            await session.askAndSettle(promptText, skillsIn(project.directory, Array.from({ length: 70 }, (_unused, index) => ({ name: `skill-${index}` }))));
            assert.equal(session.entriesOfKind('skill-failure').length, 1);
            const [judgment] = session.entriesOfKind('skill-relevance');
            assert.equal(judgment.asked, 70);
            assert.ok((judgment.answered as number) < 70 && (judgment.answered as number) >= 6);
        } finally {
            project.cleanup();
        }
    });
});

test('the total fuse skips the call and reports it instead of trimming', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const limit = skillsIn(project.directory, Array.from({ length: 128 }, (_unused, index) => ({ name: `skill-${index}` })));
            await session.askAndSettle(promptText, limit);
            assert.equal(server.requests.length, 4, '128 skills is exactly the limit: four requests of 32');

            const over = skillsIn(project.directory, Array.from({ length: 129 }, (_unused, index) => ({ name: `skill-${index}` })));
            await session.askAndSettle(promptText, over);
            await session.askAndSettle(promptText, over);
            assert.equal(server.requests.length, 4, 'over the limit nothing is sent, not even a trimmed list');
            assert.equal(session.notices.filter(notice => /exceed the limit of 128/.test(notice)).length, 1);
            assert.match(await session.command('status'), /too many skills 2/);
        } finally {
            project.cleanup();
        }
    });
});

test('the state never exceeds the cap and holds only the prompt', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const long = `${'x'.repeat(1199)}\u{1F600}${'y'.repeat(5000)}`;
            await session.askAndSettle(long, skills);
            const state = server.requests[0].body.state;
            assert.deepEqual(Object.keys(state), ['prompt']);
            assert.ok(state.prompt.length <= 1200, `${state.prompt.length}`);
            assert.doesNotMatch(state.prompt, /[\ud800-\udbff]$/, 'no half of a surrogate pair');

            await session.askAndSettle(promptText, skills);
            assert.deepEqual(server.requests[1].body.state, { prompt: promptText }, 'nothing about the machine or repository');
        } finally {
            project.cleanup();
        }
    });
});

test('only corpus skills the model may invoke are asked about, and requests are valid for Laya', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            mkdirSync(join(project.directory, '.pi'), { recursive: true });
            symlinkSync(join(project.directory, '.cratis', 'ai', 'skills'), join(project.directory, '.pi', 'skills'));
            const managed = skillsIn(project.directory, [
                { name: 'cratis-arc-command', description: 'Define an Arc command. Use it when adding a command.' },
                { name: 'cratis-hidden', disableModelInvocation: true },
                { name: 'cratis-long', description: `${'Very long description without a full stop '.repeat(20)}` },
            ]);
            const viaSymlink = { ...managed[0], name: 'cratis-through-link', filePath: join(project.directory, '.pi', 'skills', 'cratis-arc-command', 'SKILL.md') };
            const foreign = skillsIn(project.directory, [{ name: 'personal-skill', directory: 'elsewhere' }]);
            const lookalike = skillsIn(project.directory, [{ name: 'cratis-lookalike', directory: join('.cratis', 'ai', 'skills-other') }]);
            const session = host(project);
            await session.askAndSettle(promptText, [...managed, viaSymlink, ...foreign, ...lookalike]);

            assert.equal(server.requests.length, 1);
            const request = server.requests[0];
            assert.equal(request.method, 'POST');
            assert.equal(request.url, '/v1/systemone');
            assert.equal(request.headers['content-type'], 'application/json');
            assert.equal(request.body.model, 'jev-1.13.0');
            assert.deepEqual(Object.keys(request.body).sort(), ['model', 'questions', 'state']);
            assert.deepEqual(Object.keys(request.body.questions).sort(), ['cratis-arc-command', 'cratis-long', 'cratis-through-link']);
            for (const [id, question] of Object.entries(request.body.questions)) {
                assert.match(id, /^[a-z0-9-]+$/);
                assert.deepEqual(Object.keys(question).sort(), ['criteria', 'instructions', 'type']);
                assert.equal(question.type, 'noul');
                assert.equal(question.instructions, `Would the \`${id}\` guidance help answer or carry out \`prompt\`?`);
                assert.deepEqual(Object.keys(question.criteria), ['true']);
                assert.ok(question.criteria.true.length <= 200);
                assert.ok(question.criteria.true.startsWith(`${id}: `));
            }
            assert.equal(request.body.questions['cratis-arc-command'].criteria.true, 'cratis-arc-command: Define an Arc command.');
            assert.equal(request.body.questions['cratis-long'].criteria.true.length, 200);
        } finally {
            project.cleanup();
        }
    });
});

test('a managed copy asks about the project corpus, the packaged copy only about the packaged corpus', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const managed = skillsIn(project.directory, [{ name: 'managed-skill' }]);
            const packagedDirectory = join(project.directory, 'node_modules', 'pkg', 'package', 'corpus');
            const packaged = skillsIn(project.directory, [{ name: 'packaged-skill', directory: join('node_modules', 'pkg', 'package', 'corpus', 'skills') }]);
            const extensionDirectory = join(packagedDirectory, 'harnesses', 'pi', 'extensions', 'cratis-system-one');

            // A managed (or development) copy: the repository's own .cratis/ai/skills, never the packaged ones.
            await host(project).askAndSettle(promptText, [...managed, ...packaged]);
            assert.deepEqual(Object.keys(server.requests[0].body.questions), ['managed-skill']);

            // The packaged copy: the packaged corpus, never .cratis/ai/skills.
            await host(project, { extensionDirectory }).askAndSettle(promptText, [...managed, ...packaged]);
            assert.deepEqual(Object.keys(server.requests[1].body.questions), ['packaged-skill']);
        } finally {
            project.cleanup();
        }
    });
});

test('short prompts, slash commands and turns without corpus skills are not asked about', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.askAndSettle('fix it', skills);
            session.input('/review the current diff');
            await session.askAndSettle('Review the current diff and list the risky changes in detail.', skills);
            await session.askAndSettle('/deploy staging with the normal settings and report back', skills);
            await session.askAndSettle('<skill name="cratis-arc-command">...</skill> add a command please', skills);
            await session.askAndSettle(promptText, []);
            await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'personal', directory: 'elsewhere' }]));
            assert.equal(server.requests.length, 0);
            const status = await session.command('status');
            assert.match(status, /short prompt 1/);
            assert.match(status, /slash command 3/);
            assert.match(status, /no eligible skills 2/);

            await session.askAndSettle(promptText, skills);
            assert.equal(server.requests.length, 1, 'a plain prompt after a slash command is asked');
        } finally {
            project.cleanup();
        }
    });
});

test('skill relevance mode off asks nothing', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint, { skillRelevance: { mode: 'off' } });
        try {
            const session = host(project);
            await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(server.requests.length, 0);
            assert.match(await session.command('status'), /Skill relevance: off/);
        } finally {
            project.cleanup();
        }
    });
});

// ---------------------------------------------------------------- shadow recording and the report

test('shadow mode changes nothing, records ids and probabilities without the prompt, and records only reads of the skills it asked about', async () => {
    const sentinel = 'zebra-quartz-7731';
    const prompt = `${promptText} Reference ${sentinel}.`;
    await withServer(answering(id => id === 'skill-a' ? 0.91 : id === 'skill-b' ? 0.42 : 0.03), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            session.sessionStart();
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }, { name: 'skill-b' }, { name: 'skill-c' }]);
            skillsIn(project.directory, [{ name: 'personal-skill', directory: 'elsewhere' }]);
            // In the corpus, but not among the skills Pi loaded for this turn, so it is never asked about.
            skillsIn(project.directory, [{ name: 'unasked-skill' }]);
            const { result, unchanged } = session.ask(prompt, skills);
            assert.equal(result, undefined, 'no systemPrompt, no message');
            assert.ok(unchanged());
            await session.settled();
            assert.deepEqual(session.misuse, [], 'no message, tool or tool-set changes');
            assert.equal(server.requests.length, 1);

            const [judgment] = session.entriesOfKind('skill-relevance');
            assert.equal(session.entries[0].type, 'cratis-system-one');
            assert.equal(judgment.endpoint, server.endpoint);
            assert.equal(judgment.mode, 'shadow');
            assert.equal(judgment.asked, 3);
            assert.equal(typeof judgment.latencyMs, 'number');
            assert.equal(typeof judgment.turnId, 'string');
            assert.deepEqual(judgment.probabilities, { 'skill-a': 0.91, 'skill-b': 0.42, 'skill-c': 0.03 });

            // The model reads skill-a (relative path), a skill from outside the corpus, a corpus skill that was
            // not asked about, and a skill it failed to read; it also reads ordinary files and runs a bash command.
            session.read('.cratis/ai/skills/skill-a/SKILL.md');
            session.read('elsewhere/personal-skill/SKILL.md');
            session.read('.cratis/ai/skills/unasked-skill/SKILL.md');
            session.read('@.cratis/ai/skills/skill-b/SKILL.md', true);
            session.read('README.md');
            session.read('.cratis/ai/skills/skill-c/SKILL.md', false, 'bash');
            assert.equal(session.entriesOfKind('skill-outcome').length, 0, 'the outcome is recorded when the turn ends');
            assert.match(await session.command('last'), /turn in progress/);
            session.end();

            const [outcome] = session.entriesOfKind('skill-outcome');
            // Only the asked skill is named; the two others are counted, and their names are nowhere in the entries.
            assert.deepEqual(outcome, { kind: 'skill-outcome', version: 1, turnId: judgment.turnId, turn: 1, read: ['skill-a'], readEarlier: [], otherReads: 2 });
            assert.equal(JSON.stringify(session.entries).includes('personal-skill'), false);
            assert.equal(JSON.stringify(session.entries).includes('unasked-skill'), false);
            assert.match(await session.command('report'), /Other skill reads \(not in the corpus, or not asked about; not counted above\): 2/);
            assert.equal(JSON.stringify(session.entries).includes(sentinel), false, 'the prompt is never recorded');
            assert.equal(JSON.stringify(session.entries).includes('Reference'), false);

            const last = await session.command('last');
            assert.equal(last.includes(sentinel), false);
            assert.match(last, /Turn 1 .*answered, \d+ ms, 3 skills asked, http:\/\/127\.0\.0\.1:\d+/);
            assert.match(last, /0\.91 {2}skill-a {2}\(read\)/);
            assert.match(last, /0\.42 {2}skill-b {2}\(not read\)/);
            assert.ok(last.indexOf('skill-a') < last.indexOf('skill-b') && last.indexOf('skill-b') < last.indexOf('skill-c'), 'highest probability first');
            assert.match(last, /Shadow mode/);

            const status = await session.command('status');
            assert.match(status, /State: enabled/);
            assert.match(status, new RegExp(`Endpoint: ${server.endpoint.replace(/[.]/g, '\\.')} \\(from your configuration, loopback; no credential sent\\)`));
            assert.match(status, /Requests: 1, succeeded 1, failed 0/);
            assert.match(status, /Circuit breaker: closed/);

            // A second turn learns that skill-a was already read earlier in the session.
            await session.askAndSettle(promptText, skills);
            session.end();
            assert.deepEqual(session.entriesOfKind('skill-outcome').at(-1)?.readEarlier, ['skill-a']);

            session.sessionStart();
            assert.match(await session.command('status'), /Requests: 0/);
            assert.match(await session.command('last'), /not been asked/);
        } finally {
            project.cleanup();
        }
    });
});

test('a late answer is still recorded after the turn has ended, and joined by turn id', async () => {
    let release: (() => void) | undefined;
    await withServer((request, response) => { release = () => json(response, 200, answerBody(request, 0.8)); }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            session.ask(promptText, skills);
            await new Promise(resolve => setTimeout(resolve, 50));
            session.read('.cratis/ai/skills/skill-a/SKILL.md');
            session.end();
            assert.equal(session.entriesOfKind('skill-outcome').length, 1);
            assert.equal(session.entriesOfKind('skill-relevance').length, 0, 'the backend has not answered yet');

            release!();
            await session.settled();
            const [judgment] = session.entriesOfKind('skill-relevance');
            const [outcome] = session.entriesOfKind('skill-outcome');
            assert.equal(judgment.turnId, outcome.turnId);
            assert.match(await session.command('last'), /0\.80 {2}skill-a {2}\(read\)/);
            assert.match(await session.command('report'), /of those, read by the model: 1 \(100%\)/);
        } finally {
            project.cleanup();
        }
    });
});

test('a result that arrives after the session was replaced is dropped', async () => {
    let release: (() => void) | undefined;
    await withServer((request, response) => { release = () => json(response, 200, answerBody(request, 0.8)); }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            await new Promise(resolve => setTimeout(resolve, 50));
            session.sessionStart();
            release!();
            await session.settled();
            assert.deepEqual(session.entries, []);
        } finally {
            project.cleanup();
        }
    });
});

test('a result from a request made under the old endpoint never reaches the new endpoint\'s breaker or statistics', async () => {
    const held: Array<() => void> = [];
    await withServer((_request, response) => { held.push(() => json(response, 429, {}, { 'retry-after': '120' })); }, async old => {
        await withServer(answering(0.5), async fresh => {
            const project = enabledProject(old.endpoint);
            try {
                const session = host(project, {}, { script: { select: local, inputs: [fresh.endpoint, ''], confirms: [true] } });
                const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
                session.ask(promptText, skills);
                while (old.requests.length === 0) await new Promise(resolve => setTimeout(resolve, 10));

                // The user runs setup for another endpoint while the request to the old one is still out.
                await session.command('setup');
                assert.equal(fresh.requests.length, 1, 'the setup probe');
                await session.askAndSettle(promptText, skills);
                assert.equal(fresh.requests.length, 2, 'the turn now goes to the new endpoint');
                // The old server finally answers with a rate limit that would open the breaker if it counted.
                for (const release of held) release();
                await session.settled();

                const status = await session.command('status');
                assert.match(status, /Requests: 1, succeeded 1, failed 0/, 'only the new endpoint\'s request counts');
                assert.match(status, /Circuit breaker: closed/);
                assert.deepEqual(session.entriesOfKind('skill-failure'), []);
                assert.equal(session.entriesOfKind('skill-relevance').length, 1);
                assert.deepEqual(session.notices.filter(notice => /skill relevance failed|is paused/.test(notice)), []);
            } finally {
                project.cleanup();
            }
        });
    });
});

test('turning System One off while a request is out drops its result', async () => {
    await withServer(() => { /* never answer */ }, async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            while (server.requests.length === 0) await new Promise(resolve => setTimeout(resolve, 10));
            const started = Date.now();
            await session.command('off');
            await session.settled();
            assert.ok(Date.now() - started < 2500, 'the request was aborted, not waited for');
            assert.deepEqual(session.entries, []);
            assert.deepEqual(session.notices.filter(notice => /skill relevance failed|is paused/.test(notice)), []);
            const status = await session.command('status');
            assert.match(status, /State: disabled/);
            assert.match(status, /Requests: 0,/);
        } finally {
            project.cleanup();
        }
    });
});

test('the report aggregates this session: suggestions, reads, unsuggested reads, latency and failures', () => {
    const entry = (data: Record<string, unknown>) => ({ type: 'custom', customType: 'cratis-system-one', data: { version: 1, ...data } });
    const judged = (turnId: string, latencyMs: number, probabilities: Record<string, number>) => entry({ kind: 'skill-relevance', turnId, latencyMs, probabilities });
    const outcome = (turnId: string, read: string[], otherReads?: number) => entry({ kind: 'skill-outcome', turnId, read, otherReads });
    const report = aggregateShadow([
        judged('t1', 100, { a: 0.9, b: 0.6, c: 0.1 }), outcome('t1', ['a', 'x']),
        judged('t2', 300, { a: 0.5, b: 0.49 }), outcome('t2', ['b'], 2),
        judged('t3', 200, { a: 0.7 }),
        entry({ kind: 'skill-failure', turnId: 't4', failure: 'timeout' }),
        entry({ kind: 'skill-failure', turnId: 't5', failure: 'timeout' }),
        entry({ kind: 'skill-failure', turnId: 't6', failure: 'invalid-request' }),
        { type: 'custom', customType: 'someone-else', data: { kind: 'skill-relevance', turnId: 't9', probabilities: { z: 1 } } },
        { type: 'message' },
        entry({ kind: 'skill-relevance', turnId: 42 }),
    ]);
    assert.equal(report.turnsJudged, 3);
    assert.equal(report.turnsAwaitingOutcome, 1);
    assert.equal(report.suggested, 3, 'a, b, then a (b at 0.49 is below the threshold)');
    assert.equal(report.suggestedAndRead, 1, 'only a in t1');
    // x was asked about but not answered in t1, so it is neither a hit nor a miss: it is counted on its own line.
    assert.equal(report.readNotSuggested, 1, 'b in t2, which was asked, answered 0.49 and read');
    assert.equal(report.askedUnansweredRead, 1, 'x in t1 was asked but got no answer');
    assert.equal(report.otherSkillReads, 2, 'the two the extension counted without naming in t2');
    const text = formatReport(report);
    assert.match(text, /Asked but unanswered skills read \(a request failed; not counted above\): 1/);
    assert.match(text, /Other skill reads \(not in the corpus, or not asked about; not counted above\): 2/);
    assert.equal(report.latencyP50Ms, 200);
    assert.equal(report.latencyP95Ms, 300);
    assert.deepEqual([...report.failures], [['timeout', 2], ['invalid-request', 1]]);
});

test('/system-one report reads the session entries', async () => {
    await withServer(answering(id => id === 'skill-a' ? 0.9 : 0.1), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project);
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }, { name: 'skill-b' }]);
            await session.askAndSettle(promptText, skills);
            session.read('.cratis/ai/skills/skill-b/SKILL.md');
            session.end();
            const report = await session.command('report');
            assert.match(report, /Turns judged: 1\n/);
            assert.match(report, /Skills suggested at 0\.5 or above: 1/);
            assert.match(report, /of those, read by the model: 0 \(0%\)/);
            assert.match(report, /Skills read that were not suggested: 1/);
            assert.match(report, /Backend latency: p50 \d+ ms, p95 \d+ ms/);
            assert.match(report, /Failures: none/);
            assert.match(report, /cat in bash is not counted/);
        } finally {
            project.cleanup();
        }
    });
});

test('a turn whose request failed records no outcome suggestions, and unknown subcommands explain usage', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const session = host(project, { transport: async () => new Response('', { status: 500 }) });
        await session.askAndSettle(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        session.end();
        assert.deepEqual(session.entriesOfKind('skill-relevance'), []);
        assert.match(await session.command('bogus'), /Usage: \/system-one \[status\|last\|report\|setup\|off\]/);
        assert.match(await session.command(''), /System One \(experimental, advisory only\)/);
    } finally {
        project.cleanup();
    }
});

test('no handler throws on hostile events, and notices need a UI', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const session = host(project, { transport: async () => { throw new Error('boom'); } });
        const events: Array<[string, unknown]> = [['before_agent_start', undefined], ['before_agent_start', { prompt: 42 }], ['tool_result', undefined], ['tool_result', { toolName: 'read', input: { path: 7 } }], ['input', undefined], ['input', {}], ['agent_end', undefined], ['session_start', undefined]];
        for (const [name, event] of events) {
            await assert.doesNotReject(async () => session.handlers.get(name)!(event, { cwd: project.directory, hasUI: false }), name);
        }
    } finally {
        project.cleanup();
    }
});
