// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

interface ToolResult { content: { type: 'text'; text: string }[]; isError?: boolean }
interface Tool {
    name: string; label: string; description: string;
    parameters: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
    execute: (id: string, parameters: Record<string, string>, signal?: AbortSignal) => Promise<ToolResult>;
}
interface PiTools { registerTool: (tool: Tool) => void }

/** Only this trusted extension runs on the host. ALL agent tools execute inside the offline sandbox. */
export default function sandboxTools(pi: PiTools): void {
    const container = process.env.CRATIS_SUITE_CONTAINER;
    if (!container || !/^cratis-suite-[a-f0-9-]+$/.test(container)) throw new Error('Missing suite-owned sandbox');
    const execute = (command: string, input: string, signal?: AbortSignal, admitted = false): Promise<ToolResult> => new Promise(resolve => {
        const docker = ['docker', 'exec', '-i', '-w', '/workspace', container, '/bin/sh', '-c', command];
        const phase = [join(process.env.HOME!, '.pi/agent/bin/pi-phase'), 'run', '--kind', 'test', '--label', 'corpus-v2-agent-tool',
            '--queue-timeout', '3600', '--timeout', '600', '--log', join(process.env.CRATIS_SUITE_TOOL_LOGS!, `${randomUUID()}.log`), '--', ...docker];
        const invocation = admitted ? phase : docker;
        const child = spawn(invocation[0], invocation.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
        let text = '';
        let overflow = false;
        const stop = () => child.kill('SIGKILL');
        const timer = setTimeout(stop, admitted ? 4_230_000 : 90_000);
        signal?.addEventListener('abort', stop, { once: true });
        const collect = (chunk: Buffer) => {
            if (text.length + chunk.length > 64_000) { overflow = true; stop(); return; }
            text += chunk.toString();
        };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.stdin.on('error', () => { /* A terminated container can close stdin before the host write. */ });
        child.stdin.end(input);
        const finish = (failed: boolean, failure = '') => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', stop);
            resolve({ content: [{ type: 'text', text: text + failure + (overflow ? '\nOutput limit exceeded' : '') }], isError: failed || overflow });
        };
        child.on('error', error => finish(true, String(error)));
        child.on('close', code => finish(code !== 0));
    });
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const register = (name: string, description: string, properties: Record<string, unknown>, required: string[],
        command: (parameters: Record<string, string>) => [string, string]) => pi.registerTool({
        name, label: name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
        execute: (_id, parameters, signal) => { const [shell, input] = command(parameters); return execute(shell, input, signal, name === 'bash'); },
    });
    const string = { type: 'string' };
    register('read', 'Read a file inside the sandbox. Read skill files under /corpus using this tool for routing telemetry.', { path: string }, ['path'],
        parameters => [`cat -- ${quote(parameters.path)}`, '']);
    register('write', 'Write a sandbox file, creating parent directories.', { path: string, content: string }, ['path', 'content'],
        parameters => [`mkdir -p -- "$(dirname -- ${quote(parameters.path)})" && cat > ${quote(parameters.path)}`, parameters.content]);
    register('edit', 'Replace one unique exact string in a sandbox file.', { path: string, oldText: string, newText: string }, ['path', 'oldText', 'newText'],
        parameters => [`node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync(0,"utf8"));const s=fs.readFileSync(p.path,"utf8");if(!p.oldText||s.split(p.oldText).length!==2)throw Error("Match must be unique");fs.writeFileSync(p.path,s.replace(p.oldText,p.newText));'`, JSON.stringify(parameters)]);
    register('bash', 'Execute a shell command inside the network-disabled sandbox, never on the host.', { command: string }, ['command'],
        parameters => [parameters.command, '']);
}
