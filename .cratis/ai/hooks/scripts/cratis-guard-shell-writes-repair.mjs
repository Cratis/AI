// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Admission only: a refusal falls back to the unchanged whole-command reference guard.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const managedFolders = ['.pi', '.claude', '.cursor', '.opencode', '.github'];

function literalWords(command) {
    // No shell operators, expansions, escapes, comments, globs or multiline constructs, even in quotes.
    if (/[\x00-\x1f\x7f$`\\;|&<>(){}*?!#~\[\]]/.test(command)) return [];
    // Require whitespace between whole words: do not interpret concatenated quote fragments.
    if (!/^ *(?:(?:'[^']*'|"[^"]*"|[^\s'"]+)(?: +|$))*$/.test(command)) return [];
    return command.match(/'[^']*'|"[^"]*"|[^\s'"]+/g) ?? [];
}

function unquote(word) {
    return /^["']/.test(word) ? word.slice(1, -1) : word;
}

function inside(path, directory) {
    const suffix = relative(directory, path);
    if (isAbsolute(suffix)) return false;
    return !['', '..'].includes(suffix.split(sep)[0]);
}

function physicalPath(path) {
    // Walk components first: realpathSync normalizes '..' before following a preceding symlink.
    // Missing suffixes stay lexical, but existing ancestors are resolved before the next component.
    let physical = sep;
    for (const component of path.split(sep).filter(Boolean)) {
        const candidate = resolve(physical, component);
        physical = existingTarget(candidate) ? realpathSync(candidate) : candidate;
    }
    return physical;
}

function existingTarget(path) {
    return existsSync(path) || lstatIfPresent(path)?.isSymbolicLink();
}

function lstatIfPresent(path) {
    try { return lstatSync(path); }
    catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    }
}

function managedEntry(root, link) {
    const manifest = resolve(root, '.cratis/ai.manifest.json');
    if (!existsSync(manifest)) return true; // Bootstrap: only a folder + corpus-target link is admitted.
    const { Integrations } = JSON.parse(readFileSync(manifest, 'utf8'));
    return Array.isArray(Integrations) && Integrations.some(entry =>
        entry?.Path === relative(root, link) && typeof entry.Target === 'string');
}

function linkOperands(words) {
    if (words.length !== 4) return undefined;
    if (!/^ln -(?:s|sf|sfn)$/.test(words.slice(0, 2).join(' '))) return undefined;
    const [target, name] = words.slice(2).map(unquote);
    if ([target, name].some(operand => !operand || operand.startsWith('-'))) return undefined;
    if (unsafeLinkName(name)) return undefined;
    return { target, name, flag: words[1] };
}

function unsafeLinkName(name) {
    // A trailing slash or '/.' forces directory traversal even with ln -n.
    return name.endsWith('/') || basename(name) === '.' || name.split('/').includes('..');
}

function parentInFolder(root, link, folder) {
    const parent = physicalPath(dirname(link));
    const managedFolder = resolve(realpathSync(root), folder);
    return parent === managedFolder || inside(parent, managedFolder);
}

function corpusTarget(root, link, target) {
    const addressed = isAbsolute(target) ? target : `${dirname(link)}/${target}`;
    if (!inside(resolve(addressed), resolve(root, '.cratis/ai'))) return false;
    return inside(physicalPath(addressed), resolve(realpathSync(root), '.cratis/ai'));
}

function replaceableDestination(link, flag) {
    const existing = lstatIfPresent(link);
    if (existing?.isDirectory()) return false;
    if (!existing?.isSymbolicLink()) return true;
    if (!existsSync(link)) return true;
    // Without -n, ln follows a destination symlink to a directory and writes inside its target.
    return !statSync(link).isDirectory() || flag === '-sfn';
}

function repairLink(cwd, words) {
    const operands = linkOperands(words);
    if (!operands) return false;
    const repository = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const root = realpathSync(repository);
    const { target, name, flag } = operands;
    // Git reports the physical root on macOS; align the cwd alias without resolving the link itself.
    const link = resolve(realpathSync(cwd), name);
    const folder = managedFolders.find(folder => inside(link, resolve(root, folder)));
    if (!folder) return false;
    if (!managedEntry(root, link)) return false;
    if (!parentInFolder(root, link, folder)) return false;
    if (!corpusTarget(root, link, target)) return false;
    return replaceableDestination(link, flag);
}

function admitted(cwd, command) {
    const words = literalWords(command);
    if (['cratis ai init', 'cratis ai update', 'cratis ai restore'].includes(words.slice(0, 3).join(' '))) return true;
    return repairLink(cwd, words);
}

try { process.exitCode = admitted(process.argv[2], process.argv[3]) ? 0 : 1; }
catch { process.exitCode = 1; } // Missing/invalid manifest or unresolved paths never grant an exception.
