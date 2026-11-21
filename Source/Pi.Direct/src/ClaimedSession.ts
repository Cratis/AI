// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { LaunchEnvironment } from './Environment.ts';
import { MaxLeaseSeconds, validateLeaseGrant } from './DirectContract.ts';
import type { ReleaseOutcome, WorkClaimed, WorkPayload } from './DirectContract.ts';
import type { DirectGateway } from './DirectGateway.ts';
import { Clock, HeartbeatLoop, bounded } from './HeartbeatLoop.ts';
import { LeaseDeadline } from './LeaseDeadline.ts';
import { SessionRefused } from './Refusals.ts';
import type { WriteGuard } from './WriteGuard.ts';

export interface SessionDependencies {
    readonly environment: LaunchEnvironment;
    readonly gateway: DirectGateway;
    readonly guard: WriteGuard;
    readonly clock: Clock;
    readonly signal?: AbortSignal;
    /** Shows a fixed, secret-free message to the person. */
    readonly notify: (message: string) => void;
}

export interface SessionStatus {
    readonly workHandle: string;
    readonly epoch: number;
    readonly secondsToLeaseEnd: number;
    readonly authority: 'live' | 'lost' | 'released';
}

/** A claim must be confirmed before going live; released and lost authority are terminal. */
type SessionPhase = 'claimed' | 'live' | 'releasing' | 'released' | 'lost';

function refuseIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) throw new SessionRefused('refused');
}

/** One claimed work item: keeps the lease by heartbeat, releases exactly once, and turns lost authority into a terminal guard. */
export class ClaimedSession {
    readonly payload: WorkPayload;
    private readonly claimId: string;
    private readonly heartbeatSeconds: number;
    private epoch: number;
    private deadline: LeaseDeadline;
    private phase: SessionPhase = 'claimed';
    private readonly heartbeat: HeartbeatLoop;
    private observer: unknown;
    private closing: Promise<void> | undefined;
    private shuttingDown: Promise<void> | undefined;

    private constructor(
        private readonly dependencies: SessionDependencies,
        claimed: WorkClaimed,
        claimDeadline: LeaseDeadline) {
        this.claimId = claimed.claimId;
        this.heartbeatSeconds = claimed.heartbeatSeconds;
        this.payload = claimed.payload;
        this.epoch = claimed.epoch;
        this.deadline = claimDeadline;
        this.heartbeat = new HeartbeatLoop(dependencies.clock, () => this.beat(), () => this.loseAuthority());
    }

    /** One claim attempt: any refusal is final and generic. The proof buffer is zeroed whatever the outcome. */
    static async claim(dependencies: SessionDependencies, proof: Buffer): Promise<ClaimedSession> {
        const { environment, gateway, guard, clock, signal } = dependencies;
        let claimed: WorkClaimed | undefined;
        let session: ClaimedSession | undefined;
        try {
            guard.markPending();
            refuseIfAborted(signal);
            const sent = LeaseDeadline.start(clock, MaxLeaseSeconds);
            claimed = await gateway.claim({
                workHandle: environment.workHandle,
                session: environment.sessionId,
                harness: environment.harness,
                launchProof: proof.toString('latin1')
            });
            refuseIfAborted(signal);
            session = ClaimedSession.fromClaim(dependencies, claimed, sent);
            await session.confirm();
            refuseIfAborted(signal);
            return session;
        } catch {
            guard.markLost();
            session?.endAuthority();
            await ClaimedSession.abandonInterruptedClaim(dependencies, claimed, session);
            throw new SessionRefused('refused');
        } finally {
            proof.fill(0);
        }
    }

    private static fromClaim(dependencies: SessionDependencies, claimed: WorkClaimed, sent: LeaseDeadline): ClaimedSession {
        validateLeaseGrant(claimed.leaseSeconds, claimed.heartbeatSeconds);
        const deadline = sent.withGrant(claimed.leaseSeconds);
        if (deadline.expired()) throw new SessionRefused('refused');
        return new ClaimedSession(dependencies, claimed, deadline);
    }

    private static async abandonInterruptedClaim(dependencies: SessionDependencies, claimed: WorkClaimed | undefined, session: ClaimedSession | undefined): Promise<void> {
        // Ordinary refusal/expiry never releases. Only shutdown abandons a granted claim, best effort.
        if (!dependencies.signal?.aborted || !claimed) return;
        const { clock, gateway, environment } = dependencies;
        const epoch = session?.epoch ?? claimed.epoch;
        await bounded(clock, gateway.release({ workHandle: environment.workHandle, claimId: claimed.claimId, epoch, outcome: 'Abandoned' })).catch(() => undefined);
    }

    /**
     * Authority ends at the granted lease deadline whether or not a heartbeat is still pending. Called before every
     * local tool: once the deadline has passed the guard is terminal and the person is told once.
     */
    checkLease(): void {
        if (this.phase !== 'live' && this.phase !== 'releasing') return;
        if (this.leaseExpired()) this.loseAuthority();
    }

    status(): SessionStatus {
        const { environment } = this.dependencies;
        this.checkLease();
        const authority = this.phase === 'lost' || this.phase === 'released' ? this.phase : 'live';
        return {
            workHandle: environment.workHandle,
            epoch: this.epoch,
            secondsToLeaseEnd: Math.round(this.deadline.remainingMs() / 1000),
            authority
        };
    }

    /** Releases with an outcome exactly once; a lost claim cannot release. */
    async finish(outcome: ReleaseOutcome, reason?: string): Promise<void> {
        this.assertCanFinish();
        this.phase = 'releasing';
        this.heartbeat.stop();
        try {
            await this.dependencies.gateway.release({ workHandle: this.dependencies.environment.workHandle, claimId: this.claimId, epoch: this.epoch, outcome, reason }).catch(() => {
                this.loseAuthority();
                throw new SessionRefused('refused');
            });
            this.checkLease();
            if (this.phase !== 'releasing') throw new SessionRefused('authority-lost');
            this.phase = 'released';
            this.stopObserver();
            this.dependencies.guard.markReleased();
        } finally {
            await this.close();
        }
    }

    private assertCanFinish(): void {
        if (this.phase === 'releasing' || this.phase === 'released') throw new SessionRefused('already-released');
        this.checkLease();
        if (this.phase !== 'live') throw new SessionRefused('authority-lost');
    }

    /** Session shutdown: release as Abandoned, best effort, when nothing else released the work. */
    shutdown(): Promise<void> {
        return this.shuttingDown ??= this.abandon();
    }

    private async abandon(): Promise<void> {
        this.heartbeat.stop();
        this.checkLease();
        const release = this.phase === 'live';
        this.endAuthority();
        if (release) {
            const { clock, gateway, environment } = this.dependencies;
            await bounded(clock, gateway.release({ workHandle: environment.workHandle, claimId: this.claimId, epoch: this.epoch, outcome: 'Abandoned' })).catch(() => undefined);
        }
        await this.close();
    }

    private close(): Promise<void> {
        this.stopObserver();
        return this.closing ??= bounded(this.dependencies.clock, this.dependencies.gateway.close()).catch(() => undefined);
    }

    /** Only the confirming heartbeat's own send-time deadline can authorize the first write. */
    private async confirm(): Promise<void> {
        const { gateway, environment, clock, guard } = this.dependencies;
        try {
            const sent = LeaseDeadline.start(clock, MaxLeaseSeconds);
            const result = await gateway.heartbeat({ workHandle: environment.workHandle, claimId: this.claimId, epoch: this.epoch });
            this.epoch = result.epoch;
            refuseIfAborted(this.dependencies.signal);
            validateLeaseGrant(result.leaseSeconds, this.heartbeatSeconds);
            this.deadline = sent.withGrant(result.leaseSeconds);
            if (this.leaseExpired()) throw new SessionRefused('refused');
            this.phase = 'live';
            guard.open();
            this.heartbeat.start(this.heartbeatSeconds);
            this.startObserver();
        } catch (error) {
            this.phase = 'lost';
            throw error;
        }
    }

    private async beat(): Promise<void> {
        const { gateway, environment, clock } = this.dependencies;
        const sent = LeaseDeadline.start(clock, MaxLeaseSeconds);
        const result = await gateway.heartbeat({ workHandle: environment.workHandle, claimId: this.claimId, epoch: this.epoch });
        this.checkLease();
        if (this.dependencies.signal?.aborted) this.endAuthority();
        if (this.phase !== 'live') return; // a late answer never revives expired authority
        validateLeaseGrant(result.leaseSeconds, this.heartbeatSeconds);
        const deadline = sent.withGrant(result.leaseSeconds);
        if (deadline.expired()) {
            this.loseAuthority();
            return;
        }
        this.deadline = deadline;
        this.epoch = result.epoch;
    }

    private startObserver(): void {
        this.observer ??= this.dependencies.clock.setInterval(() => this.checkLease(), 1000);
    }

    private stopObserver(): void {
        if (this.observer === undefined) return;
        this.dependencies.clock.clearInterval(this.observer);
        this.observer = undefined;
    }

    private leaseExpired(): boolean {
        return this.deadline.expired();
    }

    private loseAuthority(): void {
        this.heartbeat.stop();
        this.stopObserver();
        if (this.phase === 'lost' || this.phase === 'released') return;
        this.endAuthority();
        this.dependencies.notify(new SessionRefused('authority-lost').message);
    }

    private endAuthority(): void {
        this.heartbeat.stop();
        this.stopObserver();
        if (this.phase === 'released') return;
        this.phase = 'lost';
        this.dependencies.guard.markLost();
    }
}
