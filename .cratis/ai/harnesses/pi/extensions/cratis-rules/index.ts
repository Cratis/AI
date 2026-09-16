// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const corpusRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

type AiConfiguration = { profiles?: string[] };

export interface ManagedRule {
    /** Path relative to the rules root, e.g. `code-quality-csharp.md` or `project/running-the-local-stack.md`. */
    name: string;
    /** Full file content, frontmatter included, exactly as the other harnesses receive it. */
    content: string;
    /** `application`, `framework`, or undefined when the rule is not profile-specific. */
    profile?: string;
    /** Globs from `applyTo` and `paths`. Empty means the rule applies to every file. */
    globs: string[];
}

const universalGlobs = new Set(['**', '**/*', '*']);

function unquote(value: string): string {
    return value.trim().replace(/^["']|["']$/g, '');
}

/**
 * Reads the YAML-ish frontmatter the corpus uses: scalar `key: value` lines and `key:` followed by
 * `  - item` lines. Anything richer is not used by the rules and is deliberately not supported.
 */
function frontmatter(content: string): Map<string, string[]> {
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

function escapeRegExp(text: string): string {
    return text.replace(/[.+^$()|[\]\\]/g, '\\$&');
}

/** Converts the glob dialect used by `applyTo` (`**`, `*`, `?`, `{a,b}`) into an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
    let pattern = '';
    for (let index = 0; index < glob.length; index++) {
        const character = glob[index];
        if (character === '*') {
            if (glob[index + 1] === '*') {
                if (glob[index + 2] === '/') {
                    pattern += '(?:.*/)?';
                    index += 2;
                } else {
                    pattern += '.*';
                    index += 1;
                }
            } else {
                pattern += '[^/]*';
            }
        } else if (character === '?') {
            pattern += '[^/]';
        } else if (character === '{') {
            const close = glob.indexOf('}', index);
            if (close > index) {
                pattern += `(?:${glob.slice(index + 1, close).split(',').map(part => escapeRegExp(part.trim())).join('|')})`;
                index = close;
            } else {
                pattern += '\\{';
            }
        } else {
            pattern += escapeRegExp(character);
        }
    }
    return new RegExp(`^${pattern}$`);
}

function rulesRoot(cwd: string): string {
    const managedRoot = join(cwd, '.cratis', 'ai', 'rules');
    return existsSync(managedRoot) ? managedRoot : join(corpusRoot, 'rules');
}

function configuration(cwd: string): AiConfiguration | undefined {
    const path = join(cwd, '.cratis', 'ai.json');
    if (!existsSync(path)) return undefined;
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as AiConfiguration;
    } catch {
        return undefined;
    }
}

/**
 * A profile-specific rule is kept only when the repository selects that profile. Repositories without
 * a `.cratis/ai.json` keep every rule, matching the `@cratis/pi` package.
 */
function matchesProfile(rule: ManagedRule, selected: AiConfiguration | undefined): boolean {
    if (!rule.profile || !selected) return true;
    const profiles = selected.profiles ?? [];
    if (rule.profile === 'application') return profiles.some(profile => profile.startsWith('cratis/application'));
    if (rule.profile === 'framework') return profiles.some(profile => profile.startsWith('cratis/engineering'));
    return true;
}

/** Loads every managed rule with its frontmatter interpreted, filtered to the repository's profiles. */
export function managedRules(cwd: string): ManagedRule[] {
    const root = rulesRoot(cwd);
    const selected = configuration(cwd);
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((entry): entry is string => entry.endsWith('.md'))
        .sort()
        .map(entry => {
            const content = readFileSync(join(root, entry), 'utf8');
            const fields = frontmatter(content);
            return {
                name: entry.split(sep).join('/'),
                content,
                profile: fields.get('profile')?.[0],
                globs: [...(fields.get('applyTo') ?? []), ...(fields.get('paths') ?? [])],
            } satisfies ManagedRule;
        })
        .filter(rule => matchesProfile(rule, selected));
}

/** Rules that apply to every file. These belong in the system prompt. */
export function universalRules(cwd: string): ManagedRule[] {
    return managedRules(cwd).filter(rule => rule.globs.length === 0 || rule.globs.some(glob => universalGlobs.has(glob)));
}

/** Rules whose `applyTo`/`paths` match a repository-relative path. These are delivered when that file is touched. */
export function rulesForPath(cwd: string, relativePath: string): ManagedRule[] {
    const normalized = relativePath.split(sep).join('/');
    return managedRules(cwd).filter(rule =>
        rule.globs.length > 0 &&
        !rule.globs.some(glob => universalGlobs.has(glob)) &&
        rule.globs.some(glob => globToRegExp(glob).test(normalized)));
}

function touchedPath(toolName: string, input: unknown): string | undefined {
    if (toolName !== 'read' && toolName !== 'write' && toolName !== 'edit') return undefined;
    const candidate = (input as { path?: unknown; file_path?: unknown } | undefined);
    const value = candidate?.path ?? candidate?.file_path;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Gives Pi the same rule semantics as the other harnesses: universal rules in the system prompt, and
 * path-scoped rules attached the first time a matching file is read or written in the session. Without
 * this, every rule was concatenated into every turn regardless of `applyTo`, `paths`, or `profile`.
 */
export default function (pi: ExtensionAPI): void {
    const delivered = new Set<string>();

    pi.on('session_start', () => {
        delivered.clear();
    });

    pi.on('before_agent_start', (event, context) => ({
        systemPrompt: `${event.systemPrompt}\n\n${universalRules(context.cwd).map(rule => rule.content).join('\n\n')}`,
    }));

    pi.on('tool_result', (event, context) => {
        if (event.isError) return;
        const path = touchedPath(event.toolName, (event as { input?: unknown }).input);
        if (!path) return;
        const relativePath = relative(context.cwd, resolve(context.cwd, path));
        if (!relativePath || relativePath.startsWith('..')) return;
        const pending = rulesForPath(context.cwd, relativePath).filter(rule => !delivered.has(rule.name));
        if (pending.length === 0) return;
        pending.forEach(rule => delivered.add(rule.name));
        const existing = Array.isArray(event.content) ? event.content : [];
        return {
            content: [
                ...existing,
                {
                    type: 'text',
                    text: `\n\n[cratis-rules] Rules that apply to ${relativePath.split(sep).join('/')}:\n\n${pending.map(rule => rule.content).join('\n\n')}`,
                },
            ],
        };
    });
}
