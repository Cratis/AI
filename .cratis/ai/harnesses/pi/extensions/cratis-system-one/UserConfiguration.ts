// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SkillRelevanceMode } from './SkillRelevanceMode.ts';

/** The user's own decision, stored in `<pi agent dir>/cratis-system-one.json`. Only the user can enable System One. */
export interface UserConfiguration {
    enabled: boolean;
    /** A full URL, https or loopback http. Defaults to the TypeSafe endpoint. */
    endpoint?: string;
    model?: string;
    /** Stored only when the user typed it into `/system-one setup`. Never shown, logged or recorded. */
    apiKey?: string;
    /** ISO time the user confirmed what is sent. */
    consentedAt: string;
    skillRelevance?: { mode: SkillRelevanceMode };
}
