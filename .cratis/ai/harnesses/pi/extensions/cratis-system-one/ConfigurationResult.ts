// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConfigurationNotice } from './ConfigurationNotice.ts';
import type { SystemOneSettings } from './SystemOneSettings.ts';

export type ConfigurationResult =
    | { enabled: true; settings: SystemOneSettings; notice?: string; noticeClass?: ConfigurationNotice }
    /**
     * `configured` is true once the user has a configuration file. `notice` is set only for a configured
     * user, so an unconfigured install stays completely silent. `noticeClass` says which kind of notice it
     * is, so each kind is announced once per session on its own.
     */
    | { enabled: false; reason: string; configured: boolean; notice?: string; noticeClass?: ConfigurationNotice };
