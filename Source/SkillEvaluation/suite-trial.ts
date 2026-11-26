// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, inside, sourceFiles } from './suite-files.ts';
import { docker, phase, resetSandbox, startSandbox } from './suite-sandbox.ts';
import { runProcess } from './suite-process.ts';
import { SuiteTranscript } from './suite-transcript.ts';
import { scoreSources } from './suite-scoring.ts';
import type { StageMarker } from '../Verification/corpus-staging.ts';
import type { Suite, SuiteOptions, SuiteResult, SuiteTask, Trial } from './Suite.ts';

export interface TrialContext {
    suiteRoot: string; root: string; run: string; image: string; suite: Suite; options: SuiteOptions;
    stages: Map<string, { path: string; marker: StageMarker }>;
}

export async function prepareFixture(context: TrialContext, task: SuiteTask, target: string): Promise<void> {
    await copyFixture(inside(context.suiteRoot, context.suite.fixtures[task.fixture].path), target);
    if (task.overlay) await copyFixture(inside(context.suiteRoot, task.overlay), target);
}

/** Config and existing specs are immutable: adding source/specs is allowed; disabling the scorer is not. */
export function protectedFilesUnchanged(before: Map<string, string>, after: Map<string, string>): boolean {
    const protectedPath = (path: string) => /\.(json|props|targets|csproj|config)$/i.test(path) || path.includes('.Specs/');
    for (const [path, content] of before) if (protectedPath(path) && after.get(path) !== content) return false;
    for (const path of after.keys()) if (/\.(props|targets|csproj)$/.test(path) && !before.has(path)) return false;
    return true;
}

async function agentEnvironment(directory: string, container: string): Promise<NodeJS.ProcessEnv> {
    const agent = join(directory, 'agent');
    await mkdir(agent, { mode: 0o700 });
    const authentication = join(process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME!, '.pi/agent'), 'auth.json');
    await readFile(authentication); // Fail before a model call, without logging credentials.
    await symlink(authentication, join(agent, 'auth.json'));
    const toolLogs = join(directory, 'tool-phases');
    await mkdir(toolLogs);
    return { PATH: process.env.PATH, HOME: process.env.HOME, TERM: 'dumb', PI_CODING_AGENT_DIR: agent, CRATIS_SUITE_CONTAINER: container, CRATIS_SUITE_TOOL_LOGS: toolLogs };
}

export function agentCommand(context: TrialContext, task: SuiteTask, stage: { path: string; marker: StageMarker }): string[] {
    const [provider, ...model] = context.options.model.split('/');
    const skills = stage.marker.skills.flatMap(skill => ['--skill', join(stage.path, '.cratis/ai/skills', skill)]);
    const system = 'You are implementing an application change in an offline sandbox. All tools operate inside it; the fixture is /workspace. ' +
        'Use the provided tools for every file operation. Do not change existing specifications, project/configuration files or package versions. Add new specs in the named locations. ' +
        (stage.marker.corpus === 'none' ? '' : 'Additional selected guidance is available under /corpus/rules. Read applicable guidance and skills using the read tool. ');
    return ['pi', '--provider', provider, '--model', model.join('/'), '--thinking', 'medium', '--mode', 'json', '-p',
        '--no-session', '--no-context-files', '--no-extensions', '--no-mcp', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-builtin-tools',
        '--extension', join(context.root, 'Source/SkillEvaluation/suite-extension.ts'), ...skills, '--system-prompt', system,
        `Work in /workspace. ${task.prompt}\nRequired executable specs: ${task.requiredSpecs.join(', ')}.\n` +
        `Verification commands: ${context.suite.fixtures[task.fixture].build}; ${context.suite.fixtures[task.fixture].specs}.`];
}

export async function runTrial(context: TrialContext, trial: Trial): Promise<SuiteResult> {
    const task = context.suite.tasks.find(task => task.id === trial.task)!;
    const directory = join(context.run, 'trials', trial.key.replaceAll(':', '-'));
    // An interrupted attempt is never overwritten: a resume gets a fresh isolated attempt folder.
    const attempt = join(directory, `attempt-${Date.now()}`);
    const fixture = join(attempt, 'workspace');
    await mkdir(attempt, { recursive: true, mode: 0o700 });
    await prepareFixture(context, task, fixture);
    const before = await sourceFiles(fixture);
    const stage = context.stages.get(trial.arm)!;
    const transcript = new SuiteTranscript(context.options.model, stage.marker.skills, join(stage.path, '.cratis/ai'));
    const started = Date.now();
    let container: string | undefined;
    const result: SuiteResult = { ...trial, area: task.area, status: 'infrastructure-error', passed: false, buildExit: null, specExit: null,
        idioms: [], metrics: transcript.metrics(), durationSeconds: 0, attemptedSkills: [], confirmedSkills: [], transcript: join(attempt, 'transcript.jsonl') };
    try {
        container = await startSandbox(context.image, fixture, trial.arm === 'none' ? undefined : join(stage.path, '.cratis/ai'));
        const env = await agentEnvironment(attempt, container);
        const control = join(attempt, 'control');
        await mkdir(control);
        const execution = await runProcess({ command: agentCommand(context, task, stage), cwd: control, env, log: result.transcript,
            timeoutSeconds: task.timeoutSeconds, transcript });
        result.status = 'agent-error';
        if (agentFailed(execution, transcript)) {
            result.error = execution.error ?? `Agent exit ${execution.exit}; completion=${transcript.completed}; model observed=${transcript.identityObserved}`;
            return result;
        }
        await scoreGenerated(context, task, fixture, before, container, attempt, result);
        return result;
    } catch (error) {
        result.error = String(error);
        return result;
    } finally {
        try {
            await captureTranscript(result, transcript, task, stage.marker.skills, started, attempt);
        } finally {
            if (container) await docker(['rm', '-f', container]).catch(error => { result.error ??= `Sandbox cleanup: ${error}`; });
        }
    }
}

function agentFailed(execution: { exit: number; error?: string }, transcript: SuiteTranscript): boolean {
    return execution.exit !== 0 || Boolean(execution.error) || !transcript.completed || !transcript.identityObserved;
}

async function installHiddenContract(context: TrialContext, task: SuiteTask, fixture: string): Promise<void> {
    const hidden = join(context.suiteRoot, 'scorers', `${task.id}.cs`);
    try {
        const source = await readFile(hidden, 'utf8');
        const target = join(fixture, 'LearningPath/08-Production/Production.Specs/SuiteHidden');
        await mkdir(target, { recursive: true });
        await writeFile(join(target, 'contract.cs'), source);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

async function scoreGenerated(context: TrialContext, task: SuiteTask, fixture: string, before: Map<string, string>,
    container: string, attempt: string, result: SuiteResult): Promise<void> {
    result.status = 'infrastructure-error';
    await resetSandbox(container);
    const after = await sourceFiles(fixture);
    const sourceScore = scoreSources(task, after);
    result.idioms = sourceScore.idioms;
    if (!protectedFilesUnchanged(before, after)) { result.status = 'agent-error'; result.error = 'Protected fixture inputs changed'; return; }
    await installHiddenContract(context, task, fixture);
    const definition = context.suite.fixtures[task.fixture];
    result.buildExit = await phase(container, definition.build, 'build', attempt, 'build');
    if (result.buildExit === 0) result.specExit = await phase(container, definition.specs, 'test', attempt, 'specs');
    result.status = 'completed';
    result.passed = result.buildExit === 0 && result.specExit === 0 && sourceScore.passed;
    await writeFile(join(attempt, 'source-score.json'), JSON.stringify(sourceScore, null, 2));
}

async function captureTranscript(result: SuiteResult, transcript: SuiteTranscript, task: SuiteTask, skills: string[], started: number, attempt: string): Promise<void> {
    result.metrics = transcript.metrics();
    result.durationSeconds = (Date.now() - started) / 1000;
    result.attemptedSkills = [...transcript.attemptedSkills];
    result.confirmedSkills = [...transcript.confirmedSkills];
    const expected = result.arm === 'none' ? [] : task.expectedSkills[result.arm].filter(skill => skills.includes(skill));
    result.expectedSkills = expected.length ? expected : null;
    const raw = await readFile(result.transcript, 'utf8').catch(() => '');
    const normalized = raw.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    await writeFile(join(attempt, 'normalized.json'), JSON.stringify(normalized, null, 2));
}
