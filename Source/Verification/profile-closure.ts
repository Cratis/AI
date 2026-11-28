// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Profile {
    id: string;
    composes?: string[];
    languages?: string[];
    availableTargets?: string[];
}

export interface Selection { profiles: string[]; languages: string[] }
export type Selector = 'cli' | 'pi';

function includesLanguage(profile: Profile, languages: string[], selector: Selector): boolean {
    if (!languages.length || profile.languages === undefined) return true;
    // The CLI distinguishes an omitted languages property from an explicitly empty array. Pi does not.
    if (!profile.languages.length) return selector === 'pi';
    return profile.languages.some(language => language === 'language-agnostic' || languages.includes(language));
}

/** The selected skills, retaining explicit roots even when their language does not match. */
export function skillClosure(byId: ReadonlyMap<string, Profile>, { profiles, languages }: Selection, selector: Selector): string[] {
    const reached = new Set(profiles);
    for (const id of reached) {
        for (const child of byId.get(id)?.composes ?? []) {
            const profile = byId.get(child);
            if (profile && includesLanguage(profile, languages, selector)) reached.add(child);
        }
    }
    return [...new Set([...reached].flatMap(id => byId.get(id)?.availableTargets ?? []))].sort();
}
