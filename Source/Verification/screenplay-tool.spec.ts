// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileOutcome, versionOutcome } from './play/classify.ts';
import { parseFences, pinnedVersion } from './play/fences.ts';
import { run } from './play/invoke.ts';
import { Outcome } from './play/Outcome.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureTool, fixCommand, matchesPin, toolPath, type ToolEnvironment } from './screenplay-tool.ts';

function fake(state: { files: Set<string>; installed: string; installError?: Error; calls: string[] }, path: string): ToolEnvironment {
    return {
        exists: p => state.files.has(p) || (state.files.size > 0 && p === dirname(path)),
        versionOf: p => (state.files.has(p) ? state.installed : undefined),
        remove: directory => { state.calls.push(`remove ${directory}`); state.files.clear(); },
        install: (version, directory) => {
            state.calls.push(`install ${version}`);
            if (state.installError) throw state.installError;
            state.files.add(path);
            state.installed = version;
            void directory;
        }
    };
}

describe('pinned screenplay tool', () => {
    const root = '/repo';
    const path = toolPath(root, '4.235.0', 'linux');

    it('should place the tool under the ignored cache directory, per version', () => {
        assert.equal(path, '/repo/.cache/screenplay-tool/4.235.0/screenplay');
        assert.match(toolPath(root, '4.235.0', 'win32'), /screenplay\.exe$/);
    });

    it('should ignore build metadata when matching the pin', () => {
        assert.ok(matchesPin('4.235.0+abc\n', '4.235.0'));
        assert.ok(!matchesPin('4.240.2', '4.235.0'));
        assert.ok(!matchesPin(undefined, '4.235.0'));
    });

    it('should reuse a cached tool without installing', () => {
        const state = { files: new Set([path]), installed: '4.235.0', calls: [] as string[] };
        assert.equal(ensureTool(root, '4.235.0', fake(state, path), 'linux'), path);
        assert.deepEqual(state.calls, []);
    });

    it('should install when the cache is empty', () => {
        const state = { files: new Set<string>(), installed: '', calls: [] as string[] };
        assert.equal(ensureTool(root, '4.235.0', fake(state, path), 'linux'), path);
        assert.deepEqual(state.calls, ['install 4.235.0']);
    });

    it('should replace a cached tool that reports another version', () => {
        const state = { files: new Set([path]), installed: '4.240.2', calls: [] as string[] };
        assert.equal(ensureTool(root, '4.235.0', fake(state, path), 'linux'), path);
        assert.equal(state.calls.length, 2);
        assert.match(state.calls[0], /^remove /);
    });

    it('should name the fix command when the install fails', () => {
        const state = { files: new Set<string>(), installed: '', calls: [] as string[], installError: new Error('network unreachable') };
        assert.throws(() => ensureTool(root, '4.235.0', fake(state, path), 'linux'), error => error instanceof Error && error.message.includes(fixCommand) && error.message.includes('network unreachable'));
    });
});

const root = resolve(import.meta.dirname, '../..');
const pin = pinnedVersion(readFileSync(join(root, 'Documentation/compatibility.md'), 'utf8'));
const compiler = process.env.CRATIS_OFFLINE_SCREENPLAY ?? toolPath(root, pin);
const compilerOptions = { skip: !existsSync(compiler) ? `No offline Screenplay ${pin}.` : false };

it('compiles shipped streams and availability models with the pinned CLI', compilerOptions, async () => {
    const version = await run(compiler, ['--version'], root);
    assert.equal(versionOutcome(version, pin), Outcome.Clean, version.output);
    const base = join(root, '.ai-work');
    mkdirSync(base, { recursive: true });
    const cwd = mkdtempSync(join(base, 'play-'));
    try {
        for (const file of ['streams-and-consistency/references/streams-example.md', 'availability/references/complete-example.md']) {
            const path = join(root, `.cratis/ai/skills/cratis-screenplay-${file}`);
            const parsed = parseFences(path, readFileSync(path, 'utf8'));
            assert.deepEqual(parsed.problems, []);
            const fences = parsed.fences.filter(fence => !fence.excerpt);
            assert.ok(fences.length);
            for (const { source, expectedCodes } of fences) for (const broken of [false, true]) {
                writeFileSync(join(cwd, 'model.play'), source + (broken ? '\n! broken fixture\n' : ''));
                const result = await run(compiler, ['model.play', '--warnaserror', '--no-color'], cwd);
                assert.equal(compileOutcome(result, expectedCodes), broken ? Outcome.Defects : Outcome.Clean, result.output);
                if (!broken) assert.equal(compileOutcome(result, expectedCodes.length ? [] : ['PLAY0516']), Outcome.Defects);
            }
        }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
});
