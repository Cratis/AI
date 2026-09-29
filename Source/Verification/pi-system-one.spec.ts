// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { askSystemOne, retryAfterMs, validateAnswers } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/client.ts';
import { loadConfiguration as resolveConfiguration } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/configuration.ts';
import { checkEndpoint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/endpoint.ts';
import { BreakerState } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/BreakerState.ts';
import { CircuitBreaker } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/CircuitBreaker.ts';
import { EndpointSource } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/EndpointSource.ts';
import { FailureClass } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/FailureClass.ts';
import { SkillRelevanceMode } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/SkillRelevanceMode.ts';
import { answering, answerBody, enabledProject, fakeServer, host, json, projectFixture, promptText, skillsIn } from './pi-system-one-helpers.ts';

const secret = 'sk-test-secret-value-1234567890';

async function withServer<T>(behavior: Parameters<typeof fakeServer>[0], run: (server: Awaited<ReturnType<typeof fakeServer>>) => Promise<T>): Promise<T> {
    const server = await fakeServer(behavior);
    try {
        return await run(server);
    } finally {
        await server.close();
    }
}

// ---------------------------------------------------------------- disabled or unconfigured

test('unconfigured, disabled or environment-only setups never send a request', async () => {
    await withServer(answering(0.9), async server => {
        const environment = { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: server.endpoint, TYPESAFE_API_KEY: secret, CRATIS_SYSTEM_ONE_API_KEY: secret };
        const setups: Array<[string, unknown]> = [
            ['no ai.json', undefined],
            ['no systemOne section', { profiles: ['cratis/documentation'] }],
            ['enabled false', { systemOne: { enabled: false, endpoint: server.endpoint } }],
            ['enabled omitted', { systemOne: { endpoint: server.endpoint } }],
            ['environment only', { profiles: [] }],
        ];
        for (const [name, configuration] of setups) {
            const project = projectFixture(configuration);
            try {
                const session = host(project.directory, { environment });
                const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
                const { result, unchanged } = await session.ask(promptText, skills);
                assert.equal(result, undefined, name);
                assert.ok(unchanged, name);
                assert.deepEqual(session.entries, [], name);
                assert.match(await session.command('status'), /State: disabled/, name);
                assert.match(await session.command('last'), /not been asked/, name);
            } finally {
                project.cleanup();
            }
        }
        assert.equal(server.requests.length, 0, 'the server must receive nothing');
    });
});

test('the extension registers only a command: no tool and no message injection', async () => {
    const project = projectFixture();
    try {
        const session = host(project.directory);
        assert.deepEqual([...session.commands.keys()], ['system-one']);
        assert.deepEqual(session.misuse, []);
        assert.deepEqual([...session.handlers.keys()].sort(), ['agent_end', 'before_agent_start', 'input', 'session_start', 'tool_result']);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- consent

test('a repository-supplied endpoint never receives an Authorization header', async () => {
    await withServer(answering(0.7), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const environment = { TYPESAFE_API_KEY: secret, CRATIS_SYSTEM_ONE_API_KEY: secret, CRATIS_SYSTEM_ONE: '1' };
            const session = host(project.directory, { environment });
            await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(server.requests.length, 1);
            assert.equal(server.requests[0].headers.authorization, undefined);
            assert.equal(JSON.stringify(server.requests[0].headers).includes(secret), false);
            assert.match(await session.command('status'), /no credential sent/);
        } finally {
            project.cleanup();
        }
    });
});

test('an environment opt-in without an endpoint of its own still cannot use the key on a repository endpoint', async () => {
    await withServer(answering(0.7), async server => {
        const project = enabledProject(server.endpoint);
        try {
            let elsewhere = 0;
            const session = host(project.directory, {
                environment: { CRATIS_SYSTEM_ONE_ENDPOINT: 'https://example.invalid', TYPESAFE_API_KEY: secret },
                transport: async (input, init) => { elsewhere++; return fetch(input, init); },
            });
            await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            // CRATIS_SYSTEM_ONE=1 is missing, so the environment endpoint is ignored entirely.
            assert.equal(server.requests.length, 1);
            assert.equal(server.requests[0].headers.authorization, undefined);
            assert.equal(elsewhere, 1);
        } finally {
            project.cleanup();
        }
    });
});

test('a repository-supplied non-loopback endpoint is refused and sends nothing', async () => {
    for (const endpoint of ['https://example.invalid', 'http://example.invalid', 'http://10.0.0.5:8000', 'https://api.typesafe.ai', 'http://127.0.0.1@example.invalid', 'http://localhost.example.invalid', 'http://127.0.0.1.example.invalid', 'http://user:pass@127.0.0.1:8000', 'ftp://127.0.0.1', 'http://127.0.0.1:8000/?x=1']) {
        const project = enabledProject(endpoint);
        try {
            let calls = 0;
            const session = host(project.directory, { environment: { TYPESAFE_API_KEY: secret }, transport: async () => { calls++; throw new Error('must not be called'); } });
            const { result } = await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(result, undefined);
            assert.equal(calls, 0, endpoint);
            assert.equal(session.notices.length, 1, `${endpoint}: exactly one notice`);
            assert.match(session.notices[0], /System One is disabled/);
            assert.equal(session.notices[0].includes(secret), false);
        } finally {
            project.cleanup();
        }
    }
    assert.equal(resolveConfiguration('/nonexistent').enabled, false);
});

test('loopback endpoints are accepted from a repository over http or https', () => {
    for (const endpoint of ['http://127.0.0.1:8000', 'http://localhost:8000/', 'http://[::1]:8000', 'https://127.0.0.1:9443/base']) {
        const checked = checkEndpoint(endpoint, EndpointSource.Repository);
        assert.ok(!('error' in checked), endpoint);
        assert.equal(checked.loopback, true);
    }
    const trailing = checkEndpoint('http://localhost:8000/base//', EndpointSource.Repository);
    assert.ok(!('error' in trailing));
    assert.equal(trailing.endpoint, 'http://localhost:8000/base');
    assert.equal(trailing.origin, 'http://localhost:8000');
});

test('a user-configured non-loopback http endpoint is refused, https is accepted', () => {
    const insecure = checkEndpoint('http://example.invalid', EndpointSource.Environment);
    assert.ok('error' in insecure);
    assert.match(insecure.error, /https/);
    const secure = checkEndpoint('https://example.invalid/api', EndpointSource.Environment);
    assert.ok(!('error' in secure));
    assert.equal(secure.loopback, false);
    assert.equal(secure.origin, 'https://example.invalid');

    const project = enabledProject('http://127.0.0.1:1');
    try {
        const refused = resolveConfiguration(project.directory, { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: 'http://example.invalid' });
        assert.equal(refused.enabled, false);
        assert.match(refused.enabled ? '' : refused.reason, /CRATIS_SYSTEM_ONE_ENDPOINT/);
    } finally {
        project.cleanup();
    }
});

test('a user-configured https endpoint gets the hosted key, a local endpoint only the local key', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const sent: Array<{ url: string; authorization?: string }> = [];
        const transport = async (input: string | URL | Request, init?: RequestInit) => {
            sent.push({ url: String(input), authorization: (init?.headers as Record<string, string>).authorization });
            return new Response(JSON.stringify(answerBody({ body: { questions: { 'skill-a': {} } } } as never, 0.5)), { status: 200 });
        };
        const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);

        const hosted = host(project.directory, { transport, environment: { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: 'https://example.invalid/', TYPESAFE_API_KEY: secret } });
        await hosted.ask(promptText, skills);
        assert.deepEqual(sent.at(-1), { url: 'https://example.invalid/v1/systemone', authorization: `Bearer ${secret}` });
        const status = await hosted.command('status');
        assert.match(status, /https:\/\/example\.invalid \(from your environment; credential attached\)/);
        assert.equal(status.includes(secret), false);
        assert.equal(JSON.stringify(hosted.entries).includes(secret), false);

        // A hosted key is never sent to a plain-http local server; the local key is.
        const local = host(project.directory, { transport, environment: { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: 'http://127.0.0.1:8000', TYPESAFE_API_KEY: secret } });
        await local.ask(promptText, skills);
        assert.deepEqual(sent.at(-1), { url: 'http://127.0.0.1:8000/v1/systemone', authorization: undefined });
        const localKey = host(project.directory, { transport, environment: { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: 'http://127.0.0.1:8000', CRATIS_SYSTEM_ONE_API_KEY: 'local-key' } });
        await localKey.ask(promptText, skills);
        assert.equal(sent.at(-1)?.authorization, 'Bearer local-key');
    } finally {
        project.cleanup();
    }
});

test('environment variables alone never enable the extension, and can restrict or tune it', async () => {
    const environment = { CRATIS_SYSTEM_ONE: '1', CRATIS_SYSTEM_ONE_ENDPOINT: 'https://example.invalid', TYPESAFE_API_KEY: secret };
    for (const configuration of [undefined, {}, { systemOne: {} }, { systemOne: { enabled: false } }]) {
        const project = projectFixture(configuration);
        try {
            assert.equal(resolveConfiguration(project.directory, environment).enabled, false);
        } finally {
            project.cleanup();
        }
    }
    const project = enabledProject('http://127.0.0.1:8000');
    try {
        assert.equal(resolveConfiguration(project.directory, {}).enabled, true);
        assert.equal(resolveConfiguration(project.directory, { CRATIS_SYSTEM_ONE: '0' }).enabled, false);
        const off = resolveConfiguration(project.directory, { CRATIS_SYSTEM_ONE_SKILL_RELEVANCE: 'off' });
        assert.ok(off.enabled && off.settings.skillRelevance.mode === SkillRelevanceMode.Off);
        // 'shadow' cannot re-enable what the repository turned off.
        const tuned = resolveConfiguration(project.directory, { CRATIS_SYSTEM_ONE_TIMEOUT_MS: '300', CRATIS_SYSTEM_ONE_MODEL: 'laya' });
        assert.ok(tuned.enabled && tuned.settings.timeoutMs === 300 && tuned.settings.model === 'laya');
        assert.equal(resolveConfiguration(project.directory, { CRATIS_SYSTEM_ONE_TIMEOUT_MS: '99999' }).enabled, false);
        const defaults = resolveConfiguration(project.directory, {});
        assert.ok(defaults.enabled);
        assert.deepEqual(defaults.settings.skillRelevance, { mode: 'shadow', maxQuestions: 50, minPromptChars: 20, stateChars: 1200, criterionChars: 200 });
        assert.equal(defaults.settings.model, 'jev-latest');
        assert.equal(defaults.settings.timeoutMs, 750);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- malformed configuration

test('malformed or unknown configuration disables the extension with one notice and never throws', async () => {
    const cases: Array<[string, unknown]> = [
        ['invalid JSON mentioning systemOne', '{ "systemOne": { "enabled": true, '],
        ['a JSON array', '["systemOne"]'],
        ['systemOne is a string', { systemOne: 'on' }],
        ['enabled is not a boolean', { systemOne: { enabled: 'yes' } }],
        ['unknown key', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', sendEverything: true } }],
        ['unknown skillRelevance key', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', skillRelevance: { hint: true } } }],
        ['unknown mode', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', skillRelevance: { mode: 'hint' } } }],
        ['out-of-range timeout', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', timeoutMs: 60000 } }],
        ['fractional fuse', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', skillRelevance: { maxQuestions: 1.5 } } }],
        ['bad model', { systemOne: { enabled: true, endpoint: 'http://127.0.0.1:1', model: 'a b; c' } }],
        ['endpoint is a number', { systemOne: { enabled: true, endpoint: 8000 } }],
        ['no endpoint (there is no hosted default)', { systemOne: { enabled: true } }],
    ];
    for (const [name, configuration] of cases) {
        const project = projectFixture(configuration);
        try {
            let calls = 0;
            const session = host(project.directory, { environment: {}, transport: async () => { calls++; throw new Error('must not be called'); } });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            for (let turn = 0; turn < 2; turn++) {
                const { result } = await session.ask(promptText, skills);
                assert.equal(result, undefined, name);
            }
            assert.equal(calls, 0, name);
            assert.equal(session.notices.length, 1, `${name}: one notice, not one per turn`);
            assert.deepEqual(session.entries, []);
            assert.match(await session.command('status'), /State: disabled/);
        } finally {
            project.cleanup();
        }
    }
});

test('a broken ai.json that never mentions systemOne is not announced by this extension', async () => {
    const project = projectFixture('{ "profiles": [ ');
    try {
        const session = host(project.directory);
        await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.deepEqual(session.notices, []);
        const result = resolveConfiguration(project.directory, {});
        assert.equal(result.enabled, false);
    } finally {
        project.cleanup();
    }
});

// ---------------------------------------------------------------- timeout and circuit breaker

test('before_agent_start returns within the timeout against a hanging server, and the breaker opens after three failures', async () => {
    await withServer(() => { /* accept the request and never answer */ }, async server => {
        const timeoutMs = 150;
        const project = enabledProject(server.endpoint, { timeoutMs });
        try {
            const session = host(project.directory, { environment: {} });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            for (let turn = 1; turn <= 3; turn++) {
                const started = Date.now();
                const { result } = await session.ask(promptText, skills);
                const elapsed = Date.now() - started;
                assert.equal(result, undefined);
                assert.ok(elapsed >= timeoutMs - 20 && elapsed < timeoutMs + 400, `turn ${turn} took ${elapsed} ms`);
            }
            assert.equal(server.requests.length, 3);
            const status = await session.command('status');
            assert.match(status, /failed 3 \(timeout 3\)/);
            assert.match(status, /Circuit breaker: open, retry in/);

            const started = Date.now();
            await session.ask(promptText, skills);
            assert.ok(Date.now() - started < 50, 'an open breaker answers immediately');
            assert.equal(server.requests.length, 3, 'no request while the breaker is open');
            assert.match(await session.command('status'), /circuit breaker open 1/);
            assert.equal(session.notices.filter(notice => /failed \(timeout\)/.test(notice)).length, 1, 'one notice per error class');
            assert.equal(session.notices.filter(notice => /paused/.test(notice)).length, 1);
        } finally {
            project.cleanup();
        }
    });
});

test('the circuit breaker honors Retry-After, allows one probe, and closes on success', () => {
    let clock = 1_000;
    const breaker = new CircuitBreaker(3, () => clock);
    assert.equal(breaker.state, BreakerState.Closed);
    assert.equal(breaker.recordFailure(FailureClass.Timeout), false);
    assert.equal(breaker.recordFailure(FailureClass.Network), false);
    assert.equal(breaker.allow(), true);
    assert.equal(breaker.recordFailure(FailureClass.ServerError), true, 'the third consecutive failure opens it');
    assert.equal(breaker.state, BreakerState.Open);
    assert.equal(breaker.allow(), false);
    clock += 29_999;
    assert.equal(breaker.allow(), false);
    clock += 1;
    assert.equal(breaker.state, BreakerState.HalfOpen);
    assert.equal(breaker.allow(), true, 'one probe');
    assert.equal(breaker.allow(), false, 'only one');
    assert.equal(breaker.recordFailure(FailureClass.Timeout), true, 'a failed probe re-opens it with a longer back-off');
    assert.equal(breaker.retryInMs, 60_000);
    breaker.recordSuccess();
    assert.equal(breaker.state, BreakerState.Closed);

    // 429 and 529 open at once and wait as long as the server asked.
    assert.equal(breaker.recordFailure(FailureClass.RateLimited, 2_000), true);
    assert.equal(breaker.retryInMs, 2_000);
    clock += 2_000;
    assert.equal(breaker.state, BreakerState.HalfOpen);
    breaker.recordSuccess();
    assert.equal(breaker.recordFailure(FailureClass.Overloaded), true);
    assert.equal(breaker.retryInMs, 30_000, 'without Retry-After the back-off applies');
});

test('Retry-After and retry-after-ms are read', () => {
    assert.equal(retryAfterMs(new Headers({ 'retry-after-ms': '1500' })), 1500);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '7' })), 7000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': new Date(10_000).toUTCString() }), () => 4_000), 6000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': 'soon' })), undefined);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '99999' })), 600_000, 'capped');
    assert.equal(retryAfterMs(new Headers()), undefined);
});

// ---------------------------------------------------------------- failure paths fail open

const failures: Array<[string, Parameters<typeof fakeServer>[0], FailureClass]> = [
    ['401', (_request, response) => json(response, 401, { detail: 'nope' }), FailureClass.Unauthorized],
    ['422', (_request, response) => json(response, 422, { detail: 'bad' }), FailureClass.InvalidRequest],
    ['429', (_request, response) => json(response, 429, { detail: 'slow down' }, { 'retry-after': '1' }), FailureClass.RateLimited],
    ['529', (_request, response) => json(response, 529, { detail: 'busy' }, { 'retry-after-ms': '500' }), FailureClass.Overloaded],
    ['500', (_request, response) => json(response, 500, 'oops'), FailureClass.ServerError],
    ['redirect', (_request, response) => { response.writeHead(307, { location: 'https://example.invalid/steal' }); response.end(); }, FailureClass.Network],
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
    test(`a ${name} answer fails open with one notice and records nothing`, async () => {
        await withServer(behavior, async server => {
            const project = enabledProject(server.endpoint);
            try {
                const session = host(project.directory, { environment: {} });
                const skills = skillsIn(project.directory, [{ name: 'skill-a' }, { name: 'skill-b' }]);
                for (let turn = 0; turn < 2; turn++) {
                    const { result, unchanged } = await session.ask(promptText, skills);
                    assert.equal(result, undefined);
                    assert.ok(unchanged);
                }
                assert.deepEqual(session.entries, [], 'a failed request records no suggestions');
                assert.deepEqual(session.misuse, []);
                assert.equal(session.notices.filter(notice => notice.includes(`(${expected})`)).length, 1, `one notice for ${expected}: ${session.notices.join(' | ')}`);
                const status = await session.command('status');
                assert.match(status, new RegExp(`${expected} [12]`));
                assert.match(await session.command('last'), new RegExp(`${expected}`));
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
        const session = host(project.directory, { environment: {} });
        const { result } = await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        assert.equal(result, undefined);
        assert.match(await session.command('status'), /network 1/);
    } finally {
        project.cleanup();
    }
});

test('a transport that throws or ignores the abort signal still fails open within the timeout', async () => {
    const project = enabledProject('http://127.0.0.1:1', { timeoutMs: 100 });
    try {
        const throwing = host(project.directory, { environment: {}, transport: async () => { throw new TypeError('boom'); } });
        const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
        assert.equal((await throwing.ask(promptText, skills)).result, undefined);
        assert.match(await throwing.command('status'), /network 1/);

        const ignoring = host(project.directory, { environment: {}, transport: () => new Promise<Response>(() => { /* never settles */ }) });
        const started = Date.now();
        assert.equal((await ignoring.ask(promptText, skills)).result, undefined);
        assert.ok(Date.now() - started < 500);
        assert.match(await ignoring.command('status'), /timeout 1/);
    } finally {
        project.cleanup();
    }
});

test('a rate-limited answer reports how long the server asked to wait', async () => {
    await withServer((_request, response) => json(response, 429, {}, { 'retry-after-ms': '2500' }), async server => {
        const outcome = await askSystemOne({ endpoint: server.endpoint, model: 'jev-latest', timeoutMs: 1000 }, { prompt: 'x' }, { a: { type: 'noul', instructions: 'a', criteria: { true: 'a' } } });
        assert.deepEqual(outcome.ok, false);
        assert.ok(!outcome.ok && outcome.failure === FailureClass.RateLimited && outcome.retryAfterMs === 2500);
    });
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

test('the state never exceeds the cap and holds only the prompt', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint, { skillRelevance: { stateChars: 300 } });
        try {
            const session = host(project.directory, { environment: {} });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            const long = `${'x'.repeat(299)}\u{1F600}${'y'.repeat(5000)}`;
            await session.ask(long, skills);
            assert.equal(server.requests.length, 1);
            const state = server.requests[0].body.state;
            assert.deepEqual(Object.keys(state), ['prompt']);
            assert.ok(state.prompt.length <= 300, `${state.prompt.length}`);
            assert.doesNotMatch(state.prompt, /[\ud800-\udbff]$/, 'no half of a surrogate pair');

            await session.ask(promptText, skills);
            assert.equal(server.requests[1].body.state.prompt, promptText);
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
            const session = host(project.directory, { environment: {}, packagedSkillRoots: [] });
            await session.ask(promptText, [...managed, viaSymlink, ...foreign, ...lookalike]);

            assert.equal(server.requests.length, 1);
            const request = server.requests[0];
            assert.equal(request.method, 'POST');
            assert.equal(request.url, '/v1/systemone');
            assert.equal(request.headers['content-type'], 'application/json');
            assert.equal(request.body.model, 'jev-latest');
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

test('the packaged corpus counts as a corpus root', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const packaged = skillsIn(project.directory, [{ name: 'packaged-skill', directory: join('node_modules', 'pkg', 'corpus', 'skills') }]);
            const session = host(project.directory, { environment: {}, packagedSkillRoots: [join(project.directory, 'node_modules', 'pkg', 'corpus', 'skills')] });
            await session.ask(promptText, packaged);
            assert.deepEqual(Object.keys(server.requests[0].body.questions), ['packaged-skill']);
        } finally {
            project.cleanup();
        }
    });
});

test('the question-count fuse skips the call and reports it instead of trimming', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project.directory, { environment: {}, packagedSkillRoots: [] });
            const fifty = skillsIn(project.directory, Array.from({ length: 50 }, (_unused, index) => ({ name: `skill-${index}` })));
            await session.ask(promptText, fifty);
            assert.equal(server.requests.length, 1, 'exactly the limit is asked');
            assert.equal(Object.keys(server.requests[0].body.questions).length, 50);

            const fiftyOne = skillsIn(project.directory, Array.from({ length: 51 }, (_unused, index) => ({ name: `skill-${index}` })));
            await session.ask(promptText, fiftyOne);
            await session.ask(promptText, fiftyOne);
            assert.equal(server.requests.length, 1, 'over the limit nothing is sent, not even a trimmed list');
            assert.equal(session.notices.filter(notice => /exceed the limit of 50/.test(notice)).length, 1);
            assert.match(await session.command('status'), /too many skills 2/);
        } finally {
            project.cleanup();
        }
    });
});

test('short prompts, slash commands and turns without corpus skills are not asked about', async () => {
    await withServer(answering(0.5), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project.directory, { environment: {}, packagedSkillRoots: [] });
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }]);
            await session.ask('fix it', skills);
            session.input('/review the current diff');
            await session.ask('Review the current diff and list the risky changes in detail.', skills);
            await session.ask('/deploy staging with the normal settings and report back', skills);
            await session.ask('<skill name="cratis-arc-command">...</skill> add a command please', skills);
            await session.ask(promptText, []);
            await session.ask(promptText, skillsIn(project.directory, [{ name: 'personal', directory: 'elsewhere' }]));
            assert.equal(server.requests.length, 0);
            const status = await session.command('status');
            assert.match(status, /short prompt 1/);
            assert.match(status, /slash command 3/);
            assert.match(status, /no eligible skills 2/);

            session.input('add a command that opens an account for a new customer');
            await session.ask(promptText, skills);
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
            const session = host(project.directory, { environment: {} });
            await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
            assert.equal(server.requests.length, 0);
            assert.match(await session.command('status'), /Skill relevance: off/);
        } finally {
            project.cleanup();
        }
    });
});

// ---------------------------------------------------------------- shadow mode

test('shadow mode changes nothing, records ids and probabilities without the prompt, and later records reads', async () => {
    const sentinel = 'zebra-quartz-7731';
    const prompt = `${promptText} Reference ${sentinel}.`;
    await withServer(answering(id => id === 'skill-a' ? 0.91 : id === 'skill-b' ? 0.42 : 0.03), async server => {
        const project = enabledProject(server.endpoint);
        try {
            const session = host(project.directory, { environment: {}, packagedSkillRoots: [] });
            session.sessionStart();
            const skills = skillsIn(project.directory, [{ name: 'skill-a' }, { name: 'skill-b' }, { name: 'skill-c' }]);
            const { result, unchanged } = await session.ask(prompt, skills, 'the system prompt');

            assert.equal(result, undefined, 'no systemPrompt, no message');
            assert.ok(unchanged);
            assert.deepEqual(session.misuse, [], 'no message, tool or tool-set changes');
            assert.equal(server.requests.length, 1);

            assert.equal(session.entries.length, 1);
            const [suggestion] = session.entries;
            assert.equal(suggestion.type, 'cratis-system-one');
            assert.equal(suggestion.data.kind, 'skill-relevance');
            assert.equal(suggestion.data.endpoint, server.endpoint);
            assert.equal(suggestion.data.mode, 'shadow');
            assert.equal(suggestion.data.asked, 3);
            assert.equal(typeof suggestion.data.latencyMs, 'number');
            assert.deepEqual(suggestion.data.probabilities, { 'skill-a': 0.91, 'skill-b': 0.42, 'skill-c': 0.03 });

            // The model reads skill-a (through a relative path and an @ prefix), fails to read skill-b,
            // and reads something that is not a skill.
            session.read('.cratis/ai/skills/skill-a/SKILL.md');
            session.read('@.cratis/ai/skills/skill-b/SKILL.md', true);
            session.read('README.md');
            assert.equal(session.entries.length, 1, 'the outcome is recorded when the turn ends');
            const during = await session.command('last');
            assert.match(during, /skill-a/);
            assert.match(during, /turn in progress/);
            session.end();

            assert.equal(session.entries.length, 2);
            assert.deepEqual(session.entries[1].data, { kind: 'skill-outcome', version: 1, turn: 1, read: ['skill-a'], readEarlier: [] });
            assert.equal(JSON.stringify(session.entries).includes(sentinel), false, 'the prompt is never recorded');
            assert.equal(JSON.stringify(session.entries).includes('Reference'), false);

            const last = await session.command('last');
            assert.equal(last.includes(sentinel), false);
            assert.match(last, /Turn 1 .*answered, \d+ ms, 3 skills asked, http:\/\/127\.0\.0\.1:\d+/);
            assert.match(last, /0\.91 {2}skill-a {2}\(read\)/);
            assert.match(last, /0\.42 {2}skill-b {2}\(not read\)/);
            assert.match(last, /0\.03 {2}skill-c {2}\(not read\)/);
            assert.ok(last.indexOf('skill-a') < last.indexOf('skill-b') && last.indexOf('skill-b') < last.indexOf('skill-c'), 'highest probability first');
            assert.match(last, /Shadow mode/);

            const status = await session.command('status');
            assert.match(status, /State: enabled/);
            assert.match(status, new RegExp(`Endpoint: ${server.endpoint.replace(/[.]/g, '\\.')} \\(from repository configuration, loopback; no credential sent\\)`));
            assert.match(status, /Requests: 1, succeeded 1, failed 0/);
            assert.match(status, /Circuit breaker: closed/);

            // A second turn learns that skill-a was already read earlier in the session.
            await session.ask(promptText, skills);
            session.end();
            assert.deepEqual(session.entries.at(-1)?.data.readEarlier, ['skill-a']);

            // A new session starts from zero.
            session.sessionStart();
            assert.match(await session.command('status'), /Requests: 0/);
            assert.match(await session.command('last'), /not been asked/);
        } finally {
            project.cleanup();
        }
    });
});

test('a turn whose request failed records no outcome, and unknown subcommands explain usage', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const session = host(project.directory, { environment: {}, transport: async () => new Response('', { status: 500 }) });
        await session.ask(promptText, skillsIn(project.directory, [{ name: 'skill-a' }]));
        session.end();
        assert.deepEqual(session.entries, []);
        assert.match(await session.command('bogus'), /Usage: \/system-one \[status\|last\]/);
        assert.match(await session.command(''), /System One \(experimental, advisory only\)/);
    } finally {
        project.cleanup();
    }
});

test('no handler throws on hostile events, and notices need a UI', async () => {
    const project = enabledProject('http://127.0.0.1:1');
    try {
        const session = host(project.directory, { environment: {}, transport: async () => { throw new Error('boom'); } });
        const events: Array<[string, unknown]> = [['before_agent_start', undefined], ['before_agent_start', { prompt: 42 }], ['tool_result', undefined], ['tool_result', { toolName: 'read', input: { path: 7 } }], ['input', undefined], ['input', {}], ['agent_end', undefined], ['session_start', undefined]];
        for (const [name, event] of events) {
            await assert.doesNotReject(async () => session.handlers.get(name)!(event, { cwd: project.directory, hasUI: false }), name);
        }
    } finally {
        project.cleanup();
    }
});
