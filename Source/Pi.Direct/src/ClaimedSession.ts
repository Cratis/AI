// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { LaunchEnvironment } from './Environment.ts';
import type { ReleaseOutcome, WorkPayload } from './DirectContract.ts';
import type { DirectGateway } from './DirectGateway.ts';
import { Clock, HeartbeatLoop } from './HeartbeatLoop.ts';
import { SessionRefused } from './Refusals.ts';
import type { WriteGuard } from './WriteGuard.ts';

export interface SessionDependencies {
    readonly environment: LaunchEnvironment;
    readonly gateway: DirectGateway;
    readonly guard: WriteGuard;
    readonly clock: Clock;
    /** Shows a fixed, secret-free message to the person. */
    readonly notify: (message: string) => void;
}

export interface SessionStatus {
    readonly workHandle: string;
    readonly epoch: number;
    readonly secondsToLeaseEnd: number;
    readonly authority: 'live' | 'lost' | 'released';
}

/** The one lifecycle: live, then releasing, then released or lost. Expiry and failure only ever act on a live or releasing session. */
type SessionPhase = 'live' | 'releasing' | 'released' | 'lost';

/** One claimed work item: keeps the lease by heartbeat, releases exactly once, and turns lost authority into a terminal guard. */
export class ClaimedSession {
    private epoch: number;
    private leaseEndsAt: number;
    private phase: SessionPhase = 'live';
    private readonly heartbeat: HeartbeatLoop;

    private constructor(
        private readonly dependencies: SessionDependencies,
        private readonly claimId: string,
        epoch: number,
        leaseSeconds: number,
        heartbeatSeconds: number,
        readonly payload: WorkPayload) {
        this.epoch = epoch;
        this.leaseEndsAt = dependencies.clock.now() + leaseSeconds * 1000;
        this.heartbeat = new HeartbeatLoop(dependencies.clock, () => this.beat(), () => this.loseAuthority());
        this.heartbeat.start(heartbeatSeconds);
    }

    /** One claim attempt: any refusal is final and generic. The proof buffer is zeroed whatever the outcome. */
    static async claim(dependencies: SessionDependencies, proof: Buffer): Promise<ClaimedSession> {
        const { environment, gateway, guard } = dependencies;
        try {
            const claimed = await gateway.claim({
                workHandle: environment.workHandle,
                session: environment.sessionId,
                harness: environment.harness,
                launchProof: proof.toString('latin1')
            });
            guard.open();
            return new ClaimedSession(dependencies, claimed.claimId, claimed.epoch, claimed.leaseSeconds, claimed.heartbeatSeconds, claimed.payload);
        } catch {
            throw new SessionRefused('refused');
        } finally {
            proof.fill(0);
        }
    }

    /**
     * Authority ends at the granted lease deadline whether or not a heartbeat is still pending. Called before every
     * guarded write: once the deadline has passed the guard is terminal and the person is told once.
     */
    checkLease(): void {
        if (this.phase === 'live' && this.leaseExpired()) this.loseAuthority();
    }

    status(): SessionStatus {
        const { clock, environment } = this.dependencies;
        this.checkLease();
        const authority = this.phase === 'releasing' ? 'live' : this.phase;
        return {
            workHandle: environment.workHandle,
            epoch: this.epoch,
            secondsToLeaseEnd: Math.max(0, Math.round((this.leaseEndsAt - clock.now()) / 1000)),
            authority
        };
    }

    /** Releases with an outcome exactly once; a lost claim cannot release. */
    async finish(outcome: ReleaseOutcome, reason?: string): Promise<void> {
        if (this.phase === 'releasing' || this.phase === 'released') throw new SessionRefused('already-released');
        this.checkLease();
        if (this.phase !== 'live') throw new SessionRefused('authority-lost');
        this.phase = 'releasing';
        this.heartbeat.stop();
        try {
            await this.dependencies.gateway.release({ workHandle: this.dependencies.environment.workHandle, claimId: this.claimId, epoch: this.epoch, outcome, reason });
            this.phase = 'released';
            this.dependencies.guard.markReleased();
        } catch {
            this.loseAuthority();
            throw new SessionRefused('refused');
        } finally {
            await this.dependencies.gateway.close().catch(() => undefined);
        }
    }

    /** Session shutdown: release as Abandoned, best effort, when nothing else released the work. */
    async shutdown(): Promise<void> {
        this.heartbeat.stop();
        this.checkLease();
        if (this.phase === 'live') {
            await this.finish('Abandoned').catch(() => undefined);
            return;
        }
        await this.dependencies.gateway.close().catch(() => undefined);
    }

    private async beat(): Promise<void> {
        const { gateway, environment, clock } = this.dependencies;
        const result = await gateway.heartbeat({ workHandle: environment.workHandle, claimId: this.claimId, epoch: this.epoch });
        this.checkLease();
        if (this.phase !== 'live') return; // a late answer never revives expired authority
        this.epoch = result.epoch;
        this.leaseEndsAt = clock.now() + result.leaseSeconds * 1000;
    }

    private leaseExpired(): boolean {
        return this.dependencies.clock.now() >= this.leaseEndsAt;
    }

    private loseAuthority(): void {
        this.heartbeat.stop();
        if (this.phase === 'lost' || this.phase === 'released') return;
        this.phase = 'lost';
        this.dependencies.guard.markLost();
        this.dependencies.notify(new SessionRefused('authority-lost').message);
    }
}
