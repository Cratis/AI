// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { sentinelProof, sentinelToken } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when launching', given(a_launch, context => {
    beforeEach(async () => { await context.launch(); });

    it('should claim once from the environment', () => context.gateway.claims.should.deep.equal([
        { workHandle: 'work-1', session: 'session-1', harness: 'pi', launchProof: sentinelProof }
    ]));
    it('should connect with the keychain token for the tenant', () => context.connections.should.deep.equal([
        { url: 'https://direct.example/mcp', tenant: 'tenant-a', token: sentinelToken }
    ]));
    it('should open the guard', () => context.guard.state.should.equal('open'));
    it('should delete the proof file', () => context.fileSystem.removed.should.deep.equal(['/state/launches/abc/launch.proof']));
    it('should start the heartbeat', () => context.clock.timers.size.should.equal(1));
    it('should not notify', () => context.notifications.length.should.equal(0));
}));
