// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.


// Shared helpers for the pi-quality-gate specs, which are split across files so node:test runs them in separate processes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks, { QUALITY_GATE_TOOL_NAME } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import { gateTimeoutSeconds, isNotRepositoryError, latestGateLog, parseGatePlan, runBounded, tailLines, workingTreeFingerprint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/quality-gate.ts';

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
export type GateTool = {
    name: string;
    description: string;
    executionMode?: string;
    execute: (id: string, params: { timeoutSeconds?: number }, signal: AbortSignal | undefined, onUpdate: ((update: unknown) => void) | undefined, ctx: unknown) => Promise<{ content: Array<{ text: string }>; details?: { status?: string } }>;
};

export function bridge() {
    const handlers = new Map<string, Handler>();
    const tools: GateTool[] = [];
    const sent: unknown[] = [];
    registerCratisHooks({
        on: (event: string, handler: Handler) => handlers.set(event, handler),
        registerTool: (tool: GateTool) => tools.push(tool),
        sendMessage: (message: unknown) => sent.push(message),
        sendUserMessage: (message: unknown) => sent.push(message),
    } as unknown as ExtensionAPI);
    const tool = tools.find(candidate => candidate.name === QUALITY_GATE_TOOL_NAME);
    assert.ok(tool, 'the bridge registers the quality gate tool');
    return { handlers, tool, sent };
}

/** A committed scratch repository and a gate configuration whose one gate runs `command` for any changed .txt file. */
export function scratch(command: string[], deadline: { timeoutSeconds?: number; timeoutHint?: string } = {}) {
    const workDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.ai-work');
    mkdirSync(workDirectory, { recursive: true });
    const root = mkdtempSync(join(workDirectory, 'cratis-gate-'));
    const git = (...args: string[]) => spawnSync('git', ['-C', root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
    git('init', '-q');
    writeFileSync(join(root, 'README.md'), '# scratch\n');
    git('add', '.');
    git('commit', '-q', '-m', 'initial');
    const gates = join(root, '..', `${root.split('/').pop()}-gates.json`);
    writeFileSync(gates, JSON.stringify({
        enabled: true,
        failFast: true,
        maxOutputLines: 20,
        gates: [{ id: 'scratch-gate', description: 'scratch gate', changed: ['*.txt', '**/*.txt'], workingDirectory: '.', command, ...deadline }],
    }));
    const saved = {
        gates: process.env.CRATIS_HOOKS_GATES,
        skip: process.env.CRATIS_HOOKS_SKIP_GATE,
        timeout: process.env.CRATIS_HOOKS_GATE_TIMEOUT_SECONDS,
        project: process.env.CLAUDE_PROJECT_DIR,
        dryRun: process.env.CRATIS_HOOKS_GATE_DRYRUN,
    };
    process.env.CRATIS_HOOKS_GATES = gates;
    // The gate script locates the repository from CLAUDE_PROJECT_DIR, else from its own location.
    process.env.CLAUDE_PROJECT_DIR = root;
    delete process.env.CRATIS_HOOKS_SKIP_GATE;
    delete process.env.CRATIS_HOOKS_GATE_TIMEOUT_SECONDS;
    delete process.env.CRATIS_HOOKS_GATE_DRYRUN;
    const session = `spec-${Math.random().toString(36).slice(2)}`;
    const ctx = (mode = 'tui', signal?: AbortSignal) => ({ cwd: root, mode, signal, sessionManager: { getSessionId: () => session } });
    return {
        root,
        ctx,
        change: (name = 'change.txt', content = `${Date.now()}\n`) => writeFileSync(join(root, name), content),
        dispose: () => {
            for (const [key, value] of [['CRATIS_HOOKS_GATES', saved.gates], ['CRATIS_HOOKS_SKIP_GATE', saved.skip], ['CRATIS_HOOKS_GATE_TIMEOUT_SECONDS', saved.timeout], ['CLAUDE_PROJECT_DIR', saved.project], ['CRATIS_HOOKS_GATE_DRYRUN', saved.dryRun]] as const) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            rmSync(root, { recursive: true, force: true });
            rmSync(gates, { force: true });
        },
    };
}
