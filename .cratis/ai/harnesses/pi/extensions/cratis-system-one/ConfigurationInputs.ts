// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConfigurationFile } from './ConfigurationFile.ts';

/** Everything resolution depends on, gathered by the caller. */
export interface ConfigurationInputs {
    /** The user's `cratis-system-one.json`. Missing means the user never set it up. */
    user: ConfigurationFile;
    /** The repository's `.cratis/ai.json`. */
    repository: ConfigurationFile;
    environment: NodeJS.ProcessEnv;
}
