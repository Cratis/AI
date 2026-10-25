// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Contract between cratis-check-pr and the caller workflows that Cratis/Workflows publishes (Cratis/AI#855).
 *
 * The callers are vendored under fixtures/workflows-callers with their source URL and commit in a header, so the
 * default run needs no network. A Workflows change that breaks the detection is caught by refreshing the
 * fixtures: set CRATIS_CONTRACT_LIVE=1 (needs an authenticated gh) to compare them with Cratis/Workflows main.
 * The live comparison is opt-in, not part of the default test run.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const checker = join(root, '.cratis', 'ai', 'hooks', 'scripts', 'cratis-check-pr.mjs');
const fixtures = join(import.meta.dirname, 'fixtures', 'workflows-callers');
const bootstrapPath = '.github/scripts/bootstrap-common-workflows.sh';

/** The bootstrap script renders these tokens into the policy caller; fill them the way a typical repository gets them. */
const tokens: Record<string, string> = {
    '__DEPENDABOT_JOB__': '', '__POLICY_NEEDS__': '', '__POLICY_RUNNER__': 'ubuntu-latest', '__RELEASE_INTENT__': 'true',
};

const vendored = readdirSync(fixtures).filter(name => name.endsWith('.yml')).sort();
const withoutHeader = (text: string): string => text.split('\n').filter(line => !line.startsWith('# [vendored]')).join('\n');
const rendered = (name: string): string => Object.entries(tokens)
    .reduce((text, [token, value]) => text.replaceAll(token, value), withoutHeader(readFileSync(join(fixtures, name), 'utf8')));

function repository(callers: string[]): { directory: string; env: NodeJS.ProcessEnv; cleanup: () => void } {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-check-pr-callers-'));
    const stubs = join(directory, 'stubs');
    mkdirSync(stubs);
    // gh always fails: no network, and the checker falls back to the origin remote and its bundled reviewed rules.
    writeFileSync(join(stubs, 'gh'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(stubs, 'gh'), 0o755);
    const work = join(directory, 'work');
    mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
    for (const name of callers) writeFileSync(join(work, '.github', 'workflows', name), rendered(name));
    const git = (...args: string[]) => assert.equal(spawnSync('git', ['-C', work, ...args], { encoding: 'utf8' }).status, 0, args.join(' '));
    git('init', '-q');
    git('remote', 'add', 'origin', 'https://github.com/Cratis/Contract.git');
    writeFileSync(join(work, 'pr-body.md'), '## Fixed\n\n- A product fix.\n');
    return {
        directory: work,
        env: { ...process.env, PATH: `${stubs}:${dirname(process.execPath)}:/usr/bin:/bin`, GH_REPO: '', XDG_CACHE_HOME: join(directory, 'cache') },
        cleanup: () => rmSync(directory, { recursive: true, force: true }),
    };
}

const run = (r: ReturnType<typeof repository>, args: string[]) =>
    spawnSync(process.execPath, [checker, '--body-file', join(r.directory, 'pr-body.md'), '--label', 'patch', ...args], { cwd: r.directory, env: r.env, encoding: 'utf8' });

const hook = (r: ReturnType<typeof repository>) => spawnSync(process.execPath, [checker, '--hook'], {
    cwd: r.directory, env: r.env, encoding: 'utf8',
    input: JSON.stringify({ cwd: r.directory, tool_name: 'Bash', tool_input: { command: 'gh pr create --body inline' } }),
});

test('the vendored fixtures cover each published release-policy caller and name their source', () => {
    assert.deepEqual(vendored, ['verify-pull-request-policy.yml', 'verify-release-notes.yml', 'verify-semver-label.yml']);
    for (const name of vendored) {
        const text = readFileSync(join(fixtures, name), 'utf8');
        assert.match(text, /^# \[vendored\] source: https:\/\/github\.com\/Cratis\/Workflows\/blob\/[0-9a-f]{40}\//m, name);
    }
});

for (const name of vendored) {
    test(`${name}: the checker finds the published caller and checks the pull request against it`, () => {
        const r = repository([name]);
        try {
            const result = run(r, []);
            assert.doesNotMatch(result.stderr, /No Cratis\/Workflows policy caller found/, `${name} was not recognized as a caller\n${result.stderr}`);
            assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
            // The hook opts the repository in on the same detection: an inline body is refused rather than skipped.
            const guarded = hook(r);
            assert.equal(guarded.status, 2, `${name} did not opt the repository in\n${guarded.stderr}`);
            assert.match(guarded.stderr, /body-file/);
        } finally { r.cleanup(); }
    });
}

test('a Cratis repository without any policy caller fails loudly with remediation text', () => {
    const r = repository([]);
    try {
        const result = run(r, []);
        assert.notEqual(result.status, 0, 'a missing caller must not pass');
        assert.match(result.stderr, /No Cratis\/Workflows policy caller found for Cratis\/Contract/);
        assert.match(result.stderr, /verify-pull-request-policy\.yml/);
        assert.match(result.stderr, /bootstrap-common-workflows/);
    } finally { r.cleanup(); }
});

test('a workflows directory that holds no caller is treated as no caller', () => {
    const r = repository([]);
    try {
        writeFileSync(join(r.directory, '.github', 'workflows', 'build.yml'), 'jobs:\n  build:\n    uses: Cratis/Workflows/.github/workflows/publish.yml@main\n');
        assert.notEqual(run(r, []).status, 0);
    } finally { r.cleanup(); }
});

test('a repository outside Cratis keeps the reviewed-pin check without a caller', () => {
    const r = repository([]);
    try {
        assert.equal(spawnSync('git', ['-C', r.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        const result = run(r, []);
        assert.doesNotMatch(result.stderr, /No Cratis\/Workflows policy caller found/);
    } finally { r.cleanup(); }
});

test('the hook stays a no-op in a repository with no caller', () => {
    const r = repository([]);
    try {
        const guarded = hook(r);
        assert.equal(guarded.status, 0, guarded.stderr);
        assert.equal(guarded.stderr, '');
    } finally { r.cleanup(); }
});

test('the vendored callers still match Cratis/Workflows main', { skip: process.env.CRATIS_CONTRACT_LIVE !== '1' && 'set CRATIS_CONTRACT_LIVE=1 to compare with the live Cratis/Workflows callers' }, () => {
    const gh = spawnSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `repos/Cratis/Workflows/contents/${bootstrapPath}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(gh.status, 0, gh.stderr);
    const live = new Map<string, string>();
    for (const match of gh.stdout.matchAll(/^BOOTSTRAPPED_FILES\["(\.github\/workflows\/verify-[^"]+\.yml)"\]="([A-Za-z0-9+/=]+)"/gm)) {
        live.set(match[1].split('/').pop() as string, Buffer.from(match[2], 'base64').toString('utf8'));
    }
    const policyCallers = [...live.keys()].filter(name => /^verify-(pull-request-policy|release-notes|semver-label|release-intent)\.yml$/.test(name)).sort();
    assert.deepEqual(policyCallers, vendored, 'Cratis/Workflows publishes a different set of callers; vendor the new one and extend this contract');
    for (const name of vendored) assert.equal(withoutHeader(readFileSync(join(fixtures, name), 'utf8')), live.get(name), `${name} drifted from Cratis/Workflows; refresh the fixture and re-run`);
});
