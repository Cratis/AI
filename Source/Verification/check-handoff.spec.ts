// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const checker = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-check-handoff.mjs');
interface Finding { severity: string; code: string; message: string; line?: number }
interface Report {
    ok: boolean; handoff: string; repoRoot: string;
    errors: Finding[]; warnings: Finding[]; skipped: { check: string; reason: string }[];
}

function fixture(t: test.TestContext, withGit = true) {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-check-handoff-')));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const task = join(directory, '.ai-work/t');
    mkdirSync(task, { recursive: true });
    writeFileSync(join(directory, 'tracked.txt'), 'initial\n');
    const git = (...args: string[]) => {
        const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8', timeout: 15_000 });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
    };
    let sha = 'a'.repeat(40);
    if (withGit) {
        git('init', '-q', '-b', 'handoff-test');
        git('config', 'user.name', 'Handoff Spec');
        git('config', 'user.email', 'handoff@example.invalid');
        git('add', 'tracked.txt');
        git('commit', '-qm', 'Initial');
        sha = git('rev-parse', 'HEAD');
    }
    const handoff = join(task, 'handoff.md');
    const note = join(task, 'STATE.md');
    writeFileSync(note, 'state\n');
    const body = `# Handoff: test

**Preconditions:** repository \`${directory}\`, branch \`handoff-test\`, HEAD \`${sha}\`,
worktrees \`${directory}\`, written \`2026-07-20\`.

## Goal
Continue the task.

## Repositories and worktrees
| Path | Repository | Branch | HEAD (full SHA) | State | Ahead/behind |
|---|---|---|---|---|---|
| . | test | handoff-test | ${sha} | clean | none |

## Verified facts (with evidence)
none

## Plans and hypotheses (not verified)
none

## Watch and action
| Id | Target (immutable) | Action on completion | How to cancel |
|---|---|---|---|
| none | none | none | none |

## Finished, results not yet read
none

## Open questions carried forward
none

## User constraints (verbatim)
none

## User instructions since the last handoff (verbatim)
none

## Next commands
none

## Files to read
- \`tracked.txt\`
- \`.ai-work/t/STATE.md\`
`;
    writeFileSync(handoff, body);
    const write = (text: string) => writeFileSync(handoff, text);
    const run = (...args: string[]) => spawnSync(process.execPath, [checker, ...args], {
        cwd: directory, encoding: 'utf8', timeout: 30_000,
    });
    const report = (...args: string[]): { status: number | null; data: Report } => {
        const result = run(handoff, '--json', ...args);
        assert.equal(result.stderr, '');
        return { status: result.status, data: JSON.parse(result.stdout) as Report };
    };
    const commit = () => {
        writeFileSync(join(directory, 'tracked.txt'), 'changed\n');
        git('add', 'tracked.txt');
        git('commit', '-qm', 'Next');
        const future = new Date(Date.now() + 60_000);
        utimesSync(note, future, future);
    };
    return { directory, handoff, note, body, sha, git, write, run, report, commit };
}

function hasCode(findings: Finding[], code: string) {
    assert.ok(findings.some(finding => finding.code === code), JSON.stringify(findings));
}

const watchRow = '| none | none | none | none |';

test('a clean handoff passes with a stable JSON shape and text summary', t => {
    const f = fixture(t);
    const { status, data } = f.report();
    assert.equal(status, 0);
    assert.deepEqual(Object.keys(data).sort(), ['errors', 'handoff', 'ok', 'repoRoot', 'skipped', 'warnings']);
    assert.equal(data.ok, true);
    assert.equal(data.handoff, f.handoff);
    assert.equal(data.repoRoot, f.directory);
    assert.deepEqual(data.errors, []);
    assert.deepEqual(data.warnings, []);
    assert.deepEqual(data.skipped, []);
    const text = f.run(f.handoff);
    assert.equal(text.status, 0);
    assert.match(text.stdout, /handoff OK \(0 errors, 0 warnings, 0 checks skipped\)/);
});

test('missing files and unexpanded home paths are errors', t => {
    const f = fixture(t);
    f.write(f.body.replace('`tracked.txt`', '`missing.txt`'));
    hasCode(f.report().data.errors, 'files-to-read-missing');
    assert.equal(f.report().status, 1);
    assert.match(f.run(f.handoff).stdout, /error files-to-read-missing:/);
    f.write(f.body.replace('`tracked.txt`', '`~/tracked.txt`'));
    hasCode(f.report().data.errors, 'files-to-read-missing');
});

for (const action of ['', 'none']) {
    test(`watch rows require an action (${action || 'empty'})`, t => {
        const f = fixture(t);
        f.write(f.body.replace(watchRow, `| run-42 | 42 | ${action} | cancel 42 |`));
        const result = f.report();
        assert.equal(result.status, 1);
        hasCode(result.data.errors, 'watch-action-missing');
    });
}

for (const target of ['latest', 'the PR', 'current']) {
    test(`mutable watch target ${target} is an error`, t => {
        const f = fixture(t);
        f.write(f.body.replace(watchRow, `| run-42 | ${target} | read results | cancel 42 |`));
        hasCode(f.report().data.errors, 'watch-target-mutable');
    });
}

test('missing cancellation and unread result paths are warnings', t => {
    const f = fixture(t);
    f.write(f.body.replace(watchRow, '| run-42 | 42 | read results | none |')
        .replace('## Finished, results not yet read\nnone', '## Finished, results not yet read\n- run-41: `missing.log`\n- `another-missing.log`'));
    const result = f.report();
    assert.equal(result.status, 0);
    hasCode(result.data.warnings, 'watch-cancel-missing');
    assert.equal(result.data.warnings.filter(item => item.code === 'result-missing').length, 2);
});

test('a moved HEAD warns, and strict mode promotes warnings to errors', t => {
    const f = fixture(t);
    f.commit();
    const result = f.report();
    assert.equal(result.status, 0);
    hasCode(result.data.warnings, 'head-moved');
    const strict = f.report('--strict');
    assert.equal(strict.status, 1);
    assert.equal(strict.data.ok, false);
    assert.deepEqual(strict.data.warnings, []);
    hasCode(strict.data.errors, 'head-moved');
});

test('a different branch is an error', t => {
    const f = fixture(t);
    f.git('checkout', '-qb', 'another-branch');
    assert.equal(f.report().status, 1);
    hasCode(f.report().data.errors, 'branch-mismatch');
});

test('nonexistent full SHAs and abbreviated SHAs are errors', t => {
    const f = fixture(t);
    f.write(f.body.replaceAll(f.sha, 'b'.repeat(40)));
    hasCode(f.report().data.errors, 'head-unrelated');
    f.write(f.body.replaceAll(f.sha, f.sha.slice(0, 8)));
    hasCode(f.report().data.errors, 'sha-malformed');
});

test('parseable preconditions are checked independently of the repository table', t => {
    const f = fixture(t);
    f.write(f.body.replace('branch `handoff-test`', 'branch `other`'));
    hasCode(f.report().data.errors, 'branch-mismatch');
    f.write(f.body.replace(`HEAD \`${f.sha}\``, `HEAD \`${'b'.repeat(40)}\``));
    hasCode(f.report().data.errors, 'head-unrelated');
});

test('a missing worktree errors and skips its git checks', t => {
    const f = fixture(t);
    f.write(f.body.replace('| . | test |', '| missing-worktree | test |'));
    const result = f.report();
    hasCode(result.data.errors, 'worktree-missing');
    assert.ok(result.data.skipped.some(item => item.reason.includes('missing-worktree')));
});

test('stale state note warns, including with an explicit override', t => {
    const f = fixture(t);
    utimesSync(f.note, new Date(0), new Date(0));
    const result = f.report();
    assert.equal(result.status, 0);
    hasCode(result.data.warnings, 'state-note-stale');
    f.write(f.body.replace('- `.ai-work/t/STATE.md`\n', ''));
    hasCode(f.report('--state-note', f.note).data.warnings, 'state-note-stale');
    hasCode(f.report().data.warnings, 'state-note-stale');
});

test('a missing state note is not reported twice', t => {
    const f = fixture(t);
    rmSync(f.note);
    const result = f.report();
    hasCode(result.data.errors, 'files-to-read-missing');
    assert.ok(!result.data.warnings.some(item => item.code === 'state-note-missing'));
});

test('missing, empty, non-handoff files and invalid arguments exit 2 on stderr', t => {
    const f = fixture(t);
    for (const args of [['missing.md'], [f.handoff, '--unknown'], [f.handoff, 'extra.md']]) {
        const result = f.run(...args);
        assert.equal(result.status, 2);
        assert.equal(result.stdout, '');
        assert.notEqual(result.stderr, '');
    }
    for (const body of ['', '# Something else\n']) {
        f.write(body);
        assert.equal(f.run(f.handoff).status, 2);
    }
});

test('missing and reordered headings are structural errors', t => {
    const f = fixture(t);
    f.write('# Handoff: incomplete\n');
    const missing = f.report();
    assert.equal(missing.status, 1);
    assert.equal(missing.data.errors.filter(item => item.code === 'section-missing').length, 11);
    f.write(f.body.replace('## Goal', '## Next commands').replace('## Next commands\nnone', '## Goal\nnone'));
    hasCode(f.report().data.errors, 'section-order');
});

test('table headers must match exactly and empty sections warn', t => {
    const f = fixture(t);
    f.write(f.body.replace('Target (immutable)', 'Target').replace('## Goal\nContinue the task.', '## Goal\n'));
    const result = f.report();
    assert.equal(result.status, 1);
    hasCode(result.data.errors, 'table-header');
    hasCode(result.data.warnings, 'section-empty');
});

test('without a git repository, git checks are explicitly skipped', t => {
    const f = fixture(t, false);
    const result = f.report();
    assert.equal(result.status, 0);
    assert.equal(result.data.repoRoot, f.directory);
    assert.ok(result.data.skipped.some(item => item.reason === 'no-git-repository'));
    assert.match(f.run(f.handoff).stdout, /skipped: .*no-git-repository/);
});

test('default discovery selects the newest handoff, or exits 2 if none exist', t => {
    const f = fixture(t);
    const newer = join(f.directory, '.ai-work/t/handoff-lane.md');
    writeFileSync(newer, f.body);
    const future = new Date(Date.now() + 60_000);
    utimesSync(newer, future, future);
    const result = f.run('--json', '--repo', f.directory);
    assert.equal(result.status, 0);
    assert.equal((JSON.parse(result.stdout) as Report).handoff, newer);
    rmSync(newer);
    rmSync(f.handoff);
    assert.equal(f.run().status, 2);
});

test('absolute read paths and an explicit repository root are supported', t => {
    const f = fixture(t);
    f.write(f.body.replace('`tracked.txt`', `\`${join(f.directory, 'tracked.txt')}\``));
    assert.equal(f.report('--repo', f.directory).status, 0);
    assert.equal(readFileSync(f.handoff, 'utf8').includes(f.directory), true);
});

test('an annotated Files to read bullet resolves its first code span', t => {
    const f = fixture(t);
    f.write(f.body.replace('- `tracked.txt`', '- `tracked.txt` (the retry loop, see `other.txt`)'));
    const result = f.report();
    assert.equal(result.status, 0);
    assert.deepEqual(result.data.errors, []);
});

test('a missing annotated Files to read path is still an error', t => {
    const f = fixture(t);
    f.write(f.body.replace('- `tracked.txt`', '- `missing.txt` (the retry loop)'));
    hasCode(f.report().data.errors, 'files-to-read-missing');
});

test('command spans in unread results do not warn, missing path spans still do', t => {
    const f = fixture(t);
    f.write(f.body.replace('## Finished, results not yet read\nnone',
        '## Finished, results not yet read\n- run: `gh run view 123`, then `.ai-work/x/review-1.md`'));
    const warnings = f.report().data.warnings.filter(w => w.code === 'result-missing');
    assert.equal(warnings.length, 1, JSON.stringify(warnings));
    assert.match(warnings[0].message, /review-1\.md/);
});
