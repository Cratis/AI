// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const guard = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');
type Row = { command: string; cwd: 'root' | 'sub'; expect: 'block' | 'allow'; why: string };
const rows: Row[] = [];
function add(expect: Row['expect'], commands: string[], why: string, cwd: Row['cwd'] = 'root') {
    rows.push(...commands.map(command => ({ command, cwd, expect, why })));
}
function cross(wrappers: ((command: string) => string)[], cores: string[], expect: Row['expect']) {
    for (const wrapper of wrappers) add(expect, cores.map(wrapper), 'verb-first wrapper scan');
}
const blockCores = ['rm -rf .', 'rm -rf /', 'rm -rf ~', 'mv . /tmp/d', 'rmdir .', 'find . -delete', 'git clean -fdx', 'unlink .', 'shred .', 'rm -rf `pwd`', 'rm -rf "$directory"'];
const allowCores = ['rm -rf node_modules', 'rm -rf Source/Foo/bin', 'find Source/Foo/bin -delete', 'git clean -fdx -- node_modules', 'git clean -ndx', 'dotnet build .', 'ls .', 'echo ready'];
const prefixes = ['', 'env ', 'env -i -u X ', 'nice ', 'nice -n 5 ', 'nohup ', 'timeout 5 ', 'timeout --signal TERM --kill-after 1s 5 ', 'sudo ', 'sudo -u operator -n ', 'sudo --preserve-env=PATH ', 'sudo -E ', 'doas ', 'command ', 'command -p ', 'command -- ', 'exec ', 'exec -a w ', 'time ', 'stdbuf -oL ', 'setsid ', 'setsid -w ', 'ionice ', 'ionice -c3 ', 'FOO=x ', 'builtin ', 'env -i nice -n 1 timeout 5 command -p '];
const wrappers = [...prefixes.map(prefix => (command: string) => prefix + command), (command: string) => `(${command})`, (command: string) => `{ ${command}; }`];
cross(wrappers, blockCores, 'block');
// Main already refuses brace groups (its reference extractor emits a wildcard).
cross(wrappers.slice(0, -1), allowCores, 'allow');
for (const action of ['-exec', '-execdir', '-ok', '-okdir']) {
    cross([(command: string) => `find . ${action} ${command} {} \\;`], blockCores, 'block');
    // Find placeholders inherit the search paths, not the caller's root.
    add('allow', [`find Source/Foo/bin ${action} rm -rf {} +`, `find . ${action} echo rm {} \\;`], 'find executable versus printed arguments');
}
for (const prefix of ['env -C Source ', 'chroot / ', 'nsenter ']) {
    add('block', ['rm -rf .', 'rm -rf /', 'find . -delete', 'git clean -fdx'].map(core => prefix + core), 'uncertain execution directory');
    add('allow', ['dotnet build .', 'ls .', 'echo ready'].map(core => prefix + core), 'uncertainty without destruction');
}
for (const shell of ['sh', 'bash', 'dash', 'zsh', 'ksh']) {
    for (const flags of ['-c', '-lc', '-cl', '-ec', '-ce', '-ic', '-xc', '-l -c', '-c -l', '-o pipefail -c', '-c --', '-c -o pipefail']) {
        add('block', [`${shell} ${flags} 'rm -rf .'`], 'generic shell c cluster');
        add('allow', ['echo ready', 'rm -rf node_modules', 'npm run rm'].map(script => `${shell} ${flags} '${script}'`), 'script scanned as commands, not bare verb text');
    }
}
add('block', [
    'rm -rf ./', 'rm -rf ..', 'rm -rf "$PWD"', 'rm -rf "${PWD}"', 'rm -rf "$PWD/.cratis"', 'rm -rf "${PWD}/.claude/"',
    'rm -rf control-link/', 'rm -rf .cratis/ai/../', 'rm -rf "$HOME"', 'rm -rf "${HOME}"', 'rm -rf $(pwd)', 'rm -rf "$(pwd)"',
    'rm -rf "$OLDPWD"', 'rm -rf ${PWD%/}', 'mv "$OLDPWD" /tmp/d', 'mv -t /tmp/d .', 'mv --target-directory=/tmp/d .',
    'find -delete', 'find node_modules -exec rm -rf / {} +', 'find node_modules -exec rmdir "$OLDPWD" \\;',
    'eval rm -rf .', "find . -exec sh -c 'rm -rf $0' {} \\;", 'xargs rm -rf <<< .', 'echo . | xargs rm -rf',
    'echo . | xargs -I{} rm -rf {}', 'xargs -n 1 sudo rm -rf',
    'sudo -D / rm -rf tmp', 'sudo -R / rm -rf tmp', 'sudo --chdir=/ rm -rf tmp', 'sudo --chroot / rm -rf tmp', 'env --chdir=/ rm -rf tmp',
    'git -C . clean -fdx', 'git -C ../.. clean -fdx', 'git -c a.b=c clean -fdx', 'git -c alias.c=clean c -fdx',
    'git --git-dir=.git clean -fdx', 'git --git-dir .git clean -fdx', 'git --work-tree=. clean -fdx', 'git --work-tree . clean -fdx',
    'git -P -C . clean -fdx', 'git -C Source -C ../. clean -fdx', 'git --unknown-opt value clean -fdx',
    'git clean -fdx :/', "git clean -fdx ':(top)'", "git clean -fdx ':(top)Source/Foo/bin'", "git clean -fdx ':(glob)*'", "git clean -fdx ':(literal)node_modules'",
    'git clean -ffdx', 'git clean -fdx --exclude node_modules', 'git clean -fdx -- .cratis',
    'popd && rm -rf .', '(cd Source; ls); rm -rf .', 'cd "$DIR" && rm -rf .', 'cd - && rm -rf .', 'cd $(pwd) && rm -rf .',
    'echo $(rm -rf .)', 'echo `rm -rf .`', 'echo x > .', 'echo x >| .', 'echo x &> .', 'echo x 2> .',
    "'rm' -rf .", '\\rm -rf .', '/bin/rm -rf .', "sh -c 'rm \"$1\"' _ .",
], 'ancestor, expansion, git, context and redirect regressions');
add('allow', [
    'rm -rf ./Source/Foo/bin/', 'mv Source/Foo/bin /tmp/build-destination', 'rm -rf "$PWD/node_modules"', 'rm -rf "${PWD}/Source/Foo/bin"',
    'rm -rf "$HOME/node_modules"', 'rm -rf ~/node_modules', 'find . -print', 'git status', 'echo "$PWD"',
    'cratis ai init', 'cratis ai update', 'cratis ai restore', 'dotnet format .', 'docker build -t x .', 'npx prettier --write .',
    'yarn eslint --fix .', 'npx eslint .', 'cp README.md .', 'cp src/a.txt ./', 'mv Source/Verification/README.md .',
    'mv -t . Source/Verification/README.md', 'mv --target-directory=. README.md', 'tar -czf /tmp/o.tgz .', 'unzip x.zip -d .',
    'chmod -R u+w .', 'git checkout -- .', 'git restore .', 'find .', 'find . -type f', 'find . -exec echo {} \\;', 'find . -exec ls {} +',
    'rmdir Source/Foo/bin', 'git clean -ndx :/', "git clean -ndx ':(top)'", 'git clean -fdx --exclude -n -- node_modules',
    'cd Source && dotnet build .', 'pushd Source && npx prettier --write .', 'cd node_modules && rm -rf .', 'find . -exec echo rm {} \\;', 'find . -ok echo rm {} \\;',
    'rm -f notes.txt~', 'rm -rf "build (old)"', "rm -f '~'", 'rm -rf "$PWD/build (old)"', 'sudo -u operator dotnet build .',
    'env -i -u X dotnet build .', 'nice -n 1 rm -rf node_modules', 'git -C . clean -fdx -- node_modules', 'git -P clean -fdx -- node_modules',
    'git --work-tree=. clean -fdx -- node_modules', 'git -C Source/Foo clean -fdx', 'git -C . -C Source/Foo clean -fdx', 'echo . | xargs echo rm',
    'bash -c "echo ready"', `sh -c 'echo "$1"' _ 'rm -rf .'`, 'sh script.sh rm -rf .', 'setsid npm run rm -- .', 'git -c alias.c=clean status', 'eval echo ready', '(dotnet build .)', 'cp x .', 'mv f .', 'docker build .',
    'sudo --preserve-env=PATH dotnet build .', 'git -C "$DIR" status', "find . -exec sh -c 'echo \"$0\"' {} \\;",
    'gh api user -q .login', "gh api repos/x/y -q '.[] | .name'", "gh pr list --json title -q '.[].title'",
    // Main's Pi secrets guard already refuses xargs -J and env -S; outside this advisory.
    'echo rm -rf .', 'grep -r "rm -rf ." docs', 'cmd > "$out"', 'echo x > /dev/null', 'rm -rf "$TMPDIR/build"', '(cd Source && ls); ls',
    'echo x >> .', 'echo ready | cat',
    // Known limitation: expansion-produced verbs are not recognized; this is not a sandbox.
    'r=rm; $r -rf .',
], 'base allows and R1/R2/R3 non-destructive regressions');
add('block', ['git clean -fdx :/', "git clean -fdx ':(top)'", 'nice git clean -fdx :/', 'rm -rf ../..'], 'subdirectory ancestor', 'sub');
add('allow', ['rm -rf .'], 'unprotected subdirectory', 'sub');

function scratchRepository() {
    const root = mkdtempSync(join(tmpdir(), 'cratis-destructive-'));
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    for (const directory of ['.cratis/ai/hooks', '.claude/managed', '.pi/extensions', 'Source/Foo/bin', 'node_modules']) mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, '.cratis/ai.manifest.json'), JSON.stringify({ Integrations: [{ Path: '.claude/managed', IsDirectory: true }] }));
    writeFileSync(join(root, '.mcp.json'), '{}');
    symlinkSync('.cratis', join(root, 'control-link'));
    return root;
}
function shellVerdict(command: string, cwd: string, override = '0') {
    const result = spawnSync('/bin/bash', [guard], {
        cwd, input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
        env: { ...process.env, HOME: tmpdir(), CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: override },
    });
    assert.ok(result.status === 0 || result.status === 2, result.stderr);
    assert.equal(result.stdout, '', command);
    return result;
}
function restoreVariable(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

test('destructive operands protect controls without executing any command (direct and Pi)', async context => {
    const root = scratchRepository();
    const saved = process.env.CRATIS_HOOKS_ALLOW_PROTECTED_WRITES;
    const savedHome = process.env.HOME;
    process.env.CRATIS_HOOKS_ALLOW_PROTECTED_WRITES = '0';
    process.env.HOME = tmpdir();
    const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
    registerCratisHooks({ on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(name, handler), registerTool: () => {} } as unknown as ExtensionAPI);
    const call = handlers.get('tool_call');
    assert.ok(call);
    const dynamicRows: Row[] = [
        ...[root, `${root}/`, `~/${basename(root)}`].map(path => ({ command: `rm -rf ${path}`, cwd: 'root' as const, expect: 'block' as const, why: 'absolute ancestor' })),
        ...['cd', 'pushd'].map(verb => ({ command: `${verb} / && rm -rf '${relative('/', root)}'`, cwd: 'root' as const, expect: 'block' as const, why: 'tracked cwd' })),
    ];
    const all = [...rows, ...dynamicRows];
    try {
        for (const row of all) {
            await context.test(`${row.expect} [${row.cwd}] ${row.command}`, async () => {
                const cwd = row.cwd === 'sub' ? join(root, 'Source/Foo') : root;
                for (const command of [row.command, `echo ok; ${row.command}; echo ok`]) {
                    const direct = shellVerdict(command, cwd);
                    assert.equal(direct.status, row.expect === 'block' ? 2 : 0, `${row.why}: ${command}\n${direct.stderr}`);
                    const pi = await call({ toolName: 'bash', input: { command } }, { cwd }) as { block?: boolean; reason?: string } | undefined;
                    if (row.expect === 'allow') assert.equal(pi, undefined, `${command}: ${pi?.reason}`);
                    else {
                        assert.equal(pi?.block, true, command);
                        assert.match(pi?.reason ?? '', /BLOCKED by cratis-guard-shell-writes/, command);
                    }
                }
            });
        }
        assert.equal(shellVerdict('rm -rf .', root, '1').status, 0);
        for (const file of ['.mcp.json', '.cratis/ai.manifest.json', '.cratis/ai/hooks']) assert.ok(existsSync(join(root, file)), file);
        context.diagnostic(`${all.filter(row => row.expect === 'block').length} block / ${all.filter(row => row.expect === 'allow').length} allow rows, each direct + Pi and prefixed/suffixed; commands only passed as JSON`);
    } finally {
        restoreVariable('HOME', savedHome);
        restoreVariable('CRATIS_HOOKS_ALLOW_PROTECTED_WRITES', saved);
        rmSync(root, { recursive: true, force: true });
    }
});
