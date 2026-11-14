import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
const current = '.cratis/ai/hooks/scripts/cratis-guard-secrets.sh';
const baseline = '.ai-work/ghsa-jjqh/guard-r3.sh';
function run(shell, script, command) {
    const result = spawnSync(shell, [script], {
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
        input: JSON.stringify({ tool_input: { command } }),
    });
    if (result.error) throw result.error;
    assert.ok(result.status === 0 || result.status === 2, `${shell}: ${result.stderr}`);
    return result;
}
const probes = [
    [0, 'cat .env.example'], [0, 'cp .env.example .env'],
    [0, 'cat .env.{example,sample}'], [0, 'grep -rn "process.env" src'],
    [0, 'rg -n id_rsa docs'], [0, 'ls -la .env'],
    [2, 'F=.env.example; cat "$F"'],
    [2, 'git diff --no-index /dev/null .e"nv"'],
    [2, 'cat secret.p[e]m'], [2, 'cat [.]env'],
    [2, 'x=.e; true | x=ab; cat "${x}nv"'],
    [2, 'x=.e; x=ab & cat "${x}nv"'],
    [2, 'x=.e; false && unset x; cat "${x}nv"'],
    [2, 'f=READ; for x in a b; do cat "${f}nv"; f=.e; done'],
    [2, 'f=.e; (unset f); cat "${f}nv"'],
    [2, 'f=.e bash -c \'cat "${f}nv"\''],
    [2, 'set -- .e; cat "$1"nv'], [2, 'x=\'*.p*\'; cat $x'],
    [2, 'x=\'foo token.json\'; cat $x'], [2, 'zip -0 - .e*'],
    [2, 'cp -rt /tmp/x .e*'], [2, 'ln -s /other/token.json'],
    [2, 'bash -O dotglob -c \'cat *.md\''],
    [2, 'o=-s; shopt $o dotglob'],
    [2, 'opt=-s; shopt "$opt" nocaseglob; cat .E*'],
    [2, 'b=.e; a=$b; cat "${a}nv"'],
    [2, 'cat "$f"; read f'], [2, 'cat "$f"; for f; do :; done'],
    [0, 'cat "$dir/README.md"'], [0, 'echo $$; cat /tmp/x.md'],
    [0, 'set -o noglob'], [0, 'set -euo pipefail'], [0, 'set +f'],
    [0, 'ls .e*'], [0, 'stat .env'],
    [2, 'ls .e* | xargs cat'], [2, 'ls $(cat .env)'],
    [2, "bash -O extglob -c true"], [2, "bash -o nounset -c true"],
    [2, 'set -o posix'], [2, 'shopt -s expand_aliases'],
    [2, 'f=.e; cat "$f"nv'], [2, "f=.e; cat $f'nv'"],
    [2, 'f=id_r; cat ~/.ssh/"$f"sa'],
    [2, 'cat .@(e)nv'], [2, 'cat .(e|x)nv'],
    [2, "find . -name '.e*' -exec cat {} \\;"],
    [2, "rg --glob='.e*' x"], [2, 'grep --include=.env -r x .'],
    [2, 'rg -uu -g .env KEY'], [2, 'rg -J -g .env KEY'],
    [2, 'rg --unknown-option -g .env KEY'], [0, 'rg -uu .env docs'],
    [2, 'grep -rn foo .kube'], [2, 'grep -f .env x'], [2, 'grep -e foo .env'],
    [2, 'cat <<< .env'],
];
for (const shell of ['/bin/bash', 'bash']) {
    for (const [expected, command] of probes) {
        const result = run(shell, current, command);
        assert.equal(result.status, expected, `${shell}: ${command}\n${result.stderr}`);
        if (expected === 2) {
            assert.match(result.stderr, /Use instead:/);
            assert.match(result.stderr, /SECURITY INCIDENT/);
        }
        if (command.includes('.e"nv"')) {
            assert.match(result.stderr, /protected file \(\.env\)/);
            assert.match(result.stderr, /split compound commands/);
        }
        console.log(`${shell}: ${expected}: ${command}`);
    }
}
const longCommand = 'git commit -F - <<EOF\n' + 'routine notes '.repeat(640) + '\nEOF';
console.log(`long command bytes: ${Buffer.byteLength(longCommand)}`);
const measurements = [];
for (const command of ['git status', 'yarn build', 'cat $HOME/x.md', 'X=README.md; cat $X', longCommand]) {
    const totals = [0, 0];
    for (let i = 0; i < 200; i++) {
        for (const index of i % 2 ? [1, 0] : [0, 1]) {
            const start = performance.now();
            const result = run('/bin/bash', [baseline, current][index], command);
            assert.equal(result.status, 0, result.stderr);
            totals[index] += performance.now() - start;
        }
    }
    const label = command === longCommand ? 'long here-document' : command;
    const ratio = totals[1] / totals[0];
    const measurement = { command: label, iterations: 200, baselineMs: totals[0], currentMs: totals[1], normalized100BaselineMs: totals[0] / 2, normalized100CurrentMs: totals[1] / 2, deltaPercent: (ratio - 1) * 100 };
    measurements.push(measurement);
    console.log(JSON.stringify(measurement));
}
console.log(JSON.stringify({ measurements }, null, 2));
