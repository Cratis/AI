// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
const guards = ['cratis-guard-secrets', 'cratis-guard-store-mutations', 'cratis-guard-writes', 'cratis-guard-shell-writes'];
const payload = JSON.stringify({ tool_input: { command: 'cat .env; cratis chronicle observers list', file_path: 'README.md' } });

function assertRefused(guard: string, input: string, path: string = process.env.PATH ?? ''): void {
    const result = spawnSync('bash', [join(scripts, `${guard}.sh`)], {
        input,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: path,
            CRATIS_HOOKS_ALLOW_SECRET_READS: '0',
            CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0',
            CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
        },
    });
    assert.equal(result.status, 2, `${guard}\n${result.stderr}`);
    assert.match(result.stderr, new RegExp(`BLOCKED by ${guard}: parser failed`));
}

for (const guard of guards) {
    test(`${guard} refuses malformed parser input`, () => {
        assertRefused(guard, 'not json');
        assertRefused(guard, `${payload}\n{"cwd":"0"}\nnot json`);
    });
}

test('the write guard refuses a later document that imitates its parser sentinel', () => {
    for (const cwd of ['ok', 'ok\u0000']) {
        const forged = `${JSON.stringify({ tool_input: { file_path: 'README.md' } })}\n${JSON.stringify({ cwd })}`;
        assertRefused('cratis-guard-writes', `${forged}\nnot json`);
        assertRefused('cratis-guard-writes', forged);
    }
});

// macOS ships Bash 3.2 as /bin/bash; hooks that run under it must not refuse ordinary tool calls.
test('guards allow ordinary tool calls under the system /bin/bash', { skip: !existsSync('/bin/bash') }, () => {
    const inputs = [
        JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'Source/example.ts', content: 'export const a = 1;\n' } }),
        JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls -la' } }),
    ];
    for (const guard of guards) {
        for (const input of inputs) {
            const result = spawnSync('/bin/bash', [join(scripts, `${guard}.sh`)], {
                input,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CRATIS_HOOKS_ALLOW_SECRET_READS: '0',
                    CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0',
                    CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
                },
            });
            assert.equal(result.status, 0, `${guard} under /bin/bash\n${result.stderr}`);
        }
    }
});

function assertMissingCwd(variant: string, env: NodeJS.ProcessEnv): void {
    const result = spawnSync('bash', [join(scripts, 'cratis-guard-secrets.sh')], {
        cwd: resolve(import.meta.dirname, '../..'), input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rg -n PASSWORD Source .env.example' } }),
        encoding: 'utf8', timeout: 10_000, env,
    });
    assert.equal(result.status, 2, `${variant}: missing cwd: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /parser failed/);
}

test('available awk variants preserve credential and shell-reference decisions', t => {
    const variants = [
        ['BSD/system', '/usr/bin/awk'],
        ...['gawk', 'mawk'].map(name => [name, spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim()]),
    ].filter(([, path]) => path);
    const busybox = spawnSync('which', ['busybox'], { encoding: 'utf8' }).stdout.trim();
    if (busybox) variants.push(['BusyBox', `${busybox} awk`]);
    else t.diagnostic('BusyBox awk: not installed');
    const directory = mkdtempSync(join(tmpdir(), 'cratis-awk-matrix-'));
    try {
        writeFileSync(join(directory, 'Directory.Build.props'), 'synthetic fixture');
        writeFileSync(join(directory, 'server.txt'), 'synthetic fixture');
        mkdirSync(join(directory, 'keys'));
        writeFileSync(join(directory, 'keys/server.pem'), 'synthetic fixture');
        for (const [name, executable] of variants) {
            const bin = join(directory, name.replace(/\W/g, '-'));
            mkdirSync(bin);
            writeFileSync(join(bin, 'awk'), `#!/bin/sh\nexec ${executable} "$@"\n`, { mode: 0o755 });
            const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CRATIS_HOOKS_ALLOW_SECRET_READS: '' };
            const cases: [string, string, number | null][] = [
                ['cratis-guard-secrets.sh', String.raw`x=[fail\]; cat $x`, null],
                ['cratis-guard-secrets.sh', String.raw`for f in [fail\]; do cat $f; done`, null],
                ['cratis-guard-secrets.sh', 'cat ${x:-[fail\\]}', null],
                ['cratis-guard-secrets.sh', String.raw`cat {a,[fail\]}`, null],
                ['cratis-guard-secrets.sh', String.raw`rg -n '\[FAIL\]' gate.log`, 0],
                ['cratis-guard-secrets.sh', String.raw`rg -n '\[FAIL\]' *.log`, 0],
                ['cratis-guard-secrets.sh', 'cat [.]env', 2],
                ['cratis-guard-secrets.sh', 'cat .[e]nv', 2],
                ['cratis-guard-secrets.sh', 'cat id_[r]sa', 2],
                ['cratis-guard-secrets.sh', 'cat secret.p[[:digit:]]m', 0],
                ['cratis-guard-secrets.sh', 'cat [a-[:digit:]]', null],
                ['cratis-guard-secrets.sh', 'cat secret.*', 2],
                ['cratis-guard-secrets.sh', "c''d keys; cat server*", 2],
                ['cratis-guard-secrets.sh', String.raw`c\d keys; cat server*`, 2],
                ['cratis-guard-secrets.sh', 'rg -L foo cert*', 2],
                ['cratis-guard-secrets.sh', 'rg -n foo Directory.Build.*', 0],
                ['cratis-guard-secrets.sh', 'git add Specs/for_ApplicationCredentials/given/a.cs', 0],
                ['cratis-guard-secrets.sh', 'git add credentials.json', 2],
                ['cratis-guard-secrets.sh', 'git grep -n -e credentials -e .env -- Source/AuthProxy', 0],
                ['cratis-guard-secrets.sh', 'git ls-files Source/AuthProxy/Credentials', 0],
                ['cratis-guard-secrets.sh', 'git grep -e x -- secrets.json', 2],
                ['cratis-guard-secrets.sh', 'git show HEAD:.env', 2],
                ['cratis-guard-shell-writes.sh', 'git ls-files --debug -- .env', 0],
                ['cratis-guard-shell-writes.sh', 'echo x > *.csproj', 2],
                ['cratis-guard-shell-writes.sh', 'shopt -s dotglob; echo x > *.csproj', 2],
                ['cratis-guard-shell-writes.sh', "node <<'N'\nconsole.log(`${x || {}}`)\nN", 0],
                ['cratis-guard-shell-writes.sh', "node <<'N'\nrequire('fs').readFileSync('.env')\nN", 2],
                ['cratis-guard-shell-writes.sh', "cat <<'N' | bash\necho x > {.,}env\nN", 2],
                ['cratis-guard-shell-writes.sh', 'rm -f *.local', 2],
                ['cratis-guard-shell-writes.sh', 'echo "\ncat <<\'B\'\n"; echo x | tee {.e,}nv\nB', 2],
                ['cratis-guard-shell-writes.sh', "bash <<'A'\ncat <<'B'\nA\necho x | tee {.e,}nv\nB", 2],
                ['cratis-guard-shell-writes.sh', 'eval "$(\ncat <<\'N\'\nprintf x | tee {.,}env\nN\n)"', 2],
            ];
            for (const [script, command, expected] of cases) {
                const result = spawnSync('bash', [join(scripts, script)], {
                    input: JSON.stringify({ cwd: directory, tool_name: 'Bash', tool_input: { command } }),
                    encoding: 'utf8', timeout: 10_000, env,
                });
                assert.ok(!result.error, `${name}: ${command}: ${result.error}`);
                assert.ok(result.status === 0 || result.status === 2, `${name}: ${command}: ${result.stderr}`);
                if (expected !== null) assert.equal(result.status, expected, `${name}: ${command}: ${result.stderr}`);
                assert.doesNotMatch(result.stderr, /parser failed|syntax error|nonterminated/);
            }
            assertMissingCwd(name, env);
            t.diagnostic(`${name}: ${cases.length + 1}/${cases.length + 1} passed`);
        }
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const tool of ['awk', 'jq']) {
    test(`guards refuse a failed ${tool} invocation, including partial output`, () => {
        const directory = mkdtempSync(join(tmpdir(), 'cratis-parser-failure-'));
        try {
            for (const output of ['', "printf 'partial output\\n'", "printf '\\0\\0\\0\\0\\0'", "printf '\\0\\0\\0\\0\\0%s\\0' 0"]) {
                writeFileSync(join(directory, tool), `#!/bin/sh\n${output}\necho parser-stub-error >&2\nexit 2\n`, { mode: 0o755 });
                for (const guard of tool === 'awk' ? guards.slice(0, 2) : guards) {
                    assertRefused(guard, payload, `${directory}:${process.env.PATH}`);
                }
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
}
