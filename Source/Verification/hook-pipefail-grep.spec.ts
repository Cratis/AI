// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Under `set -o pipefail`, `printf … | grep -q` can turn a true test into a false one: `grep -q` exits on its first
 * match, `printf` dies of SIGPIPE and the pipeline reports failure. The hook scripts use a here-string instead.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const scriptsDirectory = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts');

// A pipe from printf/echo into grep (optionally behind env assignments) whose options include -q in any cluster.
const badPipe = /\b(?:printf|echo)\b[^|\n]*\|\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*grep\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*q[A-Za-z]*(?=\s|$)/;

/** Returns the 1-based numbers of non-comment lines that pipe printf/echo into `grep -q`. */
function findBadLines(content: string): number[] {
    return content.split('\n').flatMap((line, index) =>
        !line.trimStart().startsWith('#') && badPipe.test(line) ? [index + 1] : []);
}

test('the matcher flags printf/echo piped into grep -q in every option cluster', () => {
    const bad = [
        `if printf '%s\\n' "$x" | grep -q foo; then`,
        `if printf '%s\\n' "$x" | grep -Fq foo; then`,
        `if echo "$x" | grep -qE foo; then`,
        `if printf '%s\\n' "$x" | LC_ALL=C grep -Fxq "$a"; then`,
        `chk "n" 'printf "%s" "$out" | grep -Fq "x"'`
    ];
    for (const line of bad) {
        assert.deepEqual(findBadLines(line), [1], line);
    }
});

test('the matcher leaves here-strings, comments and non-quiet greps alone', () => {
    const good = [
        `if LC_ALL=C grep -Fxq "$a" <<<"$x"; then`,
        `grep -qE foo <<<"$x"`,
        `# printf '%s' "$x" | grep -q foo`,
        `printf '%s\\n' "$x" | grep -x "$b" >/dev/null`
    ];
    for (const line of good) {
        assert.deepEqual(findBadLines(line), [], line);
    }
});

test('no hook script pipes printf or echo into grep -q', () => {
    const scripts = readdirSync(scriptsDirectory).filter(name => name.endsWith('.sh'));
    assert.ok(scripts.length > 0, 'no hook scripts were scanned');
    console.log(`hook-pipefail-grep: scanned ${scripts.length} scripts`);
    const findings = scripts.flatMap(name =>
        findBadLines(readFileSync(join(scriptsDirectory, name), 'utf8')).map(line => `${name}:${line}`));
    assert.deepEqual(findings, [], `use a here-string instead of a pipe into grep -q: ${findings.join(', ')}`);
});
