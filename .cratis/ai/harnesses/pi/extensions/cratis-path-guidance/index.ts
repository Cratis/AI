// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ManagedRule } from '../shared/ManagedRule.ts';
import { rulesForPath } from '../shared/rules.ts';
import type { LoadedSkill } from './LoadedSkill.ts';
import type { SkillMatch } from './SkillMatch.ts';
import type { SkillTrigger } from './SkillTrigger.ts';
import { skillsRead } from './skillReads.ts';
import { skillsForPath, skillTriggers } from './skills.ts';
import { standsDown } from './standDown.ts';
import { ToolName } from './ToolName.ts';
import { touchedPaths } from './touchedPaths.ts';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const isPackagedExtension = extensionDirectory.includes(`${sep}package${sep}corpus${sep}`);

function repositoryRelative(cwd: string, path: string): string | undefined {
    const relativePath = relative(cwd, resolve(cwd, path));
    return !relativePath || relativePath.startsWith('..') || isAbsolute(relativePath) ? undefined : relativePath.split(sep).join('/');
}

function displayPath(cwd: string, path: string): string {
    return repositoryRelative(cwd, path) ?? path;
}

function hintLine(cwd: string, file: string, match: SkillMatch): string {
    return `[cratis-path-guidance] Skill \`${match.skill.name}\` covers ${file} (matched \`${match.glob}\`); read ${displayPath(cwd, match.skill.filePath)} before continuing.`;
}

/**
 * Delivers the corpus guidance that belongs to a file at the moment the file is touched, so it works in every
 * Pi process, including a subagent, without the universal rules `cratis-rules` puts in every system prompt.
 *
 * Path-scoped rules are attached to the tool result the first time a matching file is touched in the session,
 * exactly as they were when `cratis-rules` delivered them. On a successful `write` or `edit`, one advisory line
 * per skill whose `paths` frontmatter matches the file names that skill and where its `SKILL.md` is. Hints are
 * advisory only: nothing is blocked and the system prompt is never touched.
 *
 * Delivery happens on `tool_result`, so guidance arrives after the call that first touched the file.
 * `ToolCallEventResult` carries only `block`/`reason`/`terminate`, so there is no supported way to add
 * context before a tool runs. In practice a file is read before it is edited, and reads through both the read
 * tool and bash are covered; a file created blind by `write` is the residual case, and it receives the
 * guidance with that result.
 *
 * Delivered guidance lives in the conversation rather than the system prompt, so anything that rewrites or
 * replaces the conversation can remove it. The delivery record is therefore reset whenever that happens, and the
 * guidance is delivered again the next time one of its files is touched.
 */
export default function (pi: ExtensionAPI): void {
    if (standsDown(isPackagedExtension, process.cwd())) return;

    const deliveredRules = new Set<string>();
    const hintedSkills = new Set<string>();
    const readSkills = new Set<string>();
    let loadedSkills: LoadedSkill[] | undefined;
    let loadedKey: string | undefined;
    let triggers: SkillTrigger[] | undefined;

    const availableTriggers = (cwd: string): SkillTrigger[] => triggers ??= skillTriggers(loadedSkills, cwd);

    // Compaction summarizes the conversation, which can drop an injected rule or hint while leaving the
    // delivery record claiming it is present; a switch replaces the conversation outright.
    const reset = () => {
        deliveredRules.clear();
        hintedSkills.clear();
        readSkills.clear();
        triggers = undefined;
    };
    pi.on('session_start', reset);
    pi.on('session_compact', reset);
    pi.on('session_before_switch', reset);

    // Only observes which skills Pi loaded for this session; the system prompt is never changed.
    pi.on('before_agent_start', event => {
        const skills = (event as { systemPromptOptions?: { skills?: LoadedSkill[] } }).systemPromptOptions?.skills;
        const key = skills?.map(skill => `${skill.name}\t${skill.filePath}`).join('\n');
        if (key !== loadedKey) triggers = undefined;
        loadedSkills = skills;
        loadedKey = key;
        return undefined;
    });

    pi.on('tool_result', (event, context) => {
        if (event.isError) return;
        const cwd = context.cwd;
        const toolName: string = event.toolName;
        const input = event.input;

        const reads = skillsRead(toolName, input, availableTriggers(cwd));
        reads.forEach(skill => readSkills.add(skill.name));

        const pendingRules: ManagedRule[] = [];
        const matchedFiles: string[] = [];
        const pendingHints: string[] = [];
        for (const path of touchedPaths(toolName, input, cwd)) {
            const relativePath = repositoryRelative(cwd, path);
            if (!relativePath) continue;
            for (const rule of rulesForPath(cwd, relativePath)) {
                if (deliveredRules.has(rule.name) || pendingRules.some(candidate => candidate.name === rule.name)) continue;
                pendingRules.push(rule);
                if (!matchedFiles.includes(relativePath)) matchedFiles.push(relativePath);
            }
            if (toolName !== ToolName.Write && toolName !== ToolName.Edit) continue;
            for (const match of skillsForPath(availableTriggers(cwd), relativePath)) {
                if (hintedSkills.has(match.skill.name) || readSkills.has(match.skill.name)) continue;
                hintedSkills.add(match.skill.name);
                pendingHints.push(hintLine(cwd, relativePath, match));
            }
        }
        if (pendingRules.length === 0 && pendingHints.length === 0) return;
        pendingRules.forEach(rule => deliveredRules.add(rule.name));

        const existing = Array.isArray(event.content) ? event.content : [];
        const text = [
            pendingRules.length === 0
                ? undefined
                : `\n\n[cratis-rules] Rules that apply to ${matchedFiles.join(', ')}:\n\n${pendingRules.map(rule => rule.content).join('\n\n')}`,
            pendingHints.length === 0 ? undefined : `\n\n${pendingHints.join('\n')}`,
        ].filter(part => part !== undefined).join('');
        return { content: [...existing, { type: 'text', text }] };
    });
}
