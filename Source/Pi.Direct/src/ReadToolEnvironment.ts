// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ToolInfo } from '@earendil-works/pi-coding-agent';

/** Whether this reader inherits ripgrep configuration that can invalidate its read-only exception. */
export function usesRipgrepConfiguration(tool: Pick<ToolInfo, 'name'>): boolean {
    return tool.name === 'grep' && Boolean(process.env.RIPGREP_CONFIG_PATH);
}
