// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EndpointSource } from './EndpointSource.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';

/** Fully validated settings. Only exists when the extension is enabled. */
export interface SystemOneSettings {
    /** Base URL without a trailing slash; the request goes to `${endpoint}/v1/systemone`. */
    endpoint: string;
    /** Scheme, host and port only. This is what status output and session entries show. */
    origin: string;
    source: EndpointSource;
    loopback: boolean;
    model: string;
    timeoutMs: number;
    /** Never logged, notified, recorded or shown. Present only for an endpoint the user configured. */
    apiKey?: string;
    skillRelevance: SkillRelevanceSettings;
}
