// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Valid required arguments for Pi's built-in readers; search/list paths default to cwd. */
export function readArguments(toolName: string): Record<string, unknown> {
    switch (toolName) {
        case 'read': return { path: '.' };
        case 'grep':
        case 'find': return { pattern: '.' };
        default: return {};
    }
}
