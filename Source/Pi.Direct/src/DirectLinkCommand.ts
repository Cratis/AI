// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ClaimedSession } from './ClaimedSession.ts';
import { EnvironmentNames, EnvironmentSource, isValidTenant, originOf } from './Environment.ts';
import { SessionRefused, describeRefusal } from './Refusals.ts';
import { CommandRunner, createSecretStore, secretAccount, storeCommand } from './SecretStore.ts';

export interface DirectLinkDependencies {
    readonly env: EnvironmentSource;
    readonly platform: string;
    readonly runner: CommandRunner;
    readonly session: () => ClaimedSession | undefined;
}

function option(tokens: string[], name: string): string | undefined {
    const index = tokens.indexOf(name);
    return index >= 0 ? tokens[index + 1] : undefined;
}

function account(tokens: string[], env: EnvironmentSource): string {
    const tenant = option(tokens, '--tenant') ?? env[EnvironmentNames.tenantId];
    const url = option(tokens, '--origin') ?? env[EnvironmentNames.mcpUrl];
    if (!isValidTenant(tenant)) throw new SessionRefused('invalid-tenant');
    if (!url) throw new SessionRefused('incomplete-environment');
    return secretAccount(originOf(url), tenant);
}

async function keychainPresent(tokens: string[], dependencies: DirectLinkDependencies): Promise<string> {
    try {
        await createSecretStore(dependencies.platform, dependencies.runner).read(account(tokens, dependencies.env));
        return 'present';
    } catch (error) {
        return error instanceof SessionRefused && error.code === 'no-credential' ? 'missing' : describeRefusal(error);
    }
}

function sessionLine(session: ClaimedSession | undefined): string {
    if (!session) return 'Claimed work: none';
    const status = session.status();
    return `Claimed work: ${status.workHandle} (epoch ${status.epoch}, ${status.secondsToLeaseEnd}s to lease end, ${status.authority})`;
}

/** `/direct-link login --tenant <id> [--origin <url>]` prints the keychain command (never with the token); `status` reports state only. */
export async function runDirectLink(args: string, dependencies: DirectLinkDependencies): Promise<string> {
    const tokens = args.split(/\s+/).filter(Boolean);
    try {
        if (tokens[0] === 'login') {
            return `Run this in a terminal; it prompts for your Direct personal access token:\n${storeCommand(dependencies.platform, account(tokens, dependencies.env))}`;
        }
        if (tokens[0] === 'status') {
            return `Keychain credential: ${await keychainPresent(tokens, dependencies)}\n${sessionLine(dependencies.session())}`;
        }
    } catch (error) {
        return describeRefusal(error);
    }
    return 'Usage: /direct-link login --tenant <id> [--origin <url>] | /direct-link status';
}
