// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parseFences, pinnedVersion } from './play/fences.ts';
import { toolPath } from './screenplay-tool.ts';

const root = resolve(import.meta.dirname, '../..');
const skills = resolve(root, '.cratis/ai/skills');
const read = (skill: string, file: string) => readFileSync(resolve(skills, `cratis-screenplay-${skill}`, file), 'utf8');
const handlers = read('command-surface', 'references/described-handlers.md');
const handlerFences = parseFences('references/described-handlers.md', handlers);
const version = pinnedVersion(readFileSync(join(root, 'Documentation/compatibility.md'), 'utf8'));
const tool = toolPath(root, version);

function handlerReport(source: string) {
    const artifacts = join(root, '.ai-work/958');
    mkdirSync(artifacts, { recursive: true });
    const directory = mkdtempSync(join(artifacts, 'handler-spec-'));
    try {
        const model = join(directory, 'example.play');
        writeFileSync(model, source);
        const result = spawnSync(tool, ['test', model, '--format', 'json'], { encoding: 'utf8', timeout: 15_000 });
        assert.equal(result.status, 3, result.stdout + result.stderr);
        return JSON.parse(result.stdout);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

// play-compiles checks source syntax; these pinned-tool cases also check executable admission.
for (const [domain, outcome, code] of [
    ['Dispatching', 'unsupported', undefined],
    ['ConditionalDispatch', 'unbound', 'PLAY0800'],
    ['EmptyDispatchBody', 'unbound', 'PLAY0800'],
] as const) {
    test(`${domain} has the declared executable admission verdict`, { skip: !existsSync(tool) }, () => {
        assert.equal(spawnSync(tool, ['--version'], { encoding: 'utf8', timeout: 15_000 }).stdout.trim().split('+')[0], version);
        const example = handlerFences.fences.find(fence => fence.source.startsWith(`domain ${domain}\n`));
        assert.ok(example, domain);
        const report = handlerReport(example.source);
        assert.equal(report.outcome, outcome, JSON.stringify(report));
        if (code) assert.ok(report.diagnostics.some((diagnostic: { code: string }) => diagnostic.code === code));
        else assert.ok(report.results.some((result: { capability: string }) => result.capability === 'ImplementationBody'));
    });
}
test('the possible-events example declares a complete model with both destination contracts', () => {
    assert.deepEqual(handlerFences.problems, []);
    const examples = handlerFences.fences.filter(fence => fence.source.startsWith('domain Dispatching\n'));
    assert.equal(examples.length, 1, 'keep one complete, positive possible-events example');
    const example = examples[0];
    assert.equal(example.excerpt, false);
    assert.match(example.source, /^domain Dispatching\n/);
    assert.match(example.source, /slice StateChange Dispatch\n/);
    assert.match(example.source, /batchId String identifier/);
    assert.match(example.source, /parcelIds String\[\]/);
    assert.match(example.source, /handler\n\s+may produce\n\s+BatchDispatched for batchId\n\s+ParcelDispatched for one of parcelIds/);
    assert.match(example.source, /```csharp\n[\s\S]+result\.Add\(/);
    assert.match(example.source, /event BatchDispatched\n/);
    assert.match(example.source, /event ParcelDispatched\n/);
    assert.doesNotMatch(example.source, /^\s+produces /m);
});

test('the binding counterexamples are source-valid standalone models, not excerpt escapes', () => {
    const refusals = handlerFences.fences.filter(fence => /^domain (ConditionalDispatch|EmptyDispatchBody)\n/.test(fence.source));
    assert.equal(refusals.length, 2);
    for (const fence of refusals) {
        assert.equal(fence.excerpt, false);
        assert.equal(fence.unbound, true);
        assert.deepEqual(fence.expectedCodes, []);
    }
    assert.ok(refusals.some(fence => /produces when enabled == true\n\s+BatchDispatched\n\s+for batchId/.test(fence.source)));
    assert.ok(refusals.some(fence => /may produce[\s\S]+```csharp\n\s+```/.test(fence.source)));
    assert.match(handlers, /cannot coexist with `produces`/);
    assert.match(handlers, /including an empty result/);
    assert.match(handlers, /subset or multiset/);
});

test('the guidance separates syntax, provider and source-binding versions from standalone execution', () => {
    assert.match(handlers, /syntax.*4\.256\.0/);
    assert.match(handlers, /provider seam.*4\.257\.0/);
    assert.match(handlers, /source binding.*5\.4\.0/);
    assert.match(handlers, /result v2.*ESM v35/);
    assert.match(handlers, /standalone.*no provider/);
    assert.match(handlers, /arguments\.subject/);
    assert.doesNotMatch(handlers, /a `may produce` block[^\n]*fails binding with PLAY0800/);
});

test('host guidance separates atomic result validation, faults and cancellation from denial', () => {
    const host = read('specifications', 'references/host-body-execution.md');
    for (const seam of ['AuthorizeAsync', 'HandleAsync', 'SemanticCommandBodyFaultException', 'OperationCanceledException']) assert.ok(host.includes(seam), seam);
    assert.match(host, /v1.*ordered payloads/);
    assert.match(host, /v2.*items/);
    assert.match(host, /whole result.*before.*append/);
    assert.match(host, /invalid later item.*nothing/);
    assert.match(host, /Allow.*Deny.*Unsupported/);
    assert.match(host, /pure.*not a sandbox/);
    assert.match(host, /Screenplay ships no C# executor/);
    assert.match(host, /reaction-forms\.md/);
    assert.doesNotMatch(host, /PLAY0826|host-language fallback warning/);
});

test('read-model value extraction is a complete model, not a read-model member', () => {
    const guidance = read('read-surface', 'SKILL.md');
    assert.match(guidance, /PLAY0273/);
    assert.match(guidance, /primitive, concept or top-level/);
    assert.match(guidance, /slice-local/);
    const examples = parseFences('SKILL.md', guidance).fences.filter(fence => fence.source.includes('type DeliveryAddress'));
    assert.equal(examples.length, 1);
    assert.equal(examples[0].excerpt, false);
    assert.match(examples[0].source, /^domain DeliveryViews\n/);
    assert.match(examples[0].source, /^type DeliveryAddress\n/m);
    assert.match(examples[0].source, /slice StateView List\n/);
    assert.match(examples[0].source, /address DeliveryAddress/);
});

test('live collection guidance preserves the Screenplay contract without upgrading Stage support', () => {
    const guidance = read('read-surface', 'references/performer-bodies.md');
    for (const member of ['LiveReadModels<T>', 'IObservable<IEnumerable<T>>', 'ContextVersion', 'ResultVersion', 'ReceivedAt', 'OnError', 'OnCompleted']) assert.ok(guidance.includes(member), member);
    assert.match(guidance, /complete snapshots, not deltas/);
    assert.match(guidance, /dispose.*unsubscribe, disconnect or shutdown/);
    assert.match(guidance, /no cancellation member/);
    assert.match(guidance, /does not resubscribe/);
    assert.match(guidance, /single or optional.*no live contract/);
    assert.match(guidance, /Stage 4\.197\.0.*snapshot/);
    assert.match(guidance, /PerformAsync.*not invoked/);
});

test('admissible compilation documents immediate provenance and never claims whole-model success', () => {
    const guidance = read('toolchain', 'references/executable-subset.md');
    assert.match(guidance, /Diagnostics.*original binder errors/);
    assert.match(guidance, /DependsOn.*immediate/);
    assert.match(guidance, /ordered.*Exclusions/);
    assert.match(guidance, /empty for `Root`/);
    assert.match(guidance, /provenance.*4\.256\.0/);
    assert.match(guidance, /subset.*not a whole-model pass/);
});

test('typed-context discovery is additive and exposes result identities and destinations', () => {
    for (const [skill, file] of [['command-surface', 'references/context.md'], ['model-authoring', 'references/mcp-tools.md']]) {
        const guidance = read(skill, file);
        for (const field of ['typed-contexts', 'read-workspace', 'read-proposal', 'resultVersion', 'result.entries', 'eventContract', 'eventName', 'eventRevision', 'payload', 'destinationKind', 'destinationProperty', 'destinationType']) assert.ok(guidance.includes(field), `${skill}: ${field}`);
        assert.match(guidance, /legacy.*omit/);
        assert.match(guidance, /not.*execution/);
    }
});
