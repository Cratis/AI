#!/usr/bin/env bash
# Whole-command reference filter, not a shell interpreter or sandbox.
# The Write/Edit guard is the only protected-path policy. With any protected reference,
# accept only the reviewed command language below and its explicit copy-destination grammar.
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
archive_guidance() {
    printf '%s\n' 'Extract outside the agent shell (or ask the user), then copy the specific files needed.' >&2
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

# Only standalone corpus installer/repair invocations may bypass reference classification.
# The helper accepts a deliberately smaller language than the shell, never shell evaluation.
if [[ "$command_text" =~ ^[[:space:]]*(cratis|ln)[[:space:]] ]] && command -v node >/dev/null 2>&1; then
    repair_status=0
    node "$script_directory/cratis-guard-shell-writes-repair.mjs" "$cwd" "$command_text" || repair_status=$?
    case "$repair_status" in
        0) exit 0 ;;
        1) ;; # Not an installer/repair exception: preserve the ordinary reference policy.
        *)
            printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: managed link repair was refused; use the installer or report the intended change.' >&2
            exit 2
            ;;
    esac
fi

IFS= read -r -d '' program <<'AWK' || true
# `origin` is empty for a real candidate and the original spelling for its lowercase alias. In targets mode
# an alias is printed as \001origin\001alias so the shell can drop it where it provably names no path.
# A real candidate is never hidden by an earlier alias with the same text (seen: 1 alias, 2 real).
function candidate(s, origin,    prior, marker) {
    if (checking_marker) return
    if (s == "" || s ~ /[\n\r\t]/) return
    marker = ENVIRON["GSW_MODE"] == "targets"
    if (collecting) {
        if (s in collected) return
        if (++collected_count > 256 || length(s) > 4096) exit 2
        collected[s] = 1
    } else {
        if (origin == "" && marker && index(s, "\001")) exit 2
        prior = (s in seen) ? seen[s] : 0
        if (prior && (origin != "" || prior == 2)) return
        if (++candidates > 256 || length(s) > 4096) exit 2
        seen[s] = (origin == "") ? 2 : 1
        if (origin != "" && marker) print "\001" origin "\001" s; else print s
    }
    if (s != tolower(s)) candidate(tolower(s), s)
    # A generic attached option prefix must not hide a path spelling (-t.pi/...).
    if (s ~ /^-/ && match(s, /[.\/]/) && RSTART > 1) candidate(substr(s, RSTART), (origin == "") ? "" : substr(origin, RSTART))
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
    # Unknown interpreter/program text may concatenate brace fragments: retain its conservative refusal.
    # Modeled readers never send their opaque filters through this fallback.
    if (unparsed && index(w, "{") && !index(w, "}")) candidate("*")
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
# After an expansion (or a leading tilde) the prefix of a path is unknown and could be the repository root, so the
# literal remainder is also judged as a path relative to the working directory: the word without its variable name
# and every suffix that starts after a slash. A variable holding a whole protected path stays unseen.
function remainder(word,    rest, tail, count, slash) {
    if (word == "") return
    rest = word
    if (!sub(/^\{[^}]*\}/, "", rest)) sub(/^[A-Za-z0-9_~]+/, "", rest)
    candidate(rest)
    tail = word
    while (count++ < 16 && (slash = index(tail, "/")) > 0) { tail = substr(tail, slash + 1); candidate(tail) }
}
# Expansion syntax is not parsed: a whitespace-delimited chunk holding any of $ ` ~ ( ) { } is judged by every
# suffix that follows a slash in it, so a path after a substitution, a tilde form or a nested expansion is seen
# even when the lexer split the substitution at an inner space.
function chunk_suffixes(chunk,    slash, count) {
    gsub(/["\047\\]/, "", chunk)
    if (chunk !~ /[$`~(){}]/) return
    while (count++ < 16 && (slash = index(chunk, "/")) > 0) { chunk = substr(chunk, slash + 1); candidate(chunk) }
}
function scan(s,    n, i, c, word, whole, flat, expanded, chunk) {
    flat = extglob_star(s)
    if (flat != s) scan(flat)
    n = length(s)
    for (i = 1; i <= n; i++) {
        # The placeholder is one opaque expansion, not a variable name or literal path segment.
        # Preserve the same unknown-prefix suffix views as ${NAME}, without its operator operand.
        if (match_placeholders && substr(s, i, length(MATCH_MARKER)) == MATCH_MARKER) {
            candidate(word); candidate(whole)
            if (expanded || word ~ /^~/) remainder(word)
            word = whole = ""; expanded = 1; chunk = chunk "$"
            i += length(MATCH_MARKER) - 1
            continue
        }
        c = substr(s, i, 1)
        if (c ~ /[ \t\n\r;|&<>]/) { chunk_suffixes(chunk); chunk = "" }
        else chunk = chunk c
        if (c ~ /[ \t\n\r;|&<>()\047"`$=\\]/) {
            candidate(word)
            if (expanded || word ~ /^~/) remainder(word)
            word = ""
            if (c ~ /[`$]/) expanded = 1
            else if (c ~ /[ \t\n\r;|&<>]/) expanded = 0
        }
        else word = word c
        if (c ~ /[ \t\n\r;|&<>()\047"`$]/) { candidate(whole); whole = "" }
        else whole = whole c
    }
    candidate(word); candidate(whole); chunk_suffixes(chunk)
    if (expanded || word ~ /^~/) remainder(word)
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
# Rewrite extraction data only; the lexer still rejects expansions. Nested and value-bearing
# bodies stay visible because their text can supply a protected path or execute another command.
function strip_expansion_operators(t,    out, start, rest, body, name, op, depth, i, c, count) {
    match_placeholders = 0
    if (!match_rewrite_safe || index(t, MATCH_MARKER)) return t
    while ((start = index(t, "${")) && ++count <= 256) {
        out = out substr(t, 1, start - 1); rest = substr(t, start + 2); depth = 1
        for (i = 1; i <= length(rest); i++) {
            c = substr(rest, i, 1)
            if (c == "{") depth++
            if (c == "}") { depth--; if (!depth) break }
        }
        if (depth) return out substr(t, start)
        body = substr(rest, 1, i - 1); name = op = ""
        if (match(body, /^[A-Za-z_][A-Za-z0-9_]*/)) {
            name = substr(body, 1, RLENGTH); op = substr(body, RLENGTH + 1)
        }
        if (name != "" && (op ~ /^(##?|%%?|\^\^?|,,?)[^$`(){}"\047\\;|&<>[:space:]]*$/ ||
            op ~ /^:([0-9]+| -?[0-9]+)(:([0-9]+| -?[0-9]+))?$/)) {
            out = out MATCH_MARKER; match_placeholders = 1
        } else out = out "${" body "}"
        t = substr(rest, i + 1)
    }
    return out t
}
function emit_text(t) {
    t = strip_expansion_operators(t)
    scan(t); scan(unquote(t)); raw_brace_scan(t)
    if (match_placeholders) {
        # Also retain the possible empty-value spelling, e.g. .e${x%y}nv -> .env. It supplements,
        # never replaces, the expanded/unknown-prefix view above.
        gsub(/\$__CRATIS_MATCH__/, "", t); match_placeholders = 0
        scan(t); scan(unquote(t)); raw_brace_scan(t)
    }
}
function destination_allowed(w, implicit,    s) {
    if (!implicit && w ~ /[$`*?\[{~()]/) return 0
    delete collected; collected_count = 0; collecting = 1
    candidate(w); emit_text(w)
    collecting = 0
    for (s in collected) if (protected(s)) return 0
    return 1
}
function endword() {
    if (!inword) return
    if (redirect) {
        if (!(redirect == 2 && word ~ /^([0-9]+|-)$/)) {
            file_redirect = 1
            redirect_words = redirect_words " " word
            if (changed_cwd || lead_glob) unparsed = 1
            if (changed_cwd || word ~ /[$`*?\[{~()]/ || protected(word)) bad = 1
        }
        redirect = 0
    } else {
        if (++argc > 256) fail()
        W[argc] = word
        globbed[argc] = glob
        leading[argc] = lead_glob
    }
    word = ""; inword = glob = lead_glob = 0
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
function options_allowed(verb, first,    i, w, filters, patterns, ended, rg_new, no_config) {
    for (i = first; i <= argc; i++) {
        w = W[i]
        if (!ended && w == "--") { if (verb !~ /^(sort|uniq)$/) return !rg_new || no_config; ended = 1; continue }
        if (ended || w !~ /^-/ || w == "-") {
            # Admit sort/uniq only as stdin filters. File operands, including after
            # --, retain whole-command classification and every existing refusal.
            if (verb ~ /^(sort|uniq)$/) return 0
            patterns++; continue
        }
        if ((verb, w) in long_options) continue
        if (verb == "head" || verb == "tail" || verb == "git log") {
            if (w == "-n" || (verb != "git log" && w == "-c")) {
                if (++i > argc || !number(W[i])) return 0
                continue
            }
            if (w ~ /^-n[+-]?[0-9]+$/ || w ~ /^-[0-9]+$/) continue
        }
        if (verb == "grep" || verb == "egrep" || verb == "fgrep") {
            if (w == "-e") { if (++i > argc) return 0; patterns++; continue }
            if (w ~ /^--(include|exclude)=./) { filters++; continue }
            if (w == "--include" || w == "--exclude") {
                if (++i > argc || W[i] == "" || globbed[i]) return 0
                filters++; continue
            }
            if (w == "-A" || w == "-B" || w == "-C") {
                if (++i > argc || !number(W[i])) return 0
                continue
            }
        }
        if (verb == "git diff" && w ~ /^-U[0-9]+$/) continue
        # New rg display/filter flags require an actual option, never a pattern or option value,
        # disabling config-supplied helpers. Hidden/ignored-file expansion stays refused.
        if (verb == "rg") {
            if (w == "--no-config") { no_config = 1; continue }
            if (w == "-A" || w == "-B" || w == "-C" || w == "-m") {
                if (++i > argc || W[i] !~ /^[0-9]+$/) return 0
                rg_new = 1; continue
            }
            if (w == "-t" || w == "-T") {
                if (++i > argc || globbed[i] || W[i] !~ /^[A-Za-z0-9]+$/) return 0
                rg_new = 1; continue
            }
            if (short_flags(w, "nliSosIN") && !short_flags(w, short_options[verb])) { rg_new = 1; continue }
        }
        if (verb == "shellcheck" && w ~ /^--severity=(error|warning|info|style)$/) continue
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
    return (!filters || patterns > 0) && (!rg_new || no_config)
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
# Keep this bounded sed grammar in sync with the secrets guard. Program files and unknown commands
# remain conservative; only print/substitution scripts without execution or file-write flags qualify.
function safe_sed_script(p,    delimiter, i, c, spans) {
    if (p ~ /^([0-9]+(,([0-9]+|\$))?|\$)?p$/) return 1
    if (substr(p, 1, 1) != "s" || length(p) < 4) return 0
    delimiter = substr(p, 2, 1)
    if (delimiter ~ /[A-Za-z0-9\\ \t\n]/) return 0
    for (i = 3; i <= length(p); i++) {
        c = substr(p, i, 1)
        if (c == "\n") return 0
        if (c == "\\") { if (++i > length(p) || substr(p, i, 1) == "\n") return 0; continue }
        if (c == delimiter && ++spans == 2) return substr(p, i + 1) ~ /^[gpI0-9]*$/
    }
    return 0
}
function sed_slots(A, s, n,    i, w, program, explicit, ended, scripts) {
    delete SED_DATA
    for (i = s + 1; i <= n && A[i] != "--"; i++) if (A[i] ~ /^(-e|--expression)(=|$)/ || A[i] ~ /^-e./) explicit = 1
    for (i = s + 1; i <= n; i++) {
        w = A[i]
        if (!ended && w == "--") { ended = 1; continue }
        if (!ended && (w ~ /^-[nEr]+$/ || w ~ /^--(quiet|silent|regexp-extended)$/)) continue
        if (!ended && (w == "-e" || w == "--expression")) { if (++i > n) return 0; program = A[i] }
        else if (!ended && w ~ /^(-e.|--expression=)/) { program = w; sub(/^(-e|--expression=)/, "", program) }
        else if (!ended && w ~ /^-/) return 0
        else if (!explicit && !scripts) program = w
        else continue
        if (!safe_sed_script(program)) return 0
        SED_DATA[i] = 1; scripts++
    }
    return scripts > 0
}
# Preserve the original protected-file read lane exactly; newly admitted programs below retain
# the pre-existing conservative file-operand check rather than broadening this exception.
function legacy_print_sed(    i, ended) {
    if (argc < 4 || W[2] != "-n" || W[3] !~ /^([0-9]+(,([0-9]+|\$))?|\$)?p$/) return 0
    for (i = 4; i <= argc; i++) {
        if (!ended && W[i] == "--") { ended = 1; continue }
        if (!ended && W[i] ~ /^-/) return 0
    }
    return 1
}
function print_only_sed(    i, ended) {
    if (legacy_print_sed()) return 1
    if (!sed_slots(W, 1, argc)) return 0
    for (i = 2; i <= argc; i++) {
        if (i in SED_DATA) { if (globbed[i]) return 0; continue }
        if (!ended && W[i] == "--") { ended = 1; continue }
        if (!ended && W[i] ~ /^-/) continue
        # Exempt script data, never the input paths: retain the existing protected-input refusal.
        redirect_words = redirect_words " " W[i]
        if (protected(W[i])) return 0
    }
    return 1
}
# Verbs whose reviewed options are display flags only: a word-leading glob that expands to an option-shaped
# file name can change what they print, never what they write or run. Every other verb refuses a leading glob.
function shell_quote(s) { gsub(/\047/, "\047\\\047\047", s); return "\047" s "\047" }
# Bash 3.2 initializes compgen glob flags only after pathname expansion. Prime that state in
# the same shell after setting and verifying every required option; never enumerate unchecked.
function glob_enumeration_script() {
    return "cd -- \"$1\" && [ -r . ] && [ -x . ] || exit 3; unset GLOBIGNORE; " \
        "shopt -s nullglob dotglob nocaseglob && shopt -q nullglob dotglob nocaseglob || exit 3; : *; " \
        "n=0; while IFS= read -r f; do n=$((n+1)); [ \"$n\" -le 200 ] || exit 3; " \
        "case $f in -*|*[!a-zA-Z0-9._/@+=,:%-]*) exit 3;; esac; printf \"F:%s\\n\" \"$f\"; done < <(compgen -G \"$2\"); echo OK"
}
# rg can execute --pre supplied by a filename. Check real leading-glob matches, never command text.
function reader_globs(    i, cmd, line, count, ok, script) {
    if (changed_cwd || ENVIRON["GSW_GLOB_SAFE"] != "1") return 0
    script = glob_enumeration_script()
    for (i = 2; i <= argc; i++) {
        if (W[i] == "--") return 1
        if (!leading[i]) continue
        cmd = "bash -c " shell_quote(script) " guard-glob " shell_quote(ENVIRON["GSW_CWD"]) " " shell_quote(W[i]) " 2>/dev/null"
        ok = count = 0
        while ((cmd | getline line) > 0) {
            if (line == "OK") { ok = 1; continue }
            if (ok || substr(line, 1, 2) != "F:" || ++count > 200) { ok = 0; break }
        }
        if (close(cmd) != 0 || !ok) return 0
    }
    return 1
}
function glob_safe() {
    return W[1] ~ /^(cat|head|tail|wc|ls|grep|egrep|fgrep|shellcheck)$/ || (W[1] ~ /^(rg|cp|rsync|install)$/ && reader_globs()) || (W[1] == "git" && W[2] == "ls-files")
}
function find_allowed(    i, w, predicates) {
    for (i = 2; i <= argc; i++) {
        w = W[i]
        if (w ~ /^-(name|iname|path|regex|wholename)$/) { if (++i > argc || globbed[i]) return 0; predicates++; continue }
        if (w ~ /^-(maxdepth|mindepth)$/) { if (++i > argc || W[i] !~ /^[0-9]+$/) return 0; continue }
        if (w ~ /^-/ && w !~ /^-(print|print0|type|L|P|H)$/) return 0
        if (w == "-type") { if (++i > argc || W[i] !~ /^[bcdflps]$/) return 0 }
    }
    return predicates > 0
}
# Allowlist: `gh pr|issue create|edit|comment` publishes text, it never writes a repository file. Only a title or
# body given as a literal word is admitted; a file-valued option (--body-file, -F), an expansion, an escape or
# a glob refuses, and every other option value must be plain text.
function gh_publish_allowed(    i, w) {
    for (i = 4; i <= argc; i++) {
        w = W[i]
        if (globbed[i]) return 0
        if (w ~ /^(--title|-t|--body|-b)$/) {
            if (++i > argc || globbed[i] || W[i] ~ /[$`\\]/) return 0
            continue
        }
        if (w ~ /^(--base|-B|--head|-H|--label|-l|--assignee|-a|--repo|-R|--milestone|--reviewer|-r|--project|-p)$/) {
            if (++i > argc || W[i] !~ /^[A-Za-z0-9_.,:@%+\/-]+$/ || W[i] ~ /^-/ || W[i] ~ /(^|\/)\./) return 0
            continue
        }
        if (w ~ /^(--draft|--fill)$/ || w ~ /^[0-9]+$/) continue
        return 0
    }
    return 1
}
function gh_allowed(    i, w, subcommand, read) {
    subcommand = W[2] " " W[3]
    if (subcommand ~ /^(pr|issue) (create|edit|comment)$/) return gh_publish_allowed()
    read = subcommand ~ /^(repo (view|list)|issue (view|list|status)|pr (view|list|status|diff|checks)|release (view|list)|run (view|list|watch)|search (issues|prs|repos|commits|code))$/
    if (W[2] != "api" && !read) return 0
    for (i = W[2] == "api" ? 3 : 4; i <= argc; i++) {
        w = W[i]
        if (globbed[i]) return 0
        if (w ~ /^(--jq|-q|--json|-t|--template|--repo|-R|--limit|-L|--hostname|--header|-H)$/) {
            if (++i > argc || globbed[i]) return 0
            continue
        }
        if (W[2] == "api" && w ~ /^(--method|-X)$/) { if (++i > argc || W[i] !~ /^(GET|HEAD)$/) return 0; continue }
        if (w ~ /^-/ && w !~ /^(--paginate|--slurp|--include|--silent|--log|--log-failed|--web)$/) return 0
    }
    return 1
}
# The two managed corpus scripts are admitted for execution only by exact literal spelling: the path is
# compared as a whole word (no ./, .., variable, glob or quoting variant can equal it), every other word must
# be one of the script's own documented options, and nothing is admitted after a directory change, which
# would select a different checkout's copy. Redirects stay classified by the caller.
function managed_script(    i) {
    if (changed_cwd) return 0
    if (W[1] == "node" && W[2] == ".cratis/ai/hooks/scripts/cratis-check-pr.mjs") {
        for (i = 3; i <= argc; i++) {
            if (W[i] == "--strict") continue
            if (W[i] !~ /^--(body-file|label|add-label|remove-label|pr|base|repo)$/) return 0
            if (++i > argc || W[i] == "" || W[i] ~ /^-/ || globbed[i]) return 0
        }
        return 1
    }
    if (W[1] == "bash" && W[2] == ".cratis/ai/hooks/scripts/cratis-cleanup-worktrees.sh") {
        for (i = 3; i <= argc; i++) if (W[i] !~ /^--(dry-run|quiet|no-fetch)$/) return 0
        return 1
    }
    return 0
}
function list_pattern_allowed(verb, first,    i) {
    if (W[first] != "--list" && !(verb == "git tag" && W[first] == "-l")) return 0
    for (i = first + 1; i <= argc; i++) if (W[i] == "" || W[i] ~ /^-/ || globbed[i]) return 0
    return 1
}
# Query literal paths only, never command text. Unknown destinations are directory candidates too.
# Looking up the nearest existing ancestor also handles missing directories and directory symlinks.
function copy_path_kind(w,    script, cmd, kind) {
    if (w in PATH_KIND) return PATH_KIND[w]
    script = "cd -- \"$1\" || exit 3; p=$2; case $p in /*) ;; *) p=$PWD/$p;; esac; " \
        "if [ -f \"$p\" ]; then echo file; exit; fi; " \
        "while [ ! -d \"$p\" ]; do p=${p%/*}; [ -n \"$p\" ] || p=/; done; " \
        "if git -C \"$p\" rev-parse --show-toplevel >/dev/null 2>&1; then echo inside; else echo outside; fi"
    cmd = "bash -c " shell_quote(script) " guard-copy " shell_quote(ENVIRON["GSW_CWD"]) " " shell_quote(w) " 2>/dev/null"
    if ((cmd | getline kind) != 1) kind = ""
    if (close(cmd) != 0 || kind !~ /^(file|inside|outside)$/) return ""
    PATH_KIND[w] = kind
    return kind
}
function copy_write_target(w, implicit) {
    # Keep exact decoded words (including spaces and quotes), as well as the normal suffix views.
    # A later parser failure still emits the whole command; these extra destinations only narrow it.
    if (ENVIRON["GSW_MODE"] == "targets") { candidate(w); emit_text(w) }
    return destination_allowed(w, implicit)
}
# External copies still write environment files. Expand source globs as literal metadata, judging
# each effective basename; if there are no matches, retain the conservative glob-path classifier.
function copy_external_glob(dest, source, base,    script, cmd, line, count, ok, valid, path) {
    if (ENVIRON["GSW_GLOB_SAFE"] != "1") return 0
    script = glob_enumeration_script()
    cmd = "bash -c " shell_quote(script) " guard-copy-glob " shell_quote(ENVIRON["GSW_CWD"]) " " shell_quote(source) " 2>/dev/null"
    valid = 1
    while ((cmd | getline line) > 0) {
        if (line == "OK") { ok = 1; continue }
        if (ok || substr(line, 1, 2) != "F:" || ++count > 200) { valid = 0; break }
        path = substr(line, 3); sub(/^.*\//, "", path)
        if (path == "" || !copy_write_target(dest "/" path, 1)) { valid = 0; break }
    }
    if (close(cmd) != 0 || !ok || !valid) return 0
    return count ? 1 : copy_write_target(dest "/" base, 1)
}
# Judge both explicit destinations and the basenames utilities append to directory destinations.
# rsync directory contents may introduce protected names; do not infer a safe listing inside a repo.
function copy_effective_targets(verb, targets, sources, dirs, no_target, explicit_dirs,    i, j, dest, kind, base) {
    for (i = 1; i <= targets; i++) {
        dest = destinations[i]
        if (!copy_write_target(dest, 0)) return 0
        if (dirs) continue
        kind = copy_path_kind(dest)
        if (kind == "") return 0
        if (no_target || (kind == "file" && !explicit_dirs && sources == 1 && dest !~ /\/$/)) continue
        for (j = 1; j <= sources; j++) {
            if (verb == "rsync" && copy_sources[j] ~ /\/$/ && kind == "inside") {
                if (!copy_write_target(dest "/.*", 1)) return 0
            }
            base = copy_sources[j]; sub(/\/+$/, "", base); sub(/^.*\//, "", base)
            if (base == "") return 0
            # Keep possible dotfiles separate from dependency-manifest exemptions. External glob
            # matches are classified too: environment filenames are protected outside repositories.
            if (base ~ /[*?\[]/) {
                if (kind == "outside") {
                    if (!copy_external_glob(dest, copy_sources[j], base)) return 0
                    continue
                }
                if (base ~ /^[*?\[]/ && !copy_write_target(dest "/.*", 1)) return 0
            }
            if (!copy_write_target(dest "/" base, 1)) return 0
        }
    }
    return 1
}
# Options precede operands so BSD and GNU agree about the destination. Source paths themselves
# are reads; only explicit and effective destinations are collected for the write classifier.
function copy_targets(verb,    i, w, j, ch, tail, value, targets, dirs, no_target, operands, last, flags, longs, explicit_dirs) {
    if (changed_cwd || input_redirect) return 0
    flags = verb == "cp" ? "rRpafvniuTLPH" : (verb == "rsync" ? "arvnuztp" : "cvCp")
    longs = verb == "cp" ? " --recursive --force --verbose --no-clobber --archive --no-target-directory " : \
        (verb == "rsync" ? " --archive --recursive --verbose --dry-run --update --compress --times --perms " : " ")
    delete destinations; delete copy_sources
    for (i = 2; i <= argc; i++) {
        w = W[i]
        if (w == "--") { i++; break }
        if (w == "-" || w !~ /^-/) break
        if (globbed[i]) return 0
        if (verb != "rsync" && w ~ /^--target-directory(=|$)/) {
            value = substr(w, 20)
            if (w == "--target-directory") { if (++i > argc) return 0; value = W[i] }
            if (value == "" || value ~ /^-/ || globbed[i]) return 0
            destinations[++targets] = value; continue
        }
        if (w ~ /^--/) {
            if (index(longs, " " w " ") == 0) return 0
            if (w == "--no-target-directory") no_target = 1
            continue
        }
        for (j = 2; j <= length(w); j++) {
            ch = substr(w, j, 1)
            if (verb != "rsync" && (ch == "t" || (verb == "install" && ch == "m"))) {
                tail = substr(w, j + 1); value = tail
                if (tail == "") { if (++i > argc) return 0; value = W[i] }
                if (value == "" || value ~ /^-/ || globbed[i]) return 0
                if (ch == "m") { if (value !~ /^[0-7][0-7][0-7][0-7]?$/) return 0 }
                else destinations[++targets] = value
                break
            }
            if (verb == "rsync" && ch == "f") {
                value = substr(w, j + 1); if (value == "") { if (++i > argc) return 0; value = W[i] }
                if (value == "" || globbed[i]) return 0
                break
            }
            if (verb == "install" && ch == "d") { dirs = 1; continue }
            if (index(flags, ch) == 0) return 0
            if (ch == "T") no_target = 1
        }
    }
    for (; i <= argc; i++) {
        if (W[i] == "" || W[i] ~ /^-/) return 0
        operands++; last = W[i]; copy_sources[operands] = W[i]
        if (dirs) destinations[operands] = W[i]
    }
    if ((targets && (dirs || no_target)) || !operands) return 0
    explicit_dirs = targets > 0
    if (dirs) targets = operands
    else if (!targets) {
        if (operands < 2 || (verb == "rsync" && index(last, ":"))) return 0
        destinations[++targets] = last; operands--
    }
    return copy_effective_targets(verb, targets, operands, dirs, no_target, explicit_dirs)
}
# Index-only restore is admitted narrowly, never a neighboring worktree/patch/file-input form.
function index_reset(    i, skip, w) {
    if (W[2] != "reset") return 0
    for (i = 3; i <= argc; i++) {
        w = W[i]
        if (!skip && w == "--") { skip = 1; continue }
        if (!skip && w ~ /^-/ && w !~ /^(--soft|--mixed|--no-refresh|-q|--quiet)$/) return 0
    }
    return 1
}
function index_restore(    i, staged, paths, skip, w) {
    i = 2
    while (W[i] == "-C" && i + 2 <= argc && W[i + 1] != "" && !globbed[i + 1]) i += 2
    if (W[i++] != "restore") return 0
    for (; i <= argc; i++) {
        w = W[i]
        if (!skip && w == "--") { skip = 1; continue }
        if (!skip && (w == "--staged" || w ~ /^-S+$/)) { staged = 1; continue }
        if (!skip && (w == "-s" || w == "--source")) { if (++i > argc || globbed[i]) return 0; continue }
        if (!skip && (w ~ /^--source=./ || w ~ /^-s./)) continue
        if (!skip && w ~ /^-/) return 0
        paths++
    }
    return staged && paths
}
function allow_command(    verb, first, i) {
    if (!argc) return
    if (++commands > 64) { fail(); return }
    for (i = 1; i <= argc; i++) if (leading[i] && !glob_safe()) { cmd_failed = 1; return }
    if (managed_script()) return
    verb = W[1]; first = 2
    if (verb == "cd") {
        directory_only = 1
        if (argc != 2 || W[2] == "" || W[2] ~ /^-/ || globbed[2] || file_redirect) fail()
        changed_cwd = 1
        return
    }
    if (verb ~ /^(cp|rsync|install)$/) { if (!copy_targets(verb)) cmd_failed = 1; return }
    if (verb == "sed") { if (!print_only_sed()) cmd_failed = 1; return }
    if (verb == "find") { if (!find_allowed()) cmd_failed = 1; return }
    if (verb == "gh") { if (!gh_allowed()) cmd_failed = 1; return }
    if (verb == "git" && (index_restore() || index_reset())) { changed_index = 1; return }
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
        if (!(argc == 3 && W[3] == "--show-current") && !list_pattern_allowed(verb, first)) cmd_failed = 1
        return
    }
    if (verb == "git tag") { conditional_only = 1; if (!list_pattern_allowed(verb, first)) cmd_failed = 1; return }
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
    silent = argc && !cmd_failed && !input_redirect && !force_emit && W[1] != "cd"
    if (silent && redirect_words != "") emitted[++emitted_count] = redirect_words
    if (!silent && upto > seg_start) emitted[++emitted_count] = substr(lexed, seg_start, upto - seg_start)
    seg_start = resume
    previous_pipe = (separator == "|")
    cmd_redirect = force_emit = input_redirect = 0; redirect_words = ""
    delete W; delete globbed; delete leading; argc = 0
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
        # Only a word-leading * or ? is deferred to the per-verb rule; one after a leading dash, or a leading
        # bracket class (`[-]*` can name an option), is refused outright.
        if ((c == "*" || c == "?" || c == "[") && (word == "" ? !(c == "[" && c2 ~ /[ \t]/) : substr(word, 1, 1) == "-")) {
            if (c == "[" || word != "") fail(); else lead_glob = 1
        }
        if (c == "#" && !inword) { while (i <= length(s) && substr(s, i, 1) != "\n") i++; c = "\n" }
        if (c == "(" || c == ")" || c == "{" || c == "}") fail()
        if (c == ">" || c == "<" || (c == "&" && c2 == ">")) {
            cmd_redirect = 1
            if (c == "<") input_redirect = 1
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
# Only a complete, top-level literal cat heredoc is data. A quote, substitution,
# comment, backslash or previous heredoc before its opening leaves the whole text
# unclassified: the apparent cat might otherwise be inside another shell construct.
# Reference extraction always uses the original text, including every body. Only
# the read-only check reduces a proven heredoc to cat and its output redirection.
# Protected bodies may be printed but never materialized to a file. Never execute text.
function strip_data_heredocs(text,    lines, count, i, j, line, before, after, delimiter, quoted, body, prefix, out) {
    count = split(text, lines, "\n")
    for (i = 1; i <= count; i++) {
        line = lines[i]
        if (prefix !~ /[\047"\\$`#<>]/ &&
            line ~ /^[ \t]*cat[ \t]+((>|>>)[ \t]*[-.\/A-Za-z0-9_]+[ \t]+)?<<[ \t]*(\047[A-Za-z_][A-Za-z0-9_]*\047|"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)[ \t]*((>|>>)[ \t]*[-.\/A-Za-z0-9_]+)?[ \t]*$/) {
            before = substr(line, 1, index(line, "<<") - 1)
            after = substr(line, index(line, "<<") + 2)
            if (!(index(before, ">") && index(after, ">"))) {
                sub(/^[ \t]+/, "", after); sub(/[ \t]*(>|>>).*$/, "", after); sub(/[ \t]+$/, "", after)
                quoted = after ~ /^[\047"]/
                delimiter = after; gsub(/[\047"]/, "", delimiter)
                body = ""
                for (j = i + 1; j <= count && lines[j] != delimiter; j++) body = body lines[j] "\n"
                if (j <= count && (quoted || body !~ /[$`\\]/)) {
                    if (index(before, ">") || index(line, ">")) heredoc_writes = 1
                    sub(/<<[ \t]*(\047[A-Za-z_][A-Za-z0-9_]*\047|"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)/, "", line)
                    out = out (i > 1 ? "\n" : "") line
                    for (; i < j; i++) prefix = prefix lines[i] "\n"
                    prefix = prefix lines[i] "\n"
                    continue
                }
            }
        }
        out = out (i > 1 ? "\n" : "") line
        prefix = prefix line "\n"
    }
    return out
}
BEGIN {
    policy("cat", "nAvetsb", "")
    policy("head", "", ""); policy("tail", "", "")
    policy("wc", "lwcm", ""); policy("ls", "laA1hdRtrF", "")
    policy("rg", "nli", "--files")
    policy("sort", "nrufb", "--numeric-sort --reverse --unique --ignore-case --ignore-leading-blanks")
    policy("uniq", "cdui", "--count --repeated --unique --ignore-case")
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
    policy("shellcheck", "x", "--external-sources")
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
    MATCH_MARKER = "$__CRATIS_MATCH__"
    # Never interpret user-supplied or ANSI-decoded marker text as an internal token. Collisions
    # disable admission rather than assigning special meaning to an existing parameter or literal.
    checking_marker = 1; decoded = unquote(text); checking_marker = 0
    match_rewrite_safe = !index(text, MATCH_MARKER) && !index(decoded, MATCH_MARKER)
    if (ENVIRON["GSW_MODE"] == "references") { emit_text(text); exit 0 }
    if (ENVIRON["GSW_MODE"] == "targets") {
        reduced = strip_data_heredocs(text)
        readonly(reduced)
        # Reducing data must never erase a protected reference and skip the final
        # read-only check, even when the reduced command itself has no targets.
        if (unparsed || reduced != text) emit_text(text)
        else for (i = 1; i <= emitted_count; i++) emit_text(emitted[i])
        exit 0
    }
    n = split(ENVIRON["GSW_PROTECTED"], a, "\n"); for (i = 1; i <= n; i++) protected_paths[a[i]] = 1
    reduced = strip_data_heredocs(text)
    exit (readonly(reduced) && !heredoc_writes) ? 0 : 1
}
AWK
# This stage is independent of the readonly/reference grammar above. Scoped filesystem
# effects retain prefix uncertainty; archive tools require explicit uncontaminated read modes.
IFS= read -r -d '' destructive_program <<'AWK' || true
function base(word) { sub(/^.*\//, "", word); return word }
function member(list, word) { return index(" " list " ", " " word " ") > 0 }
function destructive(word) { return member("rm rmdir unlink shred mv", base(word)) }
function shell(word) { return member("sh bash dash zsh ksh ash", base(word)) }
# Command-head recognition is shared by dispatch and directory tracking. time retains
# its option-aware wrapper handling below; grouping delimiters also split segments.
function command_prefix(word) {
    return word ~ /^[A-Za-z_][A-Za-z0-9_]*[+]?=/ || word ~ /^(UNZIP|UNZIPOPT|TAR_OPTIONS|ZIPOPT)\[[^]]+\][+]?=/ || member("then do else elif ! if while until { ( coproc", word)
}
# Only these established execution prefixes expose another command position.
function wrapper(word) {
    return member("sudo doas env command builtin exec nohup nice ionice timeout time stdbuf xargs setsid chroot nsenter busybox", base(word))
}
function emit(path) { if (path != "" && !seen[path]++) print path }
# Every unclassified execution boundary uses the same fail-closed evidence rule.
# Callers pass only the remaining uncertain region, never known heredoc data.
function unclassified(text) {
    gsub(/["\047\\]/, "", text)
    if (text ~ /(^|[[:space:];|&()`\/])(rm|rmdir|unlink|shred|mv)([[:space:];|&()`]|$)/ ||
        (text ~ /(^|[[:space:];|&()`\/])git[[:space:]]/ && text ~ /(^|[[:space:]])clean([[:space:]]|$)/) ||
        (text ~ /(^|[[:space:];|&()`\/])find[[:space:]]/ && text ~ /(^|[[:space:]])-delete([[:space:]]|$)/) ||
        (text ~ /(^|[[:space:];|&()`\/])git[[:space:]]/ && text ~ /(^|[[:space:]])(restore|checkout|switch|stash|reset|read-tree|checkout-index)([[:space:]]|$)/) ||
        text ~ /(^|[[:space:];|&()`\/])(rsync|cp)([[:space:]]|$)/) emit("!")
    if (text ~ /(^|[[:space:];|&()`\/])(unzip|bsdunzip|tar|bsdtar|gtar|ditto|pax|cpio|bsdcpio|7z|7za|7zz|7zr|jar|ar|unar|zip)([[:space:]]|$)/) emit("!archive")
}
function remaining(d, start, end,    i, j, text) {
    for (i = start; i <= end; i++) {
        text = text " " W[d, i]
        for (j = 1; j <= BC[d, i]; j++) text = text " " B[d, i, j]
    }
    return text
}
# Arithmetic shifts are not redirections. Consume balanced arithmetic as one word;
# its contents are otherwise uncertain, including any nested executable substitution.
function arithmetic(text, start, bracket,    i, c, quote, level, parens) {
    level = bracket ? 1 : 2; quote = ""; arithmetic_complete = 0
    for (i = start; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (c == "\\") { i++; continue }
        if (quote != "") { if (c == quote) quote = ""; continue }
        if (c == "\047" || c == "\"") { quote = c; continue }
        if (bracket) {
            if (c == "(") parens++
            else if (c == ")" && parens) parens--
            else if (!parens && c == "[") level++
            else if (!parens && c == "]") level--
        } else {
            if (c == "(") level++
            else if (c == ")") level--
        }
        if (!level) { arithmetic_complete = 1; break }
    }
    arithmetic_end = i
    return substr(text, start, i - start)
}
function arithmetic_prefix(text, i, quoted) {
    arithmetic_bracket = substr(text, i, 2) == "$["
    if (arithmetic_bracket) return i + 2
    if (substr(text, i, 3) == "$((") return i + 3
    if (!quoted && substr(text, i, 2) == "((") return i + 2
    return 0
}
# Exceptions need a whole-tool simple command, not a guess about earlier mutations.
# Quoted parentheses and parameter braces remain word data in the lexer.
function simple_command(text, d, n,    i, head) {
    head = base(W[d, 1])
    if (!destructive(head) && !member("git find", head) && bulk_family(head) == "") return 0
    if (text ~ /`|\$\(/) return 0
    for (i = 1; i <= n; i++) {
        if (BC[d, i] || (K[d, i] != "word" && K[d, i] !~ /^(>|>>|>&|&>|&>>|<|<&)$/)) return 0
    }
    return 1
}
function unquoted_expansion(raw,    i, c, quote) {
    for (i = 1; i <= length(raw); i++) {
        c = substr(raw, i, 1)
        if (c == "\\" && quote != "\047") { i++; continue }
        if (quote != "") { if (c == quote) quote = ""; continue }
        if (c == "\047" || c == "\"") { quote = c; continue }
        if (c == "*" || c == "?" || c == "[" || c == "$" || c == "`") return 1
    }
    return 0
}
# Raw-source proof excludes splitting and mixed unquoted globs. A value of 2
# marks quoted predicate data, not an eligible environment path prefix.
function quoted_prefix(raw) {
    if (raw ~ /^~/) return !unquoted_expansion(raw)
    if (raw ~ /^"\$(\{(PWD|HOME|TMPDIR)\}|PWD|HOME|TMPDIR)(\/|")/ && !unquoted_expansion(raw)) return 1
    return (raw ~ /^"[^"]*"$/ || raw ~ /^\047[^\047]*\047$/) ? 2 : 0
}
# Only raw, unquoted ~+ with a literal suffix can establish the initial cwd.
function literal_current_directory(raw, word) {
    return raw == word && word ~ /^~\+(\/|$)/ && substr(word, 3) !~ /[$`~*?\[{}]/
}
# A destructive expansion exception must name only real descendant components.
function descendant_suffix(suffix,    parts, count, i) {
    if (suffix !~ /^\// || suffix ~ /[$`*?\[{}~]/ || index(suffix, "]") || index(suffix, "\\")) return 0
    gsub(/\/+/, "/", suffix)
    sub(/\/$/, "", suffix)
    count = split(substr(suffix, 2), parts, "/")
    if (!count) return 0
    for (i = 1; i <= count; i++) {
        if (parts[i] == "" || parts[i] == "." || parts[i] == "..") return 0
    }
    return 1
}
function environment_prefix(word, require_descendant,    name, suffix, end) {
    if (word ~ /^\$\{(PWD|HOME|TMPDIR)\}(\/|$)/) {
        end = index(word, "}"); name = substr(word, 3, end - 3); suffix = substr(word, end + 1)
    } else if (word ~ /^\$(PWD|HOME|TMPDIR)(\/|$)/) {
        name = substr(word, 2); sub(/\/.*/, "", name); suffix = substr(word, length(name) + 2)
    } else return "!"
    if (require_descendant && !descendant_suffix(suffix)) return "!"
    return (name == "PWD" ? ENVIRON["GSW_CWD"] : ENVIRON[name]) suffix
}
function resolved(word, quoted, cwd, uncertain, double_quoted, ordinary,    expanded, suffix) {
    expanded = word ~ /^\$/ || (!quoted && word ~ /^~/)
    if (expanded && !ordinary && (!exception_allowed || double_quoted != 1)) return "!"
    if (word ~ /^\$/) word = double_quoted == 1 ? environment_prefix(word, !ordinary) : "!"
    else if (!quoted && word ~ /^~(\/|$)/) {
        suffix = substr(word, 2)
        word = ordinary || descendant_suffix(suffix) ? ENVIRON["HOME"] suffix : "!"
    } else if (!quoted && word ~ /^~\+(\/|$)/) {
        suffix = substr(word, 3)
        word = ordinary || descendant_suffix(suffix) ? ENVIRON["GSW_CWD"] suffix : "!"
    } else if (!quoted && word ~ /^~/) return "!"
    if (word == "!" || word ~ /[$`]/ || (expanded && word ~ /^-/)) return "!"
    if (word ~ /^\//) return word
    if (uncertain) return "!"
    return cwd "/" word
}
function operand(word, quoted, cwd, uncertain, double_quoted) {
    if (word != "" && word != "{}") emit(resolved(word, quoted, cwd, uncertain, double_quoted))
}
# Heredoc delimiters are quote-removed, never expanded or executed.
function heredoc_word(text, start,    i, c, quote, word, active) {
    hd_quoted = 0; quote = ""; active = 0
    for (i = start; substr(text, i, 1) ~ /[ \t]/; i++) {}
    for (; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (quote != "") { if (c == quote) quote = ""; else word = word c; continue }
        if (c == "\047" || c == "\"") { quote = c; hd_quoted = active = 1; continue }
        if (c == "\\") { word = word substr(text, ++i, 1); hd_quoted = active = 1; continue }
        if (c ~ /[ \t\r\n;&|()<>]/ || (c == "#" && !active)) break
        word = word c; active = 1
    }
    hd_valid = active && quote == "" && i <= length(text) + 1
    hd_end = i - 1
    return word
}
function heredoc_body(text, start, delimiter, strip,    i, size, line, body) {
    i = start; hd_complete = 0
    while (i <= length(text)) {
        size = index(substr(text, i), "\n")
        if (!size) size = length(text) - i + 2
        line = substr(text, i, size - 1)
        if (strip) sub(/^\t+/, "", line)
        if (line == delimiter) { hd_complete = 1; hd_end = i + size - 1; return body }
        body = body line "\n"; i += size
    }
    hd_end = length(text)
    return body
}
# Return a substitution body without executing it. Ignore parentheses in data/comments.
function substitution(text, start, tick,    i, c, quote, nesting, body, id, count, j, delimiter, strip, end, k) {
    nesting = 1; quote = ""; id = ++sub_id; count = 0
    for (i = start; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (c == "\\") { body = body c substr(text, ++i, 1); continue }
        if (tick) { if (c == "`") break }
        else if (quote != "") { if (c == quote) quote = "" }
        else if (c == "\047" || c == "\"") quote = c
        else if (c == "#" && (i == start || substr(text, i - 1, 1) ~ /[ \t\n;&|()]/)) {
            while (i <= length(text) && substr(text, i, 1) != "\n") body = body substr(text, i++, 1)
            i--; continue
        } else if ((k = arithmetic_prefix(text, i, 0))) {
            arithmetic(text, k, arithmetic_bracket)
            body = body substr(text, i, arithmetic_end - i + 1); i = arithmetic_end; continue
        } else if (c == "<" && substr(text, i, 2) == "<<" && substr(text, i, 3) != "<<<") {
            strip = substr(text, i + 2, 1) == "-"
            delimiter = heredoc_word(text, i + 2 + strip)
            if (!hd_valid) { unclassified(substr(text, i)); sub_end = length(text); return body }
            SD[id, ++count] = delimiter; SS[id, count] = strip
            body = body substr(text, i, hd_end - i + 1); i = hd_end; continue
        } else if (c == "(") nesting++
        else if (c == ")" && !--nesting) break
        body = body c
        if (c == "\n" && quote == "" && count) {
            for (j = 1; j <= count; j++) {
                end = i
                delimiter = heredoc_body(text, i + 1, SD[id, j], SS[id, j])
                if (!hd_complete) unclassified(delimiter)
                i = hd_end; body = body substr(text, end + 1, i - end)
            }
            count = 0
        }
    }
    if (i > length(text) || count) unclassified(body)
    sub_end = i
    return body
}
function data_substitutions(text, d, word,    i, c, body, k) {
    for (i = 1; i <= length(text); i++) {
        c = substr(text, i, 1)
        if (c == "\\") { i++; continue }
        if ((k = arithmetic_prefix(text, i, 1))) {
            body = arithmetic(text, k, arithmetic_bracket); unclassified(body); i = arithmetic_end; continue
        }
        if (c == "`" || substr(text, i, 2) == "$(") {
            body = substitution(text, i + (c == "`" ? 1 : 2), c == "`")
            B[d, word, ++BC[d, word]] = body; i = sub_end
        }
    }
}
function lex(text, d,    i, c, nextc, quote, word, quoted, active, n, body, k, pending, delimiter, strip, hd_index, end, word_start, glob_at) {
    n = 0; quote = ""; word = ""; active = 0; quoted = 0; pending = 0; glob_at = 0
    for (i = 1; i <= length(text); i++) {
        c = substr(text, i, 1); nextc = substr(text, i + 1, 1)
        if (!active) word_start = i
        if (quote != "\047" && (k = arithmetic_prefix(text, i, quote != ""))) {
            body = arithmetic(text, k, arithmetic_bracket); unclassified(body)
            i = arithmetic_end; word = word "$__arithmetic"; active = 1; continue
        }
        if (quote != "\047" && (c == "`" || (c == "$" && nextc == "("))) {
            body = substitution(text, i + (c == "`" ? 1 : 2), c == "`")
            B[d, n + 1, ++BC[d, n + 1]] = body
            i = sub_end; word = word "$__sub"; active = 1; continue
        }
        if (quote != "") {
            if (c == quote) { quote = ""; continue }
            if (c == "\\" && quote != "\047" && nextc ~ /[$`"\\]/) c = substr(text, ++i, 1)
            word = word c; continue
        }
        if (c == "\047" || c == "\"" || (c == "$" && nextc == "\047")) {
            if (c == "$") c = substr(text, ++i, 1)
            quote = c; if (!active) quoted = 1; active = 1; continue
        }
        if (c == "\\") { if (!active) quoted = 1; word = word substr(text, ++i, 1); active = 1; continue }
        if (c == "#" && !active) {
            while (i <= length(text) && substr(text, i, 1) != "\n") i++
            i--; continue
        }
        # Parameter expansion braces and find placeholders are words, not groups.
        if (c == "$" && nextc == "{") {
            k = i + 2
            while (k <= length(text) && substr(text, k, 1) != "}") k++
            word = word substr(text, i, k - i + 1); i = k; active = 1; continue
        }
        if (c == "{" && nextc == "}") { word = word "{}"; i++; active = 1; continue }
        if (c ~ /[ \t\r\n;&|(){}<>]/) {
            if (active) { W[d, ++n] = word; Q[d, n] = quoted; DQ[d, n] = quoted_prefix(substr(text, word_start, i - word_start)); CT[d, n] = literal_current_directory(substr(text, word_start, i - word_start), word); K[d, n] = "word"; T[d, n] = i - 1; F[d, n] = !quoted && word ~ /^[0-9]+$/ && substr(text, i - length(word), length(word)) == word; GL[d, n] = glob_at; word = ""; active = quoted = glob_at = 0 }
            if (c ~ /[ \t\r]/) continue
            if (c == "<" && nextc == "<") {
                if (substr(text, i, 3) == "<<<") { W[d, ++n] = "<<<"; K[d, n] = "<<<"; T[d, n] = i; i += 2; continue }
                strip = substr(text, i + 2, 1) == "-"
                delimiter = heredoc_word(text, i + 2 + strip)
                if (!hd_valid) { unclassified(substr(text, i)); return n }
                W[d, ++n] = "<<"; K[d, n] = "<<"; T[d, n] = i
                W[d, ++n] = delimiter; K[d, n] = "word"; Q[d, n] = hd_quoted
                HS[d, n] = strip; HP[d, ++pending] = n
                i = hd_end; continue
            }
            end = i
            if (c == "&" && nextc == ">") {
                c = "&>"; i++
                if (substr(text, i + 1, 1) == ">") { c = "&>>"; i++ }
            } else if (c == ">") {
                if (nextc == ">" || nextc == "&") { c = c nextc; i++ }
                else if (nextc == "|") i++
            } else if (c == "<" && nextc == "&") { c = "<&"; i++ }
            else if ((c == "&" || c == "|") && (nextc == c || (c == "|" && nextc == "&"))) { i++; c = c nextc }
            W[d, ++n] = c; K[d, n] = c; T[d, n] = end
            if (c == "\n" && pending) {
                for (k = 1; k <= pending; k++) {
                    hd_index = HP[d, k]
                    H[d, hd_index] = heredoc_body(text, i + 1, W[d, hd_index], HS[d, hd_index]); i = hd_end
                    if (!hd_complete) unclassified(H[d, hd_index])
                    if (!Q[d, hd_index]) data_substitutions(H[d, hd_index], d, hd_index)
                }
                pending = 0
            }
            continue
        }
        word = word c; active = 1
        # Offset of the first unquoted pathname-expansion character; quoted and escaped ones never get here.
        if (!glob_at && c ~ /[*?\[]/) glob_at = length(word)
    }
    if (active) { W[d, ++n] = word; Q[d, n] = quoted; DQ[d, n] = quoted_prefix(substr(text, word_start)); CT[d, n] = literal_current_directory(substr(text, word_start), word); K[d, n] = "word"; GL[d, n] = glob_at }
    if (quote != "" || pending) unclassified(remaining(d, 1, n))
    return n
}
function wrapper_value(program, option) {
    if (program == "env") return member("-u --unset -C --chdir -a --argv0", option)
    if (program == "sudo") return member("-u -g -h -p -C -T -r -t -D -R -U -a -c --user --group --host --prompt --close-from --command-timeout --role --type --chdir --chroot", option)
    if (program == "doas") return member("-u -C", option)
    if (program == "exec") return option == "-a"
    if (program == "nice") return member("-n --adjustment", option)
    if (program == "ionice") return member("-c -n -p -P -u --class --classdata --pid --pgid --uid", option)
    if (program == "timeout") return member("-s -k --signal --kill-after", option)
    if (program == "time") return member("-f -o --format --output", option)
    if (program == "stdbuf") return member("-i -o -e --input --output --error", option)
    if (program == "xargs") return member("-I -J -E -d -L -n -P -s -a -R -S --eof --delimiter --max-lines --max-args --max-procs --max-chars --arg-file", option)
    if (program == "chroot") return member("--userspec --groups", option)
    if (program == "nsenter") return member("-t -S -G --target --setuid --setgid --root --wd --wdns", option)
    return 0
}
function wrapper_flag(program, option) {
    if (program == "env") return option ~ /^-[i0v]+$/ || member("--ignore-environment --null --debug --list-signal-handling --default-signal --ignore-signal --block-signal", option)
    if (program == "sudo") return option ~ /^-[nEHKSbklvVeis]+$/ || member("--non-interactive --preserve-env --set-home --reset-timestamp --remove-timestamp --stdin --background --validate --list --edit --login --shell", option)
    if (program == "doas") return member("-n -s -L", option)
    if (program == "command") return option == "-p"
    if (program == "exec") return member("-c -l", option)
    if (program == "time") return member("-p -v -q --portability --verbose --quiet", option)
    if (program == "xargs") return member("-0 -r -t -p -x -i --null --no-run-if-empty --verbose --interactive --exit --show-limits --replace", option)
    if (program == "setsid") return member("-c -f -w --ctty --fork --wait", option)
    if (program == "chroot") return option == "--skip-chdir"
    if (program == "nsenter") return member("-a -m -u -i -n -p -U -C -T --all --mount --uts --ipc --net --pid --user --cgroup --time --preserve-credentials --no-fork --follow-context", option)
    return 0
}
# Dispatch uses an argv copy, never shell source. Every prefix shares the same
# redirection tail and inherited pipe input; splitting env argv cannot discard either.
function copy_token(source, from, dest, to,    j) {
    W[dest, to] = W[source, from]; Q[dest, to] = Q[source, from]; DQ[dest, to] = DQ[source, from]; K[dest, to] = K[source, from]
    H[dest, to] = H[source, from]; T[dest, to] = T[source, from]; F[dest, to] = F[source, from]
    BC[dest, to] = BC[source, from]; GL[dest, to] = GL[source, from]
    for (j = 1; j <= BC[source, from]; j++) B[dest, to, j] = B[source, from, j]
}
function redirection(d, i) { return K[d, i] ~ /^[<>]/ || K[d, i] ~ /^&>/ }
function dispatch(d, start, end,    slot, redirects, i, n, r) {
    slot = --dispatch_id; redirects = --dispatch_id
    for (i = start; i <= end; i++) {
        if (F[d, i] && redirection(d, i + 1) && T[d, i] + 1 == T[d, i + 1]) {
            copy_token(d, i++, redirects, ++r)
        }
        if (redirection(d, i)) {
            copy_token(d, i, redirects, ++r)
            if (i < end) copy_token(d, ++i, redirects, ++r)
        } else copy_token(d, i, slot, ++n)
    }
    for (i = 1; i <= r; i++) copy_token(redirects, i, slot, ++n)
    dispatch_head = executable(slot, 1, n)
    return slot
}
# env -S recognizes whitespace, quotes and escapes, not shell operators or substitutions.
# Unsupported expansion/escape shapes use the shared destructive-evidence fallback.
function env_words(text, slot,    i, c, nextc, quote, word, active, n) {
    for (i = 1; i <= length(text) + 1; i++) {
        c = substr(text, i, 1); nextc = substr(text, i + 1, 1)
        if (c == "" || (quote == "" && c ~ /[[:space:]]/)) {
            if (active) { W[slot, ++n] = word; Q[slot, n] = 1; K[slot, n] = "word"; word = ""; active = 0 }
            continue
        }
        if (quote == "" && c == "#" && !active) break
        if (c == "\\" && quote != "\047") {
            i++
            if (nextc == "c") break
            if (nextc == "_") {
                if (quote == "") {
                    if (active) { W[slot, ++n] = word; Q[slot, n] = 1; K[slot, n] = "word"; word = ""; active = 0 }
                    continue
                }
                c = " "
            } else if (nextc == "n") c = "\n"
            else if (nextc == "r") c = "\r"
            else if (nextc == "t") c = "\t"
            else if (nextc == "v") c = "\v"
            else if (nextc == "f") c = "\f"
            else if (nextc ~ /[\\#\$"\047]/) c = nextc
            else { unclassified(text); return -1 }
        } else if (c == "\047" || c == "\"") {
            if (quote == "") { quote = c; active = 1; continue }
            if (quote == c) { quote = ""; continue }
        } else if (c == "$" && quote != "\047") { unclassified(text); return -1 }
        word = word c; active = 1
    }
    if (quote != "") { unclassified(text); return -1 }
    if (active) { W[slot, ++n] = word; Q[slot, n] = 1; K[slot, n] = "word" }
    return n
}
function executable(d, start, end,    i, j, program, option, split_at, text, slot, count, first, expansions) {
    prefix_uncertain = 0; prefix_fed = 0; dispatch_end = end; i = start
    while (i <= end) {
        if (command_prefix(W[d, i])) {
            if (archive_environment_name(W[d, i])) { archive_environment = 1; emit("!archive") }
            if (program == "env" && W[d, i] ~ /[$`*?\[{}]/ && (!Q[d, i] || DQ[d, i])) prefix_uncertain = 1
            i++; continue
        }
        program = base(W[d, i])
        if (!wrapper(program)) return redirection(d, i) ? 0 : i
        if (member("chroot nsenter", program)) prefix_uncertain = 1
        if (program == "xargs") prefix_fed = 1
        i++
        while (i <= end && W[d, i] ~ /^-/) {
            option = W[d, i++]
            if (option == "--") break
            if (member("--help --version", option) || (program == "command" && member("-v -V", option)) || (program == "busybox" && member("--list --list-full", option))) return 0
            if ((program == "env" && (option ~ /^-C/ || option ~ /^--chdir(=|$)/)) || (program == "sudo" && (option ~ /^-[DR]/ || option ~ /^--(chdir|chroot)(=|$)/))) prefix_uncertain = 1
            if (program == "env" && (option ~ /^-[i0v]*S/ || option ~ /^--split-string(=|$)/)) {
                first = i - 1
                if (option == "--split-string" || option ~ /^-[i0v]*S$/) text = W[d, i++]
                else if (option ~ /^--/) text = substr(option, 16)
                else { split_at = index(option, "S"); text = substr(option, split_at + 1) }
                if (++expansions > 64) { unclassified(text " " remaining(d, i, end)); return 0 }
                slot = --dispatch_id; count = env_words(text, slot)
                if (count < 0) { unclassified(remaining(d, i, end)); return 0 }
                # Stage the suffix before replacing tokens, including all original redirects.
                for (j = i; j <= end; j++) copy_token(d, j, slot, count + j - i + 1)
                for (j = 1; j <= count + end - i + 1; j++) copy_token(slot, j, d, first + j - 1)
                end += count - (i - first); dispatch_end = end; i = first
                continue
            }
            if (wrapper_value(program, option)) { i++; continue }
            if (wrapper_flag(program, option) || option ~ /^--[^=]+=/ || (length(option) > 2 && wrapper_value(program, substr(option, 1, 2)))) continue
            unclassified(remaining(d, i - 1, end)); return 0
        }
        if (program == "timeout" || program == "chroot") i++
    }
    return 0
}
function removal(d, verb, end, cwd, uncertain, findpaths,    i, w, count, options, target, j, sources) {
    count = 0; options = 1; target = 0; sources = 0
    for (i = verb + 1; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (options && w == "--") { options = 0; continue }
        if (options && base(W[d, verb]) == "mv") {
            if (w == "-t" || w == "--target-directory") { target = 1; i++; continue }
            if (w ~ /^--target-directory=/ || w ~ /^-t./) { target = 1; continue }
        }
        if (options && w ~ /^-/) continue
        O[d, ++count] = w; OQ[d, count] = Q[d, i]; ODQ[d, count] = DQ[d, i]
    }
    if (base(W[d, verb]) == "mv" && !target) count--
    for (j = 1; j <= count; j++) {
        w = O[d, j]
        if (w == "{}") {
            if (findpaths != "") emit(findpaths)
            else emit("!")
        } else operand(w, OQ[d, j], cwd, uncertain, ODQ[d, j])
        sources++
    }
}
# A shared exact grammar runs before effect parsing, including nonmutating/dry-run exits.
# Unknown options are never interpreted as abbreviations, negations or harmless data.
function option_schema(family, flags, values, long_flags, long_values,    i, n, words) {
    for (i = 1; i <= length(flags); i++) OPT[family, "-" substr(flags, i, 1)] = "flag"
    for (i = 1; i <= length(values); i++) OPT[family, "-" substr(values, i, 1)] = "value"
    n = split(long_flags, words, " "); for (i = 1; i <= n; i++) OPT[family, "--" words[i]] = "flag"
    n = split(long_values, words, " "); for (i = 1; i <= n; i++) OPT[family, "--" words[i]] = "value"
}
function bulk_family(word) {
    if (member("tar bsdtar gtar", word)) return "tar"
    if (member("7z 7za 7zz 7zr", word)) return "7z"
    if (member("unzip bsdunzip", word)) return "unzip"
    if (member("cpio bsdcpio", word)) return "cpio"
    if (member("rsync cp ditto pax jar ar unar zip", word)) return word
    return ""
}
function option_grammars() {
    option_schema("tar", "xctruAdOzjJavpkhmPS", "fC", "extract get to-stdout create list append update concatenate diff compare verbose gzip gunzip bzip2 xz zstd overwrite keep-old-files no-same-owner same-owner no-same-permissions same-permissions", "file directory strip-components")
    option_schema("unzip", "lptZvoqnujCXLKafDUV", "dP", "", "")
    option_schema("cp", "rRaTpfvniuLPHdl", "t", "archive recursive no-target-directory force verbose no-clobber update", "target-directory")
    option_schema("rsync", "rapvniuLPHdzctgoDlq", "f", "archive recursive force verbose update compress times perms ignore-existing existing dry-run delete delete-before delete-during delete-delay delete-after delete-excluded", "")
    option_schema("ditto", "xkczvV", "", "rsrc norsrc extattr noextattr acl noacl qtn noqtn keepParent sequesterRsrc", "")
    option_schema("pax", "rwv", "f", "", "")
    option_schema("cpio", "idmvtop", "FDH", "extract create list pass-through make-directories preserve-modification-time no-absolute-filenames verbose", "file directory format")
    option_schema("7z", "y", "opt", "", "")
    OPT["7z", "-so"] = OPT["7z", "-bd"] = "flag"
    option_schema("zip", "rqjv0123456789", "x", "quiet recurse-paths junk-paths verbose", "exclude out")
    option_schema("jar", "xctuv", "fC", "extract create list update verbose", "file dir")
    option_schema("ar", "xtrqdmpsvfP", "", "", "output")
    option_schema("unar", "qfdD", "o", "quiet force-overwrite force-directory no-directory", "output-directory")
    # Creation has a separate, deliberately small non-executing/non-deleting grammar.
    option_schema("creation:tar", "cruAvzjJ", "fCT", "create append update concatenate gzip bzip2 xz zstd verbose", "file directory exclude files-from format")
    option_schema("creation:zip", "rqjv0123456789", "x", "quiet recurse-paths junk-paths verbose", "exclude out")
    option_schema("creation:7z", "", "t", "", "")
    option_schema("creation:jar", "cuvM", "fC", "create update verbose no-manifest", "file")
    option_schema("creation:ar", "rqcsdmvu", "", "", "")
    option_schema("creation:cpio", "ov", "FH", "create verbose", "file format")
    option_schema("creation:pax", "wv", "fx", "", "")
    option_schema("restore", "SWq", "s", "staged worktree ours theirs ignore-unmerged ignore-skip-worktree-bits overlay no-overlay quiet", "source")
    option_schema("checkout", "fmqd", "bB", "force merge quiet detach track no-track guess no-guess recurse-submodules ours theirs", "orphan")
    option_schema("switch", "fmqd", "cC", "force discard-changes merge quiet detach track no-track guess no-guess recurse-submodules", "create force-create")
    option_schema("stash", "kuapq", "m", "keep-index no-keep-index include-untracked all quiet patch stat index", "message")
    option_schema("reset", "q", "", "soft mixed hard merge keep no-refresh quiet pathspec-file-nul", "pathspec-from-file")
    option_schema("clean", "fdxXqn", "e", "force quiet dry-run", "exclude")
    option_schema("read-tree", "uminv", "", "reset merge dry-run verbose no-sparse-checkout", "prefix index-output")
    option_schema("checkout-index", "afqunz", "", "all force quiet index no-create stdin temp", "prefix")
}
# Archive operands: a word whose expansion can begin with `-` or `@` is an option, or a bsdtar/7z
# list-file reference, however it is quoted elsewhere in the word. That holds when an unquoted glob starts the
# word (a quoted-empty prefix does not anchor it) or follows a leading `-`/`@`. `./`, a directory or any other
# literal first character anchors the word. Lexical only: no expansion and no filesystem access.
function option_shaped_glob(d, i) { return GL[d, i] && (GL[d, i] == 1 || W[d, i] ~ /^[-@]/) }
function option_value(d, i, end) {
    return i <= end && K[d, i] == "word" && W[d, i] != "" && (Q[d, i] || W[d, i] !~ /[$`*?\[{}]/) && !(archive_operands && GL[d, i])
}
# Return the last consumed word, or zero. Option values are data, never another option.
function option_end(d, i, end, family, old, schema,    w, key, kind, j, last) {
    if (schema == "") schema = family
    w = W[d, i]; last = i
    if (w ~ /^--/) {
        key = w; sub(/=.*/, "", key); kind = OPT[schema, key]
        if (kind == "flag") return w == key ? i : 0
        if (kind != "value") return 0
        if (w != key) return length(w) > length(key) + 1 ? i : 0
        return option_value(d, i + 1, end) ? i + 1 : 0
    }
    if (family == "7z") {
        if (schema == "creation:7z" && w ~ /^-mx=?[0-9]$/) return i
        if (OPT[schema, w] == "flag") return i
        key = substr(w, 1, 2)
        if (OPT[schema, key] != "value") return 0
        if (length(w) > 2) return i
        return option_value(d, i + 1, end) ? i + 1 : 0
    }
    for (j = old ? 1 : 2; j <= length(w); j++) {
        kind = OPT[schema, "-" substr(w, j, 1)]
        if (kind == "") return 0
        if (kind != "value") continue
        if (!old && j < length(w)) return i
        if (!option_value(d, ++last, end)) return 0
        if (!old) break
    }
    return last
}
function known_options(d, start, end, family, cwd, uncertain, creation,    i, j, w, old, last, schema) {
    schema = creation ? "creation:" family : family
    for (i = start; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (w == "--") {
            if (member("unzip jar ar", family)) return 0
            # bsdtar still reads `@archive` after `--`, so a terminator admits no leading glob for tar.
            if (archive_operands && family == "tar") for (j = i + 1; j <= end && !redirection(d, j); j++) if (option_shaped_glob(d, j)) return 0
            return 1
        }
        old = member("tar jar ar", family) && i == start && w ~ /^[a-zA-Z]+$/
        if (w !~ /^-/ && !old) {
            if (archive_operands && option_shaped_glob(d, i)) return 0
            if (w ~ /[$`]/ && (!Q[d, i] || DQ[d, i]) && (!DQ[d, i] || resolved(w, Q[d, i], cwd, uncertain, DQ[d, i]) == "!")) return 0
            continue
        }
        if (!Q[d, i] && w ~ /[$`*?\[{}]/) return 0
        last = option_end(d, i, end, family, old, schema)
        if (!last) return 0
        i = last
    }
    return 1
}
# Archive payloads and option environments are opaque. Read modes and safe creation are explicit.
function archive_environment_name(word) { return word ~ /^(UNZIP|UNZIPOPT|TAR_OPTIONS|ZIPOPT)($|[+]?=|\[)/ }
function archive_exports(d, head, end,    i, w) {
    for (i = head + 1; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (archive_environment_name(w)) { archive_environment = 1; emit("!archive") }
        else if (w !~ /^[-+]/ && w !~ /^[A-Za-z_][A-Za-z0-9_]*([+]?=|$)/) {
            archive_environment = 1
            if (archive_seen) emit("!archive")
        }
    }
}
function archive_mode_flag(family, flag) {
    if (family == "tar") {
        if (member("-t --list", flag)) return "list"
        if (member("-x --extract --get", flag)) return "extract"
        if (member("-O --to-stdout", flag)) return "stdout"
        if (member("-c -r -u -A --create --append --update --concatenate", flag)) return "create"
        if (member("-d --diff --compare", flag)) return "other"
    } else if (family == "unzip") {
        if (member("-l -t -v -Z", flag)) return "list"
        if (flag == "-p") return "stdout"
        return "other"
    } else if (family == "jar") {
        if (member("-t --list", flag)) return "list"
        if (member("-c -u --create --update", flag)) return "create"
        if (member("-x --extract", flag)) return "extract"
    } else if (family == "ar") {
        if (flag == "-t") return "list"
        if (member("-r -q -d -m -s", flag)) return "create"
        if (flag == "-x") return "extract"
        if (member("-p -M", flag)) return "other"
    } else if (family == "cpio") {
        if (member("-t --list", flag)) return "list"
        if (member("-o --create", flag)) return "create"
        if (member("-i -p --extract --pass-through", flag)) return "extract"
    } else if (family == "pax") {
        if (flag == "-w") return "create"
        if (flag == "-r") return "extract"
    }
    return ""
}
# 0 = refused/unknown, 1 = explicit read, 2 = archive creation/update.
function archive_mode(d, start, end, family,    i, j, w, flag, kind, old, last, mode, options, terminator, state, schema) {
    if (family == "zip") return 2
    if (!member("tar unzip jar ar cpio pax 7z", family)) return 0
    options = 1
    for (i = start; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (w == "--") { options = 0; terminator = 1; continue }
        old = member("tar jar ar", family) && i == start && w ~ /^[a-zA-Z]+$/
        if (!options || (w !~ /^-/ && !old)) {
            if (family == "7z" && mode == "") mode = w
            continue
        }
        schema = family; last = option_end(d, i, end, family, old)
        if (!last) { schema = "creation:" family; last = option_end(d, i, end, family, old, schema) }
        if (!last) last = i
        if (w ~ /^--/) {
            flag = w; sub(/=.*/, "", flag)
            kind = archive_mode_flag(family, flag); if (kind != "") state[kind] = 1
        } else if (family != "7z") {
            for (j = old ? 1 : 2; j <= length(w); j++) {
                flag = "-" substr(w, j, 1)
                kind = archive_mode_flag(family, flag); if (kind != "") state[kind] = 1
                if (!old && OPT[schema, flag] == "value") break
            }
        }
        i = last
    }
    if (family == "7z") {
        if (member("a u d", mode) && mode != "") return 2
        return member("l t", mode) && mode != ""
    }
    if (state["create"] && !state["extract"] && !state["list"] && !state["stdout"] && !state["other"]) return 2
    if (state["create"] || state["other"]) return family == "unzip" && state["stdout"]
    if (family == "unzip") return state["stdout"] || state["list"]
    if (family == "tar") return (state["list"] && !state["extract"]) || (state["extract"] && state["stdout"] && !state["list"] && !terminator)
    return state["list"] && !state["extract"]
}
function archive_command(d, verb, end, cwd, uncertain, fed, family,    i, mode) {
    archive_seen = 1
    if (uncertain || fed || archive_environment || ("UNZIP" in ENVIRON) || ("UNZIPOPT" in ENVIRON) || ("TAR_OPTIONS" in ENVIRON) || ("ZIPOPT" in ENVIRON)) { emit("!archive"); return }
    for (i = verb + 1; i <= end; i++) {
        if (redirection(d, i)) break
        if (W[d, i] ~ /^@/) { emit("!archive"); return }
    }
    mode = archive_mode(d, verb + 1, end, family)
    archive_operands = 1
    if (mode == 2) {
        if (!known_options(d, verb + 1, end, family, cwd, uncertain, 1)) emit("!archive")
        else archive_creation(d, verb, end, cwd, uncertain, family)
    } else if (mode != 1 || !known_options(d, verb + 1, end, family, cwd, uncertain)) emit("!archive")
    archive_operands = 0
}
function creation_output_option(family, flag) {
    return (member("tar jar pax", family) && member("-f --file", flag)) ||
        (family == "cpio" && member("-F --file", flag)) ||
        (family == "zip" && flag == "--out")
}
function archive_creation(d, verb, end, cwd, uncertain, family,    i, j, w, flag, value, next_word, old, options, output, output_q, output_dq, output_explicit, positional, schema) {
    options = 1; schema = "creation:" family
    for (i = verb + 1; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (w == "--" && options) { options = 0; continue }
        if (w ~ /[$`]/ && (!Q[d, i] || DQ[d, i])) { emit("!"); return }
        old = member("tar jar ar", family) && i == verb + 1 && w ~ /^[a-zA-Z]+$/
        if (options && ((w ~ /^-/ && w != "-") || old)) {
            if (family == "7z") {
                next_word = option_end(d, i, end, family, 0, schema); if (next_word) i = next_word
                continue
            }
            if (w ~ /^--/) {
                flag = w; sub(/=.*/, "", flag)
                if (OPT[schema, flag] == "value") {
                    value = substr(w, length(flag) + 2)
                    if (w == flag) value = W[d, ++i]
                    if (value == "") { emit("!"); return }
                    if (creation_output_option(family, flag)) { output = value; output_q = Q[d, i]; output_dq = DQ[d, i]; output_explicit = 1 }
                }
                continue
            }
            next_word = i
            for (j = old ? 1 : 2; j <= length(w); j++) {
                flag = "-" substr(w, j, 1)
                if (OPT[schema, flag] != "value") continue
                value = old ? "" : substr(w, j + 1)
                if (value == "") value = W[d, ++next_word]
                if (value == "") { emit("!"); return }
                if (creation_output_option(family, flag)) { output = value; output_q = Q[d, next_word]; output_dq = DQ[d, next_word]; output_explicit = 1 }
                if (!old) break
            }
            i = next_word; continue
        }
        if (family == "7z" && !positional) { positional = 1; continue }
        if (member("zip ar 7z", family) && positional < 2) {
            positional = 2
            if (!output_explicit) { output = w; output_q = Q[d, i]; output_dq = DQ[d, i] }
        }
    }
    if (output == "-") return
    if (output != "") operand(output, output_q, cwd, uncertain, output_dq)
    else if (member("ar 7z", family)) emit("!")
}
# cp writes source basenames to an existing/explicit directory, but source/. writes its contents.
function copy_effect(d, verb, end, cwd, uncertain,    i, j, w, ch, value, count, target, no_target, recursive, dry, bad, options, source, suffix, kind, explicit_target, sync_delete, remote_target) {
    options = 1
    for (i = verb + 1; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (options && w == "--") { options = 0; continue }
        if (options && w ~ /^--/) {
            if (w ~ /^--target-directory(=|$)/ && base(W[d, verb]) == "cp") {
                value = substr(w, 20); if (w == "--target-directory") value = W[d, ++i]
                target = resolved(value, Q[d, i], cwd, uncertain, DQ[d, i]); explicit_target = 1
            } else if (w == "--no-target-directory") no_target = 1
            else if (w == "--dry-run") dry = 1
            else if (member("--archive --recursive", w)) recursive = 1
            else if (w ~ /^--delete(-before|-during|-delay|-after|-excluded)?$/) sync_delete = 1
            else if (!member("--force --verbose --no-clobber --update --compress --times --perms --ignore-existing --existing", w)) bad = 1
            continue
        }
        if (options && w ~ /^-/) {
            for (j = 2; j <= length(w); j++) {
                ch = substr(w, j, 1)
                if (base(W[d, verb]) == "rsync" && ch == "f") {
                    value = substr(w, j + 1); if (value == "") value = W[d, ++i]
                    if (value == "") bad = 1
                    break
                }
                if (base(W[d, verb]) == "cp" && ch == "t") {
                    value = substr(w, j + 1); if (value == "") value = W[d, ++i]
                    target = resolved(value, Q[d, i], cwd, uncertain, DQ[d, i]); explicit_target = 1; break
                }
                if (ch ~ /^[rRa]$/) recursive = 1
                else if (ch == "T") no_target = 1
                else if (ch == "n" && base(W[d, verb]) == "rsync") dry = 1
                else if (ch !~ /^[pfvniuLPHdzctgoDlq]$/) bad = 1
            }
            continue
        }
        CP[d, ++count] = i
    }
    if (dry && base(W[d, verb]) == "rsync") return
    if (bad || uncertain || !count || target == "!") { emit("!"); return }
    if (!explicit_target) {
        i = CP[d, count--]; target = resolved(W[d, i], Q[d, i], cwd, uncertain, DQ[d, i])
        remote_target = W[d, i] ~ /^([^\/:]+:|rsync:\/\/)/
    }
    if (target == "!" || !count || (no_target && (explicit_target || count > 1))) { emit("!"); return }
    # Remote destinations are not local scopes; the existing reference fallback still applies.
    if (base(W[d, verb]) == "rsync" && remote_target) return
    if (base(W[d, verb]) == "rsync" && sync_delete) {
        emit(target); return
    }
    if (!recursive && base(W[d, verb]) == "cp") return
    kind = directory_kind(target)
    if (kind == "!") { emit("!"); return }
    for (j = 1; j <= count; j++) {
        i = CP[d, j]; source = W[d, i]; sub(/\/+$/, "", source)
        suffix = base(source)
        if (suffix == "." || suffix == ".." || suffix == "" || source ~ /[$`*?\[{}]/ || (base(W[d, verb]) == "rsync" && W[d, i] ~ /[\/:]$/)) emit(target)
        else if (!no_target && (explicit_target || kind == "directory" || count > 1)) emit(target "/" suffix)
        else emit(target)
    }
}
function directory_kind(path,    cmd, result) {
    cmd = "bash -c " quote_path("if [ -d \"$1\" ]; then echo directory; elif [ -e \"$1\" ] || [ ! -L \"$1\" ]; then echo other; else exit 2; fi") " guard-directory " quote_path(path)
    if ((cmd | getline result) != 1) result = "!"
    if (close(cmd) != 0) result = "!"
    return result
}
function git_bulk(d, command, start, end, cwd, uncertain, fed,    i, j, w, prefix, write, dry, root) {
    for (i = start; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (w == "--") { if (command == "checkout-index" && i < end) write = 1; break }
        if (w == "--prefix") prefix = W[d, ++i]
        else if (w ~ /^--prefix=/) prefix = substr(w, 10)
        else if (w == "--index-output") i++
        else if (w == "--stdin" || w == "--temp") { emit("!"); return }
        else if (w == "--dry-run" && command == "read-tree") dry = 1
        else if (member("--all --force", w) && command == "checkout-index") write = 1
        else if (w ~ /^-[^-]/) {
            for (j = 2; j <= length(w); j++) {
                if (command == "read-tree" && substr(w, j, 1) == "u") write = 1
                else if (command == "read-tree" && substr(w, j, 1) == "n") dry = 1
                else if (command == "checkout-index" && substr(w, j, 1) ~ /[af]/) write = 1
            }
        } else if (command == "checkout-index" && w !~ /^-/) write = 1
    }
    if (!write || dry) return
    if (uncertain || fed) { emit("!"); return }
    if (command == "checkout-index" && (prefix == "" || substr(prefix, length(prefix), 1) != "/")) { emit("!"); return }
    root = command == "read-tree" ? git_root(cwd) : cwd
    emit(prefix == "" ? root : resolved(prefix, 1, root, root == "!"))
}
# Locate the selected worktree with metadata only. Overrides are refused for content effects.
function git_root(cwd,    cmd, root) {
    cmd = "bash -c " quote_path("cd -P -- \"$1\" || exit 2; while [ ! -e \"$PWD/.git\" ]; do [ \"$PWD\" != / ] || exit 2; cd .. || exit 2; done; pwd -P") " guard-git-root " quote_path(cwd) " 2>/dev/null"
    if ((cmd | getline root) != 1) root = "!"
    if (close(cmd) != 0) root = "!"
    return root
}
function git_path(d, i, cwd, uncertain, findpaths,    w) {
    w = W[d, i]
    if (w ~ /^:/) emit(git_root(cwd))
    else if (w == "{}" && findpaths != "") emit(findpaths)
    else operand(w, Q[d, i], cwd, uncertain, DQ[d, i])
}
function git_rewrite(d, command, start, end, cwd, uncertain, findpaths, fed,    i, j, w, ch, staged, worktree, whole, paths, skip, bad, create, position, action) {
    if (command == "stash") {
        action = W[d, start]
        if (member("list show drop clear", action)) return
        if (action == "" || member("apply pop branch save", action)) whole = 1
        else if (action != "push" && action !~ /^-/) { emit("!"); return }
        if (action == "push") start++
    }
    if (command == "reset") {
        for (i = start; i <= end; i++) {
            if (redirection(d, i)) break
            if (member("--hard --merge --keep", W[d, i])) whole = 1
            else if (W[d, i] ~ /^--(pathspec-from-file|pathspec-file-nul)/ || W[d, i] ~ /[$`]/) bad = 1
        }
        if (!whole && !bad) return
    } else for (i = start; i <= end; i++) {
        w = W[d, i]
        if (redirection(d, i)) break
        if (!skip && w == "--") { skip = 1; continue }
        if (!skip && w ~ /^-/) {
            if (command == "restore") {
                if (w == "--staged") { staged = 1; continue }
                if (w == "--worktree") { worktree = 1; continue }
                if (w == "--source" || w == "-s") { if (++i > end || W[d, i] ~ /[$`]/) bad = 1; continue }
                if (w ~ /^--source=./ || w ~ /^-s./) continue
                if (w ~ /^-[SW]+$/) {
                    for (j = 2; j <= length(w); j++) { ch = substr(w, j, 1); if (ch == "S") staged = 1; else worktree = 1 }
                    continue
                }
                if (member("--ours --theirs --ignore-unmerged --ignore-skip-worktree-bits --overlay --no-overlay -q --quiet", w)) continue
            } else if (command == "checkout" || command == "switch") {
                if (member("-f --force --discard-changes -m --merge", w)) { whole = 1; continue }
                if (member("-b -B --orphan -c -C --create --force-create", w)) { create = 1; if (++i > end) bad = 1; continue }
                if (member("-q --quiet --detach -d --track --no-track --guess --no-guess --recurse-submodules --ours --theirs", w)) continue
            } else if (command == "stash") {
                if (w == "-m" || w == "--message") { if (++i > end) bad = 1; continue }
                if (w ~ /^--message=/ || w ~ /^-m./ || member("-k --keep-index --no-keep-index -u --include-untracked -a --all -q --quiet", w)) continue
            }
            bad = 1; continue
        }
        if (w ~ /[$`]/) bad = 1
        if (w ~ /^:/) { emit(git_root(cwd)); return }
        RP[++paths] = i
        # checkout REV -- paths: revision is not a path, and branch data is never a subcommand.
        if (!skip) position++
    }
    if (command == "restore" && staged && !worktree && !bad) return
    if (command == "switch" && !whole && !bad) return
    if (command == "checkout" && create && !whole && !bad) return
    if (command == "stash" && !paths) whole = 1
    if (bad || uncertain || fed) { emit("!"); return }
    if (whole) { emit(git_root(cwd)); return }
    if (command == "checkout" && skip && paths > 1 && position > 0) {
        for (i = 2; i <= paths; i++) git_path(d, RP[i], cwd, uncertain, findpaths)
    } else for (i = 1; i <= paths; i++) git_path(d, RP[i], cwd, uncertain, findpaths)
    if (!paths) emit("!")
}
function git_clean(d, verb, end, cwd, uncertain, findpaths, depth, fed,    i, j, w, subcommand, dry, paths, skip, alias, name, call, script, option, rewrite_context) {
    subcommand = 0; call = ++git_call
    uncertain = uncertain || git_context_unknown || ("GIT_WORK_TREE" in ENVIRON) || ("GIT_DIR" in ENVIRON) || ("GIT_COMMON_DIR" in ENVIRON)
    for (i = verb + 1; i <= end; i++) {
        w = W[d, i]
        if (w == "-C") {
            cwd = resolved(W[d, ++i], Q[d, i], cwd, uncertain, DQ[d, i])
            if (cwd == "!") uncertain = 1
        } else if (w == "-c") {
            alias = W[d, ++i]
            if (alias ~ /^alias\.[^=]+=/) {
                name = alias; sub(/^alias\./, "", name); sub(/=.*/, "", name)
                sub(/^[^=]*=/, "", alias); A[call, name] = alias
            } else if (tolower(alias) ~ /^(core\.worktree|core\.bare|include\.|includeif\.)/) uncertain = 1
        } else if (w ~ /[$`]/) { emit("!"); return }
        # Git 2.50.1 git.c handle_options(), plus legacy --super-prefix.
        else if (w == "--work-tree") { if (W[d, ++i] != ".") uncertain = 1 }
        else if (w == "--work-tree=.") continue
        else if (w == "--git-dir") { rewrite_context = 1; if (W[d, ++i] != ".git") uncertain = 1 }
        else if (w == "--git-dir=.git") { rewrite_context = 1; continue }
        else if (w ~ /^--(git-dir|work-tree)=/ || w == "--bare") { uncertain = 1; continue }
        else if (member("--namespace --config-env --attr-source --super-prefix --shallow-file", w)) { rewrite_context = 1; i++ }
        else if (w ~ /^--(namespace|config-env|attr-source|super-prefix|exec-path)=/) { rewrite_context = 1; continue }
        else if (member("-h --help -v --version --html-path --man-path --info-path --exec-path", w) || w ~ /^--list-cmds=/) return
        else if (member("-p --paginate -P --no-pager --no-replace-objects --no-lazy-fetch --no-optional-locks --no-advice --bare --literal-pathspecs --no-literal-pathspecs --glob-pathspecs --noglob-pathspecs --icase-pathspecs", w)) continue
        else if (w ~ /^-/) { unclassified("git " remaining(d, i, end)); return }
        else { subcommand = i; break }
    }
    if (!subcommand) return
    if (A[call, W[d, subcommand]] != "") {
        script = A[call, W[d, subcommand]]
        if (substr(script, 1, 1) == "!") script = substr(script, 2)
        else script = "git " script
        for (i = subcommand + 1; i <= end; i++) script = script " " quote_path(W[d, i])
        parse(script, cwd, uncertain || rewrite_context, depth + 1, fed)
        return
    }
    # Once a subcommand is established, later words are its data, never another subcommand.
    if (member("restore checkout switch stash reset clean read-tree checkout-index", W[d, subcommand]) && !known_options(d, subcommand + 1, end, W[d, subcommand], cwd, uncertain)) { emit("!"); return }
    if (member("read-tree checkout-index", W[d, subcommand])) {
        git_bulk(d, W[d, subcommand], subcommand + 1, end, cwd, uncertain || rewrite_context, fed)
        return
    }
    if (member("restore checkout switch stash reset", W[d, subcommand])) {
        git_rewrite(d, W[d, subcommand], subcommand + 1, end, cwd, uncertain || rewrite_context, findpaths, fed)
        return
    }
    if (W[d, subcommand] != "clean") return
    dry = 0; paths = 0; skip = 0
    for (i = subcommand + 1; i <= end; i++) {
        w = W[d, i]
        if (K[d, i] ~ /^[<>]/) break
        # An expansion may supply Git options, even when shell-quoted. Only an
        # eligible, fully double-quoted environment path has a proven argv shape.
        if (w ~ /[$`]/ && (!DQ[d, i] || resolved(w, Q[d, i], cwd, uncertain, DQ[d, i]) == "!")) { emit("!"); return }
        if (!skip && w == "--") { skip = 1; continue }
        if (!skip && w == "--exclude") { i++; continue }
        if (!skip && w ~ /^--exclude=/) continue
        if (!skip && w == "--dry-run") { dry = 1; continue }
        if (!skip && w ~ /^-[^-]/) {
            for (j = 2; j <= length(w); j++) {
                option = substr(w, j, 1)
                if (option == "e") { if (j == length(w)) i++; break }
                if (option == "n") dry = 1
            }
            continue
        }
        if (!skip && w ~ /^-/) continue
        GP[call, ++paths] = i
    }
    if (dry) return
    if (fed) { emit("!"); return }
    for (j = 1; j <= paths; j++) {
        i = GP[call, j]; w = W[d, i]
        git_path(d, i, cwd, uncertain, findpaths)
    }
    if (!paths) operand(".", 0, cwd, uncertain)
}
function find_command(d, verb, end, cwd, uncertain, depth, fed,    i, j, start, paths, w, action, have, deleted, p) {
    paths = ""; have = 0; deleted = 0
    for (i = verb + 1; i <= end; i++) {
        w = W[d, i]
        if (member("-H -L -P", w)) continue
        # A bare expanded word may be a predicate rather than a starting path;
        # an unquoted expansion can additionally supply several argument words.
        if (w ~ /[$`]/ && (!Q[d, i] || (w !~ /\// && environment_prefix(w) == "!"))) { emit("!"); return }
        if (w ~ /^-/ || w == "!" || w == "(") break
        p = resolved(w, Q[d, i], cwd, uncertain, DQ[d, i])
        FP[depth, ++have] = p
    }
    if (!have) FP[depth, ++have] = resolved(".", 0, cwd, uncertain)
    for (j = 1; j <= have; j++) paths = paths (j == 1 ? "" : "\n") FP[depth, j]
    for (; i <= end; i++) {
        w = W[d, i]
        # Arguments to known predicates are data, not possible injected actions.
        if (member("-name -iname -path -ipath -wholename -iwholename -regex -iregex -lname -ilname -type -xtype -size -user -group -uid -gid -perm -mtime -atime -ctime -mmin -amin -cmin -newer -newermt -maxdepth -mindepth -printf -fprint -fprint0 -samefile -links -inum -fstype -used -context", w)) {
            i++
            if (W[d, i] ~ /[$`]/ && !DQ[d, i]) { emit("!"); return }
            continue
        }
        if (w ~ /[$`]/) { emit("!"); return }
        if (w == "-delete") deleted = 1
        if (member("-exec -execdir -ok -okdir", w)) {
            start = i + 1
            while (++i <= end && W[d, i] != ";" && W[d, i] != "+") {}
            segment(d, start, i - 1, cwd, uncertain, depth, paths, "", fed)
        }
    }
    if (deleted) {
        if (fed) emit("!")
        else for (j = 1; j <= have; j++) emit(FP[depth, j])
    }
}
function stdin_data(d, start, end, pipe,    i, data, kind, fd, target) {
    data = pipe
    for (i = start; i <= end; i++) {
        kind = K[d, i]
        if (kind !~ /^</) continue
        fd = descriptor(d, i - 1) ? W[d, i - 1] : 0
        target = W[d, ++i]
        if (fd != 0) continue
        if (kind == "<<<") data = target
        else if (kind == "<<") data = H[d, i]
        # Unknown files stay opaque, exactly as for an unwrapped shell. fd-0 aliases
        # preserve the inherited input, and later redirects replace earlier ones.
        else if (kind == "<" && member("/dev/stdin /dev/fd/0 /proc/self/fd/0", target)) continue
        else if (kind == "<&" && target == "0") continue
        else data = ""
    }
    return data
}
function descriptor(d, i) { return F[d, i] && T[d, i] + 1 == T[d, i + 1] && (K[d, i + 1] ~ /^[<>]/ || K[d, i + 1] ~ /^&>/) }
function stdout_pipe(d, head, end, outgoing,    i, fd, target, kind, call) {
    # |& can feed either descriptor to the consumer; conservatively retain both
    # routes when explicit descriptor duplication precedes the implicit merge.
    call = ++redirect_call; RD[call, 1] = 1; RD[call, 2] = outgoing == "|&"
    for (i = head + 1; i <= end; i++) {
        kind = K[d, i]
        if (kind !~ /^>/ && kind !~ /^&>/) continue
        fd = descriptor(d, i - 1) ? W[d, i - 1] : 1
        target = W[d, ++i]
        if (kind ~ /^&>/) { RD[call, 1] = RD[call, 2] = 0; continue }
        if (kind == ">&") {
            if (target == "-") RD[call, fd] = 0
            else if (target ~ /^[0-9]+$/) RD[call, fd] = ((call SUBSEP target) in RD) ? RD[call, target] : -1
            else RD[call, fd] = -1
        } else RD[call, fd] = 0
    }
    if (RD[call, 1] < 0) unclassified(remaining(d, head, end))
    return RD[call, 1] == 1
}
function reader_data(d, head, end, pipe, outgoing,    program, i, word, data, format) {
    program = base(W[d, head])
    if (!member("cat echo printf", program) || !stdout_pipe(d, head, end, outgoing)) return ""
    if (program == "cat") {
        for (i = head + 1; i <= end; i++) {
            if (descriptor(d, i)) continue
            if (K[d, i] ~ /^[<>]/ || K[d, i] ~ /^&>/) { i++; continue }
            if (W[d, i] !~ /^-/) return ""
        }
        return stdin_data(d, head + 1, end, pipe)
    }
    if (program != "echo" && program != "printf") return ""
    i = head + 1
    if (program == "printf") {
        format = W[d, i++]
        if (format ~ /%/ && format != "%s" && format != "%s\\n") return ""
        if (format !~ /%/) { gsub(/\\n/, "\n", format); return format }
    } else while (i <= end && W[d, i] ~ /^-[neE]+$/) i++
    for (; i <= end; i++) {
        if (descriptor(d, i)) continue
        if (K[d, i] ~ /^[<>]/ || K[d, i] ~ /^&>/) { i++; continue }
        word = W[d, i]
        if (program == "printf") data = data word (format == "%s\\n" ? "\n" : "")
        else data = data (data == "" ? "" : " ") word
    }
    return data
}
function shell_command(d, head, end, cwd, uncertain, depth, pipe, fed,    i, j, word, option, value, enabled, command, stdin, noexec, interactive, script) {
    command = stdin = noexec = interactive = 0; i = head + 1
    while (i <= end) {
        word = W[d, i]
        if (K[d, i] ~ /^[<>]/ || K[d, i] ~ /^&>/) { i += 2; continue }
        if (descriptor(d, i)) { i++; continue }
        if (word == "--" || word == "-") { if (word == "-") stdin = 1; i++; break }
        if (member("--help --version", word)) return
        if (member("--rcfile --init-file", word)) { i += 2; continue }
        if (member("--noprofile --norc --posix --restricted --verbose --debugger --login --noediting --dump-strings --dump-po-strings --pretty-print", word)) { i++; continue }
        if (word ~ /^[-+][A-Za-z]+$/) {
            enabled = substr(word, 1, 1) == "-"
            i++
            for (j = 2; j <= length(word); j++) {
                option = substr(word, j, 1)
                if (option == "c" && enabled) command = 1
                else if (option == "s") stdin = enabled
                else if (option == "n") noexec = enabled
                else if (option == "i") interactive = enabled
                else if (option == "o" || option == "O") {
                    value = W[d, i++]
                    if (option == "o" && value == "noexec") noexec = enabled
                } else if (option !~ /^[abefhkmptuvxBCEHPTirl]$/) { unclassified(remaining(d, head, end)); return }
            }
            continue
        }
        if (word ~ /^[-+]/) { unclassified(remaining(d, head, end)); return }
        break
    }
    if (noexec && !interactive) return
    if (command) { if (i <= end) parse(W[d, i], cwd, uncertain, depth + 1, fed); return }
    # Standard fd-0 aliases select stdin; ordinary script files remain opaque.
    if (member("- /dev/stdin /dev/fd/0 /proc/self/fd/0", W[d, i])) stdin = 1
    if (i <= end && !stdin) return
    script = stdin_data(d, head + 1, end, pipe)
    if (script != "") parse(script, cwd, uncertain, depth + 1, fed)
}
function segment(d, start, end, cwd, uncertain, depth, findpaths, pipe, fed, outgoing,    head, i, j, k, w, script, context, target) {
    if (start > end) return ""
    exception_allowed = simple_tool && d == 0 && start == 1 && end == N[0]
    # Substitutions/redirections execute in the calling shell, even for unknown programs.
    if (depth > 4) unclassified(remaining(d, start, end))
    for (i = start; depth <= 4 && i <= end; i++) {
        for (k = 1; k <= BC[d, i]; k++) parse(B[d, i, k], cwd, uncertain, depth + 1, 0)
        if ((K[d, i] == ">" || K[d, i] == "&>") && i < end && W[d, i + 1] !~ /[$`]/ && W[d, i + 1] != "/dev/null") {
            target = resolved(W[d, i + 1], Q[d, i + 1], cwd, uncertain, DQ[d, i + 1], 1)
            emit(target)
        }
    }
    d = dispatch(d, start, end); head = dispatch_head; end = dispatch_end
    context = uncertain || prefix_uncertain; fed = fed || prefix_fed
    if (!head) return ""
    if (depth > 4) {
        unclassified(remaining(d, head, end))
        if (shell(base(W[d, head]))) unclassified(stdin_data(d, head + 1, end, pipe))
        return ""
    }
    w = base(W[d, head])
    if (member("export declare typeset readonly local", w)) archive_exports(d, head, end)
    if (w == "git") git_clean(d, head, end, cwd, context, findpaths, depth, fed)
    else if (w == "find") find_command(d, head, end, cwd, context, depth + 1, fed)
    else if (bulk_family(w) != "") {
        if (w == "cp" || w == "rsync") {
            if (fed || !known_options(d, head + 1, end, w, cwd, context)) emit("!")
            else copy_effect(d, head, end, cwd, context)
        } else archive_command(d, head, end, cwd, context, fed, bulk_family(w))
    }
    else if (destructive(w)) {
        # xargs always adds/replaces operands from stdin, even with safe literal operands.
        if (fed) emit("!")
        else removal(d, head, end, cwd, context, findpaths)
    } else if (w == "eval") {
        script = ""
        for (j = head + 1; j <= end; j++) script = script (j == head + 1 ? "" : " ") W[d, j]
        parse(script, cwd, context, depth + 1, fed)
    } else if (shell(w)) shell_command(d, head, end, cwd, context, depth, pipe, fed)
    else if (!fed) return reader_data(d, head, end, pipe, outgoing)
    return ""
}
function parse(text, cwd, uncertain, depth, fed,    n, i, start, kind, level, head, path, old, j, pipe, data) {
    # Lex before the depth fallback so properly terminated heredoc bodies stay data.
    # A depth slot may be reused by several script words.
    for (i = 1; i <= N[depth]; i++) { delete W[depth, i]; delete Q[depth, i]; delete DQ[depth, i]; delete CT[depth, i]; delete K[depth, i]; delete H[depth, i]; delete T[depth, i]; delete F[depth, i]; delete GL[depth, i]; BC[depth, i] = 0 }
    n = lex(text, depth); N[depth] = n; start = 1; level = 0
    if (text ~ /(^|[[:space:]])GIT_[A-Z_]+=/) git_context_unknown = 1
    if (depth == 0) simple_tool = simple_command(text, depth, n)
    for (i = 1; i <= n + 1; i++) {
        kind = K[depth, i]
        if (i <= n && kind != ";" && kind != "\n" && kind != "&" && kind != "&&" && kind != "|" && kind != "|&" && kind != "||" && kind != "(" && kind != ")" && kind != "{" && kind != "}") continue
        data = segment(depth, start, i - 1, cwd, uncertain, depth, "", pipe, fed, kind)
        pipe = (kind == "|" || kind == "|&" ? data : "")
        head = start
        while (head < i && command_prefix(W[depth, head])) head++
        if (kind != "|" && kind != "|&" && member("cd pushd popd", W[depth, head])) {
            old = ""
            for (j = head + 1; j < i; j++) {
                if (K[depth, j] == "word" && W[depth, j] ~ /^-/) { old = "!"; break }
            }
            j = head + 1
            path = W[depth, j]
            if (old == "!" || W[depth, head] == "popd" || path == "") uncertain = 1
            else {
                # The sole expansion proof is an initial, top-level cd ~+/literal.
                # Nested/later destinations never consult an environment prefix.
                if (depth == 0 && level == 0 && start == 1 && head == 1 && W[depth, head] == "cd" && CT[depth, j] && !uncertain) old = ENVIRON["GSW_CWD"] substr(path, 3)
                else if (path ~ /[$`~*?\[{}]/) old = "!"
                else if (path ~ /^\//) old = path
                else old = uncertain ? "!" : cwd "/" path
                if (old == "!") uncertain = 1
                else { cwd = old; uncertain = 0 }
            }
        }
        if (kind == "(") { CWD[depth, ++level] = cwd; UNC[depth, level] = uncertain }
        if (kind == ")" && level > 0) { cwd = CWD[depth, level]; uncertain = UNC[depth, level--] }
        start = i + 1
    }
}
function quote_path(path,    q) { q = "\047"; gsub(/\047/, "\047\\\047\047", path); return q path q }
BEGIN { option_grammars(); parse(ENVIRON["GSW_COMMAND"], ENVIRON["GSW_CWD"], 0, 0) }
AWK
classifier="$script_directory/cratis-guard-writes.sh"
repository_root="$cwd"
while [ ! -e "$repository_root/.git" ]; do
    if [ "$repository_root" = / ]; then repository_root=''; break; fi
    repository_root="${repository_root%/*}"
    [ -n "$repository_root" ] || repository_root=/
done
destructive_text="$(GSW_COMMAND="$command_text" GSW_CWD="$cwd" GSW_ROOT="$repository_root" LC_ALL=C awk "$destructive_program" </dev/null)" || parser_failed
if [ -n "$destructive_text" ]; then
    destructive_candidates=()
    while IFS= read -r candidate; do
        if [ "$candidate" = '!archive' ]; then
            printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: archive extraction cannot be checked by the guard.' >&2
            archive_guidance
            exit 2
        fi
        if [ "$candidate" = '!' ]; then
            printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: a destructive command targets an operand that could not be resolved; use explicit paths or report the intended change.' >&2
            exit 2
        fi
        destructive_candidates[${#destructive_candidates[@]}]="$candidate"
    done <<<"$destructive_text"
    destructive_input="$(jq -nc --arg cwd "$cwd" --args '{cwd:$cwd,tool_input:{file_paths:$ARGS.positional}}' -- "${destructive_candidates[@]}")" || parser_failed
    destructive_references="$("$BASH" "$classifier" --destructive-references <<<"$destructive_input")" || {
        printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard failed).' >&2
        exit 2
    }
    if [ -n "$destructive_references" ]; then
        destructive_reference="${destructive_references%%$'\n'*}"
        destructive_reference="${destructive_reference#"$cwd"/}"
        destructive_reference="${destructive_reference#./}"
        printf "BLOCKED by cratis-guard-shell-writes: protected reference '%s' (cratis-guard-writes). Use the edit/write tools, or report the intended change; for a read, name literal paths or use the Read/Grep tools.\n" "$destructive_reference" >&2
        exit 2
    fi
fi
glob_shell_safe=1
if [[ -n "${BASH_ENV+x}" || -n "${ENV+x}" || -n "${GLOBIGNORE+x}" ]]; then glob_shell_safe=0; fi
candidates_text="$(GSW_COMMAND="$command_text" GSW_CWD="$cwd" GSW_GLOB_SAFE="$glob_shell_safe" GSW_MODE=targets LC_ALL=C awk "$program" </dev/null)" || parser_failed
[ -n "$candidates_text" ] || exit 0
# The lowercase alias of a mixed-case path serves case-insensitive file systems. Drop it only where the
# longest existing prefix of the original spelling exists and its lowercase spelling provably does not
# (a case-sensitive lookup that names nothing). Any doubt keeps the alias (return 0).
alias_needed() {
    local original="$1" base="" prefix lower parent
    case "$original" in *[A-Z]*) ;; *) return 0 ;; esac
    [ -d "$cwd" ] || return 0
    case "$original" in /*) ;; *) base="$cwd/" ;; esac
    # A `..` component (also in the working directory) is resolved by the classifier lexically before symlinks.
    case "/$base$original/" in */../*) return 0 ;; esac
    prefix="$original"
    while :; do
        while [ "${#prefix}" -gt 1 ] && [ "${prefix%/}" != "$prefix" ]; do prefix="${prefix%/}"; done
        case "$prefix" in "" | /) return 0 ;; esac
        if [ -e "$base$prefix" ] || [ -L "$base$prefix" ]; then break; fi
        case "$prefix" in */*) prefix="${prefix%/*}" ;; *) return 0 ;; esac
    done
    case "$prefix" in *[A-Z]*) ;; *) return 0 ;; esac
    lower="${2:0:${#prefix}}"
    [ "${#lower}" -eq "${#prefix}" ] || return 0
    if [ -e "$base$lower" ] || [ -L "$base$lower" ]; then return 0; fi
    # Absence only counts when the nearest existing ancestor of that spelling is a searchable directory
    # (the lookup then ends in "no such entry", not in a permission or other lookup error).
    parent="$lower"
    while :; do
        case "$parent" in */*) parent="${parent%/*}" ;; *) parent="" ;; esac
        [ -n "$parent" ] || [ "${lower#/}" = "$lower" ] || parent="/"
        if [ -z "$parent" ]; then parent="${base:-/}"; break; fi
        if [ -e "$base$parent" ] || [ -L "$base$parent" ]; then parent="$base$parent"; break; fi
    done
    [ -d "$parent" ] && [ -x "$parent" ] || return 0
    return 1
}
candidates=()
while IFS= read -r candidate; do
    case "$candidate" in
        $'\001'*)
            alias_rest="${candidate#?}"
            if alias_needed "${alias_rest%%$'\001'*}" "${alias_rest#*$'\001'}"; then candidates[${#candidates[@]}]="${alias_rest#*$'\001'}"; fi
            ;;
        *) candidates[${#candidates[@]}]="$candidate" ;;
    esac
done <<<"$candidates_text"
[ "${#candidates[@]}" -gt 0 ] || exit 0
classifier="$script_directory/cratis-guard-writes.sh"
[ -f "$classifier" ] || {
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard is missing).' >&2
    exit 2
}
classifier_input="$(jq -nc --arg cwd "$cwd" --args '{cwd:$cwd,tool_input:{file_paths:$ARGS.positional}}' -- "${candidates[@]}")" || parser_failed
# Tool labels and this hook shell do not establish the execution shell options.
# Keep conservative dotfile intersections for every command, especially mutators.
classifier_error="$(mktemp)" || parser_failed
trap 'rm -f "$classifier_error"' EXIT
references="$("$BASH" "$classifier" --references <<<"$classifier_input" 2>"$classifier_error")" || {
    # A command that is not read-only is refused whatever the classifier could model, so an unmodeled word
    # (for example program text inside an interpreter heredoc) must not hide the refusal behind a parser
    # failure. A read-only command keeps the fail-closed parser failure.
    if ! GSW_COMMAND="$command_text" GSW_MODE=readonly GSW_CWD="$cwd" GSW_GLOB_SAFE="$glob_shell_safe" GSW_PROTECTED="" LC_ALL=C awk "$program" </dev/null; then
        printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: this command is not read-only and its references could not all be modeled; use the edit/write tools, or report the intended change.' >&2
        exit 2
    fi
    cat "$classifier_error" >&2
    printf '%s\n' 'BLOCKED by cratis-guard-shell-writes: could not check references (write guard failed).' >&2
    exit 2
}
[ -n "$references" ] || exit 0
if GSW_COMMAND="$command_text" GSW_MODE=readonly GSW_CWD="$cwd" GSW_GLOB_SAFE="$glob_shell_safe" GSW_PROTECTED="$references" LC_ALL=C awk "$program" </dev/null; then exit 0; fi
printf "BLOCKED by cratis-guard-shell-writes: protected reference '%s' (cratis-guard-writes). Use the edit/write tools, or report the intended change; for a read, name literal paths or use the Read/Grep tools.\n" "${references%%$'\n'*}" >&2
exit 2
