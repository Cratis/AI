// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export type GuardState = 'unclaimed' | 'open' | 'lost';

/**
 * Blocks the session's write tools unless a claim is live. Lost authority is terminal: nothing but a new session
 * (a new guard with a new claim) opens it again, and acknowledging the loss never does.
 */
export class WriteGuard {
    private current: GuardState = 'unclaimed';

    constructor(private readonly guardedTools: ReadonlySet<string>) {}

    get state(): GuardState { return this.current; }

    /** Called by a successful claim; has no effect once authority was lost. */
    open(): void {
        if (this.current === 'unclaimed') this.current = 'open';
    }

    markLost(): void {
        this.current = 'lost';
    }

    /** The person's acknowledgement dismisses a notification; it never lifts the guard. */
    acknowledge(): void {
        // intentionally nothing
    }

    guards(toolName: string): boolean {
        return this.guardedTools.has(toolName);
    }

    blocks(toolName: string): boolean {
        return this.guards(toolName) && this.current !== 'open';
    }
}
