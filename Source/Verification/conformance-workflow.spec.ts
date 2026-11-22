// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

interface Step {
    name?: string;
    run?: string;
    env?: Record<string, string>;
    if?: string;
    'continue-on-error'?: boolean;
}
interface Job {
    name?: string;
    if?: string;
    needs?: string | string[];
    steps?: Step[];
    'continue-on-error'?: boolean;
}

const root = fileURLToPath(new URL('../..', import.meta.url));
const workflow = parse(readFileSync(join(root, '.github/workflows/publish.yml'), 'utf8'));
const jobs: Record<string, Job> = workflow.jobs;
const verify = jobs.verify;
const stepName = 'Run the conformance install-phase checks';

function conformanceStep(): Step & { run: string } {
    const step = verify.steps?.find(step => step.name === stepName);
    assert.ok(step?.run, 'Publish verify must run install-phase conformance');
    return { ...step, run: step.run };
}

function runsConformance(step: Step): boolean {
    return /--install-only|conformance-cli|conformance\.json/.test(step.run ?? '');
}

test('should gate every PR and publishing event without path filters', () => {
    assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
    assert.equal(workflow.on.pull_request, null);
    assert.deepEqual(workflow.on.push, { branches: ['main'] });
    assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
    assert.equal(verify.name, 'verify');
    assert.equal(verify.if, "github.event_name != 'repository_dispatch' && github.event_name != 'schedule'");
    assert.equal(verify.needs, undefined);
    assert.equal(verify['continue-on-error'], undefined);
});

test('should run conformance exactly once before screens smoke without a bypass', () => {
    const step = conformanceStep();
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
    assert.deepEqual(step.env, { CRATIS_CLI_VERSION: '3.100.0' });
    const steps = verify.steps!;
    const index = steps.findIndex(step => step.name === stepName);
    assert.equal(steps[index - 1].name, 'Verify corpus and skill behavior');
    assert.equal(steps[index + 1].name, 'Replay the screens authoring workflow on the pinned public vector');
    const owners = Object.entries(jobs).flatMap(([name, job]) =>
        (job.steps ?? []).filter(runsConformance).map(() => name));
    assert.deepEqual(owners, ['verify']);
    assert.equal(existsSync(join(root, '.github/workflows/conformance.yml')), false);
});

test('should block release and every publisher when verification fails', () => {
    const release = jobs.release;
    assert.deepEqual(release.needs, ['verify', 'dotnet-verify']);
    assert.equal(release.if, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
    assert.equal(release['continue-on-error'], undefined);
    assert.equal(jobs['release-confirmed'].needs, 'release');
    const publishers = Object.entries(jobs).filter(([name]) => name.startsWith('publish-'));
    assert.ok(publishers.length >= 5);
    for (const [name, job] of publishers) {
        const mergesArchitectures = name === 'publish-agent-harnesses';
        assert.deepEqual(job.needs, ['release', mergesArchitectures ? 'publish-agent-harnesses-arch' : 'release-confirmed'], name);
        assert.equal(job.if, "needs.release.outputs.publish == 'true'" +
            (mergesArchitectures ? " && needs.publish-agent-harnesses-arch.result == 'success'" : ''), name);
        assert.equal(job['continue-on-error'], undefined, name);
    }
});

interface RunOptions {
    report?: string;
    cliStatus?: number;
    installStatus?: number;
    removeReport?: boolean;
}

// Only the installer and CLI are stubbed: real bash and jq evaluate the actual workflow verdict.
function runConformance(options: RunOptions = {}) {
    const directory = mkdtempSync(join(tmpdir(), 'conformance-workflow-'));
    try {
        const cliDirectory = join(directory, 'conformance-cli');
        mkdirSync(cliDirectory);
        const reportPath = join(directory, 'stub-report.json');
        writeFileSync(reportPath, options.report ?? JSON.stringify({ results: [{ status: 'passed' }] }));
        writeFileSync(join(cliDirectory, 'cratis'), `#!/bin/bash
printf '%s\\n' "$@" > "$CLI_ARGUMENTS"
cat "$STUB_REPORT"
if [ "$REMOVE_REPORT" = true ]; then rm "$RUNNER_TEMP/conformance.json"; fi
exit "$CLI_STATUS"
`, { mode: 0o755 });
        const step = conformanceStep();
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
            input: `dotnet() { printf '%s\\n' "$@" > "$INSTALL_ARGUMENTS"; return "$INSTALL_STATUS"; }\n${step.run}`,
            cwd: directory,
            env: {
                PATH: process.env.PATH, ...step.env, RUNNER_TEMP: directory,
                CLI_ARGUMENTS: join(directory, 'cli-arguments'), INSTALL_ARGUMENTS: join(directory, 'install-arguments'),
                STUB_REPORT: reportPath, CLI_STATUS: String(options.cliStatus ?? 0), INSTALL_STATUS: String(options.installStatus ?? 0),
                REMOVE_REPORT: String(options.removeReport ?? false),
            },
            encoding: 'utf8',
            timeout: 5_000,
        });
        assert.ifError(result.error);
        assert.deepEqual(readFileSync(join(directory, 'install-arguments'), 'utf8').trim().split('\n'),
            ['tool', 'install', 'Cratis.Cli', '--version', '3.100.0', '--tool-path', cliDirectory]);
        return { ...result, cliArguments: existsSync(join(directory, 'cli-arguments'))
            ? readFileSync(join(directory, 'cli-arguments'), 'utf8').trim().split('\n') : undefined };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

const passed = { status: 'passed', fixture: 'fixture', harness: 'pi' };
const allowedSkip = { status: 'skipped', reason: 'no install-phase checks' };

for (const results of [[passed], [passed, allowedSkip]]) {
    test(`should accept ${results.length} results with at least one pass and only known skips`, () => {
        const result = runConformance({ report: JSON.stringify({ results }) });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(result.cliArguments, ['ai', 'test', '--source', '.', '--install-only', '--output', 'json']);
        assert.match(result.stdout, new RegExp(`Install-phase checks: 1 passed of ${results.length} results\\.`));
    });
}

for (const cliStatus of [1, 2]) {
    for (const report of [JSON.stringify({ results: [passed] }), '{malformed']) {
        test(`should preserve CLI exit ${cliStatus} even when diagnostics cannot parse ${report}`, () => {
            const result = runConformance({ cliStatus, report });
            assert.equal(result.status, cliStatus, result.stderr);
            assert.match(result.stdout, new RegExp(`cratis ai test exited ${cliStatus}`));
        });
    }
}

const rejectedReports: Record<string, unknown> = {
    failed: { results: [passed, { status: 'failed' }] },
    error: { results: [passed, { status: 'error' }] },
    'unknown status': { results: [passed, { status: 'unknown' }] },
    'unexpected skip': { results: [passed, { status: 'skipped', reason: 'not available' }] },
    'almost matching skip reason': { results: [passed, { status: 'skipped', reason: 'no install-phase checks ' }] },
    'only allowed skips': { results: [allowedSkip] },
    'empty results': { results: [] },
    'missing results': {},
    'null results': { results: null },
};
for (const [name, report] of Object.entries(rejectedReports)) {
    test(`should reject ${name} even when the CLI exits zero`, () => {
        const result = runConformance({ report: JSON.stringify(report) });
        assert.notEqual(result.status, 0, result.stdout);
    });
}

for (const report of ['', '{malformed']) {
    test(`should reject ${report === '' ? 'empty' : 'malformed'} JSON even when the CLI exits zero`, () => {
        const result = runConformance({ report });
        assert.notEqual(result.status, 0, result.stdout);
    });
}

test('should reject a missing report even when the CLI exits zero', () => {
    const result = runConformance({ removeReport: true });
    assert.notEqual(result.status, 0, result.stdout);
});

test('should stop on installer failure before invoking the CLI', () => {
    const result = runConformance({ installStatus: 7 });
    assert.equal(result.status, 7, result.stderr);
    assert.equal(result.cliArguments, undefined);
});
