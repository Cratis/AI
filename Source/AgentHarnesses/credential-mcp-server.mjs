// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Only this MCP process loads the credential file; client configuration contains its path.
const configuration = JSON.parse(await readFile(process.argv[2], 'utf8'));
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/TOKEN|API_KEY|CREDENTIAL|KUBECONFIG/.test(name)));

if (configuration.command) {
    const child = spawn(configuration.command, configuration.args, {
        env: { ...environment, ...configuration.env },
        stdio: 'inherit'
    });
    child.on('error', () => {
        process.stderr.write('MCP process could not start\n');
        process.exitCode = 1;
    });
    child.on('exit', (code) => { process.exitCode = code ?? 1; });
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => child.kill(signal));
    }
} else {
    const local = new StdioServerTransport();
    const remote = new StreamableHTTPClientTransport(new URL(configuration.url), {
        requestInit: { headers: configuration.headers }
    });
    let closing = false;
    const close = async (failed = false) => {
        if (closing) return;
        closing = true;
        if (failed) {
            process.stderr.write('MCP connection failed\n');
            process.exitCode = 1;
        }
        await Promise.allSettled([local.close(), remote.close()]);
    };
    local.onmessage = (message) => { remote.send(message).catch(() => close(true)); };
    remote.onmessage = (message) => {
        if (message.result?.protocolVersion) remote.setProtocolVersion(message.result.protocolVersion);
        local.send(message).catch(() => close(true));
    };
    local.onerror = remote.onerror = () => { void close(true); };
    local.onclose = remote.onclose = () => { void close(); };
    process.on('SIGTERM', () => { void close(); });
    process.on('SIGINT', () => { void close(); });
    await remote.start();
    await local.start();
}
