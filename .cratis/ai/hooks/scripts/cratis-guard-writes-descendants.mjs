// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as filesystem from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function nameMatcher(patterns) {
    const expressions = patterns.map(pattern => new RegExp(`^${pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i'));
    return name => expressions.some(expression => expression.test(name));
}

function unchanged(before, after) {
    return ['dev', 'ino', 'mtimeMs', 'ctimeMs'].every(field => before[field] === after[field]);
}

function unlinkedDirectory(metadata) {
    return metadata.isDirectory() && !metadata.isSymbolicLink();
}

function existingDirectory(path, fs) {
    try { return fs.statSync(path).isDirectory(); }
    catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
        throw error;
    }
}

function inventoryBudget(now, maxEntries, maxMs) {
    const started = now();
    let entries = 0;
    return (additional = 0) => {
        entries += additional;
        if (entries > maxEntries || now() - started > maxMs) throw new Error('inventory limit');
    };
}

function inspectEntry(directory, name, context, stack) {
    context.budget(1);
    if (context.matches(name)) return 1;
    const path = join(directory, name);
    if (unlinkedDirectory(context.fs.lstatSync(path))) stack.push({ path });
    return 0;
}

function inspectDirectory(path, context, stack) {
    const before = context.fs.lstatSync(path);
    if (!unlinkedDirectory(before)) throw new Error('directory changed');
    stack.push({ path, before });
    for (const name of context.fs.readdirSync(path)) {
        if (inspectEntry(path, name, context, stack)) return 1;
    }
    return 0;
}

function inspectFrame(frame, context, stack) {
    if (frame.before) {
        if (!unchanged(frame.before, context.fs.lstatSync(frame.path))) throw new Error('directory changed');
        return 0;
    }
    if (context.visited.has(frame.path)) return 0;
    context.visited.add(frame.path);
    return inspectDirectory(frame.path, context, stack);
}

function walk(root, context) {
    const stack = [{ path: root }];
    while (stack.length) {
        context.budget();
        if (inspectFrame(stack.pop(), context, stack)) return 1;
    }
    return 0;
}

function inspectOperand(operand, context) {
    context.budget();
    if (!existingDirectory(operand, context.fs)) return 0;
    const root = context.fs.realpathSync(operand);
    if (walk(root, context)) return 1;
    if (context.fs.realpathSync(operand) !== root) throw new Error('operand changed');
    return 0;
}

// Injection is for deterministic specs only; the CLI always uses the fixed production limits.
// No file contents, input evaluation, or nested symlink traversal are involved.
export function inspectDescendants(paths, patterns, { fs = filesystem, now = () => performance.now(), maxEntries = 250000, maxMs = 5000 } = {}) {
    const context = { fs, visited: new Set(), matches: nameMatcher(patterns), budget: inventoryBudget(now, maxEntries, maxMs) };
    try {
        for (const operand of paths) {
            if (inspectOperand(operand, context)) return 1;
        }
        context.budget();
        return 0;
    } catch { return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [countText, ...values] = process.argv.slice(2);
    const count = Number(countText);
    process.exitCode = Number.isInteger(count) && count > 0 && count <= values.length
        ? inspectDescendants(values.slice(count), values.slice(0, count)) : 2;
}
