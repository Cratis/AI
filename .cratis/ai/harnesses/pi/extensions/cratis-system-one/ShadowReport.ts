// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What `/system-one report` aggregates from this session's custom entries. */
export interface ShadowReport {
    /** Turns that got at least one answered request. */
    turnsJudged: number;
    /**
     * Turns where every request failed. They have failure entries but no relevance entry, so they are not
     * judged turns and none of the counts below include them.
     */
    turnsWithoutAnswer: number;
    /** Skills that were asked about and read, in turns with no answer. Counted on their own, never as hits or misses. */
    skillsReadWithoutAnswer: number;
    /** Judged turns whose outcome is not recorded yet (the turn is still running). */
    turnsAwaitingOutcome: number;
    /** Suggestions at or above the threshold, over judged turns with an outcome. */
    suggested: number;
    /** How many of those the model read during the turn. */
    suggestedAndRead: number;
    /** Reads of skills that were asked about and answered but not suggested, over the same turns. */
    readNotSuggested: number;
    /** Skills that were asked about but got no answer (their chunk failed) and were read anyway, over the same turns. */
    askedUnansweredRead: number;
    /** Other SKILL.md reads (not in the corpus, or not asked about in that turn), over the same turns. Counted, not named. */
    otherSkillReads: number;
    latencyP50Ms?: number;
    latencyP95Ms?: number;
    failures: Map<string, number>;
}
