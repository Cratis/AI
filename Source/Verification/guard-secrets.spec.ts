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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { pathWithout } from './fixtures/path-without-tool.ts';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const guard = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts', 'cratis-guard-secrets.sh');

const BLOCK = 'block';
const ALLOW = 'allow';

function runGuard(command: string, env: NodeJS.ProcessEnv = {}, cwd = repositoryRoot): { verdict: string; code: number | null; stderr: string } {
    const result = spawnSync('bash', [guard], {
        input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', ...env },
    });
    return { verdict: result.status === 2 ? BLOCK : ALLOW, code: result.status, stderr: result.stderr };
}

function assertVerdicts(cases: Array<[expected: string, command: string]>, env: NodeJS.ProcessEnv = {}): void {
    const cliCases = cases.flatMap(([expected, command]): Array<[string, string]> => command.includes('kubectl')
        ? [[expected, command], [expected, command.replaceAll('kubectl', 'oc')]]
        : [[expected, command]]);
    for (const [expected, command] of cliCases) {
        const { verdict, code, stderr } = runGuard(command, env);
        assert.ok(code === 0 || code === 2, `${command}\nexited ${code}, which is neither allow nor block\n${stderr}`);
        assert.equal(verdict, expected, `${command}\n${stderr}`);
        if (expected === BLOCK) {
            assert.match(stderr, /BLOCKED by cratis-guard-secrets/);
            assert.match(stderr, /Use instead: /);
        }
    }
}

test('credential words embedded in source paths do not taint commands', () => {
    assertVerdicts([
        [ALLOW, 'git add Deployment/Specs/for_ApplicationCredentials/given/an_application.cs'],
        [ALLOW, 'git diff -- Deployment/Specs/for_ApplicationCredentials/when_x/a.cs'],
        [ALLOW, 'rm Deployment/Specs/for_ApplicationCredentials/when_x/a.cs'],
        [ALLOW, 'git add Source/Foo/ApplicationCredentials.cs Source/Foo/CredentialsProvider.cs'],
        [ALLOW, 'cat Deployment/Specs/for_ApplicationCredentials/given/an_application.cs'],
        [ALLOW, 'mv Specs/for_ApplicationCredentials/a.cs Specs/for_ApplicationCredentials/b.cs'],
        [ALLOW, 'git add a b && git status'],
        ...['cat ~/.aws/credentials', 'git add credentials.json', 'git add .aws/credentials',
            'git add config/credentials/prod.txt', 'git add config/credentials.json/prod.txt', 'cat Source/credentials', 'rm id_rsa',
            'git add .git-credentials', 'cat for_ApplicationCredentials/credentials',
            'git add Specs/for_ApplicationCredentials', 'git add x && cat .env'].map(command => [BLOCK, command] as [string, string]),
    ]);
});

test('literal-prefix trailing globs inspect bounded real matches, never shell input', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-secret-glob-'));
    try {
        writeFileSync(join(directory, 'project.md'), 'synthetic fixture');
        writeFileSync(join(directory, 'Directory.Build.props'), 'synthetic fixture');
        mkdirSync(join(directory, 'keys'));
        writeFileSync(join(directory, 'keys/server.pem'), 'synthetic fixture');
        for (const command of ['rg -l foo project*', 'rg -c foo project*', 'grep -l foo cert*',
            'rg -n foo Directory.Build.*', `cd '${directory}' && rg -n foo Directory.Build.*`, `cd '${directory}' && git diff --cc && rg -n foo Directory.Build.* && git log -6 --format=%H`]) {
            const result = runGuard(command, {}, directory);
            assert.equal(result.code, 0, `${command}\n${result.stderr}`);
        }
        for (const command of ['cat *', 'cat .env*', 'cat *.pem', 'cat *.key', 'cat id_rsa*',
            'cd "$X" && cat project*', 'pushd d; cat project*', 'cd missing && cat project*',
            'cd keys && cat server*', 'rg -n foo missing/project*', "rg -n foo 'Dir'$x*"]) {
            assert.equal(runGuard(command, {}, directory).code, 2, command);
        }
        assert.equal(runGuard('cat project*', {}, '').code, 2);
        writeFileSync(join(directory, 'options.sh'), 'shopt -s nocaseglob\n');
        for (const env of [{ GLOBIGNORE: 'x' }, { BASH_ENV: join(directory, 'options.sh') }, { ENV: join(directory, 'options.sh') }]) {
            assert.equal(runGuard('cat project*', env, directory).code, 2);
        }
        const unreadable = join(directory, 'unreadable');
        mkdirSync(unreadable, { mode: 0o000 });
        try { assert.equal(runGuard('cat unreadable/project*', {}, directory).code, 2); }
        finally { chmodSync(unreadable, 0o700); }
        writeFileSync(join(directory, 'cert.pem'), 'synthetic fixture');
        for (const command of ['cat cert*', 'rg -n foo cert*', 'rg -l foo cert*', 'rg -l --json foo cert*',
            'rg -l foo server.pem', 'rg -l foo .env', 'rg -l foo .env*', 'rg -l foo id_rsa*', 'rg -l foo *.pem']) {
            const result = runGuard(command, {}, directory);
            assert.equal(result.code, 2, `${command}\n${result.stderr}`);
        }
        for (const operand of [`project$(touch ${directory}/executed)*`, `project\`touch ${directory}/executed\`*`,
            `"project';touch executed;'"*`, `"project'quote"*`, `'project"quote'*`, "'project;touch executed'*", "'project\n'*"]) {
            const result = runGuard(`cat ${operand}`, {}, directory);
            assert.equal(result.code, 2, `${operand}\n${result.stderr}`);
            assert.equal(existsSync(join(directory, 'executed')), false);
        }
        for (let index = 0; index < 201; index++) writeFileSync(join(directory, `project-${index}`), 'fixture');
        assert.equal(runGuard('cat project*', {}, directory).code, 2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('glob probes never trust a preceding command or lose filesystem context', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-glob-context-'));
    try {
        writeFileSync(join(directory, 'server.txt'), 'synthetic fixture');
        mkdirSync(join(directory, 'keys'));
        writeFileSync(join(directory, 'keys/server.pem'), 'synthetic fixture');
        for (const command of ["c''d keys; cat server*", String.raw`c\d keys; cat server*`, '"c"d keys; cat server*',
            'f(){ cd keys; }; f; cat server*', 'z keys; cat server*',
            'true; cat server*', 'cat server* && z keys && cat server*',
            'cd keys; cat server*', 'rg -L foo cert*']) {
            assert.equal(runGuard(command, {}, directory).code, 2, command);
        }
        writeFileSync(join(directory, 'cert.txt'), 'synthetic fixture');
        writeFileSync(join(directory, 'CERT.pem'), 'synthetic fixture');
        assert.equal(runGuard('cat cert*', {}, directory).code, 2);
        symlinkSync(join(directory, 'keys/server.pem'), join(directory, 'notes.txt'));
        assert.equal(runGuard('cat notes*', {}, directory).code, 2);
        mkdirSync(join(directory, '.docker'));
        writeFileSync(join(directory, '.docker/config.json'), 'synthetic fixture');
        assert.equal(runGuard('cat config*', {}, join(directory, '.docker')).code, 2);
        symlinkSync(join(directory, '.docker'), join(directory, 'alias'));
        assert.equal(runGuard('cat config*', {}, join(directory, 'alias')).code, 2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('glob probes fail closed on parent segments and logical versus physical cwd uncertainty', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-glob-logical-cwd-'));
    try {
        mkdirSync(join(directory, 'visible'));
        mkdirSync(join(directory, 'elsewhere/sub'), { recursive: true });
        symlinkSync('../elsewhere/sub', join(directory, 'visible/link'));
        writeFileSync(join(directory, 'visible/server.pem'), 'synthetic fixture');
        writeFileSync(join(directory, 'elsewhere/server.txt'), 'synthetic fixture');
        for (const command of ['cd visible && cat server*', 'cd visible/link/.. && cat server*',
            'cat visible/link/../server*', 'cd elsewhere/sub/.. && cat server*',
            'rg -l foo visible/link/../server*', `cd '${directory}/visible/link/..' && cat server*`]) {
            assert.equal(runGuard(command, {}, directory).code, 2, command);
        }
        assert.equal(runGuard('cat server*', {}, join(directory, 'visible/link/..')).code, 2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('literal directory checks retain the process cwd when the payload omits cwd', () => {
    const result = spawnSync('bash', [guard], {
        cwd: repositoryRoot,
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rg -n PASSWORD Source .env.example' } }),
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '' },
    });
    assert.equal(result.status, 2, result.stderr);
});

test('git search patterns and filename metadata do not become credential operands', () => {
    assertVerdicts([
        [ALLOW, 'git grep -n -e SpoofableHeaders.Strip -e ForwardedIdentityForward -e OptionsKey -e CredentialBinding -- Source/AuthProxy'],
        [ALLOW, 'git grep -n -e credentials -e .env -- Source/AuthProxy'],
        [ALLOW, 'git ls-files Source/AuthProxy/UserTokens Source/AuthProxy/Credentials Source/AuthProxy/Proxying Source/AuthProxy/ForwardedIdentity'],
        [ALLOW, 'git ls-files -s Source/AuthProxy/Credentials'],
        [ALLOW, 'git ls-files --debug Source/AuthProxy/Credentials'],
        [ALLOW, 'git ls-files -s -- .env'], [ALLOW, 'git ls-files --debug -- .env'],
        ...['git grep -n password -- .env', 'git grep -e x -- secrets.json',
            'git grep -e x -- credentials.json', 'git grep -f .env -- Source/AuthProxy',
            'git show HEAD:.env', 'git cat-file -p HEAD:.env', 'git show HEAD:secrets.json',
            'git cat-file -p HEAD:secrets.json', 'git ls-files .env; cat .env',
            'git -c alias.ls-files=show ls-files Credentials',
        ].map(command => [BLOCK, command] as [string, string]),
    ]);
});

test('original read lanes allow directory globs only with proven read-only context', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-original-read-lanes-'));
    const commands = [
        `cd ${directory} && git diff --cc && rg -n 'new BearerRouteMiddleware|new\\(next, options|TreatWarnings|EnforceCode|WarningLevel|Configuration|Docker|Testcontainers' Source/AuthProxy.Specs/BearerRoutes Source/AuthProxy.Security.Specs/*.csproj Source/Aspire.Specs/*.csproj Directory.Build.* Source/Directory.Build.* AuthProxy.slnx && git log -6 --format='%H %s'`,
        "rg -l 'Identity|Hosting' .cratis/ai/rules/project*",
        `cd ${directory} && git branch --show-current && git rev-parse HEAD && git status --short && rg -n 'Infrastructure.csproj' Source --glob '*.csproj' && sed -n '1,130p' Source/Admin.Specs/Admin.Specs.csproj && sed -n '1,120p' Source/Infrastructure/Infrastructure.csproj`,
    ];
    try {
        for (const path of ['Source/AuthProxy.Specs/BearerRoutes', 'Source/AuthProxy.Security.Specs', 'Source/Aspire.Specs', '.cratis/ai/rules', 'Source/Admin.Specs', 'Source/Infrastructure']) mkdirSync(join(directory, path), { recursive: true });
        for (const path of ['Source/AuthProxy.Security.Specs/Security.csproj', 'Source/Aspire.Specs/Aspire.csproj', 'Directory.Build.props', '.cratis/ai/rules/project.md', 'Source/Admin.Specs/Admin.Specs.csproj', 'Source/Infrastructure/Infrastructure.csproj']) writeFileSync(join(directory, path), 'synthetic fixture');
        for (const command of commands) assert.equal(runGuard(command, {}, directory).code, 0, command);
        assert.equal(runGuard('rg -n foo Source/Directory.Build.*', {}, directory).code, 0);
        assert.equal(runGuard(commands[0], { CDPATH: directory }, directory).code, 0);
        assert.equal(runGuard('cd Source && rg -n foo Directory.Build.*', { CDPATH: directory }, directory).code, 2);
        for (const command of ['z keys && rg -n foo Source/Directory.Build.*', 'git diff --cc; rg -n foo Source/Directory.Build.*',
            'git diff --cc && rg -n foo Source/Directory.Build.* && touch marker', 'rg -l foo missing/project*',
            'rg -n password .env*', 'git show HEAD:.env']) assert.equal(runGuard(command, {}, directory).code, 2, command);
        writeFileSync(join(directory, 'Source/Directory.Build.private.key'), 'synthetic fixture');
        assert.equal(runGuard(commands[0], {}, directory).code, 2);
        writeFileSync(join(directory, '.cratis/ai/rules/project.pem'), 'synthetic fixture');
        assert.equal(runGuard(commands[1], {}, directory).code, 2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('bracket backslashes never crash the regex parser', () => {
    for (const command of [String.raw`x=[fail\\]; cat $x`, String.raw`for f in [fail\\]; do cat $f; done`,
        'cat ${x:-[fail\\\\]}', String.raw`cat {a,[fail\\]}`,
        String.raw`rg -n "\[FAIL\]" gate.log`, String.raw`rg -n "\[FAIL\]" *.log`, 'cat [a-[:digit:]]']) {
        const result = runGuard(command);
        assert.ok(result.code === 0 || result.code === 2, result.stderr);
        assert.doesNotMatch(result.stderr, /parser failed/);
    }
    assertVerdicts([[BLOCK, 'cat [.]env'], [BLOCK, 'cat .[e]nv'], [BLOCK, 'cat id_[r]sa']]);
});

test('a narrower literal command is the supported remediation', () => {
    const result = runGuard('cat ~/.aws/credentials');
    assert.match(result.stderr, /supported route/);
    assert.match(result.stderr, /Use instead: /);
    assert.doesNotMatch(result.stderr, /rephrase it/);
});

function projectionCommand(expression: string, format = 'jsonpath'): string {
    return `kubectl get pods -o ${format}='${expression.replaceAll("'", "'\\''")}'`;
}

test('the issue acceptance list: full specs, secrets, env and inspect are blocked; projections are allowed', () => {
    assertVerdicts([
        [BLOCK, 'kubectl get pods -o json'],
        [BLOCK, 'kubectl describe pod x'],
        [BLOCK, 'kubectl get secret'],
        [BLOCK, 'printenv'],
        [BLOCK, 'docker inspect x'],
        [ALLOW, "kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'"],
        [ALLOW, 'kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image'],
        [ALLOW, 'kubectl get pods -o name'],
    ]);
});

test('kubectl: every spec-bearing resource is blocked with json or yaml, however the flag is spelled', () => {
    assertVerdicts([
        [BLOCK, 'kubectl get pods -o yaml'],
        [BLOCK, 'kubectl get pods -o kyaml'],
        [BLOCK, 'kubectl get pods --output=JSON'],
        [BLOCK, 'oc get pods -o some-future-format'],
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

test('oc command words, paths and tabs reach the same resource checks', () => {
    assertVerdicts([
        [BLOCK, 'oc describe deployment web'],
        [BLOCK, 'oc\tdescribe pod web'],
        [BLOCK, '/usr/local/bin/oc describe deployment web'],
        [BLOCK, '/usr/local/bin/oc get pod web -o yaml'],
        [BLOCK, '/usr/local/bin/oc get secret'],
        [BLOCK, '/usr/local/bin/oc config view --raw'],
        [ALLOW, 'oc get pods'],
        [ALLOW, 'oc get pods -o name'],
        [ALLOW, '/usr/local/bin/oc get pods'],
        [ALLOW, '/usr/local/bin/oc get pods -o name'],
        [ALLOW, 'oc'],
        [ALLOW, 'docker ps'],
        [ALLOW, 'echo doc'],
    ]);
});

test('container-spec ancestors and indexed paths are refused in jsonpath projections', () => {
    const paths = [
        '.', '@', '.items', '.items[*]', '.items[0]',
        '.spec', '.spec.template', '.spec.template.spec',
        '.spec.containers', '.spec.initContainers', '.spec.ephemeralContainers',
        '.spec.containers[0]', '.spec.initContainers[*]', '.spec.ephemeralContainers[1]',
        '.items[*].spec', '.items[0].spec.template', '.items[*].spec.template.spec',
        '.items[0].spec.template.spec.containers[*]',
        '.spec.jobTemplate', '.spec.jobTemplate.spec', '.spec.jobTemplate.spec.template',
        '.spec.jobTemplate.spec.template.spec', '.spec.jobTemplate.spec.template.spec.containers[0]',
        '.items[0].spec.jobTemplate.spec.template.spec.initContainers[*]',
    ];
    assertVerdicts(paths.map(path => [BLOCK, `kubectl get pods -o jsonpath='{${path}}'`]));
});

test('environment segments and recursive descent are refused in jsonpath projections', () => {
    const paths = [
        '.spec.containers[*].env', '.spec.containers[0].env[*].value',
        '.spec.initContainers[*].envFrom', '.spec.ephemeralContainers[0].envFrom[*].secretRef.name',
        '.items[*].spec.template.spec.containers[0].env[1].value',
        '.spec.jobTemplate.spec.template.spec.containers[*].envFrom',
        '..env', '..value', '..', '.items[*]..value',
    ];
    assertVerdicts(paths.map(path => [BLOCK, `kubectl get pods --output=jsonpath-as-json='{${path}}'`]));
});

test('go-template output is conservatively refused even for safe metadata and image fields', () => {
    const expressions = ['{{.metadata.name}}', '{{.status.phase}}', '{{.spec.containers}}', '{{.spec.nodeName}}',
        '{{range .items}}{{.metadata.name}}{{end}}', '{{range .spec.containers}}{{.image}}{{end}}',
        '{{with .spec.containers}}{{.name}}{{end}}', '{{range $i, $c := .spec.containers}}{{$c.image}}{{end}}',
        '{{json .spec}}', '{{toJson .}}', '{{index . "spec"}}', '{{$object.name}}'];
    assertVerdicts(['go-template', 'template'].flatMap(format => expressions.map(expression =>
        [BLOCK, projectionCommand(expression, format)] as [string, string])));
    assertVerdicts([
        [BLOCK, "kubectl get pods -o go-template --template '{{.metadata.name}}'"],
        [BLOCK, "kubectl get pods --output=template --template='{{.metadata.name}}'"],
        [BLOCK, "kubectl get pods --template='{{.metadata.name}}'"],
    ]);
});

test('custom-columns checks container paths with every supported output flag spelling', () => {
    const paths = ['.spec', '.spec.containers[*].env', '..env'];
    const flags = ['-o ', '-o', '-o=', '--output ', '--output='];
    assertVerdicts(flags.flatMap(flag => paths.map(path =>
        [BLOCK, `kubectl get pods ${flag}custom-columns=NAME:.metadata.name,VALUE:${path}`] as [string, string])));
});

test('field projections and the suggested alternatives remain allowed', () => {
    const paths = [
        '.kind', '.apiVersion', '.metadata.name', '.metadata.namespace', '.metadata.uid',
        '.metadata.creationTimestamp', '.metadata.resourceVersion', '.metadata.generation', '.metadata.deletionTimestamp',
        '.metadata.labels', '.metadata.labels.app', '.metadata.labels.data', '.metadata.labels.app_name-1',
        '.metadata.ownerReferences[*].name', '.metadata.ownerReferences[0].kind', '.metadata.ownerReferences[12].uid',
        '.items[*].metadata.name', '.items[0].metadata.labels', '.items[12].metadata.ownerReferences[0].name',
        '.status', '.status.phase', '.status.conditions[*].type', '.status.conditions[0].status', '.status.app_name-1[12]',
        '.spec.nodeName', '.spec.replicas', '.spec.serviceAccountName', '.spec.schedulerName',
        '.spec.restartPolicy', '.spec.type', '.spec.clusterIP',
    ];
    assertVerdicts(paths.flatMap(path => [
        [ALLOW, `kubectl get pods -o jsonpath='{${path}}'`],
        [ALLOW, `kubectl get pods --output=custom-columns=VALUE:${path}`],
    ] as Array<[string, string]>));
    assertVerdicts([
        [ALLOW, 'kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase'],
        [ALLOW, 'kubectl get pods -o name'],
        [ALLOW, 'kubectl get pods -o wide'],
        [ALLOW, "kubectl get svc web -o jsonpath='{.spec}'"],
        [ALLOW, 'kubectl get svc web -o custom-columns=VALUE:.spec'],
    ]);
});

test('container-spec projection checks use the existing resource aliases', () => {
    const resources = 'pods po pod deployments deployment deploy statefulsets statefulset sts daemonsets daemonset ds jobs job cronjobs cronjob cj configmaps configmap cm replicasets replicaset rs replicationcontrollers rc all'.split(' ');
    assertVerdicts(resources.map(resource => [BLOCK, `kubectl get ${resource} -o jsonpath='{.spec}'`]));
    assertVerdicts([
        [BLOCK, "kubectl get deployments.apps/web --output=jsonpath='{.spec.template}'"],
        [BLOCK, 'kubectl get svc/web pod/x -o custom-columns=VALUE:.spec'],
    ]);
});

test('whole objects, signed indexes, slices, filters, quoted keys and unions are refused', () => {
    const expressions = ['{.}', '{@}', '{$}', '{.items}', '{.items[*]}', '{.items[0]}', '{.items[-1]}',
        '{.items[0:2]}', '{.items[:]}', '{.items[?(@.metadata.name=="web")]}', "{['items']}", '{["items"]}',
        "{['spec','status']}", "{['a']['spec']}", "{['spec']['containers']}", "{.items[0]['spec']}",
        '{.items[0,1]}', '{.spec.*}', '{.spec.volumes}', '{.data}', '{.stringData}',
        '{.spec.containers[-1].image}', '{.spec.containers[0:2].name}', '{.status.*}', '{.status..phase}',
        '{.metadata.ownerReferences[*]}', '{.metadata.ownerReferences[0].controller}', '{.metadata.labels.app.extra}',
        '{$.metadata.name}', '{@.items}', '{@[*]}', '{..value}', '{..}', '{.unknown}', '{.metadata}'];
    assertVerdicts(['jsonpath', 'jsonpath-as-json'].flatMap(format => expressions.map(expression =>
        [BLOCK, projectionCommand(expression, format)] as [string, string])));
});

test('jsonpath permits balanced item ranges, field segments, string literals and plain text', () => {
    const expressions = [
        '{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}',
        '{range .items[*]}{range .items[*]}{.metadata.name}{end}{end}',
        '{ range .items [*] }{ .metadata .name }{ end }',
        'NAME:{.metadata.name} STATUS:{.status.phase}', '{" a b "}{.metadata.name}', "{' a b '}",
        String.raw`{"a\" b"}{"\\"}`, '{"$"}{"@"}', '{.STATUS.PHASE}', 'plain text',
    ];
    assertVerdicts(expressions.map(expression => [ALLOW, projectionCommand(expression)]));
    assertVerdicts([
        [ALLOW, "kubectl get pods -o jsonpath --template='NAME:{.metadata.name}!'"],
        [ALLOW, "kubectl get pods --output=jsonpath-as-json --template='{.metadata.name}'"],
    ]);
});

test('container name and image fields support item prefixes and nonnegative indexes', () => {
    const paths = ['', '.template.spec'].flatMap(template => ['containers', 'initContainers', 'ephemeralContainers'].flatMap(container =>
        ['image', 'name', 'imagePullPolicy'].map(field => `.spec${template}.${container}[*].${field}`)));
    assertVerdicts(paths.flatMap(path => [
        [ALLOW, projectionCommand(`{.items[*]${path}}`)],
        [ALLOW, projectionCommand(`{ ${path} }`, 'jsonpath-as-json')],
        [ALLOW, `kubectl get pods -o custom-columns=NAME:metadata.name,IMAGE:${path.slice(1)}`],
    ] as Array<[string, string]>));
    assertVerdicts([
        [ALLOW, projectionCommand('{.items[0].spec.containers[0].image}')],
        [ALLOW, projectionCommand('{.items[12].spec.template.spec.initContainers[2].name}')],
        [ALLOW, projectionCommand('{.spec.ephemeralContainers[0].imagePullPolicy}')],
        [ALLOW, projectionCommand('{.spec.containers[*].image}{.metadata.name}{.spec.initContainers[*].name}')],
        [BLOCK, projectionCommand('{.spec.jobTemplate.spec.template.spec.containers[*].image}')],
        [BLOCK, projectionCommand('{.spec.containers.*.image}')],
        [BLOCK, projectionCommand('{.spec.containers[*].image.extra}')],
        [BLOCK, projectionCommand('{.spec.containers[*].image}{.spec.containers[*].env}')],
    ]);
});

test('annotations and managed fields are conservatively refused even for individual keys', () => {
    const paths = ['.metadata.annotations', '.metadata.annotations.app', '.metadata.annotations.kubectl.kubernetes.io/last-applied-configuration',
        '.items[*].metadata.annotations', '.metadata.managedFields', '.metadata.managedFields[0].manager'];
    assertVerdicts(paths.flatMap(path => [
        [BLOCK, projectionCommand(`{${path}}`)],
        [BLOCK, `kubectl get pods -o custom-columns=VALUE:${path}`],
    ] as Array<[string, string]>));
    assertVerdicts([
        [BLOCK, projectionCommand("{.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']}")],
        [BLOCK, projectionCommand('{range .items[*]}{.metadata.annotations}{end}')],
        [ALLOW, projectionCommand('{.metadata.labels.app}')],
    ]);
});

test('jsonpath refuses malformed segments, unsupported ranges and anything outside the allowlist', () => {
    const expressions = ['{}', '{.metadata.name', '.metadata.name}', '{{.metadata.name}}',
        '{"{"}', '{"}"}', '{"unterminated}', '{"a""b"}', '{"a".metadata.name}', '{.metadata.name "x"}',
        '{range .spec.containers[*]}{.image}{end}', '{range .items[0]}{.metadata.name}{end}',
        '{with .items[*]}{.metadata.name}{end}', '{if .status.phase}{.metadata.name}{end}',
        '{range .items[*]}{.metadata.name}', '{end}', '{range .items[*]}{.metadata.name}{end}{end}',
        '{range .items[*]}{.items[*].metadata.name}{end}', '{range .items[*]}{.}{end}',
        '{.status.phase}{.items[-1]}', '{.metadata.name}{.metadata.annotations}', '{unknown}', '{.image}'];
    assertVerdicts(expressions.map(expression => [BLOCK, projectionCommand(expression)]));
});

test('custom columns allow only complete field paths in every column', () => {
    const flags = ['-o ', '-o', '-o=', '--output ', '--output='];
    assertVerdicts(flags.flatMap(flag => [
        [ALLOW, `kubectl get pods ${flag}custom-columns=NAME:.metadata.name,STATUS:.status.phase`],
        [ALLOW, `kubectl get pods ${flag}custom-columns=NAME:metadata.name,STATUS:status.phase`],
        [BLOCK, `kubectl get pods ${flag}custom-columns=NAME:.metadata.name,VALUE:.items[-1]`],
        [BLOCK, `kubectl get pods ${flag}custom-columns=IMAGE:spec.containers[*].image,ENV:spec.containers[*].env`],
    ] as Array<[string, string]>));
    const values = ['.', 'items[*]', 'items[-1]', 'items[0:2]', 'items[?(@.metadata.name=="web")]',
        "['items']", 'spec', 'unknown', '$', '@', '..status', 'metadata.annotations', 'metadata.managedFields'];
    assertVerdicts(values.map(value => [BLOCK, `kubectl get pods -o custom-columns='VALUE:${value.replaceAll("'", "'\\''")}'`]));
    assertVerdicts([
        [BLOCK, 'kubectl get pods -o custom-columns=IMAGE:spec.containers[*].image,UNKNOWN'],
        [BLOCK, 'kubectl get pods -o custom-columns=NAME:metadata.name,'],
        [BLOCK, 'kubectl get pods -o custom-columns=NAME:'],
        [ALLOW, 'kubectl get pods -o custom-columns=DATA:.metadata.name'],
    ]);
});

test('file-sourced output formats and template arguments require inline fields', () => {
    const aliases = ['templatefile', 'go-template-file', 'jsonpath-file', 'custom-columns-file'];
    assertVerdicts(aliases.flatMap(alias => [
        [BLOCK, `kubectl get pods -o ${alias}=fields.txt`],
        [BLOCK, `kubectl get pods --output=${alias}=fields.txt`],
        [BLOCK, `kubectl get pods -o ${alias} --template=fields.txt`],
        [BLOCK, `kubectl get pods --output ${alias} --template fields.txt`],
    ] as Array<[string, string]>));
    assertVerdicts(['template', 'go-template', 'jsonpath'].flatMap(format => ['fields.txt', '@fields.txt', './fields.tpl', '/tmp/fields.tpl'].flatMap(file => [
        [BLOCK, `kubectl get pods -o ${format} --template=${file}`],
        [BLOCK, `kubectl get pods --output=${format} --template ${file}`],
    ] as Array<[string, string]>)));
    assertVerdicts([
        [BLOCK, 'kubectl get pods --template=@fields.txt'],
        [BLOCK, 'kubectl get pods --template-file=fields.txt'],
        [BLOCK, 'kubectl get --template-file fields.txt pods -o go-template'],
        [BLOCK, "kubectl get pods -o jsonpath --template-file fields.txt --template='{.metadata.name}'"],
        [BLOCK, "kubectl get pods -o template='{{.metadata.name}}'"],
        [BLOCK, "kubectl get pods --output=template --template '{{.metadata.name}}'"],
        [ALLOW, 'kubectl get svc web -o jsonpath-file=fields.txt'],
    ]);
    const result = runGuard('kubectl get pods -o custom-columns-file=fields.txt');
    assert.equal(result.code, 2);
    assert.match(result.stderr, /inline projection of the needed fields/);
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
        [BLOCK, "kubectl get pods -o go-template='{{range .items}}{{.metadata.name}}{{end}}'"],
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

test('empty input and calls without a command exit 0 rather than blocking everything', () => {
    for (const input of ['', '{}', '{"tool_name":"Bash"}', '{"tool_input":{"command":""}}']) {
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
        for (const command of ["cat .e'n'v", 'cat .e*']) {
            assert.match(run(command).stderr, /stub-awk-ran/, `${command} is handed to the parser`);
        }
        const parsed = run('kubectl get pods');
        assert.match(parsed.stderr, /stub-awk-ran/, 'a command that mentions kubectl is handed to the parser');
        assert.equal(parsed.status, 2);
        assert.match(parsed.stderr, /BLOCKED by cratis-guard-secrets: parser failed/);
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

test('shell quoting, escapes and ANSI-C strings resolve to the name the shell reads', () => {
    assertVerdicts([
        [BLOCK, "cat .e'n'v"],
        [BLOCK, 'cat ".en"v'],
        [BLOCK, "cat \".\"'env'"],
        [BLOCK, 'cat .e\\nv'],
        [BLOCK, 'cat \\.\\e\\n\\v'],
        [BLOCK, 'cat .e\\\nnv'],
        [BLOCK, "cat $'.env'"],
        [BLOCK, "cat $'\\x2eenv'"],
        [BLOCK, "cat $'\\056env'"],
        [BLOCK, "cat $'\\x2e\\x65\\x6e\\x76'"],
        [BLOCK, 'cat $".env"'],
        [BLOCK, "cat ~/.ssh/id_'rsa'"],
        [BLOCK, "head -n1 se'rver.p'em"],
        [BLOCK, "cat ~/.ku'be'/config"],
        [BLOCK, "c'at' .env"],
        [BLOCK, "$'\\x63at' .e'n'v"],
        [BLOCK, 'bash -c "cat .e\'n\'v"'],
    ]);
});

test('brace expansion and glob patterns are checked against every protected name they can match', () => {
    assertVerdicts([
        [BLOCK, 'cat .{e,x}nv'],
        [BLOCK, 'cat {.,}env'],
        [BLOCK, 'cat .en?'],
        [BLOCK, 'cat .e*'],
        [BLOCK, 'cat .[e]nv'],
        [BLOCK, 'cat ~/.ssh/id_*'],
        [BLOCK, 'cat ~/.ssh/id_r?a'],
        [BLOCK, 'cat *.pem'],
        [BLOCK, 'cat ~/.k*/config'],
        [BLOCK, 'cat ~/.kube/*'],
        [BLOCK, 'cat *'],
        [BLOCK, 'c?t .env'],
        [ALLOW, 'cat src/*.ts'],
        [ALLOW, 'cat docs/*.md'],
        [ALLOW, 'grep -n foo *.cs'],
        [ALLOW, 'cat ~/.ssh/*.pub'],
        [ALLOW, 'cat tsconfig*.json'],
        [ALLOW, 'ls .e*'],
        [ALLOW, 'ls *'],
        [ALLOW, 'cat .env.{example,sample}'],
        [ALLOW, "sed -n '1p' *.md"],
        [ALLOW, "rg -n foo -g '*.json'"],
        [ALLOW, 'cat file{1,2}.txt'],
    ]);
});

test('variables assigned in the same command resolve; names known only at run time stay uncovered', () => {
    assertVerdicts([
        [BLOCK, 'X=.env; cat $X'],
        [BLOCK, 'X=.env; cat "${X}"'],
        [BLOCK, 'X=.e; cat ${X}nv'],
        [BLOCK, 'export F=~/.ssh/id_rsa; cat $F'],
        [BLOCK, 'Y=v; cat ".en${Y}"'],
        [BLOCK, 'cat ${X:-.env}'],
        [BLOCK, '$C .env'],
        [ALLOW, 'cat "$f"'],
        [ALLOW, 'head -n 5 "$file"'],
        [ALLOW, 'for f in *.md; do cat "$f"; done'],
        [ALLOW, 'cat "$dir/README.md"'],
        [ALLOW, 'echo $HOME'],
        [ALLOW, 'cat ${HOME}/notes.txt'],
        [ALLOW, 'cat "$(git rev-parse --show-toplevel)/package.json"'],
        [ALLOW, 'X=README.md; cat $X'],
    ]);
});

test('an input redirection before the command word is a read too', () => {
    assertVerdicts([
        [BLOCK, '< .env cat'],
        [BLOCK, '<.env cat'],
        [ALLOW, '< README.md cat'],
    ]);
});

test('parameter operators that are not resolved exactly remain checked', () => {
    assertVerdicts([
        [BLOCK, 'x=.env; cat ${x:?}'],
        [BLOCK, 'x=.envX; cat "${x%X}"'],
        [BLOCK, 'x=.exv; cat ${x/x/n}'],
        [BLOCK, 'x=.envx; cat ${x:0:4}'],
        [BLOCK, 'x=.ENV; cat ${x,,}'],
        [BLOCK, 'x=.env; cat ${x^^}'],
        [BLOCK, 'x=.env; cat ${x@Q}'],
        [BLOCK, 'y=.env; x=y; cat ${!x}'],
        [BLOCK, 'cat ${UNSET:-${OTHER:-.env}}'],
        [BLOCK, 'x=unused; cat ${x%z}README.md'],
        [BLOCK, 'x=unused; cat tsconfig${x%z}.json'],
    ]);
});

test('append assignments contribute to subsequent read operands', () => {
    assertVerdicts([[BLOCK, 'x=.e; x+=nv; cat $x']]);
});

test('temporary assignments do not replace earlier argument values', () => {
    assertVerdicts([[BLOCK, 'S=; S=.example cat ".env$S"']]);
});

test('expansion limits retain unresolved protected possibilities', () => {
    assertVerdicts([
        [BLOCK, 'a= b= c= d= e= f= g=; cat .env${a:+.example}${b:+.example}${c:+.example}${d:+.example}${e:+.example}${f:+.example}${g:+.example}'],
        [BLOCK, 'cat ${a:+x}${b:+x}${c:+x}${d:+x}${e:+x}${f:+x}${g:+x}'],
        [BLOCK, 'cat {a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}.pem'],
    ]);
});

test('temporary assignments do not define previously unset argument values', () => {
    assertVerdicts([[BLOCK, 'unset f; f=.example cat .env$f']]);
});

test('assignments in subshells and conditional branches are not unconditional values', () => {
    assertVerdicts([
        [BLOCK, '(f=.example); cat .env$f'],
        [BLOCK, 'f=; false && f=.example; cat .env$f'],
        [BLOCK, 'f=; if false; then f=.example; fi; cat .env$f'],
    ]);
});

test('glob extensions and canonical names use default shell matching', () => {
    assertVerdicts([
        [BLOCK, 'cat secret.p[e]m'],
        [BLOCK, 'cat *.p?m'],
        [BLOCK, 'cat secret.p[[:alpha:]]m'],
        [BLOCK, 'cat secret.p[!z]m'],
        [BLOCK, 'cat [a.]*.pem'],
        [BLOCK, 'cat secret.*'],
        [BLOCK, 'cat .e*'],
        [BLOCK, 'cat creden*'],
        [ALLOW, 'cat ~/.ssh/*.pub'],
        [ALLOW, 'cat tsconfig*.json'],
        [ALLOW, 'cat *.md'],
        [ALLOW, 'cat src/*.ts'],
        // a protected stem in a glob is refused rather than matched
        [BLOCK, 'cat .ENV?'],
        [BLOCK, 'cat ID_R??'],
        [ALLOW, 'cat secret.p[z]m'],
        [ALLOW, 'cat secret.p[[:digit:]]m'],
        [BLOCK, 'cat [.]env'],
        [BLOCK, 'cat [.]pem'],
    ]);
});

test('adjacent input redirections are checked independently of the command', () => {
    assertVerdicts([
        [BLOCK, 'cat<.env'],
        [BLOCK, '<.env true'],
        [BLOCK, 'true <.env'],
        [ALLOW, 'cat<README.md'],
    ]);
});

test('wrapper option terminators preserve the command classification', () => {
    assertVerdicts([
        [BLOCK, 'command -- cat .env'],
        [BLOCK, 'builtin -- cat .env'],
        [BLOCK, 'exec -- cat .env'],
        [BLOCK, 'env -- cat .env'],
    ]);
});

test('dd input assignments are read operands', () => {
    assertVerdicts([
        [BLOCK, 'dd if=.env'],
        [BLOCK, 'x=.env; dd if=$x'],
        [ALLOW, 'dd if=README.md of=/tmp/x'],
    ]);
});

for (const command of ['cp .env /tmp/x', 'mv .env /tmp/x', 'ln .env /tmp/x', 'rsync .env /tmp/x', 'scp .env host:/tmp/x', 'tar -cf /tmp/x .env', 'zip /tmp/x .env']) {
    test(`${command.split(' ')[0]} source operands are reads`, () => {
        assertVerdicts([[BLOCK, command]]);
    });
}

test('loop values remain checked inside the loop body', () => {
    assertVerdicts([
        [BLOCK, 'for f in .env; do cat $f; done'],
        [ALLOW, 'for f in *.md; do wc -l "$f"; done'],
        [ALLOW, 'for f in *.md; do cat "$f"; done'],
    ]);
});

test('here-string input operands are checked as reads', () => {
    assertVerdicts([
        [BLOCK, 'read x <<< .env'],
        [BLOCK, 'read x<<<.env'],
        [ALLOW, 'read x <<< README.md'],
    ]);
});

test('shell glob configuration changes require the default options', () => {
    assertVerdicts([
        [BLOCK, 'shopt -s dotglob'],
        [BLOCK, 'shopt -s nocaseglob; cat *.md'],
        [BLOCK, 'GLOBIGNORE=x cat *'],
        [BLOCK, 'export BASHOPTS=dotglob'],
        [BLOCK, 'declare GLOBIGNORE'],
        [BLOCK, 'BASH_ENV=some-script bash -c true'],
        [BLOCK, 'ENV=some-script sh -c true'],
        ...['dotglob', 'nocaseglob', 'extglob', 'globstar', 'nullglob', 'failglob', 'globasciiranges'].map(option => [BLOCK, `shopt -u ${option}`] as [string, string]),
        [ALLOW, 'set -f'],
        [ALLOW, 'set -o noglob'],
        [ALLOW, 'shopt -p dotglob'],
        [ALLOW, 'echo "shopt -s dotglob"'],
    ]);
    assert.match(runGuard('shopt -s dotglob').stderr, /run without changing shell glob options/);
});

test('commands that name a protected file run only as a single literal read', () => {
    assertVerdicts([
        [ALLOW, 'cat .env.example'],
        [ALLOW, 'cp .env.example .env'],
        [ALLOW, 'cat .env.{example,sample}'],
        [ALLOW, 'grep -rn "process.env" src'],
        [ALLOW, 'rg -n id_rsa docs'],
        [ALLOW, 'ls -la .env'],
        [ALLOW, 'test -f .env'],
        [BLOCK, 'cp -f .env.example .env'],
        [BLOCK, 'cp .env /tmp/x'],
        [BLOCK, 'cat .env.example | head'],
        [BLOCK, 'cat .env.example; true'],
        [BLOCK, 'cat .env.example > /tmp/x'],
        [BLOCK, 'cat <<< .env'],
        [BLOCK, 'node -e "require(\'fs\').readFileSync(\'.env\')"'],
        [BLOCK, 'git diff --no-index /dev/null .env'],
        [BLOCK, 'F=.env.example; cat "$F"'],
        [BLOCK, 'grep -f .env README.md'],
        [BLOCK, 'grep -r x --include=.env .'],
    ]);
    const message = runGuard('git diff --no-index /dev/null .e"nv"').stderr;
    assert.match(message, /protected file \(\.env\)/);
    assert.match(message, /literal paths/);
    assert.match(message, /split/);
    assert.match(runGuard('cat secret.p[e]m').stderr, /\(\.pem\)/);
});

const commandForms: string[][] = [
    ['x=.env; true | x=.env.example; cat $x', 'x=.env; x=.env.example | cat $x', 'x=.env; x=.env.example & cat $x', 'x=.env; case b in a) x=.env.example;; esac; cat $x', 'x=.env; for f in ; do x=.env.example; done; cat $x'],
    ['bash -O dotglob -c "cat ?env"', 'bash -O extglob -c "cat @(.env)"'],
    ['zip -0 - .env', 'zip -0 -q - .env'],
    ['set -- .env; cat $1', 'set -- .env; cat "$@"', 'f(){ cat "$1"; }; f .env'],
    ['cp -rt /tmp/x .env', 'cp --target-directory=/tmp/x .env'],
    ['cat <<< .env'],
    ['x=.env; false && unset x; cat "$x"'],
    ['opt=-s; shopt "$opt" nocaseglob; cat .[E]nv'],
    ['ln -s /other/.env'],
    ['f=README.md; for x in a b; do cat "$f"; f=.env; done'],
    ['f=.env; (unset f); cat "$f"', 'f=.env; (for f in README.md; do :; done); cat "$f"'],
    ['f=.env bash -c \'cat "$f"\''],
    ['o=-s; shopt $o dotglob; cat [.]env'],
    ['zip - .env', 'cp --target-directory=/tmp .env'],
    ['x="secret.p[e]m"; cat $x'],
];
for (const [index, commands] of commandForms.entries()) {
    test(`command form ${index + 1} is refused`, () => {
        assertVerdicts(commands.map(command => [BLOCK, command]));
    });
}

test('shell option changes use only the supported defaults', () => {
    assertVerdicts([
        ...['-O extglob', '+O extglob', '-O dotglob', '-Oextglob'].flatMap(option =>
            ['bash', 'sh', 'zsh'].map(shell => [BLOCK, `${shell} ${option} -c true`] as [string, string])),
        [BLOCK, "bash -O extglob -c 'cat .@(e)nv'"],
        [BLOCK, "bash -O extglob -c 'cat .!(x)nv'"],
        [BLOCK, "bash -O extglob -c 'cat .+(e)nv'"],
        [BLOCK, "bash -O dotglob -c 'cat .e@(n)v'"],
        [ALLOW, 'echo extglob'],
        [BLOCK, 'shopt -s expand_aliases'],
        [BLOCK, 'set -o noclobber'],
        [BLOCK, 'set +o posix'],
        [BLOCK, 'set -C'],
        ...['errexit', 'nounset', 'pipefail', 'xtrace', 'verbose', 'noglob', 'errtrace', 'functrace'].flatMap(option =>
            ['-o', '+o'].map(flag => [ALLOW, `set ${flag} ${option}`] as [string, string])),
        ...['-e', '-u', '-x', '-f', '-v', '-E', '-T', '+e', '+u', '+x', '+f', '+v', '+E', '+T', '-euo pipefail'].map(flags =>
            [ALLOW, `set ${flags}`] as [string, string]),
    ]);
});

test('quoted boundaries end parameter names', () => {
    assertVerdicts([
        [BLOCK, 'f=.e; cat "$f"nv'],
        [BLOCK, "f=.e; cat $f'nv'"],
        [BLOCK, 'f=id_r; cat ~/.ssh/"$f"sa'],
        [BLOCK, 'f=/proc/self/env; cat "$f"iron'],
        [BLOCK, 'f=.n; cat ~/"$f"etrc'],
        [BLOCK, 'f=.e; cp "$f"nv /tmp/x'],
        [BLOCK, 'f=.e; tar cf - "$f"nv'],
        [BLOCK, 'f=.e; cat <"$f"nv'],
        [BLOCK, 'bash -c \'f=.e; cat "$f"nv\''],
        [ALLOW, 'f=READ; cat "$f"ME.md'],
    ]);
});

test('grouped and repeated pathname patterns are checked in every argument', () => {
    assertVerdicts([
        ...['?(', '*(', '+(', '@(', '!('].map(group => [BLOCK, `cat .${group}e)nv`] as [string, string]),
        [BLOCK, 'cat .(e|x)nv'],
        [BLOCK, "zsh -c 'cat .(e|x)nv'"],
        [BLOCK, "find . -maxdepth 1 -name '.e*' -exec cat {} \\;"],
        [BLOCK, "find ~/.ssh -name 'id_*' -exec cat {} \\;"],
        [BLOCK, "find . -iname '.e*' -execdir cat {} +"],
        [BLOCK, "find . -path '*/.e*' -ok cat {} \\;"],
        [BLOCK, "find . -ipath '*/id_*' -exec cat {} +"],
        [BLOCK, 'cat .e*'],
        [BLOCK, 'cat ~/.ssh/id_*'],
        [ALLOW, "find . -name '*.md' -exec cat {} \\;"],
    ]);
});

test('metadata-only glob operands do not permit content reads', () => {
    assertVerdicts([
        [ALLOW, 'ls .e*'],
        [ALLOW, 'stat .env'],
        [ALLOW, 'stat .e*'],
        [BLOCK, 'ls .e* | xargs cat'],
        [BLOCK, 'ls $(cat .env)'],
        [BLOCK, 'ls $HOME/.env'],
        [BLOCK, 'stat .e* > /tmp/x'],
        [BLOCK, 'command ls .e*'],
    ]);
});

test('search filters and recursive operands are not literal reads when tainted', () => {
    assertVerdicts([
        [BLOCK, 'rg -uu -g .env KEY'],
        [BLOCK, "rg --hidden --glob .env ''"],
        [BLOCK, 'rg -uu --iglob .ENV .'],
        [BLOCK, 'rg -uu --type-add x:.env -tx KEY'],
        [BLOCK, 'grep -r --include .env KEY .'],
        [BLOCK, "rg -uu -g id_rsa ''"],
        [BLOCK, "rg -uu -g .netrc ''"],
        [BLOCK, "rg -uu -g '**/credentials' ''"],
        [BLOCK, 'grep -r . .kube'],
        [BLOCK, 'grep -r . /run/secrets'],
        [BLOCK, 'rg --unknown-option -g .env KEY'],
        [BLOCK, 'rg -J -g .env KEY'],
        [BLOCK, 'grep -f .env x'],
        [BLOCK, 'grep --file=.env x'],
        [BLOCK, 'grep -e foo .env'],
        [BLOCK, 'grep --regexp=foo .env'],
        [BLOCK, 'grep -e foo -- .env'],
        [BLOCK, 'rg -f .env x'],
        [BLOCK, 'rg -e foo .env'],
        [BLOCK, "rg -g '.env' x"],
        [BLOCK, "rg --glob '.env' x"],
        [BLOCK, "rg --iglob '.env' x"],
        [BLOCK, "rg --type-add 'private:.env' x"],
        [BLOCK, "grep --include '.env' -r x ."],
        [BLOCK, "rg -g '.e*' x"],
        [BLOCK, "rg --glob='.e*' x"],
        [BLOCK, "rg --iglob 'id_*' x"],
        [BLOCK, "rg --type-add 'private:.e*' x"],
        [BLOCK, "grep --include='.e*' -r x ."],
        [BLOCK, 'grep -rn foo .kube'],
        [BLOCK, 'grep -Rn foo run/secrets'],
        [BLOCK, 'grep --recursive foo .env.example'],
        [BLOCK, 'rg x .env.example Source'],
        [BLOCK, 'rg -n --label=.env.example x'],
        [BLOCK, 'grep -m 5 x .env.example'],
        [BLOCK, 'rg -g "*.md" x .env.example'],
        [ALLOW, 'grep -rn "process.env" src'],
        [ALLOW, 'rg -n id_rsa docs'],
        [ALLOW, 'rg -uu .env docs'],
        [ALLOW, 'rg -S .env docs'],
        [ALLOW, 'grep -T .env docs'],
        [ALLOW, 'rg --regexp=.env docs'],
        [ALLOW, 'grep -ne.env README.md'],
        [ALLOW, 'grep -e .env -r .'],
        [ALLOW, 'ag -r .env .'],
        [ALLOW, 'grep -e foo .env.example'],
        [ALLOW, 'rg -e foo .env.example'],
    ]);
});

test('tainted rg operands distinguish files from directories in the invocation directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'guard-search-'));
    try {
        writeFileSync(join(directory, '.env.example'), '');
        mkdirSync(join(directory, '.env.sample'));
        mkdirSync(join(directory, "docs'notes"));
        for (const [expected, command] of [
            [0, 'rg -e foo .env.example'],
            [2, 'rg -e foo .env.sample'],
            [2, "rg -e foo .env.example \"docs'notes\""],
        ] as const) {
            const result = spawnSync('/bin/bash', [guard], {
                input: JSON.stringify({ tool_name: 'Bash', cwd: directory, tool_input: { command } }),
                encoding: 'utf8',
                env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
            });
            assert.equal(result.status, expected, `${command}\n${result.stderr}`);
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('here-string text keeps the conservative refusal', () => {
    assertVerdicts([
        [BLOCK, 'cat <<< .env'],
        [BLOCK, 'read x <<< .env'],
        [ALLOW, 'cat <<< README.md'],
    ]);
});

test('single-alternative shell glob groups retain protected possibilities', () => {
    assertVerdicts([
        [BLOCK, 'cat .(e)nv'],
        [BLOCK, 'cat .e(n)v'],
        [BLOCK, 'cat ~/.ssh/i(d)_rsa'],
        [BLOCK, "zsh -c 'cat .(e)nv'"],
        [BLOCK, 'head .(e)nv'],
        [BLOCK, 'grep -e x .(e)nv'],
        [BLOCK, '(.e)nv'],
        [BLOCK, '.(en)v'],
        [BLOCK, 'cat ~/.ssh/id_(rsa)'],
        [BLOCK, 'cat .ssh/i(d)_r(s)a'],
        [BLOCK, 'grep "$(cat .(e)nv)" a.txt'],
        [BLOCK, 'cat .e^x'],
        [BLOCK, 'cat .e~x'],
        [ALLOW, 'cat ~/README.md'],
        [ALLOW, 'ls .(e)nv'],
    ]);
});

test('shell option changes include zsh and clustered invocation flags', () => {
    assertVerdicts([
        [BLOCK, "zsh -c 'setopt globdots extendedglob; cat ^a.txt'"],
        [BLOCK, 'setopt globdots extendedglob'],
        [BLOCK, 'setopt extended_glob'],
        [BLOCK, 'setopt extendedglob; cat .e#nv'],
        [BLOCK, 'setopt extendedglob; cat .(#i)ENV'],
        [BLOCK, 'unsetopt noglob'],
        [BLOCK, 'emulate zsh -o extendedglob'],
        [BLOCK, 'emulate sh'],
        [BLOCK, 'bash -eO dotglob -c true'],
        [BLOCK, 'bash -eo posix -c true'],
        [BLOCK, 'bash --posix -c true'],
        [BLOCK, "sh --posix -c 'cat x'"],
        [BLOCK, 'bash --rcfile x -c true'],
        [BLOCK, 'bash --init-file x -c true'],
        [BLOCK, 'bash --restricted -c true'],
        [BLOCK, 'bash --dump-strings -c true'],
        [BLOCK, 'bash --unknown -c true'],
        [BLOCK, 'bash -xo extglob -c true'],
        [BLOCK, 'f=-C; set "$f"'],
        [BLOCK, 'f=-o; set "$f" noclobber'],
        [BLOCK, 'set -- "$flags"'],
        [ALLOW, 'bash --norc -c true'],
        [ALLOW, "bash --noprofile --norc -c 'npm test'"],
        [ALLOW, 'bash --login -c true'],
        ...['--noediting', '--verbose', '--version', '--help'].map(option =>
            [ALLOW, `bash ${option} -c true`] as [string, string]),
        [ALLOW, 'bash -- script.sh --posix'],
        [ALLOW, "bash -o pipefail -c 'npm test | tee log'"],
        [ALLOW, "bash -euo pipefail -c 'npm test | tee log'"],
        [ALLOW, "sh -o pipefail -c 'npm test | tee log'"],
        [ALLOW, 'bash -xo pipefail -c true'],
        ...['bash', 'sh', 'zsh'].flatMap(shell => ['-o', '+o'].map(flag =>
            [ALLOW, `${shell} ${flag} nounset -c true`] as [string, string])),
        [ALLOW, 'grep -rn extglob .'],
        [ALLOW, 'grep -rn extglob .cratis'],
        [ALLOW, 'git log --grep extglob'],
    ]);
});

test('search option arity does not exempt a directory operand', () => {
    assertVerdicts([
        [BLOCK, 'grep -r --color foo .kube'],
        [BLOCK, 'grep -r --colour foo run/secrets'],
        [BLOCK, 'grep -r --unknown foo .kube'],
        [BLOCK, 'rg --unknown foo .kube'],
        [BLOCK, 'grep -r --color foo /run/secrets'],
        [ALLOW, 'grep --color foo .env.example'],
        [ALLOW, 'grep --colour foo .env.example'],
    ]);
});

test('empty and adjacent quoted segments end parameter names', () => {
    assertVerdicts([
        [BLOCK, 'f=.e; cat "$f""nv"'],
        [BLOCK, "f=.e; cat $f''nv"],
        [BLOCK, 'f=.e; cat $f""nv'],
        [BLOCK, 'f=id_r; cat ~/.ssh/"$f""sa"'],
        [ALLOW, 'f=READ; cat "$f""ME.md"'],
        [ALLOW, "f=READ; cat $f''ME.md"],
    ]);
});

test('names assembled from fragments take every value the command assigns', () => {
    assertVerdicts([
        [BLOCK, 'x=.e; true | x=ab; cat "${x}nv"'],
        [BLOCK, 'x=.e; x=ab & cat "${x}nv"'],
        [BLOCK, 'x=.e; case b in a) x=ab;; esac; cat "${x}nv"'],
        [BLOCK, 'x=.e; false && unset x; cat "${x}nv"'],
        [BLOCK, 'f=READ; for x in a b; do cat "${f}nv"; f=.e; done'],
        [BLOCK, 'f=.e; (unset f); cat "${f}nv"'],
        [BLOCK, 'f=.e bash -c \'cat "${f}nv"\''],
        [BLOCK, 'set -- .e; cat "$1"nv'],
        [BLOCK, 'x=\'*.p*\'; cat $x'],
        [BLOCK, 'x=\'foo token.json\'; cat $x'],
        [BLOCK, 'zip -0 - .e*'],
        [BLOCK, 'cp -rt /tmp/x .e*'],
        [BLOCK, 'cp --target-directory=/tmp/x token.json'],
        [BLOCK, 'ln -s /other/token.json'],
        [BLOCK, 'bash -O dotglob -c \'cat *.md\''],
        [BLOCK, 'o=-s; shopt $o dotglob'],
        [BLOCK, 'opt=-s; shopt "$opt" nocaseglob; cat .E*'],
        [BLOCK, 'X=.e; git diff --no-index /dev/null "${X}nv"'],
        [ALLOW, 'X=README.md; cat $X'],
        [ALLOW, 'for f in *.md; do wc -l "$f"; done'],
        [ALLOW, 'cat "$dir/README.md"'],
        [ALLOW, 'echo $$; cat /tmp/x.md'],
    ]);
});

test('stems keep their boundaries', () => {
    assertVerdicts([
        [ALLOW, 'printenv HOME'],
        [ALLOW, 'ls environment/'],
        [ALLOW, 'npm run env:check'],
        [ALLOW, 'curl -H "Authorization: Bearer $GITHUB_TOKEN" https://example.org'],
        [ALLOW, 'KUBECONFIG=x.yaml kubectl get pods'],
        [ALLOW, 'cat .dockerignore'],
        [ALLOW, 'ls ????-??.log'],
    ]);
});

test('the guard refuses every call when jq is missing', () => {
    const isolated = pathWithout('jq');
    try {
        const run = (command: string, env: NodeJS.ProcessEnv = {}, input?: string) => spawnSync('/bin/bash', [guard], {
            input: input ?? JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
            encoding: 'utf8',
            env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', PATH: isolated.path, ...env },
        });
        for (const command of ['cat .env', 'git status']) {
            const result = run(command);
            assert.equal(result.status, 2, command);
            assert.match(result.stderr, /jq is not installed/);
            assert.match(result.stderr, /CRATIS_HOOKS_ALLOW_SECRET_READS/);
        }
        assert.equal(run('', {}, '').status, 0, 'empty input still exits 0');
        assert.equal(run('cat .env', { CRATIS_HOOKS_ALLOW_SECRET_READS: '1' }).status, 0, 'the escape hatch still works');
    } finally {
        isolated.dispose();
    }
});
