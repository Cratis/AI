// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillTriggerKey, skillTriggerValue, splitSkillTriggerGlobs } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillFrontmatter.ts';

/** The top-level `SKILL.md` frontmatter keys the Agent Skills format allows. Anything Cratis-specific belongs under `metadata`. */
export const allowedSkillKeys = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;

/**
 * Top-level `SKILL.md` frontmatter keys outside the Agent Skills set. A top-level `cratis-hint-paths` and a plain
 * `paths` have their own messages in `skillPathProblems`, so they are not reported a second time here.
 */
export function skillKeyProblems(subject: string, content: string): string[] {
    return [...frontmatter(content).keys()]
        .filter(key => !(allowedSkillKeys as readonly string[]).includes(key) && key !== skillTriggerKey && key !== 'paths')
        .map(key => `${subject} declares top-level frontmatter key '${key}', which Agent Skills does not allow (allowed: ${allowedSkillKeys.join(', ')}); put vendor-specific values under 'metadata'.`);
}

/**
 * Problems with a skill's optional `metadata.cratis-hint-paths` trigger, which `cratis-path-guidance` matches against
 * written files. The value is one string of whitespace-separated globs. A skill without it is fine; one that declares
 * it needs a non-empty string whose globs are each valid. A top-level `cratis-hint-paths` is rejected because Agent
 * Skills allows only a fixed set of top-level keys, and so is a plain `paths` key: Claude Code reads it as conditional
 * activation, which would hide the skill from it.
 */
export function skillPathProblems(subject: string, content: string): string[] {
    const fields = frontmatter(content);
    const misplaced = [
        ...fields.has(skillTriggerKey) ? [`${subject} declares '${skillTriggerKey}' as a top-level key, which Agent Skills does not allow; declare it under 'metadata' as a string of whitespace-separated globs.`] : [],
        ...fields.has('paths') ? [`${subject} declares 'paths', which Claude Code treats as conditional activation; use 'metadata.${skillTriggerKey}' for path hints.`] : [],
    ];
    const value = skillTriggerValue(content);
    if (value === undefined) return misplaced;
    const globs = splitSkillTriggerGlobs(value);
    if (globs.length === 0) return [...misplaced, `${subject} declares 'metadata.${skillTriggerKey}' without any glob; it must be a non-empty string of whitespace-separated globs.`];
    return [...misplaced, ...globs.flatMap(glob => {
        const problem = globProblem(glob);
        return problem === undefined ? [] : [`${subject} has an invalid 'metadata.${skillTriggerKey}' entry '${glob}': it ${problem}.`];
    })];
}
