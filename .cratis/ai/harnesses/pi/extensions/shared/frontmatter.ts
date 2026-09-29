// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export function unquote(value: string): string {
    return value.trim().replace(/^["']|["']$/g, '');
}

/**
 * Reads the YAML-ish frontmatter the corpus uses: scalar `key: value` lines and `key:` followed by
 * `  - item` lines. Anything richer is not used by the rules and skills and is deliberately not supported.
 */
export function frontmatter(content: string): Map<string, string[]> {
    const fields = new Map<string, string[]>();
    if (!content.startsWith('---\n')) return fields;
    const end = content.indexOf('\n---\n', 4);
    if (end < 0) return fields;
    let current: string | undefined;
    for (const line of content.slice(4, end).split('\n')) {
        const item = /^\s+-\s+(.*)$/.exec(line);
        if (item && current) {
            fields.get(current)!.push(unquote(item[1]));
            continue;
        }
        const scalar = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
        if (!scalar) continue;
        current = scalar[1];
        const value = unquote(scalar[2]);
        fields.set(current, value ? value.split(',').map(unquote).filter(Boolean) : []);
    }
    return fields;
}

/**
 * Reads a nested string map: the indented `  key: value` lines under a top-level `name:` key, as Agent Skills
 * `metadata` uses. Values stay whole strings (no comma splitting) and are unquoted. Returns `undefined` when the
 * key is absent or the frontmatter is unterminated.
 */
export function frontmatterMap(content: string, name: string): Map<string, string> | undefined {
    if (!content.startsWith('---\n')) return undefined;
    const end = content.indexOf('\n---\n', 4);
    if (end < 0) return undefined;
    let map: Map<string, string> | undefined;
    let inside = false;
    for (const line of content.slice(4, end).split('\n')) {
        const top = /^([A-Za-z][\w-]*):/.exec(line);
        if (top) {
            inside = top[1] === name;
            if (inside) map ??= new Map();
            continue;
        }
        const entry = /^\s+([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
        if (inside && entry) map!.set(entry[1], unquote(entry[2]));
    }
    return map;
}
