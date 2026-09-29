// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { KeySource } from './KeySource.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';

/** Fully validated settings. Only exists when the user has enabled the extension. */
export interface SystemOneSettings {
    /** The full URL requests are posted to. */
    endpoint: string;
    /** Scheme, host and port only. This is what status output and session entries show. */
    origin: string;
    loopback: boolean;
    /** True when `SYSTEMONE_ENDPOINT` overrode the user configuration. */
    endpointFromEnvironment: boolean;
    model: string;
    timeoutMs: number;
    /** Never logged, notified, recorded or shown. */
    apiKey?: string;
    /** Where `apiKey` comes from (`KeySource.None` when there is none). Shown by status; the value never is. */
    credential: KeySource;
    /** True when `SYSTEMONE_API_KEY` is set in the environment but was not used because the user did not agree to it for this origin. */
    environmentKeyIgnored: boolean;
    skillRelevance: SkillRelevanceSettings;
}
