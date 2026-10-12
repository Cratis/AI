// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkOpenCodeAgents, generateOpenCodeAgents, generatedAgentMarkerPrefix, openCodeAgentsDirectory } from './opencode-agents.ts';
import { copilotInstructions, copilotMarker } from './copilot-instructions.ts';

type Link = { path: string; target: string; type: 'file' | 'dir' };

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');
const rootArgument = process.argv.slice(2).find(argument => !argument.startsWith('-'));
const root = resolve(rootArgument ?? join(import.meta.dirname, '..', '..'));
const corpus = join(root, '.cratis', 'ai');
if (!existsSync(corpus)) throw new Error(`No canonical corpus exists at ${corpus}.`);

// Preflight all managed paths before writing anything. OpenCode requires generated content rather
// than canonical symlinks; its marker identifies stale outputs that setup can safely regenerate.
const directory = join(corpus, openCodeAgentsDirectory);
requireRealParents(directory, corpus);
const generated = generateOpenCodeAgents(corpus);
const expected = new Set(generated.map(file => file.path.split('/').pop()));
const adapterPaths = generated.map(file => join(corpus, file.path));
const directoryState = state(directory);
const adapterDirectoryConflict = directoryState && (!directoryState.isDirectory() || directoryState.isSymbolicLink());
if (directoryState?.isDirectory() && !directoryState.isSymbolicLink()) {
    adapterPaths.push(...readdirSync(directory).filter(name => !expected.has(name)).map(name => join(directory, name)));
}
const adapterConflict = adapterDirectoryConflict || adapterPaths.some(path => state(path) && !isGeneratedAgent(path));
if (check || (adapterConflict && !force)) {
    const stale = checkOpenCodeAgents(corpus);
    if (stale.length > 0) throw new Error(`OpenCode agent adapters are out of date:\n${stale.join('\n')}`);
}

function state(path: string): ReturnType<typeof lstatSync> | undefined {
    try {
        return lstatSync(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

function requireRealParents(path: string, boundary: string): void {
    for (let parent = dirname(path); parent !== boundary; parent = dirname(parent)) {
        const current = state(parent);
        if (current && (!current.isDirectory() || current.isSymbolicLink())) {
            throw new Error(`Harness setup is out of date:\n${parent.slice(root.length + 1)}: expected directory, not an occupied parent path`);
        }
    }
}

function ownedLink(path: string): boolean {
    if (!state(path)?.isSymbolicLink()) return false;
    const target = resolve(dirname(path), readlinkSync(path));
    return target.startsWith(`${corpus}/`);
}

function ownedCopilot(path: string): boolean {
    return !!state(path)?.isFile() && readFileSync(path, 'utf8').includes(copilotMarker);
}

function remove(path: string): void {
    if (!state(path)) return;
    if (force) rmSync(path, { recursive: true, force: true });
    else unlinkSync(path);
}

function isGeneratedAgent(path: string): boolean {
    try {
        return !!state(path)?.isFile() && readFileSync(path, 'utf8').includes(`\n${generatedAgentMarkerPrefix}`);
    } catch {
        return false;
    }
}

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
const copilot = copilotInstructions(corpus);
for (const instruction of copilot) {
    if (instruction.target) add(instruction.path, instruction.target, 'file');
}
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
add('.opencode/agents', `../.cratis/ai/${openCodeAgentsDirectory}`, 'dir');
add('.opencode/skills', '../.cratis/ai/skills', 'dir');
commands('.opencode/commands');

const failures: string[] = [];
const instructionsDirectory = join(root, '.github/instructions');
requireRealParents(instructionsDirectory, root);
const instructionsState = state(instructionsDirectory);
const migrateInstructions = instructionsState?.isSymbolicLink() && readlinkSync(instructionsDirectory) === '../.cratis/ai/rules';
if (instructionsState && (!instructionsState.isDirectory() || instructionsState.isSymbolicLink())) {
    if (check || (!migrateInstructions && !force)) failures.push('.github/instructions: expected directory for Copilot path instructions');
}
// Do not inspect child paths through a directory link that will be migrated or refused.
function plannedState(path: string): ReturnType<typeof state> {
    if (instructionsState && (!instructionsState.isDirectory() || instructionsState.isSymbolicLink()) && path.startsWith(`${instructionsDirectory}/`)) return undefined;
    return state(path);
}
const obsoleteInstructions: string[] = [];
if (instructionsState?.isDirectory() && !instructionsState.isSymbolicLink()) {
    for (const name of readdirSync(instructionsDirectory).filter(name => name.endsWith('.md'))) {
        const path = join(instructionsDirectory, name);
        const rule = name.replace(/\.instructions\.md$/, '.md');
        const canonicalLink = state(path)?.isSymbolicLink() && resolve(dirname(path), readlinkSync(path)) === join(corpus, 'rules', rule);
        if ((canonicalLink || ownedCopilot(path)) && !copilot.some(instruction => instruction.path === `.github/instructions/${name}`)) {
            obsoleteInstructions.push(path);
            if (check) failures.push(`.github/instructions/${name}: obsolete Copilot adapter`);
        }
    }
}
for (const instruction of copilot.filter(instruction => instruction.content !== undefined)) {
    const path = join(root, instruction.path);
    const current = plannedState(path);
    const content = current?.isFile() ? readFileSync(path, 'utf8') : undefined;
    if (content === instruction.content) continue;
    if (check || (current && !ownedLink(path) && !content?.includes(copilotMarker) && !force)) {
        failures.push(`${instruction.path}: expected generated Copilot instructions`);
    }
}
for (const link of links.values()) {
    const path = join(root, link.path);
    if (!link.path.startsWith('.github/instructions/')) requireRealParents(path, root);
    const actual = plannedState(path)?.isSymbolicLink() ? readlinkSync(path) : undefined;
    if (actual === link.target) continue;
    if (check || (plannedState(path) && !ownedLink(path) && !(link.path.startsWith('.github/instructions/') && ownedCopilot(path)) && !force)) {
        failures.push(`${link.path}: expected symbolic link to ${link.target}`);
    }
}

if (failures.length > 0) throw new Error(`Harness setup is out of date:\n${failures.join('\n')}`);
if (!check) {
    if (instructionsState && (!instructionsState.isDirectory() || instructionsState.isSymbolicLink())) remove(instructionsDirectory);
    mkdirSync(instructionsDirectory, { recursive: true });
    for (const path of obsoleteInstructions) remove(path);
    for (const instruction of copilot.filter(instruction => instruction.content !== undefined)) {
        const path = join(root, instruction.path);
        remove(path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, instruction.content!);
    }
    if (adapterDirectoryConflict) remove(directory);
    mkdirSync(directory, { recursive: true });
    for (const path of adapterPaths) {
        if (!expected.has(path.split('/').pop())) remove(path);
    }
    for (const file of generated) {
        const path = join(corpus, file.path);
        // Unlink before writing so --force cannot write through an occupied symlink.
        remove(path);
        writeFileSync(path, file.content);
    }
    for (const link of links.values()) {
        const path = join(root, link.path);
        if (state(path)?.isSymbolicLink() && readlinkSync(path) === link.target) continue;
        remove(path);
        mkdirSync(dirname(path), { recursive: true });
        symlinkSync(link.target, path, link.type);
    }
}
console.log(`${check ? 'Verified' : 'Configured'} ${links.size} harness integrations.`);
