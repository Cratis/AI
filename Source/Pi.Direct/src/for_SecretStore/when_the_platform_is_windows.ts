// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeRunner, thrownBy } from '../for_Support/given/Fakes.ts';
import { createSecretStore } from '../SecretStore.ts';

class context {
    readonly runner = new FakeRunner();
}

describe('when the platform is windows', given(context, context => {
    let error: unknown;

    beforeEach(async () => {
        error = await thrownBy(() => createSecretStore('win32', context.runner.run));
    });

    it('should refuse as unsupported', () => (error as SessionRefused).code.should.equal('unsupported-platform'));
    it('should run nothing', () => context.runner.calls.length.should.equal(0));
}));
