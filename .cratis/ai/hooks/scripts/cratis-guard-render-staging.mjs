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
const shells = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
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
        const result = this.segments.filter(segment => segment.length > 0);
        result.unbalanced = this.quote !== '';
        return result;
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

const isGit = text => basename(text) === 'git';
const isStaging = text => text === 'add' || text === 'stage';

/** The first `-c`-style flag of a shell word and the script after it, anywhere in the segment. */
function shellScript(words) {
    const shell = words.findIndex(word => shells.has(basename(word.text)));
    if (shell < 0) return undefined;
    const flag = words.findIndex((word, index) => index > shell && /^-[a-z]*c[a-z]*$/.test(word.text));
    return flag < 0 ? undefined : words[flag + 1]?.text;
}

/**
 * Wrappers, assignments and option values before `git` are irrelevant: a simple command is refused when a
 * `git` word is later followed by add/stage and then any word naming the cache. Whatever follows is checked
 * as a whole, so `git -C dir add x` and `git add -- .cratis-render` are covered.
 */
function stagingVerdict(words, commandText, cwd) {
    const git = words.findIndex(word => isGit(word.text));
    if (git < 0) return undefined;
    const staging = words.findIndex((word, index) => index > git && isStaging(word.text));
    if (staging < 0) return undefined;
    if (words.slice(git + 1).some(word => hasCacheComponent(word.text))) return { reason: 'names the render cache' };
    if (hasCacheComponent(cwd)) return { reason: 'targets a directory inside the render cache' };
    const unresolved = words.slice(staging + 1).some(word => word.expand) && commandText.includes(cacheName);
    return unresolved ? { reason: 'has a target this guard cannot resolve while naming the render cache' } : undefined;
}

function classifyText(commandText, cwd, depth) {
    const segments = tokenize(commandText);
    if (segments.unbalanced) return { reason: 'has unbalanced quotes, so this guard cannot parse it' };
    for (const words of segments) {
        const verdict = stagingVerdict(words, commandText, cwd);
        if (verdict) return verdict;
        const script = depth < maxNesting ? shellScript(words) : undefined;
        const nested = script === undefined ? undefined : classifyText(script, cwd, depth + 1);
        if (nested) return nested;
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

function isEntryPoint() {
    try {
        return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
    } catch {
        return false;
    }
}

if (isEntryPoint()) {
    try {
        process.exitCode = main();
    } catch {
        process.stderr.write('BLOCKED by cratis-guard-shell-writes: render-staging classifier failed; cannot check this tool call.\n');
        process.exitCode = 2;
    }
}
