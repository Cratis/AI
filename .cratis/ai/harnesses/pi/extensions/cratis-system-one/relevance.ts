// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { realpathSync } from 'node:fs';
import { sep } from 'node:path';
import type { Skill } from '@earendil-works/pi-coding-agent';
import type { NoulQuestion } from './NoulQuestion.ts';
import type { SkillCandidate } from './SkillCandidate.ts';
import type { SkillRelevanceSettings } from './SkillRelevanceSettings.ts';

const skillNamePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function realPathOf(path: string): string | undefined {
    try {
        return realpathSync(path);
    } catch {
        return undefined;
    }
}

/** Truncates to at most `limit` UTF-16 units without leaving half of a surrogate pair. */
export function truncate(text: string, limit: number): string {
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const last = cut.charCodeAt(cut.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

function firstSentence(description: string): string {
    const text = description.replace(/\s+/g, ' ').trim();
    const match = /^(.+?[.!?])(?:\s|$)/.exec(text);
    return match ? match[1] : text;
}

/** What a yes means for one skill: its name plus the first sentence of its description, capped. */
export function criterionFor(candidate: SkillCandidate, limit: number): string {
    const text = `${candidate.name}: ${firstSentence(candidate.description)}`;
    return text.length <= limit ? text : `${truncate(text, limit - 1)}\u2026`;
}

/**
 * The corpus skills Pi already loaded and put in the system prompt: those under a corpus root (the
 * managed `.cratis/ai/skills` or the packaged corpus) that the model may invoke. A skill from a user or
 * another package is not the corpus's to ask about. A repeated name is asked once.
 */
export function eligibleSkills(skills: readonly Skill[] | undefined, corpusRoots: readonly string[]): SkillCandidate[] {
    const roots = corpusRoots.flatMap(root => realPathOf(root) ?? []).map(root => root.endsWith(sep) ? root : `${root}${sep}`);
    const candidates = new Map<string, SkillCandidate>();
    for (const skill of skills ?? []) {
        if (skill.disableModelInvocation || !skillNamePattern.test(skill.name) || candidates.has(skill.name)) continue;
        const realPath = realPathOf(skill.filePath);
        if (realPath === undefined || !roots.some(root => realPath.startsWith(root))) continue;
        candidates.set(skill.name, { name: skill.name, description: skill.description, realPath });
    }
    return [...candidates.values()];
}

/** The state sent: the user prompt only, capped. Nothing else about the machine or repository. */
export function stateFor(prompt: string, settings: SkillRelevanceSettings): { prompt: string } {
    return { prompt: truncate(prompt, settings.stateChars) };
}

/**
 * One yes/no question per skill, keyed by skill name. Nouls rather than a single choice: a choice always
 * names a winner even when no skill applies, more than one skill can apply, and a local server's option
 * budget cannot hold dozens of described options.
 */
export function questionsFor(candidates: readonly SkillCandidate[], settings: SkillRelevanceSettings): Record<string, NoulQuestion> {
    return Object.fromEntries(candidates.map(candidate => [candidate.name, {
        type: 'noul',
        instructions: `Would the \`${candidate.name}\` guidance help answer or carry out \`prompt\`?`,
        criteria: { true: criterionFor(candidate, settings.criterionChars) },
    } satisfies NoulQuestion]));
}
