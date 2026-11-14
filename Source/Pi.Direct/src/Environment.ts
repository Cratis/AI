// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { SessionRefused } from './Refusals.ts';

/** The names the runner sets on every harness launch. All are non-secret; the proof itself is never in the environment. */
export const EnvironmentNames = {
    launchProofFile: 'DIRECT_LAUNCH_PROOF_FILE',
    workHandle: 'DIRECT_WORK_HANDLE',
    sessionId: 'DIRECT_SESSION_ID',
    harness: 'DIRECT_HARNESS',
    mcpUrl: 'DIRECT_MCP_URL',
    tenantId: 'DIRECT_TENANT_ID'
} as const;

export interface LaunchEnvironment {
    readonly proofFile: string;
    readonly workHandle: string;
    readonly sessionId: string;
    readonly harness: string;
    readonly mcpUrl: string;
    readonly tenantId: string;
}

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const maximumTenantLength = 128;
const unsafeTenant = /[\s\p{Cc},]/u;

/** A tenant is one bounded single-line value; the server parser stays the authority on its shape. */
export function isValidTenant(value: string | undefined): value is string {
    return value !== undefined && value.length > 0 && value.length <= maximumTenantLength && !unsafeTenant.test(value);
}

export function isLaunchedSession(env: EnvironmentSource): boolean {
    return !!env[EnvironmentNames.launchProofFile];
}

function required(env: EnvironmentSource, name: string): string {
    const value = env[name];
    if (!value) throw new SessionRefused('incomplete-environment');
    return value;
}

/** Reads the launch environment; refuses when any value is missing instead of guessing. */
export function readLaunchEnvironment(env: EnvironmentSource): LaunchEnvironment {
    const proofFile = required(env, EnvironmentNames.launchProofFile);
    const workHandle = required(env, EnvironmentNames.workHandle);
    const sessionId = required(env, EnvironmentNames.sessionId);
    const harness = required(env, EnvironmentNames.harness);
    const mcpUrl = required(env, EnvironmentNames.mcpUrl);
    const tenantId = env[EnvironmentNames.tenantId];
    if (!isValidTenant(tenantId)) throw new SessionRefused(tenantId ? 'invalid-tenant' : 'incomplete-environment');
    return { proofFile, workHandle, sessionId, harness, mcpUrl, tenantId };
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The origin that keys the keychain entry; plain http is accepted only for loopback. */
export function originOf(mcpUrl: string): string {
    let url: URL;
    try { url = new URL(mcpUrl); } catch { throw new SessionRefused('incomplete-environment'); }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHosts.has(url.hostname))) {
        throw new SessionRefused('insecure-endpoint');
    }
    return url.origin;
}
