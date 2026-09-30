// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Where a key would go, as far as choosing one is concerned. */
export interface KeyTarget {
    endpoint: string;
    origin: string;
    loopback: boolean;
}
