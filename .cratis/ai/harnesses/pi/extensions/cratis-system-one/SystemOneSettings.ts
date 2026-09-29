// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
    skillRelevance: SkillRelevanceSettings;
}
