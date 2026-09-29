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

    recordSuccess(): void {
        this.#consecutiveFailures = 0;
        this.#trips = 0;
        this.#open = false;
        this.#probing = false;
    }

    /** Returns true when this failure opened (or re-opened) the breaker. */
    recordFailure(failure: FailureClass, retryAfterMs?: number): boolean {
        this.#probing = false;
        this.#consecutiveFailures++;
        const pushedBack = failure === FailureClass.RateLimited || failure === FailureClass.Overloaded;
        if (!pushedBack && this.#consecutiveFailures < this.threshold) return false;
        const backoff = Math.min(this.baseBackoffMs * 2 ** this.#trips, this.maximumBackoffMs);
        const wait = pushedBack && retryAfterMs !== undefined ? Math.min(retryAfterMs, maximumRetryAfterMs) : backoff;
        this.#trips++;
        this.#open = true;
        this.#reopenAt = this.now() + wait;
        return true;
    }
}
