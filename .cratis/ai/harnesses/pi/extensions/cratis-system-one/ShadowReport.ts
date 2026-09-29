// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What `/system-one report` aggregates from this session's custom entries. */
export interface ShadowReport {
    /** Turns that got at least one answered request. */
    turnsJudged: number;
    /** Judged turns whose outcome is not recorded yet (the turn is still running). */
    turnsAwaitingOutcome: number;
    /** Suggestions at or above the threshold, over judged turns with an outcome. */
    suggested: number;
    /** How many of those the model read during the turn. */
    suggestedAndRead: number;
    /** Reads of skills that were asked about and answered but not suggested, over the same turns. */
    readNotSuggested: number;
    /** Other SKILL.md reads (never asked about, or not in the corpus), over the same turns. Counted, not named. */
    otherSkillReads: number;
    latencyP50Ms?: number;
    latencyP95Ms?: number;
    failures: Map<string, number>;
}
