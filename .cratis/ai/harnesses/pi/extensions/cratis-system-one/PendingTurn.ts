// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { RecentDecision } from './RecentDecision.ts';

/** A turn that was asked about and is waiting to learn which skills the model actually read. */
export interface PendingTurn {
    turn: number;
    read: Set<string>;
    /** Asked skills the model had already read in an earlier turn of this session. */
    readEarlier: string[];
    decision: RecentDecision;
}
