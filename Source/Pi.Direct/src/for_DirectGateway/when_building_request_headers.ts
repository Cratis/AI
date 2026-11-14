// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { requestHeaders } from '../DirectGateway.ts';
import { sentinelToken } from '../for_Support/given/Fakes.ts';

describe('when building request headers', () => {
    const headers = requestHeaders(sentinelToken, 'tenant-a');

    it('should carry exactly the bearer and the tenant', () => headers.should.deep.equal({
        Authorization: `Bearer ${sentinelToken}`,
        'x-cratis-tenant-id': 'tenant-a'
    }));
});
