// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { dirname, join, normalize } from 'node:path/posix';
import { markdownHeadings, markdownLinkDestinations } from './skill-structure.ts';

export type InstalledFiles = ReadonlyMap<string, string>;

export function localLinks(path: string, content: string) {
    return markdownLinkDestinations(content).filter(link => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link)).map(link => {
        const [file, anchor] = link.split('#', 2);
        try {
            return { link, target: file ? (file.startsWith('/') ? file : normalize(join(dirname(path), decodeURIComponent(file)))) : path, anchor: anchor && decodeURIComponent(anchor) };
        } catch {
            return { link, target: undefined, anchor };
        }
    });
}

function anchors(content: string): Set<string> {
    const seen = new Set<string>();
    for (const { text } of markdownHeadings(content)) {
        const base = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
        let slug = base;
        for (let i = 1; seen.has(slug); i++) slug = `${base}-${i}`;
        seen.add(slug);
    }
    return seen;
}

export function installedLinkProblems(files: InstalledFiles): string[] {
    return [...files].filter(([path]) => path.endsWith('.md')).flatMap(([path, content]) => localLinks(path, content).flatMap(({ link, target, anchor }) => {
        const destination = target === undefined ? undefined : files.get(target);
        if (destination === undefined) return [`${path}: '${link}' has no exact installed path.`];
        if (!anchor || !target?.endsWith('.md')) return [];
        return anchors(destination).has(anchor) ? [] : [`${path}: '${link}' has no exact installed anchor.`];
    }));
}

export function referenceLinkProblems(subject: string, body: string, files: string[]): string[] {
    const links = new Set(localLinks(subject, body).map(({ target }) => target));
    return files.filter(path => path.startsWith('references/') && !links.has(join(dirname(subject), path)))
        .map(path => `${subject} must link to '${path}' from its main body.`);
}
