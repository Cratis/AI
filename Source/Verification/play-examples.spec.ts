// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { compileOutcome, couldNotRunProblems, diagnosticCodes, testOutcome, versionOutcome } from './play/classify.ts';
import { insideParent, parseFences, pinnedVersion } from './play/fences.ts';
import { verifyPlayExamples } from './play/index.ts';
import { Outcome } from './play/Outcome.ts';
import type { Runner } from './play/Runner.ts';

const cleanCompile = { exit: 0, output: '1 file(s) compiled - 0 error(s), 0 warning(s)\n' };
const passed = { exit: 0, output: JSON.stringify({ outcome: 'passed', discovered: 1, selected: 1, executed: 1, passed: 1, failed: 0, unsupported: 0 }) };
const unbound = { exit: 3, output: JSON.stringify({ outcome: 'unbound', discovered: 1, selected: 0 }) };
const pin = '| Screenplay language, standalone tool and MCP | **4.127.0** (`commit`) | Evidence |';

async function withCorpus(action: (root: string, skill: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'play-spec-'));
    const skill = join(root, '.cratis/ai/skills/example');
    try {
        await mkdir(skill, { recursive: true });
        await mkdir(join(root, '.cratis/ai/skills/cratis-screenplay-toolchain/references'), { recursive: true });
        await writeFile(join(root, '.cratis/ai/skills/cratis-screenplay-toolchain/references/versions.md'), pin);
        await writeFile(join(skill, 'verification.json'), JSON.stringify({ skill: 'example', assertions: [{ kind: 'play-compiles' }] }));
        await writeFile(join(skill, 'SKILL.md'), '```screenplay\nmodule Example\n```\n');
        await action(root, skill);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

const runner: Runner = async (_tool, arguments_) => arguments_[0] === '--version' ? { exit: 0, output: '4.127.0+commit\n' } : arguments_[0] === 'test' ? passed : cleanCompile;

describe('when parsing Screenplay fences', () => {
    it('should retain file, opening line, source and fence number with CRLF', () => {
        const result = parseFences('example.md', 'Prose\r\n```screenplay\r\nmodule First\r\n```\r\n~~~screenplay excerpt\r\ncommand Second\r\n~~~\r\n');
        assert.deepEqual(result.problems, []);
        assert.deepEqual(result.fences.map(fence => [fence.file, fence.line, fence.number, fence.excerpt]), [['example.md', 2, 1, false], ['example.md', 5, 2, true]]);
        assert.equal(result.fences[0].source, 'module First\n');
    });
    it('should parse exact expected codes, parent and unbound markers', () => {
        const result = parseFences('example.md', '```screenplay excerpt parent=references/model.md#2 expect PLAY0456,PLAY0123 test=unbound\nspecification Example\n```');
        assert.deepEqual(result.problems, []);
        assert.deepEqual(result.fences[0].expectedCodes, ['PLAY0123', 'PLAY0456']);
        assert.equal(result.fences[0].parent, 'references/model.md#2');
        assert.equal(result.fences[0].unbound, true);
    });
    it('should ignore apparent fences inside a longer non-Screenplay fence', () => {
        assert.equal(parseFences('example.md', '````markdown\n```screenplay\nmodule Hidden\n```\n````').fences.length, 0);
    });
    it('should reject unknown, duplicate, malformed and unsafe markers', () => {
        for (const markers of ['expects PLAY0123', 'expect', 'expect PLAY1', 'expect PLAY0123 expect PLAY0456', 'excerpt excerpt', 'parent=model.play', 'excerpt parent=../model.play', 'excerpt parent=C:\\model.play', 'excerpt parent=a.md#0', 'excerpt expect PLAY0123', 'test=unknown', 'test=unbound']) {
            assert.ok(parseFences('example.md', `\`\`\`screenplay ${markers}\nmodule Example\n\`\`\``).problems.length, markers);
        }
    });
    it('should reject unclosed Screenplay fences', () => {
        assert.match(parseFences('example.md', '```screenplay\nmodule Example').problems[0], /unclosed/);
    });
});

describe('when placing excerpts in a parent', () => {
    it('should insert at the unique placeholder with its indentation', () => {
        assert.equal(insideParent('// Parent note\ncommand Example\n  value String\n', 'module Parent\n  // @excerpt\n'), 'module Parent\n  command Example\n    value String\n');
    });
    it('should admit verbatim excerpts at their parent indentation', () => {
        const parent = 'module Parent\n  command Example\n    value String\n';
        assert.equal(insideParent('command Example\n  value String\n', parent), parent);
    });
    it('should admit specification excerpts from separate parent slices', () => {
        const parent = 'module Parent\n  specification First\n    then denied\n  command Other\n  specification Second\n    then denied\n';
        assert.equal(insideParent('specification First\n  then denied\n\nspecification Second\n  then denied\n', parent), parent);
    });
    it('should reject a missing excerpt or ambiguous placeholder', () => {
        assert.throws(() => insideParent('command Wrong', 'module Parent'), /not verbatim/);
        assert.throws(() => insideParent('module Example', 'module ExampleOther\n'), /not verbatim/);
        assert.throws(() => insideParent('command Example', '// @excerpt\n// @excerpt\n'), /exactly one/);
    });
});

describe('when classifying tool outcomes', () => {
    it('should require the exact standalone version and permit build metadata', () => {
        assert.equal(pinnedVersion(pin), '4.127.0');
        assert.throws(() => pinnedVersion('no pin'), /missing/);
        assert.equal(versionOutcome({ exit: 0, output: '4.127.0+commit\n' }, '4.127.0'), Outcome.Clean);
        assert.equal(versionOutcome({ exit: 0, output: '4.126.0' }, '4.127.0'), Outcome.Defects);
    });
    it('should require zero diagnostics and a nonempty compilation', () => {
        assert.equal(compileOutcome(cleanCompile, []), Outcome.Clean);
        for (const result of [{ exit: 0, output: '' }, { exit: 1, output: '' }, { exit: 0, output: '0 file(s) compiled - 0 error(s), 0 warning(s)' }, { exit: 0, output: 'info PLAY0123: advice\n' }]) assert.equal(compileOutcome(result, []), Outcome.Defects);
    });
    it('should require the exact diagnostic code set and retain information diagnostics', () => {
        const result = { exit: 1, output: 'error PLAY0123: first\nwarning PLAY0456: second\nerror PLAY0123: repeated\n' };
        assert.deepEqual(diagnosticCodes(result.output), ['PLAY0123', 'PLAY0456']);
        assert.equal(compileOutcome(result, ['PLAY0123', 'PLAY0456']), Outcome.Clean);
        assert.equal(compileOutcome(result, ['PLAY0123']), Outcome.Defects);
        assert.equal(compileOutcome(result, ['PLAY0123', 'PLAY0456', 'PLAY0789']), Outcome.Defects);
        assert.equal(compileOutcome({ exit: 0, output: 'info PLAY0123: advice' }, ['PLAY0123']), Outcome.Clean);
    });
    it('should distinguish could-not-run from defects and require it only by policy', () => {
        assert.equal(compileOutcome({ exit: 2, output: 'input unavailable' }, []), Outcome.CouldNotRun);
        assert.equal(compileOutcome({ exit: null, output: '', unavailable: 'timeout' }, []), Outcome.CouldNotRun);
        assert.equal(compileOutcome({ exit: 4, output: '' }, []), Outcome.Defects);
        assert.deepEqual(couldNotRunProblems(false, 'file:1', 'missing'), []);
        assert.match(couldNotRunProblems(true, 'file:1', 'missing')[0], /could not run/);
    });
    it('should require nonzero successful specifications or a declared unbound outcome', () => {
        assert.equal(testOutcome(passed, false), Outcome.Clean);
        assert.equal(testOutcome(unbound, true), Outcome.Clean);
        assert.equal(testOutcome(unbound, false), Outcome.Defects);
        assert.equal(testOutcome(passed, true), Outcome.Defects);
        assert.equal(testOutcome({ exit: 0, output: '{}' }, false), Outcome.Defects);
        assert.equal(testOutcome({ exit: 0, output: 'not json' }, false), Outcome.Defects);
        assert.equal(testOutcome({ exit: 2, output: '' }, false), Outcome.CouldNotRun);
        assert.equal(testOutcome({ exit: 0, output: JSON.stringify({ outcome: 'passed', selected: 0, executed: 0, passed: 0, failed: 0, unsupported: 0 }) }, false), Outcome.Defects);
    });
});

describe('when verifying a corpus with an injected runner', () => {
    it('should compile, execute specifications and list unparented excerpts by location', async () => withCorpus(async (root, skill) => {
        await writeFile(join(skill, 'SKILL.md'), '```screenplay\nmodule Example\n  specification Example\n```\n```screenplay excerpt\ncommand Example\n```\n');
        const result = await verifyPlayExamples(root, runner, {});
        assert.equal(result.outcome, Outcome.Clean);
        assert.equal(result.compiled, 1);
        assert.equal(result.tested, 1);
        assert.deepEqual(result.skipped, [{ location: '.cratis/ai/skills/example/SKILL.md:5', reason: 'excerpt has no declared parent' }]);
    }));
    it('should report a missing tool as skipped rather than clean and fail if required', async () => withCorpus(async root => {
        const missing: Runner = async () => ({ exit: null, output: '', unavailable: 'ENOENT' });
        const optional = await verifyPlayExamples(root, missing, {});
        assert.equal(optional.outcome, Outcome.CouldNotRun);
        assert.equal(optional.compiled, 0);
        assert.match(optional.skipped[0].reason, /SKIPPED/);
        assert.equal(optional.problems.length, 0);
        const required = await verifyPlayExamples(root, missing, { CRATIS_REQUIRE_SCREENPLAY: '1' });
        assert.equal(required.problems.length, 1);
        assert.equal(required.outcome, Outcome.CouldNotRun);
    }));
    it('should fail a version mismatch even with the tool optional', async () => withCorpus(async root => {
        const result = await verifyPlayExamples(root, async () => ({ exit: 0, output: '4.126.0' }), {});
        assert.match(result.problems[0], /version mismatch/);
        assert.equal(result.compiled, 0);
    }));
    it('should reject absent assertions and selectors that leave fences uncovered', async () => withCorpus(async (root, skill) => {
        await writeFile(join(skill, 'verification.json'), JSON.stringify({ skill: 'example', assertions: [{ kind: 'play-compiles', value: 'missing.md' }] }));
        const result = await verifyPlayExamples(root, runner, {});
        assert.ok(result.problems.some(problem => problem.includes('selects no fences')));
        assert.ok(result.problems.some(problem => problem.includes('no play-compiles assertion')));
    }));
    it('should compile the inserted source and enforce an expected unbound result', async () => withCorpus(async (root, skill) => {
        await writeFile(join(skill, 'parent.play'), 'module Example\n  // @excerpt\n');
        await writeFile(join(skill, 'SKILL.md'), '```screenplay excerpt parent=parent.play test=unbound\nspecification Example\n```');
        const inserted: Runner = async (tool, arguments_, directory) => {
            if (arguments_[0] === 'test') return unbound;
            if (arguments_[0] !== '--version') assert.equal(await readFile(arguments_[0], 'utf8'), 'module Example\n  specification Example\n');
            return runner(tool, arguments_, directory);
        };
        const result = await verifyPlayExamples(root, inserted, {});
        assert.deepEqual(result.problems, []);
        assert.equal(result.unbound, 1);
    }));
});
