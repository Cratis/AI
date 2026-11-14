// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFile } from 'node:child_process';
import { SessionRefused } from './Refusals.ts';

export const keychainService = 'direct-pi-link';

export interface CommandResult {
    readonly code: number | undefined;
    readonly stdout: string;
}

/** Runs a command with arguments only: a secret is never passed on argv. */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

/** Reads the personal access token held in the OS keychain for one (origin, tenant) account. */
export interface SecretStore {
    read(account: string): Promise<string>;
}

/** One PAT per Direct origin and tenant; a PAT is never reused across tenants. */
export function secretAccount(origin: string, tenantId: string): string {
    return `${origin}|${tenantId}`;
}

const maximumSecretLength = 512;
const unsafeSecret = /[\s\p{Cc}]/u;

function isBoundedToken(secret: string): boolean {
    const withinBounds = secret.length > 0 && secret.length <= maximumSecretLength;
    return withinBounds && !unsafeSecret.test(secret);
}

/** The client checks only that the token is a bounded single token; the server parser is the authority on its format. */
export function readableSecret(output: string): string {
    const secret = output.replace(/\r?\n$/, '');
    if (!isBoundedToken(secret)) throw new SessionRefused('no-credential');
    return secret;
}

async function lookup(run: CommandRunner, command: string, args: readonly string[]): Promise<string> {
    let result: CommandResult;
    try { result = await run(command, args); } catch { throw new SessionRefused('no-credential'); }
    if (result.code !== 0) throw new SessionRefused('no-credential');
    return readableSecret(result.stdout);
}

class MacOsKeychain implements SecretStore {
    constructor(private readonly run: CommandRunner) {}
    read(account: string): Promise<string> {
        return lookup(this.run, 'security', ['find-generic-password', '-s', keychainService, '-a', account, '-w']);
    }
}

class LinuxSecretTool implements SecretStore {
    constructor(private readonly run: CommandRunner) {}
    read(account: string): Promise<string> {
        return lookup(this.run, 'secret-tool', ['lookup', 'service', keychainService, 'account', account]);
    }
}

/** The OS keychain only: no environment variable and no file fallback. Windows refuses in v1. */
export function createSecretStore(platform: string, run: CommandRunner): SecretStore {
    if (platform === 'darwin') return new MacOsKeychain(run);
    if (platform === 'linux') return new LinuxSecretTool(run);
    throw new SessionRefused('unsupported-platform');
}

/** The command the person runs to store a token; it never contains the secret (the OS tool prompts for it). */
export function storeCommand(platform: string, account: string): string {
    const quoted = `'${account.replace(/'/g, `'\\''`)}'`;
    if (platform === 'darwin') return `security add-generic-password -s ${keychainService} -a ${quoted} -U -w`;
    if (platform === 'linux') return `secret-tool store --label='Cratis Direct' service ${keychainService} account ${quoted}`;
    throw new SessionRefused('unsupported-platform');
}

export const spawnRunner: CommandRunner = (command, args) => new Promise((resolve, reject) => {
    execFile(command, [...args], { encoding: 'utf8', timeout: 10_000 }, (error, stdout) => {
        if (!error) { resolve({ code: 0, stdout }); return; }
        const code = (error as NodeJS.ErrnoException & { code?: number | string }).code;
        if (typeof code === 'number') resolve({ code, stdout: '' });
        else reject(error);
    });
});
