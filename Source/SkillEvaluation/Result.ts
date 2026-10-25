// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Task } from './Task.ts';

export interface Result extends Task {
    skillsRead: string[];
    listedSkills?: string[];
    text: string;
    usage: { input: number; output: number; costUsd?: number } | undefined;
    durationSeconds: number;
    stopped: 'skill-loaded' | 'tool-cap' | undefined;
    transcript: string;
}
