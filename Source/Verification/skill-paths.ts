// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';

/**
 * Problems with a skill's optional `paths` trigger list, which `cratis-path-guidance` matches against written files.
 * A skill without `paths` is fine; one that declares it needs at least one entry, each a non-empty valid glob.
 */
export function skillPathProblems(subject: string, content: string): string[] {
    const globs = frontmatter(content).get('paths');
    if (globs === undefined) return [];
    if (globs.length === 0) return [`${subject} declares 'paths' without any glob.`];
    return globs.flatMap(glob => {
        const problem = globProblem(glob);
        return problem === undefined ? [] : [`${subject} has an invalid 'paths' entry '${glob}': it ${problem}.`];
    });
}
