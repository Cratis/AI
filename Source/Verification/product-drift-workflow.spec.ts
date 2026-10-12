// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const workflow = parse(readFileSync(resolve(root, '.github/workflows/product-drift.yml'), 'utf8'));

test('the drift workflow is weekly and manual, serialized, and has only the needed permissions', () => {
    assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch']);
    assert.equal(workflow.on.schedule.length, 1);
    assert.equal(workflow.on.schedule[0].cron, '23 5 * * 1');
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert.deepEqual(workflow.permissions, { contents: 'read', issues: 'write' });
});
test('actions are SHA-pinned to the same revisions as publishing', () => {
    const publish = readFileSync(resolve(root, '.github/workflows/publish.yml'), 'utf8');
    const actions = workflow.jobs.drift.steps.filter((step: { uses?: string }) => step.uses);
    assert.equal(actions.length, 2);
    for (const action of actions) {
        assert.match(action.uses, /@[a-f0-9]{40}$/);
        assert.ok(publish.includes(action.uses));
    }
});
test('the report preserves its status, rejects could-not-run, and only then reconciles the issue', () => {
    const steps = workflow.jobs.drift.steps;
    const report = steps.find((step: { name: string }) => step.name === 'Report product drift');
    assert.match(report.run, /run drift --json/);
    assert.match(report.run, /status=\$\?/);
    assert.match(report.run, /"\$status" -ne 0.*"\$status" -ne 1/);
    assert.match(report.run, /exit "\$status"/);
    assert.equal(report.env.GH_TOKEN, '${{ github.token }}');
    const issue = steps.at(-1);
    assert.match(issue.run, /run drift-issue/);
    assert.equal(issue.env.GH_TOKEN, '${{ github.token }}');
    assert.equal(issue.if, undefined);
});
