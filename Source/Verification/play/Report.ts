// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Outcome } from './Outcome.ts';

export interface Report {
    outcome: Outcome;
    compiled: number;
    expectedDiagnostics: number;
    expectedFailure: number;
    tested: number;
    unbound: number;
    skipped: Array<{ location: string; reason: string }>;
    problems: string[];
    milliseconds: number;
}
