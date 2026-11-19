// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Clock {
    now(): number;
    setTimeout(callback: () => void, milliseconds: number): unknown;
    clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
    now: () => Date.now(),
    setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/** Beats at the granted interval, one at a time. The first failure stops the loop and is reported once. */
export class HeartbeatLoop {
    private handle: unknown;
    private running = false;

    constructor(
        private readonly clock: Clock,
        private readonly beat: () => Promise<void>,
        private readonly onFailure: (error: unknown) => void) {}

    get isRunning(): boolean { return this.running; }

    start(intervalSeconds: number): void {
        if (this.running) return;
        this.running = true;
        this.schedule(intervalSeconds * 1000);
    }

    stop(): void {
        this.running = false;
        if (this.handle !== undefined) this.clock.clearTimeout(this.handle);
        this.handle = undefined;
    }

    private schedule(milliseconds: number): void {
        this.handle = this.clock.setTimeout(() => void this.tick(milliseconds), milliseconds);
    }

    private async tick(milliseconds: number): Promise<void> {
        this.handle = undefined;
        try {
            await this.beat();
        } catch (error) {
            if (this.running) { this.stop(); this.onFailure(error); }
            return;
        }
        if (this.running) this.schedule(milliseconds);
    }
}
