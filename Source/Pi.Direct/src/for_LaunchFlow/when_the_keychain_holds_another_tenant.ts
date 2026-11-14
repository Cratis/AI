// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when the keychain holds another tenant', given(a_launch, context => {
    let error: unknown;

    beforeEach(async () => {
        context.env = { DIRECT_TENANT_ID: 'tenant-b' };
        error = await thrownBy(() => context.launch());
    });

    it('should report no credential', () => (error as SessionRefused).code.should.equal('no-credential'));
    it('should not connect', () => context.connections.length.should.equal(0));
    it('should not read the proof', () => context.fileSystem.reads.should.equal(0));
    it('should not claim', () => context.gateway.claims.length.should.equal(0));
}));
