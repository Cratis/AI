// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Options } from './Options.ts';
import type { Task } from './Task.ts';

export interface Manifest {
    version: 1;
    options: Options;
    corpusDigest: string;
    /** Absent on older manifests, which staged skills without corpus dependencies. */
    corpusCondition?: 'skills-with-dependencies';
    tasks: Task[];
}
