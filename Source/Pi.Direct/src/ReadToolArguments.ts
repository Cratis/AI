// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createFindToolDefinition, createGrepToolDefinition, createLsToolDefinition, createReadToolDefinition } from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Check } from 'typebox/value';

const readSchemas = new Map<string, TSchema>([
    createReadToolDefinition('.'), createGrepToolDefinition('.'), createFindToolDefinition('.'), createLsToolDefinition('.')
].map(tool => [tool.name, tool.parameters] as const));

/** Validate reader arguments and supply the cwd default only for an omitted optional path. */
export function requestedPath(toolName: string, input: unknown): string | undefined {
    const schema = readSchemas.get(toolName);
    if (!schema || !Check(schema, input)) return undefined;
    const path = (input as Record<string, unknown>).path;
    if (path === undefined) return '.';
    return typeof path === 'string' && !path.includes('\0') ? path : undefined;
}
