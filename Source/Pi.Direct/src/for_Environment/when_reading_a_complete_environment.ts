// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readLaunchEnvironment } from '../Environment.ts';
import { launchEnvironment } from './given/an_environment.ts';

describe('when reading a complete environment', () => {
    const result = readLaunchEnvironment(launchEnvironment);

    it('should carry the tenant', () => result.tenantId.should.equal('tenant-a'));
    it('should carry the work handle', () => result.workHandle.should.equal('work-1'));
    it('should carry the proof file', () => result.proofFile.should.equal('/state/launches/abc/launch.proof'));
});
