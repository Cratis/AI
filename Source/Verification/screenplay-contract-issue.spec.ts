// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { check } from './contract/check.ts';
import type { Github } from './contract/Github.ts';
import { syncIssue } from './contract/issue.ts';
import { cleanDocument, specimen } from './contract/self-test.ts';

function report(problems: string[] = []) {
    return { ...check(specimen, [cleanDocument]), problems, files: 1, pinnedVersion: '4.127.0', contractSource: 'contract.json' };
}

function fakeGithub(labelOutput: string, issueOutput = '[]') {
    const calls: Array<{ arguments: string[]; input?: string }> = [];
    const github: Github = async (arguments_, input) => {
        calls.push({ arguments: arguments_, input });
        if (arguments_[0] === 'label' && arguments_[1] === 'list') return labelOutput;
        if (arguments_[0] === 'issue' && arguments_[1] === 'list') return issueOutput;
        return '';
    };
    return { calls, github };
}

const labelList = ['label', 'list', '--repo', 'Cratis/AI', '--search', 'screenplay-sync', '--limit', '100', '--json', 'name'];

describe('when reconciling a Screenplay comparison without a matching label', () => {
    for (const output of ['', ' \n', '[]']) {
        it(`should leave a clean comparison unchanged for label output ${JSON.stringify(output)}`, async () => {
            const fake = fakeGithub(output);
            await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report());
            assert.deepEqual(fake.calls, [{ arguments: labelList, input: undefined }]);
        });
        it(`should create the label before creating a drift issue for label output ${JSON.stringify(output)}`, async () => {
            const fake = fakeGithub(output);
            await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report(['drift']));
            assert.deepEqual(fake.calls.map(call => call.arguments.slice(0, 2)), [['label', 'list'], ['label', 'create'], ['issue', 'list'], ['issue', 'create']]);
            assert.ok(fake.calls[3].arguments.includes('screenplay-sync'));
            assert.match(fake.calls[3].input ?? '', /- drift/);
        });
    }
    it('should require an exact label match rather than treating a search result as the tracking label', async () => {
        const fake = fakeGithub('[{"name":"screenplay-sync-other"}]');
        await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report());
        assert.equal(fake.calls.length, 1);
    });
    it('should propagate a failed label command rather than treating the failure as an empty list', async () => {
        const failure = new Error('gh label list exited 1: permission denied');
        const github: Github = async () => { throw failure; };
        await assert.rejects(syncIssue(github, 'Cratis/AI', 'v4.128.0', report()), error => error === failure);
    });
    it('should reject malformed label JSON without attempting a write', async () => {
        const fake = fakeGithub('[{"name":');
        await assert.rejects(syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report()), SyntaxError);
        assert.equal(fake.calls.length, 1);
    });
});

describe('when reconciling an existing Screenplay tracking label', () => {
    it('should close the existing issue after a clean comparison', async () => {
        const fake = fakeGithub('[{"name":"screenplay-sync"}]', '[{"number":42}]');
        await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report());
        assert.deepEqual(fake.calls.map(call => call.arguments.slice(0, 2)), [['label', 'list'], ['issue', 'list'], ['issue', 'close']]);
        assert.equal(fake.calls[2].arguments[2], '42');
        assert.ok(fake.calls[2].arguments.includes('completed'));
    });
    it('should reject empty issue-list output because gh returns JSON for no matching issues', async () => {
        const fake = fakeGithub('[{"name":"screenplay-sync"}]', '');
        await assert.rejects(syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report()), SyntaxError);
        assert.equal(fake.calls.length, 2);
    });
    it('should propagate a failed issue command before closing anything', async () => {
        const failure = new Error('gh issue list exited 1: API unavailable');
        const calls: string[][] = [];
        const github: Github = async arguments_ => {
            calls.push(arguments_);
            if (arguments_[0] === 'label') return '[{"name":"screenplay-sync"}]';
            throw failure;
        };
        await assert.rejects(syncIssue(github, 'Cratis/AI', 'v4.128.0', report()), error => error === failure);
        assert.deepEqual(calls.map(arguments_ => arguments_.slice(0, 2)), [['label', 'list'], ['issue', 'list']]);
    });
});
