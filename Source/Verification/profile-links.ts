// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { type InstalledFiles, localLinks } from './installed-links.ts';
import { type Profile, skillClosure } from './profile-closure.ts';

interface Handoff { path: string; link: string; source: string; destination: string }

function skillOf(path: string): string | undefined {
    return /^skills\/([^/]+)\//.exec(path)?.[1];
}

function crossSkillHandoffs(files: InstalledFiles): Handoff[] {
    return [...files].flatMap(([path, content]) => {
        const source = skillOf(path);
        if (!source || !path.endsWith('.md')) return [];
        return localLinks(path, content).flatMap(({ link, target }) => {
            if (!target || !files.has(target)) return []; // The whole-package check reports missing paths.
            const destination = skillOf(target);
            return destination && destination !== source ? [{ path, link, source, destination }] : [];
        });
    });
}

function* profileClosures(profiles: Profile[], languages: string[]) {
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    // Each profile that contributes a source is also tested as an explicit root. It keeps its source
    // under a singleton filter; any target reached there remains reachable as more languages are added.
    const filters = [[], ...languages.map(language => [language])];
    for (const { id } of profiles) {
        for (const languages of filters) {
            for (const selector of ['cli', 'pi'] as const) {
                const installed = new Set(skillClosure(byId, { profiles: [id], languages }, selector));
                yield { id, languages, selector, installed };
            }
        }
    }
}

/** A relative handoff is valid only when every selection containing its source also contains its destination. */
export function profileLinkProblems(files: InstalledFiles, profiles: Profile[], languages: string[]): string[] {
    const handoffs = crossSkillHandoffs(files);
    if (!handoffs.length) return [];
    const selections = [...profileClosures(profiles, languages)];
    return handoffs.flatMap(({ path, link, source, destination }) => {
        const witness = selections.find(({ installed }) => installed.has(source) && !installed.has(destination));
        if (!witness) return [];
        const { id, selector, languages } = witness;
        return [`${path}: '${link}' leaves the ${selector} selection '${id}' with languages [${languages.join(', ')}].`];
    }).sort();
}
