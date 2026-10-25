// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { check } from './check.ts';
import type { Contract } from './Contract.ts';

export const specimen: Contract = {
    schemaVersion: 1,
    keywords: ['command', 'query'],
    topLevelConstructs: ['command'],
    constructs: [{ name: 'command' }, { name: 'numbers exact' }],
    diagnostics: [
        { code: 'PLAY0001', reserved: false, retired: false },
        { code: 'PLAY0002', reserved: false, retired: false },
        { code: 'PLAY0003', reserved: true, retired: true },
        { code: 'PLAY0100', reserved: false, retired: false },
    ],
    mcpTools: [{ name: 'read-workspace', requiredParameters: ['expectedRevision'], optionalParameters: ['view'] }],
    cliCommands: [{ name: '', options: ['--scope'], aliases: [] }, { name: 'test', options: ['--filter'], aliases: [] }],
};

export const cleanDocument = { file: 'skill.md', content: '# MCP\nMCP tool `read-workspace(view: "overview")`; 1 tools.\nPLAY0001\n`screenplay test <root> --filter Example`\ncommand\n' };

/** Deliberate defects prove each scanner lane detects a violation rather than passing vacuously. */
export function selfTest(): void {
    if (check(specimen, [cleanDocument]).problems.length) throw new Error('Self-test rejected the clean control.');
    const planted = { file: 'planted.md', content: '# MCP\nPLAY9999 and PLAY0003\nMCP tool `unknown-tool(bogus: true)`; 99 tools.\n`screenplay unknown --bogus`\n' };
    const result = check(specimen, [cleanDocument, planted]);
    for (const expected of ['unknown diagnostic PLAY9999', 'retired diagnostic PLAY0003', 'unknown MCP tool unknown-tool', 'unknown MCP parameter unknown-tool.bogus', 'MCP tool count 99', 'unknown screenplay CLI command unknown', 'unknown screenplay unknown option --bogus']) {
        if (!result.problems.some(problem => problem.includes(expected))) throw new Error(`Self-test missed ${expected}.`);
    }
}
