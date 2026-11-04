#!/usr/bin/env bash
# PreToolUse hook — ask the Write/Edit guard about literal shell write destinations.
# Best-effort text filter, not a sandbox. Runtime names without a protected stem, aliases,
# functions, external scripts/programs (including awk/sed writes), find -exec, download/archive/
# patch tools, package-manager lockfile writes, deletion/rename sources, shell option changes,
# in-command symlink creation and new generated-marker content are outside this slice.
# The prefilter must remain a superset of every form understood by the parser below.
set -euo pipefail
script_directory="${BASH_SOURCE[0]%/*}"
[ "$script_directory" != "${BASH_SOURCE[0]}" ] || script_directory=.
# shellcheck source=SCRIPTDIR/hook-lib.sh
. "$script_directory/hook-lib.sh"

[ "${CRATIS_HOOKS_ALLOW_PROTECTED_WRITES:-0}" = "1" ] && exit 0
input=""
IFS= read -r -d '' input || true
[ -n "$input" ] || exit 0
hook_require_jq cratis-guard-shell-writes CRATIS_HOOKS_ALLOW_PROTECTED_WRITES
parser_failed() {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: parser failed; cannot check this tool call.' >&2
    exit 2
}
cwd="" command_text="" parser_status=""
{
    IFS= read -r -d '' cwd
    IFS= read -r -d '' command_text
    IFS= read -r -d '' parser_status
} < <(jq -j -s '
    def field(path): ([try (path // empty) catch empty] | first // "")
        | if type == "string" then . else tojson end | gsub("\u0000"; "");
    if length == 1 then .[0] else error("expected one JSON document") end
    | [field(.cwd), field(.tool_input.command)] | .[] | ., "\u0000"
' <<<"$input" 2>/dev/null && printf 'ok\0') || parser_failed
[ "$parser_status" = "ok" ] || parser_failed
[ -n "$command_text" ] || exit 0
cwd="${cwd:-$PWD}"
probe="${command_text//\\$'\n'/}"
probe="${probe//\'/}"; probe="${probe//\"/}"; probe="${probe//\\/}"
case "$probe" in
    *'>'* | *'$'* | *'`'* | *tee* | *cp* | *mv* | *install* | *ln* | *sed* | *perl* | *dd* | *truncate* | *eval* | *sh* | *xargs*) ;;
    *) exit 0 ;;
esac

# Tokenizer adapted from the store-mutation guard. Each word carries dynamic, pattern,
# leading-tilde and quoted bits; no shell text is executed. Queued shell bodies have a fuse.
IFS= read -r -d '' awk_program <<'AWK' || true
function base(w) { sub(/.*\//, "", w); return w }
function taint(text,    t) {
    t = tolower(text); gsub(/\\\n/, "", t); gsub(/[\047"\\]/, "", t)
    if (match(t, /\.env|directory\.packages\.props|global\.json|nuget\.config|yarn\.lock|package-lock\.json|pnpm-lock\.yaml|packages\.lock\.json|\.mcp\.json/)) STEM = substr(t, RSTART, RLENGTH)
    else if (match(t, /(^|[\/ =:"])\.(claude|pi|cratis)(\/|$|[^a-z0-9_.-])/)) STEM = "agent controls"
}
function refuse(form, reason) { failures = failures "refuse\t" form "\t\t" reason "\n" }
function enqueue(text) {
    if (text == "" || (text in seen)) return
    seen[text] = 1
    if (queued >= 64) { refuse("shell", "too many nested shell texts to check; split the command"); return }
    queue[++queued] = text; taint(text)
}
function ansi_c(s, i, n,    c, c2, v, d, k, lim, stop, digits) {
    stop = 0
    while (i <= n) {
        c = substr(s, i, 1)
        if (c == "\047") return i + 1
        if (c != "\\") { if (!stop) word = word c; i++; continue }
        c2 = substr(s, i + 1, 1); i += 2; v = -1
        if (c2 in ESC) v = ESC[c2]
        else if (c2 ~ /^[0-7]$/) {
            v = c2 + 0
            for (k = 0; k < 2 && substr(s, i, 1) ~ /^[0-7]$/; k++) { v = v * 8 + substr(s, i, 1); i++ }
            v = v % 256
        } else if (c2 == "x" || c2 == "u" || c2 == "U") {
            lim = (c2 == "x") ? 2 : (c2 == "u") ? 4 : 8; v = 0; digits = 0
            while (digits < lim && (d = tolower(substr(s, i, 1))) != "" && (d in HEX)) { v = v * 16 + HEX[d]; i++; digits++ }
            if (digits == 0) { if (!stop) word = word "\\" c2; continue }
            if (c2 != "x" && v >= 128) { if (!stop) word = word "?"; continue }
        } else if (c2 == "c" && i <= n) { v = ORD[substr(s, i, 1)] % 32; i++ }
        else { if (!stop) word = word "\\" c2; continue }
        if (v == 0) stop = 1
        else if (!stop) word = word CH[v]
    }
    bad = 1; return i
}
function target(form, lit, dyn, pat, tilde) {
    if (++targets > 64) { if (targets == 65) refuse(form, "too many write destinations to check; split the command"); return }
    if (lit ~ /[\n\t]/) { refuse(form, "cannot check a destination containing a newline or tab"); return }
    if (pat) { refuse(form, "a write destination may not be a pathname or brace pattern; name the file literally"); return }
    if (tilde && lit ~ /^~[^\/]/) dyn = 1
    if (tilde && !dyn) sub(/^~/, ENVIRON["GSW_HOME"], lit)
    if (lit ~ /^\/dev\/(null|stdout|stderr|tty)$/ || lit ~ /^\/dev\/fd\//) return
    TFORM[targets] = form; TLIT[targets] = lit; TDYN[targets] = dyn
}
function at(form, i) { target(form, W[i], D[i], P[i], T[i]) }
function directory(lit, dyn, pat, tilde) {
    if (dyn || pat || lit == "-" || (tilde && lit ~ /^~[^\/]/)) { cwd_unknown = 1; return }
    if (tilde) sub(/^~/, ENVIRON["GSW_HOME"], lit)
    if (lit == "") lit = ENVIRON["GSW_HOME"]
    if (dirs >= 8) { cwd_unknown = 1; return }
    if (lit !~ /^\//) lit = DIR[dirs] "/" lit
    DIR[++dirs] = lit
}
function reset_word() { word = ""; dyn = pat = tilde = quoted = inword = 0 }
function end_word() {
    if (inword) {
        taint(word)
        if (redirect != "") {
            if (redirect == "<<<") body[++bodies] = word
            else if (redirect != "<" && redirect != "<&" && !(redirect == ">&" && word ~ /^([0-9]+|-)$/)) target(redirect, word, dyn, pat, tilde)
            redirect = ""
        } else current = current (current == "" ? "" : SEP) dyn pat tilde quoted word
    }
    reset_word()
}
function emit() { end_word(); if (current != "") analyze(current); current = "" }
function push(kind) {
    depth++
    s_current[depth] = current; s_word[depth] = word; s_dyn[depth] = dyn; s_pat[depth] = pat; s_tilde[depth] = tilde
    s_quoted[depth] = quoted; s_dq[depth] = in_dq; s_kind[depth] = frame; s_parens[depth] = parens; s_redirect[depth] = redirect
    current = ""; reset_word(); in_dq = 0; frame = kind; parens = 0; redirect = ""
}
function pop() {
    emit()
    current = s_current[depth]; word = s_word[depth] "$()"; dyn = 1; pat = s_pat[depth]; tilde = s_tilde[depth]
    quoted = s_quoted[depth]; inword = 1; in_dq = s_dq[depth]; frame = s_kind[depth]; parens = s_parens[depth]; redirect = s_redirect[depth]
    depth--
}
function skip_group(s, i, opener, closer,    n, level, c) {
    n = length(s); level = 0
    for (; i <= n; i++) { c = substr(s, i, 1); if (c == opener) level++; else if (c == closer) { if (--level == 0) return i + 1 } }
    bad = 1; return n + 1
}
function heredocs(s, i,    n, k, nl, line, text, check, closed) {
    n = length(s)
    for (k = 1; k <= pending; k++) {
        text = ""; closed = 0
        while (i <= n) {
            nl = index(substr(s, i), "\n")
            if (!nl) { line = substr(s, i); i = n + 1 } else { line = substr(s, i, nl - 1); i += nl }
            check = line; if (strip[k]) sub(/^\t+/, "", check)
            if (check == delimiter[k]) { closed = 1; break }
            text = text line "\n"
        }
        if (!closed) bad = 1
        body[++bodies] = text
    }
    pending = 0; return i
}
function parse(s,    n, i, c, c2, j, k, op) {
    current = ""; reset_word(); redirect = ""; in_sq = in_dq = depth = parens = pending = bodies = stdin_shell = 0; frame = "top"
    n = length(s); i = 1
    while (i <= n) {
        c = substr(s, i, 1); c2 = substr(s, i + 1, 1)
        if (in_sq) { if (c == "\047") in_sq = 0; else word = word c; i++; continue }
        if (in_dq) {
            if (c == "\\") {
                if (c2 == "\n") { i += 2; continue }
                if (c2 == "\"" || c2 == "\\" || c2 == "$" || c2 == "`") { word = word c2; i += 2; continue }
                word = word c; i++; continue
            }
            if (c == "\"") { in_dq = 0; i++; continue }
            if (c == "$" && c2 == "(" && substr(s, i + 2, 1) != "(") { push("subst"); i += 2; continue }
            if (c == "`") { if (frame == "backtick") pop(); else push("backtick"); i++; continue }
            if (c == "$") dyn = 1
            word = word c; i++; continue
        }
        if (c == "\\") { if (c2 != "\n") { word = word c2; inword = 1 }; i += 2; continue }
        if (c == "\047") { in_sq = inword = quoted = 1; i++; continue }
        if (c == "\"") { in_dq = inword = quoted = 1; i++; continue }
        if (c == "#" && !inword) { while (i <= n && substr(s, i, 1) != "\n") i++; continue }
        if (c == "$") {
            if (c2 == "\047") { inword = quoted = 1; i = ansi_c(s, i + 2, n); continue }
            if (c2 == "\"") { in_dq = inword = quoted = 1; i += 2; continue }
            if (c2 == "(" && substr(s, i + 2, 1) != "(") { push("subst"); i += 2; continue }
            dyn = inword = 1
            if (c2 == "(" || c2 == "{") { j = skip_group(s, i + 1, c2, c2 == "(" ? ")" : "}"); word = word substr(s, i, j - i); i = j; continue }
            word = word c; i++; continue
        }
        if (c == "`") { if (frame == "backtick") pop(); else push("backtick"); i++; continue }
        if (c == "(") { if (!inword && c2 == "(") { i = skip_group(s, i, "(", ")"); continue }; emit(); parens++; i++; continue }
        if (c == ")") { if (parens > 0) { emit(); parens--; i++; continue }; if (frame == "subst") pop(); else emit(); i++; continue }
        if (c == "<" || c == ">" || (c == "&" && c2 == ">")) {
            if (c2 == "(") { push("subst"); i += 2; continue }
            if (inword && !quoted && word ~ /^[0-9]+$/) reset_word(); else end_word()
            if (c == "<" && c2 == "<" && substr(s, i + 2, 1) != "<") {
                i += 2; pending++; strip[pending] = 0; delimiter[pending] = ""
                if (substr(s, i, 1) == "-") { strip[pending] = 1; i++ }
                while (substr(s, i, 1) == " " || substr(s, i, 1) == "\t") i++
                while (i <= n) { c2 = substr(s, i, 1); if (c2 ~ /[ \t\n;&|<>()]/) break; if (c2 != "\047" && c2 != "\"" && c2 != "\\") delimiter[pending] = delimiter[pending] c2; i++ }
                continue
            }
            op = c; i++
            if (c == "&") { op = "&>"; i++; if (substr(s, i, 1) == ">") { op = "&>>"; i++ } }
            else if (c2 == "&" || c2 == ">" || c2 == "<" || c2 == "|") { op = op c2; i++; if (op == "<<" && substr(s, i, 1) == "<") { op = "<<<"; i++ } }
            redirect = op; continue
        }
        if (c == "&" || c == ";" || c == "|") { emit(); i++; continue }
        if (c == "\n") { emit(); i++; if (pending) i = heredocs(s, i); continue }
        if (c == " " || c == "\t" || c == "\r") { end_word(); i++; continue }
        if (c == "*" || c == "?" || c == "[") pat = 1
        if (c == "{" && match(substr(s, i), /^\{[^}]*([,]|\.\.)[^}]*\}/)) pat = 1
        if (c == "~" && !inword) tilde = 1
        word = word c; inword = 1; i++
    }
    emit()
    if (in_sq || in_dq || depth || redirect != "" || pending) bad = 1
    if (stdin_shell) for (k = 1; k <= bodies; k++) enqueue(body[k])
}
# Short value options consume their cluster suffix or the following word.
function option(w, letters,    k, c) {
    value = ""; next_value = 0; letter = ""
    if (w !~ /^-[^-]/) return 0
    for (k = 2; k <= length(w); k++) {
        c = substr(w, k, 1)
        if (index(letters, c)) { letter = c; value = substr(w, k + 1); next_value = (value == ""); return 1 }
    }
    return 0
}
function analyze(text,    parts, n, k, i, b, j, w, letters, replace, endopts, duration, command_at) {
    delete parts; delete W; delete D; delete P; delete T; delete Q
    n = split(text, parts, SEP)
    for (k = 1; k <= n; k++) { D[k] = substr(parts[k], 1, 1) + 0; P[k] = substr(parts[k], 2, 1) + 0; T[k] = substr(parts[k], 3, 1) + 0; Q[k] = substr(parts[k], 4, 1) + 0; W[k] = substr(parts[k], 5) }
    i = 1
    while (i <= n) {
        w = W[i]; b = base(w)
        if (w ~ /^[A-Za-z_][A-Za-z0-9_]*\+?=/ || (!Q[i] && (w in keyword))) { i++; continue }
        if (D[i]) { dynamic_command = 1; return }
        if (!(b in wrapper)) break
        i++; endopts = 0; duration = (b == "timeout"); replace = ""
        while (i <= n) {
            w = W[i]
            if (w == "--") { i++; break }
            if (b == "rtk" && w == "proxy") { i++; break }
            if (b == "env" && w ~ /^[A-Za-z_][A-Za-z0-9_]*=/) { i++; continue }
            if (w !~ /^-/ || w == "-") { if (duration) { duration = 0; i++; continue }; break }
            if (b == "env" && w ~ /^--split-string=/) { enqueue(substr(w, 16)); i++; continue }
            if (b == "env" && w ~ /^--chdir=/) { directory(substr(w, 9), D[i], P[i], T[i]); i++; continue }
            if (b == "env" && (w == "-C" || w == "--chdir")) { i++; directory(W[i], D[i], P[i], T[i]); i++; continue }
            if (b == "xargs" && w ~ /^--replace(=|$)/) { replace = w == "--replace" ? "{}" : substr(w, 11); i++; continue }
            letters = (b == "sudo" || b == "doas") ? "ugChprtUD" : b == "xargs" ? "IJniPLdsEa" : b == "timeout" ? "ks" : b == "nice" ? "n" : b == "env" ? "uCS" : b == "exec" ? "a" : ""
            if (option(w, letters)) {
                j = i; if (next_value) value = W[++i]
                if (b == "env" && letter == "C") directory(value, D[i], P[i], T[i])
                if (b == "env" && letter == "S") enqueue(value)
                if (b == "xargs" && (letter == "I" || letter == "J")) replace = value
            } else if (w == "--unset" || w == "--split-string" || w == "--user" || w == "--group" || w == "--signal" || w == "--kill-after" || w == "--arg-file" || w == "--max-args" || w == "--max-procs" || w == "--max-lines") i++
            i++
        }
        if (b == "xargs") {
            if (replace == "") { W[++n] = "$xargs"; D[n] = 1; P[n] = T[n] = Q[n] = 0 }
            else for (j = i; j <= n; j++) if (index(W[j], replace)) D[j] = 1
        }
    }
    if (i > n) return
    b = base(W[i])
    if (b == "cd" || b == "pushd") { directory(W[i + 1], D[i + 1], P[i + 1], T[i + 1]); return }
    if (b == "popd") { cwd_unknown = 1; return }
    if (b == "eval") { w = ""; for (j = i + 1; j <= n; j++) w = w (j == i + 1 ? "" : " ") W[j]; enqueue(w); return }
    if (b in shell) {
        command_at = 0
        for (j = i + 1; j <= n; j++) {
            if (W[j] ~ /^-[A-Za-z]*c[A-Za-z]*$/ || W[j] == "--command") { enqueue(W[j + 1]); return }
            if (W[j] == "-s") { stdin_shell = 1; return }
            if (W[j] == "-o" || W[j] == "+o" || W[j] == "-O" || W[j] == "+O" || W[j] == "--rcfile" || W[j] == "--init-file") { j++; continue }
            if (W[j] == "--") { if (j < n) command_at = 1; break }
            if (W[j] !~ /^[-+]/) { command_at = 1; break }
        }
        if (!command_at) stdin_shell = 1
        return
    }
    if (b == "cp" || b == "mv" || b == "install" || b == "ln") { copy_targets(b, i + 1, n); return }
    if (b == "sed" || b == "perl") { inplace_targets(b, i + 1, n); return }
    endopts = 0
    for (j = i + 1; j <= n; j++) {
        w = W[j]
        if (b == "dd") { if (w ~ /^of=/) target("dd of=", substr(w, 4), D[j], P[j], 0); continue }
        if (b != "tee" && b != "truncate") return
        if (!endopts && w == "--") { endopts = 1; continue }
        if (!endopts && w ~ /^-/ && w != "-") {
            if (b == "truncate" && (w == "--size" || w == "--reference" || (option(w, "sr") && next_value))) j++
            continue
        }
        at(b, j)
    }
}
function copy_targets(b, first, n,    j, w, operands, source, dest, destlit, destdyn, destpat, desttilde, tdir, no_dir, endopts, letters, k, src, name) {
    delete operand; operands = 0; tdir = 0; no_dir = 0; endopts = 0
    for (j = first; j <= n; j++) {
        w = W[j]
        if (!endopts && w == "--") { endopts = 1; continue }
        if (!endopts && w ~ /^-/ && w != "-") {
            if (b == "install" && w ~ /^-[^-]*d/) return
            if (w == "--directory" && b == "install") return
            if (w == "--no-target-directory" || w ~ /^-[^-]*T/) no_dir = 1
            if (w ~ /^--target-directory=/) { tdir = j; W[j] = substr(w, 20); continue }
            if (w == "--target-directory") { tdir = ++j; continue }
            if (w == "--suffix" || (b == "install" && w ~ /^--(mode|owner|group|strip-program)$/)) { j++; continue }
            letters = b == "install" ? "tSmogBf" : "tS"
            if (option(w, letters)) {
                if (next_value) { j++; value = W[j] } else W[j] = value
                if (letter == "t") tdir = j
            }
            continue
        }
        operand[++operands] = j
    }
    if (tdir) dest = tdir
    else { if (operands < 2) return; dest = operand[operands--] }
    destlit = W[dest]; destdyn = D[dest]; destpat = P[dest]; desttilde = T[dest]
    if (!tdir && (no_dir || operands == 1)) target(b " destination", destlit, destdyn, destpat, desttilde)
    if (no_dir) return
    for (k = 1; k <= operands; k++) {
        src = operand[k]; name = D[src] ? "" : W[src]; sub(/\/+$/, "", name); sub(/.*\//, "", name)
        target(b " destination", destlit "/" name, destdyn || D[src], destpat || P[src], desttilde)
    }
}
function inplace_targets(b, first, n,    j, w, k, c, inplace, expression, endopts, operands) {
    delete operand; inplace = expression = endopts = operands = 0
    for (j = first; j <= n; j++) {
        w = W[j]
        if (!endopts && w == "--") { endopts = 1; continue }
        if (!endopts && w ~ /^-/ && w != "-") {
            if (b == "sed") {
                if (w ~ /^--in-place(=|$)/ || w ~ /^-[^-]*i/) inplace = 1
                if (w == "--expression" || w == "--file") { expression = 1; j++ }
                else if (w ~ /^--(expression|file)=/) expression = 1
                else if (w == "--line-length") j++
                else if (option(w, "efl")) { if (letter != "l") expression = 1; if (next_value) j++ }
            } else {
                for (k = 2; k <= length(w); k++) {
                    c = substr(w, k, 1)
                    if (c == "i") { inplace = 1; break }
                    if (index("eEMmIx0lFCdD", c)) { if (c == "e" || c == "E") expression = 1; if (k == length(w)) j++; break }
                }
            }
            continue
        }
        operand[++operands] = j
        if (b == "perl") endopts = 1
    }
    if (!inplace) return
    for (k = expression ? 1 : 2; k <= operands; k++) if (W[operand[k]] != "") at(b " -i", operand[k])
}
BEGIN {
    SEP = sprintf("%c", 28)
    for (i = 1; i < 256; i++) { CH[i] = sprintf("%c", i); ORD[CH[i]] = i }
    for (i = 0; i < 16; i++) HEX[substr("0123456789abcdef", i + 1, 1)] = i
    ESC["a"] = 7; ESC["b"] = 8; ESC["e"] = ESC["E"] = 27; ESC["f"] = 12; ESC["n"] = 10; ESC["r"] = 13; ESC["t"] = 9; ESC["v"] = 11; ESC["\\"] = 92; ESC["\047"] = 39; ESC["\""] = 34; ESC["?"] = 63
    split("! { } if then else elif do while until", words, " "); for (i in words) keyword[words[i]] = 1
    split("sudo doas env command builtin exec nohup time nice timeout setsid rtk xargs", words, " "); for (i in words) wrapper[words[i]] = 1
    split("bash sh zsh dash ksh", words, " "); for (i in words) shell[words[i]] = 1
    dirs = 1; DIR[1] = ENVIRON["GSW_CWD"]
    enqueue(ENVIRON["GSW_COMMAND"])
    while (qi < queued) { qi++; parse(queue[qi]) }
    if (bad) exit 1
    if (dynamic_command && STEM != "") refuse("command", "the destination is built from expansions and the command names a protected file (" STEM "); use a literal destination")
    for (i = 1; i <= targets && i <= 64; i++) {
        if (!(i in TFORM)) continue
        lit = TLIT[i]
        if (TDYN[i] || (cwd_unknown && lit !~ /^\//)) {
            if (STEM != "") refuse(TFORM[i], "the destination is built from expansions and the command names a protected file (" STEM "); use a literal destination")
            if (TDYN[i]) continue
        }
        if (lit ~ /^\//) printf "path\t%s\t%s\t%s\n", TFORM[i], DIR[1], lit
        else for (j = 1; j <= dirs; j++) printf "path\t%s\t%s\t%s\n", TFORM[i], DIR[j], lit
    }
    printf "%s", failures
}
AWK
findings="$(GSW_COMMAND="$command_text" GSW_CWD="$cwd" GSW_HOME="${HOME:-}" LC_ALL=C awk "$awk_program" </dev/null)" || parser_failed
[ -n "$findings" ] || exit 0
footer() {
    printf '%s\n' 'The write guard refuses this target for Write/Edit too; a shell write is the same write. Do not retry through another shell form, a variable, a script file or another tool. If the user explicitly asked for this change, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES=1 must be set in the environment the harness was started from; setting it inside the command has no effect.' >&2
}
[ -f "$script_directory/cratis-guard-writes.sh" ] || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check destinations (write guard is missing).' >&2
    footer; exit 2
}
checked=$'\n'
# A non-whitespace separator preserves the empty directory field in refuse records.
while IFS= read -r line; do
    [ -n "$line" ] || continue
    kind="${line%%$'\t'*}"; line="${line#*$'\t'}"
    form="${line%%$'\t'*}"; line="${line#*$'\t'}"
    directory="${line%%$'\t'*}"; target="${line#*$'\t'}"
    if [ "$kind" = refuse ]; then
        printf 'BLOCKED by cratis-guard-shell-writes: %s: %s.\n' "$form" "$target" >&2
        footer; exit 2
    fi
    key="$directory"$'\t'"$target"
    case "$checked" in *$'\n'"$key"$'\n'*) continue ;; esac
    checked="$checked$key"$'\n'
    classifier_input="$(jq -nc --arg cwd "$directory" --arg file "$target" '{cwd:$cwd, tool_name:"Bash", tool_input:{file_path:$file}}')" || parser_failed
    status=0
    reason="$("$BASH" "$script_directory/cratis-guard-writes.sh" <<<"$classifier_input" 2>&1)" || status=$?
    if [ "$status" = 2 ]; then
        printf "BLOCKED by cratis-guard-shell-writes: the shell command writes '%s' (%s).\n%s\n" "$target" "$form" "$reason" >&2
        footer; exit 2
    elif [ "$status" != 0 ]; then
        printf "BLOCKED by cratis-guard-shell-writes: could not check '%s' (write guard exit %s).\n" "$target" "$status" >&2
        footer; exit 2
    fi
done <<EOF
$findings
EOF
