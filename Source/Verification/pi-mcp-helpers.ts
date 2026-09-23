// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { registerBridge } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/index.ts';
import { StdioConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/StdioConnection.ts';

export function projectFixture(configuration: unknown = { profiles: ['cratis/screenplay'] }) {
    const workspace = process.env.AI_WORK_OUTPUT ?? resolve(import.meta.dirname, '../../.ai-work/pi-mcp-specs');
    mkdirSync(workspace, { recursive: true });
    const project = realpathSync(mkdtempSync(join(workspace, 'project-')));
    const corpus = join(project, 'corpus');
    mkdirSync(corpus);
    mkdirSync(join(project, '.cratis', 'screenplay'), { recursive: true });
    const configure = (value: unknown) => writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(value));
    configure(configuration);
    writeFileSync(join(corpus, 'profile-catalog.json'), JSON.stringify({
        publicProfiles: [
            { id: 'cratis/screenplay', languages: ['language-agnostic'] },
            { id: 'composed', composes: ['cratis/screenplay', 'other'], languages: ['language-agnostic'] },
            { id: 'other', languages: ['csharp'] },
        ], engineeringProfiles: [],
    }));
    const descriptor = {
        schemaVersion: '1.0', servers: [{ id: 'screenplay', profiles: ['cratis/screenplay'], transport: 'stdio', command: 'cratis', args: ['screenplay', 'mcp'], defaultRoot: '.cratis/screenplay' }],
    };
    writeFileSync(join(corpus, 'mcp-servers.json'), JSON.stringify(descriptor));
    return { project, corpus, configure, descriptor };
}

export function tool(name: string, properties: Record<string, unknown> = {}) {
    return {
        name, description: `Screenplay ${name}`, inputSchema: { type: 'object', properties, additionalProperties: false },
        annotations: { readOnlyHint: name !== 'apply' && name !== 'recover-workspace', destructiveHint: name === 'apply' || name === 'recover-workspace' },
    };
}

export function fakeChild() {
    const events = new EventEmitter();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const requests: Array<Record<string, unknown>> = [];
    let respond: (request: Record<string, unknown>) => void = () => {};
    const child = Object.assign(events, {
        stdout, stderr, exitCode: null as number | null, signalCode: null as string | null,
        stdin: new Writable({
            write(chunk, _encoding, callback) {
                const request = JSON.parse(chunk.toString()) as Record<string, unknown>;
                requests.push(request);
                queueMicrotask(() => respond(request));
                callback();
            },
        }),
        killed: false,
        kill(signal: string) {
            child.killed = true;
            child.signalCode = signal;
            queueMicrotask(() => child.emit('close', null, signal));
            return true;
        },
    });
    return {
        child: child as unknown as ChildProcessWithoutNullStreams, requests,
        onRequest(handler: typeof respond) { respond = handler; },
        result(request: Record<string, unknown>, result: unknown) { stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`); },
        protocolError(request: Record<string, unknown>) { stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Rejected' } })}\n`); },
        exit() { child.exitCode = 1; child.emit('close', 1, null); },
    };
}

export function nativeHarness(fixture: ReturnType<typeof projectFixture>, discovered = [tool('diagnostics'), tool('apply')], excluded: string[] = []) {
    const registered = new Map<string, ToolDefinition>();
    const handlers = new Map<string, (event: Record<string, unknown>, context: ExtensionContext) => unknown>();
    let active = ['read'];
    let approved = true;
    let confirmationCount = 0;
    const children: ReturnType<typeof fakeChild>[] = [];
    const context = {
        cwd: fixture.project, hasUI: true,
        ui: { async confirm() { confirmationCount++; return approved; } },
    } as unknown as ExtensionContext;
    const api = {
        registerTool(definition: ToolDefinition) {
            const existing = registered.has(definition.name);
            registered.set(definition.name, definition);
            if (!existing && !excluded.includes(definition.name)) active.push(definition.name);
        },
        getActiveTools: () => [...active],
        getAllTools: () => [...registered.values()].filter(tool => !excluded.includes(tool.name)),
        setActiveTools(names: string[]) { active = names.filter(name => !excluded.includes(name)); },
        on(name: string, handler: (event: Record<string, unknown>, context: ExtensionContext) => unknown) { handlers.set(name, handler); return () => handlers.delete(name); },
    } as unknown as ExtensionAPI;
    registerBridge(api, fixture.corpus, project => {
        if (project !== fixture.project) throw new Error('Wrong physical project');
        const child = fakeChild();
        child.onRequest(request => {
            if (request.method === 'initialize') child.result(request, { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'cratis.screenplay' } });
            if (request.method === 'tools/list') child.result(request, { tools: discovered });
            if (request.method === 'tools/call') child.result(request, { content: [{ type: 'text', text: 'done' }], structuredContent: { success: true }, isError: false });
        });
        children.push(child);
        return new StdioConnection(child.child, 1000);
    });
    return {
        registered, children, context, api,
        approve(value: boolean) { approved = value; },
        get confirmations() { return confirmationCount; },
        async event(name: string, event: Record<string, unknown> = {}) { return handlers.get(name)?.(event, context); },
        async call(name: string, parameters: Record<string, unknown> = {}, signal?: AbortSignal) {
            const definition = registered.get(name);
            if (!definition) throw new Error(`Tool not registered: ${name}`);
            return definition.execute('call-id', parameters, signal, undefined, context);
        },
    };
}
