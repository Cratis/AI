// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { openSync, writeSync, closeSync } from 'node:fs';
import { onInterrupt } from './cancellation.ts';
import { parseLine } from './signals.ts';
import type { SuiteTranscript } from './suite-transcript.ts';

interface ProcessOptions {
    command: string[]; cwd: string; env: NodeJS.ProcessEnv; log: string; timeoutSeconds: number; transcript?: SuiteTranscript;
}

function killGroup(pid: number | undefined, signal: NodeJS.Signals): string | undefined {
    if (!pid) return;
    try { process.kill(-pid, signal); } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code !== 'ESRCH') return String(failure);
    }
}

/** Retains the raw stream and partial telemetry even on timeout, nonzero exit or interruption. */
export async function runProcess(options: ProcessOptions): Promise<{ exit: number; error?: string }> {
    const { command, cwd, env, log, timeoutSeconds, transcript } = options;
    const file = openSync(log, 'w');
    let pending = '';
    let error: string | undefined;
    const child = spawn(command[0], command.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const kill = (signal: NodeJS.Signals) => { error ??= killGroup(child.pid, signal); };
    let escalation: NodeJS.Timeout | undefined;
    const stop = (reason: string) => { error ??= reason; kill('SIGTERM'); escalation ??= setTimeout(() => kill('SIGKILL'), 1500); };
    const remove = onInterrupt(() => stop('Interrupted'));
    const timeout = setTimeout(() => stop(`Timed out after ${timeoutSeconds}s`), timeoutSeconds * 1000);
    const consume = (line: string) => {
        if (!transcript) return;
        transcript.consume(parseLine(line));
        if (transcript.error) stop(transcript.error);
        if (transcript.toolCalls > 120 || transcript.turns > 80) stop('Trajectory tool/turn limit exceeded');
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
        writeSync(file, chunk);
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop()!;
        lines.forEach(consume);
    });
    child.stderr.on('data', (chunk: Buffer) => writeSync(file, chunk));
    try {
        const exit = await new Promise<number>(resolve => {
            child.on('error', failure => { error ??= String(failure); resolve(127); });
            child.on('close', code => resolve(code ?? 128));
        });
        if (pending) consume(pending);
        return { exit, error };
    } finally {
        clearTimeout(timeout);
        if (escalation) clearTimeout(escalation);
        kill('SIGKILL');
        remove();
        closeSync(file);
    }
}
