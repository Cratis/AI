// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerPathGuidance from '../../.cratis/ai/harnesses/pi/extensions/cratis-path-guidance/index.ts';
import { standsDown } from '../../.cratis/ai/harnesses/pi/extensions/cratis-path-guidance/standDown.ts';
import { skillsRead } from '../../.cratis/ai/harnesses/pi/extensions/cratis-path-guidance/skillReads.ts';
import { frontmatterBlock, frontmatterMap } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { skillTriggerGlobs, skillTriggerKey } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillFrontmatter.ts';
import { selectedSkillNames } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillSelection.ts';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillFrontmatterProblems } from './skill-paths.ts';

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

function writeSkill(project: string, name: string, globs: string[], skillsRoot = join(project, '.cratis', 'ai', 'skills')): LoadedSkill {
    const directory = join(skillsRoot, name);
    mkdirSync(join(directory, 'references'), { recursive: true });
    const paths = globs.length === 0 ? '' : `metadata:\n  ${skillTriggerKey}: "${globs.join(' ')}"\n`;
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
        assert.ok(text.includes('[cratis-path-guidance] Skill `demo-specifications` (matched `**/for_*/**/*.cs`) covers Source/for_Thing/when_doing/and_it_works.cs;'), text);
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

test('the repository skills are hinted whether or not Pi loaded them, and a loaded skill is not duplicated', () => {
    const { project, documentation, untriggered } = projectWithSkills();
    try {
        // Pi loaded only the documentation skill; the repository's specifications skill can still be read by path.
        const guidance = session(project, [documentation, untriggered]);
        assert.match(textOf(guidance.write(specificationPath)), /demo-specifications/);
        const text = textOf(guidance.write('Documentation/page.md'));
        assert.match(text, /demo-documentation/);
        assert.equal(text.match(/demo-documentation/g)?.length, 2, 'named once, with its SKILL.md path');

        // A loaded skill wins over the repository copy of the same name, so it is one hint with the loaded file.
        const elsewhere = writeSkill(project, 'demo-documentation', ['**/Documentation/**/*.{md,mdx}'], join(project, 'elsewhere'));
        const loaded = textOf(session(project, [elsewhere]).write('Documentation/page.md'));
        assert.equal(loaded.match(/\[cratis-path-guidance\]/g)?.length, 1, loaded);
        assert.equal(loaded.match(/`demo-documentation`/g)?.length, 1, 'not duplicated');
        assert.ok(loaded.includes('read elsewhere/demo-documentation/SKILL.md'), loaded);

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
    const names = [
        'cratis-specifications-csharp', 'cratis-specifications-typescript', 'cratis-application-slice-specifications', 'cratis-application-react-specifications',
        'cratis-documentation-writing', 'cratis-engineering-docs-authoring', 'cratis-technical-examples',
    ];
    handlers.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: repositoryRoot, skills: names.map(skill) } }, context);
    const write = (path: string) => textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path }, content: [] }, context) as Result);
    const named = (text: string) => names.filter(name => text.includes(`\`${name}\``));
    const reset = () => handlers.get('session_start')?.({}, context);

    // A for_ specification names the framework C# skill and the slice skill, in one line.
    const csharp = write('Source/for_Thing/when_doing.cs');
    assert.deepEqual(named(csharp), ['cratis-specifications-csharp', 'cratis-application-slice-specifications']);
    assert.equal(csharp.match(/\[cratis-path-guidance\]/g)?.length, 1, 'one combined line');
    reset();
    // The slice skill teaches `<Slice>/when_<verb>/and_<condition>.cs` with no for_ folder, and must still be hinted.
    assert.deepEqual(named(write('Features/Projects/Registration/when_registering/and_name_is_unique.cs')), ['cratis-application-slice-specifications']);
    reset();
    assert.deepEqual(named(write('Source/for_Thing/when_doing.ts')), ['cratis-specifications-typescript', 'cratis-application-react-specifications']);
    reset();
    // A documentation page brings the two authoring skills in one line; runnable-sample guidance is for samples.
    const documentation = write('Documentation/guides/page.md');
    assert.deepEqual(named(documentation), ['cratis-documentation-writing', 'cratis-engineering-docs-authoring']);
    assert.equal(documentation.match(/\[cratis-path-guidance\]/g)?.length, 1, 'one combined line');
    reset();
    assert.deepEqual(named(write('Samples/Quickstart/Program.cs')), ['cratis-technical-examples']);
    reset();
    assert.equal(write('Source/Thing.cs').includes('cratis-specifications-csharp'), false, 'production code is not a specification');
});

test('several matching skills are named in one line that lists each skill, glob and SKILL.md', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    try {
        const first = writeSkill(project, 'demo-first', ['**/Documentation/**/*.md']);
        const second = writeSkill(project, 'demo-second', ['Documentation/**/*.md']);
        const third = writeSkill(project, 'demo-third', ['**/*.md']);
        const text = textOf(session(project, [first, second, third]).write('Documentation/page.md'));
        assert.equal(text.match(/\[cratis-path-guidance\]/g)?.length, 1, text);
        assert.ok(text.includes('Skills `demo-first` (matched `**/Documentation/**/*.md`), `demo-second` (matched `Documentation/**/*.md`) and `demo-third` (matched `**/*.md`) cover Documentation/page.md;'), text);
        assert.ok(text.includes('read .cratis/ai/skills/demo-first/SKILL.md, .cratis/ai/skills/demo-second/SKILL.md and .cratis/ai/skills/demo-third/SKILL.md before continuing.'), text);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a skill that is already in context is not hinted: preloaded by pi-subagents or expanded by /skill', () => {
    const { project, all } = projectWithSkills();
    try {
        // pi-subagents `skills: a` reports no loaded skills and preloads the text into the system prompt.
        const preloaded = register();
        const context = { cwd: project };
        preloaded.get('before_agent_start')?.({
            systemPrompt: 'base\n\n# Preloaded Skill: demo-specifications\n\nfull text',
            systemPromptOptions: { cwd: project, skills: [] },
        }, context);
        const write = (path: string) => textOf(preloaded.get('tool_result')?.({ toolName: 'write', isError: false, input: { path }, content: [] }, context) as Result);
        assert.doesNotMatch(write(specificationPath), /demo-specifications/, 'preloaded skill');
        assert.match(write('Documentation/page.md'), /demo-documentation/, 'other repository skills are still hinted');
        preloaded.get('session_compact')?.({}, context);
        assert.doesNotMatch(write('Source/for_Other/when_x.cs'), /demo-specifications/, 'the system prompt survives compaction');

        // pi-subagents writes the header even when it could not load the skill (a managed installation exposes
        // `.pi/skills` as a symlink, which its loader rejects), so a header alone is not the skill's text.
        const preloadedWrite = (systemPrompt: string) => {
            const handlers = register();
            handlers.get('before_agent_start')?.({ systemPrompt, systemPromptOptions: { cwd: project, skills: [] } }, context);
            return textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path: specificationPath }, content: [] }, context) as Result);
        };
        const header = 'base\n\n# Preloaded Skill: demo-specifications\n';
        assert.match(preloadedWrite(`${header}(Skill "demo-specifications" not found in .pi/skills/, .agents/skills/, or global skill locations)`), /demo-specifications/, 'not found');
        assert.match(preloadedWrite(`${header}(Skill "demo-specifications" skipped: name contains path traversal characters)`), /demo-specifications/, 'skipped');
        assert.match(preloadedWrite(header), /demo-specifications/, 'no content');
        assert.match(preloadedWrite(`${header}\n\n# Preloaded Skill: demo-other\nreal text`), /demo-specifications/, 'an empty block is not the next skill\'s text');
        assert.doesNotMatch(preloadedWrite(`${header}---\nname: demo-specifications\n---\n\n# demo-specifications\n`), /demo-specifications/, 'frontmatter and body as pi-subagents writes it');
        assert.doesNotMatch(preloadedWrite(`base\n\n# Preloaded Skill: demo-other\n(Skill "demo-other" not found in x)\n\n# Preloaded Skill: demo-specifications\ntext`), /demo-specifications/, 'a later real block counts');

        // `/skill:demo-specifications` expands into the user message; no read call happens.
        const expanded = session(project, all);
        expanded.handlers.get('before_agent_start')?.({
            systemPrompt: 'base',
            prompt: '<skill name="demo-specifications" location="x">\nbody\n</skill>\n\nDo it',
            systemPromptOptions: { cwd: project, skills: all },
        }, expanded.context);
        assert.doesNotMatch(textOf(expanded.write(specificationPath)), /demo-specifications/, 'expanded skill');
        expanded.handlers.get('session_compact')?.({}, expanded.context);
        assert.match(textOf(expanded.write(specificationPath)), /demo-specifications/, 'a compacted conversation no longer holds the expansion');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('only a command that reads a skill document counts as a shell read', () => {
    const { project, all, specifications } = projectWithSkills();
    try {
        const skill = 'demo-specifications';
        const trigger = { name: skill, filePath: specifications.filePath, baseDir: join(project, '.cratis', 'ai', 'skills', skill), globs: [] };
        const reads = (command: string) => skillsRead('bash', { command }, [trigger]).length === 1;
        const document = `.cratis/ai/skills/${skill}/SKILL.md`;
        const reference = `.cratis/ai/skills/${skill}/references/detail.md`;

        for (const command of [
            `cat ${document}`, `head -40 ${document}`, `tail -n 20 ${reference}`, `sed -n '1,80p' ${document}`, `less ${document}`, `bat ${document}`,
            `rg -n Establish ${document}`, `grep -n "x" ${reference}`, `rtk read ${document}`, `rtk grep foo ${reference}`, `cd repo && cat ${document}`,
            `cat "${join(project, document)}" | head`, `cat .agents/skills/${skill}/SKILL.md`,
        ]) assert.equal(reads(command), true, command);

        for (const command of [
            `ls .cratis/ai/skills/${skill}`, `ls -la .cratis/ai/skills/${skill}/`, `git diff -- ${document}`, `git add ${document}`, `git log -- ${document}`,
            `echo "cat ${document}"`, `git commit -m "update ${document}"`, `cat README.md`, `cat .cratis/ai/skills/${skill}/assets/logo.txt`,
            `ls ${document} && echo done`, `cat other/skills/${skill}-extra/SKILL.md`,
        ]) assert.equal(reads(command), false, command);

        // The read tool opens the file itself, so any file in the skill's directory counts.
        assert.equal(skillsRead('read', { path: reference }, [trigger]).length, 1);

        // A listing suppresses nothing: the hint still fires afterwards.
        const listed = session(project, all);
        listed.bash(`ls .cratis/ai/skills/${skill}`);
        listed.bash(`git diff -- ${document}`);
        assert.match(textOf(listed.write(specificationPath)), /demo-specifications/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

/** Lays out `package/corpus` (rules, extensions, skills) and `package/profile-catalog.json` the way prepare-package.mjs does. */
function packagedWorkspace(skills: Record<string, string[]>, catalog?: object) {
    const workspace = mkdtempSync(join(tmpdir(), 'cratis-guidance-pack-'));
    const corpus = join(workspace, 'package', 'corpus');
    cpSync(join(repositoryRoot, '.cratis', 'ai', 'rules'), join(corpus, 'rules'), { recursive: true });
    cpSync(extensionsRoot, join(corpus, 'harnesses', 'pi', 'extensions'), { recursive: true });
    for (const [name, globs] of Object.entries(skills)) writeSkill(workspace, name, globs, join(corpus, 'skills'));
    if (catalog) writeFileSync(join(workspace, 'package', 'profile-catalog.json'), JSON.stringify(catalog));
    const project = join(workspace, 'project');
    mkdirSync(join(project, '.cratis'), { recursive: true });
    return { workspace, project, corpus };
}

async function loadPackaged(corpus: string): Promise<(pi: ExtensionAPI) => void> {
    return (await import(pathToFileURL(join(corpus, 'harnesses', 'pi', 'extensions', 'cratis-path-guidance', 'index.ts')).href)).default as (pi: ExtensionAPI) => void;
}

test('the packaged copy hints only the skills the repository selected when the session reports none', async () => {
    const catalog = {
        publicProfiles: [
            { id: 'demo/slices', availableTargets: ['demo-slice-specifications'] },
            { id: 'demo/framework', availableTargets: ['demo-framework-specifications'] },
        ],
        engineeringProfiles: [],
    };
    const { workspace, project, corpus } = packagedWorkspace({
        'demo-slice-specifications': ['**/for_*/**/*.cs'],
        'demo-framework-specifications': ['**/for_*/**/*.cs'],
    }, catalog);
    const originalDirectory = process.cwd();
    try {
        const packaged = await loadPackaged(corpus);
        process.chdir(project);
        const write = (skills: LoadedSkill[] | undefined) => {
            const handlers = register(packaged);
            handlers.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: project, skills } }, { cwd: project });
            return textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path: 'Source/for_Thing/when_x.cs' }, content: [] }, { cwd: project }) as Result);
        };

        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['demo/slices'] }));
        const selected = write([]);
        assert.match(selected, /demo-slice-specifications/);
        assert.doesNotMatch(selected, /demo-framework-specifications/, 'a skill the repository did not select is never hinted');

        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['demo/framework'] }));
        const other = write(undefined);
        assert.match(other, /demo-framework-specifications/);
        assert.doesNotMatch(other, /demo-slice-specifications/);

        rmSync(join(project, '.cratis', 'ai.json'));
        const unconfigured = write([]);
        assert.match(unconfigured, /demo-slice-specifications/, 'without ai.json the package loads every skill');
        assert.match(unconfigured, /demo-framework-specifications/);
    } finally {
        process.chdir(originalDirectory);
        rmSync(workspace, { recursive: true, force: true });
    }
});

test('the packaged copy hints a selected skill when Pi loaded only unrelated skills, and never an unselected one', async () => {
    const catalog = {
        publicProfiles: [
            { id: 'demo/slices', availableTargets: ['demo-slice-specifications'] },
            { id: 'demo/framework', availableTargets: ['demo-framework-specifications'] },
        ],
        engineeringProfiles: [],
    };
    const { workspace, project, corpus } = packagedWorkspace({
        'demo-slice-specifications': ['**/for_*/**/*.cs'],
        'demo-framework-specifications': ['**/for_*/**/*.cs'],
    }, catalog);
    const originalDirectory = process.cwd();
    try {
        const packaged = await loadPackaged(corpus);
        process.chdir(project);
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['demo/slices'] }));
        // A personal skill without a trigger, from ~/.pi/agent/skills: the list is non-empty but holds no Cratis skill.
        const personal = writeSkill(workspace, 'personal-notes', [], join(workspace, 'home', 'skills'));
        const write = (skills: LoadedSkill[]) => {
            const handlers = register(packaged);
            handlers.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: project, skills } }, { cwd: project });
            return textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path: 'Source/for_Thing/when_x.cs' }, content: [] }, { cwd: project }) as Result);
        };

        const hinted = write([personal]);
        assert.match(hinted, /demo-slice-specifications/, 'a personal skill list does not hide the selected skill');
        assert.doesNotMatch(hinted, /demo-framework-specifications/, 'an unselected corpus skill is never hinted');

        // The selected skill is also loaded (the extension allowlist kept @cratis/pi): one hint, with the loaded file.
        const loaded = writeSkill(workspace, 'demo-slice-specifications', ['**/for_*/**/*.cs'], join(workspace, 'loaded'));
        const both = write([personal, loaded]);
        assert.equal(both.match(/`demo-slice-specifications`/g)?.length, 1, both);
        assert.ok(both.includes('loaded/demo-slice-specifications/SKILL.md') || both.includes(join(workspace, 'loaded', 'demo-slice-specifications', 'SKILL.md')), both);
    } finally {
        process.chdir(originalDirectory);
        rmSync(workspace, { recursive: true, force: true });
    }
});

test('the packaged copy hints nothing from the fallback when the selection cannot be resolved', async () => {
    const { workspace, project, corpus } = packagedWorkspace({ 'demo-specifications': ['**/for_*/**/*.cs'] });
    const originalDirectory = process.cwd();
    try {
        const packaged = await loadPackaged(corpus);
        process.chdir(project);
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['demo/unknown'] }));
        const handlers = register(packaged);
        handlers.get('before_agent_start')?.({ systemPrompt: '', systemPromptOptions: { cwd: project, skills: [] } }, { cwd: project });
        const result = textOf(handlers.get('tool_result')?.({ toolName: 'write', isError: false, input: { path: 'Source/for_Thing/when_x.cs' }, content: [] }, { cwd: project }) as Result);
        assert.doesNotMatch(result, /cratis-path-guidance/, 'no catalog and an unknown profile give no hint, never every packaged skill');
    } finally {
        process.chdir(originalDirectory);
        rmSync(workspace, { recursive: true, force: true });
    }
});

test('the skill selection path guidance uses equals the one @cratis/pi loads', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    try {
        mkdirSync(join(project, '.cratis'));
        const names = (paths: string[]) => paths.map(path => path.split('/').pop()).sort();
        assert.deepEqual(selectedSkillNames(project), names(selectedSkillPaths(project)), 'no configuration');
        for (const configuration of [
            { profiles: ['cratis/application/csharp'], languages: ['csharp'] },
            { profiles: ['cratis/engineering/csharp', 'cratis/documentation'], languages: ['csharp'] },
            { profiles: ['cratis/application/csharp'], languages: ['csharp', 'typescript'] },
        ]) {
            writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(configuration));
            assert.deepEqual(selectedSkillNames(project), names(selectedSkillPaths(project)), JSON.stringify(configuration));
        }
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['no/such-profile'] }));
        assert.equal(selectedSkillNames(project), undefined);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
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

test('the packaged copy stands down whenever a managed installation already delivers path guidance', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-guidance-'));
    const managedExtension = (name: string, content: string) => {
        mkdirSync(join(project, '.pi', 'extensions', name), { recursive: true });
        writeFileSync(join(project, '.pi', 'extensions', name, 'index.ts'), content);
    };
    try {
        assert.equal(standsDown(true, project), false, 'nothing managed');
        mkdirSync(join(project, '.cratis'));
        managedExtension('cratis-path-guidance', '');
        assert.equal(standsDown(true, project), false, 'an extension without a manifest is not a managed installation');
        writeFileSync(join(project, '.cratis', 'ai.manifest.json'), '{}');
        assert.equal(standsDown(true, project), true, 'managed cratis-path-guidance delivers rules and hints');
        assert.equal(standsDown(false, project), false, 'the managed copy never stands down');

        // Installations made before cratis-path-guidance: every historical cratis-rules delivers path-scoped rules itself.
        rmSync(join(project, '.pi'), { recursive: true });
        assert.equal(standsDown(true, project), false, 'manifest without any managed Pi extension: nothing else delivers guidance');
        const generations: Record<string, string> = {
            // 6b0bb54, 5b048c6: every rule concatenated into the system prompt on before_agent_start.
            'concatenates every rule': "import { readdirSync } from 'node:fs';\nexport function managedRules(cwd: string): string { return ''; }\nexport default function (pi) {\n    pi.on('before_agent_start', (event, context) => ({ systemPrompt: `${event.systemPrompt}\\n\\n${managedRules(context.cwd)}` }));\n}\n",
            // aca9c6b, 59362cf: universal rules in the system prompt, path-scoped rules on tool_result (read, write, edit).
            'tool_result for read, write and edit': "export function universalRules(cwd) { return []; }\nexport default function (pi) {\n    pi.on('session_start', () => {});\n    pi.on('before_agent_start', () => undefined);\n    pi.on('tool_result', () => undefined);\n}\n",
            // 1937b06, eec744a: the same, also for bash and re-delivered after compaction.
            'tool_result for bash and compaction': "function touchedPaths() { return []; }\nexport default function (pi) {\n    pi.on('session_compact', () => {});\n    pi.on('before_agent_start', () => undefined);\n    pi.on(\"tool_result\", () => undefined);\n}\n",
        };
        for (const [generation, content] of Object.entries(generations)) {
            managedExtension('cratis-rules', content);
            assert.equal(standsDown(true, project), true, `cratis-rules that ${generation} would deliver every path rule twice`);
        }
        managedExtension('cratis-rules', '');
        assert.equal(standsDown(true, project), true, 'an unrecognisable cratis-rules is not trusted');

        // The current cratis-rules delivers only universal rules, so the packaged copy is the only source of path guidance.
        managedExtension('cratis-rules', readFileSync(join(extensionsRoot, 'cratis-rules', 'index.ts'), 'utf8'));
        assert.equal(standsDown(true, project), false, 'universal-only cratis-rules does not deliver path rules');
        managedExtension('cratis-path-guidance', '');
        assert.equal(standsDown(true, project), true, 'a current managed installation');
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

test('skill path hints under metadata must be a non-empty string of valid globs, and skills without triggers are left alone', () => {
    const skill = (frontmatterLines: string) => `---\nname: x\ndescription: y\n${frontmatterLines}---\n\nBody\n`;
    const hint = (value: string) => skill(`metadata:\n  ${skillTriggerKey}: ${value}\n`);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', skill('')), []);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', skill('metadata:\n  other: value\n')), []);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', hint('"**/for_*/**/*.cs"')), []);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', hint('"**/for_*/**/*.cs Documentation/**/*.{md,mdx}"')), []);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hint('""'))[0], /declares 'metadata.cratis-hint-paths' without any glob/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hint('"   "'))[0], /declares 'metadata.cratis-hint-paths' without any glob/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hint('"**/*"'))[0], /matches every file/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hint('"**/for_*/**/*.cs **/*.{md"'))[0], /invalid 'metadata.cratis-hint-paths' entry '\*\*\/\*\.\{md': it .*unbalanced braces/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hint('"/abs/**/*.cs"'))[0], /repository-relative/);
    assert.equal(globProblem('**/for_*/**/*.cs'), undefined);
    // A top-level key is outside the Agent Skills set, so it is refused rather than read as a hint, whatever its shape.
    assert.match(skillFrontmatterProblems('x/SKILL.md', skill(`${skillTriggerKey}:\n  - "**/for_*/**/*.cs"\n`))[0], /declares 'cratis-hint-paths' as a top-level key, which Agent Skills does not allow; declare it under 'metadata'/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', skill(`${skillTriggerKey}: "**/for_*/**/*.cs"\n`))[0], /as a top-level key/);
    // A plain `paths` key is Claude Code's conditional-activation switch, so it is refused rather than read as a hint.
    assert.match(skillFrontmatterProblems('x/SKILL.md', skill('paths:\n  - "**/for_*/**/*.cs"\n'))[0], /declares 'paths', which Claude Code treats as conditional activation; use 'metadata.cratis-hint-paths'/);
});

test('metadata.cratis-hint-paths is read as whitespace-separated globs, keeping the commas of brace sets', () => {
    const skill = (frontmatterLines: string) => `---\nname: x\ndescription: y\n${frontmatterLines}---\n\nBody\n`;
    assert.deepEqual(skillTriggerGlobs(skill('')), []);
    assert.deepEqual(skillTriggerGlobs(skill(`metadata:\n  ${skillTriggerKey}: "**/for_*/**/*.ts **/for_*/**/*.tsx"\n`)), ['**/for_*/**/*.ts', '**/for_*/**/*.tsx']);
    assert.deepEqual(skillTriggerGlobs(skill(`metadata:\n  ${skillTriggerKey}: "**/Samples/**/*.{cs,ts,tsx}  **/Documentation/**/*.{md,mdx}"\n`)), ['**/Samples/**/*.{cs,ts,tsx}', '**/Documentation/**/*.{md,mdx}']);
    // Neighboring metadata entries and later top-level keys do not leak into the value.
    assert.deepEqual(skillTriggerGlobs(skill(`metadata:\n  author: cratis\n  ${skillTriggerKey}: "a/*.cs"\n  version: "1"\nlicense: MIT\n`)), ['a/*.cs']);
    // A top-level key is not a hint.
    assert.deepEqual(skillTriggerGlobs(skill(`${skillTriggerKey}:\n  - "a/*.cs"\n`)), []);
});

const skillWith = (frontmatterLines: string) => `---\nname: x\ndescription: y\n${frontmatterLines}---\n\nBody\n`;
const hintUnder = (lines: string) => skillWith(`metadata:\n${lines}`);

test('the one supported hint form is a one-line quoted string indented two spaces, and double or single quotes both work', () => {
    for (const value of ['"a/*.cs b/*.ts"', "'a/*.cs b/*.ts'", '"a/*.cs b/*.ts"   ']) {
        const content = hintUnder(`  ${skillTriggerKey}: ${value}\n`);
        assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', content), [], value);
        assert.deepEqual(skillTriggerGlobs(content), ['a/*.cs', 'b/*.ts'], value);
    }
    // Comment lines and other entries around it do not matter, and a later top-level key ends the block.
    const surrounded = hintUnder(`  # note\n  author: cratis\n\n  ${skillTriggerKey}: "a/*.cs"\n  version: "1"\nlicense: MIT\n`);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', surrounded), []);
    assert.deepEqual(skillTriggerGlobs(surrounded), ['a/*.cs']);
});

test('any top-level line ends the metadata block, however the key is spelled, so the hint is still read', () => {
    const hint = `  ${skillTriggerKey}: "a/*.cs"\n`;
    for (const following of ['"license": MIT\n', "'license': MIT\n", 'license : MIT\n', 'license: MIT\n', '# note\nlicense: MIT\n']) {
        const content = hintUnder(`${hint}${following}`);
        assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', content), [], JSON.stringify(following));
        assert.deepEqual(skillTriggerGlobs(content), ['a/*.cs'], JSON.stringify(following));
        assert.equal(frontmatterBlock(content, 'metadata')!.entries.get(skillTriggerKey)!.continues, false, JSON.stringify(following));
    }
    // The real problem is reported, and it is not that the hint spans several lines.
    const problemsFor = (following: string) => skillFrontmatterProblems('x/SKILL.md', hintUnder(`${hint}${following}`));
    for (const following of ['"version": 1\n', 'version : 1\n']) {
        const problems = problemsFor(following);
        assert.equal(problems.length, 1, `${JSON.stringify(following)}: ${problems.join(' | ')}`);
        assert.match(problems[0], /declares top-level frontmatter key 'version'/, following);
        assert.doesNotMatch(problems[0], /several lines/, following);
    }
    for (const following of [`"${skillTriggerKey}": "b/*.cs"\n`, `${skillTriggerKey} : "b/*.cs"\n`]) {
        const problems = problemsFor(following);
        assert.equal(problems.length, 1, `${JSON.stringify(following)}: ${problems.join(' | ')}`);
        assert.match(problems[0], /declares 'cratis-hint-paths' as a top-level key/, following);
    }
    // Lines under a spelled-differently top-level key are not metadata entries.
    const other = hintUnder(`  author: cratis\n"other":\n  ${skillTriggerKey}: "a/*.cs"\n`);
    assert.deepEqual([...frontmatterBlock(other, 'metadata')!.entries.keys()], ['author']);
    assert.deepEqual(skillTriggerGlobs(other), []);
    // A quoted `"metadata":` key is not the metadata block, and a metadata block after another key still is.
    assert.equal(frontmatterBlock(skillWith('"metadata":\n  a: "b"\n'), 'metadata'), undefined);
    const after = skillWith(`"license": MIT\nmetadata:\n${hint}`);
    assert.deepEqual(skillTriggerGlobs(after), ['a/*.cs']);
});

test('every other hint form is reported with how to write it, and yields no triggers at runtime', () => {
    const rejected: Array<[string, string, RegExp]> = [
        ['a folded block scalar', `  ${skillTriggerKey}: >-\n    a/*.cs\n    b/*.cs\n`, /block scalar/],
        ['a literal block scalar', `  ${skillTriggerKey}: |\n    a/*.cs\n`, /block scalar/],
        ['a block scalar with an indentation indicator', `  ${skillTriggerKey}: |+2\n    a/*.cs\n`, /block scalar/],
        ['a folded block scalar with a keep indicator', `  ${skillTriggerKey}: >+\n    a/*.cs\n`, /block scalar/],
        ['an unquoted value', `  ${skillTriggerKey}: **/for_*/**/*.cs\n`, /not quoted/],
        ['an unquoted flow map', `  ${skillTriggerKey}: {a: b}\n`, /not quoted/],
        ['no value', `  ${skillTriggerKey}:\n`, /no value/],
        ['a trailing comment after a double-quoted string', `  ${skillTriggerKey}: "a/*.cs b/*.cs" # tests\n`, /comment follows the closing quote/],
        ['a trailing comment after a single-quoted string', `  ${skillTriggerKey}: 'a/*.cs' # tests\n`, /comment follows the closing quote/],
        ['text after the closing quote', `  ${skillTriggerKey}: "a/*.cs" b/*.cs\n`, /text follows the closing quote/],
        ['a string that is never closed', `  ${skillTriggerKey}: "a/*.cs\n`, /closing quote is missing/],
        ['a quoted string continued on the next line', `  ${skillTriggerKey}: "a/*.cs\n    b/*.cs"\n`, /spread over several lines/],
        ['a complete quoted string with more lines under it', `  ${skillTriggerKey}: "a/*.cs"\n    b/*.cs\n`, /spread over several lines/],
        ['a plain scalar over several lines', `  ${skillTriggerKey}: a/*.cs\n    b/*.cs\n`, /spread over several lines/],
        ['a value only on the following lines', `  ${skillTriggerKey}:\n    "a/*.cs"\n`, /on the following lines/],
        ['a string with a backslash', `  ${skillTriggerKey}: "a\\*.cs"\n`, /backslash/],
        ['a single-quoted string with an escaped quote', `  ${skillTriggerKey}: 'a''b'\n`, /text follows the closing quote/],
        ['a four-space indent', `    ${skillTriggerKey}: "a/*.cs"\n`, /not indented exactly two spaces/],
        ['a one-space indent', ` ${skillTriggerKey}: "a/*.cs"\n`, /not indented exactly two spaces/],
    ];
    for (const [form, lines, message] of rejected) {
        const content = hintUnder(lines);
        const all = skillFrontmatterProblems('x/SKILL.md', content);
        // Invalid YAML leads with the parser error; the hint-form reason is then the single message after it.
        const problems = all.filter(problem => !/has frontmatter that is not valid YAML/.test(problem));
        assert.equal(problems.length, 1, `${form}: ${all.join(' | ')}`);
        assert.ok(all.length === 1 || /has frontmatter that is not valid YAML/.test(all[0]), `${form}: the parser error leads: ${all.join(' | ')}`);
        assert.match(problems[0], /^x\/SKILL\.md has an unsupported 'metadata\.cratis-hint-paths' value \(/, form);
        assert.match(problems[0], message, form);
        assert.match(problems[0], /write it as one double-quoted string on a single line, indented two spaces under 'metadata:', with no comment after it: cratis-hint-paths: "<glob> <glob>"/, form);
        assert.deepEqual(skillTriggerGlobs(content), [], `${form}: no bogus glob at runtime`);
    }
});

test('a hint nested deeper than metadata is refused as a non-string metadata value, and a flow map is reported', () => {
    const nested = hintUnder(`  other:\n    ${skillTriggerKey}: "a/*.cs"\n`);
    const problems = skillFrontmatterProblems('x/SKILL.md', nested);
    assert.equal(problems.length, 1, problems.join(' | '));
    assert.match(problems[0], /metadata\.other must be a string \(Agent Skills metadata maps strings to strings\)/);
    assert.deepEqual(skillTriggerGlobs(nested), []);
    const flow = skillWith(`metadata: {${skillTriggerKey}: "a/*.cs"}\n`);
    assert.match(skillFrontmatterProblems('x/SKILL.md', flow)[0], /declares 'metadata' inline \(a flow map\).*write it as one double-quoted string/);
    assert.deepEqual(skillTriggerGlobs(flow), []);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', skillWith('metadata: {author: cratis}\n')), []);
});

test('metadata must map strings to strings, and every other shape is reported by name', () => {
    const shapes: Array<[string, string, RegExp]> = [
        ['a scalar', 'metadata: cratis\n', /'metadata' that is a string; it must be a map of strings to strings \(Agent Skills metadata maps strings to strings\)/],
        ['a number', 'metadata: 42\n', /'metadata' that is a number; it must be a map of strings to strings/],
        ['a list', 'metadata:\n  - author\n  - version\n', /'metadata' that is a list; it must be a map of strings to strings/],
        ['null', 'metadata:\n', /'metadata' that is null; it must be a map of strings to strings/],
        ['a number value', 'metadata:\n  version: 1\n', /metadata\.version must be a string \(Agent Skills metadata maps strings to strings\)/],
        ['a boolean value', 'metadata:\n  draft: true\n', /metadata\.draft must be a string/],
        ['a null value', 'metadata:\n  author:\n', /metadata\.author must be a string/],
        ['a list value', 'metadata:\n  tags:\n    - a\n', /metadata\.tags must be a string/],
        ['a nested map', 'metadata:\n  nested:\n    inner: "y"\n', /metadata\.nested must be a string/],
    ];
    for (const [shape, lines, message] of shapes) {
        const problems = skillFrontmatterProblems('x/SKILL.md', skillWith(lines));
        assert.equal(problems.length, 1, `${shape}: ${problems.join(' | ')}`);
        assert.match(problems[0], message, shape);
    }
    // Every offending value is named, and a valid hint next to a bad value is not lost or duplicated.
    const several = skillFrontmatterProblems('x/SKILL.md', skillWith(`metadata:\n  version: 1\n  ${skillTriggerKey}: "a/*.cs"\n  nested:\n    inner: "y"\n`));
    assert.equal(several.length, 2, several.join(' | '));
    assert.match(several[0], /metadata\.version must be a string/);
    assert.match(several[1], /metadata\.nested must be a string/);
    // Absent, or a map of strings, is fine, including quoted numbers and an empty flow map.
    for (const lines of ['', 'metadata:\n  version: "1"\n  author: cratis\n', 'metadata: {}\n', 'metadata: {author: cratis}\n']) {
        assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', skillWith(lines)), [], lines);
    }
});

test('an empty hint string is reported with the supported form', () => {
    for (const value of ['""', "''", '"   "']) {
        const problems = skillFrontmatterProblems('x/SKILL.md', hintUnder(`  ${skillTriggerKey}: ${value}\n`));
        assert.equal(problems.length, 1, value);
        assert.match(problems[0], /without any glob; it must be a non-empty string of whitespace-separated globs: cratis-hint-paths: "<glob> <glob>"/, value);
    }
});

test('frontmatterMap keeps only one-line quoted metadata entries and leaves out any guess', () => {
    const content = hintUnder('  quoted: "one two"\n  single: \'three\'\n  plain: value\n  folded: >-\n    text\n  commented: "x" # c\n  nested:\n    inner: "y"\n');
    assert.deepEqual([...frontmatterMap(content, 'metadata')!], [['quoted', 'one two'], ['single', 'three']]);
    assert.equal(frontmatterMap(skillWith(''), 'metadata'), undefined);
});

test('nested metadata keys are not counted as top-level keys', () => {
    const nested = hintUnder('  name: other\n  description: other\n  version: "1"\n  paths: "a/*.cs"\n');
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', nested), []);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', nested), []);
    // Unknown top-level keys and the two misplaced hint keys are still refused, even next to a metadata block.
    assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith('metadata:\n  a: "b"\nversion: 1\n'))[0], /top-level frontmatter key 'version'/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith(`metadata:\n  a: "b"\n${skillTriggerKey}: "a/*.cs"\n`))[0], /as a top-level key/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith('metadata:\n  a: "b"\npaths: "a/*.cs"\n'))[0], /declares 'paths'/);
});

test('the corpus skills produce exactly the globs they did before the hint form was tightened', () => {
    const expected: Record<string, string[]> = {
        'cratis-application-react-specifications': ['**/for_*/**/*.ts', '**/for_*/**/*.tsx'],
        'cratis-application-slice-specifications': ['**/when_*/**/*.cs', '**/for_*/**/*.cs'],
        'cratis-documentation-writing': ['**/Documentation/**/*.{md,mdx}'],
        'cratis-engineering-docs-authoring': ['**/Documentation/**/*.{md,mdx}'],
        'cratis-specifications-csharp': ['**/for_*/**/*.cs'],
        'cratis-specifications-typescript': ['**/for_*/**/*.ts', '**/for_*/**/*.tsx'],
        'cratis-technical-examples': ['**/Samples/**/*.{cs,ts,tsx}'],
    };
    const skillsRoot = join(repositoryRoot, '.cratis', 'ai', 'skills');
    const actual: Record<string, string[]> = {};
    for (const name of readdirSync(skillsRoot)) {
        const content = readFileSync(join(skillsRoot, name, 'SKILL.md'), 'utf8');
        assert.deepEqual(skillFrontmatterProblems(`${name}/SKILL.md`, content), [], name);
        const globs = skillTriggerGlobs(content);
        if (globs.length > 0) actual[name] = globs;
    }
    assert.deepEqual(actual, expected);
});

test('skill frontmatter may only use the Agent Skills top-level keys', () => {
    const skill = (frontmatterLines: string) => `---\nname: x\ndescription: y\n${frontmatterLines}---\n\nBody\n`;
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', skill('license: MIT\ncompatibility: any\nallowed-tools: Read Bash\nmetadata:\n  anything: "goes"\n')), []);
    assert.match(skillFrontmatterProblems('x/SKILL.md', skill('version: 1\n'))[0], /top-level frontmatter key 'version', which Agent Skills does not allow \(allowed: name, description, license, compatibility, metadata, allowed-tools\)/);
    assert.equal(skillFrontmatterProblems('x/SKILL.md', skill('version: 1\nauthor: me\n')).length, 2);
    // The two known misplacements have their own, more specific messages, and are not also reported as unknown keys.
    const misplaced = skillFrontmatterProblems('x/SKILL.md', skill(`${skillTriggerKey}: "a/*.cs"\npaths: "b/*.cs"\n`));
    assert.equal(misplaced.length, 2, misplaced.join(' | '));
    assert.doesNotMatch(misplaced.join(' | '), /top-level frontmatter key/);
});

const otherSpellings: Array<[string, string, RegExp]> = [
    ['a quoted key', `metadata:\n  "${skillTriggerKey}": "a/*.cs"\n`, /spells 'metadata\.cratis-hint-paths' in a way the Pi runtime reads differently from YAML \(runtime: \[\], YAML: \["a\/\*\.cs"\]\)/],
    ['a single-quoted key', `metadata:\n  '${skillTriggerKey}': "a/*.cs"\n`, /reads differently from YAML/],
    ['a space before the colon', `metadata:\n  ${skillTriggerKey} : "a/*.cs"\n`, /reads differently from YAML/],
    ['a space before the colon and a quoted key', `metadata:\n  "${skillTriggerKey}" : 'a/*.cs'\n`, /reads differently from YAML/],
    ['an explicit key', `metadata:\n  ? ${skillTriggerKey}\n  : "a/*.cs"\n`, /reads differently from YAML/],
    ['a quoted key with a block scalar', `metadata:\n  "${skillTriggerKey}": >-\n    a/*.cs\n    b/*.cs\n`, /reads differently from YAML \(runtime: \[\], YAML: \["a\/\*\.cs","b\/\*\.cs"\]\)/],
    ['a quoted metadata key', `"metadata":\n  ${skillTriggerKey}: "a/*.cs"\n`, /reads differently from YAML/],
    ['a space before the colon of metadata', `metadata :\n  ${skillTriggerKey}: "a/*.cs"\n`, /reads differently from YAML/],
    ['a flow map with a quoted key on the metadata line', `metadata: {"${skillTriggerKey}": "a/*.cs"}\n`, /declares 'metadata' inline \(a flow map\)/],
    ['a flow map spread over lines', `metadata: {\n  ${skillTriggerKey}: "a/*.cs"\n}\n`, /declares 'metadata' inline \(a flow map\)/],
    ['a flow map with a quoted key', `metadata:\n  {"${skillTriggerKey}": "a/*.cs"}\n`, /declares 'metadata' inline \(a flow map\)/],
    ['mixed sibling indentation', `metadata:\n    other: "x"\n  ${skillTriggerKey}: "a/*.cs"\n`, /not valid YAML/],
];

test('every spelling the runtime reader does not know is reported by the YAML cross-check, naming the skill', () => {
    for (const [form, lines, message] of otherSpellings) {
        const content = skillWith(lines);
        const problems = skillFrontmatterProblems('skills/demo/SKILL.md', content);
        assert.ok(problems.length >= 1, `${form}: verify passed`);
        assert.match(problems.join(' | '), message, form);
        assert.ok(problems.every(problem => problem.startsWith('skills/demo/SKILL.md ')), `${form}: names the skill: ${problems.join(' | ')}`);
        if (/reads differently/.test(problems.join(' | '))) assert.match(problems.join(' | '), /write it as one double-quoted string on a single line, indented two spaces under 'metadata:'/, form);
    }
});

test('a flow map spread over lines gives the runtime no hint, even a nested one', () => {
    for (const lines of [
        `metadata: {\n  ${skillTriggerKey}: "a/*.cs"\n}\n`,
        `metadata: {\n  x: {\n  ${skillTriggerKey}: "a/*.cs"\n}}\n`,
    ]) {
        assert.deepEqual(skillTriggerGlobs(skillWith(lines)), [], lines);
        assert.ok(skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(lines)).length >= 1, lines);
    }
});

test('a comment after metadata: is not a value, so the hint below it is read, while an anchor or a tag is refused by name', () => {
    const hint = `  ${skillTriggerKey}: "a/*.cs"\n`;
    for (const opener of ['metadata: # c', 'metadata:   # c', 'metadata: #']) {
        const content = skillWith(`${opener}\n${hint}`);
        assert.deepEqual(skillTriggerGlobs(content), ['a/*.cs'], opener);
        assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', content), [], opener);
    }
    for (const opener of ['metadata: &m', 'metadata: !!map', 'metadata: &m # c']) {
        const problems = skillFrontmatterProblems('x/SKILL.md', skillWith(`${opener}\n${hint}`));
        assert.equal(problems.length, 1, `${opener}: ${problems.join(' | ')}`);
        assert.match(problems[0], /nothing \(no anchor or tag\) may follow 'metadata:' on its line/, opener);
    }
});

test('a sibling metadata key the entry pattern does not read ends the hint entry, in either order', () => {
    const hint = `  ${skillTriggerKey}: "a/*.cs"\n`;
    const siblings: Array<[string, string]> = [
        ['a dotted key', '  cratis.version: "1"\n'],
        ['a quoted key', '  "quoted key": "1"\n'],
        ['a single-quoted key', "  'quoted key': \"1\"\n"],
        ['a numeric key', '  1: "x"\n'],
        ['an explicit key', '  ? complex\n'],
        ['a nested value under a quoted key', '  "quoted key":\n    inner: "y"\n'],
    ];
    for (const [form, sibling] of siblings) {
        for (const [order, lines] of [['after', `${hint}${sibling}`], ['before', `${sibling}${hint}`]]) {
            const content = hintUnder(lines);
            assert.deepEqual(skillTriggerGlobs(content), ['a/*.cs'], `${form}, ${order}`);
            const problems = skillFrontmatterProblems('x/SKILL.md', content).join(' | ');
            assert.doesNotMatch(problems, /several lines|following lines|reads differently/, `${form}, ${order}: ${problems}`);
            assert.equal(frontmatterBlock(content, 'metadata')!.entries.get(skillTriggerKey)!.continues, false, `${form}, ${order}`);
        }
    }
    // Spellings that are valid metadata give no problem at all.
    for (const [form, sibling] of siblings.slice(0, 3)) {
        assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', hintUnder(`${hint}${sibling}`)), [], form);
    }
    // The actual problem is what gets reported: a non-string key, or a value that is not a string.
    assert.match(skillFrontmatterProblems('x/SKILL.md', hintUnder(`${hint}  1: "x"\n`)).join(' | '), /metadata key '1', which is not a string/);
    assert.match(skillFrontmatterProblems('x/SKILL.md', hintUnder(`${hint}  "quoted key":\n    inner: "y"\n`)).join(' | '), /metadata\.quoted key must be a string/);
    // A more-indented line still belongs to the entry above it.
    const spread = hintUnder(`  ${skillTriggerKey}: "a/*.cs\n    b/*.cs"\n`);
    assert.equal(frontmatterBlock(spread, 'metadata')!.entries.get(skillTriggerKey)!.continues, true);
    assert.deepEqual(skillTriggerGlobs(spread), []);
});

test('the flow map message is given for a flow-map hint only, not when the name appears in some other text', () => {
    const flow = /declares 'metadata' inline \(a flow map\)/;
    const text = skillWith(`metadata: {note: "see ${skillTriggerKey}"}\n`);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', text), []);
    assert.doesNotMatch(skillFrontmatterProblems('x/SKILL.md', skillWith(`metadata: {note: "see ${skillTriggerKey}: here"}\n`)).join(' | '), flow);
    for (const inline of [`{${skillTriggerKey}: "a/*.cs"}`, `{note: "x", ${skillTriggerKey}: "a/*.cs"}`, `{"${skillTriggerKey}": "a/*.cs"}`]) {
        assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith(`metadata: ${inline}\n`))[0], flow, inline);
    }
});

test('a metadata key that is not a YAML string is refused', () => {
    for (const key of ['1', 'true', 'null', '1.5']) {
        const problems = skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`metadata:\n  ${key}: "x"\n`));
        assert.match(problems.join(' | '), new RegExp(`metadata key '${key.replace('.', '\\.')}', which is not a string`), key);
    }
    for (const key of ['"1"', "'true'", 'version']) {
        assert.deepEqual(skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`metadata:\n  ${key}: "x"\n`)), [], key);
    }
});

test('the unsupported-form message follows the YAML parse: a mention of the key in a string is never blamed, a list is named', () => {
    const noHint = [
        `metadata: {note: "x, ${skillTriggerKey}: y"}\n`,
        `metadata: {note: "a,\n  ${skillTriggerKey}: b"}\n`,
        `metadata:\n  note: "see ${skillTriggerKey}: here"\n`,
    ];
    for (const lines of noHint) assert.deepEqual(skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(lines)), [], lines);
    for (const lines of [`metadata:\n  ${skillTriggerKey}:\n  - "a/*.cs"\n`, `metadata:\n  ${skillTriggerKey}:\n    - "a/*.cs"\n`]) {
        assert.match(skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(lines)).join(' | '), /\(the value is a list\)/, lines);
    }
    assert.match(skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`metadata: {${skillTriggerKey}: "a/*.cs"}\n`)).join(' | '), /inline \(a flow map\)/);
});

test('invalid YAML always reports the parser error first, with any hint-form reading only added to it', () => {
    const problems = skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`metadata: {note: "x, ${skillTriggerKey}: y"}\nfoo: [\n`));
    assert.match(problems[0], /has frontmatter that is not valid YAML/);
    assert.equal(problems.length, 1, `a mention of the key is not described as a hint form: ${problems.join(' | ')}`);
    // skillWith puts '---', 'name', 'description' on lines 1-3, so an unterminated quote on the fifth line is reported there.
    const located = skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`license: MIT\nauthor: "x\n`));
    assert.match(located[0], /line 5\b/, located[0]);
    const duplicate = skillFrontmatterProblems('skills/demo/SKILL.md', skillWith(`metadata:\n  ${skillTriggerKey}:\n  - "a/*.cs"\nname: again\n`));
    assert.match(duplicate[0], /has frontmatter that is not valid YAML/);
});

test('a duplicate metadata key or any duplicate top-level key is refused as invalid YAML', () => {
    const duplicates: Array<[string, string]> = [
        ['metadata twice', `metadata:\n  other: "x"\nmetadata:\n  ${skillTriggerKey}: "a/*.cs"\n`],
        ['metadata twice, hint first', `metadata:\n  ${skillTriggerKey}: "a/*.cs"\nmetadata:\n  other: "x"\n`],
        ['license twice', 'license: MIT\nlicense: Apache-2.0\n'],
        ['name twice', 'name: y\n'],
        ['a hint twice under metadata', `metadata:\n  ${skillTriggerKey}: "a/*.cs"\n  ${skillTriggerKey}: "b/*.cs"\n`],
    ];
    for (const [form, lines] of duplicates) {
        const problems = skillFrontmatterProblems('x/SKILL.md', skillWith(lines));
        assert.equal(problems.length, 1, `${form}: ${problems.join(' | ')}`);
        assert.match(problems[0], /^x\/SKILL\.md has frontmatter that is not valid YAML: .*unique/i, form);
    }
});

test('a top-level key outside the Agent Skills set is refused however it is spelled', () => {
    for (const lines of ['version : 1\n', '"version": 1\n', "'version': 1\n", 'x.y: 1\n', '_private: 1\n', '9lives: 1\n', '? version\n: 1\n']) {
        const problems = skillFrontmatterProblems('x/SKILL.md', skillWith(lines));
        assert.equal(problems.length, 1, `${JSON.stringify(lines)}: ${problems.join(' | ')}`);
        assert.match(problems[0], /declares top-level frontmatter key '/, lines);
    }
    for (const lines of [`"${skillTriggerKey}": "a/*.cs"\n`, `${skillTriggerKey} : "a/*.cs"\n`]) {
        assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith(lines))[0], /declares 'cratis-hint-paths' as a top-level key/, lines);
    }
    for (const lines of ['"paths": "a/*.cs"\n', 'paths : "a/*.cs"\n']) {
        assert.match(skillFrontmatterProblems('x/SKILL.md', skillWith(lines))[0], /declares 'paths', which Claude Code treats as conditional activation/, lines);
    }
});

test('a hint that is present in YAML but is not a string is refused', () => {
    for (const value of ['~', '42', '[a/*.cs]', '{a: b}', 'true']) {
        const problems = skillFrontmatterProblems('x/SKILL.md', hintUnder(`  ${skillTriggerKey}: ${value}\n`));
        assert.ok(problems.length >= 1, value);
    }
    const quotedNull = skillFrontmatterProblems('x/SKILL.md', hintUnder(`  "${skillTriggerKey}":\n`));
    assert.match(quotedNull.join(' | '), /without any glob; it must be a non-empty string/);
});

test('invalid YAML in the frontmatter is reported', () => {
    const problems = skillFrontmatterProblems('x/SKILL.md', skillWith('metadata: [unclosed\n'));
    assert.equal(problems.length >= 1, true);
    assert.match(problems[0], /^x\/SKILL\.md has frontmatter that is not valid YAML: /);
    assert.deepEqual(skillFrontmatterProblems('x/SKILL.md', 'no frontmatter'), []);
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
        assert.match(original, /\nmetadata:\n  cratis-hint-paths: "/, 'the corpus skill declares a trigger under metadata');
        assert.doesNotMatch(original, /\npaths:/, "the plain 'paths' key is Claude Code's conditional activation");
        const baseline = verify();
        assert.equal(baseline.status, 0, `${baseline.stdout}${baseline.stderr}`);

        writeFileSync(skillFile, original.replace('cratis-hint-paths: "**/for_*/**/*.cs"', 'cratis-hint-paths: "**/for_*/**/*.cs **/*.{cs"'));
        const rejected = verify();
        assert.equal(rejected.status, 1, `${rejected.stdout}${rejected.stderr}`);
        assert.match(rejected.stderr, /cratis-specifications-csharp\/SKILL\.md has an invalid 'metadata\.cratis-hint-paths' entry '\*\*\/\*\.\{cs'/);

        writeFileSync(skillFile, original.replace('metadata:\n  cratis-hint-paths:', 'cratis-hint-paths:'));
        const topLevel = verify();
        assert.equal(topLevel.status, 1, `${topLevel.stdout}${topLevel.stderr}`);
        assert.match(topLevel.stderr, /cratis-specifications-csharp\/SKILL\.md declares 'cratis-hint-paths' as a top-level key/);

        writeFileSync(skillFile, original.replace('cratis-hint-paths: "**/for_*/**/*.cs"', 'cratis-hint-paths: >-\n    **/for_*/**/*.cs'));
        const blockScalar = verify();
        assert.equal(blockScalar.status, 1, `${blockScalar.stdout}${blockScalar.stderr}`);
        assert.match(blockScalar.stderr, /cratis-specifications-csharp\/SKILL\.md has an unsupported 'metadata\.cratis-hint-paths' value \(a block scalar/);

        // Spellings the runtime reader does not know are valid YAML, so only the cross-check with a real parser catches them.
        const spellings: Array<[string, string, RegExp]> = [
            ['a quoted key', original.replace('  cratis-hint-paths:', '  "cratis-hint-paths":'), /cratis-specifications-csharp\/SKILL\.md spells 'metadata\.cratis-hint-paths' in a way the Pi runtime reads differently from YAML/],
            ['a space before the colon', original.replace('  cratis-hint-paths:', '  cratis-hint-paths :'), /reads differently from YAML/],
            ['a duplicate metadata key', original.replace('---\n\n', 'metadata:\n  other: "x"\n---\n\n'), /cratis-specifications-csharp\/SKILL\.md has frontmatter that is not valid YAML: .*unique/i],
            ['a duplicate top-level key', original.replace('license: MIT\n', 'license: MIT\nlicense: MIT\n'), /not valid YAML: .*unique/i],
            ['a flow map', original.replace('metadata:\n  cratis-hint-paths: "**/for_*/**/*.cs"\n', 'metadata: {cratis-hint-paths: "**/for_*/**/*.cs"}\n'), /declares 'metadata' inline \(a flow map\)/],
            ['a literal block scalar', original.replace('cratis-hint-paths: "**/for_*/**/*.cs"', 'cratis-hint-paths: |\n    **/for_*/**/*.cs'), /a block scalar/],
            ['a quoted block scalar key', original.replace('  cratis-hint-paths: "**/for_*/**/*.cs"', '  "cratis-hint-paths": >-\n    **/for_*/**/*.cs'), /reads differently from YAML/],
        ];
        for (const [form, content, message] of spellings) {
            assert.notEqual(content, original, `${form}: the replacement did not apply`);
            writeFileSync(skillFile, content);
            const result = verify();
            assert.equal(result.status, 1, `${form}: ${result.stdout}${result.stderr}`);
            assert.match(result.stderr, message, form);
        }

        writeFileSync(skillFile, original.replace('metadata:\n', 'metadata:\n  name: other\n  description: other\n'));
        const nestedKeys = verify();
        assert.equal(nestedKeys.status, 0, `${nestedKeys.stdout}${nestedKeys.stderr}`);

        writeFileSync(skillFile, original.replace('license: MIT\n', 'license: MIT\nversion: 1\n'));
        const unknown = verify();
        assert.equal(unknown.status, 1, `${unknown.stdout}${unknown.stderr}`);
        assert.match(unknown.stderr, /cratis-specifications-csharp\/SKILL\.md declares top-level frontmatter key 'version'/);
    } finally {
        rmSync(workspace, { recursive: true, force: true });
    }
});
