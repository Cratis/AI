// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const guard = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');
const P = '.cratis/ai/rules/glossary.md';
const S = '.cratis/ai/hooks/scripts/cratis-guard-writes.sh';
const K = '.cratis/ai/skills/s/SKILL.md';
const M = '.mcp.json';
const checker = '.cratis/ai/hooks/scripts/cratis-check-pr.mjs';
const handoff = '.cratis/ai/hooks/scripts/cratis-check-handoff.mjs';

// Explicit read/run/data-only admissions. The fail-open comparison also uses this list.
export const allowCommands = [
    `git diff origin/main...HEAD -- ${P}`,
    `git show HEAD -- ${P}`,
    `node ${checker} --body-file .ai-work/b.md --label patch`,
    `git add ${K}`, `git add -- ${K}`, `git add -u ${K}`,
    `git add ${K} && git commit -m "touch ${P}"`,
    'ls -d Arc*/ | sort', 'ls Arc* | sort -u', 'ls -d Arc* | sort | uniq',
    "rg -n 'foo]*' Source | sort",
    `cat ${P} | sort -nrufb -- | uniq -cdui --`,
    `cat ${P} | sort --numeric-sort --reverse --unique --ignore-case --ignore-leading-blanks | uniq --count --repeated --unique --ignore-case`,
    `cat <<'EOF'\n${S}\nEOF`,
    `cat <<EOF\n${S}\nEOF`,
    `cat <<"EOF"\n${S}\nEOF`,
    // Verbatim reproduction 5; reproduction 4 is refused after security review.

    'cd /Volumes/sourcecode/repos/cratis/.worktrees/l124-ai-1245 && git status -s && git add .cratis/ai/skills/cratis-chronicle-decision-reads/SKILL.md && git commit -q -m "Scope the read protection default to Cratis.Arc.Chronicle" && git log --oneline -2',
];

export const blockCommands = [
    // Security review R1: bodies remain references even if the reduced text has none.
    `cat > .ai-work/x.sh <<'EOF'\necho x > ${P}\nEOF\nbash .ai-work/x.sh`,
    `cat > .ai-work/x.sh <<'EOF'\necho x > ${P}\nEOF\n. .ai-work/x.sh`,
    `(\ncat <<'EOF'\necho x > ${P}\nEOF\n) | sh`,
    `hash -p /bin/bash cat\ncat <<'EOF'\necho x > ${P}\nEOF`,
    `alias cat=bash\ncat <<'EOF'\necho x > ${P}\nEOF`,
    `hash -p /bin/bash cat\ncat > .ai-work/x.sh <<'EOF'\necho x > ${P}\nEOF`,
    `alias cat=bash\ncat > .ai-work/x.sh <<'EOF'\necho x > ${P}\nEOF`,
    `cat > .ai-work/x.md <<'EOF'\necho x > ${P}\nEOF`,
    `cat > .ai-work/x.md <<'EOF'\nsee ${S} and ${P}\nEOF`,
    `cat > .ai-work/x.md <<EOF\nsee ${S} and ${P}\nEOF`,
    `cat >> .ai-work/x.md <<'EOF'\n${S}\nEOF`,
    `cat <<'EOF' > .ai-work/x.md\n${S}\nEOF`,
    `cat > .ai-work/x.md <<'EOF'\n${S}\nEOF\nnode ${checker} --body-file .ai-work/x.md --label patch`,
    `cat > .ai-work/x.md <<"EOF"\n${S}\nEOF`,
    // Removed admissions: none is needed for reproduction 5.
    `git diff -w origin/main...HEAD -- ${P}`,
    `git diff -M --stat origin/main...HEAD -- ${P}`,
    `git diff --unified=2 origin/main...HEAD -- ${P}`,
    `git diff --no-ext-diff origin/main...HEAD -- ${P}`,
    'git diff --diff-filter=M --name-only origin/main...HEAD -- .cratis',
    `git diff --shortstat --summary --no-renames --color=never -- ${P}`,
    `node ${handoff} --json --strict --repo . --state-note .ai-work/n.md .ai-work/handoff.md`,
    "rg -S -o 'foo.*' Source | sort",
    "rg -n -C 2 'a]*b' .cratis",
    "rg -A 2 -B 1 -m 3 --hidden --no-heading --smart-case 'foo]*' Source | sort",
    `rg --context=2 foo ${P}`, `rg --type md foo ${P}`, `rg --type-not ts foo ${P}`,
    `rg --iglob '*.md' foo ${P}`, `rg --regexp foo ${P}`,
    `echo x > ${P}`, `cat > ${P} <<'EOF'\nbody\nEOF`,
    `cat > .ai-work/x.md <<'EOF'\n${S}\nEOF\necho x > ${M}`,
    `cat > .ai-work/x.md <<'EOF'\n${S}\nEOF\ncp a ${P}`,
    `cat > a <<EOF\n$(echo x > ${M})\nEOF`,
    `cat > a <<EOF\n\`echo x > ${M}\`\nEOF`,
    `cat > a <<EOF\n\\\n${S}\nEOF`,
    `cat > a <<'EOF'\n${S}`,
    `cat > a <<'EOF'\n${S}\nEOF \necho x > ${M}`,
    `echo '\ncat > a <<'EOF'\n'; echo x > ${M}; echo '\nEOF`,
    `echo "\ncat > a <<'EOF'\n"; echo x > ${M}; echo "\nEOF`,
    `x='1'\ncat > a <<'EOF'\n${S}\nEOF`,
    `tee .ai-work/x.md <<'EOF'\n${S}\nEOF`,
    `bash <<'EOF'\necho x > ${M}\nEOF`, `sh <<'EOF'\n${S}\nEOF`,
    `node - <<'EOF'\n${S}\nEOF`, `cat <<-'EOF'\n${S}\nEOF`, `cat <<<"${S}"`,
    `cat > a <<'A' <<'B'\n${S}\nA\nB`,
    `git commit -m "$(cat <<'EOF'\n${S}\nEOF\n)"`,
    `git add ${K}; echo $?`, `git add -f ${K}`, `git add -N ${K}`, `git add --intent-to-add ${K}`,
    `git add ${K} && git commit -m x && git push -u origin HEAD`,
    `cd /tmp/other && node ${checker}`, `node ${checker} --label-file x`,
    `node ${handoff} --file b.md`, `cd /tmp/other && node ${handoff} .ai-work/handoff.md`,
    `node ${handoff} --repo`, `node ${handoff} --state-note ${P} > ${M}`,
    `git diff --output=${P} origin/main -- ${K}`, `git diff --ext-diff -- ${P}`,
    `git diff -O ${P}`, `git diff --no-index a b -- ${P}`, `git diff --unified=x -- ${P}`,
    `sort ${P}`, `uniq ${P}`, `sort -- ${P}`, `uniq -- ${P}`,
    `cat ${P} | sort .ai-work/input`, `cat ${P} | uniq .ai-work/input`,
    `cat ${P} | sort -- .ai-work/input`, `cat ${P} | uniq -- .ai-work/input`,
    `cat ${P} | sort -`, `cat ${P} | uniq -`,
    `cat ${P} | sort -- --`, `cat ${P} | uniq -- --`,
    `ls Arc* | sort -o ${P}`, `ls Arc* | sort --output=${P}`, 'ls Arc* | sort -T /tmp',
    'ls .e* | xargs rm', 'for d in Arc*; do echo x > $d; done', 'echo .env | xargs touch',
    `rg -z foo ${P}`, `rg --pre ./x foo ${P}`, `rg foo ${P} -f ${P}`,
    `rg -C x 'foo]*' Source`, `uniq in ${P}`, `uniq -- in ${P}`, `ls Arc* | uniq - ${P}`,
    'ls Arc* | tee .env', `ls Arc* | sort > ${M}`,
    // Verbatim reproductions 1, 2, 3, 4, 6 and 7: never execute these commands.
    "cat >> /Volumes/sourcecode/repos/cratis/.worktrees/l124-ai-1114/.ai-work/1114/plan.md <<'EOF'\n... 1. Pre-existing exception: `.cratis/ai/hooks/scripts/cratis-guard-writes.sh:393-403` resolves ...\nEOF\necho ok",
    'cd /Volumes/sourcecode/repos/cratis && ls -d Arc* 2>/dev/null; cd Arc 2>/dev/null && git fetch -q origin && git show origin/main:Source/DotNET/Chronicle/build/Cratis.Arc.Chronicle.props | grep -n ReadProtection; git -C /Volumes/sourcecode/repos/cratis/Arc show origin/main:Documentation/backend/csharp/chronicle/consistency/faq.md | grep -n -i "default"; cd ../AI && rg -n -i "(off|on)\\`? \\(the default|\\(default\\)|default when nothing|start new code with|read protection.*default|default.*read protection" --glob \'!*.ai-work*\' | grep -v node_modules | head -40',
    'cd /Volumes/sourcecode/repos/cratis/AI && git worktree add -q -b l124/1245-read-protection-default ../.worktrees/l124-ai-1245 origin/main && cd ../.worktrees/l124-ai-1245 && rg -n --hidden -i "default" --glob \'!.git/**\' --glob \'!node_modules/**\' $(git ls-files | rg "\\.(md|json|mdc|txt)$" ) 2>/dev/null | rg -i "read.?protection|CratisReadProtection|\\`?Off\\`? \\(|new code with \\`?On" | cut -d: -f1 | sort | uniq -c; ls; cat package.json | rg -n \'"(build|generate|check|test)[^"]*"\' | head',
    'cd /Volumes/sourcecode/repos/cratis/.worktrees/l124-ai-1245 && git status -s | head; git diff --stat origin/main...HEAD | tail -3; git diff origin/main...HEAD -- .cratis/ai/rules/glossary.md .cratis/ai/rules/application-profile.md | rg "^[+-][^+-]" | cut -c1-300',
    'cd /Volumes/sourcecode/repos/cratis/.worktrees/l124-ai-1245 && node .cratis/ai/hooks/scripts/cratis-check-pr.mjs --body-file .ai-work/1245/pr-body.md --label patch; echo exit=$?',
    'cd /Volumes/sourcecode/repos/cratis/.worktrees/l124-direct-2783-2699 && node -e \'const m=require("./.cratis/ai.manifest.json");console.log(m.version||m.Version||"",m.sourceCommit||m.SourceCommit||m.source||"")\' 2>&1 | head -3; git log -1 --format=%cs -- .cratis/ai/hooks/scripts | head -1',
];

function scratchRepository(present: boolean) {
    const root = mkdtempSync(join(tmpdir(), 'cratis-shell-reads-'));
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/example/app.git']).status, 0);
    for (const directory of ['.cratis/ai/rules', '.cratis/ai/hooks/scripts', '.cratis/ai/skills/s', '.ai-work', 'Source', 'Arc1']) {
        mkdirSync(join(root, directory), { recursive: true });
    }
    writeFileSync(join(root, '.cratis/ai.manifest.json'), '{}');
    if (present) for (const path of [P, S, K, M, '.env', 'package.json']) writeFileSync(join(root, path), '{}');
    return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

function runGuard(command: string, cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
    return new Promise((resolveRun, reject) => {
        const child = spawn('bash', [guard], { cwd, env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0' } });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', status => resolveRun({ status, stdout, stderr }));
        child.stdin.on('error', () => { /* A refusal may close stdin before its writer. */ });
        child.stdin.end(JSON.stringify({ cwd, tool_input: { command } }));
    });
}

async function checkCases(commands: string[], status: number, cwd: string) {
    let next = 0;
    const failures: string[] = [];
    const worker = async () => {
        while (next < commands.length) {
            const command = commands[next++];
            const result = await runGuard(command, cwd);
            try {
                assert.equal(result.status, status, `${command}\n${result.stderr}`);
                assert.equal(result.stdout, '', command);
                if (status === 2) assert.match(result.stderr, /BLOCKED by cratis-guard-shell-writes/, command);
                else assert.equal(result.stderr, '', command);
            } catch (error) { failures.push((error as Error).message); }
        }
    };
    await Promise.all(Array.from({ length: Math.min(8, commands.length) }, worker));
    assert.equal(failures.join('\n'), '');
}

for (const present of [false, true]) {
    test(`read/run/data-only commands are admitted with protected fixture files ${present ? 'present' : 'absent'}`, async () => {
        const repo = scratchRepository(present);
        try {
            await checkCases(allowCommands, 0, repo.root);
        } finally { repo.dispose(); }
    });
    test(`write and ambiguous neighbours remain refused with protected fixture files ${present ? 'present' : 'absent'}`, async () => {
        const repo = scratchRepository(present);
        try {
            await checkCases([
                ...blockCommands,
                `cd ${repo.root} && node ${checker} --body-file .ai-work/b.md --label patch`,
                `cd ${repo.root} && node ${handoff} --json .ai-work/handoff.md`,
                `cd ${repo.root} && node ${checker}; echo $?`,
                `cd ${repo.root} && node ${checker} && echo x > ${M}`,
                `cd ${repo.root} && cd /tmp/other && node ${checker}`,
                `cd ${repo.root} && bash .cratis/ai/hooks/scripts/cratis-cleanup-worktrees.sh`,
            ], 2, repo.root);
        } finally { repo.dispose(); }
    });
}
