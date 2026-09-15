// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

type Link = { path: string; target: string; type: 'file' | 'dir' };

const check = process.argv.includes('--check');
const rootArgument = process.argv.slice(2).find(argument => !argument.startsWith('-'));
const root = resolve(rootArgument ?? join(import.meta.dirname, '..', '..'));
const corpus = join(root, '.cratis', 'ai');
if (!existsSync(corpus)) throw new Error(`No canonical corpus exists at ${corpus}.`);

const links = new Map<string, Link>();
function add(path: string, target: string, type: Link['type']): void {
    const existing = links.get(path);
    if (existing && (existing.target !== target || existing.type !== type)) throw new Error(`Conflicting integration plan for ${path}.`);
    links.set(path, { path, target, type });
}
function commands(directory: string): void {
    for (const prompt of readdirSync(join(corpus, 'prompts')).filter(name => name.endsWith('.prompt.md')).sort()) {
        add(`${directory}/${prompt.slice(0, -'.prompt.md'.length)}.md`, `../../.cratis/ai/prompts/${prompt}`, 'file');
    }
}
function agents(directory: string, suffix = '.md'): void {
    for (const agent of readdirSync(join(corpus, 'agents')).filter(name => name.endsWith('.md')).sort()) {
        add(`${directory}/${agent.slice(0, -3)}${suffix}`, `../../.cratis/ai/agents/${agent}`, 'file');
    }
}

add('AGENTS.md', '.cratis/ai/rules/general.md', 'file');
add('CLAUDE.md', '.cratis/ai/rules/general.md', 'file');
add('.agents/skills', '../.cratis/ai/skills', 'dir');
add('.claude/CLAUDE.md', '../.cratis/ai/rules/general.md', 'file');
add('.claude/agents', '../.cratis/ai/agents', 'dir');
add('.claude/hooks', '../.cratis/ai/hooks', 'dir');
add('.claude/prompts', '../.cratis/ai/prompts', 'dir');
add('.claude/rules', '../.cratis/ai/rules', 'dir');
add('.claude/skills', '../.cratis/ai/skills', 'dir');
commands('.claude/commands');
add('.github/copilot-instructions.md', '../.cratis/ai/rules/general.md', 'file');
add('.github/instructions', '../.cratis/ai/rules', 'dir');
add('.github/prompts', '../.cratis/ai/prompts', 'dir');
add('.github/skills', '../.cratis/ai/skills', 'dir');
agents('.github/agents', '.agent.md');
add('.pi/agents', '../.cratis/ai/agents', 'dir');
add('.pi/extensions', '../.cratis/ai/harnesses/pi/extensions', 'dir');
add('.pi/skills', '../.cratis/ai/skills', 'dir');
commands('.pi/prompts');
add('.cursor/agents', '../.cratis/ai/agents', 'dir');
add('.cursor/rules', '../.cratis/ai/harnesses/cursor/rules', 'dir');
add('.cursor/skills', '../.cratis/ai/skills', 'dir');
commands('.cursor/commands');
add('.opencode/agents', '../.cratis/ai/agents', 'dir');
add('.opencode/skills', '../.cratis/ai/skills', 'dir');
commands('.opencode/commands');

const failures: string[] = [];
for (const link of links.values()) {
    const path = join(root, link.path);
    let actual: string | undefined;
    try {
        actual = lstatSync(path).isSymbolicLink() ? readlinkSync(path) : undefined;
    } catch {
        actual = undefined;
    }
    if (actual === link.target) continue;
    if (check) {
        failures.push(`${link.path}: expected symbolic link to ${link.target}`);
        continue;
    }
    rmSync(path, { recursive: true, force: true });
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(link.target, path, link.type === 'dir' ? 'dir' : 'file');
}

if (failures.length > 0) throw new Error(`Harness setup is out of date:\n${failures.join('\n')}`);
console.log(`${check ? 'Verified' : 'Configured'} ${links.size} harness integrations.`);
