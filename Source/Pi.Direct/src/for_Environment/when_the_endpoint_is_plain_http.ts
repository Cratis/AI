// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { originOf } from '../Environment.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';

describe('when the endpoint is plain http', () => {
    let error: unknown;

    beforeEach(async () => {
        error = await thrownBy(() => originOf('http://direct.example/mcp'));
    });

    it('should refuse as insecure', () => (error as SessionRefused).code.should.equal('insecure-endpoint'));
    it('should accept loopback', () => originOf('http://localhost:5000/mcp').should.equal('http://localhost:5000'));
    it('should reduce https to the origin', () => originOf('https://direct.example/mcp').should.equal('https://direct.example'));
});
