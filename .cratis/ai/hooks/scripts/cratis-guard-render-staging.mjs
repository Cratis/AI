#!/usr/bin/env node
// Refuses an explicit, literal `git add` of the `.cratis-render/` cache. Not a shell parser:
// it never executes or expands anything and recognises only the argv grammar documented in
// ../README.md. Usage: node cratis-guard-render-staging.mjs <cwd> < command-text
// Exit 0 = not recognised as render-cache staging, 2 = refused (reason on stderr).
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const cacheName = '.cratis-render';
const separators = new Set([';', '&', '|', '\n', '(', ')', '`']);
const wrappers = new Set(['command', 'exec', 'time', 'nohup', 'sudo', 'env', 'then', 'do', 'else', '!', '{', '$']);
const shells = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const gitValueOptions = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env']);
const maxNesting = 2;

const hasCacheComponent = path => path.split('/').includes(cacheName);

class Lexer {
    segments = [[]];
    word = null;
    quote = '';

    constructor(text) {
        this.text = text;
        this.index = 0;
    }

    run() {
        for (; this.index < this.text.length; this.index++) this.consume(this.text[this.index]);
        this.flush();
        return this.segments.filter(segment => segment.length > 0);
    }

    flush() {
        if (this.word !== null) this.segments[this.segments.length - 1].push(this.word);
        this.word = null;
    }

    append(character, expands) {
        this.word ??= { text: '', expand: false };
        this.word.text += character;
        if (expands) this.word.expand = true;
    }

    separate() {
        this.flush();
        this.segments.push([]);
    }

    consume(character) {
        if (this.quote === "'") this.singleQuoted(character);
        else if (this.quote === '"') this.doubleQuoted(character);
        else this.unquoted(character);
    }

    singleQuoted(character) {
        if (character === "'") this.quote = ''; else this.append(character, false);
    }

    doubleQuoted(character) {
        const next = this.text[this.index + 1] ?? '';
        if (character === '"') this.quote = '';
        else if (character === '\\' && '"\\$`'.includes(next)) this.append(this.text[++this.index], false);
        else this.append(character, character === '$' || character === '`');
    }

    unquoted(character) {
        if (character === "'" || character === '"') this.openQuote(character);
        else if (character === '\\') this.escape();
        else if (character === '#' && this.word === null) this.comment();
        else if (character === '\n' || !/\s/.test(character)) this.operatorOrText(character);
        else this.flush();
    }

    openQuote(character) {
        this.quote = character;
        this.word ??= { text: '', expand: false };
    }

    escape() {
        const next = this.text[++this.index] ?? '';
        if (next !== '\n') this.append(next, false);
    }

    comment() {
        while (this.index + 1 < this.text.length && this.text[this.index + 1] !== '\n') this.index++;
    }

    operatorOrText(character) {
        if (!separators.has(character)) return this.append(character, character === '$');
        if (character === '`') {
            this.flush();
            this.segments[this.segments.length - 1].push({ text: '$', expand: true });
        }
        this.separate();
    }
}

/** Splits command text into segments of {text, expand} words; quotes and escapes are removed. */
export const tokenize = commandText => new Lexer(commandText).run();

const isAssignment = text => /^[A-Za-z_][A-Za-z0-9_]*[+]?=/.test(text);

/** Index of the command word when only assignments and wrappers precede it, else -1. */
const commandIndex = words => words.findIndex(word => !isAssignment(word.text) && !wrappers.has(word.text));

/** Returns {directories, subcommand, rest} for a `git` word, or undefined. */
function parseGit(words, gitIndex) {
    const directories = [];
    let index = gitIndex + 1;
    while (index < words.length && words[index].text.startsWith('-')) {
        const option = words[index].text;
        if (option === '-C' && words[index + 1]) directories.push(words[index + 1].text);
        index += gitValueOptions.has(option) ? 2 : 1;
    }
    if (index >= words.length) return undefined;
    return { directories, subcommand: words[index].text, rest: words.slice(index + 1) };
}

/** The staging operands of a `git add|stage` word, or undefined for any other command. */
function parseStaging(words, start) {
    const git = parseGit(words, start);
    if (!git || (git.subcommand !== 'add' && git.subcommand !== 'stage')) return undefined;
    const operands = [];
    let optionsEnded = false;
    for (const word of git.rest) {
        if (!optionsEnded && word.text === '--') optionsEnded = true;
        else if (optionsEnded || !word.text.startsWith('-')) operands.push(word);
    }
    return { directories: git.directories, operands };
}

function stagingVerdict({ directories, operands }, commandText, cwd) {
    if (directories.some(hasCacheComponent) || hasCacheComponent(cwd)) {
        return { reason: 'targets a directory inside the render cache' };
    }
    if (operands.some(word => hasCacheComponent(word.text))) return { reason: 'names the render cache' };
    const unresolved = operands.some(word => word.expand) && commandText.includes(cacheName);
    return unresolved ? { reason: 'has a target this guard cannot resolve while naming the render cache' } : undefined;
}

function shellScriptVerdict(words, start, cwd, depth) {
    if (depth >= maxNesting) return undefined;
    const flag = words.findIndex((word, index) => index > start && /^-[a-z]*c[a-z]*$/.test(word.text));
    const script = flag < 0 ? undefined : words[flag + 1];
    return script ? classifyText(script.text, cwd, depth + 1) : undefined;
}

function classifySegment(words, commandText, cwd, depth) {
    const start = commandIndex(words);
    if (start < 0) return undefined;
    const program = basename(words[start].text);
    if (shells.has(program)) return shellScriptVerdict(words, start, cwd, depth);
    if (program !== 'git') return undefined;
    const staging = parseStaging(words, start);
    return staging ? stagingVerdict(staging, commandText, cwd) : undefined;
}

function classifyText(commandText, cwd, depth) {
    for (const words of tokenize(commandText)) {
        const verdict = classifySegment(words, commandText, cwd, depth);
        if (verdict) return verdict;
    }
    return undefined;
}

/** Returns undefined when the command is not recognised as render-cache staging. */
export function classify(commandText, cwd = '') {
    return classifyText(commandText, cwd, 0);
}

function main() {
    const verdict = classify(readFileSync(0, 'utf8'), process.argv[2] ?? '');
    if (!verdict) return 0;
    process.stderr.write(
        `BLOCKED by cratis-guard-shell-writes: this git add ${verdict.reason}. ` +
        `${cacheName}/ is a generated cache and is never staged; stage the intended source files by literal path.\n`
    );
    return 2;
}

const isEntryPoint = () => process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntryPoint()) {
    try {
        process.exitCode = main();
    } catch {
        process.stderr.write('BLOCKED by cratis-guard-shell-writes: render-staging classifier failed; cannot check this tool call.\n');
        process.exitCode = 2;
    }
}
