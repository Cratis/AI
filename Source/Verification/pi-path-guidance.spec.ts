// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerPathGuidance from '../../.cratis/ai/harnesses/pi/extensions/cratis-path-guidance/index.ts';
import { standsDown } from '../../.cratis/ai/harnesses/pi/extensions/cratis-path-guidance/standDown.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillPathProblems } from './skill-paths.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const extensionsRoot = join(repositoryRoot, '.cratis', 'ai', 'harnesses', 'pi', 'extensions');

type Context = { cwd: string; hasUI?: boolean };
type Handler = (event: unknown, context: Context) => unknown;
type Result = { content: Array<{ text: string }> } | undefined;
type LoadedSkill = { name: string; filePath: string };

/** A Pi host that only records what the extension registers, as a subagent session would see it. */
function register(extension: (pi: ExtensionAPI) => void = registerPathGuidance): Map<string, Handler> {
    const handlers = new Map<string, Handler>();
    extension({
        on(name: string, handler: Handler) {
            handlers.set(name, handler);
        },
    } as unknown as ExtensionAPI);
    return handlers;
}

function textOf(result: Result): string {
    return result?.content.map(part => part.text).join('') ?? '';
}

function writeSkill(project: string, name: string, globs: string[]): LoadedSkill {
    const directory = join(project, '.cratis', 'ai', 'skills', name);
    mkdirSync(join(directory, 'references'), { recursive: true });
    const paths = globs.length === 0 ? '' : `paths:\n${globs.map(glob => `  - "${glob}"\n`).join('')}`;
    writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill.\n${paths}---\n\n# ${name}\n`);
    writeFileSync(join(directory, 'references', 'detail.md'), '# detail');
    return { name, filePath: join(directory, 'SKILL.md') };
}

/** A repository with one skill triggered by `for_*` C# files and one by documentation files. */
function projectWithSkills() {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    const specifications = writeSkill(project, 'demo-specifications', ['**/for_*/**/*.cs']);
    const documentation = writeSkill(project, 'demo-documentation', ['**/Documentation/**/*.{md,mdx}', '**/*.guide']);
    const untriggered = writeSkill(project, 'demo-untriggered', []);
    return { project, specifications, documentation, untriggered, all: [specifications, documentation, untriggered] };
}

function session(project: string, skills: LoadedSkill[] | undefined, context: Context = { cwd: project }) {
    const handlers = register();
    if (skills) handlers.get('before_agent_start')?.({ systemPrompt: 'base', systemPromptOptions: { cwd: project, skills } }, context);
    const call = (toolName: string, input: Record<string, unknown>, isError = false) =>
        handlers.get('tool_result')?.({ toolName, isError, input, content: [{ type: 'text', text: 'ok' }] }, context) as Result;
    return {
        handlers,
        write: (path: string) => call('write', { path }),
        edit: (path: string) => call('edit', { path }),
        read: (path: string) => call('read', { path }),
        bash: (command: string) => call('bash', { command }),
        call,
        context,
    };
}

const specificationPath = 'Source/for_Thing/when_doing/and_it_works.cs';

test('path guidance delivers a scoped rule once per session when its file is touched', () => {
    const handlers = register();
    const context = { cwd: repositoryRoot };
    const touch = (path: string, toolName = 'read') => handlers.get('tool_result')?.({ toolName, isError: false, input: { path }, content: [] }, context) as Result;
    assert.equal(handlers.has('before_agent_start'), true, 'skills are observed at agent start');
    const first = touch('Source/Thing.cs');
    assert.ok(first, 'expected the C# rules to be attached on first touch');
    assert.match(textOf(first), /# C# Conventions/);
    assert.match(textOf(first), /^\n\n\[cratis-rules\] Rules that apply to Source\/Thing\.cs:/);
    assert.equal(touch('Source/Other.cs'), undefined, 'the same rules must not be delivered twice in a session');
    assert.equal(touch('README.md'), undefined);
    assert.equal(touch('../outside.cs'), undefined);

    handlers.get('session_start')?.({}, context);
    assert.ok(touch('Source/Thing.cs'), 'a new session delivers the rules again');
});

test('path guidance re-delivers scoped rules after the conversation is rewritten', () => {
    for (const event of ['session_compact', 'session_before_switch']) {
        const handlers = register();
        const context = { cwd: repositoryRoot };
        const touch = () => handlers.get('tool_result')?.({ toolName: 'read', isError: false, input: { path: 'Source/Thing.cs' }, content: [] }, context) as Result;

        assert.ok(touch(), `${event}: first touch delivers`);
        assert.equal(touch(), undefined, `${event}: still delivered before the rewrite`);

        // A delivered rule lives in the conversation, so compaction or a switch can remove it.
        assert.ok(handlers.get(event), `${event} handler must be registered`);
        handlers.get(event)?.({}, context);
        const again = touch();
        assert.ok(again, `${event}: the rule must be delivered again once the conversation is rewritten`);
        assert.match(textOf(again), /# C# Conventions/);
    }
});

test('path guidance delivers scoped rules for files touched through bash', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    try {
        mkdirSync(join(project, 'Source'), { recursive: true });
        writeFileSync(join(project, 'Source', 'Thing.cs'), 'class Thing {}');
        writeFileSync(join(project, 'README.md'), '# readme');
        const guidance = session(project, undefined);

        // rtk.md directs bulk reads through the terminal, so this is how many sessions read source.
        const viaRtk = guidance.bash('rtk read Source/Thing.cs');
        assert.ok(viaRtk, 'a bash read of a .cs file must deliver the C# rules');
        assert.match(textOf(viaRtk), /# C# Conventions/);
        assert.equal(guidance.bash('cat Source/Thing.cs'), undefined, 'already delivered this session');

        guidance.handlers.get('session_start')?.({}, guidance.context);
        assert.ok(guidance.bash('grep -n "Thing" Source/Thing.cs'), 'grep with flags still finds the path');

        guidance.handlers.get('session_start')?.({}, guidance.context);
        assert.equal(guidance.bash('npm test'), undefined, 'a command with no file path delivers nothing');
        assert.equal(guidance.bash('git commit -m "fix Source/Missing.cs"'), undefined, 'a filename that does not exist is not a touch');
        assert.equal(guidance.bash('cat README.md'), undefined, 'no scoped rule matches README.md');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a successful write or edit of a matching path gets one hint naming the skill, its SKILL.md and the glob', () => {
    const { project, all, specifications } = projectWithSkills();
    try {
        const guidance = session(project, all);
        const result = guidance.write(specificationPath);
        const text = textOf(result);
        assert.match(text, /^ok/, 'the original tool result content is preserved');
        assert.match(text, /\[cratis-path-guidance\] Skill `demo-specifications` covers Source\/for_Thing\/when_doing\/and_it_works\.cs/);
        assert.ok(text.includes('matched `**/for_*/**/*.cs`'));
        assert.ok(text.includes(`read .cratis/ai/skills/demo-specifications/SKILL.md before continuing`), text);
        assert.equal(text.match(/\[cratis-path-guidance\]/g)?.length, 1, 'only the matching skill is named');
        assert.ok(specifications.filePath.endsWith('SKILL.md'));

        const documentation = textOf(session(project, all).edit('Documentation/guide/page.mdx'));
        assert.match(documentation, /Skill `demo-documentation`/);
        assert.ok(documentation.includes('matched `**/Documentation/**/*.{md,mdx}`'));
        assert.doesNotMatch(documentation, /demo-specifications/);
        assert.match(textOf(session(project, all).write('notes/intro.guide')), /matched `\*\*\/\*\.guide`/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a non-matching path, a read, a failed write and a skill without a trigger get no hint', () => {
    const { project, all } = projectWithSkills();
    try {
        const guidance = session(project, all);
        assert.equal(guidance.write('notes/todo.txt'), undefined, 'no skill trigger matches');
        assert.doesNotMatch(textOf(guidance.write('Source/Thing/other.cs')), /cratis-path-guidance/, 'not under a for_ folder');
        assert.doesNotMatch(textOf(guidance.read(specificationPath)), /cratis-path-guidance/, 'a read is not a write');
        // A bash read of a SKILL.md is not a write either; it happens in its own session because it marks the skill as read.
        assert.doesNotMatch(textOf(session(project, all).bash(`cat ${join(project, '.cratis/ai/skills/demo-specifications/SKILL.md')}`)), /cratis-path-guidance/);
        assert.equal(guidance.call('write', { path: specificationPath }, true), undefined, 'a failed write is not guided');
        assert.doesNotMatch(textOf(guidance.write('Anything/untriggered.md')), /demo-untriggered/);
        // The skill that never matched is still hinted on its own first match.
        assert.match(textOf(guidance.write(specificationPath)), /demo-specifications/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a skill the model already read in this session is not hinted', () => {
    const { project, all } = projectWithSkills();
    try {
        const viaRead = session(project, all);
        viaRead.read(join(project, '.cratis/ai/skills/demo-specifications/SKILL.md'));
        assert.doesNotMatch(textOf(viaRead.write(specificationPath)), /demo-specifications/, 'read of SKILL.md');

        const viaReference = session(project, all);
        viaReference.read('.cratis/ai/skills/demo-specifications/references/detail.md');
        assert.doesNotMatch(textOf(viaReference.write(specificationPath)), /demo-specifications/, 'read of a reference');

        const viaCat = session(project, all);
        viaCat.bash('cat .cratis/ai/skills/demo-specifications/SKILL.md');
        assert.doesNotMatch(textOf(viaCat.write(specificationPath)), /demo-specifications/, 'bash cat');

        const viaRtk = session(project, all);
        viaRtk.bash('rtk read .agents/skills/demo-specifications/SKILL.md');
        assert.doesNotMatch(textOf(viaRtk.write(specificationPath)), /demo-specifications/, 'bash rtk read on another harness folder');

        const viaGrep = session(project, all);
        viaGrep.bash(`grep -n "Establish" ${project}/.cratis/ai/skills/demo-specifications/SKILL.md | head`);
        assert.doesNotMatch(textOf(viaGrep.write(specificationPath)), /demo-specifications/, 'bash grep of an absolute path');

        const otherSkill = session(project, all);
        otherSkill.read('.cratis/ai/skills/demo-documentation/SKILL.md');
        assert.match(textOf(otherSkill.write(specificationPath)), /demo-specifications/, 'reading a different skill does not suppress this one');

        const failedRead = session(project, all);
        failedRead.call('read', { path: '.cratis/ai/skills/demo-specifications/SKILL.md' }, true);
        assert.match(textOf(failedRead.write(specificationPath)), /demo-specifications/, 'a failed read gave the model nothing');

        const afterReset = session(project, all);
        afterReset.read('.cratis/ai/skills/demo-specifications/SKILL.md');
        afterReset.handlers.get('session_compact')?.({}, afterReset.context);
        assert.match(textOf(afterReset.write(specificationPath)), /demo-specifications/, 'a compacted conversation no longer holds the skill');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a skill that is not available to the session is not hinted', () => {
    const { project, documentation, untriggered } = projectWithSkills();
    try {
        // Pi loaded only the documentation skill; the specifications skill exists on disk but is not selected.
        const guidance = session(project, [documentation, untriggered]);
        assert.doesNotMatch(textOf(guidance.write(specificationPath)), /demo-specifications/);
        assert.match(textOf(guidance.write('Documentation/page.md')), /demo-documentation/);

        // A session with skills switched off (pi-subagents `skills: false`) reports none; the repository's skills stand in.
        const none = session(project, []);
        assert.match(textOf(none.write(specificationPath)), /demo-specifications/, 'skills can still be read by path');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a skill is hinted once per session and again after the conversation is rewritten', () => {
    const { project, all } = projectWithSkills();
    try {
        const guidance = session(project, all);
        assert.match(textOf(guidance.write(specificationPath)), /demo-specifications/);
        assert.doesNotMatch(textOf(guidance.write('Source/for_Other/when_x.cs')), /cratis-path-guidance/, 'second write in the same session');
        assert.doesNotMatch(textOf(guidance.edit(specificationPath)), /cratis-path-guidance/, 'an edit counts as the same skill');

        guidance.handlers.get('session_start')?.({}, guidance.context);
        assert.match(textOf(guidance.write(specificationPath)), /demo-specifications/, 'a new session hints again');
        assert.doesNotMatch(textOf(guidance.write(specificationPath)), /cratis-path-guidance/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a session without UI, such as a subagent, still gets hints and rules', () => {
    const { project, all } = projectWithSkills();
    try {
        // No `ui` and `hasUI: false`, as in a print-mode or in-process subagent session.
        const guidance = session(project, all, { cwd: project, hasUI: false });
        const result = textOf(guidance.write(specificationPath));
        assert.match(result, /demo-specifications/);
        assert.match(result, /# C# Conventions/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('without Pi-reported skills the repository skills stand in, and the hint never touches the system prompt', () => {
    const { project } = projectWithSkills();
    try {
        const guidance = session(project, undefined);
        assert.match(textOf(guidance.write(specificationPath)), /demo-specifications/);

        const observed = guidance.handlers.get('before_agent_start')?.({ systemPrompt: 'base', systemPromptOptions: { cwd: project, skills: [] } }, guidance.context);
        assert.equal(observed, undefined, 'the extension only observes the loaded skills');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('the corpus skills declare triggers that match the conventions they teach', () => {
    const handlers = register();
    const context = { cwd: repositoryRoot };
    const skill = (name: string): LoadedSkill => ({ name, filePath: join(repositoryRoot, '.cratis', 'ai', 'skills', name, 'SKILL.md') });
    const names = ['cratis-specifications-csharp', 'cratis-specifications-typescript', 'cratis-documentation-writing', 'cratis-engineering-docs-authoring', 'cratis-technical-examples'];
    handlers.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: repositoryRoot, skills: names.map(skill) } }, context);
    const write = (path: string) => textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path }, content: [] }, context) as Result);

    const csharp = write('Source/for_Thing/when_doing.cs');
    assert.match(csharp, /Skill `cratis-specifications-csharp`/);
    assert.doesNotMatch(csharp, /cratis-specifications-typescript/);
    const typescript = write('Source/for_Thing/when_doing.ts');
    assert.match(typescript, /Skill `cratis-specifications-typescript`/);
    const documentation = write('Documentation/guides/page.md');
    for (const name of ['cratis-documentation-writing', 'cratis-engineering-docs-authoring', 'cratis-technical-examples']) {
        assert.match(documentation, new RegExp(`Skill \`${name}\``));
    }
    assert.equal(write('Source/Thing.cs').includes('cratis-specifications-csharp'), false, 'production code is not a specification');
});

test('cratis-path-guidance loads through the Pi SDK and works without cratis-rules', async () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    const agentDirectory = mkdtempSync(join(tmpdir(), 'cratis-guidance-agent-'));
    try {
        const loader = new DefaultResourceLoader({
            cwd: project,
            agentDir: agentDirectory,
            settingsManager: SettingsManager.inMemory(),
            noExtensions: true,
            noSkills: true,
            noPromptTemplates: true,
            noContextFiles: true,
            additionalExtensionPaths: [join(extensionsRoot, 'cratis-path-guidance', 'index.ts')],
        });
        await loader.reload();
        const { extensions, errors } = loader.getExtensions();
        assert.deepEqual(errors, []);
        assert.equal(extensions.length, 1);
        assert.ok(extensions[0].path.endsWith('cratis-path-guidance/index.ts'));
        const registered = [...extensions[0].handlers.keys()].sort();
        assert.deepEqual(registered, ['before_agent_start', 'session_before_switch', 'session_compact', 'session_start', 'tool_result']);
        assert.equal(extensions.some(extension => extension.path.includes('cratis-rules')), false);
    } finally {
        rmSync(project, { recursive: true, force: true });
        rmSync(agentDirectory, { recursive: true, force: true });
    }
});

test('the packaged copy stands down only for a managed installation that has its own copy', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    try {
        assert.equal(standsDown(true, project), false, 'nothing managed');
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.manifest.json'), '{}');
        assert.equal(standsDown(true, project), false, 'manifest without the managed extension');
        mkdirSync(join(project, '.pi', 'extensions', 'cratis-path-guidance'), { recursive: true });
        writeFileSync(join(project, '.pi', 'extensions', 'cratis-path-guidance', 'index.ts'), '');
        assert.equal(standsDown(true, project), true, 'managed installation present');
        assert.equal(standsDown(false, project), false, 'the managed copy never stands down');
        rmSync(join(project, '.cratis', 'ai.manifest.json'));
        assert.equal(standsDown(true, project), false, 'extension without a manifest is not a managed installation');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('the packaged copy resolves its shared helpers, delivers guidance, and stands down beside a managed copy', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'cratis-guidance-pack-'));
    const originalDirectory = process.cwd();
    try {
        // Lay the tree out the way prepare-package.mjs does: package/corpus/{rules,harnesses/pi/extensions}.
        const corpus = join(workspace, 'package', 'corpus');
        cpSync(join(repositoryRoot, '.cratis', 'ai', 'rules'), join(corpus, 'rules'), { recursive: true });
        cpSync(extensionsRoot, join(corpus, 'harnesses', 'pi', 'extensions'), { recursive: true });
        const skill = writeSkill(join(workspace, 'project'), 'demo-specifications', ['**/for_*/**/*.cs']);
        const packaged = (await import(pathToFileURL(join(corpus, 'harnesses', 'pi', 'extensions', 'cratis-path-guidance', 'index.ts')).href)).default as (pi: ExtensionAPI) => void;
        const project = join(workspace, 'project');

        process.chdir(project);
        const active = register(packaged);
        assert.ok(active.has('tool_result'), 'a project without a managed installation loads the packaged copy');
        active.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: project, skills: [skill] } }, { cwd: project });
        const delivered = textOf(active.get('tool_result')?.({ toolName: 'write', isError: false, input: { path: 'Source/for_Thing/when_x.cs' }, content: [] }, { cwd: project }) as Result);
        assert.match(delivered, /# C# Conventions/);
        assert.match(delivered, /demo-specifications/);

        mkdirSync(join(project, '.pi', 'extensions', 'cratis-path-guidance'), { recursive: true });
        writeFileSync(join(project, '.pi', 'extensions', 'cratis-path-guidance', 'index.ts'), '');
        writeFileSync(join(project, '.cratis', 'ai.manifest.json'), '{}');
        assert.equal(register(packaged).size, 0, 'the packaged copy registers nothing beside a managed copy');
    } finally {
        process.chdir(originalDirectory);
        rmSync(workspace, { recursive: true, force: true });
    }
});

test('the Pi package lists cratis-path-guidance and ships its shared helpers', () => {
    const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'Source', 'Pi.Plugin', 'package.json'), 'utf8')) as { pi: { extensions: string[] } };
    assert.ok(manifest.pi.extensions.includes('./package/corpus/harnesses/pi/extensions/cratis-path-guidance/index.ts'));
    assert.ok(existsSync(join(extensionsRoot, 'shared', 'rules.ts')));
});

test('skill paths must be non-empty valid globs, and skills without triggers are left alone', () => {
    const skill = (paths: string) => `---\nname: x\ndescription: y\n${paths}---\n\nBody\n`;
    assert.deepEqual(skillPathProblems('x/SKILL.md', skill('')), []);
    assert.deepEqual(skillPathProblems('x/SKILL.md', skill('paths:\n  - "**/for_*/**/*.cs"\n  - "Documentation/**/*.{md,mdx}"\n')), []);
    assert.match(skillPathProblems('x/SKILL.md', skill('paths:\n'))[0], /declares 'paths' without any glob/);
    assert.match(skillPathProblems('x/SKILL.md', skill('paths:\n  - ""\n'))[0], /invalid 'paths' entry '': it is empty/);
    assert.match(skillPathProblems('x/SKILL.md', skill('paths:\n  - "**/*"\n'))[0], /matches every file/);
    assert.match(skillPathProblems('x/SKILL.md', skill('paths:\n  - "**/*.{md"\n'))[0], /unbalanced braces/);
    assert.match(skillPathProblems('x/SKILL.md', skill('paths:\n  - "/abs/**/*.cs"\n'))[0], /repository-relative/);
    assert.equal(globProblem('**/for_*/**/*.cs'), undefined);
});

test('verify.ts rejects a skill with a bad paths entry and accepts the corpus without it', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'cratis-verify-'));
    try {
        for (const entry of ['.cratis', '.claude-plugin', '.cursor-plugin', '.github/workflows', '.github/plugin']) {
            cpSync(join(repositoryRoot, entry), join(workspace, entry), { recursive: true });
        }
        cpSync(join(repositoryRoot, '.agents', 'plugins'), join(workspace, '.agents', 'plugins'), { recursive: true });
        mkdirSync(join(workspace, 'Source', 'Pi.Plugin'), { recursive: true });
        cpSync(join(repositoryRoot, 'Source', 'Pi.Plugin', 'package.json'), join(workspace, 'Source', 'Pi.Plugin', 'package.json'));
        const verify = () => spawnSync(process.execPath, ['--import', 'tsx', join(repositoryRoot, 'Source', 'Verification', 'verify.ts'), workspace], { encoding: 'utf8', cwd: join(repositoryRoot, 'Source', 'Verification') });

        const skillFile = join(workspace, '.cratis', 'ai', 'skills', 'cratis-specifications-csharp', 'SKILL.md');
        const original = readFileSync(skillFile, 'utf8');
        assert.match(original, /\npaths:\n/, 'the corpus skill declares a trigger');
        const baseline = verify();
        assert.equal(baseline.status, 0, `${baseline.stdout}${baseline.stderr}`);

        writeFileSync(skillFile, original.replace('  - "**/for_*/**/*.cs"', '  - "**/*.{cs"'));
        const rejected = verify();
        assert.equal(rejected.status, 1, `${rejected.stdout}${rejected.stderr}`);
        assert.match(rejected.stderr, /cratis-specifications-csharp\/SKILL\.md has an invalid 'paths' entry/);
    } finally {
        rmSync(workspace, { recursive: true, force: true });
    }
});
