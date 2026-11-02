// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Text fixtures only: no submitted program is executed by these specs.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { restrictedRows, scriptsDirectory, supportedGrammarRows } from './guard-security.fixture.ts';

interface Segment { kind: 'literal' | 'parameter' | 'substitution'; quote: string; text?: string; name?: string; commands?: Command[] }
interface Word { text: string; raw: string; dyn: boolean; bare: boolean; assignment: boolean; segments: Segment[] }
interface Context { id: number; parent: number | null; kind: string }
interface Command {
    words: Word[]; assigns: Word[]; context: Context; next: string | null;
    redirects: Array<{ operator: string; descriptor: string; targets: Word[] }>;
    inputs: Word[]; heredocs: Array<{ delimiter: string; quoted: boolean; text: string }>; hereStrings: Word[];
}
type Parsed = { ok: true; commands: Command[] } | { ok: false; category: string; detail: string };
interface ParserModule {
    DYNAMIC: string;
    LIMITS: { inputCharacters: number; depth: number; tokens: number; contexts: number; shellDepth: number };
    parseShell(text: string, options?: Record<string, unknown>): Parsed;
}
const parser = await import(pathToFileURL(join(scriptsDirectory, 'cratis-shell-parser.mjs')).href) as ParserModule;

function parse(text: string): Command[] {
    const result = parser.parseShell(text);
    assert.ok(result.ok, `${JSON.stringify(text)}: ${result.ok ? '' : result.category}`);
    assert.ok(result.commands.length > 0, 'success cannot discard every command');
    return result.commands;
}
function refused(text: string, category?: string): void {
    const result = parser.parseShell(text);
    assert.equal(result.ok, false, JSON.stringify(text));
    assert.ok(!('commands' in result), 'no partial parse may escape a refusal');
    if (!result.ok && category) assert.equal(result.category, category, JSON.stringify(text));
}

test('supported neighbors consume the whole program and keep owning words and contexts', () => {
    for (const source of [...supportedGrammarRows, ...restrictedRows.map(row => row.neighbor)]) {
        for (const command of parse(source)) {
            assert.ok(command.words.length > 0);
            assert.ok(command.context.id > 0);
            for (const word of command.words) assert.ok(word.segments.length > 0);
        }
    }
});

test('all grammar refusal rows fail in the parser, before any effect exemption', () => {
    for (const row of restrictedRows.filter(row => row.parserRefusal)) refused(row.command, row.category);
});

test('literal concatenation and quote-correct escapes do not change executable identity', () => {
    assert.deepEqual(parse('ku"bec"tl get sec\\rets')[0].words.map(word => word.text), ['kubectl', 'get', 'secrets']);
    assert.deepEqual(parse("kube''ctl 'get' \"pods\"")[0].words.map(word => word.text), ['kubectl', 'get', 'pods']);
    assert.deepEqual(parse('echo "\\q" "\\$HOME"')[0].words.slice(1).map(word => word.text), ['\\q', '$HOME']);
    assert.equal(parse("echo 'a\\\nb'")[0].words[1].text, 'a\\\nb');
    refused('echo a\\\nb', 'unsupported');
});

test('literal test operators and keyword-spelled arguments remain data, never executable exemptions', () => {
    assert.equal(parse('[ "$A" = "$B" ]')[0].words[2].text, '=');
    assert.equal(parse('test a == b')[0].words[2].text, '==');
    assert.equal(parse('echo done')[0].words[1].text, 'done');
    for (const source of ['=cmd', 'echo =cmd', 'done', 'if true; then echo ok; fi']) refused(source, 'unsupported');
});

test('substitution programs belong to their word and remain dynamic, including literal heredoc output', () => {
    const [outer] = parse('echo "prefix $(echo \"$(date)\") suffix"');
    const segment = outer.words[1].segments.find(entry => entry.kind === 'substitution');
    assert.ok(segment?.commands);
    assert.equal(segment.commands[0].words[0].text, 'echo');
    assert.equal(segment.commands[0].context.parent, outer.context.id);
    assert.equal(outer.words[1].text, 'prefix  suffix', 'only literal fragments belong to text');
    assert.ok(outer.words[1].dyn);
    const [commit] = parse("git commit -m \"$(cat <<'EOF'\nmessage\nEOF\n)\"");
    assert.ok(commit.words[3].dyn, 'no special literal-value fiction for cat heredocs');
    assert.equal(commit.words[3].segments.find(segment => segment.kind === 'substitution')?.commands?.[0].heredocs[0].text, 'message\n');
});

test('lists, pipelines and subshells retain explicit context and operator information', () => {
    const commands = parse('(echo one; echo two) | cat && echo done');
    assert.deepEqual(commands.map(command => command.words[0].text), ['echo', 'echo', 'cat', 'echo']);
    assert.equal(commands[0].context.kind, 'subshell');
    assert.equal(commands[0].context.id, commands[1].context.id);
    assert.notEqual(commands[1].context.id, commands[2].context.id);
    assert.equal(commands[0].next, ';');
    assert.equal(commands[1].next, '|');
    assert.equal(commands[2].next, '&&');
});

test('redirection and assignment adapters preserve literal operands without adding them to argv', () => {
    const [command] = parse('CI=true cat < README.md 2>&1 >> out');
    assert.deepEqual(command.words.map(word => word.text), ['cat']);
    assert.deepEqual(command.assigns.map(word => word.text), ['CI=true']);
    assert.deepEqual(command.inputs.map(word => word.text), ['README.md']);
    assert.deepEqual(command.redirects.map(redirect => redirect.operator), ['<', '>&', '>>']);
    refused('CI="$HOME" cat', 'dynamic-argument');
});

test('heredoc bodies are exact data; missing terminators and expanding bodies refuse', () => {
    assert.equal(parse("cat <<'EOF'\n$(printenv)\\\nEOF\n")[0].heredocs[0].text, '$(printenv)\\\n');
    assert.equal(parse('cat <<EOF\nplain\nEOF')[0].heredocs[0].text, 'plain\n');
    refused('cat <<EOF\nbody', 'unterminated');
    refused('cat <<EOF\n$HOME\nEOF', 'unsupported');
    refused("cat <<'A' <<'B'\nx\nA\ny\nB", 'unsupported');
});

test('unsupported grammar and malformed operators never yield an empty success', () => {
    for (const source of ['case x in x) ls;; esac', 'f() { ls; }', 'function f { ls; }', 'coproc ls',
        'select x in a; do ls; done', 'a=(1 2)', '((1+2))', 'echo ${X@P}', 'echo ${X:-$(ls)}', '=env',
        'echo [[ x ]]', '! env']) refused(source, 'unsupported');
    for (const source of ['echo &&', 'echo |', 'echo || ; cat', 'echo ;; cat', 'echo )', 'echo >', '()', '(echo) cat']) refused(source, 'syntax');
    for (const source of ['echo "open', "echo 'open", 'echo "$(echo', '(echo']) refused(source, 'unterminated');
});

test('controls and private markers are refused everywhere, including inert words and heredocs', () => {
    for (const character of ['\u0000', '\r', '\u007f', parser.DYNAMIC]) {
        refused(`echo '${character}'`);
        refused(`cat <<'EOF'\n${character}\nEOF\n`);
    }
    const result = parser.parseShell(`echo ${parser.DYNAMIC}`, { allowDynamic: true });
    assert.equal(result.ok, false, 'there is no privileged marker-reparse mode');
});

test('shared limits refuse atomically instead of truncating nested programs', () => {
    refused('x'.repeat(parser.LIMITS.inputCharacters + 1), 'oversize');
    refused('echo ' + 'x '.repeat(parser.LIMITS.tokens), 'limit');
    const nested = (depth: number): string => depth ? `echo "$( ${nested(depth - 1)} )"` : 'echo ok';
    assert.ok(parse(nested(3)).length > 0);
    refused(nested(parser.LIMITS.depth + 1), 'limit');
    refused(`echo ${Array.from({ length: parser.LIMITS.contexts }, () => '"$(date)"').join(' ')}`, 'limit');
    assert.equal(parser.LIMITS.depth, 8);
    assert.equal(parser.LIMITS.shellDepth, 2);
});

test('invalid API input returns a refusal, never an exception or partial commands', () => {
    const result = parser.parseShell(undefined as unknown as string);
    assert.equal(result.ok, false);
});
