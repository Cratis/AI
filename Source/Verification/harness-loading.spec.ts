// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, lstatSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { checkCopilotInstructions, copilotInstructionsDirectory, copilotMarker, rewriteCopilotLinks } from '../Harness.Setup/copilot-instructions.ts';
import { frontmatter, frontmatterText, quotedScalar } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globToRegExp } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { lineCount } from './skill-structure.ts';

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
            ['cratis-hooks/index.ts', 'cratis-mcp/index.ts', 'cratis-path-guidance/index.ts', 'cratis-rules/index.ts'],
        );
        // Pi also discovers user-level skills (~/.agents/skills, ~/.pi/agent/skills); only the repository's own
        // skills are the managed resources under test, so an operator's personal skills must not move the count.
        const repositoryRealPath = realpathSync(repositoryRoot);
        const repositorySkills = loader.getSkills().skills.filter(skill => realpathSync(skill.filePath).startsWith(repositoryRealPath));
        assert.equal(repositorySkills.length, readdirSync(join(repositoryRoot, '.cratis/ai/skills')).length);
        assert.deepEqual(loader.getPrompts().prompts, []);
        // A worktree nested under another checkout can also load that checkout's AGENTS.md.
        // Assert this repository's context is present exactly once, regardless of its ancestors.
        const contextFiles = loader.getAgentsFiles().agentsFiles.filter(file => file.path === join(repositoryRoot, 'AGENTS.md'));
        assert.equal(contextFiles.length, 1);
        assert.match(contextFiles[0].content, /# Working with Cratis/);
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

test('relative Markdown links in every generated Copilot adapter resolve to existing files', () => {
    const directory = join(corpusRoot, copilotInstructionsDirectory);
    let relativeLinks = 0;
    for (const name of readdirSync(directory)) {
        const adapter = join(directory, name);
        const body = readFileSync(adapter, 'utf8')
            .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*(?:\n|$)/gm, '')
            .replace(/(`+)[^\n]*?\1/g, '');
        for (const match of body.matchAll(/\]\((<[^>\n]+>|[^\s)]+)|^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|[^\s]+)/gm)) {
            const target = (match[1] ?? match[2]).replace(/^<|>$/g, '');
            if (/^(?:[A-Za-z][\w+.-]*:|\/|#|\?)/.test(target)) continue;
            const path = resolve(dirname(adapter), decodeURIComponent(target.split(/[?#]/)[0]));
            assert.ok(existsSync(path) && statSync(path).isFile(), `${name}: ${target} must resolve to an existing file`);
            relativeLinks++;
        }
    }
    assert.ok(relativeLinks > 0, 'the link sweep must not pass without inspecting relative links');
});

test('Copilot link rewriting preserves destinations, fragments, query strings and examples', () => {
    const source = join(corpusRoot, 'rules');
    const adapters = join(corpusRoot, copilotInstructionsDirectory);
    const generated = new Set([join(source, 'concepts.md')]);
    const body = '[Concepts](./concepts.md#invariants) [General](./general.md) [Skill](../skills/demo/SKILL.md?raw=1#usage)\n'
        + '[terms]: ./concepts.md "Terms"\n![Skill](<../skills/demo/SKILL.md>) [Notes](../skills/My%20Skill/SKILL.md)\n'
        + '[Web](https://example.com/docs) [Anchor](#local) [Route](/docs/)\n'
        + '`[Example](./concepts.md)`\n```markdown\n[Example](./concepts.md)\n```\n';
    const expected = '[Concepts](./concepts.instructions.md#invariants) [General](../../../rules/general.md) [Skill](../../../skills/demo/SKILL.md?raw=1#usage)\n'
        + '[terms]: ./concepts.instructions.md "Terms"\n![Skill](<../../../skills/demo/SKILL.md>) [Notes](../../../skills/My%20Skill/SKILL.md)\n'
        + '[Web](https://example.com/docs) [Anchor](#local) [Route](/docs/)\n'
        + '`[Example](./concepts.md)`\n```markdown\n[Example](./concepts.md)\n```\n';
    assert.equal(rewriteCopilotLinks(body, source, adapters, generated), expected);
});

test('every supported harness resolves canonical rules or shared project instructions', () => {
    assert.equal(realpathSync(join(repositoryRoot, '.claude', 'rules')), realpathSync(join(corpusRoot, 'rules')));
    const copilotDirectory = join(repositoryRoot, '.github/instructions');
    assert.equal(realpathSync(copilotDirectory), realpathSync(join(corpusRoot, copilotInstructionsDirectory)));
    assert.deepEqual(checkCopilotInstructions(corpusRoot), []);
    const pathRules = readdirSync(join(corpusRoot, 'rules')).filter(name => frontmatter(readFileSync(join(corpusRoot, 'rules', name), 'utf8')).has('applyTo'));
    assert.deepEqual(readdirSync(copilotDirectory).sort(), pathRules.map(name => name.replace(/\.md$/, '.instructions.md')).sort());
    for (const rule of pathRules) {
        const path = join(copilotDirectory, rule.replace(/\.md$/, '.instructions.md'));
        assert.ok(lstatSync(path).isFile(), `${rule}: portable adapters are files, not symlinks`);
        assert.equal(realpathSync(path), realpathSync(join(corpusRoot, copilotInstructionsDirectory, rule.replace(/\.md$/, '.instructions.md'))));
        assert.ok(readFileSync(path, 'utf8').includes(copilotMarker));
        const fields = frontmatterText(readFileSync(path, 'utf8'))!;
        const raw = /^applyTo:\s*(.+)$/m.exec(fields)?.[1];
        assert.ok(raw && quotedScalar(raw)?.trim(), `${rule}: Copilot needs a quoted glob string, not a YAML list`);
    }
    const rootPath = join(repositoryRoot, '.github/copilot-instructions.md');
    assert.equal(readlinkSync(rootPath), '../.cratis/ai/rules/general.md', 'preserve the original repository-wide instruction adapter');
    assert.equal(realpathSync(rootPath), realpathSync(join(corpusRoot, 'rules/general.md')));
    assert.equal(readFileSync(rootPath, 'utf8'), readFileSync(join(corpusRoot, 'rules/general.md'), 'utf8'), 'repository-wide policy is unchanged');
    for (const name of readdirSync(join(corpusRoot, 'rules'))) {
        const content = readFileSync(join(corpusRoot, 'rules', name), 'utf8');
        if (!frontmatter(content).has('applyTo')) {
            assert.ok(!existsSync(join(copilotDirectory, name.replace(/\.md$/, '.instructions.md'))), `${name}: universal rules are not path adapters`);
        }
    }
    assert.equal(realpathSync(join(repositoryRoot, 'AGENTS.md')), realpathSync(join(corpusRoot, 'rules', 'general.md')));
    assert.equal(realpathSync(join(repositoryRoot, 'CLAUDE.md')), realpathSync(join(corpusRoot, 'rules', 'general.md')));
    assert.match(readFileSync(join(repositoryRoot, '.cursor', 'rules', 'cratis.mdc'), 'utf8'), /\.cratis\/ai\/rules\/general\.md/);
});
