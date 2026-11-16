// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { lstatSync, readlinkSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** A setup destination whose ownership and parents must be checked without following symlinks. */
export class SetupPath {
    constructor(readonly path: string) {}

    state(): ReturnType<typeof lstatSync> | undefined {
        try {
            return lstatSync(this.path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    }

    isRealDirectory(): boolean {
        const current = this.state();
        if (!current?.isDirectory()) return false;
        return !current.isSymbolicLink();
    }

    directoryConflict(): boolean {
        const current = this.state();
        if (!current) return false;
        return !current.isDirectory() || current.isSymbolicLink();
    }

    requireRealParents(boundary: SetupPath, root: SetupPath): void {
        for (let parent = dirname(this.path); parent !== boundary.path; parent = dirname(parent)) {
            if (new SetupPath(parent).directoryConflict()) {
                throw new Error(`Harness setup is out of date:\n${parent.slice(root.path.length + 1)}: expected directory, not an occupied parent path`);
            }
        }
    }

    ownedLink(corpus: SetupPath): boolean {
        if (!this.state()?.isSymbolicLink()) return false;
        const target = resolve(dirname(this.path), readlinkSync(this.path));
        return target.startsWith(`${corpus.path}/`);
    }

    remove(force: boolean): void {
        if (!this.state()) return;
        if (force) rmSync(this.path, { recursive: true, force: true });
        else unlinkSync(this.path);
    }
}
