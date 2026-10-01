#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Script } from 'node:vm';

const intents = ['major', 'minor', 'patch', 'no-release'];
const commandTimeout = 15_000;
const run = (command, args, options = {}) => spawnSync(command, args, {
    encoding: 'utf8', timeout: commandTimeout, maxBuffer: 32 * 1024 * 1024, ...options,
});
const gh = args => {
    const result = run('gh', args);
    if (result.error || result.status !== 0) throw new Error(`gh ${args[0]} failed: ${result.stderr?.trim() || result.error?.message || result.status}`);
    return result.stdout;
};
const git = args => {
    const result = run('git', args);
    return result.status === 0 ? result.stdout.trim() : '';
};

// Fetch the actual inline programs, not a second implementation of the rules.
function programs(workflow) {
    const found = new Map();
    for (const match of workflow.matchAll(/^([ \t]*)node - <<'JS'\r?\n([\s\S]*?)^[ \t]*JS[ \t]*$/gm)) {
        const source = match[2].split('\n').map(line => line.startsWith(match[1]) ? line.slice(match[1].length) : line).join('\n');
        for (const name of ['release-notes', 'release-notes-drift']) {
            if (source.split('\n').some(line => line.trim() === `// cratis:program ${name}`)) found.set(name, source);
        }
    }
    if (found.size !== 2) throw new Error('the workflow does not contain both marked release-note programs');
    const bundle = '"use strict";\n' + [...found].map(([name, source]) => `if (process.argv[2] === ${JSON.stringify(name)}) {\n${source}\n}\n`).join('');
    new Script(bundle); // Invalid or truncated downloads must not replace a usable cache.
    return bundle;
}

function rules(warn) {
    const cache = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'cratis', 'release-notes');
    try {
        const workflow = gh(['api', '-H', 'Accept: application/vnd.github.raw', 'repos/Cratis/Workflows/contents/.github/workflows/verify-release-notes.yml?ref=main']);
        const bundle = programs(workflow);
        const bytes = Buffer.from(workflow);
        const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        mkdirSync(cache, { recursive: true, mode: 0o700 });
        const file = join(cache, `${sha}.cjs`);
        const temporary = `${file}.${process.pid}.tmp`;
        writeFileSync(temporary, bundle, { mode: 0o600 });
        renameSync(temporary, file);
        return file;
    } catch (error) {
        try {
            const cached = readdirSync(cache).filter(name => /^[a-f0-9]{40}\.cjs$/.test(name))
                .map(name => ({ file: join(cache, name), modified: statSync(join(cache, name)).mtimeMs }))
                .sort((a, b) => b.modified - a.modified);
            for (const { file } of cached) {
                try {
                    const source = readFileSync(file, 'utf8');
                    if (!source.includes('// cratis:program release-notes\n') || !source.includes('// cratis:program release-notes-drift\n')) continue;
                    new Script(source);
                    warn(`Could not fetch release-note rules; using cached ${file}. ${error.message}`);
                    return file;
                } catch { /* Try the next complete cache entry. */ }
            }
        } catch { /* No cache available. */ }
        warn(`unchecked: could not fetch release-note rules and nothing is cached. ${error.message}`);
        return undefined;
    }
}

function check(argv) {
    const { values } = parseArgs({ args: argv, options: {
        'body-file': { type: 'string' }, label: { type: 'string', multiple: true },
        'add-label': { type: 'string', multiple: true }, 'remove-label': { type: 'string', multiple: true },
        pr: { type: 'string' }, base: { type: 'string' }, repo: { type: 'string' }, strict: { type: 'boolean' },
    } });
    let warned = false;
    const warn = message => { warned = true; console.error(`Warning: ${message}`); };
    let pull;
    const repoArgs = values.repo ? ['--repo', values.repo] : [];
    if (values.pr !== undefined) {
        pull = JSON.parse(gh(['pr', 'view', ...(values.pr ? [values.pr] : []), ...repoArgs,
            '--json', 'labels,body,author,baseRefName']));
    }
    if (!values['body-file'] && !pull) throw new Error('--body-file is required when creating a pull request');
    const split = labels => (labels || []).flatMap(label => label.split(',')).map(label => label.trim()).filter(Boolean);
    const labels = new Set(values.label ? split(values.label) : (pull?.labels || []).map(label => label.name));
    for (const label of split(values['remove-label'])) labels.delete(label);
    for (const label of split(values['add-label'])) labels.add(label);
    const intent = intents.filter(label => labels.has(label));
    if (intent.length !== 1) throw new Error(`Exactly one release-intent label is required (major/minor/patch/no-release); found ${intent.join(', ') || 'none'}.`);
    const body = values['body-file'] ? readFileSync(resolve(values['body-file']), 'utf8') : pull.body || '';
    let repository = values.repo;
    let defaultBranch = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '') || 'main';
    try {
        const metadata = JSON.parse(gh(['repo', 'view', ...(repository ? [repository] : []), '--json', 'nameWithOwner,defaultBranchRef']));
        repository = metadata.nameWithOwner;
        defaultBranch = metadata.defaultBranchRef?.name || defaultBranch;
    } catch {
        repository ||= git(['remote', 'get-url', 'origin']).replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '') || 'Cratis/<Repository>';
    }
    let author = pull?.author?.login;
    if (!author) {
        try { author = gh(['api', 'user', '--jq', '.login']).trim(); } catch { author = ''; }
    }
    const base = values.base || pull?.baseRefName || defaultBranch;
    const file = rules(warn);
    if (!file) return 3;
    const env = { ...process.env, PR_BODY: body, PR_LABELS: JSON.stringify(intent[0] === 'no-release' ? ['patch'] : [...labels]),
        PR_AUTHOR: author, PR_BASE: base, DEFAULT_BRANCH: defaultBranch, GITHUB_REPOSITORY: repository,
        BASE: base, REPOSITORY: repository, PR_JSON: '', GH_TOKEN: '', NUMBER: '', GITHUB_STEP_SUMMARY: '', BEFORE: '', ACTION: '' };
    for (const program of ['release-notes', 'release-notes-drift']) {
        const result = run(process.execPath, [file, program], { env, timeout: 60_000 });
        (process.argv[2] === '--hook' ? process.stderr : process.stdout).write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        if (result.error || result.status !== 0) return 1;
        if (/::warning\b|::notice title=Release notes (?:drift )?not checked/.test(result.stdout)) warned = true;
    }
    return values.strict && warned ? 1 : 0;
}

// A deliberately bounded shell-text guard, not a shell interpreter. Quotes and escaped spaces are
// preserved; separators are recognized only outside quotes. Variables, aliases and script files
// are outside this guard's scope. Dynamic values of guarded options fail closed.
function commands(text) {
    const result = [];
    let words = [], word = '', started = false, quote = '';
    const endWord = () => { if (started) words.push(word); word = ''; started = false; };
    const endCommand = () => { endWord(); if (words.length) result.push(words); words = []; };
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '\\' && quote !== "'") {
            const next = text[++index];
            if (next && next !== '\n') { word += next; started = true; }
        } else if (quote) {
            if (char === quote) quote = ''; else word += char;
        } else if (char === '"' || char === "'") { quote = char; started = true;
        } else if (/[;&|\n]/.test(char)) endCommand();
        else if (/\s/.test(char)) endWord();
        else { word += char; started = true; }
    }
    if (quote) throw new Error('Unclosed quote in pull-request command; use a simple gh command with --body-file.');
    endCommand();
    return result;
}

function hook() {
    let payload;
    try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { return 0; }
    const text = payload?.tool_input?.command;
    if (typeof text !== 'string' || !/(^|[;&|\n]\s*)(rtk\s+)?gh\s+pr\s+(create|edit)\b/.test(text.trim())) return 0;
    // Match each simple command, never the same text inside an echo/grep argument.
    let cwd = payload.cwd || process.cwd();
    for (const words of commands(text)) {
        if (words[0] === 'cd') {
            const directory = words[1] === '--' ? words[2] : words[1];
            if (!directory || /[$`~]/.test(directory)) throw new Error('Use a literal directory before gh pr create/edit.');
            cwd = resolve(cwd, directory);
            continue;
        }
        if (words[0] === 'rtk') words.shift();
        if (words[0] !== 'gh' || words[1] !== 'pr' || !['create', 'edit'].includes(words[2])) continue;
        if (words.includes('--help') || words.includes('-h')) continue;
        const args = [];
        let target = '', hasBody = false;
        for (let index = 3; index < words.length; index++) {
            const compact = /^(-[FlBR])(.+)$/.exec(words[index]);
            const [option, ...attached] = compact ? [compact[1], compact[2]] : words[index].split('=');
            if (option === '--body' || option === '-b' || /^-b./.test(option)) {
                throw new Error('write the body to `.ai-work/pr-body.md` and use `--body-file`; inline --body/-b is blocked.');
            }
            const mapped = { '--body-file': '--body-file', '-F': '--body-file', '--label': '--label', '-l': '--label',
                '--add-label': '--add-label', '--remove-label': '--remove-label', '--base': '--base', '-B': '--base', '--repo': '--repo', '-R': '--repo' }[option];
            if (mapped) {
                const value = attached.length ? attached.join('=') : words[++index];
                if (!value || /[$`]/.test(value) || value === '-') throw new Error(`Use a literal value for ${option}, not stdin or a shell expansion.`);
                args.push(mapped, value);
                if (mapped === '--body-file') hasBody = true;
            } else if (!option.startsWith('-') && words[2] === 'edit' && !target) {
                target = option;
            } else if (['--title', '-t', '--assignee', '-a', '--reviewer', '-r', '--milestone', '-m', '--project', '-p'].includes(option) && !attached.length) index++;
        }
        if (words[2] === 'create' && !hasBody) throw new Error('write the body to `.ai-work/pr-body.md` and use `--body-file` when creating a pull request.');
        if (words[2] === 'edit') args.push('--pr', target);
        process.chdir(cwd);
        const code = check(args);
        if (code !== 0 && code !== 3) throw new Error('The pull-request body or release intent failed cratis-check-pr. Fix the reported violations before retrying.');
    }
    return 0;
}

try {
    process.exitCode = process.argv[2] === '--hook' ? hook() : check(process.argv.slice(2));
} catch (error) {
    console.error(`${process.argv[2] === '--hook' ? 'BLOCKED by cratis-guard-pr-body: ' : ''}${error.message}`);
    process.exitCode = process.argv[2] === '--hook' ? 2 : 1;
}
