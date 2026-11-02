// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Closed grammar, then one invocation/effect dispatcher, including every executable child and carrier payload.
// Opaque script files, repository tasks, unknown ordinary executables and inherited tool configuration are not
// source-inspected. This is not a sandbox or a universal executable allowlist. No submitted text is ever executed.
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LIMITS, ShellRefusal, createBudget, isDynamic, parseProgram, validateAssignment } from './cratis-shell-parser.mjs';

const SQ = "'";
const fail = (category, detail) => { throw new ShellRefusal(category, detail); };
const wrapperFailure = () => fail('unmodeled-wrapper', 'the command carrier or its complete option form is not modeled');
const baseName = text => text.replace(/.*\//, '');
const literalWord = text => ({ text, raw: text, dyn: false, bare: true, assignment: false, segments: [{ kind: 'literal', quote: 'bare', text }] });
const unknownWord = () => ({ text: '', raw: '', dyn: true, bare: false, assignment: false, segments: [] });
const requireLiteral = entry => {
    if (!entry) wrapperFailure();
    if (isDynamic(entry)) fail('dynamic-argument', 'an invocation selector, option, or program must be literal');
    return entry.text;
};
const isAssignment = entry => /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(entry.text);
const REFUSAL_GUIDANCE = {
    limit: 'split the work into smaller commands; the guard analyzes a bounded amount of shell',
    oversize: 'split the work into smaller commands; the guard analyzes a bounded amount of shell',
    unsupported: 'use literal simple commands, quoted data and supported redirections; name any unsupported operation for human review',
    unterminated: 'close every quote, substitution, subshell and here-document',
    syntax: 'rewrite the command so the shell syntax is complete and unambiguous',
    internal: 'use plain literal syntax; the guard failed unexpectedly and refuses what it cannot analyze',
    'dynamic-command': 'write the command name literally instead of computing it',
    'dynamic-argument': 'write the invocation selectors and file operands literally; name an unknown value and ask for confirmation',
    'evaluated-argument': 'use a literal data-only printf format (%s, %b or %q), or the supported unary, string or literal-integer test forms',
    'stdin-shell': 'supply a supported literal shell -c program or a literal script file, not a program on stdin',
    'unmodeled-shell': 'use exactly bash/sh/zsh -c with optional e/l/u before c, or a literal script path with optional e/u/x flags',
    'unmodeled-builtin': 'use a literal non-evaluating command; name variables and ask for confirmation rather than dumping or mutating shell state',
    'unmodeled-wrapper': 'use a supported carrier with complete literal options and an explicit command',
    'unmodeled-interpreter': 'use an existing literal script/module/test file rather than an inline or stdin program',
    'unmodeled-git': 'use a known ordinary Git subcommand without command-valued configuration or alias dispatch',
    'unmodeled-launcher': 'use an existing literal repository build/test task rather than an inline code launcher',
    'unmodeled-language': 'use rg, head or cat for data, a simple jq projection, or an existing literal script file',
};
const DYNAMIC_SAFE = new Set('echo printf cd mkdir test [ true false sleep'.split(' '));
const BUILTINS = new Set('let declare typeset local readonly unset read readarray mapfile getopts wait set export eval source . trap alias unalias enable shopt setopt unsetopt emulate zmodload autoload functions noglob nocorrect fc history hash disown logout bind complete compgen compopt dirs pushd popd'.split(' '));
const UNKNOWN_CARRIERS = new Set('busybox toybox stdbuf ionice taskset chrt flock chroot unshare nsenter strace ltrace runuser su parallel script setpriv unbuffer fakeroot systemd-run ssh sftp screen tmux expect make-command'.split(' '));
const SHELLS = new Set(['bash', 'sh', 'zsh']);
const OTHER_SHELLS = new Set(['dash', 'ksh', 'fish', 'csh', 'tcsh', 'nu']);
const INTERPRETERS = /^(node(?:js)?|python(?:\d+(?:\.\d+)*)?|ruby(?:\d+(?:\.\d+)*)?|perl|lua(?:\d+(?:\.\d+)*)?|php|pwsh|powershell)$/;
const CREDENTIAL_NAME = /token|secret|key|pass|pwd|credential|auth|cert|conn|dsn/i;
const credentialNamed = name => CREDENTIAL_NAME.test(name) && !/^(old)?pwd$/i.test(name);
const INTEGER_OPS = new Set(['-eq', '-ne', '-lt', '-le', '-gt', '-ge']);
const UNARY = new Set('-n -z -e -f -d -s -r -w -x -L -h -p -S -b -c -g -k -u -O -G -N'.split(' '));
const STRING_OPS = new Set(['=', '==', '!=', '<', '>']);
const SENSITIVE_RESOURCES = new Set('pods po pod deployments deployment deploy statefulsets statefulset sts daemonsets daemonset ds jobs job cronjobs cronjob cj configmaps configmap cm replicasets replicaset rs replicationcontrollers rc all'.split(' '));
const LONG_VALUED = new Set('namespace context kubeconfig server cluster user as as-group selector field-selector container label-columns sort-by request-timeout filename kustomize template chunk-size token env env-file workdir host config project-name file profile detach-keys log-level method header field raw-field jq repo hostname input region query endpoint-url vault-name subscription resource-group name id version project secret account'.split(' ').map(name => `--${name}`));

// Options in carrier profiles are arities, not a list of words to skip. Every consumed value is validated.
const optionSpec = (shortValues = '', shortFlags = '', longValues = '', longFlags = '') => ({ shortValues, shortFlags, longValues: new Set(longValues.split(' ')), longFlags: new Set(longFlags.split(' ')) });
const WRAPPERS = {
    sudo: optionSpec('ugChptUD', 'AbEHknPSvV', 'user group close-from host prompt chdir chroot command-timeout', 'askpass background bell non-interactive preserve-groups reset-timestamp set-home stdin validate version'),
    doas: optionSpec('uC', 'nL'),
    timeout: optionSpec('ks', 'fpv', 'kill-after signal', 'foreground preserve-status verbose'),
    nice: optionSpec('n', '', 'adjustment'),
    nohup: optionSpec(),
    time: optionSpec('fo', 'pvalq', 'format output', 'verbose portability append quiet'),
    exec: optionSpec('a', 'cl'),
    setsid: optionSpec('', 'cfw', '', 'ctty fork wait'),
    env: optionSpec('uC', 'i', 'unset chdir', 'ignore-environment'),
    xargs: optionSpec('InPLdsE', '0oprtxv', 'delimiter max-args max-lines max-procs max-chars replace eof', 'null interactive no-run-if-empty open-tty verbose exit'),
};
function optionsEnd(a, start, spec) {
    let index = start;
    while (index < a.length) {
        const text = requireLiteral(a[index]);
        if (text === '--') return index + 1;
        if (text === '-' || !text.startsWith('-')) return index;
        let needsValue = false;
        let optionName = '';
        let attached = '';
        if (text.startsWith('--')) {
            const [name, ...value] = text.slice(2).split('=');
            optionName = name;
            if (spec.longValues.has(name)) { needsValue = true; attached = value.join('='); }
            else if (!spec.longFlags.has(name) || value.length) wrapperFailure();
            if (needsValue && value.length && !attached) wrapperFailure();
        } else {
            for (let k = 1; k < text.length; k++) {
                if (spec.shortValues.includes(text[k])) { needsValue = true; optionName = text[k]; attached = text.slice(k + 1); break; }
                if (!spec.shortFlags.includes(text[k])) wrapperFailure();
            }
        }
        if (needsValue) {
            const value = attached || requireLiteral(a[++index]);
            if (!value || value.startsWith('-')) wrapperFailure();
            spec.validate?.(optionName, value);
        }
        index++;
    }
    return index;
}

function sensitivePath(value) {
    const path = value.toLowerCase();
    const name = path.replace(/.*\//, '');
    if (/(^|\/)\.kube\//.test(path) || name === 'kubeconfig' || /\.kubeconfig$/.test(name)) return 'a kubeconfig';
    if (/^\.env/.test(name) || /\.env$/.test(name)) return /\.(example|sample|template|dist|defaults?)$/.test(name) ? '' : 'an .env file';
    if (/\.(pem|p12|pfx)$/.test(name)) return 'a key or certificate file';
    if (['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'].includes(name)) return 'a private key';
    const code = /\.(cs|ts|tsx|js|jsx|mjs|cjs|go|py|java|kt|rs|md)$/.test(name);
    const design = !/(^|\/)(secrets?|credentials?)\//.test(path) && (/\.(css|scss|less)$/.test(name) || /(^|\/)(design|design-tokens|themes?|styles?)\//.test(path));
    if (/(^|[._-])tokens?($|[._-])/.test(name) && !code && !design) return 'a token file';
    if (['.netrc', '.npmrc', '.pgpass', '.git-credentials'].includes(name)) return 'a credentials file';
    if (name === 'credentials' && /\.aws\//.test(path)) return 'the AWS credentials file';
    if (/\.docker\/config\.json$/.test(path)) return 'the Docker registry credentials';
    if (/\/proc\/[^/]*\/environ$/.test(path)) return 'a process environment';
    if (/^\/(var\/)?run\/secrets\//.test(path)) return 'mounted secrets';
    return '';
}

// Literal credential-operation parsing. Carrier interpretation is separate and must finish before these policies run.
function kparse(a, start, shortValues) {
    const result = { P: [], PI: [], outfmt: '', fmtval: '', tmpl: '', dd: -1, raw: false };
    for (let index = start; index < a.length; index++) {
        const text = a[index].text;
        if (text === '--') { result.dd = index; break; }
        if (text.startsWith('--')) {
            const equal = text.indexOf('=');
            const key = equal < 0 ? text : text.slice(0, equal);
            const take = () => equal < 0 ? a[++index]?.text ?? '' : text.slice(equal + 1);
            if (key === '--output') result.outfmt = take().toLowerCase();
            else if (key === '--format') result.fmtval = take();
            else if (key === '--template') result.tmpl = take();
            else if (key === '--raw') result.raw = true;
            else if (equal < 0 && LONG_VALUED.has(key)) index++;
            continue;
        }
        if (text.startsWith('-') && text.length > 1) {
            const flag = text[1];
            const take = () => text.length === 2 ? a[++index]?.text ?? '' : text.slice(text[2] === '=' ? 3 : 2);
            if (flag === 'o') result.outfmt = take().toLowerCase();
            else if (flag === 'f' && shortValues.includes('f')) result.fmtval = take();
            else if (text.length === 2 && shortValues.includes(flag)) index++;
            continue;
        }
        result.P.push(a[index]); result.PI.push(index);
    }
    return result;
}
const projectionLeaks = text => /[{](\.|@|\.items|\.items\[\*\])[}]/.test(text.toLowerCase().replace(/[ \t]/g, ''));
const formatLeaks = text => /env|json|\.args/.test(text.toLowerCase()) || /[{][{] *\.? *[}][}]/.test(text) || /\.config *[}][}]/i.test(text);

class Analyzer {
    constructor() { this.budget = createBudget(); this.findings = new Map(); }
    report(what, alternative) { if (!this.findings.has(what)) this.findings.set(what, alternative); }

    run(text) { this.program(parseProgram(text, { budget: this.budget }), 0, 0); }
    program(commands, depth, shellDepth) {
        for (const command of commands) {
            const commandDepth = Math.max(depth, command.context.depth);
            for (const entry of [...command.words, ...command.assigns]) {
                for (const segment of entry.segments) {
                    if (segment.kind === 'substitution') this.program(segment.commands, commandDepth + 1, shellDepth);
                    if (segment.kind === 'parameter' && credentialNamed(segment.name)) this.report('expanding a credential-named variable puts its value in the command and its output', 'name the variable and ask the user to confirm it without printing its value');
                }
            }
            for (const input of command.inputs) this.checkPath(input.text, 'an input redirection');
            this.analyze(command, command.words, commandDepth, shellDepth);
        }
    }

    analyze(command, a, depth, shellDepth) {
        if (!a.length) wrapperFailure();
        if (depth > LIMITS.depth || ++this.budget.contexts > LIMITS.contexts) fail('limit', 'the shared invocation-context or nesting budget was exceeded');
        if (isDynamic(a[0])) fail('dynamic-command', 'the executable word must be literal');
        const b = baseName(a[0].text);
        if (isAssignment(a[0])) fail('unsupported', 'an assignment occurs outside a modeled assignment prefix');
        if (!b || b.startsWith('-') || b.startsWith('=')) wrapperFailure();
        // The resolver decides whether argv is data, a transparent payload, source, or an opaque file/task boundary.
        const effect = this.resolve(command, a, b);
        if (effect.kind === 'argv') return this.analyze(command, effect.argv, depth + 1, shellDepth);
        if (effect.kind === 'program') {
            if (shellDepth >= LIMITS.shellDepth) fail('limit', 'the shell inline-program nesting budget was exceeded');
            return this.program(parseProgram(effect.text, { budget: this.budget, depth: depth + 1, parent: command.context.id }), depth + 1, shellDepth + 1);
        }
        if (effect.kind === 'find') return this.find(command, a, depth, shellDepth);
        if (a.some(isDynamic) && !DYNAMIC_SAFE.has(b)) fail('dynamic-argument', 'a word of this command is computed at run time and this invocation is not a modeled data-only form');
        if (a.some(entry => entry.special === '{}' || (entry.special && b !== '['))) fail('unsupported', 'a shell placeholder or test delimiter occurs outside its modeled operand position');
        if (DYNAMIC_SAFE.has(b)) this.dataOnly(a, b);
        if (effect.kind !== 'modeled') return; // Explicit opaque-file/repository-task boundary, not source certification.
        this.policy(a, b);
    }

    resolve(command, a, b) {
        const texts = () => a.map(requireLiteral);
        if (BUILTINS.has(b)) fail('unmodeled-builtin', 'a shell state, evaluator, or variable builtin is outside the modeled invocation profiles');
        if (UNKNOWN_CARRIERS.has(b) || b === 'watch') wrapperFailure();
        if (b === 'command' || b === 'builtin') {
            let index = 1;
            if (b === 'command' && a[index]?.text === '-p') index++;
            if (b === 'command' && ['-v', '-V'].includes(a[index]?.text)) {
                if (!a[index + 1] || a.slice(index + 1).some(entry => requireLiteral(entry).startsWith('-'))) wrapperFailure();
                return { kind: 'opaque-file' }; // Lookup only, not execution.
            }
            if (a[index]?.text === '--') index++;
            if (!a[index] || requireLiteral(a[index]).startsWith('-')) wrapperFailure();
            return { kind: 'argv', argv: a.slice(index) };
        }
        if (b === 'pi-phase') {
            if (requireLiteral(a[1]) !== 'run') wrapperFailure();
            let index = 2;
            const values = new Set('kind label policy priority timeout queue-timeout log tail profile'.split(' '));
            const flags = new Set(['expect-red']);
            while (a[index] && a[index].text !== '--') {
                const name = requireLiteral(a[index]);
                if (!name.startsWith('--')) wrapperFailure();
                if (values.has(name.slice(2))) {
                    const value = requireLiteral(a[++index]);
                    if (!value || value.startsWith('-')) wrapperFailure();
                } else if (!flags.has(name.slice(2))) wrapperFailure();
                index++;
            }
            if (!a[index] || !a[index + 1]) wrapperFailure();
            return { kind: 'argv', argv: a.slice(index + 1) };
        }
        if (b === 'rtk') {
            if (requireLiteral(a[1]) === 'proxy') return { kind: 'argv', argv: a.slice(2) };
            // rtk's known direct tool profiles; unknown subcommands can be code carriers.
            if (!['git', 'kubectl', 'docker', 'gh', 'cratis', 'dotnet', 'npm', 'yarn'].includes(requireLiteral(a[1]))) wrapperFailure();
            return { kind: 'argv', argv: a.slice(1) };
        }
        if (WRAPPERS[b]) {
            let index = optionsEnd(a, 1, WRAPPERS[b]);
            if (b === 'timeout') {
                if (!a[index] || !/^\d+(?:\.\d+)?[smhd]?$/.test(requireLiteral(a[index++]))) wrapperFailure();
            }
            if (b === 'sudo') {
                while (a[index] && isAssignment(a[index])) { requireLiteral(a[index]); validateAssignment(a[index++]); }
            }
            if (b === 'env') {
                while (a[index] && isAssignment(a[index])) { requireLiteral(a[index]); validateAssignment(a[index++]); }
                if (!a[index]) {
                    this.report('env with no command prints the whole environment, including credentials; env | ... is blocked too', 'printenv with the one non-credential variable you need, e.g. printenv HOME');
                    return { kind: 'modeled' };
                }
            }
            if (!a[index] || requireLiteral(a[index]).startsWith('-')) wrapperFailure();
            let argv = a.slice(index);
            if (b === 'xargs') {
                // Stdin supplies unknown operands (and may replace a placeholder). It never supplies a known executable.
                const replacement = a.slice(1, index).some(entry => /^(-I|--replace)/.test(entry.text));
                if (replacement && !a.slice(1, index).some(entry => entry.text === '{}' || entry.text === '-I{}' || entry.text === '--replace={}')) wrapperFailure();
                argv = argv.map(entry => entry.text.includes('{}') ? unknownWord() : entry);
                if (!replacement) argv.push(unknownWord());
            }
            return { kind: 'argv', argv };
        }
        if (SHELLS.has(b)) return this.shell(command, a);
        if (OTHER_SHELLS.has(b) || INTERPRETERS.test(b)) return this.interpreter(a, b);
        if (b === 'git') return this.git(a);
        if (['npx', 'npm', 'yarn', 'pnpm', 'bun', 'deno', 'dotnet'].includes(b)) return this.repositoryTask(a, b);
        if (['awk', 'gawk', 'sed', 'yq'].includes(b)) fail('unmodeled-language', 'an embedded-language invocation is outside the supported projection profiles');
        if (b === 'jq') {
            const t = texts();
            let index = 1;
            while (['-r', '-c', '-e', '-s', '-S', '--raw-output', '--compact-output', '--exit-status'].includes(t[index])) index++;
            if (!/^\.(?:[A-Za-z_][A-Za-z0-9_]*(?:\[\d*\])?\.?)*$/.test(t[index] ?? '')) fail('unmodeled-language', 'only literal data projections are modeled for this reader');
            if (t.slice(index + 1).some(text => text.startsWith('-'))) fail('unmodeled-language', 'the projection reader has an unmodeled option');
        }
        if (b === 'find') return { kind: 'find' };
        if (b === 'kubectl' || b === 'oc') {
            const index = optionsEnd(a, 1, optionSpec('n', '', 'namespace context kubeconfig server cluster user'));
            const subcommand = requireLiteral(a[index]);
            if (subcommand === 'exec') return this.remote(a, index + 1, false);
            if (['run', 'debug', 'plugin'].includes(subcommand)) wrapperFailure();
        }
        if (['docker', 'podman', 'docker-compose'].includes(b)) {
            let index = optionsEnd(a, 1, optionSpec('Hc', '', 'host context config log-level', 'debug tls tlsverify'));
            if (requireLiteral(a[index]) === 'compose') {
                index = optionsEnd(a, index + 1, optionSpec('fp', '', 'file project-name project-directory profile env-file'));
            }
            const subcommand = requireLiteral(a[index]);
            if (subcommand === 'exec') return this.remote(a, index + 1, true);
            if (['run', 'create'].includes(subcommand)) wrapperFailure();
        }
        const modeled = DYNAMIC_SAFE.has(b) || ['kubectl', 'oc', 'docker', 'podman', 'docker-compose', 'gh', 'vault', 'aws', 'az', 'gcloud', 'pulumi', 'cratis', 'printenv'].includes(b)
            || /^(cat|tac|nl|less|more|head|tail|bat|batcat|strings|xxd|od|hexdump|cut|sort|uniq|base64|grep|egrep|fgrep|rg|ag|jq)$/.test(b);
        return { kind: modeled ? 'modeled' : 'opaque-file' };
    }

    shell(command, a) {
        const t = a.map(requireLiteral);
        if (t.length === 2 && ['--version', '--help'].includes(t[1])) return { kind: 'opaque-file' };
        if (t.length === 1 || command.heredocs.length || command.inputs.length) fail('stdin-shell', 'a shell program supplied on standard input is not modeled');
        if (/^-[elu]*c$/.test(t[1]) && new Set(t[1].slice(1, -1)).size === t[1].length - 2) {
            if (t.length < 3) fail('unmodeled-shell', 'a shell -c invocation is missing its literal program');
            return { kind: 'program', text: t[2] };
        }
        let index = 1;
        if (/^-[eux]+$/.test(t[index])) index++;
        if (!t[index] || /^[-+]/.test(t[index])) fail('unmodeled-shell', 'the complete shell option and program form is not modeled');
        return { kind: 'opaque-file' };
    }

    interpreter(a, b) {
        const t = a.map(requireLiteral);
        const refuse = () => fail('unmodeled-interpreter', 'an inline, stdin, or unknown interpreter invocation is outside the literal file/module profile');
        if (OTHER_SHELLS.has(b)) refuse();
        if (t.length === 2 && ['--help', '--version', '-V'].includes(t[1])) return { kind: 'opaque-file' };
        let index = 1;
        if (/^node/.test(b)) {
            const valued = new Set(['--import', '--require', '-r', '--loader', '--test-concurrency', '--test-name-pattern', '--test-reporter', '--test-reporter-destination']);
            const flags = new Set(['--test', '--no-warnings', '--enable-source-maps', '--experimental-strip-types']);
            while (t[index]?.startsWith('-')) {
                const [name, ...value] = t[index].split('=');
                if (valued.has(name)) {
                    if (!value.length) { if (!t[++index] || t[index].startsWith('-')) refuse(); }
                    else if (!value.join('=')) refuse();
                } else if (!flags.has(name) || value.length) refuse();
                index++;
            }
        } else if (/^python/.test(b)) {
            while (['-u', '-B', '-E', '-I', '-s', '-S'].includes(t[index])) index++;
            if (t[index] === '-m') {
                if (!t[index + 1] || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(t[index + 1])) refuse();
                return { kind: 'opaque-file' };
            }
        } else if (/^ruby/.test(b) || b === 'perl') {
            while (['-w', '-W'].includes(t[index])) index++;
        } else if (b === 'php' && t[index] === '-f') index++;
        else if (['pwsh', 'powershell'].includes(b)) {
            if (t[index]?.toLowerCase() === '-noprofile') index++;
            if (t[index]?.toLowerCase() !== '-file') refuse();
            index++;
        }
        if (!t[index] || t[index].startsWith('-')) refuse();
        return { kind: 'opaque-file' };
    }

    git(a) {
        const t = a.map(requireLiteral);
        let index = 1;
        while (t[index]?.startsWith('-')) {
            if (['--no-pager', '--literal-pathspecs', '--no-optional-locks'].includes(t[index])) { index++; continue; }
            if (['-C', '--git-dir', '--work-tree'].includes(t[index])) {
                if (!t[++index] || t[index].startsWith('-')) break;
                index++; continue;
            }
            fail('unmodeled-git', 'Git command-valued configuration, execution overrides or unknown global dispatch is not modeled');
        }
        if (!['status', 'log', 'diff', 'show', 'rev-parse', 'worktree', 'add', 'commit'].includes(t[index])) fail('unmodeled-git', 'unknown Git dispatch may resolve to an executable alias or command-valued configuration');
        return { kind: 'opaque-file' };
    }

    repositoryTask(a, b) {
        const t = a.map(requireLiteral);
        let valid = false;
        if (b === 'npm') valid = ['test', 'run'].includes(t[1]) && (t[1] !== 'run' || ['build', 'test', 'check', 'lint'].includes(t[2]));
        if (b === 'yarn') valid = ['build', 'test', 'check', 'lint'].includes(t[1])
            || (t[1] === 'run' && ['build', 'test', 'check', 'lint'].includes(t[2]))
            || (t[1] === 'workspace' && t[2] && !t[2].startsWith('-') && t[3] === 'run' && ['build', 'test', 'check', 'lint'].includes(t[4]));
        if (b === 'dotnet') valid = ['build', 'test'].includes(t[1]);
        if (!valid) fail('unmodeled-launcher', 'a package/code launcher is outside the explicit repository build/test task profiles');
        return { kind: 'repository-task' };
    }

    remote(a, start, docker) {
        const spec = docker ? optionSpec('euw', 'dit', 'env env-file user workdir detach-keys', 'detach interactive tty privileged')
            : optionSpec('cn', 'itq', 'container namespace context', 'stdin tty quiet');
        spec.validate = (name, value) => {
            if (name === 'env-file') wrapperFailure();
            if (name === 'e' || name === 'env') validateAssignment(literalWord(value));
        };
        let index = optionsEnd(a, start, spec);
        if (!a[index] || requireLiteral(a[index]).startsWith('-')) wrapperFailure();
        index++; // Pod/container name, not executable argv.
        index = optionsEnd(a, index, spec);
        if (!a[index]) wrapperFailure();
        return { kind: 'argv', argv: a.slice(index) };
    }

    find(command, a, depth, shellDepth) {
        let index = 1;
        const unary = new Set('-maxdepth -mindepth -name -iname -path -ipath -type -user -group -size -mtime -mmin -newer'.split(' '));
        const flags = new Set(['-print', '-print0', '-delete', '-depth', '-xdev', '-mount', '-L', '-P', '-H', '!', '-a', '-o']);
        while (index < a.length) {
            const text = requireLiteral(a[index]);
            if (['-exec', '-execdir', '-ok', '-okdir'].includes(text)) {
                const start = ++index;
                while (a[index] && (isDynamic(a[index]) || ![';', '+'].includes(a[index].text))) index++;
                if (!a[index] || index === start) wrapperFailure();
                const argv = a.slice(start, index).map(entry => entry.text.includes('{}') ? unknownWord() : entry);
                this.analyze(command, argv, depth + 1, shellDepth);
                index++; continue;
            }
            if (unary.has(text)) { if (!a[++index]) wrapperFailure(); requireLiteral(a[index]); }
            else if (!flags.has(text) && (text.startsWith('-') || text === '{}')) wrapperFailure();
            index++;
        }
    }

    dataOnly(a, b) {
        const args = a.slice(1);
        const bad = () => fail('evaluated-argument', 'the operands do not match a non-evaluating builtin schema');
        if (b === 'printf') {
            const index = args[0]?.text === '--' && !isDynamic(args[0]) ? 1 : 0;
            if (!args[index] || isDynamic(args[index]) || (index === 0 && args[index].text.startsWith('-'))) bad();
            if (args.some(entry => entry.raw.includes('[') && /[$`]/.test(entry.raw))) bad();
            // Numeric conversions and %n can evaluate or assign names in supported shell families. Only data
            // conversions are modeled, with flags/width/precision consumed as part of a complete directive.
            const format = args[index].text;
            for (let offset = 0; offset < format.length; offset++) {
                if (format[offset] !== '%') continue;
                const directive = /^%(?:%|[-+ #0]*[0-9]*(?:\.[0-9]+)?[sbq])/.exec(format.slice(offset));
                if (!directive) bad();
                offset += directive[0].length - 1;
            }
            return;
        }
        if (b === 'test' || b === '[') {
            if (b === '[' && (args.at(-1)?.text !== ']' || isDynamic(args.at(-1)))) bad();
            const operands = b === '[' ? args.slice(0, -1) : args;
            const staticAt = index => operands[index] && !isDynamic(operands[index]);
            const integerAt = index => staticAt(index) && /^-?[0-9]+$/.test(operands[index].text);
            const plain = entry => !entry.raw.includes('[') || !/[$`]/.test(entry.raw);
            if (!operands.every(plain)) bad();
            if (operands.length === 2 && staticAt(0) && UNARY.has(operands[0].text)) return;
            if (operands.length === 3 && staticAt(1) && STRING_OPS.has(operands[1].text)) return;
            if (operands.length === 3 && staticAt(1) && INTEGER_OPS.has(operands[1].text) && integerAt(0) && integerAt(2)) return;
            bad();
        }
        if (b === 'cd' || b === 'mkdir' || b === 'sleep') {
            let index = 0;
            if (b === 'cd' && ['-L', '-P', '--'].includes(args[0]?.text) && !isDynamic(args[0])) index++;
            if (b === 'mkdir') {
                while (args[index] && !isDynamic(args[index]) && ['-p', '-v', '--'].includes(args[index].text)) index++;
            }
            // End option processing explicitly before unknown data; a variable must not synthesize an option.
            if (args.slice(index).some(entry => !isDynamic(entry) && entry.text.startsWith('-'))) bad();
            if (b === 'cd' && args.length - index > 1) bad();
        }
    }

    checkPath(path, tool) {
        const kind = sensitivePath(path);
        if (kind) this.report(`${tool} of ${kind} prints credentials`, 'name the file and the key you need in your report; ask the user to confirm a value instead of printing it; for an env template read the .env.example');
    }

    policy(a, b) {
        if (b === 'kubectl' || b === 'oc') return this.kube(a);
        if (['docker', 'podman', 'docker-compose'].includes(b)) return this.docker(b === 'docker-compose' ? [literalWord('docker'), literalWord('compose'), ...a.slice(1)] : a);
        if (b === 'gh') return this.gh(a);
        if (b === 'vault') {
            const [p0, p1] = kparse(a, 1, '').P.map(entry => entry.text);
            if (p0 === 'read' || (p0 === 'kv' && ['get', 'read'].includes(p1))) this.report(`vault ${p0}${p0 === 'kv' ? ` ${p1}` : ''} prints secret values`, 'vault kv list or vault kv metadata get for the key names; name the path and key in your report');
        }
        if (b === 'aws') {
            const [p0, p1 = ''] = kparse(a, 1, '').P.map(entry => entry.text);
            if (p0 === 'secretsmanager' && p1 === 'get-secret-value') this.report('aws secretsmanager get-secret-value prints the secret', 'aws secretsmanager list-secrets or describe-secret (metadata only)');
            if (p0 === 'configure' && p1 === 'export-credentials') this.report('aws configure export-credentials prints the credentials', 'aws sts get-caller-identity to confirm who you are');
            if (p0 === 'ssm' && p1.startsWith('get-parameter') && a.some(entry => entry.text === '--with-decryption')) this.report('aws ssm get-parameter* --with-decryption prints decrypted parameters', 'aws ssm describe-parameters, or get-parameter without --with-decryption');
        }
        if (b === 'az') {
            const [p0, p1, p2] = kparse(a, 1, 'n').P.map(entry => entry.text);
            if (p0 === 'keyvault' && p1 === 'secret' && ['show', 'download'].includes(p2)) this.report(`az keyvault secret ${p2} prints the secret`, 'az keyvault secret list, or az keyvault secret show-deleted metadata only; name the secret in your report');
            if (p0 === 'account' && p1 === 'get-access-token') this.report('az account get-access-token prints a bearer token', 'az account show');
        }
        if (b === 'gcloud') {
            const [p0, p1, p2] = kparse(a, 1, '').P.map(entry => entry.text);
            if (p0 === 'secrets' && p1 === 'versions' && p2 === 'access') this.report('gcloud secrets versions access prints the secret', 'gcloud secrets versions list, or gcloud secrets describe (metadata only)');
            if (p0 === 'auth' && kparse(a, 1, '').P.slice(1).some(entry => /^print-(access|identity)-token$/.test(entry.text))) this.report('gcloud auth token printing reads a token', 'gcloud auth list');
        }
        if (b === 'pulumi' && a.some(entry => entry.text.startsWith('--show-secrets'))) this.report('pulumi --show-secrets prints decrypted secrets', 'pulumi config / pulumi stack output without --show-secrets (secrets stay masked)');
        if (b === 'cratis') {
            const t = a.map(entry => entry.text);
            if (t.includes('config') && t.includes('get') && t.some(text => text.startsWith('--show-secret'))) this.report('cratis config get --show-secret prints a decrypted secret', 'cratis config get without --show-secret (a secret prints as [secret]); name the key in your report');
        }
        if (b === 'printenv') {
            const names = a.slice(1).filter(entry => !entry.text.startsWith('-'));
            if (!names.length) this.report('printenv with no variable name prints the whole environment, including credentials', 'printenv with the one non-credential variable you need, e.g. printenv HOME');
            if (names.some(entry => CREDENTIAL_NAME.test(entry.text))) this.report('printenv of a credential-named variable prints a credential', 'name the variable and ask the user to confirm it without printing its value');
        }
        if (/^(cat|tac|nl|less|more|head|tail|bat|batcat|strings|xxd|od|hexdump|cut|sort|uniq|base64|grep|egrep|fgrep|rg|ag|jq)$/.test(b)) this.reader(a, b);
    }

    kube(a) {
        const k = kparse(a, 1, 'nlcsfkLR');
        const verb = k.P[0]?.text;
        if (verb === 'config') {
            if (k.P[1]?.text === 'view' && k.raw) this.report('kubectl config view --raw prints the cluster credentials', 'kubectl config view (redacted), kubectl config current-context, or kubectl config get-contexts');
            return;
        }
        if (verb !== 'get' && verb !== 'describe') return;
        const first = k.P[1]?.text ?? '';
        let list = first;
        if (first.includes('/')) for (let index = 2; index < k.P.length; index++) if (k.P[index].text.includes('/')) list += `,${k.P[index].text}`;
        for (const part of list.toLowerCase().split(',')) {
            const resource = part.replace(/\/.*/, '').replace(/\..*/, '');
            if (['secret', 'secrets'].includes(resource)) {
                if (verb === 'describe' || k.outfmt !== 'name') this.report(`kubectl ${verb} secret prints secret data`, 'kubectl get secrets -o name to list them, or name the secret and key in your report instead of reading it');
            } else if (SENSITIVE_RESOURCES.has(resource)) {
                const alt = `-o jsonpath=${SQ}{.items[*].spec.containers[*].image}${SQ}, -o custom-columns=NAME:.metadata.name,STATUS:.status.phase, -o name, -o wide, or the status fields you need`;
                if (verb === 'describe') this.report(`kubectl describe ${resource} prints the full container spec, including inline credentials`, `kubectl get ${resource} -o jsonpath=${SQ}{.items[*].spec.containers[*].image}${SQ}, -o custom-columns=NAME:.metadata.name,STATUS:.status.phase, -o name, or kubectl get events / kubectl logs; say which field you need`);
                else if (['json', 'yaml'].includes(k.outfmt)) this.report(`kubectl get ${resource} -o ${k.outfmt} prints the full container spec, including inline credentials`, alt);
                else if ((/^(jsonpath|go-template|jsonpath-as-json)=/.test(k.outfmt) || k.tmpl !== '') && projectionLeaks(k.tmpl + k.outfmt)) this.report(`kubectl get ${resource} with a projection that selects the whole object prints the full container spec, including inline credentials`, alt);
            }
        }
    }

    docker(a) {
        const k = kparse(a, 1, 'Hceuwlpfv');
        const off = k.P[0]?.text === 'compose' ? 1 : 0;
        const sub = k.P[off]?.text;
        const next = k.P[off + 1]?.text;
        if ((sub === 'inspect' || (['container', 'image', 'service'].includes(sub) && next === 'inspect')) && (k.fmtval === '' || formatLeaks(k.fmtval))) this.report('docker inspect prints the container environment, including credentials', `docker inspect --format ${SQ}{{.State.Status}}${SQ} (or {{.Config.Image}}, {{.NetworkSettings.IPAddress}}), docker ps, or docker logs`);
        if (off && sub === 'config' && !a.some(entry => /^(--services|--volumes|--profiles|--images|--networks|--quiet|-q)$/.test(entry.text))) this.report('docker compose config prints the resolved environment, including credentials', 'docker compose config --services, or read the compose file and name the variables instead of printing their values');
    }

    gh(a) {
        const k = kparse(a, 1, 'XHfFqtR');
        const [p0, p1] = k.P.map(entry => entry.text);
        if (p0 === 'secret' && !['set', 'delete', 'remove'].includes(p1)) this.report('gh secret other than set, delete or remove reads the repository secret store', 'gh secret set NAME (writes nothing to the output); refer to secrets by name only');
        if (p0 === 'auth' && (p1 === 'token' || (p1 === 'status' && a.some(entry => ['-t', '--show-token'].includes(entry.text))))) this.report('gh auth token printing reads the GitHub token', 'gh auth status without --show-token');
        if (p0 === 'api') {
            let method = 'GET';
            for (let index = 1; index < a.length; index++) {
                if (['-X', '--method'].includes(a[index].text)) method = a[++index]?.text.toUpperCase() ?? '';
                else if (a[index].text.startsWith('--method=')) method = a[index].text.slice(9).toUpperCase();
            }
            if (!['PUT', 'PATCH', 'DELETE'].includes(method) && k.P.slice(1).some(entry => /(^|\/)secrets([/?]|$)/i.test(entry.text))) this.report('gh api against a secrets endpoint reads the repository secret store', 'gh secret set NAME for writes; name the secret instead of reading it');
        }
    }

    reader(a, b) {
        const pattern = /^(grep|egrep|fgrep|rg|ag|jq)$/.test(b);
        const shortValues = /^(grep|egrep|fgrep)$/.test(b) ? 'mABCdD' : b === 'rg' ? 'mABCdjEMrgtT' : b === 'ag' ? 'ABCGgmpW' : ['head', 'tail'].includes(b) ? 'nc' : b === 'cut' ? 'dfbc' : b === 'sort' ? 'ktoST' : '';
        const longValues = new Set('glob type type-not max-count include exclude exclude-dir context after-context before-context max-depth threads'.split(' ').map(name => `--${name}`));
        let needPattern = pattern;
        let after = false;
        for (let index = 1; index < a.length; index++) {
            const text = a[index].text;
            if (!after && text === '--') { after = true; continue; }
            if (!after && text.startsWith('-') && text.length > 1) {
                if (/^--(regexp|file|expression|from-file)(=|$)/.test(text)) {
                    needPattern = false;
                    if (!text.includes('=')) this.checkPath(a[++index]?.text ?? '', b);
                } else if (longValues.has(text)) index++;
                else if (!text.startsWith('--')) {
                    for (let k = 1; k < text.length; k++) {
                        if (pattern && ['e', 'f'].includes(text[k])) { needPattern = false; if (k === text.length - 1) this.checkPath(a[++index]?.text ?? '', b); break; }
                        if (shortValues.includes(text[k])) { if (k === text.length - 1) index++; break; }
                    }
                }
                continue;
            }
            if (needPattern) { needPattern = false; continue; }
            this.checkPath(text, b);
        }
    }
}

export function classifyCommand(text) {
    const analyzer = new Analyzer();
    let refusal = null;
    try { analyzer.run(text); }
    catch (error) {
        refusal = error instanceof ShellRefusal ? { category: error.category, detail: error.detail }
            : { category: 'internal', detail: 'the secrets guard failed unexpectedly' };
    }
    return { findings: [...analyzer.findings.entries()], refusal };
}

const FOOTER = `
secrets.md: a credential must never enter an agent transcript, and a transcript is saved, summarized and
shared. Ask for the field you need (a jsonpath, custom-columns, -o name, a status field) and say which one;
refer to a secret by name (secret/key, environment variable) in notes, briefs and messages, never by value.

If a value has already appeared in output: stop, do not copy it onward, report "SECURITY INCIDENT" with the
tool-call location and the credential kind, and ask for rotation.

Do not retry this, rephrase it, or work around the guard (another wrapper, a script file, a variable, an
alias). A person who authorized the read sets CRATIS_HOOKS_ALLOW_SECRET_READS=1 in the environment the agent
harness was started from; setting it inside the command has no effect.
`;
export function renderVerdict(verdict) {
    const lines = verdict.findings.map(([what, alternative]) => `BLOCKED by cratis-guard-secrets: ${what}. Use instead: ${alternative}.`);
    if (verdict.refusal) {
        const guidance = REFUSAL_GUIDANCE[verdict.refusal.category] ?? REFUSAL_GUIDANCE.internal;
        lines.push(`BLOCKED by cratis-guard-secrets: the guard cannot analyze this command safely (${verdict.refusal.category}: ${verdict.refusal.detail}). Use instead: ${guidance}.`);
    }
    return lines.length === 0 ? '' : `${lines.join('\n')}\n${FOOTER}`;
}
const CLEAN_MARKER = 'cratis-guard-secrets: clean';
function isEntryPoint() {
    if (!process.argv[1]) return false;
    try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
}
function main() {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(0)); }
    catch { process.stderr.write('BLOCKED by cratis-guard-secrets: the command could not be read as UTF-8 text. Use instead: send the command as plain UTF-8 text.\n'); return 2; }
    if (text.length === 0) { process.stderr.write('BLOCKED by cratis-guard-secrets: the command is empty. Use instead: send the command text to analyze.\n'); return 2; }
    const output = renderVerdict(classifyCommand(text));
    if (output === '') { process.stdout.write(`${CLEAN_MARKER}\n`); return 0; }
    process.stderr.write(output);
    return 2;
}
if (isEntryPoint()) {
    let status = 2;
    try { status = main(); } catch { process.stderr.write('BLOCKED by cratis-guard-secrets: the guard failed unexpectedly. Use instead: rewrite the command with plain syntax.\n'); }
    process.exitCode = status;
}
