// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../../given.ts';
import { SessionRefused } from '../../Refusals.ts';
import { thrownBy } from '../../for_Support/given/Fakes.ts';
import { a_proof_file } from '../given/a_proof_file.ts';

describe('when reading an unsafe proof with a folder owned by another user', given(a_proof_file, context => {
    let error: unknown;

    beforeEach(async () => {
        context.replaceFolder({ uid: 0 });
        error = await thrownBy(() => context.read());
    });

    it('should refuse as unsafe', () => (error as SessionRefused).code.should.equal('unsafe-proof'));
    it('should not read it', () => context.fileSystem.reads.should.equal(0));
}));
