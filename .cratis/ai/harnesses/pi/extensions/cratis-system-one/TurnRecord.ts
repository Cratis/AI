// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { RecentDecision } from './RecentDecision.ts';

/**
 * One turn that was asked about. The request runs in the background, so its answer and the turn's end
 * arrive in either order; this is where they meet.
 */
export interface TurnRecord {
    /** Unique across sessions, so entries from a resumed session never collide. */
    turnId: string;
    turn: number;
    /** SKILL.md files the model read during the turn, by skill name, suggested or not. */
    read: Set<string>;
    /** Asked skills the model had already read in an earlier turn of this session. */
    readEarlier: string[];
    /** Set when the agent loop ends. */
    readFinal?: string[];
    decision?: RecentDecision;
}
