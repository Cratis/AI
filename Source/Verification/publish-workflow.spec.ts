// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { check } from './contract/check.ts';
import { summary } from './contract/index.ts';
import { cleanDocument, specimen } from './contract/self-test.ts';
import { reportComparison } from './contract/sync.ts';

const workflow = parse(readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8'));
const verify = workflow.jobs.verify;
const dotnetVerify = workflow.jobs['dotnet-verify'];
const screenplaySync = workflow.jobs['screenplay-sync'];
const release = workflow.jobs.release;
const confirmation = workflow.jobs['release-confirmed'];
const releaseCheck = confirmation.steps.find((step: { name: string }) => step.name === 'Verify the GitHub release exists');
const publishingJobs = Object.entries(workflow.jobs)
    .filter(([name, job]) => name !== 'release-confirmed' && (job as { if?: string }).if === "needs.release.outputs.publish == 'true'");

// Interpret only the event comparisons used by these job guards, not arbitrary Actions expressions.
function allowsEvent(condition: string | undefined, event: string): boolean {
    if (condition === undefined) return true;
    return condition.split(' || ').some(group => group.split(' && ').every(comparison => {
        const match = /^github\.event_name (==|!=) '([^']+)'$/.exec(comparison);
        assert.ok(match, `Unexpected job condition: ${comparison}`);
        return match[1] === '==' ? event === match[2] : event !== match[2];
    }));
}

for (const [name, job] of [['verify', verify], ['dotnet-verify', dotnetVerify]] as const) {
    test(`should exclude only sync events in the ${name} job guard`, () => {
        assert.equal(job.if, "github.event_name != 'repository_dispatch' && github.event_name != 'schedule'");
    });
    for (const event of ['pull_request', 'push', 'workflow_dispatch', 'repository_dispatch', 'schedule']) {
        const syncEvent = event === 'repository_dispatch' || event === 'schedule';
        test(`should ${syncEvent ? 'skip' : 'require'} ${name} for ${event}`, () => {
            assert.equal(allowsEvent(job.if, event), !syncEvent);
        });
    }
}

for (const event of ['pull_request', 'push', 'workflow_dispatch', 'repository_dispatch', 'schedule']) {
    test(`should plan independent contract comparison and guarded release for ${event}`, () => {
        assert.equal(allowsEvent(screenplaySync.if, event), event === 'repository_dispatch' || event === 'schedule');
        assert.equal(allowsEvent(release.if, event), event === 'push' || event === 'workflow_dispatch');
    });
}

test('should require successful verification before push or manual release without a skipped-job bypass', () => {
    assert.equal(release.if, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
    assert.deepEqual(release.needs, ['verify', 'dotnet-verify']);
});

test('should compare the external Screenplay contract independently of skipped verification', () => {
    assert.equal(screenplaySync.if, "github.event_name == 'repository_dispatch' || github.event_name == 'schedule'");
    assert.equal(screenplaySync.needs, undefined);
    assert.equal(screenplaySync['continue-on-error'], undefined);
    const download = screenplaySync.steps.find((step: { id?: string }) => step.id === 'contract');
    assert.equal(download.env.DISPATCH_VERSION, '${{ github.event.client_payload.version }}');
    assert.equal(download.env.DISPATCH_SCHEMA, '${{ github.event.client_payload.schemaVersion }}');
    assert.equal(download.if, undefined);
    assert.match(download.run, /version="\$DISPATCH_VERSION"/);
    assert.match(download.run, /gh release view --repo Cratis\/Screenplay --json tagName --jq .tagName/);
    assert.match(download.run, /gh release download "\$tag" --repo Cratis\/Screenplay --pattern screenplay-contract.json/);
    const comparison = screenplaySync.steps.at(-1);
    assert.equal(comparison.if, undefined);
    assert.equal(comparison['continue-on-error'], undefined);
    assert.equal(comparison.env.CONTRACT_VERSION, '${{ steps.contract.outputs.version }}');
    assert.equal(comparison.env.CONTRACT_PATH, '${{ runner.temp }}/screenplay-contract/screenplay-contract.json');
    assert.equal(comparison.run, 'yarn workspace @cratis/ai-verification exec tsx contract/sync.ts --root "$GITHUB_WORKSPACE" --contract "$CONTRACT_PATH" --version "$CONTRACT_VERSION"');
});

for (const findings of [[], ['New release needs a corpus update.']]) {
    test(`should report ${findings.length} drift findings successfully without hiding real reporting errors`, async () => {
        const directory = await mkdtemp(join(tmpdir(), 'sync-report-'));
        try {
            const result = { ...check(specimen, [cleanDocument]), problems: findings, files: 1, pinnedVersion: '1.2.3', contractSource: 'latest.json' };
            const output: string[] = [];
            const path = join(directory, 'summary.md');
            assert.equal(await reportComparison('2.3.4', result, path, line => output.push(line)), 0);
            assert.ok((await readFile(path, 'utf8')).includes(summary(result)));
            assert.deepEqual(output, findings.length ? ['::warning::Screenplay 2.3.4 contract drift: 1 findings'] : []);
            await assert.rejects(reportComparison('2.3.4', result, directory, () => undefined));
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
}

for (const status of [0, 1, 2]) {
    test(`should preserve the sync script exit status without workflow error suppression (exit ${status})`, () => {
        const comparison = screenplaySync.steps.at(-1);
        // Stub the issue-reconciling command: never contact GitHub or mutate a tracking issue.
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
            input: `yarn() { printf 'comparison argument: <%s>\\n' "$@"; if [ "$SYNC_STATUS" = 1 ]; then printf 'Screenplay contract drift\\n' >&2; fi; return "$SYNC_STATUS"; }\n${comparison.run}`,
            env: { PATH: process.env.PATH, GITHUB_WORKSPACE: '/fixture/ai', CONTRACT_PATH: '/fixture/external-contract.json', CONTRACT_VERSION: 'v1.2.3', SYNC_STATUS: String(status) },
            encoding: 'utf8',
            timeout: 5_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, status, result.stderr);
        assert.match(result.stdout, /comparison argument: <contract\/sync.ts>/);
        assert.match(result.stdout, /comparison argument: <\/fixture\/external-contract.json>/);
        assert.match(result.stdout, /comparison argument: <v1\.2\.3>/);
        if (status === 1) assert.match(result.stderr, /Screenplay contract drift/);
    });
}

test('should retain the sync schedule and FIFO groups without changing the separate Product drift workflow', () => {
    assert.deepEqual(workflow.on.repository_dispatch.types, ['screenplay-contract-published']);
    assert.deepEqual(workflow.on.schedule, [{ cron: '41 4 * * 3' }]);
    assert.deepEqual(workflow.concurrency, {
        group: "${{ github.workflow }}-${{ (github.event_name == 'repository_dispatch' || github.event_name == 'schedule') && 'screenplay-sync' || github.ref }}",
        queue: 'max',
    });
    const productDrift = parse(readFileSync(new URL('../../.github/workflows/product-drift.yml', import.meta.url), 'utf8'));
    assert.deepEqual(productDrift.on, { schedule: [{ cron: '23 5 * * 1' }], workflow_dispatch: null });
    assert.deepEqual(productDrift.concurrency, { group: 'ai-corpus-product-drift', 'cancel-in-progress': false });
});

test('should pin the release action that rejects a version claimed by another commit', () => {
    const action = release.steps.find((step: { id?: string }) => step.id === 'release');
    assert.equal(action.uses, 'cratis/release-action@31a6d28d6aa36d46970cb29f0d0260b360e81a69');
    assert.equal(release.outputs.publish, '${{ steps.release.outputs.should-publish }}');
    assert.equal(release.outputs.version, '${{ steps.release.outputs.version }}');
    assert.equal(release.outputs.prerelease, '${{ steps.release.outputs.prerelease }}');
});

// release-action creates the GitHub release in its post stage, which runs after every step of the
// release job. A check inside the release job runs before the release exists and always fails.
test('should confirm the GitHub release in a job after the release job, before any publish job can start', () => {
    assert.equal(release.steps.some((step: { name?: string }) => step.name === 'Verify the GitHub release exists'), false);
    assert.equal(confirmation.needs, 'release');
    assert.equal(confirmation.if, "needs.release.outputs.publish == 'true'");
    assert.equal(releaseCheck.if, undefined);
    assert.deepEqual(releaseCheck.env, {
        GH_TOKEN: '${{ github.token }}',
        VERSION: '${{ needs.release.outputs.version }}',
    });
    assert.equal(releaseCheck['continue-on-error'], undefined);
    assert.equal(confirmation['continue-on-error'], undefined);
    assert.ok(publishingJobs.length >= 5);
    for (const [, job] of publishingJobs) assert.deepEqual((job as { needs: string[] }).needs, ['release', 'release-confirmed']);
});

for (const status of [0, 1, 4]) {
    test(`should ${status === 0 ? 'accept an existing release' : `reject an unverified release (gh exit ${status})`}`, () => {
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
            input: `gh() { printf 'gh argument: <%s>\\n' "$@"; return "$GH_STATUS"; }\n${releaseCheck.run}`,
            env: { PATH: process.env.PATH, GH_TOKEN: 'test-token', VERSION: '1.2.3', GITHUB_REPOSITORY: 'Cratis/AI', GH_STATUS: String(status) },
            encoding: 'utf8',
            timeout: 5_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, status === 0 ? 0 : 1, result.stderr);
        assert.ok(result.stdout.startsWith('gh argument: <release>\ngh argument: <view>\ngh argument: <v1.2.3>\ngh argument: <--repo>\ngh argument: <Cratis/AI>\n'));
        if (status === 0) assert.doesNotMatch(result.stdout, /::error::/);
        else assert.match(result.stdout, /::error::GitHub release v1\.2\.3 does not exist in Cratis\/AI; refusing to publish\./);
    });
}

const harnessArch = workflow.jobs['publish-agent-harnesses-arch'];
const harnessMerge = workflow.jobs['publish-agent-harnesses'];
const mergeStep = harnessMerge.steps.find((step: { name?: string }) => step.name === 'Publish and verify multi-architecture manifests');
const harnessImages = ['ai-agents', 'ai-agents-claude', 'ai-agents-pi', 'ai-agents-copilot'];

interface MergeOptions { prerelease?: boolean; omitDigest?: string; failInspect?: string; flakyCreate?: boolean }

// Dry-run the merge step with a stubbed docker so no registry is contacted; every call is logged.
function runMerge(options: MergeOptions = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'harness-merge-'));
    const digests = join(dir, 'digests');
    mkdirSync(digests);
    for (const image of harnessImages) {
        for (const arch of ['amd64', 'arm64']) {
            if (options.omitDigest !== `${image}-${arch}`) writeFileSync(join(digests, `${image}-${arch}.txt`), `sha256:${image}-${arch}\n`);
        }
    }
    const log = join(dir, 'docker.log');
    const stub = `docker() {
  echo "docker $*" >> "$LOG"
  if [ "$3" = inspect ]; then
    if [ "\${5:-}" = "cratis/$FAIL_INSPECT:$VERSION" ]; then echo '{"manifests":[{"platform":{"os":"linux","architecture":"amd64"}}]}'; return 0; fi
    echo '{"manifests":[{"platform":{"os":"linux","architecture":"amd64"}},{"platform":{"os":"linux","architecture":"arm64"}}]}'; return 0
  fi
  if [ "$FLAKY_CREATE" = true ] && [ ! -e "$LOG.flaked" ]; then touch "$LOG.flaked"; return 1; fi
  return 0
}
`;
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
        input: stub + mergeStep.run,
        env: {
            PATH: process.env.PATH, LOG: log, DIGESTS: digests, VERSION: '1.2.3', RETRY_DELAY: '0',
            PRERELEASE: String(options.prerelease ?? false), FAIL_INSPECT: options.failInspect ?? '', FLAKY_CREATE: String(options.flakyCreate ?? false),
        },
        encoding: 'utf8',
        timeout: 10_000,
    });
    assert.ifError(result.error);
    const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
    rmSync(dir, { recursive: true, force: true });
    return { status: result.status, stderr: result.stderr, calls };
}

const isCreate = (call: string) => call.includes('imagetools create');
const isLatestMove = (call: string) => isCreate(call) && call.includes(':latest');

test('should create and verify every version manifest before moving any latest tag', () => {
    const { status, stderr, calls } = runMerge();
    assert.equal(status, 0, stderr);
    const firstLatest = calls.findIndex(isLatestMove);
    assert.ok(firstLatest > 0, 'latest must be moved');
    const before = calls.slice(0, firstLatest);
    for (const image of harnessImages) {
        assert.ok(before.some(call => isCreate(call) && call.includes(`--tag cratis/${image}:1.2.3 `)), `${image} version manifest created first`);
        assert.ok(before.some(call => call.includes('imagetools inspect') && call.includes(`cratis/${image}:1.2.3`)), `${image} version manifest verified first`);
    }
    assert.equal(calls.filter(isLatestMove).length, harnessImages.length);
});

test('should merge by pushed digest and never by mutable architecture tag', () => {
    const creates = runMerge().calls.filter(isCreate);
    for (const image of harnessImages) {
        assert.ok(creates.some(call => call.includes(`cratis/${image}@sha256:${image}-amd64 cratis/${image}@sha256:${image}-arm64`)));
    }
    for (const call of creates) assert.doesNotMatch(call, /:1\.2\.3-(amd64|arm64)/);
});

test('should not move any latest tag when a version manifest fails verification', () => {
    const { status, calls } = runMerge({ failInspect: 'ai-agents-pi' });
    assert.notEqual(status, 0);
    assert.equal(calls.filter(isLatestMove).length, 0);
});

test('should fail before any registry call when a digest is missing', () => {
    const { status, calls } = runMerge({ omitDigest: 'ai-agents-copilot-arm64' });
    assert.notEqual(status, 0);
    assert.deepEqual(calls, []);
});

test('should retry a failed registry call', () => {
    const { status, stderr, calls } = runMerge({ flakyCreate: true });
    assert.equal(status, 0, stderr);
    assert.equal(calls.filter(isCreate).length, harnessImages.length * 2 + 1);
});

test('should not move latest for a prerelease', () => {
    const { status, stderr, calls } = runMerge({ prerelease: true });
    assert.equal(status, 0, stderr);
    assert.equal(calls.filter(isLatestMove).length, 0);
    assert.ok(calls.some(call => call.includes('--tag cratis/ai-agents:1.2.3 ')));
});

test('should capture pushed digests in the arch job and transport them by artifact', () => {
    const builds = harnessArch.steps.filter((step: { run?: string }) => step.run?.includes('docker-build-push-retry.sh'));
    assert.equal(builds.length, 2);
    for (const step of builds) {
        assert.match(step.run, /--metadata-file/);
        assert.match(step.run, /--provenance=false/);
    }
    const upload = harnessArch.steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/upload-artifact@'));
    assert.match(upload.uses, /^actions\/upload-artifact@[0-9a-f]{40}$/);
    assert.equal(upload.with.name, 'harness-digests-${{ matrix.arch }}');
    assert.equal(upload.with['if-no-files-found'], 'error');
    const download = harnessMerge.steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/download-artifact@'));
    assert.match(download.uses, /^actions\/download-artifact@[0-9a-f]{40}$/);
    assert.equal(download.with.pattern, 'harness-digests-*');
    assert.equal(download.with['merge-multiple'], true);
    assert.equal(mergeStep.env.DIGESTS, '${{ runner.temp }}/digests');
});
