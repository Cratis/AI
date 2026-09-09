#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Local legacy adapters only; not a distribution publisher or cross-repository synchronizer.
// Usage: node tooling/pi-agent-adapters.mjs --repo /absolute/checkout --write|--check
// First generation adopts only existing, exact .ai/agents symlinks. Subsequent
// generations use .pi/agents/.generated.json; hand-edited outputs refuse to write.
// Schema verified against Pi 0.85.1 / @tintinweb/pi-subagents 0.19.0 custom-agents.ts.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const writers = new Set(['backend-developer', 'frontend-developer', 'spec-writer', 'slice-implementer']);
const planners = new Set(['orchestrator', 'coordinator', 'planner']);
const readers = new Set(['code-reviewer', 'security-reviewer', 'performance-reviewer', 'repository-investigator', 'repository-investigation-reviewer']);
const foreignTools = new Set(['githubRepo', 'codeSearch', 'usages', 'rename', 'terminalLastCommand', 'Read', 'Glob', 'Grep', 'Bash']);
const keys = new Set(['name', 'description', 'model', 'tools']);
export const digest = text => createHash('sha256').update(text).digest('hex');
const fail = message => { throw new Error(message); };

/** Deliberately accept only the observed legacy schema, never silently discard YAML. */
export function parseCanonical(text) {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    if (!match) fail('Unsupported frontmatter fences or line endings');
    const fields = {};
    const lines = match[1].split('\n');
    for (let index = 0; index < lines.length; index++) {
        const line = /^([a-z_]+):(?: (.*))?$/.exec(lines[index]);
        if (!line || !keys.has(line[1]) || Object.hasOwn(fields, line[1])) fail(`Unsupported or duplicate metadata: ${lines[index]}`);
        const [, key, raw = ''] = line;
        const continuation = [];
        while (index + 1 < lines.length && /^ +\S/.test(lines[index + 1])) continuation.push(lines[++index]);
        if (key === 'tools') {
            if (raw && continuation.length) fail('Mixed tool syntax');
            let tools;
            if (!raw) {
                if (continuation.some(value => !/^ +- [A-Za-z]+$/.test(value))) fail('Unsupported tool list');
                tools = continuation.map(value => value.trim().slice(2));
            } else {
                if (!/^\[[A-Za-z, ]+\]$/.test(raw)) fail('Unsupported inline tool list');
                tools = raw.slice(1, -1).split(',').map(value => value.trim());
            }
            if (!tools.length || tools.some(tool => !foreignTools.has(tool)) || new Set(tools).size !== tools.length) fail('Unsupported tools');
            fields.tools = tools;
        } else if (key === 'description' && raw === '>') {
            if (!continuation.length || continuation.some(value => /^ +[-!&*{}[\]|>]/.test(value))) fail('Unsupported folded description');
            fields.description = continuation.map(value => value.trim()).join(' ');
        } else {
            if (continuation.length || !/^[A-Za-z0-9][A-Za-z0-9 ._\/-]*$/.test(raw)) fail(`Unsupported scalar: ${key}`);
            fields[key] = raw;
        }
    }
    if ([...keys].some(key => !fields[key])) fail('Missing canonical metadata');
    if (!match[2].trim()) fail('Empty instructions');
    return { fields, body: match[2] };
}

/** Rebase real Markdown destinations, not relative imports in instructional code. */
export function rebaseLinks(body) {
    return body.replace(/(\]\()(\.\.?\/[^\s)]+)(\))/g, (_, open, target, close) => {
        const sourcePath = resolve('/repo/.ai/agents', target);
        if (!sourcePath.startsWith('/repo/')) fail(`Link escapes repository: ${target}`);
        return `${open}${relative('/repo/.pi/agents', sourcePath)}${close}`;
    });
}

export function renderAdapter(filename, canonical) {
    const name = basename(filename, '.md');
    if (!writers.has(name) && !planners.has(name) && !readers.has(name)) fail(`Unreviewed agent role: ${name}`);
    const { fields, body } = parseCanonical(canonical);
    // Preserve the canonical evidence reviewer's explicit no-command contract.
    const tools = name === 'repository-investigation-reviewer' ? ['read', 'grep', 'find', 'ls'] : ['read', 'bash', 'grep', 'find', 'ls'];
    if (writers.has(name)) tools.push('edit', 'write');
    const role = writers.has(name)
        ? 'Implement only the assigned scope. Do not delegate or start other model/Pi sessions. Read a specifically required local skill file on demand; skills: false disables inherited discovery, not those explicit instructions.'
        : 'Read-only role: report findings or plans; do not edit files, rename symbols, or change repository, remote, package, or runtime state. Bash, when granted, is for non-mutating inspection only; no shell writes, builds with generated output, or model/Pi sessions. Request reproduction from the parent when it would mutate state.';
    const delegation = planners.has(name)
        ? '\nThis Pi adapter returns the complete plan to the parent for execution. Every delegation, phase execution, progress-tracking, and session-management instruction below describes the parent\'s proposed work, not actions this agent can perform. Recommend one implementer for ordinary tasks; management hierarchies require an explicitly requested large, independent scope. Do not claim that planned work or gates ran.'
        : '\nNo nested delegation is enabled. If a required capability is unavailable, return the exact bounded request to the parent rather than pretending it ran.';
    const description = planners.has(name)
        ? `Plan-only support for explicitly requested large independent scope; return assignments to the parent, with no execution or delegation. Ordinary work needs one implementer. Canonical role: ${fields.description}`
        : fields.description;
    const policy = `\n<!-- Generated by Cratis/AI tooling/pi-agent-adapters.mjs from .ai/agents/${filename}; edit the canonical file, then regenerate. -->\n\n## Pi host execution contract\n\n${role}${delegation}\nOnly the tools listed in this frontmatter are available. Foreign host tool names below are not Pi tool grants. Semantic navigation is optional when actually available; otherwise use bounded source search and disclose its limits. Interpret repository-root paths from the checkout and Markdown links relative to this adapter. Resource isolation is not a filesystem sandbox.\n\n`;
    return `---\nname: ${name}\ndisplay_name: ${JSON.stringify(fields.name)}\ndescription: ${JSON.stringify(description)}\nmodel: ${JSON.stringify(fields.model)}\ntools: ${tools.join(', ')}\nextensions: false\nskills: false\nisolated: true\nallowed_subagents: false\n---\n${policy}${rebaseLinks(body)}`;
}

function plainDirectory(path) {
    if (!existsSync(path) || !lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) fail(`Expected real directory: ${path}`);
}

/** Plan and validate everything before writing; scope never discovers sibling repos. */
export function planAdapters(repo) {
    if (!isAbsolute(repo) || basename(repo) === 'AI.Distribution' || !existsSync(repo) || realpathSync(repo) !== repo) fail('Unsupported repository root');
    if (!existsSync(join(repo, '.git'))) fail('Expected checkout root');
    for (const path of ['.ai', '.ai/agents', '.pi', '.pi/agents']) plainDirectory(join(repo, path));
    const directory = join(repo, '.pi/agents');
    const manifestPath = join(directory, '.generated.json');
    let previous;
    if (existsSync(manifestPath)) {
        if (!lstatSync(manifestPath).isFile() || lstatSync(manifestPath).isSymbolicLink()) fail('Manifest must be a regular file');
        previous = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (previous.version !== 1 || Object.keys(previous).sort().join(',') !== 'outputs,version' || !previous.outputs || Array.isArray(previous.outputs)) fail('Unsupported generation manifest');
    }
    const files = readdirSync(directory).filter(name => name.endsWith('.md')).sort();
    if (!files.length) fail('No existing local adapters; installation is not implicit');
    if (previous && JSON.stringify(Object.keys(previous.outputs).sort()) !== JSON.stringify(files)) fail('Adapter set drift; review additions/removals explicitly');
    const outputs = {};
    const changes = [];
    for (const filename of files) {
        if (!/^[a-z]+(?:-[a-z]+)*\.md$/.test(filename)) fail(`Unsupported filename: ${filename}`);
        const source = join(repo, '.ai/agents', filename);
        const destination = join(directory, filename);
        if (!existsSync(source) || !lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) fail(`Missing or nonlocal canonical source: ${source}`);
        const stat = lstatSync(destination);
        let before;
        if (stat.isSymbolicLink()) {
            const target = readlinkSync(destination);
            if (previous || target !== `../../.ai/agents/${filename}`) fail(`Unexpected adapter symlink: ${destination}`);
            before = { symlink: target };
        } else {
            if (!stat.isFile() || !previous) fail(`Refusing unmanaged adapter: ${destination}`);
            const content = readFileSync(destination, 'utf8');
            if (previous.outputs[filename] !== digest(content)) fail(`Generated adapter drift: ${destination}`);
            before = { content };
        }
        const sourceContent = readFileSync(source, 'utf8');
        const content = renderAdapter(filename, sourceContent);
        // File destinations only; anchors and external URLs require no network.
        for (const match of content.matchAll(/\]\((\.\.?\/[^\s)]+)\)/g)) {
            const target = match[1].split('#')[0];
            if (!existsSync(resolve(directory, target))) fail(`Broken relative link in ${filename}: ${target}`);
        }
        outputs[filename] = digest(content);
        if (before.content !== content) changes.push({ path: `.pi/agents/${filename}`, before, content, source, sourceDigest: digest(sourceContent) });
    }
    const manifest = `${JSON.stringify({ version: 1, outputs }, null, 2)}\n`;
    const oldManifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
    if (oldManifest !== manifest) changes.push({ path: '.pi/agents/.generated.json', before: oldManifest === null ? { absent: true } : { content: oldManifest }, content: manifest });
    return changes;
}

/** Keep recoverable pre-state locally before replacing only owned adapter files. */
export function generate(repo, check = true) {
    const changes = planAdapters(repo);
    if (check && changes.length) fail(`${repo}: ${changes.length} adapter files need regeneration`);
    if (check || !changes.length) return changes.length;
    const backup = join(repo, '.ai-work/rule-cleanup', `pi-adapters-${randomUUID()}`);
    mkdirSync(backup, { recursive: true });
    writeFileSync(join(backup, 'manifest.json'), `${JSON.stringify({ repo, changes }, null, 2)}\n`, { flag: 'wx' });
    for (const change of changes) {
        const path = join(repo, change.path);
        if (change.source && digest(readFileSync(change.source, 'utf8')) !== change.sourceDigest) fail(`Canonical drift: ${change.source}`);
        if (change.before.symlink) {
            if (!lstatSync(path).isSymbolicLink() || readlinkSync(path) !== change.before.symlink) fail(`Symlink drift: ${path}`);
            unlinkSync(path);
        } else if (change.before.absent) {
            if (existsSync(path)) fail(`New file drift: ${path}`);
        } else if (lstatSync(path).isSymbolicLink() || readFileSync(path, 'utf8') !== change.before.content) fail(`Output drift: ${path}`);
        writeFileSync(path, change.content, { flag: change.before.symlink || change.before.absent ? 'wx' : 'w' });
    }
    return changes.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length !== 3 || args[0] !== '--repo' || !['--check', '--write'].includes(args[2])) {
        console.error('Usage: node tooling/pi-agent-adapters.mjs --repo /absolute/checkout --check|--write');
        process.exitCode = 1;
    } else {
        try { console.log(`${args[1]}: ${generate(args[1], args[2] === '--check')} changed files (${args[2]})`); }
        catch (error) { console.error(error.message); process.exitCode = 1; }
    }
}
