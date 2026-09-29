// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createServer, type IncomingHttpHeaders, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI, Skill } from '@earendil-works/pi-coding-agent';
import { registerSystemOne } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/index.ts';
import type { SystemOneDependencies } from '../../.cratis/ai/harnesses/pi/extensions/cratis-system-one/SystemOneDependencies.ts';

export interface RecordedRequest {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    body: { state: { prompt: string }; model: string; questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }> };
}

type Behavior = (request: RecordedRequest, response: ServerResponse) => void;

/** A System One server on 127.0.0.1 with an ephemeral port. Nothing here leaves the machine. */
export async function fakeServer(behavior: Behavior = answering(0.5)) {
    const requests: RecordedRequest[] = [];
    const server = createServer((incoming, response) => {
        const chunks: Buffer[] = [];
        incoming.on('data', chunk => chunks.push(chunk));
        incoming.on('end', () => {
            const request: RecordedRequest = { method: incoming.method, url: incoming.url, headers: incoming.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') };
            requests.push(request);
            behavior(request, response);
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return {
        endpoint,
        requests,
        async close() {
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        },
    };
}

export function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    response.writeHead(status, { 'content-type': 'application/json', ...headers });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

export function answerBody(request: RecordedRequest, probability: number | ((id: string) => number)): unknown {
    return {
        model: 'fake-1',
        answers: Object.fromEntries(Object.keys(request.body.questions).map(id => [id, { type: 'noul', noul: typeof probability === 'function' ? probability(id) : probability }])),
        usage: { input_tokens: 1, output_tokens: 1 },
    };
}

export function answering(probability: number | ((id: string) => number)): Behavior {
    return (request, response) => json(response, 200, answerBody(request, probability));
}

export interface SkillFixture {
    name: string;
    description?: string;
    disableModelInvocation?: boolean;
    /** Where the SKILL.md lives, relative to the project. Defaults to the managed corpus. */
    directory?: string;
}

export function skillsIn(project: string, fixtures: SkillFixture[]): Skill[] {
    return fixtures.map(fixture => {
        const baseDir = join(project, fixture.directory ?? join('.cratis', 'ai', 'skills'), fixture.name);
        mkdirSync(baseDir, { recursive: true });
        const description = fixture.description ?? `Guidance for ${fixture.name}. Use it when relevant.`;
        const filePath = join(baseDir, 'SKILL.md');
        writeFileSync(filePath, `---\nname: ${fixture.name}\ndescription: ${description}\n---\n\n# ${fixture.name}\n`);
        return { name: fixture.name, description, filePath, baseDir, sourceInfo: {} as Skill['sourceInfo'], disableModelInvocation: fixture.disableModelInvocation ?? false };
    });
}

export function projectFixture(configuration?: unknown) {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-system-one-')));
    const configure = (value: unknown) => {
        mkdirSync(join(directory, '.cratis'), { recursive: true });
        writeFileSync(join(directory, '.cratis', 'ai.json'), typeof value === 'string' ? value : JSON.stringify(value));
    };
    if (configuration !== undefined) configure(configuration);
    return { directory, configure, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

export const promptText = 'Please add a command that opens an account and validate the owner name.';

export type Handler = (event: unknown, context: unknown) => unknown;

/** A host that records what the extension registers, notifies and appends, and how it misuses the API. */
export function host(directory: string, dependencies: SystemOneDependencies = {}) {
    const handlers = new Map<string, Handler>();
    const commands = new Map<string, (argumentsText: string, context: unknown) => Promise<void>>();
    const entries: Array<{ type: string; data: Record<string, unknown> }> = [];
    const notices: string[] = [];
    const misuse: string[] = [];
    const known = {
        on: (name: string, handler: Handler) => { handlers.set(name, handler); },
        registerCommand: (name: string, options: { handler: (argumentsText: string, context: unknown) => Promise<void> }) => { commands.set(name, options.handler); },
        appendEntry: (type: string, data: Record<string, unknown>) => { entries.push({ type, data }); },
    } as Record<string, unknown>;
    // Anything else on the API (sending messages, registering tools, changing tools) is misuse in shadow mode.
    const api = new Proxy(known, { get: (target, property) => property in target ? target[property as string] : () => { misuse.push(String(property)); } }) as unknown as ExtensionAPI;
    registerSystemOne(api, dependencies);
    const context = { cwd: directory, hasUI: true, ui: { notify: (message: string) => { notices.push(message); } } };
    const invoke = (name: string, event: unknown) => handlers.get(name)!(event, context);
    return {
        entries, notices, misuse, commands, handlers,
        sessionStart: () => invoke('session_start', { type: 'session_start', reason: 'startup' }),
        input: (text: string) => invoke('input', { type: 'input', text, source: 'interactive' }),
        async ask(prompt: string, skills: Skill[], systemPrompt = 'base system prompt') {
            const event = { type: 'before_agent_start', prompt, systemPrompt, systemPromptOptions: { cwd: directory, skills } };
            const before = JSON.stringify(event);
            const result = await invoke('before_agent_start', event);
            return { result, unchanged: JSON.stringify(event) === before };
        },
        read: (path: string, isError = false) => invoke('tool_result', { type: 'tool_result', toolName: 'read', toolCallId: 'call', input: { path }, content: [], isError, details: undefined }),
        end: () => invoke('agent_end', { type: 'agent_end', messages: [] }),
        async command(argumentsText = '') {
            const before = notices.length;
            await commands.get('system-one')!(argumentsText, context);
            return notices.slice(before).join('\n');
        },
    };
}

/** A project that has opted in and points at the given fake server. */
export function enabledProject(endpoint: string, extra: Record<string, unknown> = {}) {
    return projectFixture({ profiles: ['cratis/documentation'], systemOne: { enabled: true, endpoint, ...extra } });
}
