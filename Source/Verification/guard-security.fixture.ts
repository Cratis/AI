// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Shared fixtures for the fail-closed guard specs. Commands are only ever sent to the guards on stdin as text; no
 * fixture executes one, and none reads a credential.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

export const repositoryRoot = resolve(import.meta.dirname, '..', '..');
export const scriptsDirectory = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts');
export const secretsGuard = join(scriptsDirectory, 'cratis-guard-secrets.sh');
export const writesGuard = join(scriptsDirectory, 'cratis-guard-writes.sh');

export interface RawRun { status: number | null; stdout: string; stderr: string }

/** Runs a guard script with the given bytes as stdin and returns its raw exit status and output. */
export function runRaw(script: string, input: string | Buffer, env: NodeJS.ProcessEnv = {}, cwd: string = repositoryRoot): RawRun {
    const result = spawnSync('bash', [script], {
        cwd,
        input,
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', ...env },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export const runSecretsRaw = (input: string | Buffer, env: NodeJS.ProcessEnv = {}, script: string = secretsGuard): RawRun => runRaw(script, input, env);
export const runWritesRaw = (input: string | Buffer, env: NodeJS.ProcessEnv = {}, script: string = writesGuard): RawRun => runRaw(script, input, env);

export const bashPayload = (command: string): string => JSON.stringify({ cwd: repositoryRoot, tool_name: 'Bash', tool_input: { command } });

/** Input that is not exactly one well-formed JSON object with the right field types; the guards must refuse all of it. */
export const malformedInputs: Array<[name: string, input: string]> = [
    ['empty input', ''],
    ['whitespace only', ' \n\t '],
    ['not JSON', 'not json'],
    ['truncated document', '{"tool_name":"Bash","tool_input":{"command":"git sta'],
    ['two documents', '{"tool_name":"Bash","tool_input":{"command":"git status"}}{"tool_name":"Bash","tool_input":{"command":"git status"}}'],
    ['a document followed by garbage', '{"tool_name":"Bash","tool_input":{"command":"git status"}} trailing'],
    ['null document', 'null'],
    ['array document', '[{"tool_name":"Bash"}]'],
    ['string document', '"git status"'],
    ['number document', '7'],
    ['empty object', '{}'],
    ['tool_name is not a string', '{"tool_name":7,"tool_input":{"command":"git status"}}'],
    ['tool_name is null', '{"tool_name":null,"tool_input":{"command":"git status"}}'],
    ['tool_input is missing', '{"tool_name":"Bash"}'],
    ['tool_input is null', '{"tool_name":"Bash","tool_input":null}'],
    ['tool_input is an array', '{"tool_name":"Bash","tool_input":[]}'],
    ['tool_input is a string', '{"tool_name":"Bash","tool_input":"git status"}'],
    ['command is missing', '{"tool_name":"Bash","tool_input":{}}'],
    ['command is null', '{"tool_name":"Bash","tool_input":{"command":null}}'],
    ['command is a number', '{"tool_name":"Bash","tool_input":{"command":1}}'],
    ['command is an array', '{"tool_name":"Bash","tool_input":{"command":["git","status"]}}'],
    ['command is empty', '{"tool_name":"Bash","tool_input":{"command":""}}'],
    ['command holds a NUL', '{"tool_name":"Bash","tool_input":{"command":"git status\\u0000; env"}}'],
];

/** Everyday commands that must keep working: the guards fail closed on what they cannot read, not on ordinary work. */
export const safeCorpus: string[] = [
    'git status',
    'git log --oneline -5',
    'git diff --stat origin/main...HEAD',
    'ls -la',
    'dotnet build -c Release',
    'yarn workspace @cratis/ai-verification run check',
    'npm test -- --watch=false',
    'echo "done" && pwd',
    'cd Source/Verification && ls',
    'mkdir -p .ai-work/notes && echo ok > .ai-work/notes/a.txt',
    'cat README.md',
    'rg -n "TODO" Source',
    'printf "%s\\n" a b c',
    'echo "built at $(date)"',
    'CI=1 make build',
    'git commit -m "Fix the parser"',
    "git commit -m 'Block kubectl get secret and printenv in the guard'",
    'bash scripts/build.sh --release',
    'bash -c "ls -la"',
    'git commit -F - <<EOF\nA message that mentions env and kubectl get secret\nEOF',
    'cat <<EOF > notes.md\nplain text\nEOF',
    'kubectl get pods -o name',
    'kubectl logs web-0 --tail 50',
    'docker ps',
    'ls a b c',
];

/** Locates an executable on the real PATH. */
export function locate(tool: string): string | undefined {
    for (const directory of (process.env.PATH ?? '').split(delimiter)) {
        const candidate = join(directory, tool);
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}

// Each hostile string is parsed or passed on stdin only, never executed as shell source.
export interface RestrictedRow {
    id: string;
    finding: 'R2-1' | 'R2-2' | 'R2-3' | 'R2-4' | 'R2-5' | 'R2-6' | 'G-1' | 'grammar';
    command: string;
    category: string;
    neighbor: string;
    parserRefusal?: boolean;
}

const rows = (finding: RestrictedRow['finding'], category: string, neighbor: string, commands: string[], parserRefusal = false): RestrictedRow[] =>
    commands.map((command, index) => ({ id: `${finding}/${category}/${index + 1}`, finding, category, neighbor, command, parserRefusal }));

export const restrictedRows: RestrictedRow[] = [
    ...rows('R2-1', 'unmodeled-builtin', "echo 'a[$(printenv >&2)0]'", [
        "let 'a[$(printenv >&2)0]=1'", "declare -i x='a[$(printenv >&2)0]'", "unset 'a[$(printenv >&2)0]'",
        "read 'a[$(printenv >&2)0]'", 'getopts x opt', 'mapfile data', 'wait -p result', 'let 1+1', 'unset name',
    ]),
    ...rows('R2-1', 'unsupported', "echo 'a[$(..)]'", [
        "read 'a[$(printenv >&2)0]' <<< x", "y='a[$(..)]'; [[ y -eq 0 ]]", "y='a[$(..)]'; echo ${HOME:y}",
    ], true),
    ...rows('R2-2', 'unmodeled-builtin', 'printenv HOME', [
        'declare -n r=GH_TOKEN', 'typeset -n r=GH_TOKEN', 'local -n r=GH_TOKEN', 'readonly -n r=GH_TOKEN',
        'declare --nameref r=GH_TOKEN', 'typeset +n r', 'local -n r=GH_TOKEN; printf %s "$r"',
        'declare', 'typeset', 'local', 'set', 'export', 'export NAME=value',
        'command declare -n r=GH_TOKEN', 'builtin typeset -n r=GH_TOKEN', 'env local -n r=GH_TOKEN',
        'sudo declare -n r=GH_TOKEN', 'command export', 'builtin set', 'env typeset', 'sudo export',
    ]),
    ...rows('R2-2', 'unsupported', 'printenv HOME', [
        'declare -n r=GH_TOKEN; echo $r', 'local -n r=GH_TOKEN; printf %s "$r"; echo $r',
    ], true),
    ...rows('R2-3', 'unsupported', '[ -n "$HOME" ] && echo set', [
        "[[ 'a[$(printenv TOKEN >&2)0]' -eq 0 ]]", '[[ -n "$HOME" ]]',
    ], true),
    ...rows('R2-3', 'unsupported', "echo '[[ ... ]]'", ["bash -c '[[ -n \"$HOME\" ]]'"]),
    ...rows('R2-4', 'unsupported', 'echo "${HOME}"', [
        "offset='a[$(printenv >&2)0]'; echo ${HOME:offset}", 'echo "${HOME:offset}"', 'echo "${a[index]}"',
        'echo "${a[0]}"', 'echo "${HOME:1}"', 'echo "${HOME:-x}"', 'echo "${!X}"', 'echo "${(flags)X}"',
    ], true),
    ...rows('R2-5', 'unsupported', 'cat .env.example', [
        'cat .e\\\nnv', 'c\\\nat .env', 'ku\\\nbectl get secrets', 'echo "$TO\\\nKEN"', 'echo "${HO\\\nME}"',
        'echo "in\\\nword"',
    ], true),
    ...rows('R2-6', 'unmodeled-shell', "bash -ec 'echo ok'", [
        'bash -eo pipefail -c "printenv >&2"', 'bash -eo pipefail -c "echo ok"', 'bash -- -c env',
        'bash -o posix -c env', 'bash -O extglob -c env', 'bash +o xtrace -c env', 'bash --rcfile file -c env',
        'bash --init-file file -c env', 'bash -i -c env', 'bash -cc env', 'bash -ce env', 'bash -eec env',
        'sh -s', 'zsh --emulate sh -c env', 'zsh -o shwordsplit -c "echo ok"',
    ]),
    ...rows('G-1', 'unmodeled-interpreter', 'node scripts/check.mjs', [
        "node -e 'process.stdout.write(process.env.GH_TOKEN)'", "node --eval='code'", "node -p'code'", "node --print code",
        'python -c code', 'python3 "-cprint(1)"', 'ruby -e code', 'perl -we code', 'lua -e code', 'php -r code',
        'pwsh -Command code', 'powershell -EncodedCommand code', 'node --unknown-option file.js', 'node', 'python -',
        "command node -e 'code'", "sudo node -p code", "bash -c 'node -e code'", 'fish -c code', 'dash -c env',
        'pi-phase run --kind test --timeout 5 -- node --eval code',
    ]),
    ...rows('G-1', 'unsupported', 'python3 script.py', ['python3 -cprint(1)'], true),
    ...rows('G-1', 'unmodeled-git', 'git status', [
        "git -c alias.x='!env' x", "git '-calias.x=!env' x", 'git --config-env=alias.x=NAME x', 'git --config-env alias.x=NAME x',
        'git --exec-path=/tmp log', "git config alias.x '!env'", 'git config core.pager env', 'git config core.sshCommand env',
        'git custom-alias', "command git -c core.pager=env log", "bash -c 'git -c core.pager=env log'",
        'pi-phase run --kind test -- git --exec-path=/tmp log',
    ]),
    ...rows('G-1', 'unmodeled-launcher', 'npm test -- --watch=false', [
        'npx tool', 'npm exec -- node -e code', 'yarn exec node -e code', 'yarn dlx tool', 'dotnet exec app.dll',
        'npm unknown-task', 'yarn --unknown test', 'dotnet run app.cs', 'command npx tool', "bash -c 'yarn exec env'",
        'pi-phase run --kind test -- npm exec -- node -e code',
    ]),
    ...rows('G-1', 'unmodeled-language', 'rg text README.md', [
        "awk 'BEGIN {system(\"env\")}'", "gawk 'BEGIN {system(\"env\")}'", "sed 'e env'", "sed 's/a/b/e' README.md",
        "command awk 'BEGIN {print 1}'", "bash -c 'sed p README.md'", 'pi-phase run --kind test -- sed p README.md',
    ]),
    ...rows('G-1', 'unmodeled-wrapper', 'pi-phase run --kind test --timeout 5 -- echo ok', [
        'pi-phase run --unknown value -- echo ok', 'pi-phase run --kind -- echo ok', 'pi-phase run --kind test echo ok',
        'pi-phase other -- echo ok', 'sudo --unknown value echo ok', 'busybox sh -c env', 'toybox sh -c env', 'env -S "echo ok"', 'env --split-string="echo ok"',
        'rtk unknown echo ok', 'xargs --arg-file README.md echo', 'timeout --signal -- 5 echo ok',
    ]),
    ...rows('grammar', 'unsupported', "echo 'HEAD~5..HEAD'", [
        'echo HEAD~5..HEAD', 'echo *', 'echo {a,b}', 'echo ~', 'echo ^x', 'echo # comment', '# comment\necho ok',
        'echo ok &', 'if true; then echo ok; fi', '{ echo ok; }', 'echo `date`', 'echo $HOME', 'echo "$HOME:x"',
        'echo "$HOME[0]"', 'echo "$HOMEé"', "echo $'data'", 'echo $((1+1))', 'echo $[1]',
        'cat <(echo ok)', 'cat <<< data', 'cat <<-EOF\nx\nEOF', 'cat <<EOF\n$HOME\nEOF',
    ], true),
    ...rows('grammar', 'unsupported', 'cat < README.md', [
        '< README.md', '(cat) < README.md', '> out cat', 'cat &>out', 'cat >|out', 'cat >!out', 'cat <> file',
        'cat <&0', 'cat 3>out', 'cat > file<other', 'cat <1-10>',
    ], true),
    ...rows('grammar', 'unsupported', 'sudo CI=1 echo ok', ['sudo FOO=1 printenv', 'env FOO=1 printenv', 'docker exec -e FOO=1 web printenv']),
    ...rows('grammar', 'evaluated-argument', 'printf %s 1', ["printf '%n' 'a[$(printenv >&2)0]'", 'printf %d "$X"']),
    ...rows('grammar', 'dynamic-argument', 'echo ok > out', ['echo ok > "$OUT"'], true),
    ...rows('grammar', 'unsupported', 'CI=1 make build', [
        'FOO=1 make build', 'CI=maybe make build', 'CI=1', 'GIT_PAGER=env git log', 'CI+=1 make build',
    ], true),
].map((row, index) => ({ ...row, id: `${row.finding}-${index + 1}` }));

export const credentialExpansionRows = ['echo "$TOKEN"', 'echo "${DB_PASSWORD}"', '[ -n "$TOKEN" ]', 'printenv GH_TOKEN'];
export const carrierCredentialRows = [
    'pi-phase run --kind test --timeout 5 -- printenv', 'command printenv', 'builtin printenv', 'env printenv',
    'sudo -u root printenv', 'timeout 5 printenv', 'xargs -n1 printenv', 'rtk proxy printenv',
    'find . -exec printenv \\;', 'kubectl exec pod -- printenv', 'docker compose exec web printenv',
    "bash -c 'printenv'", "echo \"$(bash -c 'printenv')\"",
];

export const supportedGrammarRows = [
    'echo \\pr"i"n\'t\'env', 'CI=1 make build', "GIT_PAGER='' git log", 'echo "$?"', 'echo "${HOME}"',
    '[ -n "$HOME" ] && echo set', 'printf -- "%s\\n" "$HOME"', "echo '[[ ... ]]'", 'echo "$(date)"',
    '(echo one; echo two) | cat', 'echo one && echo two || echo three', 'echo one;\necho two',
    'echo ok \\\n more', "echo 'literal\\\nline'", 'cat < README.md 2>&1 > out', 'echo ok 1>&2', 'echo ok >&2',
    "cat <<'EOF'\n$(printenv)\\\nEOF\n", 'cat <<EOF\nplain\nEOF', 'find . -exec echo {} \\;',
    "git commit -m \"$(cat <<'EOF'\nliteral message\nEOF\n)\"", "bash -c 'echo ok'", "zsh -luc 'echo ok'",
    'bash -eu scripts/build.sh --release', 'bash script.sh -c env', 'bash --help', 'node --import tsx --test file.spec.ts',
    'yarn workspace @cratis/ai-verification run check', 'npm test -- --watch=false', 'dotnet build -c Release',
    'git -C Source status', "git log 'HEAD~5..HEAD'", 'env CI=true make build', 'pi-phase run --kind test -- echo ok',
];

export interface CompatibilityMigration { oldCommand: string; reason: string; rewrite: string; oldRows: number }
// Original ALLOW assertions remain visible in the historical tables. The runner applies exactly these migrations,
// and separately proves each refusal and safe rewrite. Duplicate old assertions are counted, not silently dropped.
export const compatibilityMigrations: CompatibilityMigration[] = [
    { oldCommand: 'env FOO=1 make build', reason: 'unsupported assignment profile', rewrite: 'make build', oldRows: 1 },
    { oldCommand: 'export FOO=bar', reason: 'stateful builtin', rewrite: 'echo FOO', oldRows: 1 },
    { oldCommand: 'declare -p FOO', reason: 'stateful builtin', rewrite: 'printenv HOME', oldRows: 1 },
    { oldCommand: 'cat ~/.ssh/id_ed25519.pub', reason: 'unquoted tilde', rewrite: 'ls .ssh/', oldRows: 1 },
    { oldCommand: "sed -n '/token/p' notes.txt", reason: 'unmodeled embedded language', rewrite: 'rg token notes.txt', oldRows: 1 },
    { oldCommand: 'echo hi # kubectl get secret', reason: 'unquoted comment', rewrite: "echo 'hi # kubectl get secret'", oldRows: 1 },
    { oldCommand: '/usr/bin/env FOO=1 true', reason: 'unsupported assignment profile', rewrite: '/usr/bin/env CI=1 true', oldRows: 1 },
    { oldCommand: 'sed -i.bak s/a/b/ README.md', reason: 'unmodeled embedded language', rewrite: 'cat README.md', oldRows: 1 },
    { oldCommand: 'echo ${X}', reason: 'unquoted expansion', rewrite: 'echo "${X}"', oldRows: 1 },
    { oldCommand: 'a=1', reason: 'standalone assignment', rewrite: 'echo 1', oldRows: 1 },
    { oldCommand: 'echo $CMD', reason: 'unquoted expansion', rewrite: 'echo "$CMD"', oldRows: 2 },
    { oldCommand: "trap 'echo done' EXIT", reason: 'stateful evaluator builtin', rewrite: 'echo done', oldRows: 1 },
    { oldCommand: 'bash <<< "echo hi"', reason: 'here-string/stdin program', rewrite: 'bash -c "echo hi"', oldRows: 1 },
    { oldCommand: '(cat) < README.md', reason: 'compound redirection', rewrite: 'cat < README.md', oldRows: 1 },
    { oldCommand: '{ cat; } < README.md', reason: 'group and compound redirection', rewrite: 'cat < README.md', oldRows: 1 },
    { oldCommand: 'echo "$(< README.md)"', reason: 'redirect-only command substitution', rewrite: 'cat README.md', oldRows: 1 },
    { oldCommand: 'while read line; do echo "$line"; done < list.txt', reason: 'loop and stateful builtin', rewrite: 'cat list.txt', oldRows: 1 },
    { oldCommand: '(cat) < .env.example', reason: 'compound redirection', rewrite: 'cat < .env.example', oldRows: 1 },
    { oldCommand: 'env FOO=1 ls < /dev/null', reason: 'unsupported assignment profile', rewrite: 'env CI=1 ls < /dev/null', oldRows: 1 },
    { oldCommand: 'echo hi > $OUT', reason: 'computed redirection', rewrite: 'echo hi > out.txt', oldRows: 1 },
    { oldCommand: 'printf "%s" $X', reason: 'unquoted expansion', rewrite: 'printf "%s" "$X"', oldRows: 1 },
    { oldCommand: "bash -c 'echo $CMD'", reason: 'unquoted expansion in nested program', rewrite: "bash -c 'echo \"$CMD\"'", oldRows: 1 },
    { oldCommand: 'cd $DIR', reason: 'unquoted expansion', rewrite: 'cd "$DIR"', oldRows: 1 },
    { oldCommand: 'mkdir -p $D', reason: 'unquoted expansion', rewrite: 'mkdir -p "$D"', oldRows: 1 },
    { oldCommand: 'echo $X', reason: 'unquoted expansion', rewrite: 'echo "$X"', oldRows: 1 },
    { oldCommand: 'echo "${X:-plain}"', reason: 'parameter operator', rewrite: 'echo "${X}"', oldRows: 1 },
    { oldCommand: 'printf "%s\\n" $X', reason: 'unquoted expansion', rewrite: 'printf "%s\\n" "$X"', oldRows: 1 },
    { oldCommand: 'printf -- "%s" $X', reason: 'unquoted expansion', rewrite: 'printf -- "%s" "$X"', oldRows: 1 },
    { oldCommand: 'echo $HOME', reason: 'unquoted expansion', rewrite: 'echo "$HOME"', oldRows: 1 },
];
export const directCompatibilityMigrations = [{
    id: 'submitted-harness-override-followed-by-true', oldRow: 578, oldDecision: 'allow', newDecision: 'block',
    reason: 'unsupported assignment; the override is harness-only and an in-command setting has no effect', rewrite: 'true',
}];
export const corpusRewrites = [
    { oldCommand: 'for f in a b c; do echo "$f"; done', reason: 'loop', rewrite: 'printf "%s\\n" a b c' },
    { oldCommand: 'FOO=1 make build', reason: 'unsupported assignment profile', rewrite: 'CI=1 make build' },
    { oldCommand: 'ls {a,b,c}', reason: 'brace expansion', rewrite: 'ls a b c' },
];

export interface Sandbox { directory: string; path: string; cleanup(): void }

/** A PATH made of one directory that really omits the named tools (jq, node, ...) while keeping the others. */
export function minimalPath(options: { omit?: string[]; keep?: string[]; stubs?: Record<string, string> } = {}): Sandbox {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-guard-path-'));
    const omit = new Set(options.omit ?? []);
    for (const tool of options.keep ?? ['jq', 'node', 'git', 'cat']) {
        if (omit.has(tool) || (options.stubs && tool in options.stubs)) continue;
        const target = locate(tool);
        if (target) symlinkSync(target, join(directory, tool));
    }
    for (const [tool, body] of Object.entries(options.stubs ?? {})) {
        writeFileSync(join(directory, tool), `#!/bin/sh\n${body}\n`);
        chmodSync(join(directory, tool), 0o755);
    }
    return { directory, path: directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

/** Stub bodies that make jq or node misbehave after they start: extraction failures the guards must not mistake for permission. */
export const extractionFailures: Record<string, string> = {
    'jq exits non-zero without output': 'exit 1',
    'jq exits zero without output': 'exit 0',
    'jq prints only part of the frames': "printf 'Y\\000'",
    'jq prints frames without the trailer': "printf 'Y\\000git status\\000'",
    'jq is killed': 'kill -9 $$',
};

/** Copies selected guard files into a scratch scripts directory so a spec can remove one and watch the guard refuse. */
export function isolatedScripts(files: string[]): { directory: string; cleanup(): void } {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-guard-scripts-'));
    mkdirSync(directory, { recursive: true });
    for (const file of files) {
        copyFileSync(join(scriptsDirectory, file), join(directory, file));
        chmodSync(join(directory, file), 0o755);
    }
    return { directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

/** The bash executable's absolute path, so a spec can run it with a PATH that does not contain it. */
export const bashPath = locate('bash') ?? '/bin/bash';

/** Runs the guard script under bash with an exact PATH (bash itself is invoked by absolute path). */
export function runWithPath(script: string, input: string | Buffer, path: string, env: NodeJS.ProcessEnv = {}): RawRun {
    const result = spawnSync(bashPath, [script], {
        cwd: repositoryRoot,
        input,
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', ...env, PATH: path },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
