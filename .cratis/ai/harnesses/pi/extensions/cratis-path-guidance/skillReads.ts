// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SkillTrigger } from './SkillTrigger.ts';
import { ToolName } from './ToolName.ts';
import { commandOf, isShellTool } from './touchedPaths.ts';

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether text (a read path or a shell command) refers to a file inside the skill's directory. */
function mentionsSkill(text: string, skill: SkillTrigger): boolean {
    if (text.includes(`${skill.baseDir}/`)) return true;
    return new RegExp(`(?:^|[/\\s'"=])skills/${escapeRegExp(skill.name)}(?:/|[\\s'"]|$)`).test(text.replaceAll('\\', '/'));
}

/**
 * The skills a successful tool call read from: the `read` tool on a file under `skills/<name>/`, or a shell
 * command that mentions one (`cat`, `rtk read`, `grep`). Reading `SKILL.md` or any of its references counts,
 * because a model that opened them already has the skill's guidance.
 */
export function skillsRead(toolName: string, input: unknown, skills: SkillTrigger[]): SkillTrigger[] {
    let text: string | undefined;
    if (toolName === ToolName.Read) {
        const candidate = input as { path?: unknown; file_path?: unknown } | undefined;
        const value = candidate?.path ?? candidate?.file_path;
        text = typeof value === 'string' ? value : undefined;
    } else if (isShellTool(toolName)) {
        text = commandOf(input);
    }
    return text === undefined ? [] : skills.filter(skill => mentionsSkill(text, skill));
}
