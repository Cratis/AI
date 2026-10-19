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
            ['cratis-hooks/index.ts', 'cratis-mcp/index.ts', 'cratis-path-guidance/index.ts', 'cratis-rules/index.ts', 'subagent/index.ts'],
        );
        // Pi also discovers user-level skills (~/.agents/skills, ~/.pi/agent/skills); only the repository's own
        // skills are the managed resources under test, so an operator's personal skills must not move the count.
        const repositoryRealPath = realpathSync(repositoryRoot);
        const repositorySkills = loader.getSkills().skills.filter(skill => realpathSync(skill.filePath).startsWith(repositoryRealPath));
        assert.equal(repositorySkills.length, 107);
        assert.equal(loader.getPrompts().prompts.length, 18);
        // A worktree nested under another checkout can also load that checkout's AGENTS.md.
        // Assert this repository's context is present exactly once, regardless of its ancestors.
        const contextFiles = loader.getAgentsFiles().agentsFiles.filter(file => file.path === join(repositoryRoot, 'AGENTS.md'));
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
        assert.equal(skillCount(join(repositoryRoot, path)), 107, path);
        assert.equal(realpathSync(join(repositoryRoot, path)), realpathSync(join(corpusRoot, 'skills')), path);
    }
});

test('Codex OpenCode and Cursor discover the authoring rule through the root policy', () => {
    const policy = join(corpusRoot, 'rules/general.md');
    const row = '| Authoring or reviewing skills, rules, agents or prompts | `authoring-skills.md` |';
    for (const harness of ['Codex', 'OpenCode']) {
        const entry = join(repositoryRoot, 'AGENTS.md');
        assert.equal(realpathSync(entry), realpathSync(policy), harness);
        assert.ok(readFileSync(entry, 'utf8').includes(row), harness);
    }
    const cursor = readFileSync(join(repositoryRoot, '.cursor/rules/cratis.mdc'), 'utf8');
    assert.match(cursor, /alwaysApply: true/);
    assert.match(cursor, /@\.cratis\/ai\/rules\/general\.md/);
    const general = readFileSync(policy, 'utf8');
    assert.ok(general.includes(row), 'Cursor follows the root policy to the authoring rule');
    assert.ok(lineCount(general) <= 200, 'authoring discovery must stay within the always-on budget');
    assert.ok(readFileSync(join(dirname(policy), 'authoring-skills.md'), 'utf8').includes('## 10. Review checklist'));
});

test('every path-scoped rule stays reachable in each harness', () => {
    const general = readFileSync(join(corpusRoot, 'rules/general.md'), 'utf8');
    const universal = new Set(['**', '**/*', '*']);
    const cursor = readFileSync(join(repositoryRoot, '.cursor/rules/cratis.mdc'), 'utf8');
    const scoped = readdirSync(join(corpusRoot, 'rules')).filter(name => name.endsWith('.md') && name !== 'general.md')
        .filter(name => {
            const fields = frontmatter(readFileSync(join(corpusRoot, 'rules', name), 'utf8'));
            return [...(fields.get('paths') ?? []), ...(fields.get('applyTo') ?? [])].some(glob => !universal.has(glob));
        });
    assert.ok(scoped.length > 30, 'the sweep must inspect the scoped rules');
    for (const name of scoped) {
        const canonical = readFileSync(join(corpusRoot, 'rules', name), 'utf8');
        const fields = frontmatter(canonical);
        // Claude Code: .claude/rules is the canonical directory and `paths` scopes the rule.
        assert.equal(readFileSync(join(repositoryRoot, '.claude/rules', name), 'utf8'), canonical, `${name}: Claude Code`);
        assert.ok(fields.has('paths'), `${name}: Claude Code needs paths`);
        // Copilot: a generated adapter carries the same scope.
        const adapter = readFileSync(join(repositoryRoot, '.github/instructions', name.replace(/\.md$/, '.instructions.md')), 'utf8');
        assert.ok(fields.has('applyTo') && /^applyTo:/m.test(adapter), `${name}: Copilot needs applyTo`);
        // Codex, OpenCode (AGENTS.md), Cursor (alwaysApply -> general.md) and Pi's static context have no scoped loading:
        // the root policy must name the rule so it can be read when the work needs it.
        assert.ok(general.includes(`\`${name}\``) || general.includes(`](./${name})`), `${name}: general.md must route to it`);
    }
    assert.match(cursor, /alwaysApply: true/);
});

test('rules a flow needs before any file is touched stay always-on in every harness', () => {
    // Committing, opening a pull request, writing a plan and the universal code principles edit no scoped file,
    // so no path scope can guarantee they load; they stay unscoped and general.md routes to them.
    const general = readFileSync(join(corpusRoot, 'rules/general.md'), 'utf8');
    for (const name of ['git-commits.md', 'pull-requests.md', 'local-work-artifacts.md', 'code-quality.md', 'glossary.md']) {
        const fields = frontmatter(readFileSync(join(corpusRoot, 'rules', name), 'utf8'));
        assert.ok(!fields.has('paths'), `${name}: Claude Code loads it at launch only without paths`);
        assert.deepEqual(fields.get('applyTo'), ['**/*'], `${name}: Copilot applies it to every file`);
        assert.ok(general.includes(`\`${name}\``) || general.includes(`](./${name})`), `${name}: general.md routes to it`);
        assert.match(readFileSync(join(repositoryRoot, '.github/instructions', name.replace(/\.md$/, '.instructions.md')), 'utf8'), /^applyTo: "\*\*\/\*"/m);
    }
});

test('fresh Go adapter trees expose root policy traversal separately from discoverable skills', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'cratis-go-harness-'));
    try {
        for (const [product, skill] of [['cratis/chronicle/client-go', 'cratis-chronicle-client-go'], ['cratis/arc/go', 'cratis-arc-go']]) {
            const project = join(workspace, skill);
            const corpus = join(project, '.cratis', 'ai');
            mkdirSync(corpus, { recursive: true });
            writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/engineering/go', product], languages: ['go'] }));
            // setup.ts wires an existing corpus; CLI profile installation is deliberately not simulated here.
            for (const directory of ['rules', 'agents', 'prompts', 'harnesses']) cpSync(join(corpusRoot, directory), join(corpus, directory), { recursive: true });
            for (const path of selectedSkillPaths(project)) cpSync(path, join(corpus, 'skills', path.split('/').pop()!), { recursive: true });
            const projectContext = '# Repository context\nModule paths and parity targets belong here.\n';
            writeFileSync(join(project, 'README.md'), projectContext);
            const setup = spawnSync(process.execPath, ['--import', 'tsx', join(repositoryRoot, 'Source/Harness.Setup/setup.ts'), project], { cwd: repositoryRoot, encoding: 'utf8' });
            assert.equal(setup.status, 0, `${setup.stdout}${setup.stderr}`);

            const harnesses = [
                ['claude', 'CLAUDE.md', '.claude/skills'],
                ['codex', 'AGENTS.md', '.agents/skills'],
                ['copilot', '.github/copilot-instructions.md', '.github/skills'],
                ['cursor', '.cursor/rules/cratis.mdc', '.cursor/skills'],
                ['opencode', 'AGENTS.md', '.opencode/skills'],
                ['pi', 'AGENTS.md', '.pi/skills'],
            ];
            for (const [harness, entry, skills] of harnesses) {
                let instructions = readFileSync(join(project, entry), 'utf8');
                if (harness === 'cursor') {
                    assert.match(instructions, /alwaysApply: true/);
                    assert.match(instructions, /@\.cratis\/ai\/rules\/general\.md/);
                    instructions = readFileSync(join(corpus, 'rules/general.md'), 'utf8');
                }
                assert.match(instructions, /Go style, source and module files.*`go\.md`.*`go-engineering\.md`/, harness);
                assert.match(instructions, /Read repository-owned documentation as the canonical project-specific context/, harness);
                assert.equal(readFileSync(join(project, 'README.md'), 'utf8'), projectContext, harness);
                const actualSkills = readdirSync(join(project, skills)).sort();
                assert.deepEqual(actualSkills, selectedSkillPaths(project).map(path => path.split('/').pop()).sort(), harness);
                assert.ok(actualSkills.includes(skill) && actualSkills.includes('cratis-fundamentals-concept-go'), harness);
                assert.equal(realpathSync(join(project, skills, skill, 'SKILL.md')), realpathSync(join(corpus, 'skills', skill, 'SKILL.md')), harness);
            }
            // Native Claude paths and Copilot applyTo declare the same scope; Codex/OpenCode/Cursor
            // traverse the root policy. This is adapter evidence, not a live model obeying that policy.
            for (const rule of ['go.md', 'go-engineering.md']) {
                const canonical = readFileSync(join(corpus, 'rules', rule), 'utf8');
                assert.equal(readFileSync(join(project, '.claude/rules', rule), 'utf8'), canonical);
                const copilotPath = join(project, '.github/instructions', rule.replace(/\.md$/, '.instructions.md'));
                const adapted = readFileSync(copilotPath, 'utf8');
                assert.ok(lstatSync(copilotPath).isFile(), 'Copilot adapters must survive a copied corpus');
                assert.equal(adapted.replace(/^<!-- cratis-ai: generated Copilot instructions\..* -->\n/m, ''), canonical);
                const fields = frontmatter(canonical);
                for (const field of ['paths', 'applyTo']) {
                    const globs = fields.get(field)!;
                    for (const path of ['main.go', 'Source/nested/main.go', 'go.mod', 'go.sum', 'adapter/go.mod', 'adapter/go.sum']) {
                        assert.ok(globs.some(glob => globToRegExp(glob).test(path)), `${rule} ${field}: ${path}`);
                    }
                    for (const path of ['README.md', 'main.cs', 'main.ts', 'go.mod.backup']) assert.ok(!globs.some(glob => globToRegExp(glob).test(path)), `${rule} ${field}: ${path}`);
                }
            }
            const loader = new DefaultResourceLoader({ cwd: project, agentDir: join(workspace, 'agent'), settingsManager: SettingsManager.inMemory(), noExtensions: true });
            await loader.reload();
            assert.ok(loader.getAgentsFiles().agentsFiles.some(file => file.path === join(project, 'AGENTS.md') && file.content.includes('go-engineering.md')));
            const loaded = loader.getSkills().skills.filter(candidate => candidate.filePath.startsWith(project)).map(candidate => candidate.name);
            assert.ok(loaded.includes(skill) && loaded.includes('cratis-fundamentals-concept-go'), 'fresh Pi SDK discovery');
        }
    } finally {
        rmSync(workspace, { recursive: true, force: true });
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
