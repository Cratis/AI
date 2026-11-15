// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { applyPin } from './contract/bump.ts';
import { check, pinProblems, undocumentedToolProblems } from './contract/check.ts';
import { referenceDirectory } from './contract/index.ts';
import { cleanDocument, specimen } from './contract/self-test.ts';
import { pinnedVersion } from './play/fences.ts';
import { styleCodes } from './play/preferred-syntax.ts';

const compatibility = '# Compatibility\n\n| Screenplay language, standalone tool and MCP | **1.2.3** |\n\nKeep other pins.\n';
const contractJson = `${JSON.stringify(specimen, null, 2)}\n`;
const paths = [`${referenceDirectory}/screenplay-contract.json`, `${referenceDirectory}/screenplay-contract.version`, 'Documentation/compatibility.md'];

async function snapshot(root: string): Promise<string[]> {
    return Promise.all(paths.map(path => readFile(join(root, path), 'utf8')));
}

async function withRoot(action: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'contract-bump-'));
    try {
        await mkdir(join(root, referenceDirectory), { recursive: true });
        await mkdir(join(root, 'Documentation'));
        await writeFile(join(root, paths[0]), contractJson);
        await writeFile(join(root, paths[1]), '1.2.3\n');
        await writeFile(join(root, paths[2]), compatibility);
        await action(root);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

describe('when bumping the standalone Screenplay pin', () => {
    it('should update all three files together, preserve formatting and be idempotent', async () => {
        await withRoot(async root => {
            await applyPin(root, '2.3.4', contractJson);
            const updated = await snapshot(root);
            assert.deepEqual(updated, [contractJson, '2.3.4\n', compatibility.replace('1.2.3', '2.3.4')]);
            assert.deepEqual(pinProblems(pinnedVersion(updated[2]), updated[1].trim()), []);
            await applyPin(root, '2.3.4', contractJson);
            assert.deepEqual(await snapshot(root), updated);
        });
    });

    for (const version of ['', 'v2.3.4', '2.3', '02.3.4', '2.3.4; echo unsafe']) {
        it(`should reject invalid version ${JSON.stringify(version)} before writing`, async () => {
            await withRoot(async root => {
                const before = await snapshot(root);
                await assert.rejects(applyPin(root, version, contractJson), /Invalid Screenplay version/);
                assert.deepEqual(await snapshot(root), before);
            });
        });
    }

    for (const invalid of ['not JSON', JSON.stringify({ ...specimen, schemaVersion: 2 }), JSON.stringify({ schemaVersion: 1 })]) {
        it(`should reject invalid contract ${invalid.slice(0, 40)} before writing`, async () => {
            await withRoot(async root => {
                const before = await snapshot(root);
                await assert.rejects(applyPin(root, '2.3.4', invalid));
                assert.deepEqual(await snapshot(root), before);
            });
        });
    }

    it('should refuse a missing compatibility row before writing any pin', async () => {
        await withRoot(async root => {
            await writeFile(join(root, paths[2]), '# No standalone pin\n');
            const before = await snapshot(root);
            await assert.rejects(applyPin(root, '2.3.4', contractJson), /Standalone Screenplay pin is missing/);
            assert.deepEqual(await snapshot(root), before);
        });
    });

    it('should accept additive tools and style diagnostics without count or code-list edits', async () => {
        await withRoot(async root => {
            const added = { ...specimen,
                mcpTools: [...specimen.mcpTools, { name: 'new-tool', requiredParameters: [], optionalParameters: [] }],
                diagnostics: [...specimen.diagnostics.map(item => ({ ...item, name: 'OrdinaryDiagnostic', severities: ['warning'] })), { code: 'PLAY9999', name: 'LegacyExample', severities: ['information'], reserved: false, retired: false }],
            };
            await applyPin(root, '2.3.4', JSON.stringify(added));
            const document = { ...cleanDocument, content: cleanDocument.content.replace(/\b\d+ tools\b/, `${added.mcpTools.length} tools`) };
            const result = check(added, [document]);
            assert.deepEqual(result.problems, []);
            assert.deepEqual(undocumentedToolProblems(result.coverage.mcpTools), ['Screenplay contract: undocumented MCP tool new-tool.']);
            assert.ok(styleCodes(added.diagnostics).includes('PLAY9999'));
        });
    });
});
