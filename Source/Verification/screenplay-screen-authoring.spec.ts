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
    // These are corpus-authored insertion templates, not copies of product-owned fixtures.
    const parentAssets = [
        'cratis-screenplay-automations-and-translations/assets/pending-certificates.play',
        'cratis-screenplay-automations-and-translations/assets/retry-sweep.play',
    ];
    for (const asset of parentAssets) {
        assert.equal(readFileSync(join(corpus, 'skills', asset), 'utf8').match(/\/\/ @excerpt/g)?.length, 1);
    }
    assert.deepEqual(corpusPlayFiles.filter(file => !parentAssets.includes(file.replaceAll('\\', '/'))), [], 'Screenplay-owned .play fixtures must be linked, not copied into the AI corpus');
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
    for (const required of ['3.43.0', 'cratis/stage:4.52.0', '4.127.0', '51\nbrowser assertions', 'Cratis/cli#301', 'test-account decision', ...failClosed]) {
        assert.ok(stage.includes(required), `stage guidance is missing ${required}`);
    }
    for (const required of ['3.43.0', 'published successfully', 'MCP-edited copy', 'screenplay-mcp-transcript.ts', 'Cratis/cli#301', ...failClosed]) {
        assert.ok(render.includes(required), `render guidance is missing ${required}`);
    }
    for (const required of ['3.40.7', '4.51.1', '4.114.0', '4.122.0', 'executableReady true', '37 tools']) {
        assert.ok(toolchain.includes(required), `toolchain guidance is missing ${required}`);
    }
    for (const required of ['3.43.0', '9 requests and 9 responses', 'StaleRevision', 'cratis/stage:4.52.0', ...failClosed]) {
        assert.ok(workflow.includes(required), `authoring workflow is missing ${required}`);
    }
    assert.ok(
        workflow.includes('ScreenComposition/v1/source/folder'),
        'the authoring workflow must link the canonical screen corpus v1 folder',
    );
    for (const required of ['Authoring accepted', 'Executable admitted', 'Runtime implemented', 'cratis/stage:4.52.0', 'Scene 4.15.0', ...failClosed]) {
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

test('the edited-application browser check edits through MCP, runs the edited model and fails closed', () => {
    const transcript = readFileSync(join(repositoryRoot, 'Source', 'Verification', 'screenplay-mcp-transcript.ts'), 'utf8');
    const browser = readFileSync(join(repositoryRoot, 'Source', 'Verification', 'screenplay-edited-app-browser.ts'), 'utf8');
    const workflow = readFileSync(join(corpus, 'skills', 'cratis-screenplay-model-authoring', 'references', 'screen-authoring-workflow.md'), 'utf8');

    assert.ok(transcript.includes("=== 'work-item-id-column'"), 'the transcript must offer the opt-in column edit');
    assert.ok(transcript.includes('the work item id column was not on disk after apply'), 'the transcript must prove the edit landed');
    for (const required of ["spawn('cratis', ['run', model", "getByRole('columnheader', { name: /^Work item id$/ })", 'process.exit(2)', 'process.exitCode = passed ? 0 : 1', 'mounts.includes(model)']) {
        assert.ok(browser.includes(required), `the browser check is missing ${required}`);
    }
    for (const required of ['screenplay-edited-app-browser.ts', '--edit work-item-id-column', 'scene.json', 'all five browser checks passed']) {
        assert.ok(workflow.includes(required), `the authoring workflow is missing ${required}`);
    }
});

interface TriggerQuery { query: string; shouldTrigger: boolean; note?: string }

const screensSkills = ['cratis-screenplay-ui-composition', 'cratis-screenplay-model-authoring', 'cratis-stage-rendering-and-sandbox'];
const triggers = (name: string) =>
    (JSON.parse(readFileSync(join(repositoryRoot, 'Evaluations', 'skills', name, 'trigger.json'), 'utf8')) as { queries: TriggerQuery[] }).queries;

test('every screens skill has routing coverage that names a real skill for each near miss', () => {
    const knownSkills = readdirSync(join(corpus, 'skills'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    for (const name of screensSkills) {
        assert.ok(existsSync(join(repositoryRoot, 'Evaluations', 'skills', name, 'evals.json')), `${name} has no evals.json`);
        const queries = triggers(name);
        assert.ok(queries.filter(query => query.shouldTrigger).length >= 8, `${name} needs at least eight triggering queries`);
        for (const nearMiss of queries.filter(query => !query.shouldTrigger)) {
            assert.ok(nearMiss.note && knownSkills.includes(nearMiss.note), `${name}: near miss '${nearMiss.query}' must name the skill it routes to`);
            assert.notEqual(nearMiss.note, name, `${name}: a near miss cannot route back to the same skill`);
        }
    }
});

test('the screens skills route authoring, MCP editing and rendering requests to each other', () => {
    for (const name of screensSkills) {
        const routedTo = new Set(triggers(name).filter(query => !query.shouldTrigger).map(query => query.note));
        for (const sibling of screensSkills.filter(other => other !== name)) {
            assert.ok(routedTo.has(sibling), `${name} has no near miss that routes to ${sibling}`);
        }
    }
    assert.ok(triggers('cratis-screenplay-ui-composition').some(query => query.shouldTrigger && /design-time|Generate fields/i.test(query.query)),
        'ui-composition routing must cover design-time generation results');
    assert.ok(triggers('cratis-screenplay-model-authoring').some(query => query.shouldTrigger && /StaleRevision/.test(query.query)),
        'model-authoring routing must cover stale-revision recovery');
});
