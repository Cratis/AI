// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
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
    'git -P -C . clean -fdx', 'git -C Source -C ../. clean -fdx',
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
// R1 B2: option values containing n are not dry-run flags.
add('block', ['git clean -fdx -enode_modules', 'git clean -fdxe -n', 'git clean -fdxenode_modules', 'git clean -fdxe --dry-run'], 'exclude consumes its attached or next value');
add('allow', ['git clean -fdxn -enode_modules', 'git clean -fdxne node_modules', 'git clean -fdx -e node_modules -n'], 'genuine dry-run before/after excludes');
// R1 B3: tilde expansion applies only to unquoted operands, including cwd transitions.
add('block', ['rm -rf ~+', 'rm -rf ~+/', 'rm -rf ~+"/"', 'rm -rf ~-', 'rm -rf ~-/', 'rm -rf ~operator', 'cd ~+ && rm -rf .cratis/..', 'cd ~- && rm -rf .'], 'tilde cwd or unresolved home');
add('allow', ["rm -rf '~+'", "rm -rf '~-/'", 'rm -rf \\~+', 'rm -rf ~+/node_modules', 'cd ~+ && rm -rf node_modules', 'cd ~- && dotnet build .'], 'quoted tilde and safe/non-destructive targets');
// R1 B6/B7/B11 and A1/A4: only established prefixes expose command positions.
add('allow', [
    'du -sh /bin/rm .', 'realpath /bin/rm .', './scripts/cli.sh rm "$id"', 'node build.js mv "$a" b',
    'node tool.js rm .', 'pnpm rm "$pkg"', 'podman rm -f $(podman ps -aq)', 'unknown-program rm -rf .',
    'ssh host rm -rf .', 'kubectl exec pod -- rm -rf /', 'sudo node tool.js rm .',
    'git --no-optional-locks log --grep clean', 'git --no-optional-locks log', 'git --unknown-opt value clean -fdx',
], 'unknown program arguments and established non-clean git subcommands are data');
add('block', ['sudo rm -rf .', 'busybox rm -rf .', 'git --no-optional-locks clean -fdx', 'unknown-program "$(rm -rf .)"'], 'known execution prefixes and calling-shell substitutions still execute');
// R1 B8: every destructive xargs execution has unresolved stdin operands, regardless of literals.
add('block', [
    'echo . | xargs -I X rm -rf X', 'echo . | xargs -I% rm -rf %', 'echo . | xargs -IQ rm -rf Q',
    'echo . | xargs --replace=Z rm -rf Z', 'find . -maxdepth 0 | xargs -I@ rm -rf @', 'xargs -J % rm -rf % <<< .',
    "printf '. ' | xargs rm -rf node_modules", 'xargs -I X sudo rm -rf X', 'xargs sh -c "rm -rf node_modules"',
    'xargs git clean -fdx -- node_modules', 'xargs find node_modules -delete',
], 'xargs replacements and appended stdin targets are never safe literals');
add('allow', ['echo . | xargs -I X echo rm -rf X', 'xargs echo rm -rf .', 'xargs git clean -ndx', 'xargs unknown-program rm .'], 'xargs without discovered destruction stays lenient');
// R1 B9: shell options consume values without confusing them with the script.
// The extra combined -cO spelling is already refused by Pi's independent secrets guard.
for (const flags of ['-c -O extglob', '-c +O extglob', '-c +o pipefail', '--noprofile -c -O extglob']) {
    add('block', [`bash ${flags} 'rm -rf .'`], 'shell option argument before actual script');
    add('allow', [`bash ${flags} 'echo rm -rf .'`, `bash ${flags} 'rm -rf node_modules'`], 'shell option argument does not turn data into a command');
}
// R1 B1/B5/B11: comments and heredoc bodies are data, not top-level commands.
add('allow', [
    '# rm -rf .\ngit status', '# rm -rf .\nls', 'echo ready # rm -rf .',
    "cat > cleanup.sh <<'EOF'\n#!/bin/sh\nrm -rf \"$BUILD_DIR\"\nEOF",
    'cat > README.md <<EOF\nUse it like this: mv "$src" dest\nEOF',
    `git commit -m "$(cat <<'EOF'\nFix rm -rf . handling\nEOF\n)"`,
    "git commit -F - <<'EOF'\nrm -rf .\nEOF",
    `gh pr create --body "$(cat <<'EOF'\nFix rm -rf . handling\nEOF\n)"`,
    "cat > notes.md <<'EOF'\nWe do not mv . anywhere\nEOF", 'cat <<EOF\nmv . x\nEOF',
    "cat <<'EOF'\n$(rm -rf .)\nEOF", "cat <<\\EOF\n$(rm -rf .)\nEOF",
    "cat <<-'EOF'\n\trm -rf .\n\tEOF", "cat <<A <<'B'\nrm -rf .\nA\nrm -rf .\nB",
    "cat <<EOF\n$(echo 'rm -rf .')\nEOF", `echo "$(cat <<'EOF'\n) rm -rf .\nEOF\n)"`,
], 'quoted/unquoted heredoc data, comments and delimiters inside substitutions');
add('block', ['# harmless comment\nrm -rf .', 'cat <<EOF\n$(rm -rf .)\nEOF'], 'actual commands and unquoted heredoc substitutions still execute');
// R1 B4/B10: literal shell stdin is executable only when a shell consumes it.
add('block', [
    `bash <<< 'rm -rf .'`, `echo 'rm -rf .' | bash`, `echo 'rm -rf .' | sh -s`,
    `printf '%s\\n' 'rm -rf .' | bash`, `cat <<< 'rm -rf .' | sh`,
    "bash -s <<'EOF'\nrm -rf .\nEOF", "cat <<'EOF' | bash\nrm -rf .\nEOF",
    'bash <<A <<B\necho ready\nA\nrm -rf .\nB',
], 'literal here-strings, heredocs and reader-to-shell pipelines');
add('allow', [
    `cat <<< 'rm -rf .'`, `echo 'rm -rf .' | cat`, `printf '%s\\n' 'rm -rf .' | cat`,
    `bash <<< 'echo rm -rf .'`, `echo 'rm -rf node_modules' | sh -s`,
    `bash script.sh <<< 'rm -rf .'`, `echo 'rm -rf .' | bash script.sh`,
    `echo 'rm -rf .' | cat README.md | bash`, 'bash script.sh',
    "cat <<'EOF' | bash\necho rm -rf .\nEOF",
], 'reader data and opaque script files are not executed as shell stdin');
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
function shellVerdict(command: string, cwd: string, override = '0', signal?: AbortSignal): Promise<{ status: number | null; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn('/bin/bash', [guard], {
            cwd, signal, timeout: 20000,
            env: { ...process.env, HOME: tmpdir(), CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: override },
        });
        let stderr = '';
        let stdout = '';
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
        child.on('error', reject);
        child.on('close', status => {
            try {
                assert.ok(status === 0 || status === 2, stderr);
                assert.equal(stdout, '', command);
                resolve({ status, stderr });
            } catch (error) { reject(error); }
        });
        child.stdin.on('error', reject);
        child.stdin.end(JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }));
    });
}
function restoreVariable(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

test('destructive operands protect controls without executing any command (direct and Pi)', { concurrency: 2 }, async context => {
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
        await Promise.all(all.map(row =>
            context.test(`${row.expect} [${row.cwd}] ${row.command}`, { timeout: 60000 }, async scenario => {
                const cwd = row.cwd === 'sub' ? join(root, 'Source/Foo') : root;
                for (const command of [row.command, `echo ok;\n${row.command}\necho ok`]) {
                    const direct = await shellVerdict(command, cwd, '0', scenario.signal);
                    assert.equal(direct.status, row.expect === 'block' ? 2 : 0, `${row.why}: ${command}\n${direct.stderr}`);
                    const pi = await call({ toolName: 'bash', input: { command } }, { cwd }) as { block?: boolean; reason?: string } | undefined;
                    if (row.expect === 'allow') assert.equal(pi, undefined, `${command}: ${pi?.reason}`);
                    else {
                        assert.equal(pi?.block, true, command);
                        assert.match(pi?.reason ?? '', /BLOCKED by cratis-guard-shell-writes/, command);
                    }
                }
            })
        ));
        assert.equal((await shellVerdict('rm -rf .', root, '1', context.signal)).status, 0);
        for (const file of ['.mcp.json', '.cratis/ai.manifest.json', '.cratis/ai/hooks']) assert.ok(existsSync(join(root, file)), file);
        context.diagnostic(`${all.filter(row => row.expect === 'block').length} block / ${all.filter(row => row.expect === 'allow').length} allow rows, each direct + Pi and prefixed/suffixed; commands only passed as JSON`);
    } finally {
        restoreVariable('HOME', savedHome);
        restoreVariable('CRATIS_HOOKS_ALLOW_PROTECTED_WRITES', saved);
        rmSync(root, { recursive: true, force: true });
    }
});

test('large command-like comment data completes without executing or recursively inspecting it', { timeout: 5000 }, async context => {
    const root = scratchRepository();
    try {
        const command = `echo ready # ${'xargs -I{} sh -c "rm -rf ."; '.repeat(1024)}`;
        const start = performance.now();
        const verdict = await shellVerdict(command, root, '0', context.signal);
        const elapsed = performance.now() - start;
        assert.equal(verdict.status, 0, verdict.stderr);
        assert.ok(elapsed < 2000, `guard took ${elapsed.toFixed(1)} ms for ${command.length} bytes`);
        context.diagnostic(`${command.length} bytes in ${elapsed.toFixed(1)} ms; two-second wall bound includes process startup`);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
