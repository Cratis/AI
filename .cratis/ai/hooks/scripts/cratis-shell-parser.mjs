// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// A consuming, closed shell subset. This module does not execute, expand, source or consult the environment.
// Unknown grammar is a refusal, not a skipped operand. Words own typed expansions and their nested programs.
export const DYNAMIC = '\uE000'; // Reserved input, never an expansion value or a privileged reparse mode.
export const LIMITS = Object.freeze({ inputCharacters: 1_048_576, depth: 8, tokens: 8192, contexts: 64, shellDepth: 2 });

export class ShellRefusal extends Error {
    constructor(category, detail) {
        super(`${category}: ${detail}`);
        this.name = 'ShellRefusal';
        this.category = category;
        this.detail = detail;
    }
}
const refuse = (category, detail) => { throw new ShellRefusal(category, detail); };
const unsupported = () => refuse('unsupported', 'the command uses syntax outside the supported literal shell subset');
const syntax = () => refuse('syntax', 'the command has an incomplete or misplaced operator');
export const createBudget = () => ({ tokens: 0, contexts: 0, characters: 0 });
export const isDynamic = word => word.dyn === true;

const RESERVED = new Set('if then elif else fi case esac for select while until do done in function coproc repeat foreach end ! [[ ]] { }'.split(' '));
const blank = character => character === ' ' || character === '\t';
const boundary = character => character === undefined || blank(character) || '\n;&|()<>'.includes(character);
const literal = (text, quote) => ({ kind: 'literal', text, quote });

export function validateAssignment(word) {
    if (isDynamic(word)) refuse('dynamic-argument', 'an assignment value must be literal');
    if (!/^(CI=(1|0|true|false)|GIT_PAGER=(cat|true|))$/.test(word.text)) unsupported();
}

function enter(budget, depth, parent, kind) {
    if (depth > LIMITS.depth || ++budget.contexts > LIMITS.contexts) refuse('limit', 'the shared parsed-context or nesting budget was exceeded');
    return { id: budget.contexts, parent, kind, depth };
}

class Parser {
    constructor(text, budget, depth, parent) {
        this.text = text;
        this.index = 0;
        this.budget = budget;
        this.depth = depth;
        this.context = enter(budget, depth, parent, 'program');
        this.pending = [];
    }

    token() {
        if (++this.budget.tokens > LIMITS.tokens) refuse('limit', 'the shared token budget was exceeded');
    }

    spaces() {
        while (blank(this.text[this.index])) this.index++;
        while (this.text[this.index] === '\\' && this.text[this.index + 1] === '\n') {
            // The preceding byte must itself be unquoted whitespace; never normalize within a word.
            if (!blank(this.text[this.index - 1])) unsupported();
            this.index += 2;
            while (blank(this.text[this.index])) this.index++;
        }
    }

    newline() {
        this.index++;
        for (const heredoc of this.pending) {
            const start = this.index;
            for (;;) {
                const end = this.text.indexOf('\n', this.index);
                const lineEnd = end < 0 ? this.text.length : end;
                const line = this.text.slice(this.index, lineEnd);
                if (line === heredoc.delimiter) {
                    heredoc.text = this.text.slice(start, this.index);
                    this.index = end < 0 ? lineEnd : end + 1;
                    break;
                }
                if (end < 0) refuse('unterminated', 'a here-document has no exact closing delimiter');
                this.index = end + 1;
            }
            if (!heredoc.quoted && /[$`\\]/.test(heredoc.text)) unsupported();
        }
        this.pending = [];
    }

    newlines() {
        this.spaces();
        while (this.text[this.index] === '\n') { this.newline(); this.spaces(); }
    }

    list(stop, context, depth) {
        this.newlines();
        if (this.index >= this.text.length || this.text[this.index] === stop) syntax();
        const commands = [];
        for (;;) {
            this.spaces();
            if (this.index >= this.text.length) {
                if (stop) refuse('unterminated', 'a nested command has no closing parenthesis');
                syntax();
            }
            let element;
            if (this.text[this.index] === '(') {
                if (this.text[this.index + 1] === '(') unsupported();
                this.token();
                this.index++;
                const child = enter(this.budget, depth + 1, context.id, 'subshell');
                element = this.list(')', child, depth + 1);
                this.index++;
                this.spaces();
                if ('<>'.includes(this.text[this.index] ?? '\0')) unsupported();
                if (!boundary(this.text[this.index])) syntax();
            } else element = [this.simple(context, depth)];
            commands.push(...element);
            this.spaces();
            const current = this.text[this.index];
            if (current === stop && stop) break;
            if (current === undefined) {
                if (stop) refuse('unterminated', 'a nested command has no closing parenthesis');
                break;
            }
            let operator;
            if (current === '\n') { operator = '\n'; this.newline(); }
            else if (current === ';') { operator = ';'; this.index++; this.token(); }
            else if (current === '|' || current === '&') {
                if (current === '&' && this.text[this.index + 1] !== '&') unsupported();
                operator = this.text.slice(this.index, this.index + 2) === current.repeat(2) ? current.repeat(2) : current;
                this.index += operator.length;
                this.token();
            } else syntax();
            commands[commands.length - 1].next = operator;
            this.newlines();
            const finished = this.index >= this.text.length || this.text[this.index] === stop;
            if (finished) {
                if (operator === '&&' || operator === '||' || operator === '|') syntax();
                if (stop && this.index >= this.text.length) refuse('unterminated', 'a nested command has no closing parenthesis');
                break;
            }
        }
        if (this.pending.length) refuse('unterminated', 'a here-document body is missing');
        return commands;
    }

    simple(context, depth) {
        const command = { words: [], assigns: [], redirects: [], inputs: [], heredocs: [], hereStrings: [], context, next: null };
        for (;;) {
            this.spaces();
            const rest = this.text.slice(this.index);
            if (/^(?:\d+)?[<>]/.test(rest)) {
                if (!command.words.length) unsupported();
                this.redirect(command, context, depth);
                continue;
            }
            const current = this.text[this.index];
            if (current === undefined || '\n;|&)'.includes(current)) break;
            if (current === '(') unsupported();
            const word = this.word(context, depth);
            if (!command.words.length && word.assignment) {
                validateAssignment(word);
                command.assigns.push(word);
                continue;
            }
            if (!command.words.length) {
                if (isDynamic(word)) refuse('dynamic-command', 'the executable word must be literal');
                if (word.text === '' || /^[-=]/.test(word.text) || (word.bare && RESERVED.has(word.text))) unsupported();
            }
            command.words.push(word);
        }
        if (!command.words.length) {
            if (command.assigns.length) unsupported();
            syntax();
        }
        return command;
    }

    redirect(command, context, depth) {
        this.token();
        const rest = this.text.slice(this.index);
        const duplicate = /^(2>&1|1>&2|>&2)(?=$|[ \t\n;|&)])/.exec(rest);
        if (duplicate) {
            this.index += duplicate[0].length;
            command.redirects.push({ operator: '>&', descriptor: duplicate[0][0] === '>' ? '' : duplicate[0][0], targets: [] });
            return;
        }
        const match = /^(?:(0)<|(1|2)?(>>|>)|(<<?))/.exec(rest);
        if (!match) unsupported();
        const operator = match[1] ? '<' : match[3] ?? match[4];
        const descriptor = match[1] ?? match[2] ?? '';
        this.index += match[0].length;
        if (/^[<>&!|(-]/.test(this.text.slice(this.index))) unsupported();
        this.spaces();
        if (this.index >= this.text.length) syntax();
        if ('\n;&|)'.includes(this.text[this.index])) syntax();
        if ('!&|(='.includes(this.text[this.index])) unsupported();
        const start = this.index;
        const target = this.word(context, depth);
        if (isDynamic(target)) refuse('dynamic-argument', 'a redirection target must be literal');
        if (target.special || /^[!&|(=]/.test(target.text)) unsupported();
        if (/[<>(]/.test(this.text[this.index] ?? '\0')) unsupported();
        if (operator === '<<') {
            if (command.heredocs.length) unsupported();
            const spelling = this.text.slice(start, this.index);
            const delimiter = /^(?:([A-Za-z_][A-Za-z0-9_]*)|'([A-Za-z_][A-Za-z0-9_]*)'|"([A-Za-z_][A-Za-z0-9_]*)")$/.exec(spelling);
            if (!delimiter) unsupported();
            const heredoc = { delimiter: target.text, quoted: !target.bare, strip: false, text: '' };
            command.heredocs.push(heredoc);
            this.pending.push(heredoc);
        } else {
            command.redirects.push({ operator, descriptor, targets: [target] });
            if (operator === '<') command.inputs.push(target);
        }
    }

    word(context, depth) {
        this.token();
        const start = this.index;
        const segments = [];
        let bare = true;
        let special = '';
        const add = (text, quote = 'bare') => segments.push(literal(text, quote));
        const rest = this.text.slice(this.index);
        const specialMatch = /^(\{\}|\[|\])(?=$|[ \t\n;|&)<>])/.exec(rest);
        if (specialMatch) {
            special = specialMatch[1];
            add(special);
            this.index += special.length;
        } else while (!boundary(this.text[this.index])) {
            const current = this.text[this.index++];
            if ('*?[]{}~^#`'.includes(current)) unsupported();
            if (current === '=' && this.index === start + 1 && !/^=?(?:$|[ \t\n;&|()<>])/.test(this.text.slice(this.index))) unsupported();
            if (current === '!') {
                if (this.index !== start + 1 || !boundary(this.text[this.index])) unsupported();
                add(current);
            } else if (current === '$') unsupported();
            else if (current === '\\') {
                bare = false;
                const next = this.text[this.index++];
                if (next === undefined) refuse('unterminated', 'an escape has no following character');
                if (next === '\n') unsupported();
                add(next, 'escape');
            } else if (current === "'") {
                bare = false;
                const end = this.text.indexOf("'", this.index);
                if (end < 0) refuse('unterminated', 'a single-quoted word is not closed');
                add(this.text.slice(this.index, end), 'single');
                this.index = end + 1;
            } else if (current === '"') {
                bare = false;
                this.doubleQuote(segments, context, depth);
            } else add(current);
        }
        if (this.index === start) syntax();
        const text = segments.filter(segment => segment.kind === 'literal').map(segment => segment.text).join('');
        const raw = this.text.slice(start, this.index);
        const assignment = /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(raw);
        return { text, raw, bare, assignment, special, dyn: segments.some(segment => segment.kind !== 'literal'), glob: false, split: false, segments };
    }

    doubleQuote(segments, context, depth) {
        let buffer = '';
        const flush = () => { segments.push(literal(buffer, 'double')); buffer = ''; };
        while (this.index < this.text.length) {
            const current = this.text[this.index++];
            if (current === '"') { flush(); return; }
            if (current === '`') unsupported();
            if (current === '\\') {
                const next = this.text[this.index++];
                if (next === undefined) refuse('unterminated', 'a double-quoted word is not closed');
                if (next === '\n') unsupported();
                buffer += '$`"\\'.includes(next) ? next : `\\${next}`;
            } else if (current !== '$') buffer += current;
            else {
                if (this.text[this.index] === '"') { buffer += '$'; continue; }
                flush();
                if (this.text[this.index] === '(') {
                    if (this.text[this.index + 1] === '(') unsupported();
                    this.index++;
                    const child = enter(this.budget, depth + 1, context.id, 'substitution');
                    const commands = this.list(')', child, depth + 1);
                    this.index++;
                    segments.push({ kind: 'substitution', quote: 'double', commands });
                } else {
                    let name;
                    if (this.text[this.index] === '{') {
                        this.index++;
                        const match = /^[A-Za-z_][A-Za-z0-9_]*}/.exec(this.text.slice(this.index));
                        if (!match) unsupported();
                        name = match[0].slice(0, -1);
                        this.index += match[0].length;
                    } else if (this.text[this.index] === '?') { name = '?'; this.index++; }
                    else {
                        const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.index));
                        if (!match) unsupported();
                        name = match[0];
                        this.index += name.length;
                        if (/[[\]:\u0080-\uFFFF]/.test(this.text[this.index] ?? '')) unsupported();
                    }
                    segments.push({ kind: 'parameter', quote: 'double', name });
                }
            }
        }
        refuse('unterminated', 'a double-quoted word is not closed');
    }
}

export function parseProgram(text, options = {}) {
    if (typeof text !== 'string') syntax();
    if (text.length > LIMITS.inputCharacters) refuse('oversize', 'the command exceeds the input-character limit');
    if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(text)) syntax();
    if (text.includes(DYNAMIC)) unsupported();
    const budget = options.budget ?? createBudget();
    budget.characters += text.length;
    if (budget.characters > LIMITS.inputCharacters) refuse('limit', 'the shared input-character budget was exceeded');
    const parser = new Parser(text, budget, options.depth ?? 0, options.parent ?? null);
    const commands = parser.list(undefined, parser.context, options.depth ?? 0);
    if (parser.index !== text.length) syntax();
    return commands;
}

export function parseShell(text, options = {}) {
    try { return { ok: true, commands: parseProgram(text, options) }; }
    catch (error) {
        return error instanceof ShellRefusal ? { ok: false, category: error.category, detail: error.detail }
            : { ok: false, category: 'internal', detail: 'the shell parser failed unexpectedly' };
    }
}
