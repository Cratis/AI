// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Where and how one System One request is sent. */
export interface Connection {
    /** The full URL requests are posted to. */
    endpoint: string;
    model: string;
    timeoutMs: number;
    apiKey?: string;
}
