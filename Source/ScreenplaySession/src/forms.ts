// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Content, Skill } from './content.ts';

/** The plugin name; Claude Code exposes the skills as `screenplay-session:<skill>`. */
export const pluginName = 'screenplay-session';

const description = 'Screenplay guidance for coding-agent sessions that build slices from a Screenplay model, for any stack.';

/** Adds `levels` heading levels to every Markdown heading outside code fences. */
export function demoteHeadings(markdown: string, levels: number): string {
    let fence: string | undefined;
    return markdown.split('\n').map(line => {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker && (fence === undefined || marker.startsWith(fence))) {
            fence = fence === undefined ? marker : undefined;
            return line;
        }
        return fence === undefined && /^#{1,6} /.test(line) ? `${'#'.repeat(levels)}${line}` : line;
    }).join('\n');
}

function trimmed(text: string): string {
    return `${text.trimEnd()}\n`;
}

function skillList(skills: Skill[], location: (skill: Skill) => string): string {
    return skills.map(skill => `- **${skill.name}** (${location(skill)}): ${skill.description}`).join('\n');
}

/** Appended to Claude Code's system prompt; the skills arrive through the plugin. */
export function systemPrompt(content: Content): string {
    return trimmed(`${content.guide.trimEnd()}

## Skills in this session

These skills are loaded for this session as \`${pluginName}:<skill>\`. Load them before you start building.

${skillList(content.skills, skill => `\`${pluginName}:${skill.name}\``)}`);
}

/** An instruction file for agents that read AGENTS.md and can open files next to it. */
export function agentsMarkdown(content: Content): string {
    return trimmed(`${content.guide.trimEnd()}

## Skills

The skills are files in the folder that holds this file. Paths below are relative to that folder. Read a
skill's \`SKILL.md\` before you use it; it links to the reference files it needs.

${skillList(content.skills, skill => `\`skills/${skill.name}/SKILL.md\``)}`);
}

/** One self-contained document: the guide and every skill with its references, for agents without file access. */
export function sessionContext(content: Content, read: (skill: Skill, file: string) => string): string {
    const sections = [content.guide.trimEnd(), '## Skills\n\nEvery skill follows, with its reference files. A link to a reference file points to the section of that name below.'];
    for (const skill of content.skills) {
        sections.push(`## Skill: ${skill.name}\n\n${skill.description}\n\n${demoteHeadings(skill.body.trimEnd(), 2)}`);
        for (const file of skill.files.filter(name => name !== 'SKILL.md')) {
            const text = read(skill, file).trimEnd();
            const body = file.endsWith('.md') ? demoteHeadings(text, 3) : `\`\`\`${file.endsWith('.play') ? 'screenplay' : 'text'}\n${text}\n\`\`\``;
            sections.push(`### File: ${file} (skill ${skill.name})\n\n${body}`);
        }
    }
    return trimmed(sections.join('\n\n'));
}

export function pluginManifest(version: string): string {
    return `${JSON.stringify({
        name: pluginName,
        description,
        version,
        author: { name: 'Cratis', url: 'https://www.cratis.io' },
        homepage: 'https://github.com/Cratis/AI/blob/main/Documentation/screenplay-session-bundle.md',
        repository: 'https://github.com/Cratis/AI',
        license: 'MIT',
        keywords: ['screenplay', 'event-modeling', 'skills'],
        skills: './skills'
    }, undefined, 2)}\n`;
}
