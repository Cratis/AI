// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { FakeRunner, thrownBy } from '../for_Support/given/Fakes.ts';
import { createSecretStore } from '../SecretStore.ts';

class context {
    readonly runner = new FakeRunner();
}

describe('when the tool is missing', given(context, context => {
    let error: unknown;

    beforeEach(async () => {
        context.runner.fails = true;
        error = await thrownBy(() => createSecretStore('darwin', context.runner.run).read('https://direct.example|tenant-a'));
    });

    it('should report no credential', () => (error as SessionRefused).code.should.equal('no-credential'));
}));
