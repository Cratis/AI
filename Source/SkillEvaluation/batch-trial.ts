// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { harnessCommand, harnessEnvironment } from './commands.ts';
import type { isolateBatch } from './isolation.ts';
import type { Options } from './Options.ts';
import { execute } from './process.ts';
import { docker, startSandbox } from './suite-sandbox.ts';
import type { Task } from './Task.ts';
import { workspace } from './workspace.ts';

export interface TrialExecution {
    root: string;
    options: Options;
    isolated: Awaited<ReturnType<typeof isolateBatch>>;
    image?: string;
}

export async function executeTrial(context: TrialExecution, task: Task, transcript: string): ReturnType<typeof execute> {
    const { options, isolated, image } = context;
    const model = task.model ?? options.model;
    if (image) return sandboxedTrial({ ...context, options: { ...options, model } }, task, transcript, image);
    const command = harnessCommand({ ...options, model }, task.prompt, task.withSkills ? isolated.skillsDirectory : undefined);
    return execute(command, options.harness, task.withSkills ? isolated.withWorkspace : isolated.withoutWorkspace,
        harnessEnvironment(process.env, options.listingBudget, isolated.agentDirectory), transcript,
        options.timeout, options.command === 'trigger' ? 6 : undefined,
        { target: task.skill, corpusSkills: isolated.corpusSkills, withSkills: task.withSkills });
}

async function sandboxedTrial({ root, options, isolated }: TrialExecution, task: Task, transcript: string, image: string): ReturnType<typeof execute> {
    const temporary = await workspace();
    try {
        const stage = task.withSkills ? await realpath(dirname(isolated.skillsDirectory)) : undefined;
        const container = await startSandbox(image, await realpath(temporary.path), stage);
        try {
            const environment = sandboxEnvironment(isolated.agentDirectory, container, options.listingBudget);
            const extension = join(root, 'Source/SkillEvaluation/suite-extension.ts');
            const command = harnessCommand(options, task.prompt, stage ? join(stage, 'skills') : undefined, extension);
            return await execute(command, options.harness, temporary.path, environment, transcript, options.timeout,
                options.command === 'trigger' ? 6 : undefined,
                { corpusSkills: isolated.corpusSkills, withSkills: task.withSkills, sandboxCorpus: stage });
        } finally { await docker(['rm', '-f', container]); }
    } finally { await temporary.remove(); }
}

function sandboxEnvironment(agentDirectory: string | undefined, container: string, budget: number | undefined): NodeJS.ProcessEnv {
    return { ...harnessEnvironment({ PATH: process.env.PATH, HOME: process.env.HOME, TERM: 'dumb' }, budget, agentDirectory),
        CRATIS_SUITE_CONTAINER: container, CRATIS_EVAL_READ_ONLY: '1' };
}
