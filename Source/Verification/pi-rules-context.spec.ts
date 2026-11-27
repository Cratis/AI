// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { DefaultResourceLoader, ExtensionRunner, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import type { BeforeAgentStartEvent, BeforeAgentStartEventResult, BuildSystemPromptOptions, ExtensionContext, ExtensionFactory, ExtensionHandler, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';

// The SDK uses this builder internally but does not export it from its package entry point.
const { buildSystemPrompt }: { buildSystemPrompt: (options: BuildSystemPromptOptions) => string } = await import(
    new URL('./core/system-prompt.js', import.meta.resolve('@earendil-works/pi-coding-agent')).href
);
const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const rulesSource = join(repositoryRoot, '.cratis/ai/rules');
const extensionPath = join(repositoryRoot, '.cratis/ai/harnesses/pi/extensions/cratis-rules/index.ts');
const general = readFileSync(join(rulesSource, 'general.md'), 'utf8');

function createFixture() {
    const workspace = mkdtempSync(join(tmpdir(), 'cratis-rules-context-'));
    const project = join(workspace, 'project');
    const agentDirectory = join(workspace, 'agent');
    const rules = join(project, '.cratis/ai/rules');
    mkdirSync(agentDirectory, { recursive: true });
    cpSync(rulesSource, rules, { recursive: true });
    return { workspace, project, agentDirectory, rules };
}

async function withFixture(action: (fixture: ReturnType<typeof createFixture>) => Promise<void>): Promise<void> {
    const fixture = createFixture();
    try {
        await action(fixture);
    } finally {
        rmSync(fixture.workspace, { recursive: true, force: true });
    }
}

async function loadFixture(fixture: ReturnType<typeof createFixture>, overrides: Partial<ConstructorParameters<typeof DefaultResourceLoader>[0]> = {}) {
    const loader = new DefaultResourceLoader({
        cwd: fixture.project,
        agentDir: fixture.agentDirectory,
        settingsManager: SettingsManager.inMemory(),
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        additionalExtensionPaths: [extensionPath],
        ...overrides,
    });
    await loader.reload();
    const { extensions, errors, runtime } = loader.getExtensions();
    assert.deepEqual(errors, []);
    assert.equal(extensions.length, 1 + (overrides.extensionFactories?.length ?? 0));
    const managed = extensions.find(extension => extension.path === extensionPath);
    assert.ok(managed);
    assert.deepEqual([...managed.handlers.keys()], ['before_agent_start']);
    // No model is consulted by these prompt-only handlers.
    const runner = new ExtensionRunner(extensions, runtime, fixture.project, SessionManager.inMemory(fixture.project), {} as ModelRegistry);
    runner.onError(error => assert.fail(error.error));
    const options: BuildSystemPromptOptions = {
        cwd: fixture.project,
        customPrompt: 'base',
        contextFiles: loader.getAgentsFiles().agentsFiles,
        skills: loader.getSkills().skills,
    };
    const systemPrompt = buildSystemPrompt(options);
    const start = async (inputs = options, prompt = buildSystemPrompt(inputs)) => {
        const result = await runner.emitBeforeAgentStart('test', undefined, prompt, inputs);
        assert.equal(typeof result?.systemPrompt, 'string');
        return result!.systemPrompt!;
    };
    return { loader, options, systemPrompt, start, managed };
}

function appendedPrompt(prompt: string, project: string, omitGeneral = false): string {
    const contents = universalRules(project)
        .filter(rule => !omitGeneral || rule.name !== 'general.md')
        .map(rule => rule.content);
    return `${prompt}\n\n${contents.join('\n\n')}`;
}

function assertLoaded(loaded: Awaited<ReturnType<typeof loadFixture>>, path: string, content: string): void {
    assert.deepEqual(loaded.options.contextFiles, [{ path, content }]);
    assert.ok(loaded.systemPrompt.includes(content));
}

for (const linked of [true, false]) {
    test(`managed Pi omits general loaded through an AGENTS.md ${linked ? 'symlink' : 'copy'}`, async () => {
        await withFixture(async fixture => {
            const path = join(fixture.project, 'AGENTS.md');
            if (linked) symlinkSync(join(fixture.rules, 'general.md'), path);
            else cpSync(join(fixture.rules, 'general.md'), path);
            const loaded = await loadFixture(fixture);
            assertLoaded(loaded, path, general);
            const prompt = await loaded.start();
            assert.equal(prompt, appendedPrompt(loaded.systemPrompt, fixture.project, true));
            assert.equal(prompt.split(general.trim()).length - 1, 1);
        });
    });
}

for (const identical of [false, true]) {
    test(`managed Pi honors a ${identical ? 'matching' : 'different'} AGENTS.override.md over AGENTS.md`, async () => {
        await withFixture(async fixture => {
            writeFileSync(join(fixture.project, 'AGENTS.md'), general);
            const path = join(fixture.project, 'AGENTS.override.md');
            const content = identical ? general : '# Repository-specific instructions\n';
            writeFileSync(path, content);
            const loaded = await loadFixture(fixture);
            assertLoaded(loaded, path, content);
            assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project, identical));
        });
    });
}

for (const disabled of [false, true]) {
    test(`managed Pi appends general with ${disabled ? 'context loading disabled despite an AGENTS.md' : 'no context file'}`, async () => {
        await withFixture(async fixture => {
            if (disabled) writeFileSync(join(fixture.project, 'AGENTS.md'), general);
            const loaded = await loadFixture(fixture, { noContextFiles: disabled });
            assert.deepEqual(loaded.options.contextFiles, []);
            assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project));
        });
    });
}

test('managed Pi deduplicates loaded content under an unrelated context path', async () => {
    await withFixture(async fixture => {
        const path = join(fixture.agentDirectory, 'custom-instructions.md');
        writeFileSync(path, general);
        const loaded = await loadFixture(fixture, {
            agentsFilesOverride: () => ({ agentsFiles: [{ path, content: readFileSync(path, 'utf8') }] }),
        });
        assertLoaded(loaded, path, general);
        assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project, true));
    });
});

test('managed Pi does not deduplicate any other universal rule loaded as context', async () => {
    await withFixture(async fixture => {
        const other = universalRules(fixture.project).find(rule => rule.name !== 'general.md')!;
        const path = join(fixture.project, 'AGENTS.md');
        writeFileSync(path, other.content);
        const loaded = await loadFixture(fixture);
        assertLoaded(loaded, path, other.content);
        assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project));
    });
});

test('managed Pi leaves remaining rules unchanged when general.md is absent', async () => {
    await withFixture(async fixture => {
        rmSync(join(fixture.rules, 'general.md'));
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture);
        assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project));
    });
});

for (const [name, content] of [
    ['changed instructions', general.replace('Project Philosophy', 'Different Philosophy')],
    ['a heading only', '# Cratis — Project Instructions'],
    ['interior spaces', general.replace('Project Philosophy', 'Project  Philosophy')],
    ['interior blank lines', general.replace('## Project Philosophy\n\n', '## Project Philosophy\n\n\n')],
]) {
    test(`managed Pi retains general when loaded context contains ${name}`, async () => {
        await withFixture(async fixture => {
            const path = join(fixture.project, 'AGENTS.md');
            writeFileSync(path, content);
            const loaded = await loadFixture(fixture);
            assertLoaded(loaded, path, content);
            assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project));
        });
    });
}

for (const [name, content] of [
    ['BOM, CRLF and surrounding whitespace', `\uFEFF \r\n${general.replaceAll('\n', '\r\n')} \r\n`],
    ['CR line endings', general.replaceAll('\n', '\r')],
]) {
    test(`managed Pi normalizes ${name} for context and incoming prompt comparison`, async () => {
        await withFixture(async fixture => {
            const path = join(fixture.project, 'AGENTS.md');
            writeFileSync(path, content);
            const loaded = await loadFixture(fixture);
            // Pi strips a leading BOM when loading context; its line endings remain unchanged.
            assertLoaded(loaded, path, content.replace(/^\uFEFF/, ''));
            assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project, true));
        });
    });
}

test('managed Pi normalizes the rule for comparison without rewriting retained contents', async () => {
    await withFixture(async fixture => {
        const original = `\uFEFF \r\n${general.replaceAll('\n', '\r\n')} \r\n`;
        writeFileSync(join(fixture.rules, 'general.md'), original);
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture);
        assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project, true));
        const withoutContext = { ...loaded.options, contextFiles: [] };
        const prompt = await loaded.start(withoutContext);
        assert.equal(prompt, appendedPrompt(buildSystemPrompt(withoutContext), fixture.project));
        assert.ok(prompt.includes(original));
    });
});

test('managed Pi never treats empty normalized guidance as proof of inclusion', async () => {
    await withFixture(async fixture => {
        const empty = '\uFEFF \r\n ';
        writeFileSync(join(fixture.rules, 'general.md'), empty);
        writeFileSync(join(fixture.project, 'AGENTS.md'), empty);
        const loaded = await loadFixture(fixture);
        assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project));
    });
});

test('managed Pi requires loaded context even when the incoming prompt contains general', async () => {
    await withFixture(async fixture => {
        const loaded = await loadFixture(fixture);
        assert.deepEqual(loaded.options.contextFiles, []);
        const prompt = `${loaded.systemPrompt}\n${general}`;
        assert.equal(await loaded.start(loaded.options, prompt), appendedPrompt(prompt, fixture.project));
    });
});

const stripProjectContext: ExtensionFactory = pi => {
    pi.on('before_agent_start', event => ({
        systemPrompt: event.systemPrompt.replace(/<project_context>[\s\S]*?<\/project_context>/, ''),
    }));
};

test('managed Pi restores general after an earlier handler removes loaded context', async () => {
    await withFixture(async fixture => {
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture, {
            extensionFactories: [stripProjectContext],
            extensionsOverride: base => ({ ...base, extensions: [
                ...base.extensions.filter(extension => extension.path !== extensionPath),
                ...base.extensions.filter(extension => extension.path === extensionPath),
            ] }),
        });
        assertLoaded(loaded, join(fixture.project, 'AGENTS.md'), general);
        const stripped = loaded.systemPrompt.replace(/<project_context>[\s\S]*?<\/project_context>/, '');
        assert.equal(await loaded.start(), appendedPrompt(stripped, fixture.project));
    });
});

for (const [name, contextFiles, omitGeneral] of [
    ['an object', { content: general }, false],
    ['a string', general, false],
    ['a null entry', [null], false],
    ['an entry without content', [{}], false],
    ['an entry with non-string content', [{ content: 42 }], false],
    ['an unreadable entry', [{ get content(): string { throw new Error('unreadable context'); } }], false],
    ['malformed entries before a valid match', [null, {}, { content: 42 }, { path: 'loaded.md', content: general }], true],
] as const) {
    test(`managed Pi retains guidance when an earlier handler supplies ${name}`, async () => {
        await withFixture(async fixture => {
            writeFileSync(join(fixture.project, 'AGENTS.md'), general);
            const loaded = await loadFixture(fixture, {
                extensionFactories: [pi => {
                    pi.on('before_agent_start', event => { Object.assign(event.systemPromptOptions, { contextFiles }); });
                }],
                extensionsOverride: base => ({ ...base, extensions: [
                    ...base.extensions.filter(extension => extension.path !== extensionPath),
                    ...base.extensions.filter(extension => extension.path === extensionPath),
                ] }),
            });
            assertLoaded(loaded, join(fixture.project, 'AGENTS.md'), general);
            assert.equal(await loaded.start(), appendedPrompt(loaded.systemPrompt, fixture.project, omitGeneral));
        });
    });
}

test('accepted boundary: a later handler can remove deduplicated general with Pi project context', async () => {
    await withFixture(async fixture => {
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture, {
            extensionFactories: [stripProjectContext],
            extensionsOverride: base => ({ ...base, extensions: [
                ...base.extensions.filter(extension => extension.path === extensionPath),
                ...base.extensions.filter(extension => extension.path !== extensionPath),
            ] }),
        });
        const stripped = loaded.systemPrompt.replace(/<project_context>[\s\S]*?<\/project_context>/, '');
        const prompt = await loaded.start();
        assert.equal(prompt, appendedPrompt(stripped, fixture.project, true));
        assert.ok(!prompt.includes(general.trim()), 'handler-time inclusion does not guarantee final inclusion');
        const legacy = appendedPrompt(loaded.systemPrompt, fixture.project).replace(/<project_context>[\s\S]*?<\/project_context>/, '');
        assert.ok(legacy.includes(general), 'the previous always-append behavior survived this selective removal');
    });
});

test('managed Pi recomputes inclusion each turn and preserves selected universal order and path scoping', async () => {
    await withFixture(async fixture => {
        writeFileSync(join(fixture.project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/engineering/typescript'], languages: ['typescript'] }));
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture);
        const turns = [loaded.options, { ...loaded.options, contextFiles: [] }, loaded.options];
        for (const inputs of turns) {
            const prompt = await loaded.start(inputs);
            assert.equal(prompt, appendedPrompt(buildSystemPrompt(inputs), fixture.project, inputs === loaded.options));
            assert.doesNotMatch(prompt, /# C# Conventions|# TypeScript Conventions|# Application Profile/);
        }
    });
});

test('managed Pi keeps appending on older runtimes without construction options or a context list', async () => {
    await withFixture(async fixture => {
        writeFileSync(join(fixture.project, 'AGENTS.md'), general);
        const loaded = await loadFixture(fixture);
        const handler = loaded.managed.handlers.get('before_agent_start')![0] as ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>;
        for (const systemPromptOptions of [undefined, { cwd: fixture.project }]) {
            const event = { type: 'before_agent_start', prompt: 'test', systemPrompt: loaded.systemPrompt, systemPromptOptions } as BeforeAgentStartEvent;
            const result = await handler(event, { cwd: fixture.project, hasUI: false } as ExtensionContext);
            assert.equal(result?.systemPrompt, appendedPrompt(loaded.systemPrompt, fixture.project));
        }
    });
});

test('managed Pi injects the operational-safety rule at startup with no skills and no file touched, even beside a competing skill', async () => {
    await withFixture(async fixture => {
        const operational = readFileSync(join(fixture.rules, 'operational-safety.md'), 'utf8');
        const loaded = await loadFixture(fixture);
        assert.deepEqual(loaded.options.skills, []);
        const prompt = await loaded.start();
        assert.ok(prompt.includes(operational.trim()), 'the new policy is injected without any file or skill');
        const competing = { ...loaded.options, skills: [{ name: 'competing-skill', description: 'Render and inspect with force', filePath: join(fixture.project, 'competing/SKILL.md'), baseDir: join(fixture.project, 'competing'), sourceInfo: { path: join(fixture.project, 'competing/SKILL.md'), source: 'test', scope: 'project', origin: 'top-level' }, disableModelInvocation: false }] } as unknown as BuildSystemPromptOptions;
        assert.ok((await loaded.start(competing)).includes(operational.trim()), 'a competing skill does not displace the rule');
    });
});
