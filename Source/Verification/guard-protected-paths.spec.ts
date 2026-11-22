// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * A repository declares extra agent-control paths with `protectedPaths` in its `.cratis/ai.json`. Both the
 * Write/Edit guard and the shell-write guard treat them like the built-in controls; the list is additive and
 * an unreadable or invalid declaration protects the whole repository.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
const writeGuard = join(scripts, 'cratis-guard-writes.sh');
const shellGuard = join(scripts, 'cratis-guard-shell-writes.sh');
const BLOCK = 'block';
const ALLOW = 'allow';

type Verdict = typeof BLOCK | typeof ALLOW;
type Repository = { root: string; dispose: () => void };

function run(script: string, input: object, root: string, override = '0'): { verdict: Verdict; stderr: string } {
    const env = { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: override, CLAUDE_PROJECT_DIR: root };
    const result = spawnSync('bash', [script], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', env });
    assert.ok(result.status === 0 || result.status === 2, `unexpected guard exit ${result.status}: ${result.stderr}`);
    return { verdict: result.status === 2 ? BLOCK : ALLOW, stderr: result.stderr };
}

const writeCall = (root: string, path: string, override?: string) =>
    run(writeGuard, { cwd: root, tool_input: { file_path: join(root, path), content: 'x' } }, root, override);
const shellCall = (root: string, command: string, override?: string) =>
    run(shellGuard, { cwd: root, tool_name: 'Bash', tool_input: { command } }, root, override);

/** A throwaway repository for a consumer application whose `.cratis/ai.json` holds the given text. */
function repositoryWith(config: string, origin = 'https://github.com/Consumer/App.git'): Repository {
    const root = mkdtempSync(join(tmpdir(), 'cratis-protected-paths-'));
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', origin]).status, 0);
    mkdirSync(join(root, '.cratis'), { recursive: true });
    writeFileSync(join(root, '.cratis', 'ai.json'), config);
    mkdirSync(join(root, 'docs', 'locked'), { recursive: true });
    mkdirSync(join(root, 'docs', 'open'), { recursive: true });
    writeFileSync(join(root, 'notes.md'), '# Notes\n');
    return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

function withRepository(config: string, body: (root: string) => void): void {
    const repository = repositoryWith(config);
    try { body(repository.root); } finally { repository.dispose(); }
}

const declared = '{"protectedPaths": ["docs/locked/*", "RELEASE.md", "./config/policy.yml"]}';

const writeCases: Array<[path: string, expected: Verdict]> = [
    ['docs/locked/a.md', BLOCK], ['docs/locked/deep/b.md', BLOCK], ['RELEASE.md', BLOCK], ['release.md', BLOCK],
    ['config/policy.yml', BLOCK], ['docs/locked/../locked/c.md', BLOCK], ['docs/open/a.md', ALLOW], ['RELEASE.txt', ALLOW],
    ['Source/other.ts', ALLOW],
    // Built-ins stay protected when protectedPaths is present.
    ['.mcp.json', BLOCK], ['.pi/settings.json', BLOCK], ['.claude/settings.json', BLOCK], ['.cratis/ai.json', BLOCK],
];

test('protectedPaths block Write/Edit like built-in controls, and only those paths', () => {
    withRepository(declared, root => {
        for (const [path, expected] of writeCases) {
            const result = writeCall(root, path);
            assert.equal(result.verdict, expected, `${path}: ${result.stderr}`);
            if (expected === BLOCK) assert.match(result.stderr, /BLOCKED by cratis-guard-writes: .*\n\nThis target controls the agent's permissions/s, path);
        }
        // A symlink to a declared path is judged by its destination.
        symlinkSync(join(root, 'docs', 'locked'), join(root, 'alias'));
        assert.equal(writeCall(root, 'alias/x.md').verdict, BLOCK);
        // The explicit override still works.
        assert.equal(writeCall(root, 'docs/locked/a.md', '1').verdict, ALLOW);
    });
});

test('protectedPaths of the target repository apply, not those of the session repository', () => {
    const owner = repositoryWith('{"protectedPaths": ["locked.txt"]}');
    const other = repositoryWith('{}');
    try {
        const write = (target: string, session: string) =>
            run(writeGuard, { cwd: session, tool_input: { file_path: join(target, 'locked.txt'), content: 'x' } }, session).verdict;
        assert.equal(write(owner.root, other.root), BLOCK);
        assert.equal(write(other.root, owner.root), ALLOW);
    } finally {
        owner.dispose();
        other.dispose();
    }
});

const malformedConfigurations = [
    '{not json', '', '[]', '{"protectedPaths": "docs/*"}', '{"protectedPaths": [1]}', '{"protectedPaths": {"a": "b"}}', '{"protectedPaths": [""]}',
    '{"protectedPaths": ["/etc/passwd"]}', '{"protectedPaths": ["../outside"]}', '{"protectedPaths": ["docs/../../x"]}', '{"protectedPaths": ["a\\nb"]}',
    '{"protectedPaths": ["ok"]} {"protectedPaths": []}',
];

test('a malformed protectedPaths configuration protects the whole repository and says why', () => {
    for (const config of malformedConfigurations) {
        withRepository(config, root => {
            const result = writeCall(root, 'Source/anything.ts');
            assert.equal(result.verdict, BLOCK, config);
            assert.match(result.stderr, /protectedPaths/, config);
            assert.equal(writeCall(root, 'Source/anything.ts', '1').verdict, ALLOW, config);
        });
    }
});

test('absent or null protectedPaths and unrelated settings leave ordinary writes allowed', () => {
    for (const config of ['{}', '{"protectedPaths": null}', '{"protectedPaths": []}', '{"allowDependencyManifestWrites": true}']) {
        withRepository(config, root => {
            assert.equal(writeCall(root, 'Source/a.ts').verdict, ALLOW, config);
            assert.equal(writeCall(root, '.mcp.json').verdict, BLOCK, config);
        });
    }
});

const shellCases: Array<[command: string, expected: Verdict]> = [
    ['echo x > RELEASE.md', BLOCK], ['echo x >> docs/locked/a.md', BLOCK], ['echo x | tee docs/locked/a.md', BLOCK],
    ['cp notes.md docs/locked/a.md', BLOCK], ['mv notes.md RELEASE.md', BLOCK], ['rm RELEASE.md', BLOCK], ['rm -rf docs/locked', BLOCK],
    ['sed -i s/a/b/ docs/locked/a.md', BLOCK], ['echo x > ./docs/open/../locked/a.md', BLOCK], ['echo x > release.md', BLOCK],
    ['echo x > .mcp.json', BLOCK], ['echo x > .cratis/ai.json', BLOCK],
    ['echo x > docs/open/a.md', ALLOW], ['echo x > RELEASE.txt', ALLOW], ['echo x > Source/a.ts', ALLOW], ['ls docs', ALLOW],
];

test('protectedPaths block shell writes exactly like built-in controls', () => {
    withRepository('{"protectedPaths": ["docs/locked/*", "RELEASE.md"]}', root => {
        for (const [command, expected] of shellCases) {
            const result = shellCall(root, command);
            assert.equal(result.verdict, expected, `${command}\n${result.stderr}`);
            if (expected === BLOCK) assert.match(result.stderr, /BLOCKED by cratis-guard-shell-writes/, command);
        }
        assert.equal(shellCall(root, 'echo x > RELEASE.md', '1').verdict, ALLOW);
    });
});

test('a malformed protectedPaths configuration blocks shell writes in that repository', () => {
    for (const config of ['{not json', '{"protectedPaths": [1]}', '{"protectedPaths": ["../x"]}', '{"protectedPaths": ["/abs"]}']) {
        withRepository(config, root => {
            for (const command of ['echo x > Source/a.ts', 'rm notes.md']) assert.equal(shellCall(root, command).verdict, BLOCK, `${config}: ${command}`);
        });
    }
});

const configWith = (...globs: string[]) => JSON.stringify({ protectedPaths: globs });

/** One scratch repository whose declared directory (certs, below a declared glob) and built-in directory (.pi/extensions) hold the same files. */
function directoryFixture(root: string): void {
    for (const directory of ['certs', '.pi/extensions', 'other', 'src', 'node_modules']) mkdirSync(join(root, directory), { recursive: true });
    for (const file of ['certs/a.pem', '.pi/extensions/a.pem', 'other/b.txt']) writeFileSync(join(root, file), 'x');
}

// Directory operands are covered by the machinery that protects built-ins such as .pi/extensions/*, for every command shape.
const directoryCommands: Array<[template: string, expected: Verdict]> = [
    ['rm -rf DIR', BLOCK], ['mv DIR x', BLOCK], ['rsync -a --delete other/ DIR/', BLOCK], ['cp -r other/. DIR', BLOCK],
    ['tar xf o.tar -C DIR', BLOCK], ['unzip -o o.zip -d DIR', BLOCK], ['cd DIR && tar xf ../o.tar', BLOCK], ['cd DIR && rm -rf a.pem', BLOCK],
    ['ln -sfn other DIR', BLOCK], ['find DIR -delete', BLOCK],
    ['cd src && npm run build', ALLOW], ['tar czf o.tgz DIR', BLOCK], ['rm -rf node_modules', ALLOW], ['rm -rf other', ALLOW],
];

test('a declared directory glob protects its directory like a built-in control, for every command shape', () => {
    withRepository(configWith('certs/*.pem'), root => {
        directoryFixture(root);
        for (const [template, expected] of directoryCommands) {
            const declaredVerdict = shellCall(root, template.replaceAll('DIR', 'certs')).verdict;
            const builtInVerdict = shellCall(root, template.replaceAll('DIR', '.pi/extensions')).verdict;
            assert.equal(declaredVerdict, expected, template);
            assert.equal(declaredVerdict, builtInVerdict, `parity with the built-in: ${template}`);
        }
    });
});

test('inside a declared directory only the matching files are protected, as for the built-ins', () => {
    withRepository(configWith('certs/*.pem'), root => {
        directoryFixture(root);
        for (const [path, expected] of [['certs/a.pem', BLOCK], ['certs/y.txt', ALLOW], ['src/y.txt', ALLOW]] as Array<[string, Verdict]>) {
            assert.equal(writeCall(root, path).verdict, expected, path);
            assert.equal(shellCall(root, `echo x > ${path}`).verdict, expected, path);
        }
    });
});

test('accepted glob shapes protect, and wildcards outside the final segment are malformed', () => {
    for (const glob of ['certs/*.pem', 'tools/guard.sh', 'locked/', './tools/guard.sh', '.pi/ext/*']) {
        withRepository(configWith(glob), root => assert.equal(writeCall(root, 'Source/other.ts').verdict, ALLOW, glob));
    }
    for (const glob of ['*.pem', '**/*.pem', '*X/src/*.ts', 'a/*/b.sh', 'a/**', 'a/*/', '*', './*.pem', 'a//b', 'a/./b', 'RELEASE*']) {
        withRepository(configWith(glob), root => {
            const result = writeCall(root, 'Source/other.ts');
            assert.equal(result.verdict, BLOCK, glob);
            assert.match(result.stderr, new RegExp(`protectedPaths entry .*${glob.replace(/[*.\/]/g, '.')}`), glob);
        });
    }
});

test('a nested .git file or directory does not hide the policy of an enclosing repository', () => {
    for (const marker of ['file', 'directory']) {
        withRepository(configWith('tools/locked.txt'), root => {
            for (const nested of ['tools', '.claude']) {
                mkdirSync(join(root, nested), { recursive: true });
                if (marker === 'file') writeFileSync(join(root, nested, '.git'), 'gitdir: ../.git\n');
                else mkdirSync(join(root, nested, '.git'));
            }
            const cases: Array<[string, Verdict]> = [['tools/locked.txt', BLOCK], ['.claude/settings.json', BLOCK], ['tools/other.txt', ALLOW]];
            for (const [path, expected] of cases) {
                assert.equal(writeCall(root, path).verdict, expected, `${marker}: ${path}`);
                const command = `echo x > ${path}`;
                assert.equal(shellCall(root, command).verdict, expected, `${marker}: ${command}`);
            }
        });
    }
});

test('a glob using characters outside the allowlist makes the configuration malformed', () => {
    const unsupported = [
        '[h]ook1.sh', 'hook?.sh', 'hook{1,2}.sh', 'a\\b', 'a]b', 'a}b', 'a\u0001b', 'a\u007fb', 'a\tb', 'a\u001bb',
        '@(hook1|hook2).sh', '!(hook1).sh', '+(hook1).sh', '*(hook1).sh', '?(hook1).sh', 'a b', "a'b", 'a"b', 'a$b', 'a|b', 'a&b', 'a;b', 'a~b', 'é.sh',
    ];
    for (const glob of unsupported) {
        withRepository(configWith(glob), root => {
            const result = writeCall(root, 'Source/anything.ts');
            assert.equal(result.verdict, BLOCK, JSON.stringify(glob));
            assert.match(result.stderr, /protectedPaths/, JSON.stringify(glob));
        });
    }
    withRepository(configWith('@(hook1|hook2).sh'), root => assert.equal(shellCall(root, 'tee hook{1,2}.sh').verdict, BLOCK));
    withRepository(configWith('@(hook1|hook2).sh'), root => assert.equal(shellCall(root, 'tee hook1.sh').verdict, BLOCK));
});

test('an allowed glob is judged identically by the Write/Edit and shell guards', () => {
    withRepository(configWith('hooks/hook-1_a.*', 'Docs/'), root => {
        const cases: Array<[path: string, expected: Verdict]> = [['hooks/hook-1_a.sh', BLOCK], ['HOOKS/HOOK-1_A.sh', BLOCK], ['Docs/x.md', BLOCK], ['hooks/hook-2.sh', ALLOW]];
        for (const [path, expected] of cases) {
            assert.equal(writeCall(root, path).verdict, expected, path);
            assert.equal(shellCall(root, `tee ${path}`).verdict, expected, path);
        }
    });
});
