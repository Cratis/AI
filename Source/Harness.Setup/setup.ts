// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkCopilotInstructions, copilotInstructions, copilotInstructionsDirectory, copilotMarker, type CopilotInstruction } from './copilot-instructions.ts';
import { SetupPath } from './SetupPath.ts';

type Link = { path: string; target: string; type: 'file' | 'dir' };

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');
const rootArgument = process.argv.slice(2).find(argument => !argument.startsWith('-'));
const root = resolve(rootArgument ?? join(import.meta.dirname, '..', '..'));
const corpus = join(root, '.cratis', 'ai');
if (!existsSync(corpus)) throw new Error(`No canonical corpus exists at ${corpus}.`);
const rootPath = new SetupPath(root);
const corpusPath = new SetupPath(corpus);

type GeneratedFile = CopilotInstruction;

/** Expected file names plus every path to write or prune: the generated files and any other entries in the directory. */
function plannedPaths(directory: SetupPath, files: GeneratedFile[]) {
    const expected = new Set(files.map(file => file.path.split('/').pop()));
    const paths = files.map(file => new SetupPath(join(corpus, file.path)));
    if (directory.isRealDirectory()) paths.push(...readdirSync(directory.path).filter(name => !expected.has(name)).map(name => new SetupPath(join(directory.path, name))));
    return { expected, paths };
}

function ownedCopilot(path: SetupPath): boolean {
    return !!path.state()?.isFile() && readFileSync(path.path, 'utf8').includes(copilotMarker);
}

const copilot = copilotInstructions(corpus);
const copilotDirectory = new SetupPath(join(corpus, copilotInstructionsDirectory));
copilotDirectory.requireRealParents(corpusPath, rootPath);
const copilotDirectoryConflict = copilotDirectory.directoryConflict();
const { expected: copilotNames, paths: copilotPaths } = plannedPaths(copilotDirectory, copilot);
if (check || (!force && (copilotDirectoryConflict || copilotPaths.some(path => path.state() && !ownedCopilot(path))))) {
    const stale = checkCopilotInstructions(corpus);
    if (stale.length > 0) throw new Error(`Copilot instruction adapters are out of date:\n${stale.join('\n')}`);
}

const links = new Map<string, Link>();
function add(path: string, target: string, type: Link['type']): void {
    const existing = links.get(path);
    if (existing && (existing.target !== target || existing.type !== type)) throw new Error(`Conflicting integration plan for ${path}.`);
    links.set(path, { path, target, type });
}

add('AGENTS.md', '.cratis/ai/rules/general.md', 'file');
add('CLAUDE.md', '.cratis/ai/rules/general.md', 'file');
add('.agents/skills', '../.cratis/ai/skills', 'dir');
add('.claude/CLAUDE.md', '../.cratis/ai/rules/general.md', 'file');
add('.claude/hooks', '../.cratis/ai/hooks', 'dir');
add('.claude/rules', '../.cratis/ai/rules', 'dir');
add('.claude/skills', '../.cratis/ai/skills', 'dir');
add('.github/copilot-instructions.md', '../.cratis/ai/rules/general.md', 'file');
add('.github/instructions', `../.cratis/ai/${copilotInstructionsDirectory}`, 'dir');
add('.github/skills', '../.cratis/ai/skills', 'dir');
add('.pi/extensions', '../.cratis/ai/harnesses/pi/extensions', 'dir');
add('.pi/skills', '../.cratis/ai/skills', 'dir');
add('.codex/hooks.json', '../.cratis/ai/harnesses/codex/hooks.json', 'file');
add('.cursor/rules', '../.cratis/ai/harnesses/cursor/rules', 'dir');
add('.cursor/skills', '../.cratis/ai/skills', 'dir');
add('.opencode/skills', '../.cratis/ai/skills', 'dir');

/** A link that exists but may not be replaced: foreign content, with the migration and forced-overwrite exceptions. */
function blocksLink(link: Link, path: SetupPath, migrateInstructions: boolean): boolean {
    if (!path.state() || path.ownedLink(corpusPath)) return false;
    if (link.path === '.github/instructions' && migrateInstructions) return false;
    if (link.path === '.github/copilot-instructions.md' && ownedCopilot(path)) return false;
    return !force || link.path === '.codex/hooks.json';
}

function writeGenerated(files: GeneratedFile[]): void {
    for (const file of files) {
        const path = new SetupPath(join(corpus, file.path));
        // Unlink before writing so --force cannot write through an occupied symlink.
        path.remove(force);
        writeFileSync(path.path, file.content);
    }
}

function pruneUnexpected(paths: SetupPath[], expected: Set<string | undefined>): void {
    for (const path of paths) {
        if (!expected.has(path.path.split('/').pop())) path.remove(force);
    }
}

const failures: string[] = [];
const instructionsDirectory = new SetupPath(join(root, '.github/instructions'));
instructionsDirectory.requireRealParents(rootPath, rootPath);
const instructionsState = instructionsDirectory.state();
// Migrate only an empty directory or the per-file adapters from the previous setup. Unknown
// project instructions still block adoption of a whole-directory link unless explicitly forced.
const legacyInstructions = instructionsState?.isDirectory() ? readdirSync(instructionsDirectory.path).map(name => new SetupPath(join(instructionsDirectory.path, name))) : [];
const migrateInstructions = !!instructionsState?.isDirectory() && legacyInstructions.every(path => {
    const name = path.path.split('/').pop()!;
    if (!name.endsWith('.md')) return false;
    const canonical = join(corpus, 'rules', name.replace(/\.instructions\.md$/, '.md'));
    return (path.state()?.isSymbolicLink() && resolve(dirname(path.path), readlinkSync(path.path)) === canonical) || ownedCopilot(path);
});
for (const link of links.values()) {
    const path = new SetupPath(join(root, link.path));
    path.requireRealParents(rootPath, rootPath);
    const actual = path.state()?.isSymbolicLink() ? readlinkSync(path.path) : undefined;
    if (actual === link.target) continue;
    if (check || blocksLink(link, path, migrateInstructions)) {
        failures.push(`${link.path}: expected symbolic link to ${link.target}`);
    }
}

if (failures.length > 0) throw new Error(`Harness setup is out of date:\n${failures.join('\n')}`);
if (!check) {
    if (migrateInstructions && !force) {
        for (const path of legacyInstructions) unlinkSync(path.path);
        rmdirSync(instructionsDirectory.path);
    }
    if (copilotDirectoryConflict) copilotDirectory.remove(force);
    mkdirSync(copilotDirectory.path, { recursive: true });
    pruneUnexpected(copilotPaths, copilotNames);
    writeGenerated(copilot);
    for (const link of links.values()) {
        const path = new SetupPath(join(root, link.path));
        if (path.state()?.isSymbolicLink() && readlinkSync(path.path) === link.target) continue;
        path.remove(force);
        mkdirSync(dirname(path.path), { recursive: true });
        symlinkSync(link.target, path.path, link.type);
    }
}
console.log(`${check ? 'Verified' : 'Configured'} ${links.size} harness integrations.`);
