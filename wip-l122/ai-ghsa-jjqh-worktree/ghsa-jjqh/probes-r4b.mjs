import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const guard = resolve(process.env.R4B_GUARD ?? '.cratis/ai/hooks/scripts/cratis-guard-secrets.sh');
const cases = [
    [2, 'cat .(e)nv'], [2, 'cat .e(n)v'], [2, 'cat ~/.ssh/i(d)_rsa'],
    [2, "zsh -c 'cat .(e)nv'"], [2, 'head .(e)nv'], [2, 'grep -e x .(e)nv'],
    [2, '(.e)nv'], [2, '.(en)v'], [2, 'cat ~/.ssh/id_(rsa)'],
    [2, 'cat .ssh/i(d)_r(s)a'], [2, 'grep "$(cat .(e)nv)" a.txt'],
    [2, "zsh -c 'setopt globdots extendedglob; cat ^a.txt'"],
    [2, 'setopt extended_glob'], [2, 'setopt extendedglob; cat .e#nv'], [2, 'setopt extendedglob; cat .(#i)ENV'],
    [2, 'setopt globdots extendedglob'], [2, 'unsetopt noglob'], [2, 'emulate zsh -o extendedglob'],
    [2, 'bash -eO dotglob -c true'], [2, 'bash -eo posix -c true'], [2, 'bash -xo extglob -c true'],
    [2, 'f=-C; set "$f"'], [2, 'f=-o; set "$f" noclobber'],
    [2, 'grep -r --color foo .kube'], [2, 'grep -r --colour foo run/secrets'],
    [2, 'f=.e; cat "$f""nv"'], [2, "f=.e; cat $f''nv"],
    [0, "bash -o pipefail -c 'npm test | tee log'"],
    [0, 'grep -rn extglob .'], [0, 'grep -rn extglob .cratis'], [0, 'git log --grep extglob'],
    [2, 'cat .e^x'], [2, 'cat .e~x'], [0, 'cat ~/README.md'],
];
let failures = 0;
for (const shell of ['/bin/bash', 'bash']) for (const [expected, command] of cases) {
    const result = spawnSync(shell, [guard], {
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: process.cwd() }),
        encoding: 'utf8', env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
    });
    const passed = result.status === expected;
    console.log(JSON.stringify({ shell, command, expected, actual: result.status, passed }));
    if (!passed) failures++;
}
console.log(JSON.stringify({ probes: cases.length * 2, failures }));
process.exitCode = failures ? 1 : 0;
