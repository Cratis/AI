// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { given } from '../given.ts';
import { a_workspace } from './given/a_workspace.ts';

for (const config of [undefined, '', '/external/ripgrep.conf', ' ', '/missing/ripgrep.conf']) {
    describe(`when RIPGREP_CONFIG_PATH is ${JSON.stringify(config)}`, given(a_workspace, context => {
        let before: boolean;
        let allowed: boolean;
        let find: boolean;
        let unchanged: boolean;
        beforeEach(() => {
            vi.stubEnv('RIPGREP_CONFIG_PATH', undefined);
            before = context.allowance.allows('grep', { pattern: '.' }, context.workspace);
            vi.stubEnv('RIPGREP_CONFIG_PATH', config);
            allowed = context.allowance.allows('grep', { pattern: '.' }, context.workspace);
            find = context.allowance.allows('find', { pattern: '*' }, context.workspace);
            unchanged = process.env.RIPGREP_CONFIG_PATH === config;
        });
        afterEach(() => { vi.unstubAllEnvs(); context.dispose(); });

        it('should allow grep before configuration is set', () => before.should.equal(true));
        it('should inspect the current environment and allow only unset or empty configuration', () => allowed.should.equal(!config));
        it('should not treat ripgrep configuration as fd options', () => find.should.equal(true));
        it('should not alter the inherited environment', () => unchanged.should.equal(true));
    }));
}
