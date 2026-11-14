// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClaimedSession } from '../../ClaimedSession.ts';
import { LaunchDependencies, claimLaunchedWork } from '../../LaunchFlow.ts';
import { WriteGuard } from '../../WriteGuard.ts';
import { environmentWith } from '../../for_Environment/given/an_environment.ts';
import { FakeClock, FakeFileSystem, FakeGateway, FakeRunner, sentinelProof, sentinelToken } from './Fakes.ts';

/** A launched session whose proof file, keychain entry and gateway are all fakes. */
export class a_launch {
    readonly fileSystem = new FakeFileSystem();
    readonly runner = new FakeRunner();
    readonly gateway = new FakeGateway();
    readonly clock = new FakeClock();
    readonly guard = new WriteGuard(new Set(['direct_session_finish']));
    readonly notifications: string[] = [];
    readonly connections: Array<{ url: string; tenant: string; token: string }> = [];
    env: Record<string, string | undefined> = {};

    constructor() {
        this.fileSystem.add('/state/launches/abc', { isFile: false, isDirectory: true, mode: 0o040700 });
        this.fileSystem.add('/state/launches/abc/launch.proof', {}, sentinelProof);
        this.runner.give('https://direct.example|tenant-a', sentinelToken);
    }

    dependencies(): LaunchDependencies {
        return {
            env: environmentWith(this.env),
            platform: 'darwin',
            runner: this.runner.run,
            proofReader: { fileSystem: this.fileSystem, uid: 501, platform: 'darwin', cwd: '/work/tree' },
            connect: (url, tenant, token) => { this.connections.push({ url, tenant, token }); return this.gateway; },
            clock: this.clock,
            guard: this.guard,
            notify: message => { this.notifications.push(message); }
        };
    }

    launch(): Promise<ClaimedSession> { return claimLaunchedWork(this.dependencies()); }
}
