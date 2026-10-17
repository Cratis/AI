// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkOpenCodeAgents, generateOpenCodeAgents, generatedAgentMarkerPrefix, openCodeAgentsDirectory, type GeneratedAgent } from './opencode-agents.ts';
import { checkPiAgents, generatePiAgents, piAgentMarkerPrefix, piAgentsDirectory } from './pi-agents.ts';
import { checkCopilotInstructions, copilotInstructions, copilotInstructionsDirectory, copilotMarker } from './copilot-instructions.ts';

type Link = { path: string; target: string; type: 'file' | 'dir' };

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');
const rootArgument = process.argv.slice(2).find(argument => !argument.startsWith('-'));
const root = resolve(rootArgument ?? join(import.meta.dirname, '..', '..'));
const corpus = join(root, '.cratis', 'ai');
if (!existsSync(corpus)) throw new Error(`No canonical corpus exists at ${corpus}.`);

// Preflight every generated adapter before writing anything; markers identify owned stale output.
function planAgents(name: string, relativeDirectory: string, files: GeneratedAgent[], marker: string, drift: () => string[]) {
    const directory = join(corpus, relativeDirectory);
    requireRealParents(directory, corpus);
    const expected = new Set(files.map(file => file.path.split('/').pop()));
    const paths = files.map(file => join(corpus, file.path));
    const current = state(directory);
    const conflict = current && (!current.isDirectory() || current.isSymbolicLink());
    if (current?.isDirectory() && !current.isSymbolicLink()) {
        paths.push(...readdirSync(directory).filter(name => !expected.has(name)).map(name => join(directory, name)));
    }
    if (check || (!force && (conflict || paths.some(path => state(path) && !isGeneratedAgent(path, marker))))) {
        const stale = drift();
        if (stale.length > 0) throw new Error(`${name} agent adapters are out of date:\n${stale.join('\n')}`);
    }
    return { directory, expected, paths, conflict, files };
}
const agentPlans = [
    planAgents('OpenCode', openCodeAgentsDirectory, generateOpenCodeAgents(corpus), generatedAgentMarkerPrefix, () => checkOpenCodeAgents(corpus)),
    planAgents('Pi', piAgentsDirectory, generatePiAgents(corpus), piAgentMarkerPrefix, () => checkPiAgents(corpus)),
];

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

function isGeneratedAgent(path: string, marker: string): boolean {
    try {
        return !!state(path)?.isFile() && readFileSync(path, 'utf8').includes(`\n${marker}`);
    } catch {
        return false;
    }
}

const copilot = copilotInstructions(corpus);
const copilotDirectory = join(corpus, copilotInstructionsDirectory);
requireRealParents(copilotDirectory, corpus);
const copilotDirectoryState = state(copilotDirectory);
const copilotDirectoryConflict = copilotDirectoryState && !copilotDirectoryState.isDirectory();
const copilotNames = new Set(copilot.map(file => file.path.split('/').pop()));
const copilotPaths = copilot.map(file => join(corpus, file.path));
if (copilotDirectoryState?.isDirectory()) {
    copilotPaths.push(...readdirSync(copilotDirectory).filter(name => !copilotNames.has(name)).map(name => join(copilotDirectory, name)));
}
if (check || (!force && (copilotDirectoryConflict || copilotPaths.some(path => state(path) && !ownedCopilot(path))))) {
    const stale = checkCopilotInstructions(corpus);
    if (stale.length > 0) throw new Error(`Copilot instruction adapters are out of date:\n${stale.join('\n')}`);
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
add('.github/copilot-instructions.md', '../.cratis/ai/rules/general.md', 'file');
add('.github/instructions', `../.cratis/ai/${copilotInstructionsDirectory}`, 'dir');
add('.github/prompts', '../.cratis/ai/prompts', 'dir');
add('.github/skills', '../.cratis/ai/skills', 'dir');
agents('.github/agents', '.agent.md');
add('.pi/agents', `../.cratis/ai/${piAgentsDirectory}`, 'dir');
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
// Migrate only an empty directory or the per-file adapters from the previous setup. Unknown
// project instructions still block adoption of a whole-directory link unless explicitly forced.
const legacyInstructions = instructionsState?.isDirectory() ? readdirSync(instructionsDirectory).map(name => join(instructionsDirectory, name)) : [];
const migrateInstructions = !!instructionsState?.isDirectory() && legacyInstructions.every(path => {
    const name = path.split('/').pop()!;
    if (!name.endsWith('.md')) return false;
    const canonical = join(corpus, 'rules', name.replace(/\.instructions\.md$/, '.md'));
    return (state(path)?.isSymbolicLink() && resolve(dirname(path), readlinkSync(path)) === canonical) || ownedCopilot(path);
});
for (const link of links.values()) {
    const path = join(root, link.path);
    requireRealParents(path, root);
    const actual = state(path)?.isSymbolicLink() ? readlinkSync(path) : undefined;
    if (actual === link.target) continue;
    if (check || (state(path) && !ownedLink(path) && !(link.path === '.github/instructions' && migrateInstructions) && !(link.path === '.github/copilot-instructions.md' && ownedCopilot(path)) && !force)) {
        failures.push(`${link.path}: expected symbolic link to ${link.target}`);
    }
}

if (failures.length > 0) throw new Error(`Harness setup is out of date:\n${failures.join('\n')}`);
if (!check) {
    if (migrateInstructions && !force) {
        for (const path of legacyInstructions) unlinkSync(path);
        rmdirSync(instructionsDirectory);
    }
    if (copilotDirectoryConflict) remove(copilotDirectory);
    mkdirSync(copilotDirectory, { recursive: true });
    for (const path of copilotPaths) {
        if (!copilotNames.has(path.split('/').pop())) remove(path);
    }
    for (const file of copilot) {
        const path = join(corpus, file.path);
        remove(path);
        writeFileSync(path, file.content);
    }
    for (const plan of agentPlans) {
        if (plan.conflict) remove(plan.directory);
        mkdirSync(plan.directory, { recursive: true });
        for (const path of plan.paths) {
            if (!plan.expected.has(path.split('/').pop())) remove(path);
        }
        for (const file of plan.files) {
            const path = join(corpus, file.path);
            // Unlink before writing so --force cannot write through an occupied symlink.
            remove(path);
            writeFileSync(path, file.content);
        }
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
