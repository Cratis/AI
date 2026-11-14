// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { a_proof_file } from './given/a_proof_file.ts';

describe('when the proof file is missing', given(a_proof_file, context => {
    let error: unknown;

    beforeEach(async () => {
        context.fileSystem.entries.delete(context.path);
        error = await thrownBy(() => context.read());
    });

    it('should report the launch as expired', () => (error as SessionRefused).code.should.equal('expired'));
    it('should have nothing to delete', () => context.fileSystem.removed.should.be.empty);
}));
