// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BreakerState } from './BreakerState.ts';
import { FailureClass } from './FailureClass.ts';

const maximumRetryAfterMs = 10 * 60_000;

/**
 * Stops asking a server that keeps failing. It opens after `threshold` consecutive failures, or at once
 * for a rate-limit or overload answer, for as long as the server asked (Retry-After) or an exponentially
 * growing back-off. After that one probe request is allowed: success closes it, failure re-opens it.
 */
export class CircuitBreaker {
    #consecutiveFailures = 0;
    #trips = 0;
    #reopenAt = 0;
    #open = false;
    #probing = false;

    constructor(
        readonly threshold = 3,
        readonly now: () => number = Date.now,
        readonly baseBackoffMs = 30_000,
        readonly maximumBackoffMs = 300_000,
    ) {}

    get state(): BreakerState {
        if (!this.#open) return BreakerState.Closed;
        return this.now() >= this.#reopenAt ? BreakerState.HalfOpen : BreakerState.Open;
    }

    get retryInMs(): number {
        return this.#open ? Math.max(0, this.#reopenAt - this.now()) : 0;
    }

    /** True when a request may be sent. In the half-open state exactly one caller gets `true`. */
    allow(): boolean {
        switch (this.state) {
            case BreakerState.Closed:
                return true;
            case BreakerState.Open:
                return false;
            case BreakerState.HalfOpen:
                if (this.#probing) return false;
                this.#probing = true;
                return true;
        }
    }

    /** Gives back the probe of a turn that produced no result (the session ended, the turn threw), so the breaker cannot stay stuck. Only that turn may call it. */
    release(): void {
        this.#probing = false;
    }

    /**
     * `isProbe` says whether the turn reporting was the one `allow()` granted the half-open probe to. Only
     * that turn's result closes an open breaker; a turn from before it opened, reporting late, does not.
     */
    recordSuccess(isProbe: boolean): void {
        if (this.#open && !isProbe) return;
        this.#consecutiveFailures = 0;
        this.#trips = 0;
        this.#open = false;
        this.#probing = false;
    }

    /**
     * Returns true when this failure opened (or re-opened) the breaker. `isProbe` says whether the turn
     * reporting was the one `allow()` granted the half-open probe to. A failure that ends a probe always
     * re-opens it with a fresh, longer back-off, however few failures were counted before it opened, for
     * instance when a rate-limit answer opened it after a single failure. A turn from before the breaker
     * opened, failing late, changes nothing while it is open or half-open: the probe decides, and the
     * probe stays the only one.
     */
    recordFailure(failure: FailureClass, retryAfterMs: number | undefined, isProbe: boolean): boolean {
        if (this.#open && !isProbe) return false;
        this.#probing = false;
        this.#consecutiveFailures++;
        const pushedBack = failure === FailureClass.RateLimited || failure === FailureClass.Overloaded;
        if (!isProbe && !pushedBack && this.#consecutiveFailures < this.threshold) return false;
        const backoff = Math.min(this.baseBackoffMs * 2 ** this.#trips, this.maximumBackoffMs);
        const wait = pushedBack && retryAfterMs !== undefined ? Math.min(retryAfterMs, maximumRetryAfterMs) : backoff;
        this.#trips++;
        this.#open = true;
        this.#reopenAt = this.now() + wait;
        return true;
    }
}
