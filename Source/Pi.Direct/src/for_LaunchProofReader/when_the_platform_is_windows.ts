// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_proof_file } from './given/a_proof_file.ts';

describe('when the platform is windows', given(a_proof_file, context => {
    let error: unknown;

    beforeEach(async () => {
        context.platform = 'win32';
        error = await thrownBy(() => context.read());
    });

    it('should refuse as unsupported', () => (error as SessionRefused).code.should.equal('unsupported-platform'));
    it('should not read the file', () => context.fileSystem.reads.should.equal(0));
}));
