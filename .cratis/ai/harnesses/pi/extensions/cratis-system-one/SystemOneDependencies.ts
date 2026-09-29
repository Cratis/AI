// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConfigurationResult } from './ConfigurationResult.ts';
import type { Transport } from './Transport.ts';

/** Everything the extension takes from outside, so a spec can supply its own. */
export interface SystemOneDependencies {
    transport?: Transport;
    now?: () => number;
    /** Resolves consent and settings for a working directory. The only source of configuration decisions. */
    configure?: (cwd: string) => ConfigurationResult;
    environment?: NodeJS.ProcessEnv;
    /** Where the user's `cratis-system-one.json` lives. Defaults to Pi's agent directory. */
    agentDirectory?: string;
    /** Where this copy of the extension lives. Decides whether it is the packaged copy. Defaults to the real one. */
    extensionDirectory?: string;
    /** Where command output goes when Pi has no UI. Defaults to stderr. */
    write?: (text: string) => void;
    /** Overrides the per-request timeout. For specs only; the setting itself is fixed. */
    requestTimeoutMs?: number;
}
