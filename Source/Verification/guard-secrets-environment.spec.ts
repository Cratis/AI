// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const guard = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-secrets.sh');
const blocked = [
    "gh api user --jq env",
    "gh api user -q env",
    "gh api user --jq=env",
    "gh api user -qenv",
    "gh api user -q=env",
    "gh api user --jq '  env  '",
    "gh api user --jq '$ENV'",
    "gh api user --jq '$ENV.GH_TOKEN'",
    "gh api user --jq=\"\u0024ENV.GH_TOKEN\"",
    "gh api user --jq 'env.GH_TOKEN'",
    "gh api user --jq 'env | keys'",
    "gh api user --jq '.foo + env'",
    "gh api user --jq '[.login, (env | keys)]'",
    "gh api user --jq '{value: $ENV[\"GH_TOKEN\"]}'",
    "gh api user --jq '\"value: \\(env | keys)\"'",
    "gh api user --jq '\"value: \\($ENV.GH_TOKEN)\"'",
    "gh pr list --json title --jq env",
    "gh issue list --json title -q '$ENV'",
    "gh api user --template '{{ env }}'",
    "gh api user --template='{{ $ENV.GH_TOKEN }}'",
    "gh api user -t '{{ env }}'",
    "gh api user -t'{{ env }}'",
    "gh api user --jq .login --jq env",
    'gh api user -iq env',
    'gh api user -iqenv',
    'gh api user -X GET -iq env',
    'gh pr list --json title -wq env',
    'gh pr list --json title -dwqenv',
    "gh pr view --json title -wq '$ENV'",
    "gh api user -it '{{ env }}'",
    "gh api user --jq '.[env:]'",
    "gh api user --jq '.[env:2]'",
    "gh api user --jq '.[$ENV:]'",
    "gh api add -t '{{ env }}'",
    "gh api create -t '{{ env }}'",
    "gh api edit -t '{{ env }}'",
    "gh api merge -t '{{ env }}'",
];
const allowed = [
    "gh api user --jq '.login'",
    "gh api user --jq '.environment'",
    "gh api user --jq '.envs'",
    "gh api user --jq '.env'",
    "gh api user --jq '.env.GH_TOKEN'",
    "gh api user --jq '.env | keys'",
    "gh api user --jq '.[\"env\"]'",
    "gh api user --jq '{environment: .environment, env: .env}'",
    "gh api user --jq '\"env\"'",
    "gh api user --jq '\"$ENV\"'",
    "gh api user --jq '.environment as $env | $env'",
    "gh api user --jq '.environment as $ENVS | $ENVS'",
    "gh api user --jq '.login # env is not evaluated'",
    "gh api user --jq '.[\"environment\"] | keys'",
    "gh pr list --json title --jq '.[].title'",
    "gh api user --template '{{ .environment }}'",
    "gh api user --template '{{ .env }}'",
    "gh api user -t '{{ .login }}'",
    'gh issue create -t "Document env setup" -b x',
    'gh pr create -t "Fix env handling" -b x',
    'gh pr edit -t "Fix env handling"',
    'gh release create v1 -t "env update"',
    'gh pr -t "env handling" create -b x',
    'gh pr merge -t "Update env docs"',
    'gh ssh-key add public-key.pub -t "env key"',
    'gh issue edit 1 -t "env docs"',
    'gh release edit v1 -t "env docs"',
    'gh gpg-key add public-key.asc -t "env key"',
    "gh api user -iq '.environment'",
    "gh api user -iq.env",
    "gh api user -X GET -iq '.login'",
    "gh pr list --json title -wq '.[].title'",
    "gh api user -f 'query=env' --jq .login",
    "gh api user --jq '{env: .env}'",
    "gh api user --jq '[{env: .env}, {env: .environment}]'",
    "gh api user --jq '.items[.env:]'",
];

function shellVerdict(command: string, cwd: string, override = '0') {
    const result = spawnSync('bash', [guard], {
        cwd, input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: override },
    });
    assert.ok(result.status === 0 || result.status === 2, result.stderr);
    assert.equal(result.stdout, '', command);
    return result.status;
}

test('the secrets hook blocks output filters that read the process environment and permits field projections', () => {
    for (const command of blocked) assert.equal(shellVerdict(command, import.meta.dirname), 2, command);
    for (const command of allowed) assert.equal(shellVerdict(command, import.meta.dirname), 0, command);
    assert.equal(shellVerdict(blocked[0], import.meta.dirname, '1'), 0);
});

test('Pi applies the same environment-filter decisions without executing the commands', async () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-filter-environment-'));
    const saved = process.env.CRATIS_HOOKS_ALLOW_SECRET_READS;
    process.env.CRATIS_HOOKS_ALLOW_SECRET_READS = '0';
    const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
    registerCratisHooks({ on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(name, handler), registerTool: () => {} } as unknown as ExtensionAPI);
    const call = handlers.get('tool_call');
    assert.ok(call);
    try {
        for (const command of blocked) {
            const result = await call({ toolName: 'bash', input: { command } }, { cwd: project }) as { block?: boolean; reason?: string };
            assert.equal(result?.block, true, command);
            assert.match(result?.reason ?? '', /BLOCKED by cratis-guard-secrets/, command);
        }
        for (const command of allowed.filter(command => command !== 'gh api user -iq.env')) assert.equal(await call({ toolName: 'bash', input: { command } }, { cwd: project }), undefined, command);
    } finally {
        if (saved === undefined) delete process.env.CRATIS_HOOKS_ALLOW_SECRET_READS;
        else process.env.CRATIS_HOOKS_ALLOW_SECRET_READS = saved;
        rmSync(project, { recursive: true, force: true });
    }
});
