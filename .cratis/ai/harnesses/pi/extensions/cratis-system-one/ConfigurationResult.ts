// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SystemOneSettings } from './SystemOneSettings.ts';

export type ConfigurationResult =
    | { enabled: true; settings: SystemOneSettings; notice?: string }
    /**
     * `configured` is true once the user has a configuration file. `notice` is set only for a configured
     * user, so an unconfigured install stays completely silent.
     */
    | { enabled: false; reason: string; configured: boolean; notice?: string };
