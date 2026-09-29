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
     * The origin (scheme, host, port) setup disclosed, probed and the user confirmed: the one that really
     * receives data, including a `SYSTEMONE_ENDPOINT` override that was set at the time. If the effective
     * origin is ever another one, System One turns itself off. Absent in files from before this existed:
     * the origin of `endpoint` (or TypeSafe) is used.
     */
    consentedOrigin?: string;
    /** The credential the user agreed to. Absent in older files: an environment key is then allowed for the TypeSafe origin only. */
    keySource?: AgreedKey;
    skillRelevance?: { mode: SkillRelevanceMode };
}
