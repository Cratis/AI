// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import * as filesystem from 'node:fs';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const guard = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');
type Row = { command: string; cwd: 'root' | 'sub'; expect: 'block' | 'allow'; why: string; piGuard?: 'secrets'; standaloneOnly?: boolean };
const rows: Row[] = [];
function add(expect: Row['expect'], commands: string[], why: string, cwd: Row['cwd'] = 'root', piGuard?: Row['piGuard'], options: Pick<Row, 'standaloneOnly'> = {}) {
    rows.push(...commands.map(command => ({ command, cwd, expect, why, piGuard, ...options })));
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
    'rm -rf ./Source/Foo/bin/', 'mv Source/Foo/bin /tmp/build-destination', 'find . -print', 'git status', 'echo "$PWD"',
    'cratis ai init', 'cratis ai update', 'cratis ai restore', 'dotnet format .', 'docker build -t x .', 'npx prettier --write .',
    'yarn eslint --fix .', 'npx eslint .', 'cp README.md .', 'cp src/a.txt ./', 'mv Source/Verification/README.md .',
    'mv -t . Source/Verification/README.md', 'mv --target-directory=. README.md', 'tar -czf /tmp/o.tgz .',
    'chmod -R u+w .', 'find .', 'find . -type f', 'find . -exec echo {} \\;', 'find . -exec ls {} +',
    'rmdir Source/Foo/bin', 'git clean -ndx :/', "git clean -ndx ':(top)'", 'git clean -fdx --exclude -n -- node_modules',
    'cd Source && dotnet build .', 'pushd Source && npx prettier --write .', 'cd node_modules && rm -rf .', 'find . -exec echo rm {} \\;', 'find . -ok echo rm {} \\;',
    'rm -f notes.txt~', 'rm -rf "build (old)"', "rm -f '~'", 'sudo -u operator dotnet build .',
    'env -i -u X dotnet build .', 'nice -n 1 rm -rf node_modules', 'git -C . clean -fdx -- node_modules', 'git -P clean -fdx -- node_modules',
    'git --work-tree=. clean -fdx -- node_modules', 'git -C Source/Foo clean -fdx', 'git -C . -C Source/Foo clean -fdx', 'echo . | xargs echo rm',
    'bash -c "echo ready"', `sh -c 'echo "$1"' _ 'rm -rf .'`, 'sh script.sh rm -rf .', 'setsid npm run rm -- .', 'git -c alias.c=clean status', 'eval echo ready', '(dotnet build .)', 'cp x .', 'mv f .', 'docker build .',
    'sudo --preserve-env=PATH dotnet build .', 'git -C "$DIR" status', "find . -exec sh -c 'echo \"$0\"' {} \\;",
    'gh api user -q .login', "gh api repos/x/y -q '.[] | .name'", "gh pr list --json title -q '.[].title'",
    // Main's Pi secrets guard already refuses xargs -J and env -S; outside this advisory.
    'echo rm -rf .', 'grep -r "rm -rf ." docs', 'cmd > "$out"', 'echo x > /dev/null', '(cd Source && ls); ls',
    'echo x >> .', 'echo ready | cat',
    // Known limitation: expansion-produced verbs are not recognized; this is not a sandbox.
    'r=rm; $r -rf .',
], 'base allows and R1/R2/R3 non-destructive regressions');
// R1 B2: option values containing n are not dry-run flags.
add('block', ['git clean -fdx -enode_modules', 'git clean -fdxe -n', 'git clean -fdxenode_modules', 'git clean -fdxe --dry-run'], 'exclude consumes its attached or next value');
add('allow', ['git clean -fdxn -enode_modules', 'git clean -fdxne node_modules', 'git clean -fdx -e node_modules -n'], 'genuine dry-run before/after excludes');
// R1 B3: tilde expansion applies only to unquoted operands, including cwd transitions.
add('block', ['rm -rf ~+', 'rm -rf ~+/', 'rm -rf ~+"/"', 'rm -rf ~-', 'rm -rf ~-/', 'rm -rf ~operator', 'cd ~+ && rm -rf .cratis/..', 'cd ~- && rm -rf .'], 'tilde cwd or unresolved home');
add('allow', ["rm -rf '~+'", "rm -rf '~-/'", 'rm -rf \\~+', 'cd ~- && dotnet build .'], 'quoted tilde and safe/non-destructive targets');
// Expansion allowances require standalone tool input; automatic echo wrappers must fail closed.
add('allow', [
    'rm -rf "$PWD/node_modules"', 'rm -rf "${PWD}/Source/Foo/bin"', 'rm -rf "$HOME/node_modules"', 'rm -rf ~/node_modules',
    'rm -rf "$PWD/build (old)"', 'rm -rf "$TMPDIR/build"', 'rm -rf ~+/node_modules', 'cd ~+ && rm -rf node_modules',
], 'standalone expansion allowances', 'root', undefined, { standaloneOnly: true });
// R1 B6/B7/B11 and A1/A4: only established prefixes expose command positions.
add('allow', [
    'du -sh /bin/rm .', 'realpath /bin/rm .', './scripts/cli.sh rm "$id"', 'node build.js mv "$a" b',
    'node tool.js rm .', 'pnpm rm "$pkg"', 'podman rm -f $(podman ps -aq)', 'unknown-program rm -rf .',
    'ssh host rm -rf .', 'kubectl exec pod -- rm -rf /', 'sudo node tool.js rm .',
    'git --no-optional-locks log --grep clean', 'git --no-optional-locks log',
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
// R2: uncertainty never silently hides executable text; known data stays opaque.
add('block', [
    '(( x = 1 << 2 ))\nrm -rf .', 'x=$[1<<2]\nrm -rf .', 'for (( i=1<<2; i<8; i++ )); do echo ready; done\nrm -rf .',
    'echo $((1<<2))\nrm -rf .', 'echo "$( (( x=1<<2 )); rm -rf . )"',
    '(( 1 << 2\nrm -rf .', 'x=$[1<<2\nrm -rf .', 'echo $((1 + $(rm -rf .)))',
    'cat <<EOF\nrm -rf .', "cat <<'EOF\nrm -rf .", 'cat << # missing delimiter\nrm -rf .',
    'sudo --future-setting value rm -rf .',
    'git --unknown-opt value clean -fdx', 'git --unknown-opt=setting clean -fdx',
], 'arithmetic, malformed heredoc and option-shape uncertainty');
add('allow', [
    '(( x = 1 << 2 ))', 'x=$[1<<2]', 'echo $((1<<2))', 'for (( i=1<<2; i<8; i++ )); do echo ready; done',
    'echo "$( (( x=1<<2 )); echo ready )"', '(( 1 << 2', 'x=$[1<<2',
    'cat <<EOF\necho ready', "cat <<'EOF\necho ready", 'cat << # missing delimiter\necho ready',
    'sudo --future-setting value dotnet build .',
    'git --unknown-opt value status', 'git log --grep clean',
    "cat <<''\nrm -rf .\n\n", "unknown-program '(( 1<<2 ))\nrm -rf .'",
], 'benign uncertainty, arithmetic, terminated data and established subcommands');
// These spellings are independently refused by Pi's secrets guard; still assert the write verdict too.
add('block', ['bash --future-setting value -c "rm -rf ."'], 'unknown shell option shape', 'root', 'secrets');
add('allow', ['bash --future-setting value -c "echo ready"'], 'benign unknown shell option shape', 'root', 'secrets');
for (const [option, value] of [
    ['--attr-source', 'HEAD'], ['--super-prefix', 'prefix/'], ['--config-env', 'key=VALUE_SOURCE'],
    ['--git-dir', '.git'], ['--work-tree', '.'], ['--namespace', 'space'], ['--shallow-file', '/tmp/shallow'],
]) {
    add('block', [`git ${option} ${value} clean -fdx`], 'all separated Git global value options');
    add('allow', [`git ${option} ${value} log --grep clean`, `git ${option} ${value} clean -fdx -- node_modules`], 'Git global value and established subcommand remain separate');
    if (option !== '--shallow-file') add('block', [`git ${option}=${value} clean -fdx`], 'attached Git global value options');
}
for (const option of ['--no-advice', '--no-lazy-fetch', '--no-replace-objects', '--literal-pathspecs', '--no-literal-pathspecs', '--glob-pathspecs', '--noglob-pathspecs', '--icase-pathspecs']) {
    add('block', [`git ${option} clean -fdx`], 'Git global no-value options do not consume clean');
    add('allow', [`git ${option} log --grep clean`], 'Git read subcommands keep their arguments as data');
}
add('allow', ['git --exec-path clean -fdx', 'git --html-path clean', 'git --list-cmds=main clean', 'git --help clean', 'git --version clean'], 'Git query options terminate without executing clean');
function quoteScript(script: string) { return `'${script.replaceAll("'", "'\\''")}'`; }
function nestedShell(script: string) { return Array.from({ length: 5 }).reduce<string>(value => `sh -c ${quoteScript(value)}`, script); }
for (const command of ['rm -rf .', 'git clean -fdx', 'find . -delete']) {
    add('block', ['eval '.repeat(5) + command, nestedShell(command)], 'depth-limit fallback for each destructive family');
}
add('allow', [
    'eval '.repeat(9) + 'echo ready', nestedShell('echo ready'),
    nestedShell("cat <<'EOF'\nrm -rf .\nEOF"),
], 'deep benign execution and properly terminated heredoc data');
add('block', [nestedShell("bash <<'EOF'\nrm -rf .\nEOF")], 'depth fallback still sees executable shell stdin');
for (const selector of ['-', '/dev/stdin', '/dev/fd/0', '/proc/self/fd/0']) {
    add('block', [`echo 'rm -rf .' | bash ${selector}`, `bash ${selector} <<< 'rm -rf .'`], 'explicit stdin script selectors');
    add('allow', [`echo 'echo rm -rf .' | bash ${selector}`, `bash ${selector} <<< 'echo ready'`], 'stdin script selectors with non-destructive commands');
}
for (const prefix of ['env -S ', 'env --split-string ', 'env -S', 'env --split-string=', 'env -iS']) {
    add('block', [`${prefix}'rm -rf .'`], 'env split string executes its value', 'root', 'secrets');
    add('block', [`${prefix}'sh -c' 'rm -rf .'`], 'env split string executes remaining argv');
    add('allow', [`${prefix}'echo rm -rf .'`, `${prefix}'rm -rf node_modules'`], 'env split-string data and unprotected operands', 'root', 'secrets');
}
add('block', [
    `echo 'rm -rf .' 2>/dev/null | sh`, `echo 'rm -rf .' 2>&1 | sh`, `echo 'rm -rf .' 1>&1 | sh`,
    `echo 'rm -rf .' 3>&1 >/dev/null 1>&3 | sh`, `echo 'rm -rf .' >&$FD | sh`,
    `bash -n +n -c 'rm -rf .'`, `bash -in -c 'rm -rf .'`,
    `bash -n -c "$(rm -rf .)"`,
], 'stdout still reaches pipe, effective execution toggles and calling-shell substitutions');
add('allow', [
    `echo 'rm -rf .' >/dev/null | sh`, `echo 'rm -rf .' 1>/dev/null | sh`, `echo 'rm -rf .' >>/dev/null | sh`,
    `printf '%s\\n' 'rm -rf .' >/dev/null | sh`, `echo 'rm -rf .' &>/dev/null | sh`, `echo 'rm -rf .' >&2 | sh`,
    `echo 'rm -rf .' >/dev/null 2>&1 | sh`, "cat <<'EOF' >/dev/null | bash\nrm -rf .\nEOF",
    `echo 'rm -rf .' | sh -n`, `bash -n <<< 'rm -rf .'`, `bash -n -c 'rm -rf .'`,
    `bash +n -n -c 'rm -rf .'`, `bash -n -c 'echo ready'`,
], 'redirected stdout and syntax-only shells do not execute literal data');
add('block', [
    `bash -o noexec +o noexec -c 'rm -rf .'`, `bash -oc pipefail 'rm -rf .'`, `bash -cO extglob 'rm -rf .'`,
], 'shell option values and effective execution toggles', 'root', 'secrets');
add('allow', [
    `bash -o noexec -c 'rm -rf .'`, `bash -n -c 'set +n; rm -rf .'`, `echo 'rm -rf .' | bash -o noexec`,
], 'syntax-only shell option contexts', 'root', 'secrets');
add('block', ['git clean -fdx :/', "git clean -fdx ':(top)'", 'nice git clean -fdx :/', 'rm -rf ../..'], 'subdirectory ancestor', 'sub');
add('allow', ['rm -rf .'], 'unprotected subdirectory', 'sub');

add('block', ['unzip x.zip -d .', 'git checkout -- .', 'git restore .'], 'explicit working-tree scope');

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
                for (const wrapped of [false, true]) {
                    const command = wrapped ? `echo ok;\n${row.command}\necho ok` : row.command;
                    const expectBlock = row.expect === 'block' || (wrapped && row.standaloneOnly === true);
                    const direct = await shellVerdict(command, cwd, '0', scenario.signal);
                    assert.equal(direct.status, expectBlock ? 2 : 0, `${row.why}: ${command}\n${direct.stderr}`);
                    const pi = await call({ toolName: 'bash', input: { command } }, { cwd }) as { block?: boolean; reason?: string } | undefined;
                    if (row.piGuard === 'secrets') {
                        assert.equal(pi?.block, true, command);
                        assert.match(pi?.reason ?? '', /BLOCKED by cratis-guard-secrets/, command);
                    } else if (!expectBlock) assert.equal(pi, undefined, `${command}: ${pi?.reason}`);
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

test('shell option values and read-only glob operands stay data (other guard contexts independent)', { concurrency: 2 }, async context => {
    const root = scratchRepository();
    try {
        const commands = [
            `bash -oc pipefail 'echo rm -rf .'`, `bash -cO extglob 'echo rm -rf .'`,
            `bash -Oc extglob 'rm -rf node_modules'`, `bash -oOc noexec extglob 'rm -rf .'`,
            `bash -oOc pipefail extglob 'echo rm -rf .'`,
            "find . -name 'X*'", 'ls -d */', "find . -name '*.workflow.jsonl'",
        ];
        await Promise.all(commands.map(command => context.test(command, { timeout: 60000 }, async scenario => {
            const verdict = await shellVerdict(command, root, '0', scenario.signal);
            assert.equal(verdict.status, 0, verdict.stderr);
        })));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('all wrapper dispatches preserve stdin and redirections (direct guard)', { concurrency: 2 }, async context => {
    const root = scratchRepository();
    const commands = [
        ...prefixes.map(prefix => `${prefix}bash -`),
        'chroot / bash -', 'nsenter bash -', 'busybox bash -', 'xargs bash -',
        `env -S 'bash -'`, `env --split-string='bash -'`, `env -S 'nice bash -'`,
        `sudo env -S 'nice timeout 5 bash -'`, `nice env -S 'bash -'`,
    ];
    const forms = [
        (command: string, data: string) => `${command} <<< '${data}'`,
        (command: string, data: string) => `echo '${data}' | ${command}`,
        (command: string, data: string) => `${command} <<'EOF'\n${data}\nEOF`,
        (command: string, data: string) => `echo '${data}' | ${command} < /dev/stdin`,
        (command: string, data: string) => `${command} 0<<< '${data}'`,
    ];
    const cases = commands.flatMap(command => forms.flatMap(form => [
        { command: form(command, 'rm -rf .'), status: 2 },
        { command: form(command, 'echo hi'), status: 0 },
    ]));
    cases.push(
        ...[
            `echo 'rm -rf .' |& bash`, `echo 'rm -rf .' 1>&2 |& bash`,
            `echo 'rm -rf .' |& env -S 'nice bash -'`,
            `env -S 'echo rm -rf .' | bash`, `env -S 'cat' <<< 'rm -rf .' | bash`,
            `<<< 'rm -rf .' env -S 'bash -'`,
            `echo 'rm -rf .' | env -S 'bash -' 0<&0`,
            `env -S 'bash -' < /dev/null <<< 'rm -rf .'`,
            `env -S 'bash -c "rm -rf ."'`, `env -S 'rm ";" -rf .'`, `env -S 'rm + -rf .'`,
        ].map(command => ({ command, status: 2 })),
        ...[
            `echo hi |& bash`, `echo hi |& env -S 'bash -'`, `env -S 'ls -la'`,
            `env -S 'echo hello; rm -rf .'`, `env -S 'echo hello | rm -rf .'`,
            `env -S 'echo hi' | bash`, `env -S 'cat' <<< 'echo hi' | bash`,
            `echo 'rm -rf .' | env -S 'bash -' < /dev/null`,
            `env -S 'bash -' <<< 'rm -rf .' < /dev/null`,
            `env -S 'bash -' 3<<< 'rm -rf .'`,
            `env -S 'echo rm -rf .' >/dev/null | bash`,
            `echo 'rm -rf .' | env -S 'bash -' 0<&-`,
            `env -S 'bash -c "echo hi"'`, `env -S 'echo "rm -rf ."'`,
        ].map(command => ({ command, status: 0 })),
    );
    try {
        await Promise.all(cases.map(({ command, status }) => context.test(command, { timeout: 60000 }, async scenario => {
            const verdict = await shellVerdict(command, root, '0', scenario.signal);
            assert.equal(verdict.status, status, `${command}\n${verdict.stderr}`);
        })));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('bulk working-tree effects use destination scope and existing environment entries', { concurrency: 2 }, async context => {
    const root = scratchRepository();
    mkdirSync(join(root, 'output/nested'), { recursive: true });
    mkdirSync(join(root, 'clean/nested'), { recursive: true });
    writeFileSync(join(root, 'output/nested/.ENV.local'), 'fixture');
    symlinkSync(root, join(root, 'root-link'));
    const cases: Array<[number, string]> = [
        ...[
            'tar xf bundle.tar', 'tar -xzf bundle.tgz -C .', 'tar --extract --file=bundle.tar --directory=./',
            'tar -x -f bundle.tar -C sub/..', `tar xf bundle.tar -C '${root}'`, 'tar xf bundle.tar -C root-link',
            'tar xf bundle.tar -C ..', 'cd clean && tar xf ../bundle.tar -C ..',
            'unzip bundle.zip', 'unzip -o bundle.zip -d .', 'unzip bundle.zip -droot-link',
            'rsync -a --delete src/ .', 'rsync -a --delete-after src/ ./',
            'git restore .', 'git restore --source=HEAD --worktree .', 'git checkout -- .', 'git checkout HEAD -- ./',
            'git checkout -f main', 'git checkout --merge main', 'git switch --discard-changes main',
            'git stash apply', 'git stash pop stash@{0}', 'git reset --hard HEAD',
            'git -C clean restore ..', 'git -C clean reset --hard', 'cd clean && git stash pop',
            'rm -rf output', 'mv output elsewhere', 'find output -delete',
            'rsync -a --delete src/ output/', 'tar xf bundle.tar -C output', 'unzip bundle.zip -d output',
            'tar xf bundle.tar -C "$DIR"', 'git restore "$DIR"',
        ].map(command => [2, command] as [number, string]),
        ...[
            'tar tf bundle.tar', 'tar -czf bundle.tgz .', 'tar xf bundle.tar -C clean', 'unzip bundle.zip -d clean',
            'unzip -l bundle.zip', 'unzip -p bundle.zip', 'unzip -t bundle.zip', 'unzip -Z bundle.zip',
            'rsync -a --delete src/ clean/', 'git status', 'git diff', 'git log -1', 'git stash list', 'git stash show',
            'git restore --staged .', 'git restore --staged --source=HEAD .', 'git restore clean', 'git checkout HEAD -- clean',
            'git checkout main', 'git checkout -b topic', 'git switch main', 'git switch -c topic',
            'git reset --soft HEAD', 'git reset --mixed HEAD', 'rm -rf clean', 'find clean -delete',
            'mv clean elsewhere', 'echo "tar xf bundle.tar; git restore ."',
            "cat <<'EOF'\ntar xf bundle.tar\ngit restore .\nEOF",
        ].map(command => [0, command] as [number, string]),
    ];
    try {
        await Promise.all(cases.map(([expected, command]) => context.test(command, async scenario => {
            const result = await shellVerdict(command, root, '0', scenario.signal);
            assert.equal(result.status, expected, result.stderr);
        })));
        assert.ok(existsSync(join(root, 'output/nested/.ENV.local')));
    } finally { rmSync(root, { recursive: true, force: true }); }
});

const descendants = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-writes-descendants.mjs');
const environmentPatterns = ['.env', '.env.*', '*.env'];

test('metadata scanner reports clean, matching, uncertain and bounded outcomes without following nested links', async () => {
    const { inspectDescendants } = await import(pathToFileURL(descendants).href);
    const root = scratchRepository();
    try {
        const clean = join(root, 'clean');
        mkdirSync(join(clean, 'nested'), { recursive: true });
        writeFileSync(join(clean, 'nested/a.txt'), 'fixture');
        symlinkSync('..', join(clean, 'nested/cycle'));
        assert.equal(inspectDescendants([clean, clean, join(clean, 'nested'), join(root, 'missing')], environmentPatterns), 0);
        assert.equal(inspectDescendants([clean], environmentPatterns, { maxEntries: 1 }), 2);
        let time = 0;
        assert.equal(inspectDescendants([clean], environmentPatterns, { now: () => time++, maxMs: 1 }), 2);
        for (const code of ['EACCES', 'ENOENT']) {
            const fs = { ...filesystem, readdirSync: () => { throw Object.assign(new Error('fixture'), { code }); } };
            assert.equal(inspectDescendants([clean], environmentPatterns, { fs }), 2, code);
        }
        const changed = { ...filesystem, lstatSync: () => ({ ...filesystem.lstatSync(clean), isDirectory: () => false }) };
        assert.equal(inspectDescendants([clean], environmentPatterns, { fs: changed }), 2);
        mkdirSync(join(clean, 'nested/.ENV'));
        assert.equal(inspectDescendants([clean], environmentPatterns), 1);
        const result = spawnSync(process.execPath, [descendants, '3', ...environmentPatterns, clean], { encoding: 'utf8' });
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.equal(result.stderr, '');
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a clean dependency-shaped tree completes inventory within the production budget', async context => {
    const { inspectDescendants } = await import(pathToFileURL(descendants).href);
    const root = scratchRepository();
    try {
        const directory = join(root, 'node_modules');
        for (let packageIndex = 0; packageIndex < 128; packageIndex++) {
            const packagePath = join(directory, `package-${packageIndex}`);
            mkdirSync(packagePath, { recursive: true });
            for (let fileIndex = 0; fileIndex < 32; fileIndex++) writeFileSync(join(packagePath, `file-${fileIndex}.js`), 'fixture');
        }
        const start = performance.now();
        assert.equal(inspectDescendants([directory], environmentPatterns), 0);
        context.diagnostic(`4224 clean dependency entries in ${(performance.now() - start).toFixed(1)}ms`);
    } finally { rmSync(root, { recursive: true, force: true }); }
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
