// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Transport } from './Transport.ts';

export interface SetupDependencies {
    agentDirectory: string;
    environment: NodeJS.ProcessEnv;
    /** Where output goes when Pi has no UI (`ui.notify` does nothing there). */
    write: (text: string) => void;
    transport?: Transport;
    now?: () => number;
}
