#!/usr/bin/env bash
# Whole-command reference filter, not a shell interpreter or sandbox.
# The Write/Edit guard is the only protected-path policy. With any protected reference,
# accept only the small read-only command language below; never infer write destinations.
set -euo pipefail
export LC_ALL=C
script_directory="${BASH_SOURCE[0]%/*}"
[ "$script_directory" != "${BASH_SOURCE[0]}" ] || script_directory=.
# shellcheck source=SCRIPTDIR/hook-lib.sh
. "$script_directory/hook-lib.sh"
[ "${CRATIS_HOOKS_ALLOW_PROTECTED_WRITES:-0}" = 1 ] && exit 0
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
[ "$parser_status" = ok ] || parser_failed
[ -n "$command_text" ] || exit 0
cwd="${cwd:-$PWD}"
[ "${#command_text}" -le 131072 ] || parser_failed

IFS= read -r -d '' program <<'AWK' || true
function candidate(s) {
    if (s == "" || s ~ /[\n\r\t]/ || (s in seen)) return
    if (++candidates > 256 || length(s) > 4096) exit 2
    seen[s] = 1; print s
    if (s != tolower(s)) candidate(tolower(s))
    # A generic attached option prefix must not hide a path spelling (-t.pi/...).
    if (s ~ /^-/ && match(s, /[.\/]/) && RSTART > 1) candidate(substr(s, RSTART))
}
function scan(s,    n, i, c, word) {
    n = length(s)
    for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (c ~ /[ \t\n\r;|&<>()\047"`$=\\]/) { candidate(word); word = "" }
        else word = word c
    }
    candidate(word)
    # Braces have a second boundary view; retain the original pattern above too.
    if (s ~ /[{}]/) { gsub(/[{}]/, " ", s); scan(s) }
}
# Reuse ANSI-C decoding for reference spellings, not for interpreting shell code.
function ansi(s, i,    c, c2, v, k, limit, d, digits) {
    ansi_word = ""
    while (i <= length(s)) {
        c = substr(s, i++, 1)
        if (c == "\047") return i
        if (c != "\\") { ansi_word = ansi_word c; continue }
        c2 = substr(s, i++, 1); v = -1
        if (c2 in ESC) v = ESC[c2]
        else if (c2 ~ /^[0-7]$/) {
            v = c2 + 0
            for (k = 0; k < 2 && substr(s, i, 1) ~ /^[0-7]$/; k++) { v = v * 8 + substr(s, i++, 1) }
            v = v % 256
        } else if (c2 == "x" || c2 == "u" || c2 == "U") {
            limit = c2 == "x" ? 2 : c2 == "u" ? 4 : 8; v = digits = 0
            while (digits < limit && (d = tolower(substr(s, i, 1))) != "" && (d in HEX)) { v = v * 16 + HEX[d]; i++; digits++ }
            if (!digits || v > 255) v = -1
        }
        if (v > 0) ansi_word = ansi_word sprintf("%c", v)
        else if (v < 0) ansi_word = ansi_word c2
    }
    return i
}
function unquote(s,    i, c, c2, q, out, quoted) {
    for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1); c2 = substr(s, i + 1, 1)
        if (c == "$" && c2 == "\047" && q != "\047") { i = ansi(s, i + 2) - 1; out = out ansi_word; continue }
        if (c == "\\" && q != "\047") { if (c2 != "\n") { out = out c2; quoted = quoted c2 }; i++; continue }
        if ((c == "\047" || c == "\"") && (q == "" || q == c)) {
            if (q == c) { candidate(quoted); quoted = ""; q = "" } else q = c
            continue
        }
        out = out c; if (q != "") quoted = quoted c
    }
    return out
}
function protected(s) { return s in protected_paths }
function endword() {
    if (!inword) return
    if (redirect) {
        if (!(redirect == 2 && word ~ /^([0-9]+|-)$/) && (word ~ /[$`*?\[{]/ || protected(word))) bad = 1
        redirect = 0
    } else {
        if (++argc > 256) bad = 1
        W[argc] = word
    }
    word = ""; inword = 0
}
# These verbs are exempt only because their ordinary operation is read-only. Each has
# a paired allow test; removing one breaks that test. No wrappers/evaluators are exempt.
function allow_command(    b, i, w, subcommand, operands, endopts) {
    if (!argc) return
    if (++commands > 64) { bad = 1; return }
    b = W[1]
    if (b in plain) return
    if (b == "jq" || b == "yq" || b == "sort") {
        for (i = 2; i <= argc; i++) {
            w = W[i]
            if (w == "--") break
            if ((b == "sort" && (w ~ /^-[^-]*o/ || w ~ /^--output(=|$)/)) ||
                (b != "sort" && (w ~ /^-[^-]*i/ || w ~ /^--in-?place(=|$)/))) bad = 1
        }
        return
    }
    if (b == "uniq") {
        for (i = 2; i <= argc; i++) {
            w = W[i]
            if (!endopts && w == "--") { endopts = 1; continue }
            if (!endopts && w ~ /^-/ && w != "-") {
                if (w ~ /^(-[fsw]|--skip-fields|--skip-chars|--check-chars)$/) i++
                continue
            }
            operands++
        }
        if (operands > 1) bad = 1
        return
    }
    if (b == "git") {
        i = 2
        while (i <= argc && W[i] ~ /^-/) {
            if (W[i] == "-C") i += 2
            else if (W[i] == "--no-pager" || W[i] == "--literal-pathspecs") i++
            else { bad = 1; return }
        }
        if (!(W[i] in git_commands)) bad = 1
        return
    }
    if (b == "gh") {
        if (W[2] == "pr" || W[2] == "issue" || W[2] == "run") return
        if (W[2] != "api") { bad = 1; return }
        for (i = 3; i <= argc; i++) {
            w = W[i]
            if (w ~ /^-[^-]*[fF]/ || w ~ /^--(field|raw-field|input)(=|$)/) bad = 1
            if (w == "-X" || w == "--method") { if (W[++i] != "GET") bad = 1 }
            else if (w ~ /^-X./ && substr(w, 3) != "GET") bad = 1
            else if (w ~ /^--method=/ && substr(w, 10) != "GET") bad = 1
        }
        return
    }
    bad = 1
}
function command_end() { endword(); allow_command(); delete W; argc = 0 }
function readonly(s,    i, c, c2, sq, dq) {
    for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1); c2 = substr(s, i + 1, 1)
        if (sq) { if (c == "\047") sq = 0; else word = word c; continue }
        if (c == "\\") { if (c2 != "\n") { word = word c2; inword = 1 }; i++; continue }
        if (c == "\047" && !dq) { sq = inword = 1; continue }
        if (c == "\"") { dq = !dq; inword = 1; continue }
        if (c == "`" || (c == "$" && c2 ~ /[({[]/)) bad = 1
        if (dq) { word = word c; continue }
        if (c == "#" && !inword) { while (i <= length(s) && substr(s, i, 1) != "\n") i++; c = "\n" }
        if (c == "(" || c == ")" || c == "{" || c == "}") bad = 1
        if (c == ">" || c == "<" || (c == "&" && c2 == ">")) {
            if (inword && word ~ /^[0-9]+$/) { word = ""; inword = 0 } else endword()
            if (redirect) bad = 1
            if (c == "<" && (c2 == "<" || c2 == "(")) bad = 1
            redirect = c == ">" || c == "&" || (c == "<" && c2 == ">")
            if (c == ">" && c2 == "&") redirect = 2
            if (c2 ~ /[><&|]/) { i++; if (substr(s, i + 1, 1) == ">") i++ }
            continue
        }
        if (c ~ /[;|&\n]/) { command_end(); if (redirect) bad = 1; continue }
        if (c ~ /[ \t\r]/) { endword(); continue }
        word = word c; inword = 1
    }
    command_end()
    if (sq || dq || redirect) bad = 1
    return !bad
}
BEGIN {
    split("cat head tail less more wc grep egrep fgrep rg ag ls stat file diff cmp cut md5sum shasum sha256sum realpath dirname basename echo printf test [ true false pwd which type", a, " "); for (i in a) plain[a[i]] = 1
    split("status diff log show blame grep ls-files rev-parse add commit check-ignore", a, " "); for (i in a) git_commands[a[i]] = 1
    for (i = 0; i < 16; i++) HEX[substr("0123456789abcdef", i + 1, 1)] = i
    ESC["n"] = 10; ESC["r"] = 13; ESC["t"] = 9; ESC["\\"] = 92; ESC["\047"] = 39; ESC["\""] = 34
    text = ENVIRON["GSW_COMMAND"]
    if (ENVIRON["GSW_MODE"] == "references") { scan(text); scan(unquote(text)); exit 0 }
    n = split(ENVIRON["GSW_PROTECTED"], a, "\n"); for (i = 1; i <= n; i++) protected_paths[a[i]] = 1
    exit readonly(text) ? 0 : 1
}
AWK
candidates_text="$(GSW_COMMAND="$command_text" GSW_MODE=references LC_ALL=C awk "$program" </dev/null)" || parser_failed
[ -n "$candidates_text" ] || exit 0
candidates=()
while IFS= read -r candidate; do candidates[${#candidates[@]}]="$candidate"; done <<<"$candidates_text"
classifier="$script_directory/cratis-guard-writes.sh"
[ -f "$classifier" ] || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard is missing).' >&2
    exit 2
}
classifier_input="$(jq -nc --arg cwd "$cwd" --args '{cwd:$cwd,tool_input:{file_paths:$ARGS.positional}}' -- "${candidates[@]}")" || parser_failed
references="$("$BASH" "$classifier" --references <<<"$classifier_input")" || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard failed).' >&2
    exit 2
}
[ -n "$references" ] || exit 0
if GSW_COMMAND="$command_text" GSW_MODE=readonly GSW_PROTECTED="$references" LC_ALL=C awk "$program" </dev/null; then exit 0; fi
printf "BLOCKED by cratis-guard-shell-writes: protected reference '%s' (cratis-guard-writes). Use the edit/write tools, or report the intended change.\n" "${references%%$'\n'*}" >&2
exit 2
