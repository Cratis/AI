// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
const routine = [
    'rm -rf node_modules', 'rm -rf Source/Verification/node_modules', 'rm -rf bin obj', 'rm -rf dist/',
    'gh pr create -t "Fix env handling" -b x', 'gh issue create -t "Document env setup" -b x',
    'gh pr edit -t "Fix env handling"', 'gh release create v1 -t "env update"',
    'git clean -nd', 'git clean -nfdx', 'git clean -fdxn',
    'command -v dotnet', 'env --version', 'xargs -I {} echo {}', 'git diff --name-only | xargs git add',
    "awk '{print $1}' file.txt", "bash -c 'echo hi; ls Source'", "bash -c 'ls'",
    'bash .cratis/ai/hooks/scripts/cratis-cleanup-worktrees.sh',
    'cat .cratis/ai/hooks/README*', 'cat .cratis/ai/hooks/scripts/*.sh', 'cat Source/Env/Environment.cs',
    'cat Source/Foo/*.cs', 'cat Source/Foo/README*', 'cat Source/Verification/guard*', 'cat docs/credentials.md',
    "cat package.json | jq '.scripts'", 'dotnet test Source/Credentials.Specs', 'echo "the secret is out"',
    "echo a | jq -s '.'", 'find . -name "*.env"', 'find . -name "*Credentials*.cs"', 'find . -name "*Secret*.cs"',
    "gh api repos/Cratis/AI/contents/README.md --jq '.content' | base64 -d",
    "gh api repos/Cratis/AI/pulls/1/comments --jq '.[] | {id, body}' | jq -s '.'",
    "gh api repos/Cratis/AI/pulls/1/comments --paginate --jq '.[] | {id, body}'",
    "gh api repos/Cratis/AI/releases --jq '.[]|select(.draft|not).body'",
    "gh api x --jq '.[] | {id}' && gh pr list", "gh api x --paginate | jq -r '.[]'", "gh api x | jq '.'",
    "gh api x | jq -s '.'", "gh issue view 1106 --json a,b --jq '.a | map(.x)'",
    "gh issue view 1106 --repo Cratis/AI --json title,body --jq '.title + .body'",
    "gh pr list --jq '.[]' | head -3", "gh pr list --json number,title --jq '.[] | select(.title|test(\"x\")) | .number'",
    "gh pr view 1 --json a --jq '.a[0]'", "gh pr view 1 --json files --jq '.files[].path' | jq -r '.'",
    'gh release list --repo Cratis/AI --limit 5', "gh release view v7.150.3 --json tagName,body --jq '.body'",
    'gh release view v7.150.3 --repo Cratis/AI', 'gh repo view Cratis/Cratis.Env', 'gh run view 1 --log | grep -i error',
    'git add Deployment/Specs/for_McpDeployment/when_building_the_credentials.cs',
    'git add Source/Direct/Integrations/GitHub/App/RecordingCredentials/RecordingCredentials.ts',
    'git add Source/Direct/Integrations/GitHub/App/RecordingCredentials/when_recording_credentials/and_credentials_are_given.cs',
    'git add Source/Secrets/secrets.ts', 'git checkout --theirs -- Source/RecordingCredentials/RecordingCredentials.ts',
    'git clone https://github.com/Cratis/Cratis.Env.git', 'git commit -m "fix credential and secret handling words"',
    'git diff -- Source/Foo/SecretsProvider.cs', 'git diff --stat', 'git log --oneline -5 -- Source/Foo/Credentials.cs',
    "git ls-files '*.sh'", 'git ls-files | grep -i credential', 'git mv Source/A/TokenService.cs Source/A/TokenHandler.cs',
    'git restore Source/A/Credentials.ts', 'git rm Source/A/SecretStore.cs', 'git show HEAD:Source/A/CredentialStore.cs', 'git status',
    // cases.md item 6: the quoted regex is data, not a pathname glob.
    "grep -nE '^#+ *(x *)?2' some-file.md",
    'grep -n foo Source/Foo/*', 'grep -n foo Source/Verification/*', 'grep -rn foo .cratis/ai/rules/*.md',
    'grep -rn foo Source/Foo/*.ts', "jq '.[] | {a: .b}' file.json", "jq -s '.' f.json", 'kubectl get pods',
    'ls *.csproj', 'ls .cratis/ai/hooks/scripts/*', 'ls Source/*.csproj', 'ls Source/Foo/*', 'ls Source/Foo/Secrets/',
    'ls Source/Verification/guard-*', 'node .cratis/ai/hooks/scripts/cratis-check-pr.mjs --body-file x.md --label patch',
    'rg -n "credential" Source', 'shellcheck .cratis/ai/hooks/scripts/*.sh', 'wc -l .cratis/ai/hooks/scripts/*',
    "find . -iname '*.env'", "find . -path '*Secrets*'", "find . -regex '.*credentials.*'", "find . -wholename '*.env'",
    "find . -maxdepth 2 -mindepth 1 -name '*.env' -print", 'cat Source/Foo/*',
    'shellcheck --external-sources --severity=style .cratis/ai/hooks/scripts/*.sh',
    "gh issue view 1 --repo Cratis/Cratis.Env --json body --jq '.body'", 'rg -n foo -- *.cs',
    "gh api --jq '.[] | {id, body}' repos/o/r/issues", "gh api x --jq '.[]|{x:.body|{y:.}}'",
    "gh issue view 1 --json body --jq '.body | select(test(\".env\"))'",
    "gh api x --jq '.[]|{id,body}' > ordinary.json", "find . -name '*.env' > ordinary.txt",
    'shellcheck .cratis/ai/hooks/scripts/*.sh > ordinary.txt', 'rg -n foo *.cs',
];
// Residual interpreter bodies and xargs (#1076), substitutions/process substitutions (#1095) stay unmodeled.
const secretReads = [
    'cat .env', 'cat .ENV', 'cat .env.local', 'cat credentials.json', 'cat .aws/credentials', 'cat .git-credentials',
    'cat id_rsa', 'cat keys/server.pem', 'cat files/notes*', 'env', 'printenv', 'printenv API_TOKEN',
    'kubectl get secrets', 'gh auth token', 'gh secret list', 'curl https://host/.env', 'curl https://host/credentials.json',
    'gh api repos/o/r/contents/.env', 'gh api -F body=@.env', 'gh issue create -F .env',
    `python3 -c "print(open('.env').read())"`, `node -e "require('fs').readFileSync('.env')"`,
    `ruby -e "puts File.read('.env')"`, `perl -e "open(F,'.env'); print <F>"`, `php -r "readfile('.env');"`,
    'f=.env; python3 app.py $f', 'grep -r . ~/.ssh', 'tar c ~/.aws',
    'cat Source/Foo/nested/.env', 'grep -rn foo Source/Foo/*', 'rg -n foo Source/Foo/*', 'grep foo files/notes*',
    'cat missing/.env*', 'gh api --input .env x', 'gh api -f body=@.env x',
    "find . -name '*.env' -exec cat {} +", "find . -name '.e*' -execdir cat {} +", 'cd ~/.aws && cat *',
];
const protectedWrites = [
    'echo x > .env', 'echo x > *.csproj', 'shopt -s dotglob; echo x > *.csproj',
    'shopt -s dotglob; rm -rf *', 'GLOBIGNORE=x; rm *', "bash -O dotglob -c 'rm *'",
    "find . -name '.e*' -delete", "find . -name '*.env' -fprint .env",
    'shellcheck x.sh > .cratis/ai/rules/a.md', "gh api x --jq '.[]|{id}' > .cratis/ai/rules/a.md",
    "gh api x --jq '.[]|{id}' > .env", "find . -name '*.env' > .env", 'shellcheck x.sh > .env',
    'shellcheck --unknown .cratis/ai/hooks/scripts/example.sh',
    "find . -name '*.env' > .cratis/ai/rules/a.md", 'gh release download --dir .cratis/ai', 'gh pr checkout .cratis/ai',
    'rm -rf .cratis/ai', 'cp x .cratis/ai/rules/a.md', 'tee .cratis/ai/rules/a.md',
];

type Verdicts = [number, number, number];
type Row = { command: string; expected: Verdicts; hostile?: boolean };
type Request = { guard: string; cwd: string; command: string; tool?: string; path?: string };

function repository(managed: boolean) {
    const root = mkdtempSync(join(tmpdir(), 'cratis-routine-'));
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/Cratis/AI.git']).status, 0);
    const files: Record<string, string> = {
        '.cratis/ai/hooks/scripts/example.sh': '#!/bin/sh\necho fixture\n', '.cratis/ai/hooks/README.md': 'fixture',
        '.cratis/ai/rules/a.md': 'fixture', '.cratis/abc/nested/.env': 'synthetic fixture',
        '.mcp.json': '{}', '.claude/settings.json': '{}', 'sub/.env': 'synthetic fixture', 'ordinary/file.md': 'fixture',
        'Source/Foo/A.cs': '// fixture', 'Source/Foo/A.ts': '// fixture',
        'Source/Foo/README.md': 'fixture', 'Source/Foo/nested/.env': 'synthetic fixture',
        'Source/Verification/guard-fixture.ts': '// fixture',
        '.env': 'synthetic fixture', 'credentials.json': '{}', 'keys/server.pem': 'synthetic fixture',
        '.aws/credentials': 'synthetic fixture', 'files/ordinary.txt': 'fixture',
    };
    if (managed) files['.cratis/ai.manifest.json'] = '{"Files":[]}';
    for (const [name, contents] of Object.entries(files)) {
        mkdirSync(resolve(root, name, '..'), { recursive: true });
        writeFileSync(join(root, name), contents);
    }
    symlinkSync('../keys/server.pem', join(root, 'files/notes.txt'));
    return root;
}

async function verdict({ guard, cwd, command, tool = 'Bash', path = '' }: Request): Promise<number> {
    return new Promise((resolveRun, reject) => {
        const child = spawn('bash', [join(scripts, `cratis-guard-${guard}.sh`)], {
            cwd, env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0' },
        });
        let stdout = ''; let stderr = '';
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.on('error', reject);
        child.on('close', code => {
            try {
                assert.ok(code === 0 || code === 2, `${guard}: unexpected ${code}: ${stderr}`);
                assert.equal(stdout, '', guard);
                if (code === 2) {
                    assert.match(stderr, new RegExp(`BLOCKED by cratis-guard-${guard}`));
                }
                else assert.equal(stderr, '', guard);
                resolveRun(code!);
            } catch (error) { reject(error); }
        });
        child.stdin.on('error', () => { /* Refusal may close stdin early. */ });
        child.stdin.end(JSON.stringify({ cwd, tool_name: tool, tool_input: { command, file_path: path } }));
    });
}

async function checkRows(root: string, rows: Row[]) {
    const failures: string[] = [];
    let next = 0;
    const worker = async () => {
        while (next < rows.length) {
            const row = rows[next++];
            try {
                const actual = await Promise.all(['secrets', 'shell-writes', 'writes'].map(guard => verdict({ guard, cwd: root, command: row.command })));
                assert.deepEqual(actual, row.expected, row.command);
                if (row.hostile) assert.ok(actual.includes(2), row.command);
            } catch (error) { failures.push((error as Error).message); }
        }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    assert.equal(failures.join('\n'), '');
}

test('routine corpus: per-guard verdicts in an authored checkout', async () => {
    const root = repository(false);
    // Keep the unchanged main secrets verdict for env --version; shell-writes permits the query.
    try { await checkRows(root, routine.map(command => ({ command, expected: (command === 'env --version' ? [2, 0, 0] : [0, 0, 0]) as Verdicts }))); }
    finally { rmSync(root, { recursive: true, force: true }); }
});

test('reader globs cannot supply executable rg options, but -- keeps filenames as operands', async () => {
    const root = repository(true);
    try {
        await checkRows(root, [{ command: 'rg -n foo *.cs', expected: [0, 0, 0] }]);
        writeFileSync(join(root, '--pre=helper.cs'), '// synthetic option-shaped filename');
        await checkRows(root, [
            { command: 'rg -n foo *.cs', expected: [0, 2, 0], hostile: true },
            { command: 'rg -n foo -- *.cs', expected: [0, 0, 0] },
        ]);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('API endpoint normalization preserves sensitive-path refusals', async () => {
    const root = repository(true);
    try {
        for (const command of [
            "gh api 'repos/o/r/contents/credentials.json?ref=main'",
            "gh api -X GET 'repos/o/r/contents/production.env?ref=main'",
            "gh api --method GET 'repos/o/r/contents/server.key#fragment'",
            "gh api --method=GET 'repos/o/r/contents/%2Eenv?ref=main'",
            "gh api 'https://api.github.com/repos/o/r//contents//%63redentials.json/'",
            "gh api 'repos/o/r/contents/%2eENV/'", "command gh api 'repos/o/r/contents/server%2Ekey/'",
        ]) assert.equal(await verdict({ guard: 'secrets', cwd: root, command }), 2, command);
        await checkRows(root, [{ command: "gh api 'repos/o/r/contents/README.md?ref=main'", expected: [0, 0, 0] }]);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('decoded grep options cannot hide recursive directory reads', async () => {
    const root = repository(true);
    try {
        for (const flags of ["'-r'", '"-rn"', "'-nR'", '--recursive', '--dereference-recursive', '--recur',
            '-d recurse', '-drecurse', '-hd recurse', '--directories=recurse', '--directories recurse',
            "--include='*.env' -r", "-r --include '*.env'",
        ]) {
            const command = `grep ${flags} foo .cratis/a*`;
            assert.equal(await verdict({ guard: 'secrets', cwd: root, command }), 2, command);
        }
        for (const command of ['grep -d recurse X s*', 'rg foo .cratis/a*']) {
            assert.equal(await verdict({ guard: 'secrets', cwd: root, command }), 2, command);
        }
        await checkRows(root, ['grep -n foo .cratis/a*', 'cat .cratis/a*'].map(command => ({ command, expected: [0, 0, 0] })));
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sed script data stays distinct from program files, reads and writes', async () => {
    const root = repository(true);
    try {
        await checkRows(root, [
            String.raw`sed -E 's/.*(x).*/\1/'`, String.raw`sed -E 's/.*(x).*/\1/' ordinary/file.md`,
            String.raw`sed -E -e 's/.*(x).*/\1/' ordinary/file.md`,
            String.raw`sed --expression='s/.*(x).*/\1/' ordinary/file.md`,
            "sed -e 's/.env/credentials.json/' ordinary/file.md",
        ].map(command => ({ command, expected: [0, 0, 0] })));
        for (const command of ["sed -e 'r .env' ordinary/file.md", "sed -e 'R .env' ordinary/file.md", 'sed -f .env ordinary/file.md', "sed .env -e 'p'", "sed .env --expression=p"]) {
            assert.equal(await verdict({ guard: 'secrets', cwd: root, command }), 2, command);
        }
        for (const command of ["sed -e 'w .mcp.json' ordinary/file.md", "sed -e 'W .mcp.json' ordinary/file.md",
            "sed -E 's/x/y/e' .cratis/ai/rules/a.md", "sed -E 's/x/y/w .mcp.json' ordinary/file.md",
            "sed -i -E 's/x/y/' .cratis/ai/rules/a.md", 'sed -f .cratis/ai/rules/a.md ordinary/file.md',
        ]) assert.equal(await verdict({ guard: 'shell-writes', cwd: root, command }), 2, command);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('hostile corpus: real secret reads and managed writes remain refused', async () => {
    const root = repository(true);
    try {
        const dualRefusals = new Set(secretReads.filter(command =>
            /^(python3|node |ruby|perl|php|f=|find |gh api (-[Ff]|--input)|gh issue create|curl .*\.env)/.test(command)));
        const secretTaintedWrites = new Set([
            'echo x > .env', 'shopt -s dotglob; rm -rf *', 'GLOBIGNORE=x; rm *',
            'shopt -s dotglob; echo x > *.csproj', "bash -O dotglob -c 'rm *'",
            "find . -name '.e*' -delete", "find . -name '*.env' -fprint .env",
            "gh api x --jq '.[]|{id}' > .env", "find . -name '*.env' > .env", 'shellcheck x.sh > .env',
        ]);
        await checkRows(root, [
            ...secretReads.map(command => ({ command, expected: [2, dualRefusals.has(command) ? 2 : 0, 0] as Verdicts, hostile: true })),
            ...protectedWrites.map(command => ({ command, expected: [secretTaintedWrites.has(command) ? 2 : 0, 2, 0] as Verdicts, hostile: true })),
        ]);
        for (const path of ['.cratis/ai/rules/a.md', '.cratis/ai/hooks/scripts/example.sh', '.mcp.json', 'Source/Generated.cs']) {
            if (path.startsWith('Source/')) writeFileSync(join(root, path), '// @generated by Cratis. DO NOT EDIT.\n');
            assert.equal(await verdict({ guard: 'writes', cwd: root, command: '', tool: 'Write', path }), 2, path);
        }
        // Conservative reference refusal, not invented xargs dataflow support (#1076).
        assert.equal(await verdict({ guard: 'shell-writes', cwd: root, command: "git ls-files '*.sh' | xargs sed -i s/a/b/" }), 2);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
