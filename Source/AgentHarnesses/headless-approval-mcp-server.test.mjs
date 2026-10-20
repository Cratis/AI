// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
// Verifies headless-approval-mcp-server.mjs over real stdio with the SDK's own MCP client, the way
// the Claude CLI calls it for --permission-prompt-tool: the tool is listed under the name
// entrypoint.sh passes, and its text result is the JSON permission decision the CLI parses -
// `allow`, with the tool's input passed through unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { approve } from './headless-approval-mcp-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.join(__dirname, 'headless-approval-mcp-server.mjs');

async function connectToServer() {
    const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER_SCRIPT], stderr: 'pipe' });
    const client = new Client({ name: 'headless-approval-mcp-server-test', version: '1.0.0' });
    await client.connect(transport);
    return client;
}

test('approve allows and passes the input through unchanged', () => {
    const input = { command: 'gh pr view 1', description: 'View the pull request' };
    assert.deepEqual(approve({ tool_name: 'Bash', input }), { behavior: 'allow', updatedInput: input });
});

test('the tool is listed under the name entrypoint.sh passes to --permission-prompt-tool', async (t) => {
    const client = await connectToServer();
    t.after(() => client.close());

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), ['approve_permission']);
});

test('a permission prompt over stdio is answered with an allow decision', async (t) => {
    const client = await connectToServer();
    t.after(() => client.close());

    const input = { command: 'git push origin HEAD' };
    const result = await client.callTool({
        name: 'approve_permission',
        arguments: { tool_name: 'Bash', input, tool_use_id: 'toolu_test' },
    });

    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), { behavior: 'allow', updatedInput: input });
});
