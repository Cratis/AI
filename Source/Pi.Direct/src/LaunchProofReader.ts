// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, unlinkSync, type Stats } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { SessionRefused } from './Refusals.ts';

export const proofLength = 64;
const proofPattern = /^[0-9a-f]{64}$/;
const groupAndOther = 0o077;

export interface FileInfo {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly isSymbolicLink: boolean;
    readonly uid: number;
    readonly mode: number;
    readonly size: number;
}

/** The file operations the reader needs; specs substitute a fake. */
export interface ProofFileSystem {
    /** Describes the entry without following a symbolic link; undefined when it does not exist. */
    lstat(path: string): FileInfo | undefined;
    /** Reads the file without following a symbolic link, at most `limit` bytes. */
    readNoFollow(path: string, limit: number): Buffer;
    remove(path: string): void;
}

export interface ProofReaderEnvironment {
    readonly fileSystem: ProofFileSystem;
    readonly uid: number;
    readonly platform: string;
    readonly cwd: string;
}

function describe(info: Stats): FileInfo {
    return {
        isFile: info.isFile(),
        isDirectory: info.isDirectory(),
        isSymbolicLink: info.isSymbolicLink(),
        uid: info.uid,
        mode: info.mode,
        size: info.size
    };
}

export const nodeProofFileSystem: ProofFileSystem = {
    lstat(path) {
        try { return describe(lstatSync(path)); } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    },
    readNoFollow(path, limit) {
        const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            if (!fstatSync(descriptor).isFile()) throw new SessionRefused('unsafe-proof');
            const buffer = Buffer.alloc(limit);
            const count = readSync(descriptor, buffer, 0, limit, 0);
            return buffer.subarray(0, count);
        } finally {
            closeSync(descriptor);
        }
    },
    remove(path) { unlinkSync(path); }
};

function isInside(path: string, folder: string): boolean {
    const root = resolve(folder);
    return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

function assertSafeLocation(path: string, environment: ProofReaderEnvironment): void {
    if (!isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new SessionRefused('unsafe-proof');
    if (isInside(resolve(path), environment.cwd)) throw new SessionRefused('unsafe-proof');
}

function assertOwnerOnly(info: FileInfo, environment: ProofReaderEnvironment): void {
    if (info.isSymbolicLink || !info.isFile) throw new SessionRefused('unsafe-proof');
    if (info.uid !== environment.uid || (info.mode & groupAndOther) !== 0) throw new SessionRefused('unsafe-proof');
}

function isPrivateFolder(info: FileInfo | undefined, uid: number): boolean {
    if (!info?.isDirectory) return false;
    return info.uid === uid && (info.mode & groupAndOther) === 0;
}

function assertSafeParent(path: string, environment: ProofReaderEnvironment): void {
    if (!isPrivateFolder(environment.fileSystem.lstat(dirname(path)), environment.uid)) throw new SessionRefused('unsafe-proof');
}

function isProofContent(content: Buffer): boolean {
    return content.length === proofLength && proofPattern.test(content.toString('latin1'));
}

function refusalFor(error: unknown): SessionRefused {
    return error instanceof SessionRefused ? error : new SessionRefused('unsafe-proof');
}

function verify(path: string, environment: ProofReaderEnvironment): void {
    const info = environment.fileSystem.lstat(path);
    if (!info) throw new SessionRefused('expired');
    assertOwnerOnly(info, environment);
    assertSafeParent(path, environment);
    if (info.size !== proofLength) throw new SessionRefused('unsafe-proof');
}

function removeQuietly(path: string, environment: ProofReaderEnvironment): void {
    try { environment.fileSystem.remove(path); } catch { /* the daemon deletes the file as well */ }
}

/**
 * Reads the launch proof exactly once and deletes the file. Every unsafe case refuses without a retry and without
 * echoing any content or path; the caller owns the returned buffer and must zero it after the claim.
 */
export function readLaunchProof(path: string, environment: ProofReaderEnvironment): Buffer {
    if (environment.platform === 'win32') throw new SessionRefused('unsupported-platform');
    assertSafeLocation(path, environment);
    let content: Buffer | undefined;
    try {
        verify(path, environment);
        content = environment.fileSystem.readNoFollow(path, proofLength + 1);
        if (!isProofContent(content)) throw new SessionRefused('unsafe-proof');
        removeQuietly(path, environment);
        return content;
    } catch (error) {
        content?.fill(0);
        const refusal = refusalFor(error);
        if (refusal.code !== 'expired') removeQuietly(path, environment);
        throw refusal;
    }
}
