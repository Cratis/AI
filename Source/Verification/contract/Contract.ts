// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Contract {
    schemaVersion: number;
    keywords: string[];
    topLevelConstructs: string[];
    constructs: Array<{ name: string }>;
    diagnostics: Array<{ code: string; reserved: boolean; retired: boolean }>;
    mcpTools: Array<{ name: string; requiredParameters: string[]; optionalParameters: string[] }>;
    cliCommands: Array<{ name: string; options: string[]; aliases: string[] }>;
}
