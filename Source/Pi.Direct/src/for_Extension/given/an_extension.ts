// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExtension } from '../../index.ts';
import { FakeClock, FakeGateway, FakePi, FakeRunner, sentinelProof, sentinelToken } from '../../for_Support/given/Fakes.ts';

/** The extension over fakes, with a real owner-only proof file in a private temp folder. */
export class an_extension {
    readonly pi = new FakePi();
    readonly gateway = new FakeGateway();
    readonly runner = new FakeRunner();
    readonly clock = new FakeClock();
    readonly env: Record<string, string | undefined> = {};
    readonly folder = mkdtempSync(join(tmpdir(), 'pi-direct-'));
    readonly consoleOutput: string[] = [];

    constructor() {
        this.runner.give('https://direct.example|tenant-a', sentinelToken);
    }

    launchWith(): void {
        const proofFile = join(this.folder, 'launch.proof');
        writeFileSync(proofFile, sentinelProof, { mode: 0o600 });
        Object.assign(this.env, {
            DIRECT_LAUNCH_PROOF_FILE: proofFile, DIRECT_WORK_HANDLE: 'work-1', DIRECT_SESSION_ID: 'session-1',
            DIRECT_HARNESS: 'pi', DIRECT_MCP_URL: 'https://direct.example/mcp', DIRECT_TENANT_ID: 'tenant-a'
        });
    }

    install(): void {
        createExtension({
            env: this.env, platform: 'darwin', uid: process.getuid?.() ?? -1, runner: this.runner.run,
            clock: this.clock, connect: () => this.gateway
        })(this.pi.api);
    }

    dispose(): void { rmSync(this.folder, { recursive: true, force: true }); }
}
