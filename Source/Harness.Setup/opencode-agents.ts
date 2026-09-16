// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Generates the OpenCode agent adapters from the canonical agents.
 *
 * The canonical agents under `.cratis/ai/agents/*.md` are written in the Claude Code shape: a `tools:`
 * allowlist of Claude tool names plus Cursor's `readonly:` flag. Claude Code reads that shape natively,
 * VS Code Copilot and Cursor read `.claude/agents` and map or ignore what they need, and the Pi subagent
 * extension normalizes the tool names at load time. OpenCode is the one harness whose schema is
 * structurally different: it has no `tools:` allowlist (its `tools:` is a deprecated name→boolean map),
 * restriction is a `permission:` map, `mode: subagent` is required for delegation, and `model` takes the
 * `provider/id` form. A symlink to the canonical file cannot express any of that, so OpenCode receives
 * generated files under `.cratis/ai/harnesses/opencode/agents/` — derived, checked, never hand-edited.
 *
 * Every other harness keeps pointing at the canonical directory. The cratis CLI already copies and links
 * `harnesses/<harness>/` per selected harness, so this needs no new distribution mechanism.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** A generated adapter file: where it lives relative to the corpus root, and its full content. */
export interface GeneratedAgent {
    /** The canonical agent file name, e.g. `code-reviewer.md`. */
    source: string;
    /** Path relative to the corpus root (`.cratis/ai`). */
    path: string;
    /** The complete file content. */
    content: string;
}

/** The parsed pieces of a canonical agent this generator needs. */
export interface CanonicalAgent {
    file: string;
    /** The raw frontmatter lines, without the `---` fences. */
    frontmatter: string[];
    /** Everything after the closing fence, verbatim. */
    body: string;
    name: string;
    tools: string[];
    model?: string;
    readonly: boolean;
}

export const openCodeAgentsDirectory = 'harnesses/opencode/agents';

/** The Claude tool names a canonical agent may declare. Anything else is a defect, not a harness quirk. */
export const canonicalToolNames = ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Agent'] as const;

/**
 * The marker every generated adapter carries. Deliberately names only corpus paths: a consumer receives the
 * corpus without this repository's build tooling, so the marker must not point at it.
 */
export const generatedAgentMarkerPrefix = '<!-- cratis-ai: generated OpenCode adapter of agents/';
const generatedMarker = (source: string) =>
    `${generatedAgentMarkerPrefix}${source}. Do not edit; the canonical agent is the source. -->`;

/** Provider prefixes for the bare model ids the canonical agents use. */
const providerByModelPrefix: Array<[prefix: string, provider: string]> = [
    ['claude-', 'anthropic'],
];

function splitFrontmatter(file: string, text: string): { frontmatter: string[]; body: string } {
    if (!text.startsWith('---\n')) throw new Error(`${file} has no frontmatter.`);
    const end = text.indexOf('\n---\n', 4);
    if (end < 0) throw new Error(`${file} has an unterminated frontmatter block.`);
    return { frontmatter: text.slice(4, end).split('\n'), body: text.slice(end + 5) };
}

/**
 * Reads the frontmatter keys this generator needs. The canonical agents use exactly four shapes -
 * `key: value`, `key: >` folded blocks, `key:` followed by `  - item` lines, and `key: [a, b]` - and
 * this reads those without a YAML dependency. Unknown shapes fail loudly rather than parse silently.
 */
export function parseCanonicalAgent(file: string, text: string): CanonicalAgent {
    const { frontmatter, body } = splitFrontmatter(file, text);
    const scalar = (key: string): string | undefined => {
        const line = frontmatter.find(l => l.startsWith(`${key}:`));
        if (line === undefined) return undefined;
        const value = line.slice(key.length + 1).trim();
        if (value === '' || value === '>' || value === '|') return undefined;
        return value.replace(/^['"]|['"]$/g, '');
    };
    const list = (key: string): string[] => {
        const index = frontmatter.findIndex(l => l.startsWith(`${key}:`));
        if (index < 0) return [];
        const inline = frontmatter[index].slice(key.length + 1).trim();
        if (inline.startsWith('[')) {
            return inline.replace(/^\[|\]$/g, '').split(',').map(v => v.trim()).filter(Boolean);
        }
        if (inline !== '') throw new Error(`${file}: '${key}:' must be a YAML list, got '${inline}'.`);
        const items: string[] = [];
        for (let i = index + 1; i < frontmatter.length && frontmatter[i].startsWith('  - '); i++) {
            items.push(frontmatter[i].slice(4).trim());
        }
        return items;
    };
    const name = scalar('name');
    if (!name) throw new Error(`${file} declares no name.`);
    return {
        file,
        frontmatter,
        body,
        name,
        tools: list('tools'),
        model: scalar('model'),
        readonly: scalar('readonly') === 'true',
    };
}

/** Reads every canonical agent under `<corpusRoot>/agents`. */
export function readCanonicalAgents(corpusRoot: string): CanonicalAgent[] {
    const directory = join(corpusRoot, 'agents');
    return readdirSync(directory)
        .filter(name => name.endsWith('.md'))
        .sort()
        .map(name => parseCanonicalAgent(name, readFileSync(join(directory, name), 'utf8')));
}

/** The OpenCode adapter for one canonical agent. */
export function generateOpenCodeAgent(agent: CanonicalAgent): GeneratedAgent {
    const unknown = agent.tools.filter(tool => !(canonicalToolNames as readonly string[]).includes(tool));
    if (unknown.length > 0) {
        throw new Error(`${agent.file} declares tools outside the canonical vocabulary: ${unknown.join(', ')}.`);
    }
    if (agent.readonly && agent.tools.some(tool => tool === 'Edit' || tool === 'Write')) {
        throw new Error(`${agent.file} is readonly but declares Edit/Write.`);
    }

    // The description travels verbatim (folded block and all); name, tools and readonly are Claude/Cursor
    // keys OpenCode does not know - and OpenCode forwards unknown keys to the model provider as options.
    const description: string[] = [];
    const descriptionIndex = agent.frontmatter.findIndex(line => line.startsWith('description:'));
    if (descriptionIndex < 0) throw new Error(`${agent.file} declares no description; OpenCode requires one.`);
    description.push(agent.frontmatter[descriptionIndex]);
    for (let i = descriptionIndex + 1; i < agent.frontmatter.length && agent.frontmatter[i].startsWith('  '); i++) {
        description.push(agent.frontmatter[i]);
    }

    const canEdit = agent.tools.includes('Edit') || agent.tools.includes('Write');
    const canBash = agent.tools.includes('Bash');
    const lines = ['---', ...description, 'mode: subagent'];
    const provider = agent.model ? providerByModelPrefix.find(([prefix]) => agent.model!.startsWith(prefix))?.[1] : undefined;
    if (agent.model && provider) lines.push(`model: ${provider}/${agent.model}`);
    lines.push('permission:', `  edit: ${canEdit ? 'allow' : 'deny'}`, `  bash: ${canBash ? 'allow' : 'deny'}`, '---');

    return {
        source: agent.file,
        path: `${openCodeAgentsDirectory}/${basename(agent.file)}`,
        content: `${lines.join('\n')}\n${generatedMarker(agent.file)}\n${agent.body}`,
    };
}

/** Every OpenCode adapter the canonical agents imply, in file-name order. */
export function generateOpenCodeAgents(corpusRoot: string): GeneratedAgent[] {
    return readCanonicalAgents(corpusRoot).map(generateOpenCodeAgent);
}

/**
 * Compares the on-disk OpenCode adapters with what the canonical agents imply.
 * Returns one message per stale, missing, or orphaned file; an empty list means current.
 */
export function checkOpenCodeAgents(corpusRoot: string): string[] {
    const expected = generateOpenCodeAgents(corpusRoot);
    const directory = join(corpusRoot, openCodeAgentsDirectory);
    const failures: string[] = [];
    for (const file of expected) {
        const path = join(corpusRoot, file.path);
        if (!existsSync(path)) failures.push(`${file.path} is missing (generated from agents/${file.source}).`);
        else if (readFileSync(path, 'utf8') !== file.content) failures.push(`${file.path} is stale (regenerate from agents/${file.source}).`);
    }
    const expectedNames = new Set(expected.map(file => basename(file.path)));
    if (existsSync(directory)) {
        for (const name of readdirSync(directory)) {
            if (!expectedNames.has(name)) failures.push(`${openCodeAgentsDirectory}/${name} has no canonical agent (orphan).`);
        }
    }
    return failures;
}
