// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What `CircuitBreaker.allow()` decided, from a single reading of the clock. */
export enum Grant {
    /** No request may be sent. */
    None = 'none',
    /** The breaker is closed: an ordinary request. */
    Closed = 'closed',
    /** The breaker is half-open and this caller holds its only probe, which it must report or release. */
    Probe = 'probe',
}
