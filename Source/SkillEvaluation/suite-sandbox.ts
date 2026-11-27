// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { runProcess } from './suite-process.ts';

const execute = promisify(execFile);
export async function docker(args: string[]): Promise<string> {
    const result = await execute('docker', args, { timeout: 30_000, maxBuffer: 1024 * 1024 });
    return result.stdout.trim();
}

export async function startSandbox(image: string, workspace: string, stage?: string): Promise<string> {
    const name = `cratis-suite-${randomUUID()}`;
    const mounts = ['--mount', `type=bind,src=${workspace},dst=/workspace`];
    if (stage) mounts.push('--mount', `type=bind,src=${stage},dst=${stage},readonly`, '--mount', `type=bind,src=${stage},dst=/corpus,readonly`);
    await docker(['run', '-d', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '3g', '--cpus', '2',
        '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        '--tmpfs', '/tmp:rw,nosuid,nodev,size=1g', '--env', 'HOME=/tmp/home', '--env', 'DOTNET_CLI_HOME=/tmp/home',
        '--env', 'NUGET_PACKAGES=/opt/nuget', '--env', 'DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1',
        '--env', 'DOTNET_CLI_TELEMETRY_OPTOUT=1', '--workdir', '/workspace', ...mounts, image, 'sleep', 'infinity']);
    return name;
}

/** Stop every generation child before scoring; the next start has the same disk but no leftover agent processes. */
export async function resetSandbox(name: string): Promise<void> {
    await docker(['kill', name]);
    await docker(['start', name]);
}

export async function phase(container: string, command: string, kind: 'build' | 'test', directory: string, label: string): Promise<number> {
    const timeout = kind === 'build' ? 300 : 600;
    const result = await runProcess({ command: [join(process.env.HOME!, '.pi/agent/bin/pi-phase'), 'run', '--kind', kind, '--label', label,
        '--queue-timeout', '3600', '--timeout', String(timeout), '--log', join(directory, `${label}.log`), '--',
        'docker', 'exec', '-w', '/workspace', container, 'sh', '-ec', command], cwd: directory, env: process.env,
    log: join(directory, `${label}.phase.log`), timeoutSeconds: 3600 + timeout + 30 });
    return result.exit;
}
