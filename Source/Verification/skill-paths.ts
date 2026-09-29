// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillTriggerKey } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillFrontmatter.ts';

/**
 * Problems with a skill's optional `cratis-hint-paths` trigger list, which `cratis-path-guidance` matches against written files.
 * A skill without it is fine; one that declares it needs at least one entry, each a non-empty valid glob. A plain
 * `paths` key is rejected: Claude Code reads it as conditional activation, which would hide the skill from it.
 */
export function skillPathProblems(subject: string, content: string): string[] {
    const fields = frontmatter(content);
    const claudePaths = fields.has('paths')
        ? [`${subject} declares 'paths', which Claude Code treats as conditional activation; use '${skillTriggerKey}' for path hints.`]
        : [];
    const globs = fields.get(skillTriggerKey);
    if (globs === undefined) return claudePaths;
    if (globs.length === 0) return [...claudePaths, `${subject} declares '${skillTriggerKey}' without any glob.`];
    return [...claudePaths, ...globs.flatMap(glob => {
        const problem = globProblem(glob);
        return problem === undefined ? [] : [`${subject} has an invalid '${skillTriggerKey}' entry '${glob}': it ${problem}.`];
    })];
}
