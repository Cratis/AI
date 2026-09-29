// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { SkillRelevanceMode } from './SkillRelevanceMode.ts';

export interface SkillRelevanceSettings {
    mode: SkillRelevanceMode;
    /** Fuse: more eligible skills than this skips the call rather than trimming the list. */
    maxQuestions: number;
    /** Prompts shorter than this are not worth a request. */
    minPromptChars: number;
    /** Upper bound on the prompt text sent as state. */
    stateChars: number;
    /** Upper bound on each skill criterion (name plus first sentence of the description). */
    criterionChars: number;
}
