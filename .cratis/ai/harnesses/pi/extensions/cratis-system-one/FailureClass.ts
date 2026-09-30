// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Why a System One request produced no usable answer. Each class gets at most one notice per session. */
export enum FailureClass {
    Timeout = 'timeout',
    Network = 'network',
    Unauthorized = 'unauthorized',
    InvalidRequest = 'invalid-request',
    RateLimited = 'rate-limited',
    Overloaded = 'overloaded',
    ServerError = 'server-error',
    MalformedResponse = 'malformed-response',
    InvalidProbability = 'invalid-probability',
}
