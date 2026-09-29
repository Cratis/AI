// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { SkillRelevanceMode } from './SkillRelevanceMode.ts';

export interface SkillRelevanceSettings {
    /** The only setting anyone can change: off, or shadow. */
    mode: SkillRelevanceMode;
    /** Fuse: more eligible skills than this skips the call rather than trimming the list. */
    maxQuestions: number;
    /** Skills per request. Larger sets are sent as several concurrent requests. */
    chunkSize: number;
    /** Prompts shorter than this are not worth a request. */
    minPromptChars: number;
    /** Upper bound on the prompt text sent as state. */
    stateChars: number;
    /** Upper bound on each skill criterion (name plus first sentence of the description). */
    criterionChars: number;
}
