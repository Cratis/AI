// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The `EventSource.readyState` value meaning the connection is closed - the server answered with
 * something that is not a usable event stream. For the work log route this only happens when the
 * operator's session is no longer authenticated.
 */
const closedReadyState = 2;

/**
 * Gets the problem to report for a failed console log stream, based on the `EventSource`'s
 * `readyState` at the moment `onerror` fired.
 *
 * A `CONNECTING` (0) readyState covers both a transient transport error and the stream ending
 * normally (the worker container is gone) - the two are indistinguishable from `readyState` alone,
 * so no problem is reported for it. Reporting one here would flash an error on every completed
 * work item, since the stream is opened for every item including finished ones.
 * @param readyState The `EventSource.readyState` at the moment `onerror` fired.
 * @returns The problem to report, or `undefined` when nothing should be shown.
 */
export const logStreamFailureMessage = (readyState: number): string | undefined =>
    readyState === closedReadyState
        ? 'The console log stream was refused - sign in again to keep watching this work.'
        : undefined;

/**
 * Gets the problem to report for a failed steering request, based on the HTTP response status.
 * `undefined` is passed when the request failed before a response was received (a network error).
 * @param status The HTTP status of the response, or `undefined` for a network failure.
 * @returns The problem to report.
 */
export const steeringFailureMessage = (status: number | undefined): string =>
    status === 401
        ? 'Your session has expired - sign in again to steer the running session.'
        : 'Sending failed - the running session did not receive your message.';
