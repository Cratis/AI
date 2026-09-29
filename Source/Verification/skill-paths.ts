// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { frontmatter, frontmatterBlock, quotedScalar } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillTriggerKey, splitSkillTriggerGlobs } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillFrontmatter.ts';

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

const howToWrite = `write it as one double-quoted string on a single line, indented two spaces under 'metadata:', with no comment after it: ${skillTriggerKey}: "<glob> <glob>"`;

/** Why a raw `metadata.cratis-hint-paths` value is not the one supported form, or `undefined` when it is that form. */
function unsupportedForm(raw: string, indent: number, continues: boolean): string | undefined {
    if (indent !== 2) return 'its key is not indented exactly two spaces';
    if (/^[|>][-+\d]*\s*(#.*)?$/.test(raw)) return 'a block scalar (|, > or a variant) is not supported';
    if (continues) return raw === '' ? 'the value is on the following lines' : 'the value is spread over several lines';
    if (raw === '') return 'there is no value';
    const quote = raw[0];
    if (quote !== '"' && quote !== "'") return 'the value is not quoted (a leading * or { is YAML syntax, not a glob)';
    const close = raw.indexOf(quote, 1);
    if (close < 0) return 'the closing quote is missing from the line, so the value spans several lines';
    const rest = raw.slice(close + 1).trim();
    if (rest.startsWith('#')) return 'a comment follows the closing quote';
    if (rest !== '') return 'text follows the closing quote';
    if (quotedScalar(raw) === undefined) return quote === '"' ? 'the string contains a backslash' : "the string contains an escaped quote ('')";
    return undefined;
}

/**
 * Problems with a skill's optional `metadata.cratis-hint-paths` trigger, which `cratis-path-guidance` matches against
 * written files. Exactly one form is supported, and every other one is reported rather than guessed at: a
 * double-quoted (or single-quoted) string of whitespace-separated globs on one line, indented two spaces under
 * `metadata:`, with no trailing comment. A skill without the key is fine; one that declares it needs a non-empty
 * string whose globs are each valid. A top-level `cratis-hint-paths` is rejected because Agent Skills allows only a
 * fixed set of top-level keys, and so is a plain `paths` key: Claude Code reads it as conditional activation, which
 * would hide the skill from it.
 */
export function skillPathProblems(subject: string, content: string): string[] {
    const fields = frontmatter(content);
    const misplaced = [
        ...fields.has(skillTriggerKey) ? [`${subject} declares '${skillTriggerKey}' as a top-level key, which Agent Skills does not allow; declare it under 'metadata' as a string of whitespace-separated globs.`] : [],
        ...fields.has('paths') ? [`${subject} declares 'paths', which Claude Code treats as conditional activation; use 'metadata.${skillTriggerKey}' for path hints.`] : [],
    ];
    const block = frontmatterBlock(content, 'metadata');
    if (!block) return misplaced;
    const entry = block.entries.get(skillTriggerKey);
    if (!entry) {
        return block.inline.includes(skillTriggerKey)
            ? [...misplaced, `${subject} declares 'metadata' inline (a flow map), which the path hints do not read; put it on its own lines and ${howToWrite}.`]
            : misplaced;
    }
    const reason = unsupportedForm(entry.raw, entry.indent, entry.continues);
    if (reason) return [...misplaced, `${subject} has an unsupported 'metadata.${skillTriggerKey}' value (${reason}); ${howToWrite}.`];
    const globs = splitSkillTriggerGlobs(quotedScalar(entry.raw)!);
    if (globs.length === 0) return [...misplaced, `${subject} declares 'metadata.${skillTriggerKey}' without any glob; it must be a non-empty string of whitespace-separated globs: ${skillTriggerKey}: "<glob> <glob>".`];
    return [...misplaced, ...globs.flatMap(glob => {
        const problem = globProblem(glob);
        return problem === undefined ? [] : [`${subject} has an invalid 'metadata.${skillTriggerKey}' entry '${glob}': it ${problem}.`];
    })];
}
