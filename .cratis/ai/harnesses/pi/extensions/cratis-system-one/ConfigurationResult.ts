// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SystemOneSettings } from './SystemOneSettings.ts';

export type ConfigurationResult =
    | { enabled: true; settings: SystemOneSettings }
    /** `notice` is set only when someone plausibly tried to configure the extension and got it wrong. */
    | { enabled: false; reason: string; notice?: string };
