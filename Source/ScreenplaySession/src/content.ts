// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** The authored guidance the bundle is built from. */
export const contentRoot = resolve(import.meta.dirname, '..', 'content');

export interface Skill {
    name: string;
    description: string;
    /** The skill's SKILL.md without its front matter. */
    body: string;
    /** Every file in the skill directory, relative to it, with forward slashes, sorted. */
    files: string[];
}

export interface Content {
    root: string;
    guide: string;
    readme: string;
    skills: Skill[];
}

function absoluteFilesUnder(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return absoluteFilesUnder(path);
        return entry.isFile() ? [path] : [];
    });
}

export function filesUnder(directory: string): string[] {
    return absoluteFilesUnder(directory).map(file => relative(directory, file).split(sep).join('/')).sort();
}

export function frontmatter(source: string): { fields: Record<string, string>; body: string } {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
    if (!match) throw new Error('A skill must start with front matter.');
    const fields: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const field = /^([a-z-]+):\s*(.*)$/.exec(line);
        if (field) fields[field[1]] = field[2].trim();
    }
    return { fields, body: source.slice(match[0].length).replace(/^\n+/, '') };
}

export function readSkill(directory: string): Skill {
    const { fields, body } = frontmatter(readFileSync(join(directory, 'SKILL.md'), 'utf8'));
    if (!fields.name || !fields.description) throw new Error(`${directory}: a skill needs a name and a description.`);
    return { name: fields.name, description: fields.description, body, files: filesUnder(directory) };
}

export function readContent(root: string = contentRoot): Content {
    const skillsDirectory = join(root, 'skills');
    const skills = readdirSync(skillsDirectory)
        .filter(name => statSync(join(skillsDirectory, name)).isDirectory())
        .sort()
        .map(name => {
            const skill = readSkill(join(skillsDirectory, name));
            if (skill.name !== name) throw new Error(`skills/${name}: the skill is named '${skill.name}'; the folder must carry the same name.`);
            return skill;
        });
    return {
        root,
        guide: readFileSync(join(root, 'guide.md'), 'utf8'),
        readme: readFileSync(join(root, 'README.md'), 'utf8'),
        skills
    };
}
