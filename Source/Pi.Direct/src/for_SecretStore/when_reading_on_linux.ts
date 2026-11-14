// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { FakeRunner, sentinelToken } from '../for_Support/given/Fakes.ts';
import { createSecretStore, secretAccount } from '../SecretStore.ts';

class context {
    readonly runner = new FakeRunner();
    readonly account = secretAccount('https://direct.example', 'tenant-a');
}

describe('when reading on linux', given(context, context => {
    let token: string;

    beforeEach(async () => {
        context.runner.give(context.account, sentinelToken);
        token = await createSecretStore('linux', context.runner.run).read(context.account);
    });

    it('should return the token', () => token.should.equal(sentinelToken));
    it('should use secret-tool', () => context.runner.calls[0].command.should.equal('secret-tool'));
    it('should key the entry by origin and tenant', () => context.runner.calls[0].args.should.include(context.account));
    it('should keep the token off the command line', () => context.runner.calls[0].args.join(' ').should.not.contain(sentinelToken));
}));
