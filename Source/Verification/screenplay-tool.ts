// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinnedVersion } from './play/fences.ts';

/** The command that installs the pinned tool; named in every mismatch and offline error. */
export const fixCommand = 'yarn workspace @cratis/ai-verification run tool:screenplay';

/** The cached, Git-ignored install directory for one pinned version. */
export function toolDirectory(repositoryRoot: string, version: string): string {
    return join(repositoryRoot, '.cache', 'screenplay-tool', version);
}

export function toolPath(repositoryRoot: string, version: string, platform: NodeJS.Platform = process.platform): string {
    return join(toolDirectory(repositoryRoot, version), platform === 'win32' ? 'screenplay.exe' : 'screenplay');
}

export interface ToolEnvironment {
    exists(path: string): boolean;
    /** Returns the tool's `--version` output, or undefined when it cannot run. */
    versionOf(path: string): string | undefined;
    remove(directory: string): void;
    /** Throws when the install fails (for example offline). */
    install(version: string, directory: string): void;
}

export function matchesPin(output: string | undefined, version: string): boolean {
    return output !== undefined && output.trim().replace(/\+.*$/, '') === version;
}

/** Returns the path of a pinned tool, installing it into the cache when it is missing or wrong. */
export function ensureTool(repositoryRoot: string, version: string, environment: ToolEnvironment, platform: NodeJS.Platform = process.platform): string {
    const path = toolPath(repositoryRoot, version, platform);
    const directory = toolDirectory(repositoryRoot, version);
    if (environment.exists(path) && matchesPin(environment.versionOf(path), version)) return path;
    if (environment.exists(directory)) environment.remove(directory);
    try {
        environment.install(version, directory);
    } catch (error) {
        throw new Error(`Cannot install Cratis.Screenplay.Tool ${version} into ${directory} (offline, or dotnet is unavailable): ${error instanceof Error ? error.message : String(error)}. Fix: run \`${fixCommand}\` with network access.`);
    }
    if (!matchesPin(environment.versionOf(path), version)) throw new Error(`Installed Screenplay tool at ${path} does not report ${version}. Fix: delete ${directory} and run \`${fixCommand}\`.`);
    return path;
}

export const systemEnvironment: ToolEnvironment = {
    exists: existsSync,
    versionOf: path => {
        try { return execFileSync(path, ['--version'], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return undefined; }
    },
    remove: directory => rmSync(directory, { recursive: true, force: true }),
    install: (version, directory) => { execFileSync('dotnet', ['tool', 'install', 'Cratis.Screenplay.Tool', '--version', version, '--tool-path', directory], { stdio: ['ignore', process.stderr, process.stderr] }); }
};

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Resolves the pinned tool for the corpus at `root`; the cache always lives in this repository. */
export function resolvePinnedTool(root: string = repositoryRoot): string {
    const version = pinnedVersion(readFileSync(join(root, 'Documentation/compatibility.md'), 'utf8'));
    return ensureTool(repositoryRoot, version, systemEnvironment);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        console.log(resolvePinnedTool());
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
