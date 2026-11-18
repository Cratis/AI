// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const guard = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');
const BLOCK = 'block';
const ALLOW = 'allow';

function scratchRepository() {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-shell-repair-')));
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/example/app.git']).status, 0);
    return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

function runGuardAsync(command: string, repo: ReturnType<typeof scratchRepository>): Promise<{ verdict: string; stdout: string; stderr: string }> {
    return new Promise((resolveRun, reject) => {
        const child = spawn('bash', [guard], { cwd: repo.root, env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0' } });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', status => {
            if (status !== 0 && status !== 2) return reject(new Error(`unexpected guard exit ${status}: ${stderr}`));
            resolveRun({ verdict: status === 2 ? BLOCK : ALLOW, stdout, stderr });
        });
        child.stdin.on('error', () => { /* The refusal can close stdin before its writer. */ });
        child.stdin.end(JSON.stringify({ cwd: repo.root, tool_name: 'Bash', tool_input: { command } }));
    });
}

async function checkCases(cases: Array<[string, string]>, repo: ReturnType<typeof scratchRepository>) {
    let next = 0;
    const failures: string[] = [];
    const worker = async () => {
        while (next < cases.length) {
            const [expected, command] = cases[next++];
            try {
                const result = await runGuardAsync(command, repo);
                assert.equal(result.verdict, expected, `${command}\n${result.stderr}`);
                assert.equal(result.stdout, '', command);
                if (expected === BLOCK) assert.match(result.stderr, /BLOCKED by cratis-guard-shell-writes/, command);
                else assert.equal(result.stderr, '', command);
            } catch (error) { failures.push((error as Error).message); }
        }
    };
    await Promise.all(Array.from({ length: Math.min(16, cases.length) }, worker));
    assert.equal(failures.join('\n'), '');
}

function prepareRepairTree({ root }: ReturnType<typeof scratchRepository>) {
    mkdirSync(join(root, '.cratis/ai/prompts'), { recursive: true });
    const folders = ['.pi', '.claude', '.cursor', '.opencode', '.github'];
    for (const folder of folders) mkdirSync(join(root, folder));
    const links = [...folders.map(folder => `${folder}/prompts`), '.pi/missing prompts', '.pi/missing', '.pi/directory', '.pi/escaped/prompts'];
    writeFileSync(join(root, '.cratis/ai.manifest.json'), JSON.stringify({ Integrations: links.map(Path => ({
        Path, Target: '../.cratis/ai/prompts', IsDirectory: true,
    })) }));
}

test('standalone corpus installers allow literal arguments but never conceal another protected write', async () => {
    const repo = scratchRepository();
    try {
        prepareRepairTree(repo);
        const allowed = ['init', 'update', 'restore'].flatMap(verb => [
            `cratis ai ${verb} --source .cratis/ai`,
            `cratis ai ${verb} --force --source '.cratis/ai/local source'`,
            `  cratis ai ${verb}  --force --source ".cratis/ai/local source"  `,
        ]);
        const blocked = [
            'echo "cratis ai update" > .cratis/ai/x',
            "cat <<'EOF' > .cratis/ai/x\ncratis ai update\nEOF",
            'cratis ai update && cp x .cratis/ai/x',
            'cp x .cratis/ai/x && cratis ai update',
            'cratis ai update; rm -rf .cratis/ai/x',
            'cratis ai update | tee .cratis/ai/x',
            'cratis ai update > .cratis/ai/x',
            'cratis ai update --source $(cp x .cratis/ai/x)',
            'cratis ai update --source `cp x .cratis/ai/x`',
            'cratis ai updatex --source .cratis/ai',
            'cratis aix update --source .cratis/ai',
            'cd . && cratis ai update --source .cratis/ai',
            'env cratis ai update --source .cratis/ai',
            "cratis ai 'up'date --source .cratis/ai",
            'cratis ai update --source "unterminated .cratis/ai',
        ];
        await checkCases([
            ...allowed.map(command => [ALLOW, command] as [string, string]),
            ...blocked.map(command => [BLOCK, command] as [string, string]),
        ], repo);
    } finally { repo.dispose(); }
});

test('standalone symbolic links repair only managed folders with corpus targets', async () => {
    const repo = scratchRepository();
    try {
        prepareRepairTree(repo);
        const allowed = ['.pi', '.claude', '.cursor', '.opencode', '.github'].flatMap(folder =>
            ['-s', '-sf', '-sfn'].map(flag => `ln ${flag} '${repo.root}/.cratis/ai/prompts' ${folder}/prompts`));
        const blocked = [
            'ln -s ../notes.md .pi/prompts',
            'ln -sf ../.cratis/ai/../../../outside .pi/prompts',
            'ln -s /tmp/outside .pi/prompts',
            'ln -s ../.cratis/ai-other/prompts .pi/prompts',
            'ln -s .cratis/ai/prompts prompts',
            `ln -s '${repo.root}/.cratis/ai/prompts' .other/prompts`,
            `ln -s '${repo.root}/.cratis/ai/prompts' .pi/../prompts`,
            'ln -s ../.cratis/ai/prompts .pi/prompts && cp x .cratis/ai/x',
            'cp x .cratis/ai/x; ln -s ../.cratis/ai/prompts .pi/prompts',
            'ln -s ../.cratis/ai/prompts .pi/prompts | tee .cratis/ai/x',
            'ln -s ../.cratis/ai/prompts .pi/prompts > .cratis/ai/x',
            'ln -s "$(echo ../.cratis/ai/prompts)" .pi/prompts',
            'ln -s `echo ../.cratis/ai/prompts` .pi/prompts',
            'ln ../.cratis/ai/prompts .pi/prompts',
            'ln -s ../.cratis/ai/prompts .pi/prompts another',
        ];
        await checkCases([
            ...allowed.map(command => [ALLOW, command] as [string, string]),
            [ALLOW, 'ln -s ../.cratis/ai/prompts .pi/prompts'],
            [ALLOW, "ln -s '../.cratis/ai/missing prompts' '.pi/missing prompts'"],
            ...blocked.map(command => [BLOCK, command] as [string, string]),
        ], repo);
    } finally { repo.dispose(); }
});

test('without a manifest, folder and corpus-target checks admit bootstrap link creation', async () => {
    const repo = scratchRepository();
    try {
        prepareRepairTree(repo);
        rmSync(join(repo.root, '.cratis/ai.manifest.json'));
        mkdirSync(join(repo.root, '.pi/extensions'));
        await checkCases([[ALLOW, 'ln -s ../../.cratis/ai/prompts .pi/extensions/prompts']], repo);
    } finally { repo.dispose(); }
});

test('a present manifest requires an exact managed link entry and fails closed when malformed', async () => {
    const repo = scratchRepository();
    try {
        prepareRepairTree(repo);
        const manifest = join(repo.root, '.cratis/ai.manifest.json');
        writeFileSync(manifest, JSON.stringify({ Integrations: [
            { Path: '.pi/prompts', Target: '../.cratis/ai/prompts', IsDirectory: true },
            { Path: '.pi/settings.json', IsDirectory: false },
        ] }));
        await checkCases([
            [ALLOW, 'ln -s ../.cratis/ai/prompts .pi/prompts'],
            [BLOCK, 'ln -s ../../.cratis/ai/prompts .pi/prompts/child'],
            [BLOCK, `ln -s '${repo.root}/.cratis/ai/prompts' .pi/unlisted`],
            [BLOCK, 'ln -s ../.cratis/ai/prompts .pi/settings.json'],
        ], repo);
        for (const content of ['{', '{}', '{"Integrations":false}']) {
            writeFileSync(manifest, content);
            await checkCases([[BLOCK, `ln -s '${repo.root}/.cratis/ai/prompts' .pi/prompts`]], repo);
        }
    } finally { repo.dispose(); }
});

test('repair checks physical parents and does not follow an existing directory link for ln', async () => {
    const repo = scratchRepository();
    const outside = scratchRepository();
    try {
        prepareRepairTree(repo);
        symlinkSync(outside.root, join(repo.root, '.pi/escaped'), 'dir');
        symlinkSync(outside.root, join(repo.root, '.cratis/ai/escaped'), 'dir');
        symlinkSync('../.cratis/ai/prompts', join(repo.root, '.pi/prompts'), 'dir');
        mkdirSync(join(repo.root, '.pi/directory'));
        await checkCases([
            [BLOCK, `ln -s '${repo.root}/.cratis/ai/prompts' .pi/escaped/prompts`],
            [BLOCK, 'ln -s ../.cratis/ai/escaped/missing .pi/missing'],
            [BLOCK, 'ln -s ../.cratis/ai/escaped/../prompts .pi/missing'],
            [BLOCK, 'ln -s ../.cratis/ai/prompts .pi/directory'],
            [BLOCK, 'ln -s ../.cratis/ai/prompts .pi/prompts'],
            [BLOCK, 'ln -sf ../.cratis/ai/prompts .pi/prompts'],
            [BLOCK, 'ln -sfn ../.cratis/ai/prompts .pi/prompts/'],
            [BLOCK, 'ln -sfn ../.cratis/ai/prompts .pi/prompts/.'],
            [ALLOW, 'ln -sfn ../.cratis/ai/prompts .pi/prompts'],
        ], repo);
        // A nested session cwd must still be interpreted relative to its repository.
        await checkCases([[ALLOW, 'ln -sfn ../.cratis/ai/prompts prompts']], { ...repo, root: join(repo.root, '.pi') });
    } finally { repo.dispose(); outside.dispose(); }
});
