// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A skill name as the corpus writes it in a rule, prompt or agent: bold or in backticks. */
const nameSource = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const tokenSource = `(?:\\*\\*|\`)(?:${nameSource})(?:\\*\\*|\`)`;
const tokens = (text: string) => [...text.matchAll(new RegExp(tokenSource, 'g'))].map(match => match[0].replace(/^(\*\*|`)|(\*\*|`)$/g, ''));

/** One or more names joined by a comma, a slash or "and", directly followed by the word "skill" or "skills". */
const namedSkills = new RegExp(`((?:${tokenSource}(?:,?\\s+and\\s+|,\\s*|\\s*\\/\\s*))*${tokenSource})\\s+skills?\\b`, 'g');
/** A list line such as `- skills: **a**, **b**.`, where every name is a skill. */
const skillList = /^\s*(?:>\s*)?(?:[-*]\s+)?skills?:\s*(.+)$/gim;
/** A path into the skill directory, such as `.cratis/ai/skills/cratis-arc-command/SKILL.md`. */
const skillPath = /\.cratis\/ai\/skills\/([A-Za-z0-9_-]+)/g;

/**
 * The skill names a rule, prompt or agent points at: a name followed by "skill", a `skills:` list, or a path into
 * `.cratis/ai/skills/`. A bold or backticked word that is not used as a skill (a rule, a reference file, a CSS token) is
 * not a reference.
 */
export function skillReferences(content: string): string[] {
    const names = new Set<string>();
    for (const match of content.matchAll(namedSkills)) tokens(match[1]).forEach(name => names.add(name));
    for (const match of content.matchAll(skillList)) tokens(match[1]).forEach(name => names.add(name));
    for (const match of content.matchAll(skillPath)) names.add(match[1]);
    return [...names];
}

/** One message per reference in `entries` that names a skill with no directory in `skillNames`. */
export function danglingSkillReferences(entries: Array<{ path: string; content: string }>, skillNames: string[]): string[] {
    const known = new Set(skillNames);
    return entries.flatMap(entry => skillReferences(entry.content)
        .filter(name => !known.has(name))
        .map(name => `${entry.path} names skill '${name}', which has no directory in .cratis/ai/skills.`));
}
