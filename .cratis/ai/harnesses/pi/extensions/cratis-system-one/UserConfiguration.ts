// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AgreedKey } from './AgreedKey.ts';
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
    /**
     * The origin (scheme, host, port) of the backend the user chose in setup, which was disclosed, probed and
     * confirmed. `SYSTEMONE_ENDPOINT` may change only the path; if the effective origin is ever another one,
     * System One turns itself off. Required once `enabled` is true.
     */
    consentedOrigin?: string;
    /** The credential the user agreed to. Required once `enabled` is true, like `consentedOrigin`. */
    keySource?: AgreedKey;
    skillRelevance?: { mode: SkillRelevanceMode };
}
