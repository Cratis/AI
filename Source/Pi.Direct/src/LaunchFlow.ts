// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClaimedSession } from './ClaimedSession.ts';
import type { DirectGateway } from './DirectGateway.ts';
import { EnvironmentSource, originOf, readLaunchEnvironment } from './Environment.ts';
import type { Clock } from './HeartbeatLoop.ts';
import { ProofReaderEnvironment, readLaunchProof } from './LaunchProofReader.ts';
import { SecretStore, createSecretStore, secretAccount } from './SecretStore.ts';
import type { CommandRunner } from './SecretStore.ts';
import type { WriteGuard } from './WriteGuard.ts';

export interface LaunchDependencies {
    readonly env: EnvironmentSource;
    readonly platform: string;
    readonly runner: CommandRunner;
    readonly proofReader: ProofReaderEnvironment;
    readonly connect: (mcpUrl: string, tenantId: string, token: string) => DirectGateway;
    readonly clock: Clock;
    readonly guard: WriteGuard;
    readonly notify: (message: string) => void;
}

/**
 * The launch flow, in the order that keeps the proof's life shortest: validate the environment and tenant, read the
 * token (a fixable problem must not burn the proof), then read the proof once and claim immediately.
 */
export async function claimLaunchedWork(dependencies: LaunchDependencies): Promise<ClaimedSession> {
    const environment = readLaunchEnvironment(dependencies.env);
    const origin = originOf(environment.mcpUrl);
    const secrets: SecretStore = createSecretStore(dependencies.platform, dependencies.runner);
    const token = await secrets.read(secretAccount(origin, environment.tenantId));
    const proof = readLaunchProof(environment.proofFile, dependencies.proofReader);
    const gateway = dependencies.connect(environment.mcpUrl, environment.tenantId, token);
    try {
        return await ClaimedSession.claim({ environment, gateway, guard: dependencies.guard, clock: dependencies.clock, notify: dependencies.notify }, proof);
    } catch (error) {
        await gateway.close().catch(() => undefined);
        throw error;
    }
}
