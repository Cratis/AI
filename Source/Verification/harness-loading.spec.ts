// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpusRoot = join(repositoryRoot, '.cratis', 'ai');

function skillCount(path: string): number {
    return readdirSync(realpathSync(path), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .filter(entry => readdirSync(join(realpathSync(path), entry.name)).includes('SKILL.md'))
        .length;
}

test('Pi SDK discovers the complete managed repository resources without a model', async () => {
    const agentDirectory = mkdtempSync(join(tmpdir(), 'cratis-pi-loader-'));
    try {
        const loader = new DefaultResourceLoader({
            cwd: repositoryRoot,
            agentDir: agentDirectory,
            settingsManager: SettingsManager.inMemory(),
        });
        await loader.reload();

        const extensions = loader.getExtensions();
        assert.deepEqual(extensions.errors, []);
        assert.deepEqual(
            extensions.extensions.map(extension => extension.path.split('/').slice(-2).join('/')).sort(),
            ['cratis-hooks/index.ts', 'cratis-rules/index.ts', 'subagent/index.ts'],
        );
        // Pi also discovers user-level skills (~/.agents/skills, ~/.pi/agent/skills); only the repository's own
        // skills are the managed resources under test, so an operator's personal skills must not move the count.
        const repositoryRealPath = realpathSync(repositoryRoot);
        const repositorySkills = loader.getSkills().skills.filter(skill => realpathSync(skill.filePath).startsWith(repositoryRealPath));
        assert.equal(repositorySkills.length, 60);
        assert.equal(loader.getPrompts().prompts.length, 18);
        const contextFiles = loader.getAgentsFiles().agentsFiles;
        assert.equal(contextFiles.length, 1);
        assert.match(contextFiles[0].content, /# Cratis — Project Instructions/);
        // Codex reads at most `project_doc_max_bytes` of AGENTS.md - 32 KiB by default - and silently drops the
        // rest, so the always-loaded instructions must stay under it with room for a consumer's own additions.
        // (https://developers.openai.com/codex/guides/agents-md)
        const codexProjectDocMaxBytes = 32 * 1024;
        const alwaysLoadedBytes = Buffer.byteLength(contextFiles[0].content, 'utf8');
        assert.ok(alwaysLoadedBytes <= codexProjectDocMaxBytes - 4 * 1024, `general.md is ${alwaysLoadedBytes} bytes; keep it at least 4 KiB under Codex's ${codexProjectDocMaxBytes}-byte cap`);
    } finally {
        rmSync(agentDirectory, { recursive: true, force: true });
    }
});

test('every supported harness resolves the canonical skill corpus', () => {
    for (const path of ['.claude/skills', '.agents/skills', '.github/skills', '.cursor/skills', '.opencode/skills', '.pi/skills']) {
        assert.equal(skillCount(join(repositoryRoot, path)), 60, path);
        assert.equal(realpathSync(join(repositoryRoot, path)), realpathSync(join(corpusRoot, 'skills')), path);
    }
});

test('every supported harness resolves canonical rules or shared project instructions', () => {
    assert.equal(realpathSync(join(repositoryRoot, '.claude', 'rules')), realpathSync(join(corpusRoot, 'rules')));
    assert.equal(realpathSync(join(repositoryRoot, '.github', 'instructions')), realpathSync(join(corpusRoot, 'rules')));
    assert.equal(realpathSync(join(repositoryRoot, 'AGENTS.md')), realpathSync(join(corpusRoot, 'rules', 'general.md')));
    assert.equal(realpathSync(join(repositoryRoot, 'CLAUDE.md')), realpathSync(join(corpusRoot, 'rules', 'general.md')));
    assert.match(readFileSync(join(repositoryRoot, '.cursor', 'rules', 'cratis.mdc'), 'utf8'), /\.cratis\/ai\/rules\/general\.md/);
});
