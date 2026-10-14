// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const script = join(repositoryRoot, '.cratis/ai/hooks/scripts/cratis-slice-scope-report.sh');
const slice = 'Source/Marina/Bookings/BookBerth';
const anchor = `${slice}/BookBerth.cs`;
const command = '[Command]\npublic record BookBerth;\n';

function report(committed: Record<string, string>, changed: Record<string, string>, deleted: string[] = []): string {
    const scratch = join(repositoryRoot, '.ai-work/hook-fixtures');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(join(scratch, 'slice-scope-'));
    try {
        const git = (...args: string[]) => {
            const result = spawnSync('git', ['-C', root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
            assert.equal(result.status, 0, result.stderr);
        };
        const write = (files: Record<string, string>) => {
            for (const [path, content] of Object.entries(files)) {
                mkdirSync(dirname(join(root, path)), { recursive: true });
                writeFileSync(join(root, path), content);
            }
        };
        git('init', '-q');
        write({ 'README.md': '# fixture\n', ...committed });
        git('add', '.');
        git('commit', '-q', '-m', 'fixture');
        write(changed);
        for (const path of deleted) rmSync(join(root, path));
        const result = spawnSync('bash', [script, root], {
            input: [...Object.keys(changed), ...deleted].join('\n'), encoding: 'utf8',
        });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, '');
        return result.stderr;
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test('a recognized slice reports an outside seam and missing specifications without failing', () => {
    const output = report({}, { [anchor]: command, 'Source/Host/shared route.cs': 'route\n' });
    assert.match(output, /ADVISORY slice scope Source\/Marina\/Bookings\/BookBerth/);
    assert.match(output, /seam or out of scope: Source\/Host\/shared route.cs/);
    assert.match(output, /specification folder not found/);
    assert.doesNotMatch(output, /seam or out of scope: Source\/Marina\/Bookings\/BookBerth/);
});

test('an existing anchor recognizes frontend changes without demanding a changed specification', () => {
    const output = report({ [anchor]: command }, { [`${slice}/view.tsx`]: 'view\n' });
    assert.match(output, /ADVISORY slice scope/);
    assert.doesNotMatch(output, /specification folder not found/);
});

for (const spec of [`${slice}/for_BookBerth/when_booking/should_record.cs`, `${slice}/for_BookBerth/when_booking.cs`]) {
    test(`an existing specification at ${spec} suppresses the presence hint`, () => {
        const output = report({ [spec]: 'spec\n' }, { [anchor]: command });
        assert.match(output, /ADVISORY slice scope/);
        assert.doesNotMatch(output, /specification folder not found/);
    });
}

test('an untracked specification counts but a deleted tracked specification does not', () => {
    const spec = `${slice}/for_BookBerth/when_booking/should_record.cs`;
    assert.doesNotMatch(report({}, { [anchor]: command, [spec]: 'spec\n' }), /specification folder not found/);
    assert.match(report({ [spec]: 'spec\n' }, { [anchor]: command }, [spec]), /specification folder not found/);
});

test('a directory shape without a model-bound anchor is skipped silently', () => {
    assert.equal(report({}, { [anchor]: 'public class BookBerth;\n' }), '');
    assert.equal(report({}, { [`${slice}/view.tsx`]: 'view\n' }), '');
    assert.equal(report({}, { 'Source/Library/BookBerth.cs': command }), '');
});

test('two recognized slices each report the other slice as a possible seam', () => {
    const view = 'Source/Marina/Bookings/BerthList/BerthList.cs';
    const output = report({}, { [anchor]: command, [view]: '[ReadModel]\npublic record BerthList;\n' });
    assert.equal((output.match(/ADVISORY slice scope/g) ?? []).length, 2);
    assert.match(output, /seam or out of scope: Source\/Marina\/Bookings\/BerthList\/BerthList.cs/);
    assert.match(output, /seam or out of scope: Source\/Marina\/Bookings\/BookBerth\/BookBerth.cs/);
});
