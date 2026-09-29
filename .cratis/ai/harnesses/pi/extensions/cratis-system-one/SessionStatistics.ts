// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FailureClass } from './FailureClass.ts';
import type { RecentDecision } from './RecentDecision.ts';
import type { SkipReason } from './SkipReason.ts';

const ringCapacity = 20;

/** In-memory only: counts for `/system-one status` and a ring buffer for `/system-one last`. Never persisted. */
export class SessionStatistics {
    requests = 0;
    successes = 0;
    readonly failures = new Map<FailureClass, number>();
    readonly skipped = new Map<SkipReason, number>();
    readonly recent: RecentDecision[] = [];
    readonly #noticed = new Set<string>();

    get failureCount(): number {
        return [...this.failures.values()].reduce((total, count) => total + count, 0);
    }

    recordFailure(failure: FailureClass): void {
        this.failures.set(failure, (this.failures.get(failure) ?? 0) + 1);
    }

    recordSkip(reason: SkipReason): void {
        this.skipped.set(reason, (this.skipped.get(reason) ?? 0) + 1);
    }

    remember(decision: RecentDecision): void {
        this.recent.push(decision);
        if (this.recent.length > ringCapacity) this.recent.shift();
    }

    /** True the first time a class is seen, so each error class is announced once per session. */
    firstNotice(noticeClass: string): boolean {
        if (this.#noticed.has(noticeClass)) return false;
        this.#noticed.add(noticeClass);
        return true;
    }
}
