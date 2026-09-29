// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isMap, isScalar, parseDocument } from 'yaml';
import { frontmatterBlock, frontmatterText, quotedScalar } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { globProblem } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { skillTriggerGlobs, skillTriggerKey, splitSkillTriggerGlobs } from '../../.cratis/ai/harnesses/pi/extensions/shared/skillFrontmatter.ts';

/** The top-level `SKILL.md` frontmatter keys the Agent Skills format allows. Anything Cratis-specific belongs under `metadata`. */
export const allowedSkillKeys = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;

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

/** The globs a real YAML parse says `metadata.cratis-hint-paths` holds, in the shape the Pi runtime reads them. */
function yamlGlobs(value: unknown): string[] {
    return typeof value === 'string' ? splitSkillTriggerGlobs(value) : [];
}

/** The problems with the hint value a real YAML parse found under `metadata`: it must be a non-empty string of valid globs. */
function hintValueProblems(subject: string, value: unknown): string[] {
    const globs = yamlGlobs(value);
    if (typeof value !== 'string' || globs.length === 0) {
        return [`${subject} declares 'metadata.${skillTriggerKey}' without any glob; it must be a non-empty string of whitespace-separated globs: ${skillTriggerKey}: "<glob> <glob>".`];
    }
    return globs.flatMap(glob => {
        const problem = globProblem(glob);
        return problem === undefined ? [] : [`${subject} has an invalid 'metadata.${skillTriggerKey}' entry '${glob}': it ${problem}.`];
    });
}

/** What a parsed YAML value is, named for a message. */
function kindOf(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'a list';
    if (typeof value === 'object') return 'a nested map';
    return `a ${typeof value}`;
}

/** The keys under `metadata` that are not YAML strings, such as `1:` or `true:`, which a JS object would silently turn into strings. */
function nonStringMetadataKeys(document: ReturnType<typeof parseDocument>): string[] {
    const metadata = isMap(document.contents) ? document.contents.get('metadata', true) : undefined;
    if (!isMap(metadata)) return [];
    return metadata.items
        .filter(pair => !(isScalar(pair.key) && typeof pair.key.value === 'string'))
        .map(pair => String(isScalar(pair.key) ? pair.key.value : pair.key));
}

/**
 * The problems with the shape of `metadata`: Agent Skills maps strings to strings, so it must be absent or a plain map
 * whose values are all strings. The hint's own value is left to `hintValueProblems`, which explains what it must hold.
 */
function metadataShapeProblems(subject: string, fields: Record<string, unknown>): string[] {
    if (!Object.hasOwn(fields, 'metadata')) return [];
    const metadata = fields.metadata;
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return [`${subject} has 'metadata' that is ${kindOf(metadata)}; it must be a map of strings to strings (Agent Skills metadata maps strings to strings).`];
    }
    return Object.entries(metadata)
        .filter(([key, value]) => key !== skillTriggerKey && typeof value !== 'string')
        .map(([key, value]) => `${subject} declares 'metadata.${key}' as ${kindOf(value)}; metadata.${key} must be a string (Agent Skills metadata maps strings to strings).`);
}

/** A `cratis-hint-paths` key inside a flow map, as opposed to the name appearing in some other text such as a string value. */
const flowMapKey = new RegExp(`[{,]\\s*["']?${skillTriggerKey}["']?\\s*:`);

/**
 * The clear message for the forms the small runtime reader recognizes but does not support (a block scalar, an
 * unquoted or commented value, a wrong indent, a flow map), or an empty list when it recognizes none. This reads the
 * raw lines like the runtime does, so it also works when the frontmatter is not valid YAML at all.
 */
function knownFormProblems(subject: string, content: string): string[] {
    const block = frontmatterBlock(content, 'metadata');
    if (!block) return [];
    const entry = block.entries.get(skillTriggerKey);
    const flowMap = `${subject} declares 'metadata' inline (a flow map), which the path hints do not read; put it on its own lines and ${howToWrite}.`;
    // A flow map that continues on the following lines reads as entries, but is still not the supported block form.
    if (entry && block.inline.startsWith('{')) return [flowMap];
    // An anchor or a tag on the key's line is valid YAML but is not read: the hint below it would be lost.
    if (entry && /^[&!]/.test(block.inline)) return [`${subject} has an anchor or tag after 'metadata:', which the path hints do not read; nothing (no anchor or tag) may follow 'metadata:' on its line, so ${howToWrite}.`];
    if (!entry) return flowMapKey.test(block.inline) ? [flowMap] : [];
    const reason = unsupportedForm(entry.raw, entry.indent, entry.continues);
    return reason ? [`${subject} has an unsupported 'metadata.${skillTriggerKey}' value (${reason}); ${howToWrite}.`] : [];
}

/**
 * Problems with the frontmatter of a skill's `SKILL.md`, checked against a real YAML parser (`yaml`) rather than the
 * small reader the Pi runtime ships, which understands one form only. Verification is where the parser may live: the
 * runtime may use only Node built-ins.
 *
 * - The frontmatter must be valid YAML with no duplicate key at any level, so a second `metadata:` is refused.
 * - The top-level keys, taken from the parse, must be within the Agent Skills set. A top-level `cratis-hint-paths` and
 *   a plain `paths` have their own messages: `paths` is Claude Code's conditional activation and would hide the skill
 *   from it.
 * - `metadata` is optional; when present it must be a map whose values are all strings, as Agent Skills requires.
 * - `metadata.cratis-hint-paths` is optional; when present it must be a non-empty string whose globs are each valid.
 * - Whatever the YAML says, the globs the runtime reader produces must equal the YAML value split on whitespace. Any
 *   difference, including a YAML value the runtime does not read at all, is an error that names the one supported
 *   form. This is the guarantee that a spelling the reader does not know can never silently lose a hint.
 *
 * A skill without frontmatter is reported by the caller, not here.
 */
export function skillFrontmatterProblems(subject: string, content: string): string[] {
    const text = frontmatterText(content);
    if (text === undefined) return [];
    const document = parseDocument(text, { uniqueKeys: true });
    const known = knownFormProblems(subject, content);
    const notYaml = (messages: string[]) => known.length > 0 ? known : messages.map(message => `${subject} has frontmatter that is not valid YAML: ${message.split('\n')[0]}`);
    if (document.errors.length > 0) return notYaml(document.errors.map(error => error.message));
    let data: unknown;
    try {
        data = document.toJS();
    } catch (error) {
        // Some errors, such as an alias with no anchor (an unquoted value that starts with `*`), only surface when the document is read.
        return notYaml([error instanceof Error ? error.message : String(error)]);
    }
    if (data === null || data === undefined) return [];
    if (typeof data !== 'object' || Array.isArray(data)) return [`${subject} has frontmatter that is not a YAML map of keys and values.`];
    const fields = data as Record<string, unknown>;
    const keys = Object.keys(fields);
    const problems = [
        ...keys
            .filter(key => !(allowedSkillKeys as readonly string[]).includes(key) && key !== skillTriggerKey && key !== 'paths')
            .map(key => `${subject} declares top-level frontmatter key '${key}', which Agent Skills does not allow (allowed: ${allowedSkillKeys.join(', ')}); put vendor-specific values under 'metadata'.`),
        ...keys.includes(skillTriggerKey) ? [`${subject} declares '${skillTriggerKey}' as a top-level key, which Agent Skills does not allow; declare it under 'metadata' as a string of whitespace-separated globs.`] : [],
        ...keys.includes('paths') ? [`${subject} declares 'paths', which Claude Code treats as conditional activation; use 'metadata.${skillTriggerKey}' for path hints.`] : [],
        ...metadataShapeProblems(subject, fields),
        ...nonStringMetadataKeys(document).map(key => `${subject} declares the metadata key '${key}', which is not a string; metadata keys must be strings (Agent Skills metadata maps strings to strings), so quote it.`),
        ...known,
    ];
    const metadata = fields.metadata;
    const declared = typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) && Object.hasOwn(metadata, skillTriggerKey);
    const value = declared ? (metadata as Record<string, unknown>)[skillTriggerKey] : undefined;
    if (declared && known.length === 0) problems.push(...hintValueProblems(subject, value));
    const runtime = skillTriggerGlobs(content);
    const expected = yamlGlobs(value);
    if (known.length === 0 && runtime.join('\n') !== expected.join('\n')) {
        problems.push(`${subject} spells 'metadata.${skillTriggerKey}' in a way the Pi runtime reads differently from YAML (runtime: ${JSON.stringify(runtime)}, YAML: ${JSON.stringify(expected)}), so the path hints would be lost or wrong; ${howToWrite}.`);
    }
    return problems;
}
