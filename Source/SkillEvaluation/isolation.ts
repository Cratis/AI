// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { access, chmod, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Harness } from './Harness.ts';
import { corpusDigest } from './tasks.ts';
import { workspace } from './workspace.ts';

/** Neither harness is shown a path into the repository. Dereference copied links, never retain them. */
export async function isolateBatch(source: string, harness: Harness, environment = process.env): Promise<{
    skillsDirectory: string; corpusSkills: string[]; digest: string; agentDirectory?: string;
    withWorkspace: string; withoutWorkspace: string; remove: () => Promise<void>;
}> {
    const path = await mkdtemp(join(tmpdir(), 'cratis-skill-eval-'));
    try {
        await chmod(path, 0o700);
        const withWorkspace = (await workspace(source, path)).path;
        const withoutWorkspace = (await workspace(undefined, path)).path;
        const skillsDirectory = join(withWorkspace, '.claude/skills');
        const corpusSkills = (await readdir(skillsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
        if (!corpusSkills.length) throw new Error('Isolated corpus contains no skills.');
        let agentDirectory: string | undefined;
        if (harness === Harness.Pi) {
            agentDirectory = join(path, 'agent');
            await mkdir(agentDirectory, { mode: 0o700 });
            const authentication = resolve(environment.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'auth.json');
            try {
                // Link, never copy: pi rotates OAuth refresh tokens and writes them back to auth.json. A copy would
                // be deleted with the batch and take the only valid refresh token with it. pi writes through the link;
                // its lock is keyed on the unresolved path, so a host session refreshing at the same instant is not
                // serialized with these runs.
                await access(authentication);
                await symlink(authentication, join(agentDirectory, 'auth.json'));
            } catch (error) {
                // Environment API keys also work, so a missing auth file is not itself a login failure.
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }
        return { skillsDirectory, corpusSkills, digest: await corpusDigest(skillsDirectory), agentDirectory,
            withWorkspace, withoutWorkspace, remove: () => rm(path, { recursive: true }) };
    } catch (error) {
        await rm(path, { recursive: true });
        throw error;
    }
}
