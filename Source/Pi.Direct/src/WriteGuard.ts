// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export type GuardState = 'unclaimed' | 'pending' | 'open' | 'lost' | 'released';

/** Read-only built-in names from Pi's ToolCallEvent; unknown tools fail closed while pending or lost. */
export const readOnlyTools: ReadonlySet<string> = new Set(['read', 'grep', 'find', 'ls']);

/**
 * Blocks the session's write tools unless a claim is live. Lost authority is terminal: nothing but a new session
 * (a new guard with a new claim) opens it again, and acknowledging the loss never does.
 */
export class WriteGuard {
    private current: GuardState = 'unclaimed';

    constructor(private readonly guardedTools: ReadonlySet<string>) {}

    get state(): GuardState { return this.current; }

    /** Restricts local tools before the claim request is sent. */
    markPending(): void {
        if (this.current === 'unclaimed') this.current = 'pending';
    }

    /** Called after the first confirming heartbeat; has no effect once authority was lost. */
    open(): void {
        if (this.current === 'unclaimed' || this.current === 'pending') this.current = 'open';
    }

    markLost(): void {
        if (this.current !== 'released') this.current = 'lost';
    }

    /** The work was released: writes stay refused, and the state is not a loss. */
    markReleased(): void {
        if (this.current === 'open') this.current = 'released';
    }

    /** The person's acknowledgement dismisses a notification; it never lifts the guard. */
    acknowledge(): void {
        // intentionally nothing
    }

    guards(toolName: string): boolean {
        return this.guardedTools.has(toolName);
    }

    blocks(toolName: string): boolean {
        if (this.guards(toolName)) return this.current !== 'open';
        return (this.current === 'pending' || this.current === 'lost') && !readOnlyTools.has(toolName);
    }
}
