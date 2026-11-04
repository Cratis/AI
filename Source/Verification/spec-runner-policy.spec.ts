// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { checkPiAgents } from '../Harness.Setup/pi-agents.ts';
import { checkOpenCodeAgents } from '../Harness.Setup/opencode-agents.ts';

const root = resolve(import.meta.dirname, '../..');
const corpus = resolve(root, '.cratis/ai');
const read = (path: string) => readFileSync(resolve(corpus, path), 'utf8');

// Canonical instruction sites, not generated mirrors or unrelated technical syntax.
const executableSites = [
    'rules/csharp.md', 'rules/framework.md', 'rules/pull-requests.md', 'rules/specs.csharp.md',
    'agents/coordinator.md', 'agents/orchestrator.md', 'agents/planner.md',
    'hooks/README.md', 'hooks/pre-commit.md',
    'skills/cratis-application-slice-specifications/SKILL.md',
    'skills/cratis-arc-command-execution/references/command-refusals.md',
    'skills/cratis-arc-command-execution/references/occurrence-commands.md',
    'skills/cratis-arc-command-operation/references/testing.md',
    'skills/cratis-arc-command-validation/references/input-binding.md',
    'skills/cratis-arc-command-validation/references/validation-severity.md',
    'skills/cratis-chronicle-client-dotnet/references/immediate-append-refusal.md',
    'skills/cratis-chronicle-client-dotnet/references/occurrences.md',
    'skills/cratis-chronicle-event-constraints/references/storage-uniqueness.md',
    'skills/cratis-chronicle-event-specifications/SKILL.md',
    'skills/cratis-chronicle-event-type-migration/references/explicit-migrations.md',
    'skills/cratis-chronicle-reactor/references/starting-and-replaying.md',
    'skills/cratis-chronicle-read-model-specifications/SKILL.md',
    'skills/cratis-chronicle-read-model/references/collection-observation.md',
    'skills/cratis-commits-and-pull-requests/references/pr-labels-and-release.md',
    'skills/cratis-engineering-ci-gates/SKILL.md',
    'skills/cratis-engineering-local-cross-repo-verification/SKILL.md',
    'skills/cratis-engineering-local-cross-repo-verification/references/worked-examples.md',
    'skills/cratis-orchestration-lanes/references/context-handoff.md',
    'skills/cratis-orchestration-lanes/references/lane-brief.md',
    'skills/csharp-refactoring/SKILL.md',
    'skills/coverage-analysis/references/setup-discovery.md',
    'skills/cratis-ci-pipeline-performance/SKILL.md',
    'skills/cratis-ci-pipeline-performance/references/build-once-and-shard.md',
    'skills/cratis-ci-pipeline-performance/references/test-setup-cost.md',
    'skills/msbuild/references/build-perf-baseline.md',
];

for (const path of executableSites) {
    test(`${path} directs specification execution to built runners`, () => {
        const text = read(path);
        assert.match(text, /(?:built.*(?:spec|runner|executable)|spec.*executable|bin\/(?:Debug|Release|<Config>))/i, path);
        assert.doesNotMatch(text, /(?:Run|via|and|with|\[ \])\s+`dotnet test`(?!.*(?:VSTest|not|never))/i, path);
        assert.doesNotMatch(text, /(?:^|\n)\s*dotnet test\s*(?:#.*)?\n/, path);
    });
}

const stageSites = [
    'skills/cratis-screenplay-render-and-gap-fill/references/delivery-protocol.md',
    'skills/cratis-screenplay-specifications/SKILL.md',
    'skills/cratis-screenplay-toolchain/references/fast-path.md',
    'skills/cratis-screenplay-toolchain/references/verdicts.md',
    'skills/cratis-stage-rendering-and-sandbox/SKILL.md',
    'skills/cratis-stage-rendering-and-sandbox/references/render-example.md',
];

for (const path of stageSites) {
    test(`${path} runs Stage-rendered VSTest specs after the Debug build`, () => {
        const text = read(path);
        assert.match(text, /`dotnet test [^`]+\.csproj -c Debug --no-build`/, path);
        assert.match(text, /(?:Stage-rendered apps.*VSTest|Stage-rendered apps \(VSTest\))/, path);
        assert.doesNotMatch(text, /(?:VSTest-only:|only VSTest uses)/i, path);
        assert.doesNotMatch(text, /(?:the (?:same|generated) project's|the destination's) (?:verified )?built (?:Debug )?spec executable/i, path);
    });
}

test('Stage class discovery lists VSTest tests rather than starting the web server', () => {
    const text = read('skills/cratis-screenplay-render-and-gap-fill/references/delivery-protocol.md');
    assert.match(text, /`dotnet test <dir>\/<Project>\.csproj -c Debug --no-build --list-tests`/);
    assert.doesNotMatch(text, /Use that executable's supported listing flag/);
});

test('formatting follows repository CI instead of inventing a solution gate', () => {
    const text = read('rules/csharp.md');
    assert.match(text, /\.editorconfig/);
    assert.match(text, /only when.*CI requires/);
    assert.doesNotMatch(text, /^- Use `dotnet format`/m);
});

test('the backend default is an installed sibling runner with unchanged deadline and override schema', () => {
    const gates = JSON.parse(read('hooks/scripts/quality-gates.json')).gates as { id: string; command: string[]; timeoutSeconds: number; timeoutHint: string }[];
    const gate = gates.find(value => value.id === 'backend-specs');
    assert.deepEqual(gate?.command, ['bash', '-c', 'exec bash "$CRATIS_HOOKS_SCRIPTS_DIR/cratis-run-specs.sh" --configuration Debug --no-build']);
    assert.equal(gate?.timeoutSeconds, 120);
    assert.match(gate!.timeoutHint, /only VSTest/);
    assert.match(read('hooks/scripts/cratis-quality-gate.sh'), /export CRATIS_HOOKS_SCRIPTS_DIR="\$here"/);
});

// Explicitly retained syntax: diagnostics, request-specific command modes, negative safety,
// optional code fixes and historical sample output. None chooses the default Cratis runner.
const technicalExamples: [string, RegExp][] = [
    ['skills/filter-syntax/SKILL.md', /## VSTest filters[\s\S]*dotnet test --filter/],
    ['skills/run-tests/SKILL.md', /Only identified VSTest projects default[\s\S]*Native MTP mode/],
    ['skills/platform-detection/references/command-mode.md', /dotnet test/],
    ['skills/platform-detection/SKILL.md', /Microsoft\.NET\.Test\.Sdk.*does not/],
    ['skills/cratis-specifications-csharp/references/running-specs.md', /With VSTest,[\s\S]*--logger "trx;/],
    ['skills/binlog-generation/SKILL.md', /dotnet test \/bl:/],
    ['skills/csharp-refactoring/references/operation-catalog.md', /via `dotnet format` \/ code-fixes/],
    ['skills/coverage-analysis/SKILL.md', /Do not run `dotnet test`/],
    ['skills/eliminate-redundant-restores/SKILL.md', /VSTest-only/],
    ['skills/cratis-ci-pipeline-performance/references/flaky-and-hung-jobs.md', /dotnet test VSTest\.Specs\.csproj/],
    ['skills/cratis-ci-pipeline-performance/references/sources.md', /dotnet test/],
    ['skills/cratis-ci-pipeline-performance/scripts/ci-timings.sh', /dotnet test/],
    ['skills/cratis-rtk/SKILL.md', /Tests: `dotnet test`/],
    ['skills/msbuild/references/binlog-generation.md', /dotnet test/],
    ['harnesses/pi/extensions/cratis-hooks/quality-gate.ts', /dotnet test/],
];

for (const [path, example] of technicalExamples) {
    test(`${path} retains its legitimate technical example`, () => assert.match(read(path), example));
}

test('executable preference and framework-specific flags precede command-mode help', () => {
    const execution = read('skills/run-tests/SKILL.md');
    assert.match(execution, /Cratis xUnit v3, TUnit and native-runner/);
    assert.ok(execution.indexOf('For supported Cratis') < execution.indexOf('| Detected mode / platform'));
    assert.doesNotMatch(read('skills/filter-syntax/SKILL.md'), /core repositories run xUnit v2 on VSTest/);
    assert.match(read('skills/cratis-specifications-csharp/references/running-specs.md'), /not a requirement to migrate frameworks/);
});

test('agent adapters are generated from canonical instructions rather than patched mirrors', () => {
    assert.deepEqual(checkPiAgents(corpus), []);
    assert.deepEqual(checkOpenCodeAgents(corpus), []);
});
