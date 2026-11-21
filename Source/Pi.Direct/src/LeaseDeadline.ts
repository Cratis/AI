// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { leaseMilliseconds } from './DirectContract.ts';
import type { Clock } from './HeartbeatLoop.ts';

/** Incremental wall/monotonic accounting counts suspend; wall rollback beyond 1 second ends authority permanently. */
export class LeaseDeadline {
    private elapsed = 0;
    private ended = false;

    private constructor(
        private readonly clock: Clock,
        private lastWall: number,
        private lastMono: number,
        private readonly durationMs: number) {}

    static start(clock: Clock, leaseSeconds: number): LeaseDeadline {
        return new LeaseDeadline(clock, clock.now(), clock.monotonic(), leaseMilliseconds(leaseSeconds));
    }

    /** Apply the response's grant without discarding elapsed time or reviving an expired request. */
    withGrant(leaseSeconds: number): LeaseDeadline {
        this.observe();
        const deadline = new LeaseDeadline(this.clock, this.lastWall, this.lastMono, leaseMilliseconds(leaseSeconds));
        deadline.elapsed = this.elapsed;
        deadline.ended = this.ended;
        return deadline;
    }

    expired(): boolean { return this.remainingMs() === 0; }

    remainingMs(): number {
        this.observe();
        return this.ended ? 0 : Math.max(0, this.durationMs - this.elapsed);
    }

    private observe(): void {
        if (this.ended) return;
        const wall = this.clock.now();
        const mono = this.clock.monotonic();
        const wallStep = wall - this.lastWall;
        const monoStep = mono - this.lastMono;
        this.lastWall = wall;
        this.lastMono = mono;
        this.elapsed += Math.max(0, wallStep, monoStep);
        if (wallStep < monoStep - 1000) this.ended = true;
        if (this.elapsed >= this.durationMs) this.ended = true;
    }
}
