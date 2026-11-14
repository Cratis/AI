// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EnvironmentNames, EnvironmentSource } from '../../Environment.ts';

export const launchEnvironment: Record<string, string> = {
    [EnvironmentNames.launchProofFile]: '/state/launches/abc/launch.proof',
    [EnvironmentNames.workHandle]: 'work-1',
    [EnvironmentNames.sessionId]: 'session-1',
    [EnvironmentNames.harness]: 'pi',
    [EnvironmentNames.mcpUrl]: 'https://direct.example/mcp',
    [EnvironmentNames.tenantId]: 'tenant-a'
};

export function environmentWith(changes: Record<string, string | undefined>): EnvironmentSource {
    return { ...launchEnvironment, ...changes };
}
