// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

async function directory(t) {
    const root = new URL('../../.ai-work/mcp-tests/', import.meta.url);
    await mkdir(root, { recursive: true });
    const path = await mkdtemp(`${root.pathname}case-`);
    t.after(() => rm(path, { recursive: true, force: true }));
    return path;
}

async function listen(t, handler) {
    const server = createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

async function connect(t, script, args, env = {}) {
    const client = new Client({ name: 'fixture', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath,
        args: [new URL(script, import.meta.url).pathname, ...args], env });
    t.after(() => client.close());
    await client.connect(transport);
    return client;
}

test('remote MCP receives its file-based header and forwards calls', async (t) => {
    const path = await directory(t);
    const remote = new McpServer({ name: 'remote', version: '1.0.0' });
    remote.registerTool('ping', { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'pong' }] }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
    await remote.connect(transport);
    t.after(() => remote.close());
    const headers = [];
    const url = await listen(t, (req, res) => {
        headers.push(req.headers.authorization);
        transport.handleRequest(req, res);
    });
    await writeFile(`${path}/remote.json`, JSON.stringify({ url, headers: { Authorization: 'Bearer fixture-remote' } }), { mode: 0o600 });
    const client = await connect(t, './credential-mcp-server.mjs', [`${path}/remote.json`]);
    assert.equal((await client.callTool({ name: 'ping', arguments: {} })).content[0].text, 'pong');
    assert.ok(headers.length > 1);
    assert.ok(headers.every(header => header === 'Bearer fixture-remote'));
});

test('stdio MCP receives only its configured credential', async (t) => {
    const path = await directory(t);
    const script = `${path}/stdio.mjs`;
    const module = new URL('./headless-approval-mcp-server.mjs', import.meta.url).href;
    // Reuse a real local MCP server, refusing to start unless the child environment is scoped.
    await writeFile(script, `if (process.env.CONTEXT7_API_KEY !== 'fixture-context7' || process.env.DIRECT_CALLBACK_TOKEN || process.env.OPENAI_API_KEY) process.exit(1);\nconst { createServer } = await import(${JSON.stringify(module)});\nconst { StdioServerTransport } = await import(${JSON.stringify(new URL('./node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js', import.meta.url).href)});\nawait createServer().connect(new StdioServerTransport());\n`);
    await writeFile(`${path}/stdio.json`, JSON.stringify({ command: process.execPath, args: [script], env: { CONTEXT7_API_KEY: 'fixture-context7' } }), { mode: 0o600 });
    const client = await connect(t, './credential-mcp-server.mjs', [`${path}/stdio.json`], {
        DIRECT_CALLBACK_TOKEN: 'fixture-other', OPENAI_API_KEY: 'fixture-provider'
    });
    assert.ok((await client.listTools()).tools.length > 0);
});

test('progress MCP reads the callback credential from its file', async (t) => {
    const path = await directory(t);
    const calls = [];
    const url = await listen(t, (req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => { calls.push({ authorization: req.headers.authorization, body: JSON.parse(body) }); res.end('{}'); });
    });
    await writeFile(`${path}/callback`, 'fixture-callback', { mode: 0o600 });
    const client = await connect(t, './progress-mcp-server.mjs', [], {
        DIRECT_PROGRESS_URL: url, DIRECT_CALLBACK_TOKEN_FILE: `${path}/callback`
    });
    const result = await client.callTool({ name: 'report_progress', arguments: { note: 'Working' } });
    assert.notEqual(result.isError, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].authorization, 'Bearer fixture-callback');
    assert.equal(calls[0].body.note, 'Working');
});
