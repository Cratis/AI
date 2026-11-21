// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { leaseMilliseconds } from './DirectContract.ts';
import type { Clock } from './HeartbeatLoop.ts';

/** Either elapsed-time source can end authority: wall time catches suspend, monotonic time catches rollback. */
export class LeaseDeadline {
    private elapsed = 0;

    private constructor(
        private readonly clock: Clock,
        private readonly wall0: number,
        private readonly mono0: number,
        private readonly durationMs: number) {}

    static start(clock: Clock, leaseSeconds: number): LeaseDeadline {
        return new LeaseDeadline(clock, clock.now(), clock.monotonic(), leaseMilliseconds(leaseSeconds));
    }

    /** Apply the response's grant without moving the request's send-time anchors. */
    withGrant(leaseSeconds: number): LeaseDeadline {
        return new LeaseDeadline(this.clock, this.wall0, this.mono0, leaseMilliseconds(leaseSeconds));
    }

    expired(): boolean { return this.remainingMs() === 0; }

    remainingMs(): number {
        // Observed elapsed time never retreats, even if wall time jumps forward and then back.
        this.elapsed = Math.max(this.elapsed, this.clock.now() - this.wall0, this.clock.monotonic() - this.mono0);
        return Math.max(0, this.durationMs - this.elapsed);
    }
}
