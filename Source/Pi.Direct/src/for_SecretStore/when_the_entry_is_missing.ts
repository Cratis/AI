// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeRunner, sentinelToken, thrownBy } from '../for_Support/given/Fakes.ts';
import { createSecretStore, secretAccount } from '../SecretStore.ts';

class context {
    readonly runner = new FakeRunner();
}

describe('when the entry exists only for another tenant', given(context, context => {
    let error: unknown;

    beforeEach(async () => {
        context.runner.give(secretAccount('https://direct.example', 'tenant-b'), sentinelToken);
        error = await thrownBy(() => createSecretStore('darwin', context.runner.run).read(secretAccount('https://direct.example', 'tenant-a')));
    });

    it('should report no credential', () => (error as SessionRefused).code.should.equal('no-credential'));
}));
