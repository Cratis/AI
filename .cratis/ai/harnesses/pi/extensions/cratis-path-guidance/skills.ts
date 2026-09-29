// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { corpusRoot } from '../shared/corpusRoot.ts';
import { frontmatter } from '../shared/frontmatter.ts';
import { globToRegExp } from '../shared/globs.ts';
import type { LoadedSkill } from './LoadedSkill.ts';
import type { SkillMatch } from './SkillMatch.ts';
import type { SkillTrigger } from './SkillTrigger.ts';

/** The skills the repository makes available when Pi did not report the loaded ones: `.cratis/ai/skills`, else the corpus. */
function repositorySkills(cwd: string): LoadedSkill[] {
    const managedRoot = join(cwd, '.cratis', 'ai', 'skills');
    const root = existsSync(managedRoot) ? managedRoot : join(corpusRoot, 'skills');
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, 'SKILL.md')))
        .map(entry => ({ name: entry.name, filePath: join(root, entry.name, 'SKILL.md'), baseDir: join(root, entry.name) }));
}

function triggerGlobs(filePath: string): string[] {
    try {
        return frontmatter(readFileSync(filePath, 'utf8')).get('paths') ?? [];
    } catch {
        return [];
    }
}

/**
 * The skills available to a session with their trigger globs. `loaded` are the skills Pi loaded for the
 * session (`systemPromptOptions.skills`). When Pi reported none, either because the host has not said or because
 * skills are switched off (a pi-subagents agent with `skills: false`, the usual setup for cheap workers), the
 * repository's own skills stand in: their `SKILL.md` can still be read by path, which is what the hint asks for.
 * Skills without a `paths` trigger are left out.
 */
export function skillTriggers(loaded: LoadedSkill[] | undefined, cwd: string): SkillTrigger[] {
    return (loaded !== undefined && loaded.length > 0 ? loaded : repositorySkills(cwd))
        .map(skill => ({
            name: skill.name,
            filePath: skill.filePath,
            baseDir: skill.baseDir ?? dirname(skill.filePath),
            globs: triggerGlobs(skill.filePath),
        }))
        .filter(skill => skill.globs.length > 0);
}

/** The skills whose trigger matches a repository-relative path, each with the first glob that matched. */
export function skillsForPath(triggers: SkillTrigger[], relativePath: string): SkillMatch[] {
    return triggers.flatMap(skill => {
        const glob = skill.globs.find(candidate => globToRegExp(candidate).test(relativePath));
        return glob === undefined ? [] : [{ skill, glob }];
    });
}
