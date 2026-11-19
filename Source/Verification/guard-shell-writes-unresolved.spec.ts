// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import test from 'node:test';

const cwd = resolve(import.meta.dirname, '../..');
const guard = resolve(cwd, '.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');

function checkCommand(command: string, expectedStatus: number, directory = cwd, hookDirectory = directory) {
    // The command is JSON data for the guard, never a shell script to execute.
    const result = spawnSync('/bin/bash', [guard], {
        cwd: hookDirectory,
        timeout: 20000,
        encoding: 'utf8',
        env: {
            ...process.env,
            HOME: tmpdir(),
            TMPDIR: tmpdir(),
            PWD: hookDirectory,
            PREFIX_PARENT: '..',
            CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
        },
        input: JSON.stringify({ cwd: directory, tool_name: 'Bash', tool_input: { command } }),
    });
    assert.ifError(result.error);
    assert.equal(result.status, expectedStatus, `${command}\n${result.stderr}`);
    assert.equal(result.stdout, '', command);
    return result.stderr;
}

const unresolved = [
    'p=..; rm -rf "$p/AI"',
    'p=..; rm -rf "${p}/AI"',
    'rm -rf "$(echo ..)/AI"',
    'rm -rf "`echo ..`/AI"',
    'rm -rf "$PREFIX_PARENT/AI"',
    'rm -rf "${PREFIX_PARENT}/AI"',
    'rm -rf "${missing:-..}/AI"',
    'rm -rf build/"$missing"',
    'rm -rf ~operator/AI',
    'rmdir "$missing/out"',
    'unlink "$missing/out"',
    'shred "$missing/out"',
    'mv "$missing/out" build',
    'find "$missing/out" -delete',
    'git clean -fdx -- "$missing/out"',
    'p=build; p=..; rm -rf "$p/out"',
    'p=build; unset p; rm -rf "$p/out"',
    'false && p=build; rm -rf "$p/out"',
    'p=build | cat; rm -rf "$p/out"',
    'p=build; (p=other); rm -rf "$p/out"',
    'p=build; sh -c \'rm -rf "$p/out"\'',
    'p=build; echo "$(p=other)"; rm -rf "$p/out"',
    // Literal-looking assignments do not establish a safe expansion.
    'p=build; rm -rf "$p/out"',
    'p=build; rm -rf "${p}/out"',
    'p=./build; rm -rf "$p/out"',
    'p="build/cache"; rm -rf "$p/out"',
    'p=build\nrm -rf "$p/out"',
    'p=build; q=cache; rm -rf "$p/out"',
    'p=build; rmdir "$p/out"',
    'p=build; mv "$p/out" build/archive',
    'p=build; find "$p/out" -delete',
    'p=build; git clean -fdx -- "$p/out"',
    'p=build; rm -rf $p/out',
    'p=build; rm -rf ${p}/out',
    'rm -rf $PWD/build/out',
    'rm -rf ${HOME}/build/out',
    'rm -rf $TMPDIR/build/out',
    'rm -rf "${HOME}/$missing"',
    'rm -rf ~-/build/out',
    'PWD=..; rm -rf ~+/build/out',
    'export PWD=..; rm -rf ~+/build/out',
    'read PWD; rm -rf ~+',
    'unset PWD; rm -rf ~+/build/out',
    'cd Source; rm -rf ~+/build/out',
    'PWD=..; cd ~+; rm -rf build/out',
    'HOME=..; rm -rf ~/.cratis',
    'export HOME=..; rm -rf ~/.cratis',
    'read HOME; rm -rf ~',
    'declare HOME=..; rm -rf ~/build',
    'unset HOME; rm -rf ~/build',
    'cd Source; rm -rf "$PWD/build"',
    'printf -v "$target" ..; rm -rf "$HOME/build"',
    'read "$target"; rm -rf "$TMPDIR/build"',
    // Round-2 spellings evade raw-text mutation detection, not structural refusal.
    'ex""port H""OME=.; rm -rf "$HOME"',
    "ex''port H''OME=.; rm -rf ~/build",
    'c\\d Source; rm -rf "$PWD/../.cratis"',
    "c''d Source; rm -rf ~+/../.cratis",
    'pu\\shd Source; rm -rf "${PWD}/../.cratis"',
    'IFS=x; rm -rf "$HOME/build/out"',
    'p=build; rm -rf "$HOME/build/out"',
    'HOME=. rm -rf "$HOME"',
    'TMPDIR=. rm -rf "$TMPDIR/build"',
    'cd x; rm -rf "$PWD/y"',
    'rm -rf $HOME/build',
    'rm -rf "$HOME"/*',
    'rm -rf "${PWD}"/build?',
    'rm -rf ~+/build[ab]',
    'rm -rf ~/build*',
    'command rm -rf "$PWD/x"',
    'builtin rm -rf "$HOME/x"',
    'env rm -rf "$TMPDIR/x"',
    'exec rm -rf ~/build',
    'sudo rm -rf "$HOME/build"',
    'nice rm -rf ~+/build',
    'time rm -rf "$PWD/build"',
    'true && rm -rf "$HOME/build"',
    'false || rm -rf ~/build',
    'rm -rf "$HOME/build" | cat',
    'rm -rf "$HOME/build" &',
    'rm -rf "$HOME/build"\n',
    '(rm -rf "$HOME/build")',
    '{ rm -rf "$HOME/build"; }',
    'rm -rf "$HOME/build" "$(echo build)"',
    'rm -rf "$HOME/build" `echo build`',
    'rm -rf "$HOME/build" <<EOF\nbody\nEOF',
    'rm -rf -- "$HOME/build" "$missing/out"',
    'rm -rf -- "$missing/out" "$HOME/build"',
    'git clean -fdx -- "$HOME/build" "$missing/out"',
    'find "$HOME/build" "$missing/out" -delete',
    'find build -name $pattern -print',
];

for (const [index, command] of unresolved.entries()) {
    test(`refuse destructive operands whose path cannot be resolved (${index + 1})`, () => {
        assert.match(checkCommand(command, 2), /operand that could not be resolved/);
    });
}

const allowed = [
    'rm -rf "$PWD/build/out"',
    'rm -rf "$HOME/build/out"',
    'rm -rf "$TMPDIR/build/out"',
    'rm -rf "${PWD}/build/out"',
    'rm -rf "${HOME}/build/out"',
    'rm -rf "${TMPDIR}/build/out"',
    'rm -rf ~/build/out',
    'rm -rf ~+/build/out',
    'cd ~+ && rm -rf build/out',
    'cd ~+/build && rm -rf out',
    'echo x > ~+/out.txt',
    'PWD=..; echo x > ~+/out.txt',
    'HOME=..; echo x > ~/out.txt',
    'rm -rf "$HOME"/build/out',
    'rm -rf -- "$HOME/build" "${TMPDIR}/cache"',
    "r''m -rf \"$PWD/build\"",
    'rm -rf "$PWD/build (old)"',
    'rmdir "$HOME/build"',
    'git clean -fdx -- "$HOME/build"',
    'find "$HOME/build" -delete',
    'find "$TMPDIR/build" -delete',
    'git clean -fdx -- "$TMPDIR/build"',
    'find . -name "-delete" -print',
    'find build -name "$pattern" -print',
    'find "$HOME" -print',
    'find "$PWD/build" -name "$pattern" -print',
    'find build -name "$pattern" -delete',
    'ls "$HOME"',
    'ls "$PREFIX_PARENT/AI"',
    'echo "$p/AI"',
    'p=..; echo "$p/AI"',
    'find "$missing/out" -print',
    'git -C "$missing" status',
    'unknown-program "$missing/out"',
    'HOME=..; echo "$HOME"',
    'export HOME=..; ls "$HOME"',
];

for (const [index, command] of allowed.entries()) {
    test(`allow resolved paths and non-destructive commands (${index + 1})`, () => {
        assert.equal(checkCommand(command, 0), '');
    });
}

for (const command of [
    'rm -rf "${PWD}/build{old}"',
    'rm -rf ~/build"*"',
]) {
    test(`conservatively refuse branch-added expansion cases: ${command}`, () => {
        assert.match(checkCommand(command, 2), /operand that could not be resolved|protected reference/);
    });
}

for (const command of [
    'cd "$missing"; echo x > out.txt',
    'echo x > ~unknownuser/out.txt',
]) {
    test(`refuse unresolved redirection targets: ${command}`, () => {
        assert.match(checkCommand(command, 2), /operand that could not be resolved/);
    });
}

test('unknown redirect paths still retain protected suffix classification', () => {
    assert.match(checkCommand('PWD=..; echo x > ~+/.env', 2), /protected reference/);
    assert.match(checkCommand('HOME=..; echo x > ~/.env', 2), /protected reference/);
});

const descendantSuffixes = [
    { suffix: '', allowed: false },
    { suffix: '/', allowed: false },
    { suffix: '/.', allowed: false },
    { suffix: '/./', allowed: false },
    { suffix: '/..', allowed: false },
    { suffix: '/a/..', allowed: false },
    { suffix: '//', allowed: false },
    { suffix: '/.//', allowed: false },
    { suffix: '/*', allowed: false },
    { suffix: '/a?', allowed: false },
    { suffix: '/a[b]', allowed: false },
    { suffix: '/a{b,c}', allowed: false },
    { suffix: '/$other', allowed: false },
    { suffix: '/build', allowed: true },
    { suffix: '/a/b/', allowed: true },
    { suffix: '//a///b//', allowed: true },
];

for (const prefix of ['$TMPDIR', '${TMPDIR}', '$HOME', '${HOME}', '$PWD', '${PWD}', '~', '~+']) {
    for (const { suffix, allowed } of descendantSuffixes) {
        const operand = prefix.startsWith('~') ? `${prefix}${suffix}` : `"${prefix}${suffix}"`;
        for (const command of [`rm -rf ${operand}`, `find ${operand} -delete`, `git clean -fdx -- ${operand}`]) {
            test(`${allowed ? 'allow' : 'refuse'} an expanded descendant suffix: ${command}`, () => {
                const message = checkCommand(command, allowed ? 0 : 2);
                if (allowed) assert.equal(message, '');
                else assert.match(message, /operand that could not be resolved|references could not all be modeled/);
            });
        }
    }
}

test('a literal-looking binding to the current directory remains unresolved', () => {
    assert.match(checkCommand('p=.; rm -rf "$p"', 2), /operand that could not be resolved/);
});

for (const prefix of ['$PWD', '${PWD}', '~+']) {
    test(`refuse ${prefix} parent traversal regardless of the hook process directory`, () => {
        const target = prefix == '~+' ? '~+/..' : `"${prefix}/.."`;
        const directory = resolve(cwd, 'Source');
        for (const hookDirectory of [cwd, resolve(directory, 'Verification')]) {
            assert.match(checkCommand(`rm -rf ${target}`, 2, directory, hookDirectory), /operand that could not be resolved/);
        }
    });
}

for (const command of [
    "r''m -rf \"$PWD/.cratis\"",
    'rm -rf -- "$HOME/build" "$PWD/.cratis"',
    'rm -rf -- "$PWD/.cratis" "$HOME/build"',
    'git clean -fdx -- "$HOME/build" "$PWD/.cratis"',
    'find "$HOME/build" "$PWD/.cratis" -delete',
]) {
    test(`check protected operands after quote removal and option termination: ${command}`, () => {
        assert.match(checkCommand(command, 2), /protected reference/);
    });
}

const directoryReviewExamples = [
    // Any directory option loses cwd certainty rather than becoming a pathname.
    'cd -P x && rm -rf y',
    'cd -L .. && rm -rf y',
    'cd -e x && rm -rf y',
    'cd -@ x && rm -rf y',
    'cd -Pe x && rm -rf y',
    'cd -- x && rm -rf y',
    'cd ~+/x -P && rm -rf y',
    'pushd -n x && rm -rf y',
    'popd -0 && rm -rf y',
    'cd "$PWD"; cd x; rm -rf y',
    // Both round-3 blockers: the nested shell must not reset tracked cwd to JSON cwd.
    'cd Source; bash -c \'cd "$PWD"; rm -rf ../.cratis\'',
    'cd Source; find . -exec sh -c \'cd "$PWD"; rm -rf ../.cratis\' \\;',
    `cd Source && bash -c 'cd "$PWD/.."; rm -rf ../${basename(cwd)}'`,
    `cd Source && find . -exec sh -c 'cd "$PWD/.."; rm -rf ../${basename(cwd)}' \\;`,
    `cd ..; bash -c 'cd "$PWD"; rm -rf ${basename(cwd)}'`,
    `cd ..; find . -exec sh -c 'cd "$PWD"; rm -rf ${basename(cwd)}' \\;`,
    `HOME=..; bash -c 'cd ~; rm -rf ${basename(cwd)}'`,
    `HOME=..; find . -exec sh -c 'cd ~; rm -rf ${basename(cwd)}' \\;`,
    `HOME=..; bash -c 'cd "$HOME"; rm -rf ${basename(cwd)}'`,
    `HOME=..; find . -exec sh -c 'cd "$HOME"; rm -rf ${basename(cwd)}' \\;`,
    // The initial cd ~+ exception never applies to later/nested/quoted destinations.
    'true; cd ~+/x && rm -rf y',
    'cd Source; cd ~+ && rm -rf build',
    '(cd ~+/x && rm -rf y)',
    '{ cd ~+/x && rm -rf y; }',
    'bash -c \'cd ~+/x && rm -rf y\'',
    'find . -exec sh -c \'cd ~+/x && rm -rf y\' \\;',
    'if true; then cd ~+/x && rm -rf y; fi',
    'HOME=.. cd ~+/x && rm -rf y',
    'cd "~+/x" && rm -rf y',
    'cd ~+/"x" && rm -rf y',
    'cd ~+/x* && rm -rf y',
    'cd "$PWD/x" && rm -rf y',
    'cd "${PWD}/x" && rm -rf y',
    'cd "$HOME/x" && rm -rf y',
    'cd "$TMPDIR/x" && rm -rf y',
    'cd ~/x && rm -rf y',
    'cd ~-/x && rm -rf y',
    'cd ~operator/x && rm -rf y',
    'cd `pwd` && rm -rf y',
    'cd $(pwd) && rm -rf y',
    'pushd ~+/x && rm -rf y',
];

for (const [index, command] of directoryReviewExamples.entries()) {
    test(`refuse expanded directory tracking outside the initial cd ~+ exception (${index + 1})`, () => {
        assert.match(checkCommand(command, 2), /operand that could not be resolved/);
    });
}

const reviewExamples = [
    'IFS=x; p=x../.cratis; rm -rf $p',
    'export IFS=x; p=x../.cratis; rm -rf $p',
    'IFS=/; p=build/.cratis; rm -rf $p',
    'p=..; "p=build"; rm -rf "$p"',
    'p=..; p\\=build; rm -rf "$p"',
    'p=..; "p"=build; rm -rf "$p"',
    'p=-fdx; git clean "$p"',
    'p=-x; git clean -fd "$p"',
    'p=-e; git clean -fdx "$p" foo',
    'p=-e; git clean -fdx "$p" .',
    'p=-delete; find build "$p"',
    'p=-delete; find build -depth "$p"',
    'git $p build clean -fdx',
    'p=-C; q=build; git "$p" "$q" clean -fdx',
    'p=..; if true; then rm -rf "$p/AI"; fi',
    'p=..; if true; then rm -rf "$p/.cratis"; fi',
    'p=..; while true; do rm -rf "$p/.cratis"; done',
    'p=..; while false; do rm -rf "$p/AI"; done',
    'p=..; ! rm -rf "$p/AI"',
    'for p in ..; do rm -rf "$p/.cratis"; done',
    'for p in ..; do rm -rf "$p"; done',
    'select p in ..; do rm -rf "$p"; done',
    'p=..; if false; then :; else rm -rf "$p/AI"; fi',
    'p=..; if false; then :; elif rm -rf "$p/AI"; then :; fi',
    'p=..; if rm -rf "$p/AI"; then :; fi',
    'p=..; while rm -rf "$p/AI"; do :; done',
    'p=..; until rm -rf "$p/AI"; do :; done',
    'p=..; { rm -rf "$p/AI"; }',
    'p=..; (rm -rf "$p/AI")',
    'p=..; time rm -rf "$p/AI"',
    'p=..; time -p rm -rf "$p/AI"',
    'p=..; coproc rm -rf "$p/AI"',
];

for (const [index, command] of reviewExamples.entries()) {
    test(`refuse review example at the root and in a child directory (${index + 1})`, () => {
        for (const directory of [cwd, resolve(cwd, 'Source')]) {
            assert.match(checkCommand(command, 2, directory), /operand that could not be resolved/);
        }
    });
}

for (const variable of ['PWD', 'HOME', 'TMPDIR']) {
    const mutations = [
        `${variable}=..`,
        `export ${variable}=..`,
        `declare ${variable}=..`,
        `typeset ${variable}=..`,
        `local ${variable}=..`,
        `readonly ${variable}=..`,
        `read ${variable}`,
        `readarray ${variable}`,
        `mapfile ${variable}`,
        `unset ${variable}`,
        `printf -v ${variable} ..`,
        `getopts a ${variable}`,
        `for ${variable} in ..; do :; done`,
        `select ${variable} in ..; do :; done`,
    ];
    for (const mutation of mutations) {
        test(`refuse an environment prefix when the command may bind it: ${mutation}`, () => {
            assert.match(checkCommand(`${mutation}; rm -rf "$${variable}/.cratis"`, 2), /operand that could not be resolved/);
            assert.match(checkCommand(`${mutation}; rm -rf "\${${variable}}/build"`, 2), /operand that could not be resolved/);
        });
    }
}
