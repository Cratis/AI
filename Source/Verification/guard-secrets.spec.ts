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
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { bashPayload, carrierCredentialRows, compatibilityMigrations, corpusRewrites, credentialExpansionRows, directCompatibilityMigrations, extractionFailures, isolatedScripts, malformedInputs, minimalPath, restrictedRows, runSecretsRaw, runWithPath, safeCorpus, scriptsDirectory, secretsGuard, supportedGrammarRows } from './guard-security.fixture.ts';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import { pathToFileURL } from 'node:url';

type Verdict = { findings: Array<[string, string]>; refusal: { category: string; detail: string } | null };
const { classifyCommand, renderVerdict } = await import(pathToFileURL(join(scriptsDirectory, 'cratis-guard-secrets.mjs')).href) as {
    classifyCommand(command: string): Verdict;
    renderVerdict(verdict: Verdict): string;
};

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const guard = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts', 'cratis-guard-secrets.sh');

const BLOCK = 'block';
const ALLOW = 'allow';
const migrationHits = new Map<string, number>();

function runGuard(command: string, env: NodeJS.ProcessEnv = {}): { verdict: string; code: number | null; stderr: string } {
    const result = spawnSync('bash', [guard], {
        input: JSON.stringify({ cwd: repositoryRoot, tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', ...env },
    });
    return { verdict: result.status === 2 ? BLOCK : ALLOW, code: result.status, stderr: result.stderr };
}

function assertVerdicts(cases: Array<[expected: string, command: string]>, env: NodeJS.ProcessEnv = {}): void {
    for (const [oldExpectation, command] of cases) {
        const migration = oldExpectation === ALLOW ? compatibilityMigrations.find(row => row.oldCommand === command) : undefined;
        const expected = migration ? BLOCK : oldExpectation;
        if (migration) migrationHits.set(command, (migrationHits.get(command) ?? 0) + 1);
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
        [ALLOW, "kubectl get pods -o 'custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image'"],
        [BLOCK, 'kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image'],
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
        [BLOCK, 'cratis config get smtp:password --show-secret'],
        [BLOCK, 'cratis config get smtp:password -e production --show-secret'],
        [BLOCK, 'rtk cratis config get auth:clientSecret --show-secret'],
        [ALLOW, 'cratis config get smtp:password'],
        [ALLOW, 'cratis config set smtp:password --secret'],
        [ALLOW, 'cratis config --missing ./model'],
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

test('the cheap bypasses are closed: wrapper paths, attached short options, whole-object projections and redirect dumps (Cratis/AI#871)', () => {
    assertVerdicts([
        [BLOCK, '/usr/bin/env'],
        [BLOCK, '/usr/bin/printenv TOKEN'],
        [BLOCK, 'command env'],
        [BLOCK, 'command -p env'],
        [ALLOW, '/usr/bin/printenv HOME'],
        [ALLOW, 'command -v env'],
        [ALLOW, '/usr/bin/env FOO=1 true'],
        [BLOCK, 'grep -ePATTERN .env'],
        [BLOCK, 'grep -nePATTERN .env'],
        [BLOCK, 'rg -ePATTERN .env'],
        [BLOCK, 'grep -m5 PATTERN .env'],
        [BLOCK, "sed -ne 's/a/b/p' .env"],
        [ALLOW, 'grep -ePATTERN README.md'],
        [ALLOW, 'grep -m5 PATTERN README.md'],
        [ALLOW, 'sed -i.bak s/a/b/ README.md'],
        [ALLOW, 'grep -ePATTERN .env.example'],
        [BLOCK, "kubectl get pod web -o jsonpath='{.}'"],
        [BLOCK, "kubectl get pods -ojsonpath={.items[*]}"],
        [BLOCK, "kubectl get pod web -o go-template='{{.}}'"],
        [BLOCK, "kubectl get cm app --output=go-template='{{ . }}'"],
        [BLOCK, "kubectl get pod web -o go-template --template '{{.}}'"],
        [ALLOW, "kubectl get pod web -o jsonpath='{.metadata.name}'"],
        [ALLOW, "kubectl get pods -o go-template='{{range .items}}{{.metadata.name}}{{end}}'"],
        [ALLOW, "kubectl get svc web -o jsonpath='{.}'"],
        [BLOCK, 'env > /tmp/dump.txt && cat /tmp/dump.txt'],
        [BLOCK, 'printenv >dump.txt; cat ./dump.txt'],
        [BLOCK, 'env >> dump.txt; grep . dump.txt'],
        [BLOCK, 'env > dump.txt; echo done'],
        [BLOCK, 'export > dump.txt'],
        [BLOCK, 'declare -x > dump.txt'],
        [ALLOW, 'printenv HOME > home.txt'],
        [BLOCK, 'printenv TOKEN > dump.txt'],
        [BLOCK, 'printenv TOKEN > /dev/stderr'],
        [BLOCK, 'export -p > /dev/stdout'],
        [BLOCK, 'printenv TOKEN > /dev/fd/1'],
        [BLOCK, 'printenv TOKEN > /./dev/stdout'],
        [BLOCK, 'printenv TOKEN > dump.txt >"/dev/stdout"'],
        [BLOCK, 'env > //dev/stderr'],
        [BLOCK, 'O=/dev/stderr; env > $O'],
        [BLOCK, 'O=/dev/stderr; env > "$O"'],
        [BLOCK, 'env > ${TTY}'],
        [BLOCK, 'cd /dev; env > stderr'],
        [BLOCK, 'env > /proc/self/task/1/fd/1'],
        [BLOCK, 'kubectl get > /dev/stdout secrets'],
        [BLOCK, 'kubectl get 2>/dev/null secrets'],
        [BLOCK, 'docker > /dev/stdout inspect x'],
        [BLOCK, 'grep x < .env'],
        [BLOCK, 'grep ">x" .env'],
        [ALLOW, 'kubectl get > pods.txt pods'],
        [BLOCK, 'kubectl get > "/dev/stdout" secrets'],
        [BLOCK, 'kubectl get 2>&1 secrets'],
        [BLOCK, 'kubectl get &>/dev/null secrets'],
        [BLOCK, 'kubectl get >| out secrets'],
        [BLOCK, 'grep 1">"x .env'],
        [ALLOW, 'kubectl get 1">"x pods'],
        [ALLOW, 'kubectl get pods 2>&1 | tee pods.txt'],
        [BLOCK, 'grep -nT PASSWORD .env'],
        [BLOCK, 'grep -iT x .env'],
        [BLOCK, 'grep -nT x ~/.netrc'],
        [BLOCK, 'grep -nT x id_rsa'],
        [BLOCK, 'grep -T PASSWORD .env'],
        [BLOCK, 'grep -nt x .env'],
        [BLOCK, 'grep -ng x .env'],
        [BLOCK, 'rg -tjs x .env'],
        [ALLOW, 'grep -nT PASSWORD README.md'],
        [ALLOW, 'rg -t js x README.md'],
        [ALLOW, 'echo hi > out.txt; cat out.txt'],
        [ALLOW, 'kubectl get pods -o name > pods.txt; cat pods.txt'],
        [BLOCK, 'grep ">" .env'],
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

test('input the guard cannot read is refused, never allowed, and the diagnostic never echoes it', () => {
    for (const [name, input] of malformedInputs) {
        const result = runSecretsRaw(input);
        assert.equal(result.status, 2, `${name}: expected exit 2, got ${result.status}\n${result.stderr}`);
        assert.equal(result.stdout, '', `${name}: a refusal prints nothing on stdout`);
        assert.match(result.stderr, /BLOCKED by cratis-guard-secrets: the tool input could not be validated/, name);
        assert.match(result.stderr, /Use instead: /, name);
        assert.doesNotMatch(result.stderr, /git sta|; env/, `${name}: the diagnostic must not repeat the input`);
    }
});

test('well-formed input that is not a shell command is allowed with no output', () => {
    for (const input of [
        JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'README.md' } }),
        JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'a.txt', content: 'kubectl get secret' } }),
        JSON.stringify({ tool_name: 'Edit' }),
    ]) {
        const result = runSecretsRaw(input);
        assert.equal(result.status, 0, `${input}\n${result.stderr}`);
        assert.equal(result.stdout + result.stderr, '', input);
    }
});

test('ordinary development commands are allowed with no output, however the host spells the call', () => {
    for (const command of safeCorpus) {
        for (const payload of [bashPayload(command), JSON.stringify({ cwd: repositoryRoot, tool_input: { command } })]) {
            const result = runSecretsRaw(payload);
            assert.equal(result.status, 0, `${command}\n${result.stderr}`);
            assert.equal(result.stdout + result.stderr, '', command);
        }
    }
});

test('a Pi call that omits tool_name is still a shell command when it carries one', () => {
    const pi = (command: string) => runSecretsRaw(JSON.stringify({ cwd: repositoryRoot, tool_input: { command } }));
    assert.equal(pi('kubectl get pods -o json').status, 2);
    assert.equal(pi('kubectl get pods -o name').status, 0);
});

test('a command line with newlines and trailing newlines survives the hand-off to the classifier', () => {
    assert.equal(runSecretsRaw(bashPayload('echo one\n\n')).status, 0);
    assert.equal(runSecretsRaw(bashPayload('echo one\nprintenv\n\n')).status, 2);
    assert.equal(runSecretsRaw(bashPayload('printenv\n')).status, 2);
});

test('a missing jq, node or helper file is refused with a fixed message; the same call passes when they are present', () => {
    const neighbor = bashPayload('git status');
    for (const tool of ['jq', 'node']) {
        const missing = minimalPath({ omit: [tool] });
        const present = minimalPath();
        try {
            const refused = runWithPath(secretsGuard, neighbor, missing.path);
            assert.equal(refused.status, 2, `${tool} missing\n${refused.stderr}`);
            assert.match(refused.stderr, new RegExp(`BLOCKED by cratis-guard-secrets: the tool input could not be validated \\(${tool} is not installed\\)`));
            assert.equal(runWithPath(secretsGuard, neighbor, present.path).status, 0, `${tool} present`);
        } finally {
            missing.cleanup();
            present.cleanup();
        }
    }
    for (const lost of ['cratis-guard-secrets.mjs', 'cratis-shell-parser.mjs', 'hook-lib.sh']) {
        const scripts = isolatedScripts(['cratis-guard-secrets.sh', 'cratis-guard-secrets.mjs', 'cratis-shell-parser.mjs', 'hook-lib.sh']);
        try {
            const script = join(scripts.directory, 'cratis-guard-secrets.sh');
            assert.equal(runSecretsRaw(neighbor, {}, script).status, 0, 'the isolated copy works with every helper present');
            rmSync(join(scripts.directory, lost));
            const refused = runSecretsRaw(neighbor, {}, script);
            assert.equal(refused.status, 2, lost);
            assert.match(refused.stderr, /BLOCKED by cratis-guard-secrets: .*a guard helper file is missing/s, lost);
        } finally {
            scripts.cleanup();
        }
    }
});

test('an extraction or classifier failure is a refusal, never permission', () => {
    for (const [name, body] of Object.entries(extractionFailures)) {
        const sandbox = minimalPath({ stubs: { jq: body } });
        try {
            const result = runWithPath(secretsGuard, bashPayload('git status'), sandbox.path);
            assert.equal(result.status, 2, `${name}\n${result.stderr}`);
            assert.match(result.stderr, /BLOCKED by cratis-guard-secrets: the tool input could not be validated/, name);
        } finally {
            sandbox.cleanup();
        }
    }
    for (const [name, body, expected] of [['node exits 1', 'exit 1', 2], ['node exits 3', 'exit 3', 2], ['node is killed', 'kill -9 $$', 2], ['node exits 2', 'exit 2', 2], ['node exits 0 without a verdict', 'exit 0', 2], ['node prints a clean marker but exits 1', "echo 'cratis-guard-secrets: clean'; exit 1", 2]] as const) {
        const sandbox = minimalPath({ stubs: { node: body } });
        try {
            const result = runWithPath(secretsGuard, bashPayload('git status'), sandbox.path);
            assert.equal(result.status, expected, `${name}\n${result.stderr}`);
            assert.equal(result.stdout, '', name);
        } finally {
            sandbox.cleanup();
        }
    }
});

test('the classifier itself refuses empty and undecodable input', () => {
    const classifier = join(scriptsDirectory, 'cratis-guard-secrets.mjs');
    for (const input of [Buffer.from(''), Buffer.from([0xff, 0xfe, 0x41])]) {
        const result = spawnSync('node', [classifier], { input, encoding: 'utf8' });
        assert.equal(result.status, 2);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /BLOCKED by cratis-guard-secrets/);
    }
    assert.equal(spawnSync('node', [classifier], { input: 'git status', encoding: 'utf8' }).status, 0);
});

test('unsupported or ambiguous shell is refused, and each refusal sits beside a command that is allowed', () => {
    assertVerdicts([
        [BLOCK, 'echo $((1+2))'],
        [ALLOW, 'echo 1+2'],
        [BLOCK, "echo $'a'"],
        [ALLOW, "echo 'a'"],
        [BLOCK, 'cat <(ls)'],
        [ALLOW, 'cat file.txt'],
        [BLOCK, 'f() { ls; }'],
        [ALLOW, 'ls'],
        [BLOCK, 'case x in x) ls;; esac'],
        [BLOCK, 'ls "unclosed'],
        [ALLOW, 'ls "closed"'],
        [BLOCK, 'echo $(ls'],
        [BLOCK, 'echo ${X@P}'],
        [ALLOW, 'echo ${X}'],
        [BLOCK, 'a=(1 2)'],
        [ALLOW, 'a=1'],
        [BLOCK, 'bash'],
        [BLOCK, 'echo env | sh'],
        [BLOCK, 'sh < script.sh'],
        [ALLOW, 'bash scripts/build.sh'],
        [ALLOW, 'sh -c "ls"'],
        [ALLOW, 'bash --version'],
        [BLOCK, 'eval "$(ssh-agent -s)"'],
        [BLOCK, 'source env.sh'],
        [BLOCK, '. ./env.sh'],
        [ALLOW, 'echo source env.sh'],
        [BLOCK, 'stdbuf -oL ls'],
        [BLOCK, 'flock /tmp/x ls'],
        [BLOCK, 'parallel echo ::: a b'],
        [ALLOW, 'ls'],
        [BLOCK, 'x'.repeat(1_048_577)],
        [BLOCK, Array.from({ length: 70 }, () => '$(ls)').join(' ')],
    ]);
});

test('a command that is computed at run time cannot be vouched for', () => {
    assertVerdicts([
        [BLOCK, '$CMD get pods'],
        [BLOCK, '"$(which kubectl)" get secret'],
        [BLOCK, '$(echo env)'],
        [BLOCK, 'bash -c "$CMD"'],
        [BLOCK, 'kubectl get $RESOURCE -o name'],
        [BLOCK, 'kubectl get pods -o "jsonpath=$FIELD"'],
        [BLOCK, 'kubectl $VERB pods'],
        [BLOCK, 'docker inspect --format "$FORMAT" web'],
        [BLOCK, 'printenv $NAME'],
        [BLOCK, 'cat "$FILE"'],
        [BLOCK, 'cat $HOME/$NAME'],
        [ALLOW, 'echo $CMD'],
        [ALLOW, 'cd "$DIR" && ls'],
        [BLOCK, 'kubectl get pods -n "$NAMESPACE" -o name'],
        [BLOCK, 'kubectl logs "$POD" --tail 20'],
        [BLOCK, 'cat "$ROOT/README.md"'],
        [BLOCK, 'cat $(git rev-parse --show-toplevel)/README.md'],
        [BLOCK, 'head -n "$COUNT" README.md'],
        [ALLOW, 'printenv HOME'],
        [BLOCK, 'ls $(pwd)'],
    ]);
});

test('credential commands are found however the text is split, nested or wrapped', () => {
    assertVerdicts([
        [BLOCK, 'k"u"bectl get secrets'],
        [BLOCK, 'kubectl get sec\\rets'],
        [BLOCK, 'e""nv'],
        [BLOCK, "'printenv'"],
        [BLOCK, '{ printenv; }'],
        [BLOCK, '(printenv)'],
        [BLOCK, 'x=$(printenv)'],
        [BLOCK, 'echo "$(printenv)"'],
        [BLOCK, 'echo "a `env` b"'],
        [BLOCK, 'cat <<EOF\n$(printenv)\nEOF'],
        [BLOCK, 'bash -lc "printenv"'],
        [BLOCK, "bash -c 'bash -c env'"],
        [BLOCK, "bash -c 'x=$(env)'"],
        [BLOCK, 'bash -x -c env'],
        [BLOCK, 'bash -o pipefail -c env'],
        [BLOCK, 'bash <<< "printenv"'],
        [BLOCK, 'sudo -u root bash -c env'],
        [BLOCK, "env -S 'printenv'"],
        [BLOCK, 'env FOO=1 -S printenv'],
        [BLOCK, "trap 'printenv' EXIT"],
        [BLOCK, 'find . -maxdepth 1 -exec printenv \\;'],
        [BLOCK, 'find . -execdir cat .env {} +'],
        [BLOCK, 'xargs -n1 printenv'],
        [BLOCK, 'timeout 5 nice -n 5 kubectl describe pod x'],
        [BLOCK, 'cat .e""nv'],
        [BLOCK, 'cat .{env,x}'],
        [BLOCK, 'kubectl exec web -- bash -c "env"'],
        [BLOCK, 'docker compose exec web sh -c "printenv"'],
        [ALLOW, "trap 'echo done' EXIT"],
        [ALLOW, 'find . -maxdepth 1 -name "*.md"'],
        [ALLOW, 'find . -exec cat README.md \\;'],
        [ALLOW, "cat <<'EOF'\n$(printenv)\nEOF"],
        [ALLOW, 'echo "$(date)"'],
        [ALLOW, 'bash -c "echo hi"'],
        [ALLOW, 'bash <<< "echo hi"'],
        [ALLOW, 'sudo -u root ls'],
        [ALLOW, 'xargs -n1 echo'],
    ]);
});

test('an assignment or export in the command is never the escape hatch', () => {
    for (const command of [
        'CRATIS_HOOKS_ALLOW_SECRET_READS=1 printenv',
        'env CRATIS_HOOKS_ALLOW_SECRET_READS=1 printenv',
        'export CRATIS_HOOKS_ALLOW_SECRET_READS=1; kubectl get secret',
        'CRATIS_HOOKS_ALLOW_SECRET_READS=1 bash -c "kubectl get pods -o json"',
    ]) {
        assert.equal(runGuard(command).verdict, BLOCK, command);
    }
    assert.equal(runGuard('CRATIS_HOOKS_ALLOW_SECRET_READS=1 true').verdict, BLOCK);
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
        const refused = await toolCall({ toolName: 'bash', input: { command: 'eval "$(ssh-agent -s)"' } }, ctx) as { block?: boolean; reason?: string } | undefined;
        assert.equal(refused?.block, true, 'a command the guard cannot analyze through Pi must be refused');
        const read = await toolCall({ toolName: 'read', input: { path: 'kubectl get secret' } }, ctx);
        assert.equal(read, undefined, 'only the bash tool is a shell command');
    } finally {
        if (saved !== undefined) process.env.CRATIS_HOOKS_ALLOW_SECRET_READS = saved;
        rmSync(project, { recursive: true, force: true });
    }
});

test('input redirections of compound commands and bare substitutions are read like a command with a redirect', () => {
    assertVerdicts([
        [BLOCK, 'cat < .env'],
        [BLOCK, '(cat) < .env'],
        [BLOCK, '{ cat; } < .env'],
        [BLOCK, 'echo "$(< .env)"'],
        [BLOCK, 'x=$(< .env)'],
        [BLOCK, 'while read line; do echo "$line"; done < .env'],
        [BLOCK, 'echo "$(< "$FILE")"'],
        [ALLOW, '(cat) < README.md'],
        [ALLOW, '{ cat; } < README.md'],
        [ALLOW, 'echo "$(< README.md)"'],
        [ALLOW, 'while read line; do echo "$line"; done < list.txt'],
        [ALLOW, '(cat) < .env.example'],
    ]);
});

test('wrapper options with separate, attached or long values are skipped to the real command, and unknown ones are refused', () => {
    assertVerdicts([
        [BLOCK, 'sudo --user root env'],
        [BLOCK, 'sudo --user=root env'],
        [BLOCK, 'sudo -u root -E env'],
        [BLOCK, 'sudo -- env'],
        [BLOCK, 'sudo --not-an-option env'],
        [BLOCK, 'timeout --signal TERM 10 env'],
        [BLOCK, 'timeout --signal=TERM 10 env'],
        [BLOCK, 'timeout -s TERM 10 env'],
        [BLOCK, 'timeout -sTERM 10 env'],
        [BLOCK, 'timeout --foreground --kill-after 5 10 env'],
        [BLOCK, 'xargs --max-args 1 printenv'],
        [BLOCK, 'nice -n 5 env'],
        [BLOCK, 'nice --adjustment 5 env'],
        [BLOCK, 'env -iu FOO env'],
        [BLOCK, 'env --unset FOO env'],
        [BLOCK, 'env -P /usr/bin env'],
        [BLOCK, 'time -p env'],
        [BLOCK, 'nohup env'],
        [BLOCK, 'sudo --$OPTION env'],
        [ALLOW, 'sudo --user root ls'],
        [ALLOW, 'sudo --user=root ls'],
        [ALLOW, 'timeout --signal TERM 10 ls'],
        [ALLOW, 'timeout -s TERM 10 ls'],
        [ALLOW, 'xargs --max-args 1 echo'],
        [ALLOW, 'nice -n 5 ls'],
        [ALLOW, 'env --unset FOO ls'],
        [ALLOW, 'time -p ls'],
    ]);
});

test('an unresolved argument of a credential-bearing invocation is refused, and only a literal id or a computed flag value stays allowed', () => {
    assertVerdicts([
        [BLOCK, 'ARGS=--show-secrets; pulumi stack output $ARGS'],
        [BLOCK, 'pulumi stack output "$STACK"'],
        [BLOCK, 'RESOURCE=secrets; gh api repos/x/y/$RESOURCE'],
        [BLOCK, 'gh api repos/x/y/$A/$B'],
        [BLOCK, 'gh api $ENDPOINT'],
        [BLOCK, 'gh auth status $FLAGS'],
        [BLOCK, 'gh secret list $REPO'],
        [BLOCK, 'aws ssm get-parameter --name x $OPTION'],
        [BLOCK, 'vault read $SECRET_PATH'],
        [BLOCK, 'gcloud secrets list $FILTER'],
        [BLOCK, 'az keyvault secret list $VAULT'],
        [BLOCK, 'cratis config get $KEY'],
        [ALLOW, 'pulumi stack output'],
        [BLOCK, 'gh api repos/x/y/pulls/$NUMBER'],
        [BLOCK, 'gh api repos/$OWNER/y/pulls'],
        [ALLOW, 'gh api repos/x/y/pulls/123'],
        [BLOCK, 'gh pr list --repo "$REPO"'],
        [BLOCK, 'aws s3 ls "$BUCKET"'],
        [BLOCK, 'gcloud compute instances list --project "$PROJECT"'],
        [BLOCK, 'cratis chronicle observers list -e "$STORE"'],
    ]);
});

test('redirection operands are never argv: a redirected bare env is still a bare env', () => {
    assertVerdicts([
        [BLOCK, 'env < /dev/null'],
        [BLOCK, 'env 2>/dev/null'],
        [BLOCK, 'env > out.txt'],
        [BLOCK, 'printenv < /dev/null'],
        [BLOCK, 'sudo env < /dev/null'],
        [BLOCK, 'cat < $FILE'],
        [ALLOW, 'env FOO=1 ls < /dev/null'],
        [ALLOW, 'printenv HOME < /dev/null'],
        [ALLOW, 'echo hi < /dev/null'],
        [BLOCK, 'git apply < $PATCH'],
    ]);
});

test('every round-3 probe is refused: a computed word anywhere in a command the guard cannot vouch for', () => {
    assertVerdicts([
        [BLOCK, 'P="env -u HOME"; $P/echo'],
        [BLOCK, 'P=".env /dev"; cat $P/null'],
        [BLOCK, 'N="default secrets -o yaml"; kubectl get -n $N'],
        [BLOCK, 'P="posix -c env"; bash -o $P ignored'],
        [BLOCK, 'S=inspect; docker container $S foo'],
        [BLOCK, 'X=-p; export $X'],
        [BLOCK, 'X="-exec env ;"; find . $X'],
        [BLOCK, 'M=GET; gh api repos/x/y/secrets -X PUT -X $M'],
        [BLOCK, 'kubectl get pods > $OUT'],
        [BLOCK, 'cat <<< $X'],
        [ALLOW, 'echo hi > $OUT'],
        [BLOCK, 'git log $REF'],
        [BLOCK, 'ls -la $DIR'],
        [BLOCK, 'rm -f $FILE'],
        [BLOCK, 'cp $A $B'],
        [ALLOW, 'printf "%s" $X'],
        [ALLOW, '[ -n "$X" ] && echo set'],
        [BLOCK, 'kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image'],
    ]);
});

test('a program string, wrapper option value or wrapper operand that the shell computes is refused, never read as harmless', () => {
    assertVerdicts([
        [BLOCK, 'CMD="; env"; bash -c "echo $CMD"'],
        [BLOCK, 'sh -c "$(echo env)"'],
        [BLOCK, 'sh -c "echo $(date)"'],
        [BLOCK, 'bash -c $PROGRAM'],
        [BLOCK, 'bash $FLAGS "echo hi"'],
        [BLOCK, 'env -S "$PROGRAM"'],
        [BLOCK, 'eval $X'],
        [BLOCK, 'eval "$(ssh-agent -s)"'],
        [BLOCK, 'trap "$ACTION" EXIT'],
        [BLOCK, 'P="root env"; sudo --user $P'],
        [BLOCK, 'sudo -u $USER_NAME env'],
        [BLOCK, 'nice -n $LEVEL env'],
        [BLOCK, 'env -u $NAME env'],
        [BLOCK, 'exec -a $NAME env'],
        [BLOCK, 'timeout $SECONDS env'],
        [BLOCK, 'timeout --signal $SIGNAL 10 env'],
        [BLOCK, 'xargs -I $MARK env'],
        [BLOCK, 'nohup $PROGRAM'],
        [BLOCK, 'time $PROGRAM'],
        [BLOCK, 'command $PROGRAM'],
        [BLOCK, 'command -p $PROGRAM'],
        [BLOCK, 'sudo $PROGRAM'],
        [BLOCK, 'xargs $PROGRAM'],
        [BLOCK, '/usr/bin/e* '],
        [BLOCK, 'kubectl get pods $EXTRA'],
        [BLOCK, 'kubectl get sec* -o yaml'],
        [BLOCK, 'cat .e*'],
        [ALLOW, 'bash -c "echo hi"'],
        [ALLOW, "bash -c 'echo $CMD'"],
        [ALLOW, 'sudo --user root ls'],
        [ALLOW, 'nice -n 5 echo hi'],
        [ALLOW, 'env -u FOO ls'],
        [ALLOW, 'exec -a name ls'],
        [ALLOW, 'timeout 5 ls'],
        [ALLOW, 'xargs -I {} echo {}'],
        [ALLOW, 'nohup ls'],
        [ALLOW, 'time ls'],
        [ALLOW, 'command ls'],
        [BLOCK, 'cat *.md'],
        [ALLOW, 'echo $CMD'],
        [BLOCK, 'ls $DIR'],
        [ALLOW, 'cd $DIR'],
        [ALLOW, 'mkdir -p $D'],
        [BLOCK, 'dotnet build $PROJ'],
        [ALLOW, 'echo $X'],
        [BLOCK, 'git log $REF'],
        [BLOCK, 'dotnet test $PROJECT'],
        [BLOCK, 'npx $X'],
        [BLOCK, 'grep x $F'],
        [BLOCK, 'cat $F'],
        [BLOCK, 'node -e "$X"'],
        [BLOCK, 'git $X'],
        [BLOCK, 'git show $REV:.env'],
        [BLOCK, 'git diff --no-index /dev/null $F'],
        [BLOCK, 'npm run $SCRIPT'],
        [BLOCK, 'ln -s $F link'],
        [BLOCK, 'mv $F safe.txt'],
        [BLOCK, 'wc -l $F'],
        [BLOCK, 'git log > $OUT'],
        [BLOCK, 'yarn $SCRIPT'],
        [BLOCK, 'node $SCRIPT --flag'],
        [BLOCK, 'FOO=$BAR env ls'],
        [BLOCK, 'kubectl logs $POD'],
    ]);
});

test('every gh api path segment must be literal, and a literal numeric id is the established safe position', () => {
    assertVerdicts([
        [BLOCK, 'R=secrets; gh api repos/x/y/$R/name'],
        [BLOCK, 'gh api repos/$OWNER/y/pulls'],
        [BLOCK, 'gh api repos/x/y/pulls/$NUMBER/comments'],
        [BLOCK, 'gh api repos/x/y/actions/runs/$ID/jobs'],
        [BLOCK, 'gh api repos/x/y/*/secrets'],
        [BLOCK, 'gh api "repos/x/y/$SEGMENT"'],
        [ALLOW, 'gh api repos/x/y/pulls/123/comments'],
        [ALLOW, 'gh api repos/x/y/actions/runs/456/jobs'],
        [ALLOW, 'gh api repos/x/y/pulls --jq ".[].title"'],
        [BLOCK, 'gh pr view $NUMBER'],
    ]);
});

test('round-4 structural refusals: unquoted globs, substitutions inside parameter expansions, evaluating builtins and credential-named expansions', () => {
    assertVerdicts([
        // A: an unquoted glob can become an option or a file name the guard never saw
        [BLOCK, 'kubectl get pods -o*'],
        [BLOCK, 'touch -- --output=json; kubectl get pods -o*'],
        [BLOCK, 'docker ps --format*'],
        [BLOCK, 'echo *'],
        [BLOCK, 'printf * x'],
        [BLOCK, 'test * = x'],
        [ALLOW, "kubectl get pods -o 'custom-columns=X:.a[0]'"],
        [ALLOW, 'kubectl get pods -o "custom-columns=X:.a[0]"'],
        [ALLOW, 'echo "*"'],
        // B: single quotes inside a double-quoted ${...} do not suppress a substitution
        [BLOCK, 'echo "${UNSET:-\'$(printenv TOKEN)\'}"'],
        [BLOCK, 'echo "${X:+\'$(id)\'}"'],
        [BLOCK, 'echo "${X/\'a\'/$(id)}"'],
        [BLOCK, 'echo "${X:-\'\`id\`\'}"'],
        [BLOCK, 'echo "${X:-\`id\`}"'],
        [BLOCK, 'echo ${X:-\'$(id)\'}'],
        [ALLOW, 'echo "${X:-plain}"'],
        [ALLOW, "echo '$(id)'"],
        // C: allowlisted builtins that evaluate their arguments
        [BLOCK, "printf -v 'a[$(printenv >&2)0]' '%s' x"],
        [BLOCK, 'printf -v name %s x'],
        [BLOCK, 'printf -v $D %s x'],
        [BLOCK, 'printf $OPT $NAME x'],
        [BLOCK, "D='a[$(printenv >&2)]'; printf -v $D %s x"],
        [BLOCK, 'command printf -v "a[$(id)]" x'],
        [BLOCK, 'builtin printf -v name x'],
        [BLOCK, 'test -v x'],
        [BLOCK, '[ -v $D ]'],
        [BLOCK, '[ -R x ]'],
        [BLOCK, '[ $A -eq 1 ]'],
        [BLOCK, '[ b -eq 1 ]'],
        [BLOCK, '[ 1 -eq $B ]'],
        [BLOCK, '[ $A $B ]'],
        [BLOCK, '[ "$A" "$B" ]'],
        [BLOCK, 'test -n $A $B'],
        [BLOCK, 'test "a[$(id)]" = x'],
        [BLOCK, "x='a[$(id)]' test -n y"],
        [BLOCK, 'printf "%s" "a[$X]"'],
        [ALLOW, 'printf "%s\\n" $X'],
        [ALLOW, 'printf -- "%s" $X'],
        [ALLOW, '[ 1 -eq 1 ]'],
        [ALLOW, '[ -n "$X" ] && echo set'],
        [ALLOW, '[ "$A" = "$B" ]'],
        [ALLOW, 'test -d "$DIR"'],
        // D: credential-shaped names are never expanded; indirect names are refused
        [BLOCK, 'echo "$TOKEN"'],
        [BLOCK, 'echo $GITHUB_TOKEN'],
        [BLOCK, 'printf %s "$AWS_SECRET_ACCESS_KEY"'],
        [BLOCK, 'echo ${DB_PASSWORD}'],
        [BLOCK, 'echo ${X:-$API_KEY}'],
        [BLOCK, 'echo ${TOKEN:0:4}'],
        [BLOCK, 'echo ${!X}'],
        [BLOCK, 'echo ${!PREFIX*}'],
        [BLOCK, 'cat <<EOF\n$TOKEN\nEOF'],
        [BLOCK, 'bash -c \'echo "$TOKEN"\''],
        [BLOCK, 'curl -H "Authorization: $AUTH_HEADER" example.org'],
        [ALLOW, 'echo $HOME'],
        [ALLOW, 'echo "$PATH"'],
        [ALLOW, 'echo "$PWD"'],
        [ALLOW, "echo '$TOKEN'"],
        [ALLOW, 'echo "\\$TOKEN"'],
    ]);
});

test('diagnostics use fixed operation labels and never repeat caller-controlled text', () => {
    const marker = 'zq9marker';
    for (const command of [
        `printenv ${marker}_TOKEN`,
        `gh secret ${marker} list`,
        `gh api repos/x/${marker}/secrets`,
        `aws ssm get-parameter-${marker} --with-decryption`,
        `gh api repos/x/${marker}/$X`,
        `sudo --${marker} env`,
        `cat ${marker}/.env`,
    ]) {
        const result = runSecretsRaw(bashPayload(command));
        assert.equal(result.status, 2, command);
        assert.ok(!result.stderr.includes(marker) && !result.stdout.includes(marker), `the diagnostic repeated caller text for: ${command}`);
    }
});

test('every old ALLOW migration is inventoried, refuses, and has an individually tested supported rewrite', () => {
    for (const row of compatibilityMigrations) assert.equal(migrationHits.get(row.oldCommand), row.oldRows, `${row.oldCommand}: inventory drift`);
    for (const row of directCompatibilityMigrations) {
        assert.equal(row.oldDecision, ALLOW);
        assert.equal(row.newDecision, BLOCK);
        assert.ok(row.reason.length > 0);
        assert.equal(runGuard(row.rewrite).code, 0);
    }
    for (const row of [...compatibilityMigrations, ...corpusRewrites]) {
        assert.ok(row.reason.length > 0);
        assert.ok(classifyCommand(row.oldCommand).refusal, row.oldCommand);
        assert.equal(runGuard(row.oldCommand).code, 2, row.oldCommand);
        assert.equal(renderVerdict(classifyCommand(row.rewrite)), '', row.rewrite);
        assert.equal(runGuard(row.rewrite).code, 0, row.rewrite);
    }
});

test('restricted grammar and effect profiles have individually failable refusal and supported-neighbor rows', () => {
    const ids = new Set<string>();
    for (const row of restrictedRows) {
        assert.ok(!ids.has(row.id), `duplicate regression ID: ${row.id}`);
        ids.add(row.id);
        const verdict = classifyCommand(row.command);
        assert.equal(verdict.refusal?.category, row.category, `${row.id}: ${row.command}`);
        const sentinel = `guard_input_sentinel_${ids.size}`;
        const result = runSecretsRaw(bashPayload(`echo '${sentinel}'; ${row.command}`));
        assert.equal(result.status, 2, row.id);
        assert.equal(result.stdout, '', row.id);
        assert.match(result.stderr, /BLOCKED by cratis-guard-secrets/);
        assert.match(result.stderr, /Use instead: /);
        assert.ok(!result.stderr.includes(sentinel), row.id);
        assert.ok(!result.stderr.includes('cratis-guard-secrets: clean'), row.id);
        const neighbor = classifyCommand(row.neighbor);
        assert.equal(renderVerdict(neighbor), '', `${row.id} neighbor: ${row.neighbor}`);
        const allowed = runSecretsRaw(bashPayload(row.neighbor));
        assert.equal(allowed.status, 0, `${row.id} neighbor: ${allowed.stderr}`);
        assert.equal(allowed.stdout + allowed.stderr, '');
    }
    for (const finding of ['R2-1', 'R2-2', 'R2-3', 'R2-4', 'R2-5', 'R2-6', 'G-1']) {
        assert.ok(restrictedRows.some(row => row.finding === finding), `${finding} has an executable assertion`);
    }
});

test('supported grammar stays usable at the real stdin boundary, with the literal-heredoc substitution exception refused by the owning invocation', () => {
    for (const command of supportedGrammarRows) {
        const result = runSecretsRaw(bashPayload(command));
        const isDynamicCommit = command.startsWith('git commit -m "$(');
        assert.equal(result.status, isDynamicCommit ? 2 : 0, `${command}\n${result.stderr}`);
        if (!isDynamicCommit) assert.equal(result.stdout + result.stderr, '');
        else assert.equal(classifyCommand(command).refusal?.category, 'dynamic-argument');
    }
});

test('credential expansions and carrier payloads are classified in their owning command', () => {
    for (const command of [...credentialExpansionRows, ...carrierCredentialRows]) {
        assert.ok(renderVerdict(classifyCommand(command)).length > 0, command);
        assert.equal(runSecretsRaw(bashPayload(command)).status, 2, command);
    }
    assert.equal(classifyCommand("echo \"$(node -e 'code')\"").refusal?.category, 'unmodeled-interpreter');
    assert.equal(classifyCommand("bash -c 'bash -c \"bash -c true\"'").refusal?.category, 'limit');
    assert.equal(renderVerdict(classifyCommand("bash -c 'bash -c true'")), '');
    for (const command of ['env CI=1 echo ok', 'builtin printf -- %s ok', 'xargs -I {} echo {}',
        'find . -exec echo {} \\;', 'kubectl exec pod -- echo ok', 'docker exec web echo ok',
        'command echo "$HOME"', 'find . -exec echo "$HOME" \\;', 'kubectl exec pod -- echo "$HOME"',
        'docker exec -e CI=1 web echo "$HOME"']) {
        assert.equal(renderVerdict(classifyCommand(command)), '', command);
    }
});

test('the guard blocks when run through a symlinked directory, and a classifier that never reports a verdict is not permission', () => {
    const real = isolatedScripts(['cratis-guard-secrets.sh', 'cratis-guard-secrets.mjs', 'cratis-shell-parser.mjs', 'hook-lib.sh']);
    const link = join(mkdtempSync(join(tmpdir(), 'cratis-guard-link-')), 'scripts');
    try {
        symlinkSync(real.directory, link);
        for (const directory of [real.directory, link]) {
            const script = join(directory, 'cratis-guard-secrets.sh');
            assert.equal(runSecretsRaw(bashPayload('kubectl get pods -o json'), {}, script).status, 2, directory);
            assert.equal(runSecretsRaw(bashPayload('git status'), {}, script).status, 0, directory);
        }
        const classifier = join(link, 'cratis-guard-secrets.mjs');
        const direct = spawnSync('node', [classifier], { input: 'kubectl get pods -o json', encoding: 'utf8' });
        assert.equal(direct.status, 2, 'the classifier runs its main when started through a symlinked path');
    } finally {
        rmSync(dirname(link), { recursive: true, force: true });
        real.cleanup();
    }
});
