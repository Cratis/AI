// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EnvironmentNames, readLaunchEnvironment } from '../Environment.ts';
import { SessionRefused } from '../Refusals.ts';
import { thrownBy } from '../for_Support/given/Fakes.ts';
import { environmentWith } from './given/an_environment.ts';

describe('when the environment is incomplete', () => {
    let error: unknown;

    beforeEach(async () => {
        error = await thrownBy(() => readLaunchEnvironment(environmentWith({ [EnvironmentNames.workHandle]: '' })));
    });

    it('should refuse as incomplete', () => (error as SessionRefused).code.should.equal('incomplete-environment'));
});
