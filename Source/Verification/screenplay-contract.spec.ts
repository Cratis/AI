// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { check, coverage, parseContract, parseExceptions, pinProblems } from './contract/check.ts';
import type { Exception } from './contract/Exception.ts';
import { expandCodes, extract } from './contract/extract.ts';
import type { Github } from './contract/Github.ts';
import { referenceDirectory, verifyContract } from './contract/index.ts';
import { syncIssue } from './contract/issue.ts';
import { Kind } from './contract/Kind.ts';
import { cleanDocument, selfTest, specimen } from './contract/self-test.ts';

const exception: Exception = { file: 'old.md', text: 'MCP at v1.0.0 had 29 tools.', kind: Kind.ToolCount, value: '29', reason: 'Historical v1.0.0 probe; remove when the old probe is removed.' };

async function withCorpus(action: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'contract-spec-'));
    try {
        await mkdir(join(root, referenceDirectory), { recursive: true });
        await mkdir(join(root, '.cratis/ai/agents'), { recursive: true });
        await mkdir(join(root, '.cratis/ai/rules'), { recursive: true });
        await writeFile(join(root, referenceDirectory, 'screenplay-contract.json'), JSON.stringify(specimen));
        await writeFile(join(root, referenceDirectory, 'screenplay-contract.version'), '4.127.0\n');
        await writeFile(join(root, referenceDirectory, 'screenplay-contract-exceptions.json'), '[]');
        await writeFile(join(root, referenceDirectory, 'versions.md'), '| Screenplay language, standalone tool and MCP | **4.127.0** |');
        await writeFile(join(root, '.cratis/ai/skills/cratis-screenplay-toolchain/SKILL.md'), cleanDocument.content);
        await action(root);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

function report() {
    return { ...check(specimen, [cleanDocument]), files: 1, pinnedVersion: '4.127.0', contractSource: 'contract.json' };
}

function fakeGithub(issues: number[], labels = ['screenplay-sync']) {
    const calls: Array<{ arguments: string[]; input?: string }> = [];
    const github: Github = async (arguments_, input) => {
        calls.push({ arguments: arguments_, input });
        if (arguments_[0] === 'label' && arguments_[1] === 'list') return JSON.stringify(labels.map(name => ({ name })));
        if (arguments_[0] === 'issue' && arguments_[1] === 'list') return JSON.stringify(issues.map(number => ({ number })));
        return '';
    };
    return { calls, github };
}

describe('when extracting Screenplay contract subjects', () => {
    it('should retain exact locations and expand diagnostic ranges and slash shorthand', () => {
        const subjects = extract('skill.md', 'Intro\r\nPLAY0001–0003 and PLAY0100/0002\r\n', specimen);
        assert.deepEqual(subjects.map(subject => [subject.file, subject.line, subject.value]), [['skill.md', 2, 'PLAY0001'], ['skill.md', 2, 'PLAY0002'], ['skill.md', 2, 'PLAY0003'], ['skill.md', 2, 'PLAY0100']]);
        assert.deepEqual(expandCodes('0001', 'PLAY0002'), ['PLAY0001', 'PLAY0002']);
        assert.throws(() => expandCodes('0003', '0001'), /Descending/);
    });
    it('should recognize unknown tool slots and only unambiguous named parameters', () => {
        const content = '# MCP\n| Group | Tools | View |\n| --- | --- | --- |\n| Other | `missing-tool` | `not-a-tool` |\n\nMCP tool `read-workspace(view: "overview", bogus=true)`.\nMCP tool `read-workspace(expectedRevision, view)`.\n';
        const subjects = extract('tools.md', content, specimen);
        assert.deepEqual(subjects.filter(subject => subject.kind === Kind.McpTool).map(subject => subject.value), ['missing-tool', 'read-workspace', 'read-workspace']);
        assert.deepEqual(subjects.filter(subject => subject.kind === Kind.McpParameter).map(subject => subject.value), ['view', 'bogus', 'expectedRevision', 'view']);
    });
    it('should not mistake views, methods, prose or cratis options for standalone subjects', () => {
        const content = '# MCP\nMCP `executable-diagnostics` view; MCP `initialize`.\n`cratis screenplay validate <root> --warnings-as-errors`\n`// Needs the standalone screenplay compiler (ESM v6)`\nBoth 4.66.0 tools accept the model.\n';
        assert.deepEqual(extract('prose.md', content, specimen), []);
    });
    it('should recognize standalone subcommands and their own options', () => {
        const subjects = extract('commands.md', '`screenplay test <root> --filter Example`\nscreenplay <root> --scope Module\n', specimen);
        assert.deepEqual(subjects.filter(subject => subject.kind === Kind.CliOption).map(subject => [subject.value, subject.owner]), [['--filter', 'test'], ['--scope', 'validate']]);
    });
    it('should inherit detached options only within a standalone paragraph or table column', () => {
        const content = '`screenplay <root>` with `--scope Module`\n\n| Layer | Route |\n| --- | --- |\n| Source | `screenplay <root>` |\n| Scope | `--scope Module` |\n| CLI | `cratis screenplay validate <root>` |\n| CLI option | `--warnings-as-errors` |\n\n`--unowned`\n';
        assert.deepEqual(extract('options.md', content, specimen).filter(subject => subject.kind === Kind.CliOption).map(subject => subject.value), ['--scope', '--scope']);
    });
    it('should retain removed pinned tool names when comparing an incoming release', () => {
        const next = { ...specimen, mcpTools: [{ name: 'replacement-tool', requiredParameters: [], optionalParameters: [] }] };
        const result = check(next, [cleanDocument, { file: 'prose.md', content: '# MCP\nRead `read-workspace`.' }], [], false, specimen);
        assert.ok(result.problems.some(problem => problem.startsWith('prose.md:2 unknown MCP tool read-workspace')));
    });
});

describe('when checking Screenplay facts', () => {
    it('should fail for unknown and retired codes including interior range members', () => {
        const result = check(specimen, [cleanDocument, { file: 'bad.md', content: 'PLAY0001-0004' }]);
        assert.ok(result.problems.includes('bad.md:1 retired diagnostic PLAY0003.'));
        assert.ok(result.problems.includes('bad.md:1 unknown diagnostic PLAY0004.'));
    });
    it('should reject retired and unknown interior codes in Markdown-delimited ranges', () => {
        const contract = { ...specimen, diagnostics: [...specimen.diagnostics, { code: 'PLAY0005', reserved: false, retired: false }] };
        for (const range of ['`PLAY0001`–`PLAY0005`', '`PLAY0001`—`0005`', '`PLAY0001`-`PLAY0005`', '`PLAY0001` to `0005`', '`PLAY0001–0005`']) {
            const content = `Introduction\r\n${range}\r\n`;
            const result = check(contract, [cleanDocument, { file: 'range.md', content }]);
            assert.ok(result.problems.includes('range.md:2 retired diagnostic PLAY0003.'), range);
            assert.ok(result.problems.includes('range.md:2 unknown diagnostic PLAY0004.'), range);
            assert.equal(extract('range.md', content, contract)[2].text, range);
        }
    });
    it('should report descending and malformed ranges at their source location and continue scanning', () => {
        for (const range of ['`PLAY0005`–`PLAY0001`', '`PLAY0001`–`PLAY005`', '`PLAY0001` to `PLAY00055`', '`PLAY00055`–`PLAY0001`', '`PLAY0001`–`PLAYoops`']) {
            const result = check(specimen, [cleanDocument, { file: 'range.md', content: `Introduction\n${range}\nPLAY9999` }]);
            assert.ok(result.problems.some(problem => /^range.md:2 (?:Descending|Malformed) diagnostic range/.test(problem)), range);
            assert.ok(result.problems.includes('range.md:3 unknown diagnostic PLAY9999.'), range);
        }
        assert.throws(() => expandCodes('0001', '005'), /Malformed/);
    });
    it('should match reasoned historical exceptions exactly and reject obsolete ones', () => {
        const old = { file: exception.file, content: exception.text };
        assert.deepEqual(check(specimen, [cleanDocument, old], [exception]).problems, []);
        assert.ok(check(specimen, [cleanDocument], [exception]).problems.some(problem => problem.includes('unnecessary')));
        assert.ok(check(specimen, [cleanDocument, { ...old, content: `${old.content} Changed.` }], [exception]).problems.some(problem => problem.includes('MCP tool count 29')));
        assert.deepEqual(check(specimen, [cleanDocument], [exception], false).problems, []);
        assert.throws(() => parseExceptions([{ ...exception, reason: ' ' }]), /nonempty reason/);
        assert.throws(() => parseExceptions([exception, exception]), /Duplicate/);
    });
    it('should not automatically exempt a current claim merely because it has a version', () => {
        assert.ok(check(specimen, [cleanDocument, { file: 'old.md', content: exception.text }]).problems.some(problem => problem.includes('MCP tool count 29')));
    });
    it('should accept only an exact visualization split backed by the catalog', () => {
        const visual = { ...specimen, mcpTools: [...specimen.mcpTools, { name: 'visualize-model', requiredParameters: [], optionalParameters: [] }] };
        const content = { file: 'tools.md', content: '# MCP\n1 tools without visualization, 2 with it;' };
        assert.equal(check(visual, [content]).problems.filter(problem => problem.includes('MCP tool count')).length, 0);
        assert.ok(check(specimen, [{ ...content, content: '# MCP\n0 tools without visualization, 2 with it;' }]).problems.some(problem => problem.includes('invalid MCP visualization-count split')));
    });
    it('should not accept malformed visualization splits merely because the base equals the total count', () => {
        const visual = { ...specimen, mcpTools: [...specimen.mcpTools, { name: 'visualize-model', requiredParameters: [], optionalParameters: [] }] };
        for (const text of ['2 tools without visualization, 2 with it', '2 tools without visualization, 3 with it', '2 tools without visualization', '2 tools without visualization, two with it']) {
            const result = check(visual, [cleanDocument, { file: 'counts.md', content: `# MCP\n${text}` }]);
            assert.ok(result.problems.some(problem => problem.startsWith('counts.md:2 invalid MCP visualization-count split')), text);
        }
        const extra = check(visual, [{ file: 'counts.md', content: '# MCP\n99 tools; 1 tools without visualization, 2 with it' }]);
        assert.ok(extra.problems.some(problem => problem.includes('MCP tool count 99')));
    });
    it('should check command-specific options rather than their global union', () => {
        assert.ok(check(specimen, [cleanDocument, { file: 'bad.md', content: '`screenplay test <root> --scope Module`' }]).problems.some(problem => problem.includes('unknown screenplay test option --scope')));
    });
    it('should fail independently when any subject lane is empty', () => {
        const result = check(specimen, []);
        assert.equal(result.problems.length, Object.values(Kind).length);
        assert.ok(Object.values(result.counts).every(count => count === 0));
        assert.deepEqual(check(specimen, [cleanDocument]).problems, []);
    });
    it('should reject a pin mismatch without allowing an incoming version to replace the corpus pin', async () => {
        assert.deepEqual(pinProblems('4.127.0', '4.127.0'), []);
        assert.match(pinProblems('4.127.0', '4.126.0')[0], /differs/);
        await withCorpus(async root => {
            await writeFile(join(root, referenceDirectory, 'screenplay-contract.version'), '4.126.0');
            assert.ok((await verifyContract(root, join(root, referenceDirectory, 'screenplay-contract.json'))).problems.some(problem => problem.includes('differs')));
        });
    });
    it('should reject malformed, duplicate, unsupported or empty contracts', () => {
        for (const bad of [null, { ...specimen, schemaVersion: 2 }, { ...specimen, diagnostics: [] }, { ...specimen, mcpTools: [...specimen.mcpTools, ...specimen.mcpTools] }, { ...specimen, cliCommands: [{ name: 'test' }] }]) assert.throws(() => parseContract(bad));
        assert.deepEqual(parseContract(specimen), specimen);
    });
    it('should detect every planted defect in the self-test', () => {
        assert.doesNotThrow(selfTest);
    });
});

describe('when computing advisory coverage', () => {
    it('should report gaps by exact token, tool and non-reserved diagnostic family without failing facts', () => {
        const documents = [cleanDocument, { file: 'words.md', content: 'queryExtra commands' }];
        const result = check(specimen, documents);
        assert.deepEqual(result.problems, []);
        assert.deepEqual(result.coverage, { keywords: ['query'], constructs: ['numbers exact'], mcpTools: [], diagnosticCodes: ['PLAY0002', 'PLAY0100'], diagnosticFamilies: ['PLAY01xx'] });
        assert.deepEqual(coverage(specimen, [], []).diagnosticCodes, ['PLAY0001', 'PLAY0002', 'PLAY0100']);
    });
    it('should scan the required surfaces but ignore unrelated rules and the contract JSON itself', async () => {
        await withCorpus(async root => {
            await writeFile(join(root, '.cratis/ai/rules/unrelated.md'), 'PLAY9999');
            await writeFile(join(root, '.cratis/ai/rules/screenplay.md'), 'Screenplay PLAY9998');
            await writeFile(join(root, '.cratis/ai/agents/screenplay-reviewer.md'), 'PLAY9997');
            await mkdir(join(root, '.cratis/ai/skills/cratis-stage-example/references'), { recursive: true });
            await writeFile(join(root, '.cratis/ai/skills/cratis-stage-example/references/example.md'), 'PLAY9996');
            const result = await verifyContract(root);
            for (const code of ['PLAY9998', 'PLAY9997', 'PLAY9996']) assert.ok(result.problems.some(problem => problem.includes(code)));
            assert.ok(!result.problems.some(problem => problem.includes('PLAY9999')));
        });
    });
});

describe('when reconciling the release tracking issue', () => {
    it('should create a missing label and exactly one issue with findings and advisory coverage', async () => {
        const fake = fakeGithub([], []);
        const result = { ...report(), problems: ['skill.md:2 unknown diagnostic PLAY9999.'] };
        await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', result);
        assert.equal(fake.calls.filter(call => call.arguments[0] === 'label' && call.arguments[1] === 'create').length, 1);
        const created = fake.calls.filter(call => call.arguments[0] === 'issue' && call.arguments[1] === 'create');
        assert.equal(created.length, 1);
        assert.match(created[0].input ?? '', /skill.md:2/);
        assert.match(created[0].input ?? '', /Coverage gaps/);
    });
    it('should update rather than duplicate an open tracking issue', async () => {
        const fake = fakeGithub([42]);
        await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', { ...report(), problems: ['drift'] });
        assert.ok(fake.calls.some(call => call.arguments.slice(0, 3).join(' ') === 'issue edit 42'));
        assert.ok(!fake.calls.some(call => call.arguments[1] === 'create'));
    });
    it('should close the tracking issue on clean facts even when mention gaps remain', async () => {
        const fake = fakeGithub([42]);
        await syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report());
        assert.ok(fake.calls.some(call => call.arguments.slice(0, 3).join(' ') === 'issue close 42'));
    });
    it('should refuse duplicate tracking issues or API failure rather than guessing clean', async () => {
        const fake = fakeGithub([42, 43]);
        await assert.rejects(syncIssue(fake.github, 'Cratis/AI', 'v4.128.0', report()), /Multiple/);
        assert.ok(!fake.calls.some(call => ['close', 'edit', 'create'].includes(call.arguments[1])));
        await assert.rejects(syncIssue(async () => { throw new Error('API unavailable'); }, 'Cratis/AI', 'v4.128.0', report()), /API unavailable/);
        await assert.rejects(syncIssue(async () => '{}', 'Cratis/AI', 'v4.128.0', report()), /Invalid GitHub label list/);
    });
    it('should isolate sync concurrency from pending releases and avoid persisting issue-write credentials', async () => {
        const workflow = await readFile(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8');
        assert.ok(workflow.includes("group: ${{ github.workflow }}-${{ (github.event_name == 'repository_dispatch' || github.event_name == 'schedule') && 'screenplay-sync' || github.ref }}"));
        assert.match(workflow, /concurrency:\n[^\n]+\n  cancel-in-progress: false/);
        const syncJob = workflow.split('  screenplay-sync:')[1].split('  dotnet-verify:')[0];
        assert.match(syncJob, /uses: actions\/checkout@[^\n]+\n        with:\n          persist-credentials: false/);
    });
    it('should restrict sync events to comparison and verification without opening a release path', async () => {
        const workflow = await readFile(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8');
        assert.match(workflow, /repository_dispatch:\n\s+types: \[screenplay-contract-published\]/);
        assert.match(workflow, /if: github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'/);
        assert.match(workflow, /if: github.event_name != 'repository_dispatch' && github.event_name != 'schedule'/);
        assert.match(workflow, /gh release download "\$tag" --repo Cratis\/Screenplay/);
    });
});
