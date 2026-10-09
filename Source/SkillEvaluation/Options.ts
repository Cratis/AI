// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Harness } from './Harness.ts';

export interface Options {
    command: 'trigger' | 'outputs' | 'grade' | 'report';
    skills: string[];
    harness: Harness;
    model: string;
    thinking: string;
    runs: number;
    concurrency: number;
    timeout: number;
    listingBudget?: number;
    limit?: number;
    runDirectory?: string;
    graderModel: string;
}
