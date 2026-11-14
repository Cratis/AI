// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_launch } from '../for_Support/given/a_launch.ts';

describe('when the tenant is missing', given(a_launch, context => {
    let error: unknown;

    beforeEach(async () => {
        context.env = { DIRECT_TENANT_ID: undefined };
        error = await thrownBy(() => context.launch());
    });

    it('should refuse', () => (error as SessionRefused).code.should.equal('incomplete-environment'));
    it('should not ask the keychain', () => context.runner.calls.length.should.equal(0));
    it('should not connect', () => context.connections.length.should.equal(0));
    it('should not read the proof', () => context.fileSystem.reads.should.equal(0));
    it('should leave the guard closed', () => context.guard.state.should.equal('unclaimed'));
}));
