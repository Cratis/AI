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
# An extended-glob group (`@(a|b)`, `*(x)`) is also read as one star, so `.e@(n)v` meets `.env`.
# A word with a brace span and quoting or expansion syntax is also kept whole, so the classifier sees it unsplit.
# Whole-quoted words and `${...}` parameter expansions do not brace-expand and are not kept.
function extglob_star(s,    guard) {
    while (guard++ < 64 && match(s, /[@?*+!]\([^()]*\)/)) s = substr(s, 1, RSTART - 1) "*" substr(s, RSTART + RLENGTH)
    return s
}
# Quoted text never brace-expands or opens an extended glob, so its quoting, expansion and group syntax is
# neutralized before the classifier, which refuses that syntax in an unquoted spelling.
function quoted_literal(s) {
    if (index(s, "{")) gsub(/[$`"\047\\]/, "_", s)
    gsub(/[@?*+!]\(/, "__", s)
    return s
}
function raw_brace_word(w,    quote, first, bare) {
    if (!(w ~ /[$`"\047\\]/)) return
    first = substr(w, 1, 1); quote = (first == "\047" || first == "\"") ? first : ""
    if (quote != "" && substr(w, length(w), 1) == quote && index(substr(w, 2, length(w) - 2), quote) == 0) return
    bare = w; gsub(/\$\{/, "", bare)
    if (index(bare, "{")) candidate(w)
}
function raw_brace_scan(s,    n, i, c, word) {
    n = length(s)
    for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (c ~ /[ \t\n\r;|&<>]/) { raw_brace_word(word); word = "" }
        else word = word c
    }
    raw_brace_word(word)
}
function scan(s,    n, i, c, word, whole, flat) {
    flat = extglob_star(s)
    if (flat != s) scan(flat)
    n = length(s)
    for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (c ~ /[ \t\n\r;|&<>()\047"`$=\\]/) { candidate(word); word = "" }
        else word = word c
        if (c ~ /[ \t\n\r;|&<>()\047"`$]/) { candidate(whole); whole = "" }
        else whole = whole c
    }
    candidate(word); candidate(whole)
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
            if (q == c) { candidate(quoted_literal(quoted)); quoted = ""; q = "" } else q = c
            continue
        }
        out = out c; if (q != "") quoted = quoted c
    }
    return out
}
function protected(s) { return s in protected_paths }
# A lexical or structural failure: the command text is not modeled, so write-target mode falls back to
# classifying the whole text. A command the policy does not accept (cmd_failed) does the same: a protected
# reference anywhere in a command that is not entirely read-only must keep refusing it.
# Only when every command is accepted are the words of pure readers dropped from classification.
function fail() { bad = unparsed = 1 }
# Reference extraction for one stretch of raw command text.
function emit_text(t) { scan(t); scan(unquote(t)); raw_brace_scan(t) }
function endword() {
    if (!inword) return
    if (redirect) {
        if (!(redirect == 2 && word ~ /^([0-9]+|-)$/)) {
            file_redirect = 1
            if (changed_cwd) unparsed = 1
            if (changed_cwd || word ~ /[$`*?\[{]/ || protected(word)) bad = 1
        }
        redirect = 0
    } else {
        if (++argc > 256) fail()
        W[argc] = word
        globbed[argc] = glob
    }
    word = ""; inword = glob = 0
}
# Each exemption permits only the reviewed read/presentation options below. No unknown
# options, long-option abbreviations or implicit value-taking short clusters are accepted.
# Every table entry has a sibling ALLOW test and rejected-option neighbors.
function policy(verb, flags, longs,    words, n, k) {
    verbs[verb] = 1; short_options[verb] = flags
    n = split(longs, words, " ")
    for (k = 1; k <= n; k++) long_options[verb, words[k]] = 1
}
function short_flags(w, flags,    k) {
    if (w !~ /^-[^-]/) return 0
    for (k = 2; k <= length(w); k++) if (!index(flags, substr(w, k, 1))) return 0
    return 1
}
function number(s) { return s ~ /^[+-]?[0-9]+$/ }
function options_allowed(verb, first,    i, w) {
    for (i = first; i <= argc; i++) {
        w = W[i]
        if (w == "--") return 1
        if (w !~ /^-/ || w == "-") continue
        if ((verb, w) in long_options) continue
        if (verb == "head" || verb == "tail" || verb == "git log") {
            if (w == "-n" || (verb != "git log" && w == "-c")) {
                if (++i > argc || !number(W[i])) return 0
                continue
            }
            if (w ~ /^-n[+-]?[0-9]+$/ || w ~ /^-[0-9]+$/) continue
        }
        if (verb == "grep" || verb == "egrep" || verb == "fgrep") {
            if (w == "-e") { if (++i > argc) return 0; continue }
            if (w == "-A" || w == "-B" || w == "-C") {
                if (++i > argc || !number(W[i])) return 0
                continue
            }
        }
        if (verb == "git diff" && w ~ /^-U[0-9]+$/) continue
        if ((verb == "git log" && w ~ /^--(format|pretty)=/) || (verb == "git show" && w ~ /^--format=/)) {
            if (index(w, "%(")) return 0
            continue
        }
        if (verb == "git commit") {
            if (w == "-m" || w == "--message") { if (++i > argc) return 0; continue }
            if (w ~ /^-m./) continue
            if (w == "-F") {
                # Whether the file is protected is decided from the reference list, so its words are kept.
                force_emit = 1
                if (++i > argc || W[i] ~ /[$`*?\[{]/ || protected(W[i])) return 0
                continue
            }
        }
        if ((verb == "rg" && (w == "--glob" || w == "-g")) || (verb == "git grep" && (w == "-e" || w == "--regexp"))) {
            if (++i > argc || globbed[i]) return 0
            continue
        }
        if (!short_flags(w, short_options[verb])) return 0
    }
    return 1
}
# awk is read-only only for the shape awk [-F sep] 'program' operands. Every other option (-f, -v, -e, -i,
# --include, --, ...) is refused. awk output, execution and file reads need one of > | system getline close
# fflush or the gawk @ directives; a program containing any of them (in any letter case) is not accepted.
# This deny-list relies on awk having no other output primitive, which holds for POSIX, gawk, mawk and BSD awk.
function awk_allowed(    i, w, program) {
    i = 2
    if (W[i] == "-F") { if (++i > argc || W[i] ~ /[$`]/ || globbed[i]) return 0; i++ }
    else if (W[i] ~ /^-F/) { if (W[i] ~ /[$`]/ || globbed[i]) return 0; i++ }
    if (i > argc || W[i] ~ /^-/ || globbed[i]) return 0
    program = tolower(W[i])
    if (program ~ /[>|@]/ || index(program, "system") || index(program, "getline") || index(program, "close") || index(program, "fflush")) return 0
    for (i++; i <= argc; i++) if (W[i] ~ /^-/ && W[i] != "-") return 0
    return 1
}
# Only literal git -C metadata (with exact arity) or staging/commit commands
# (with their normal option checks) are exempt; no other global option is.
# -C gives no protection from hostile repository config (fsmonitor, hooks, pager,
# diff/textconv helpers). This filter checks syntax, not repository trust.
function directory_metadata() {
    if (argc < 5 || W[3] == "" || W[3] ~ /^-/ || globbed[3]) return 0
    if (argc == 5) return (W[4] == "status" && W[5] == "--short") || (W[4] == "rev-parse" && W[5] == "HEAD") || (W[4] == "branch" && W[5] == "--show-current")
    return argc == 6 && W[4] == "tag" && W[5] == "--list" && W[6] !~ /^-/
}
# -n alone is not read-only: sed scripts can still execute or write files.
# Only numeric/last-line print addresses qualify, with no additional options.
function print_only_sed(    i, ended) {
    if (argc < 4 || W[2] != "-n" || W[3] !~ /^([0-9]+(,([0-9]+|\$))?|\$)?p$/) return 0
    for (i = 4; i <= argc; i++) {
        if (!ended && W[i] == "--") { ended = 1; continue }
        if (!ended && W[i] ~ /^-/) return 0
    }
    return 1
}
function allow_command(    verb, first) {
    if (!argc) return
    if (++commands > 64) { fail(); return }
    verb = W[1]; first = 2
    if (verb == "cd") {
        directory_only = 1
        if (argc != 2 || W[2] == "" || W[2] ~ /^-/ || globbed[2] || file_redirect) fail()
        changed_cwd = 1
        return
    }
    if (verb == "sed") { if (!print_only_sed()) cmd_failed = 1; return }
    if (verb == "git" && W[2] == "-C") {
        if (argc >= 4 && W[3] != "" && W[3] !~ /^-/ && !globbed[3] && W[4] ~ /^(add|commit)$/) {
            verb = verb " " W[4]; first = 5
        } else {
            if (!directory_metadata()) cmd_failed = 1
            return
        }
    } else if (verb == "git") { verb = verb " " W[2]; first = 3 }
    if (verb == "git add" || verb == "git commit") changed_index = 1
    if (verb == "git branch") {
        conditional_only = 1
        if (argc != 3 || W[3] != "--show-current") { cmd_failed = 1; return }
    }
    if (verb == "awk") { if (!awk_allowed()) cmd_failed = 1; return }
    if (!(verb in verbs) || !options_allowed(verb, first)) cmd_failed = 1
}
# `upto` is the index just past the command's raw text; `resume` is where the next command's raw text starts.
# A command whose policy accepts it, with no redirect and no directory change, is a pure reader and its words
# are not write targets; every other command keeps all of its raw text classified.
function command_end(separator, upto, resume,    silent) {
    endword(); cmd_failed = 0; allow_command()
    if (cmd_failed) { bad = 1; unparsed = 1 }
    if (W[1] == "cd" && (separator == "|" || previous_pipe)) fail()
    silent = argc && !cmd_failed && !cmd_redirect && !force_emit && W[1] != "cd"
    if (!silent && upto > seg_start) emitted[++emitted_count] = substr(lexed, seg_start, upto - seg_start)
    seg_start = resume
    previous_pipe = (separator == "|")
    cmd_redirect = force_emit = 0
    delete W; delete globbed; argc = 0
}
function readonly(s,    i, c, c2, sq, dq) {
    lexed = s; seg_start = 1
    for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1); c2 = substr(s, i + 1, 1)
        if (sq) { if (c == "\047") sq = 0; else word = word c; continue }
        if (c == "\\") { if (c2 != "\n") { word = word c2; inword = 1 } else unparsed = 1; i++; continue }
        if (c == "\047" && !dq) { sq = inword = 1; continue }
        if (c == "\"") { dq = !dq; inword = 1; continue }
        # Expansions and globs can supply option words the per-verb tables never see.
        if (c == "`" || c == "$") fail()
        if (dq) { word = word c; continue }
        # Directory metadata requires a literal -C operand, not a pathname expansion.
        if (c == "*" || c == "?" || c == "[") glob = 1
        # A glob that starts a word, or follows a leading dash, may expand to an option word.
        if ((c == "*" || c == "?" || c == "[") && (word == "" ? !(c == "[" && c2 ~ /[ \t]/) : substr(word, 1, 1) == "-")) fail()
        if (c == "#" && !inword) { while (i <= length(s) && substr(s, i, 1) != "\n") i++; c = "\n" }
        if (c == "(" || c == ")" || c == "{" || c == "}") fail()
        if (c == ">" || c == "<" || (c == "&" && c2 == ">")) {
            cmd_redirect = 1
            if (inword && word ~ /^[0-9]+$/) { word = ""; inword = 0 } else endword()
            if (redirect) fail()
            if (c == "<" && (c2 == "<" || c2 == "(")) fail()
            redirect = c == ">" || c == "&" || (c == "<" && c2 == ">")
            if (c == ">" && c2 == "&") redirect = 2
            if (c2 ~ /[><&|]/) { i++; if (substr(s, i + 1, 1) == ">") i++ }
            continue
        }
        if (c == "&" && c2 == "&") { command_end("&&", i, i + 2); if (redirect) fail(); i++; continue }
        if (c == "|" && c2 != "|") { has_pipeline = 1; command_end("|", i, i + 1); if (redirect) fail(); continue }
        if (c ~ /[;|&\n]/) { nonconditional_separator = 1; command_end(c, i, i + 1); if (redirect) fail(); continue }
        if (c ~ /[ \t\r]/) { endword(); continue }
        word = word c; inword = 1
    }
    command_end("", length(s) + 1, length(s) + 1)
    if (sq || dq || redirect || (conditional_only && (nonconditional_separator || has_pipeline)) ||
        (directory_only && (nonconditional_separator || (has_pipeline && changed_index)))) fail()
    return !bad
}
BEGIN {
    policy("cat", "nAvetsb", "")
    policy("head", "", ""); policy("tail", "", "")
    policy("wc", "lwcm", ""); policy("ls", "laA1hdRtrF", "")
    policy("rg", "nli", "--files")
    policy("grep", "nirRlLcvwxFEHhoqs", "")
    policy("egrep", "nirRlLcvwxFEHhoqs", ""); policy("fgrep", "nirRlLcvwxFEHhoqs", "")
    policy("echo", "neE", "")
    policy("printf", "", ""); policy("test", "", ""); policy("[", "", "")
    policy("true", "", ""); policy("false", "", ""); policy("pwd", "", "")
    policy("df", "h", "")
    # jq has no file-write or exec primitive (output goes to stdout, debug to stderr), so its filter is a plain
    # operand. No value-taking option is accepted (--arg, -f, -L, --rawfile, --slurpfile, --from-file, --indent).
    policy("jq", "rcesnRSjaMC", "--raw-output --compact-output --slurp --null-input --exit-status --raw-input --sort-keys --join-output --ascii-output --monochrome-output --tab")
    policy("awk", "", "")
    policy("git status", "sb", "--short --porcelain")
    policy("git diff", "p", "--stat --numstat --name-only --name-status --cached --staged --check --no-color --cc")
    policy("git log", "p", "--oneline --stat --name-only --no-color --follow")
    policy("git show", "p", "--stat --name-only --no-color")
    policy("git add", "Aupv", "--all"); policy("git commit", "aq", "")
    policy("git blame", "", ""); policy("git ls-files", "s", "--stage --debug")
    policy("git branch", "", "--show-current")
    policy("git rev-parse", "", ""); policy("git check-ignore", "", ""); policy("git grep", "n", "")
    for (i = 0; i < 16; i++) HEX[substr("0123456789abcdef", i + 1, 1)] = i
    ESC["n"] = 10; ESC["r"] = 13; ESC["t"] = 9; ESC["\\"] = 92; ESC["\047"] = 39; ESC["\""] = 34
    text = ENVIRON["GSW_COMMAND"]
    if (ENVIRON["GSW_MODE"] == "references") { emit_text(text); exit 0 }
    if (ENVIRON["GSW_MODE"] == "targets") {
        readonly(text)
        if (unparsed) emit_text(text)
        else for (i = 1; i <= emitted_count; i++) emit_text(emitted[i])
        exit 0
    }
    n = split(ENVIRON["GSW_PROTECTED"], a, "\n"); for (i = 1; i <= n; i++) protected_paths[a[i]] = 1
    exit readonly(text) ? 0 : 1
}
AWK
candidates_text="$(GSW_COMMAND="$command_text" GSW_MODE=targets LC_ALL=C awk "$program" </dev/null)" || parser_failed
[ -n "$candidates_text" ] || exit 0
candidates=()
while IFS= read -r candidate; do candidates[${#candidates[@]}]="$candidate"; done <<<"$candidates_text"
classifier="$script_directory/cratis-guard-writes.sh"
[ -f "$classifier" ] || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard is missing).' >&2
    exit 2
}
classifier_input="$(jq -nc --arg cwd "$cwd" --args '{cwd:$cwd,tool_input:{file_paths:$ARGS.positional}}' -- "${candidates[@]}")" || parser_failed
# Tool labels and this hook shell do not establish the execution shell options.
# Keep conservative dotfile intersections for every command, especially mutators.
references="$("$BASH" "$classifier" --references <<<"$classifier_input")" || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard failed).' >&2
    exit 2
}
[ -n "$references" ] || exit 0
if GSW_COMMAND="$command_text" GSW_MODE=readonly GSW_PROTECTED="$references" LC_ALL=C awk "$program" </dev/null; then exit 0; fi
printf "BLOCKED by cratis-guard-shell-writes: protected reference '%s' (cratis-guard-writes). Use the edit/write tools, or report the intended change.\n" "${references%%$'\n'*}" >&2
exit 2
