// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8'));
const verify = workflow.jobs.verify;
const dotnetVerify = workflow.jobs['dotnet-verify'];
const release = workflow.jobs.release;
const confirmation = workflow.jobs['release-confirmed'];
const releaseCheck = confirmation.steps.find((step: { name: string }) => step.name === 'Verify the GitHub release exists');
const publishingJobs = Object.entries(workflow.jobs)
    .filter(([name, job]) => name !== 'release-confirmed' && (job as { if?: string }).if === "needs.release.outputs.publish == 'true'");

type WorkflowStep = { run?: string; uses?: string; with?: Record<string, string>; env?: Record<string, string>; if?: string };
const installCommand = 'corepack enable && yarn install --immutable';
const cacheOptions = {
    path: '.yarn/cache',
    'key-prefix': "yarn-v1-${{ runner.arch }}-node24-${{ hashFiles('package.json', 'Source/**/package.json', '.yarn/releases/**', '.yarn/plugins/**') }}",
    mode: "${{ github.ref == format('refs/heads/{0}', github.event.repository.default_branch) && (github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && 'save' || 'restore' }}",
};
const cachedWorkflows = { publish: workflow };

for (const [workflowName, document] of Object.entries(cachedWorkflows)) {
    const installingJobs = Object.entries(document.jobs).filter(([, job]) =>
        (job as { steps?: WorkflowStep[] }).steps?.some(step => step.run === installCommand));

    test(`should cache every root Yarn install in ${workflowName}`, () => {
        assert.equal(installingJobs.length, 5);
    });

    for (const [jobName, job] of installingJobs) {
        const steps = (job as { steps: WorkflowStep[] }).steps;
        const installIndex = steps.findIndex(step => step.run === installCommand);
        const cache = steps[installIndex - 1];
        const install = steps[installIndex];

        test(`should restore only pinned dependency archives before the unconditional ${workflowName}/${jobName} install`, () => {
            assert.equal(cache.uses, 'Cratis/Workflows/.github/actions/yarn-cache@56270801b4d685a32b95b20e30599a5f982d8de1');
            assert.deepEqual(cache.with, cacheOptions);
            assert.equal(cache.if, undefined);
            assert.equal(install.if, undefined);
            assert.equal(install.env?.YARN_CHECKSUM_BEHAVIOR, 'throw');
        });

        test(`should allow only trusted default-branch cache writers in ${workflowName}/${jobName}`, () => {
            assert.ok(cache.with?.mode);
            for (const defaultBranch of ['main', 'trunk']) {
                for (const event of ['push', 'schedule', 'workflow_dispatch', 'pull_request', 'pull_request_target', 'repository_dispatch', 'release']) {
                    for (const ref of [`refs/heads/${defaultBranch}`, 'refs/heads/feature', 'refs/pull/1/merge']) {
                        const mode = runInNewContext(cache.with.mode.slice(3, -2), {
                            github: { ref, event_name: event, event: { repository: { default_branch: defaultBranch } } },
                            format: (template: string, value: string) => template.replace('{0}', value),
                        }, { timeout: 100 });
                        const trusted = ref === `refs/heads/${defaultBranch}` && ['push', 'schedule', 'workflow_dispatch'].includes(event);
                        assert.equal(mode, trusted ? 'save' : 'restore', `${event} on ${ref}`);
                    }
                }
            }
        });
    }
}

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
    test(`should run ${name} for every workflow event`, () => {
        assert.equal(job.if, undefined);
    });
}

for (const event of ['pull_request', 'push', 'workflow_dispatch']) {
    test(`should plan a guarded release for ${event}`, () => {
        assert.equal(allowsEvent(release.if, event), event === 'push' || event === 'workflow_dispatch');
    });
}

test('should require successful verification before push or manual release without a skipped-job bypass', () => {
    assert.equal(release.if, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
    assert.deepEqual(release.needs, ['verify', 'dotnet-verify']);
});

test('should queue runs per ref and trigger on no external event', () => {
    assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
    assert.deepEqual(workflow.concurrency, { group: '${{ github.workflow }}-${{ github.ref }}', queue: 'max' });
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
