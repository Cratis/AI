// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Behavior fixtures for the secrets guard and the Pi bridge that drives it (Cratis/AI#863).
 *
 * A guard that blocks every command fails these tests as surely as one that blocks none, so each table pairs a
 * command that prints credentials with its nearest projected or harmless neighbor. A word that only appears inside
 * a string argument (echo, rg, grep, git commit -m) or a here-document body is never a finding.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const guard = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts', 'cratis-guard-secrets.sh');

const BLOCK = 'block';
const ALLOW = 'allow';

function runGuard(command: string, env: NodeJS.ProcessEnv = {}): { verdict: string; code: number | null; stderr: string } {
    const result = spawnSync('bash', [guard], {
        input: JSON.stringify({ cwd: repositoryRoot, tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', ...env },
    });
    return { verdict: result.status === 2 ? BLOCK : ALLOW, code: result.status, stderr: result.stderr };
}

function assertVerdicts(cases: Array<[expected: string, command: string]>, env: NodeJS.ProcessEnv = {}): void {
    for (const [expected, command] of cases) {
        const { verdict, code, stderr } = runGuard(command, env);
        assert.ok(code === 0 || code === 2, `${command}\nexited ${code}, which is neither allow nor block\n${stderr}`);
        assert.equal(verdict, expected, `${command}\n${stderr}`);
        if (expected === BLOCK) {
            assert.match(stderr, /BLOCKED by cratis-guard-secrets/);
            assert.match(stderr, /Use instead: /);
        }
    }
}

test('the issue acceptance list: full specs, secrets, env and inspect are blocked; projections are allowed', () => {
    assertVerdicts([
        [BLOCK, 'kubectl get pods -o json'],
        [BLOCK, 'kubectl describe pod x'],
        [BLOCK, 'kubectl get secret'],
        [BLOCK, 'printenv'],
        [BLOCK, 'docker inspect x'],
        [ALLOW, "kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'"],
        [ALLOW, 'kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image'],
        [ALLOW, 'kubectl get pods -o name'],
    ]);
});

test('kubectl: every spec-bearing resource is blocked with json or yaml, however the flag is spelled', () => {
    assertVerdicts([
        [BLOCK, 'kubectl get pods -o yaml'],
        [BLOCK, 'kubectl get pod x -ojson'],
        [BLOCK, 'kubectl get pod x -o=json'],
        [BLOCK, 'kubectl get pods --output json'],
        [BLOCK, 'kubectl -n prod get deploy -o yaml'],
        [BLOCK, 'kubectl get -o yaml statefulset db'],
        [BLOCK, 'kubectl get deployments.apps/web -o json'],
        [BLOCK, 'kubectl get cm,svc -o yaml'],
        [BLOCK, 'kubectl get cronjobs -n x -o json'],
        [BLOCK, 'kubectl get all -o yaml'],
        [BLOCK, 'kubectl describe deployment web'],
        [BLOCK, 'kubectl describe configmap app'],
        [BLOCK, 'kubectl describe secret db'],
        [BLOCK, 'kubectl get secrets -o yaml'],
        [BLOCK, "kubectl get secret db -o jsonpath='{.data}'"],
        [BLOCK, 'kubectl get secrets -n prod'],
        [BLOCK, 'kubectl get svc/web secret/db -o json'],
        [BLOCK, 'kubectl get svc/web pod/x -o yaml'],
        [ALLOW, 'kubectl get svc/web cm/x -o name'],
        [ALLOW, 'kubectl get pod web -o name'],
        [ALLOW, 'kubectl get secret -o name'],
        [ALLOW, 'kubectl get secrets -o name'],
        [ALLOW, 'kubectl get pods'],
        [ALLOW, 'kubectl get pods -o wide'],
        [ALLOW, 'kubectl get pods -n prod -l app=web'],
        [ALLOW, 'kubectl get events --sort-by=.lastTimestamp'],
        [ALLOW, 'kubectl logs web-0 --tail 50'],
        [ALLOW, 'kubectl describe node n1'],
        [ALLOW, 'kubectl describe service web'],
        [ALLOW, 'kubectl get svc -o yaml'],
        [ALLOW, 'kubectl rollout status deploy/web'],
        [BLOCK, 'kubectl config view --raw'],
        [ALLOW, 'kubectl config view'],
        [ALLOW, 'kubectl config current-context'],
    ]);
});

test('the process environment is blocked however it is reached', () => {
    assertVerdicts([
        [BLOCK, 'env'],
        [BLOCK, 'env | grep -c PASSWORD'],
        [BLOCK, 'env | sort'],
        [BLOCK, '(env)'],
        [BLOCK, 'bash -c env'],
        [BLOCK, "sh -c 'printenv | head'"],
        [BLOCK, 'echo $(printenv)'],
        [BLOCK, 'echo `env`'],
        [BLOCK, 'bash <<EOF\nenv\nEOF'],
        [BLOCK, 'kubectl exec -it web-0 -n prod -- env'],
        [BLOCK, 'kubectl exec web-0 -- printenv'],
        [BLOCK, "kubectl exec web-0 -- sh -c 'env'"],
        [BLOCK, 'docker exec web env'],
        [BLOCK, 'docker exec -e A=1 -it web printenv'],
        [BLOCK, 'docker compose exec web env'],
        [BLOCK, 'sudo -u app env'],
        [BLOCK, 'export'],
        [BLOCK, 'export -p'],
        [BLOCK, 'declare -x'],
        [BLOCK, 'printenv GITHUB_TOKEN'],
        [BLOCK, 'cat /proc/1/environ'],
        [ALLOW, 'env FOO=1 make build'],
        [ALLOW, 'env -u HTTP_PROXY curl example.org'],
        [ALLOW, 'printenv HOME'],
        [ALLOW, 'export FOO=bar'],
        [ALLOW, 'declare -p FOO'],
        [ALLOW, 'command -v env'],
        [ALLOW, 'docker exec web ls /app'],
        [ALLOW, 'kubectl exec web-0 -- ls /app'],
    ]);
});

test('docker, the CLIs of secret managers and cloud providers', () => {
    assertVerdicts([
        [BLOCK, 'docker inspect x'],
        [BLOCK, 'docker container inspect x'],
        [BLOCK, "docker inspect --format '{{json .Config.Env}}' x"],
        [BLOCK, "docker inspect -f '{{.Config.Env}}' x"],
        [BLOCK, 'docker compose config'],
        [BLOCK, 'docker compose config --format json'],
        [BLOCK, 'docker compose -f x.yml config --format yaml'],
        [ALLOW, 'docker compose config --services'],
        [ALLOW, 'docker compose config --volumes'],
        [ALLOW, 'docker compose config --profiles'],
        [ALLOW, 'docker compose config --images'],
        [ALLOW, 'docker compose config --networks'],
        [ALLOW, 'docker compose config -q'],
        [ALLOW, "docker inspect --format '{{.State.Status}}' x"],
        [ALLOW, 'docker ps'],
        [ALLOW, 'docker images'],
        [ALLOW, 'docker logs web'],
        [BLOCK, 'gh secret list'],
        [BLOCK, 'gh secret list -R Cratis/AI'],
        [BLOCK, 'gh api repos/Cratis/AI/actions/secrets'],
        [BLOCK, 'gh auth token'],
        [BLOCK, 'gh auth status --show-token'],
        [ALLOW, 'gh secret set DEPLOY_KEY < key.txt'],
        [ALLOW, 'gh secret delete OLD'],
        [ALLOW, 'gh api -X PUT repos/Cratis/AI/actions/secrets/X -f encrypted_value=abc'],
        [ALLOW, 'gh auth status'],
        [ALLOW, 'gh pr list'],
        [BLOCK, 'vault read secret/app'],
        [BLOCK, 'vault kv get -field=password secret/app'],
        [ALLOW, 'vault kv list secret/'],
        [BLOCK, 'aws secretsmanager get-secret-value --secret-id prod/db'],
        [BLOCK, 'aws ssm get-parameter --name /prod/db --with-decryption'],
        [ALLOW, 'aws ssm get-parameter --name /prod/ver'],
        [ALLOW, 'aws secretsmanager list-secrets'],
        [BLOCK, 'az keyvault secret show --name db --vault-name kv'],
        [BLOCK, 'az account get-access-token'],
        [ALLOW, 'az keyvault secret list --vault-name kv'],
        [BLOCK, 'gcloud secrets versions access latest --secret=db'],
        [BLOCK, 'gcloud auth print-access-token'],
        [ALLOW, 'gcloud secrets list'],
        [BLOCK, 'pulumi config --show-secrets'],
        [BLOCK, 'pulumi stack output --show-secrets'],
        [ALLOW, 'pulumi stack output'],
        [ALLOW, 'pulumi up --yes'],
    ]);
});

test('reading credential files is blocked; templates and source files are not', () => {
    assertVerdicts([
        [BLOCK, 'cat ~/.kube/config'],
        [BLOCK, 'less /home/a/.kube/prod.yaml'],
        [BLOCK, 'cat .env'],
        [BLOCK, 'head -n 3 .env.production'],
        [BLOCK, 'tail apps/web/.env.local'],
        [BLOCK, 'bat server.pem'],
        [BLOCK, 'cat ~/.ssh/id_rsa'],
        [BLOCK, 'cat ~/.ssh/id_ed25519'],
        [BLOCK, 'cat github_token'],
        [BLOCK, 'cat ~/.netrc'],
        [BLOCK, 'cat .npmrc'],
        [BLOCK, 'cat ~/.aws/credentials'],
        [BLOCK, 'cat /var/run/secrets/kubernetes.io/serviceaccount/token'],
        [BLOCK, 'echo $(cat .env)'],
        [ALLOW, 'cat .env.example'],
        [ALLOW, 'cat ~/.ssh/id_ed25519.pub'],
        [ALLOW, 'cat Source/Auth/Token.cs'],
        [ALLOW, 'cat tokenizer.ts'],
        [ALLOW, 'ls -la .env'],
        [ALLOW, 'cat README.md'],
        [BLOCK, 'grep . .env'],
        [BLOCK, 'rg . .env'],
        [BLOCK, 'rg -e x .env'],
        [BLOCK, 'grep -e x -n .env'],
        [BLOCK, "sed -n '1,20p' ~/.kube/config"],
        [BLOCK, "awk '{print}' .env"],
        [BLOCK, "awk -F: '{print $1}' .npmrc"],
        [BLOCK, 'jq . ~/.docker/config.json'],
        [BLOCK, 'sort .env'],
        [BLOCK, 'base64 -d .env'],
        [BLOCK, 'cut -d= -f2 .env'],
        [ALLOW, 'grep -c . .env.example'],
        [ALLOW, 'rg PASSWORD src/'],
        [ALLOW, 'grep -n token README.md'],
        [ALLOW, 'rg -n id_rsa docs'],
        [ALLOW, 'jq .token data.json'],
        [ALLOW, "sed -n '/token/p' notes.txt"],
        [ALLOW, 'grep -rn foo .'],
        [ALLOW, 'cat design/tokens.json'],
        [ALLOW, 'cat Source/Styles/tokens.css'],
        [BLOCK, 'cat secrets/tokens.json'],
        [BLOCK, 'cat token.json'],
        [BLOCK, 'cat oauth-tokens.json'],
        [BLOCK, 'cat ~/.config/gcloud/token.json'],
        [ALLOW, 'cat Source/Themes/tokens.json'],
        [ALLOW, 'cat Source/Settings/appsettings.json'],
    ]);
});

test('a word that only appears inside a string argument, a comment or a here-document is not a finding', () => {
    assertVerdicts([
        [ALLOW, "echo 'never run kubectl get pods -o json or printenv'"],
        [ALLOW, 'echo "docker inspect and kubectl describe pod are blocked"'],
        [ALLOW, "rg -n 'printenv|kubectl describe' .cratis"],
        [ALLOW, 'grep -rn "env" Source'],
        [ALLOW, "git commit -m 'Block kubectl get secret and printenv in the secrets guard'"],
        [ALLOW, 'git commit -F - <<EOF\nBlock kubectl get pods -o json and env\nEOF'],
        [ALLOW, 'gh pr create --body "kubectl describe pod x"'],
        [ALLOW, 'echo hi # kubectl get secret'],
        [ALLOW, 'cat <<EOF | tee notes.md\nprintenv\nEOF'],
        [ALLOW, 'git status'],
        [ALLOW, 'yarn workspace @cratis/ai-verification run check'],
        [ALLOW, 'ls environment/'],
        [BLOCK, 'echo ok; kubectl get pods -o json'],
        [BLOCK, 'echo ok && printenv'],
        [BLOCK, 'cd /tmp && env | sort'],
        [BLOCK, 'FOO=1 kubectl get secret'],
        [BLOCK, 'timeout 20 kubectl describe pod x'],
        [BLOCK, 'xargs -I{} kubectl describe pod {}'],
        [BLOCK, "eval 'kubectl get pods -o yaml'"],
    ]);
});

test('the block message names the alternative and the incident procedure', () => {
    const { stderr } = runGuard('kubectl get pods -o json');
    assert.match(stderr, /BLOCKED by cratis-guard-secrets: kubectl get pods -o json prints the full container spec/);
    assert.match(stderr, /Use instead: .*jsonpath.*custom-columns.*-o name/);
    assert.match(stderr, /SECURITY INCIDENT/);
    assert.match(stderr, /CRATIS_HOOKS_ALLOW_SECRET_READS=1/);
    assert.match(runGuard('env | grep -c X').stderr, /env \| \.\.\. is blocked too/);
});

test('the escape hatch comes from the harness environment, never from the command', () => {
    assert.equal(runGuard('printenv', { CRATIS_HOOKS_ALLOW_SECRET_READS: '1' }).verdict, ALLOW);
    assert.equal(runGuard('kubectl get secret', { CRATIS_HOOKS_ALLOW_SECRET_READS: '1' }).verdict, ALLOW);
    assert.equal(runGuard('CRATIS_HOOKS_ALLOW_SECRET_READS=1 printenv').verdict, BLOCK);
    assert.equal(runGuard('export CRATIS_HOOKS_ALLOW_SECRET_READS=1; kubectl get secret').verdict, BLOCK);
});

test('empty and malformed input exits 0 rather than blocking everything', () => {
    for (const input of ['', '{}', '{"tool_name":"Bash"}', '{"tool_input":{"command":""}}', 'not json']) {
        const result = spawnSync('bash', [guard], { input, encoding: 'utf8', env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' } });
        assert.equal(result.status, 0, `${input}\n${result.stderr}`);
    }
});

test('a command that mentions no trigger word never reaches the parser', () => {
    // A stub awk that fails loudly proves the pre-filter, not the parser, let the command through.
    const stubs = mkdtempSync(join(tmpdir(), 'cratis-secrets-stub-'));
    try {
        writeFileSync(join(stubs, 'awk'), '#!/bin/sh\necho stub-awk-ran >&2\nexit 99\n');
        chmodSync(join(stubs, 'awk'), 0o755);
        const env = { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', PATH: `${stubs}:${process.env.PATH}` };
        const run = (command: string) => spawnSync('bash', [guard], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', env });
        for (const command of ['git status', 'ls -la', 'dotnet build -c Release', 'yarn workspace @cratis/pi run check']) {
            const result = run(command);
            assert.equal(result.status, 0, `${command}\n${result.stderr}`);
            assert.doesNotMatch(result.stderr, /stub-awk-ran/, command);
        }
        const parsed = run('kubectl get pods');
        assert.match(parsed.stderr, /stub-awk-ran/, 'a command that mentions kubectl is handed to the parser');
        assert.notEqual(parsed.status, 0);
    } finally {
        rmSync(stubs, { recursive: true, force: true });
    }
});

test('the Pi bridge runs shell commands through the secrets guard', async () => {
    const saved = process.env.CRATIS_HOOKS_ALLOW_SECRET_READS;
    delete process.env.CRATIS_HOOKS_ALLOW_SECRET_READS;
    const project = mkdtempSync(join(tmpdir(), 'cratis-secrets-guard-pi-'));
    // The scratch project holds no .cratis/ai/hooks/scripts, so the bridge falls back to the bundled corpus scripts.
    const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
    registerCratisHooks({ on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(event, handler), registerTool: () => {} } as unknown as ExtensionAPI);
    const toolCall = handlers.get('tool_call');
    assert.ok(toolCall, 'the bridge registers a tool_call handler');
    const ctx = { cwd: project, signal: undefined };
    try {
        const dump = await toolCall({ toolName: 'bash', input: { command: 'kubectl get pods -o json' } }, ctx) as { block?: boolean; reason?: string } | undefined;
        assert.equal(dump?.block, true, 'a full pod spec through Pi must be refused');
        assert.match(dump?.reason ?? '', /BLOCKED by cratis-guard-secrets/);
        const projected = await toolCall({ toolName: 'bash', input: { command: 'kubectl get pods -o name' } }, ctx);
        assert.equal(projected, undefined, 'a projected read through Pi must pass');
        const unrelated = await toolCall({ toolName: 'bash', input: { command: 'git status' } }, ctx);
        assert.equal(unrelated, undefined, 'a command that mentions no credential tool must pass');
        const read = await toolCall({ toolName: 'read', input: { path: 'kubectl get secret' } }, ctx);
        assert.equal(read, undefined, 'only the bash tool is a shell command');
    } finally {
        if (saved !== undefined) process.env.CRATIS_HOOKS_ALLOW_SECRET_READS = saved;
        rmSync(project, { recursive: true, force: true });
    }
});
