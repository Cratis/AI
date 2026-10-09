// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { openSync, closeSync, writeSync } from 'node:fs';
import type { Harness } from './Harness.ts';
import { Transcript } from './signals.ts';
import { onInterrupt } from './cancellation.ts';
import type { SkillExpectation } from './SkillExpectation.ts';

/** Wall-clock timer fires even when the harness never writes a line. Kill the owned process group. */
export async function execute(command: string[], harness: Harness, cwd: string, environment: NodeJS.ProcessEnv,
    transcriptPath: string, timeoutSeconds: number, toolCap?: number, expectation?: SkillExpectation): Promise<{
        transcript: Transcript; durationSeconds: number; stopped?: 'skill-loaded' | 'tool-cap';
    }> {
    const started = performance.now();
    const transcript = new Transcript(harness, expectation);
    const file = openSync(transcriptPath, 'w');
    const child = spawn(command[0], command.slice(1), { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stopped: 'skill-loaded' | 'tool-cap' | undefined;
    let failure: string | undefined;
    let pending = '';
    let diagnostics = '';
    let escalation: NodeJS.Timeout | undefined;
    const kill = (signal: NodeJS.Signals) => {
        if (!child.pid) return;
        try {
            if (process.platform === 'win32') child.kill(signal);
            else process.kill(-child.pid, signal);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure ??= String(error);
        }
    };
    const stop = () => {
        kill('SIGTERM');
        escalation ??= setTimeout(() => kill('SIGKILL'), 1500);
    };
    const removeInterrupt = onInterrupt(() => { failure = 'Interrupted; unfinished runs can be resumed.'; stop(); });
    const timer = setTimeout(() => { failure = `Timed out after ${timeoutSeconds}s`; stop(); }, timeoutSeconds * 1000);
    const consume = (line: string) => {
        transcript.consume(line);
        if (transcript.error) { stop(); return; }
        if (toolCap && !stopped) {
            if (transcript.skillsRead.size) stopped = 'skill-loaded';
            else if (transcript.seenCalls.size >= toolCap) stopped = 'tool-cap';
            if (stopped) stop();
        }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
        writeSync(file, chunk);
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop()!;
        for (const line of lines) consume(line);
    });
    child.stderr.on('data', (chunk: string) => { writeSync(file, chunk); diagnostics = (diagnostics + chunk).slice(-4000); });
    try {
        const exit = await new Promise<number | null>((resolve, reject) => {
            child.on('error', reject);
            child.on('close', resolve);
        });
        if (pending.trim()) consume(pending);
        transcript.validateInitialization();
        failure ??= transcript.error;
        if (failure) throw new Error(`${command[0]}: ${failure}. Transcript: ${transcriptPath}`);
        if (!stopped && (exit !== 0 || !transcript.completed)) {
            throw new Error(`${command[0]} could not complete (exit ${exit}). Check the binary and login/usage limits. ${diagnostics.trim()} Transcript: ${transcriptPath}`);
        }
        return { transcript, durationSeconds: (performance.now() - started) / 1000, stopped };
    } catch (error) {
        throw new Error(`${command[0]} could not run: ${String(error)}. Ensure it is installed and logged in.`);
    } finally {
        clearTimeout(timer);
        if (escalation) clearTimeout(escalation);
        kill('SIGKILL');
        closeSync(file);
        removeInterrupt();
    }
}
