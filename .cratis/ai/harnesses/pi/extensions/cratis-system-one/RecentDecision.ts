// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FailureClass } from './FailureClass.ts';

/** What `/system-one last` shows. Ids and probabilities only; the prompt is never kept. */
export interface RecentDecision {
    turn: number;
    at: string;
    endpointOrigin: string;
    latencyMs: number;
    asked: number;
    outcome: 'answered' | FailureClass;
    probabilities: Array<[skill: string, probability: number]>;
    /** Skills whose SKILL.md the model read during the turn. Undefined until the turn ends. */
    read?: string[];
}
