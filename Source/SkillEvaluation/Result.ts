// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Task } from './Task.ts';

export interface Result extends Task {
    corpusCondition?: 'skills-with-dependencies' | 'none';
    skillsRead: string[];
    /** Present only for runs scored using matched successful tool results. */
    confirmedSkills?: string[];
    attemptedSkills?: string[];
    listedSkills?: string[];
    text: string;
    usage: { input: number; output: number; costUsd?: number } | undefined;
    toolCalls?: number;
    durationSeconds: number;
    stopped: 'skill-loaded' | 'tool-cap' | undefined;
    transcript: string;
}
