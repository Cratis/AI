// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { McpDirectGateway, GatewayOptions } from '../../DirectGateway.ts';
import { sentinelProof } from '../../for_Support/given/Fakes.ts';

export const claimResult = {
    workHandle: 'work-1', claimId: 'claim-1', epoch: 1, leaseSeconds: 30, heartbeatSeconds: 10,
    payload: { title: 'Fix', brief: 'Do it', repository: 'acme/demo', baseRef: 'main' }
};

/** A gateway over a recording tool caller. */
export class a_gateway {
    readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    fails = false;
    options: GatewayOptions = {};

    create(): McpDirectGateway {
        return new McpDirectGateway(async (name, args) => {
            this.calls.push({ name, args });
            if (this.fails) throw new Error(`server text with ${sentinelProof}`);
            return claimResult;
        }, async () => undefined, this.options);
    }

    readonly request = { workHandle: 'work-1', session: 'session-1', harness: 'pi', launchProof: sentinelProof };
}
