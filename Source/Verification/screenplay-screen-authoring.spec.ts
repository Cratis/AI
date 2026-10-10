// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const corpus = join(repositoryRoot, '.cratis/ai');
const skill = (name: string) => readFileSync(join(corpus, 'skills', name, 'SKILL.md'), 'utf8');
const referenceExists = (skillName: string, reference: string) => existsSync(join(corpus, 'skills', skillName, 'references', reference));

const allProfiles = () => {
    const catalog = JSON.parse(readFileSync(join(corpus, 'profile-catalog.json'), 'utf8')) as {
        publicProfiles: Array<{ id: string; availableTargets?: string[] }>;
        engineeringProfiles: Array<{ id: string; availableTargets?: string[] }>;
    };
    return [...catalog.publicProfiles, ...catalog.engineeringProfiles];
};

const targets = (id: string) => allProfiles().find(profile => profile.id === id)?.availableTargets ?? [];

test('screen authoring workflow is reachable from Screenplay and Stage profiles', () => {
    for (const required of [
        'cratis-screenplay-ui-composition',
        'cratis-screenplay-read-surface',
        'cratis-screenplay-model-authoring',
        'cratis-screenplay-render-and-gap-fill',
    ]) {
        assert.ok(targets('cratis/screenplay').includes(required), `cratis/screenplay does not expose ${required}`);
    }

    assert.ok(targets('cratis/stage').includes('cratis-stage-rendering-and-sandbox'));
});

test('UI composition guidance covers the screens-release authoring contract without copying fixtures', () => {
    const content = skill('cratis-screenplay-ui-composition');
    for (const required of [
        'component data-context bindings',
        'exposed template configuration',
        'manual form columns',
        'package/icon catalogs',
        'hierarchical outlets',
        'toolbar',
        'runtime fallback',
    ]) {
        assert.match(content, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.ok(referenceExists('cratis-screenplay-ui-composition', 'screen-composition-contract.md'));
    const compositionReference = readFileSync(
        join(corpus, 'skills', 'cratis-screenplay-ui-composition', 'references', 'screen-composition-contract.md'),
        'utf8',
    );
    assert.match(
        compositionReference,
        /Source\/DotNET\/Screenplay\.CanonicalCorpus\/Corpus\/ScreenComposition\/v1\/source\/folder/,
    );

    const corpusPlayFiles = readdirSync(join(corpus, 'skills'), { recursive: true })
        .map(entry => String(entry))
        .filter(entry => entry.endsWith('.play'));
    assert.deepEqual(corpusPlayFiles, [], 'Screenplay-owned .play fixtures must be linked, not copied into the AI corpus');
});

test('model authoring and rendering guidance require one source through MCP, render and runtime checks', () => {
    const authoring = skill('cratis-screenplay-model-authoring');
    const stage = skill('cratis-stage-rendering-and-sandbox');
    const render = skill('cratis-screenplay-render-and-gap-fill');

    assert.ok(referenceExists('cratis-screenplay-model-authoring', 'screen-authoring-workflow.md'));
    for (const required of [
        'same model root or workspace export',
        'syntax-schema',
        'read-proposal',
        'apply',
        'silently drops authored UI',
    ]) {
        assert.match(authoring, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const required of [
        'Silent fallback to a default screen is a failure',
        'package/image versions',
        'dropped authored UI',
    ]) {
        assert.match(stage, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(render, /authored-UI parity/);
    assert.match(render, /responsible tool version/);
});

test('MCP transcript harness sends real protocol requests instead of returning a blocker stub', () => {
    const harnessPath = join(repositoryRoot, 'Source', 'Verification', 'screenplay-mcp-transcript.ts');
    const content = readFileSync(harnessPath, 'utf8');

    for (const required of [
        "request('initialize'",
        "request('tools/list'",
        "callTool<WorkspaceResult>('open-workspace'",
        "callTool<ProposalResult>('propose-source'",
        "callTool<unknown>('read-proposal'",
        "callTool<ApplyResult>('apply'",
        'StaleRevision',
        'commentPreserved',
        'SCREENPLAY_CLI_PROJECT',
    ]) {
        assert.ok(content.includes(required), `MCP transcript harness is missing ${required}`);
    }
    assert.ok(!content.includes('blocked-unimplemented-mcp-client'));
    assert.ok(!content.includes('blocked-missing-mcp'));
});

test('stage, render and toolchain guidance carry the verified screens-release vector', () => {
    const stage = skill('cratis-stage-rendering-and-sandbox');
    const render = skill('cratis-screenplay-render-and-gap-fill');
    const toolchain = skill('cratis-screenplay-toolchain');
    const workflow = readFileSync(
        join(corpus, 'skills', 'cratis-screenplay-model-authoring', 'references', 'screen-authoring-workflow.md'),
        'utf8',
    );
    const composition = readFileSync(
        join(corpus, 'skills', 'cratis-screenplay-ui-composition', 'references', 'screen-composition-contract.md'),
        'utf8',
    );

    const failClosed = ['STAGE-SCENE-ACTION-001', 'STAGE-SCENE-INTERACTION-001'];
    for (const required of ['3.40.7', 'cratis/stage:4.51.1', '4.114.0', '51 browser assertions', 'Cratis/cli#301', 'test-account decision', ...failClosed]) {
        assert.ok(stage.includes(required), `stage guidance is missing ${required}`);
    }
    for (const required of ['3.40.7', '4.51.1', '4.114.0', 'published successfully', 'screenplay-mcp-transcript.ts', 'Cratis/cli#301', ...failClosed]) {
        assert.ok(render.includes(required), `render guidance is missing ${required}`);
    }
    for (const required of ['3.40.7', '4.51.1', '4.114.0', '4.122.0', 'executableReady true', '37 tools']) {
        assert.ok(toolchain.includes(required), `toolchain guidance is missing ${required}`);
    }
    for (const required of ['3.40.7', '9 requests and 9 responses', 'StaleRevision', ...failClosed]) {
        assert.ok(workflow.includes(required), `authoring workflow is missing ${required}`);
    }
    assert.ok(
        workflow.includes('ScreenComposition/v1/source/folder'),
        'the authoring workflow must link the canonical screen corpus v1 folder',
    );
    for (const required of ['Authoring accepted', 'Executable admitted', 'Runtime implemented', 'cratis/stage:4.51.1', 'Scene 4.14.0', ...failClosed]) {
        assert.ok(composition.includes(required), `composition contract is missing ${required}`);
    }
});

test('screen guidance no longer carries caveats that pass on the public vector', () => {
    const documents = [
        skill('cratis-stage-rendering-and-sandbox'),
        skill('cratis-screenplay-render-and-gap-fill'),
        skill('cratis-screenplay-toolchain'),
        skill('cratis-screenplay-ui-composition'),
        readFileSync(join(corpus, 'skills', 'cratis-screenplay-ui-composition', 'references', 'screen-composition-contract.md'), 'utf8'),
        readFileSync(join(corpus, 'skills', 'cratis-screenplay-model-authoring', 'references', 'screen-authoring-workflow.md'), 'utf8'),
    ];

    for (const retired of ['CrashLoopBackOff', 'Pulumi', 'Studio 0.136', 'CLI 3.40.3', 'stage:4.49.5', 'Scene 4.12.0']) {
        for (const document of documents) {
            assert.ok(!document.includes(retired), `screen guidance still carries the retired caveat or pin '${retired}'`);
        }
    }
});
