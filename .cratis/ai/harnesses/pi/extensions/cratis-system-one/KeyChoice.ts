// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { KeySource } from './KeySource.ts';

/** The credential chosen for an endpoint and where it came from. The value is never shown. */
export interface KeyChoice {
    source: KeySource;
    key?: string;
}
