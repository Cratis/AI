// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_proof_file } from './given/a_proof_file.ts';

describe('when reading a valid proof', given(a_proof_file, context => {
    let result: Buffer;

    beforeEach(() => { result = context.read(); });

    it('should return the proof bytes', () => result.toString('latin1').should.equal(context.proof));
    it('should delete the file', () => context.fileSystem.removed.should.deep.equal([context.path]));
}));
