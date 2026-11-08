// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { archiveBundle, archiveName, buildBundle, schemaVersion, type BundleManifest } from './bundle.ts';
import { filesUnder, frontmatter, readContent } from './content.ts';
import { stackTerms } from './stack-terms.ts';
import { demoteHeadings, pluginName } from './forms.ts';
import { pinnedScreenplayVersion, repositoryRoot } from './version.ts';

const content = readContent();
let workspace: string;
let bundle: string;
let manifest: BundleManifest;

function build(output: string): BundleManifest {
    return buildBundle({ output, version: '1.2.3', commit: 'abc123', screenplayVersion: pinnedScreenplayVersion(), license: join(repositoryRoot, 'LICENSE'), content });
}

function read(path: string): string {
    return readFileSync(join(bundle, path), 'utf8');
}

describe('a built bundle', () => {
    before(() => {
        workspace = mkdtempSync(join(tmpdir(), 'screenplay-session-'));
        bundle = join(workspace, 'screenplay-session');
        manifest = build(bundle);
    });
    after(() => rmSync(workspace, { recursive: true, force: true }));

    test('describes itself with the contract version, the release version and its source', () => {
        assert.equal(manifest.schemaVersion, schemaVersion);
        assert.equal(manifest.schemaVersion, 1);
        assert.equal(manifest.version, '1.2.3');
        assert.deepEqual(manifest.source, { repository: 'https://github.com/Cratis/AI', commit: 'abc123' });
        assert.deepEqual(JSON.parse(read('bundle.json')), manifest);
    });

    test('lists every file except bundle.json with its checksum and size', () => {
        assert.deepEqual(manifest.files.map(file => file.path), filesUnder(bundle).filter(path => path !== 'bundle.json'));
        for (const file of manifest.files) {
            const data = readFileSync(join(bundle, file.path));
            assert.equal(file.sha256, createHash('sha256').update(data).digest('hex'), file.path);
            assert.equal(file.size, data.length, file.path);
        }
    });

    test('is a Claude Code plugin whose skills are the content skills', () => {
        assert.equal(manifest.forms['claude-code'].plugin, '.');
        const plugin = JSON.parse(read('.claude-plugin/plugin.json')) as Record<string, unknown>;
        assert.equal(plugin.name, pluginName);
        assert.equal(plugin.version, '1.2.3');
        assert.equal(plugin.skills, './skills');
        for (const skill of manifest.skills) assert.equal(frontmatter(read(skill.path)).fields.name, skill.name);
        assert.deepEqual(manifest.skills.map(skill => skill.name), content.skills.map(skill => skill.name));
    });

    test('carries the guide and names every skill in each instruction form', () => {
        for (const path of [manifest.forms['claude-code'].systemPrompt, manifest.forms['agents-md'].instructions, manifest.forms.context.document]) {
            const text = read(path);
            assert.ok(text.startsWith(content.guide.trimEnd()), `${path} starts with the guide`);
            for (const skill of content.skills) assert.ok(text.includes(skill.name), `${path} names ${skill.name}`);
        }
        assert.ok(read('system-prompt.md').includes(`\`${pluginName}:screenplay-language\``));
        assert.ok(read('AGENTS.md').includes('`skills/screenplay-slice-building/SKILL.md`'));
    });

    test('has a self-contained session context with every skill and reference file', () => {
        const context = read('context.md');
        for (const skill of content.skills) {
            assert.ok(context.includes(demoteHeadings(skill.body.trimEnd(), 2)), `${skill.name} body`);
            for (const file of skill.files.filter(name => name !== 'SKILL.md')) assert.ok(context.includes(`### File: ${file} (skill ${skill.name})`), file);
        }
        assert.ok(context.includes(readFileSync(join(bundle, 'skills/screenplay-language/references/example.play'), 'utf8').trimEnd()));
    });

    test('names no stack in any form', () => {
        const findings = manifest.files.filter(file => /\.(md|json)$/.test(file.path) && file.path !== 'LICENSE')
            .flatMap(file => stackTerms.filter(term => term.test(read(file.path))).map(term => `${file.path}: ${term}`));
        assert.deepEqual(findings, []);
    });

    test('states its version in the README', () => {
        assert.match(read('README.md'), /^# Screenplay session bundle 1\.2\.3$/m);
    });

    test('archives every file at the zip root, the same way every time', () => {
        const first = archiveBundle(bundle, join(workspace, archiveName));
        const entries = execFileSync('unzip', ['-Z1', join(workspace, archiveName)], { encoding: 'utf8' }).trim().split('\n');
        assert.deepEqual(entries, filesUnder(bundle));
        assert.equal(readFileSync(join(workspace, `${archiveName}.sha256`), 'utf8'), `${first}  ${archiveName}\n`);

        const again = join(workspace, 'again', 'screenplay-session');
        build(again);
        assert.equal(archiveBundle(again, join(workspace, 'again', archiveName)), first);
    });
});

describe('demoting headings', () => {
    test('leaves headings inside code fences alone', () => {
        assert.equal(demoteHeadings('# Title\n```text\n# not a heading\n```\n## Part', 2), '### Title\n```text\n# not a heading\n```\n#### Part');
    });
});
