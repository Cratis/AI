// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { dirname } from 'node:path';
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
