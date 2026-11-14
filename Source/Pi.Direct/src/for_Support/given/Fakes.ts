// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type {
    ClaimRequest, HeartbeatRequest, HeartbeatResult, ReleaseRequest, ReleaseResult, WorkClaimed
} from '../../DirectContract.ts';
import type { DirectGateway } from '../../DirectGateway.ts';
import type { Clock } from '../../HeartbeatLoop.ts';
import type { FileInfo, ProofFileSystem } from '../../LaunchProofReader.ts';
import type { CommandResult, CommandRunner } from '../../SecretStore.ts';

export const sentinelProof = 'c0ffee'.repeat(10) + 'c0ff';
export const sentinelToken = 'direct_pat_v1_SENTINEL_TOKEN_VALUE';

export async function thrownBy(action: () => unknown): Promise<unknown> {
    try { await action(); } catch (error) { return error; }
    return undefined;
}

export class FakeFileSystem implements ProofFileSystem {
    readonly entries = new Map<string, FileInfo>();
    readonly contents = new Map<string, Buffer>();
    readonly removed: string[] = [];
    reads = 0;

    add(path: string, info: Partial<FileInfo>, content?: string): void {
        this.entries.set(path, { isFile: true, isDirectory: false, isSymbolicLink: false, uid: 501, mode: 0o100600, size: content?.length ?? 64, ...info });
        if (content !== undefined) this.contents.set(path, Buffer.from(content, 'latin1'));
    }

    lstat(path: string): FileInfo | undefined { return this.entries.get(path); }

    readNoFollow(path: string, limit: number): Buffer {
        this.reads++;
        return Buffer.from(this.contents.get(path)!.subarray(0, limit));
    }

    remove(path: string): void {
        this.removed.push(path);
        this.entries.delete(path);
    }
}

export class FakeClock implements Clock {
    private time = 0;
    private nextHandle = 1;
    readonly timers = new Map<number, { at: number; callback: () => void }>();

    now(): number { return this.time; }

    setTimeout(callback: () => void, milliseconds: number): unknown {
        const handle = this.nextHandle++;
        this.timers.set(handle, { at: this.time + milliseconds, callback });
        return handle;
    }

    clearTimeout(handle: unknown): void { this.timers.delete(handle as number); }

    async advance(milliseconds: number): Promise<void> {
        const target = this.time + milliseconds;
        for (;;) {
            const due = [...this.timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            this.timers.delete(due[0]);
            this.time = due[1].at;
            due[1].callback();
            await new Promise(resolve => setImmediate(resolve));
        }
        this.time = target;
    }
}

export class FakeGateway implements DirectGateway {
    readonly claims: ClaimRequest[] = [];
    readonly heartbeats: HeartbeatRequest[] = [];
    readonly releases: ReleaseRequest[] = [];
    closed = 0;
    claimFails = false;
    heartbeatFails = false;
    epoch = 1;
    claimed: WorkClaimed = {
        workHandle: 'work-1', claimId: 'claim-1', epoch: 1, leaseSeconds: 30, heartbeatSeconds: 10,
        payload: { title: 'Fix the thing', brief: 'Do the work carefully.', repository: 'acme/orders-demo', baseRef: 'main' }
    };

    async claim(request: ClaimRequest): Promise<WorkClaimed> {
        this.claims.push(request);
        if (this.claimFails) throw new Error(`server said no: ${request.launchProof}`);
        return this.claimed;
    }

    async heartbeat(request: HeartbeatRequest): Promise<HeartbeatResult> {
        this.heartbeats.push(request);
        if (this.heartbeatFails) throw new Error('stale epoch');
        this.epoch = request.epoch + 1;
        return { epoch: this.epoch, leaseSeconds: 30 };
    }

    async release(request: ReleaseRequest): Promise<ReleaseResult> {
        this.releases.push(request);
        return { epoch: request.epoch, outcome: request.outcome };
    }

    async close(): Promise<void> { this.closed++; }
}

export class FakeRunner {
    readonly calls: Array<{ command: string; args: readonly string[] }> = [];
    results = new Map<string, CommandResult>();
    fails = false;

    readonly run: CommandRunner = async (command, args) => {
        this.calls.push({ command, args });
        if (this.fails) throw new Error('not installed');
        const account = args.find(argument => argument.includes('|')) ?? '';
        return this.results.get(account) ?? { code: 44, stdout: '' };
    };

    give(account: string, token: string): void { this.results.set(account, { code: 0, stdout: `${token}\n` }); }
}

type Handler = (event: unknown, context: unknown) => unknown;

export class FakePi {
    readonly handlers = new Map<string, Handler>();
    readonly tools: Array<{ name: string; execute: (id: string, parameters: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }> }> = [];
    readonly commands = new Map<string, { handler: (args: string, context: unknown) => Promise<void> }>();
    readonly notifications: string[] = [];

    readonly context = { hasUI: true, cwd: '/work/tree', ui: { notify: (message: string) => { this.notifications.push(message); } } };

    readonly api = {
        on: (event: string, handler: Handler) => { this.handlers.set(event, handler); },
        registerTool: (tool: FakePi['tools'][number]) => { this.tools.push(tool); },
        registerCommand: (name: string, command: { handler: (args: string, context: unknown) => Promise<void> }) => { this.commands.set(name, command); }
    } as unknown as ExtensionAPI;

    emit(event: string, payload: unknown = {}): unknown { return this.handlers.get(event)?.(payload, this.context); }
}
