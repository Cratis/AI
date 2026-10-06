#!/usr/bin/env bash
# Stop hook — the real quality gate.
#
# Looks at what actually changed in the working tree, runs only the gates that change touches,
# and exits 2 (blocking turn-end, stderr fed back to the model) when one fails. It never edits
# code: it only builds, tests and lints. With no changes it exits silently. An empty plan for
# a changed tree reports on stderr that no product verification was performed, without running gates.
#
# Gate commands are data (quality-gates.json), not code — see that file for the schema.
#
# Environment:
#   CRATIS_HOOKS_SKIP_GATE=1     skip the gate entirely
#   CRATIS_HOOKS_GATE_DRYRUN=1   print the dispatch plan (which gates would run, and why) and exit 0
#   CRATIS_HOOKS_GATES=<path>    use a different gate configuration file
set -euo pipefail

# SCRIPTDIR, not a path relative to the caller: shellcheck resolves a plain relative `source=`
# against the current working directory, and these hooks are linted from wherever CI happens to run.
# shellcheck source=SCRIPTDIR/hook-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/hook-lib.sh"

[ "${CRATIS_HOOKS_SKIP_GATE:-0}" = "1" ] && exit 0

input="$(hook_read_stdin)"
hook_have jq || exit 0

# Never re-enter: Claude Code sets stop_hook_active when the previous Stop hook already
# blocked and the model is continuing. Blocking again would loop forever.
if [ -n "$input" ] && [ "$(hook_json "$input" '.stop_hook_active')" = "true" ]; then
    exit 0
fi

root="$(hook_repo_root)"
here="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
config="${CRATIS_HOOKS_GATES:-$here/quality-gates.json}"
dryrun="${CRATIS_HOOKS_GATE_DRYRUN:-0}"

[ -f "$config" ] || exit 0
jq -e . "$config" >/dev/null 2>&1 || {
    printf 'cratis-quality-gate: %s is not valid JSON — gate skipped.\n' "$config" >&2
    exit 0
}

# ── Project-owned overrides ──────────────────────────────────────────────────
# Where a repository's own answer to "which directory does this gate build in" lives. It is
# outside the managed tree on purpose: a repository that instead edits the managed
# quality-gates.json mixes project facts into Cratis-owned content, so the next managed update
# either reports drift or silently discards the repository's own configuration. The override
# states only what differs, keyed by gate id, and nothing here needs a script fork.
#
# The merge is shallow (a patch field replaces the base field), with one exception: a patch that
# replaces `command` but does not state `requires` also drops the base gate's
# requires.packageScripts. Those scripts guard the base command; keeping them would make the
# overriding repository's own command a silent NO-OP whenever it lacks e.g. g:compile.
overrides="$root/.cratis/ai/quality-gates.project.json"
if [ -f "$overrides" ]; then
    if jq -e . "$overrides" >/dev/null 2>&1; then
        merged="$(mktemp "${TMPDIR:-/tmp}/cratis-quality-gates.XXXXXX")"
        if jq -s '
            .[0] as $base | .[1] as $over
            | ($over.gates // []) as $gates
            | def patched($gate; $patch):
                ($gate + ($patch | del(.id))) as $m
                | if ($patch | has("command")) and (($patch | has("requires")) | not) and ($m.requires != null)
                  then $m | .requires |= del(.packageScripts)
                  else $m end;
            $base
            + ($over | del(.gates))
            + { gates: [ $base.gates[] as $gate
                | ($gates | map(select(.id == $gate.id)) | first) as $patch
                | if $patch == null then $gate else patched($gate; $patch) end ] }
        ' "$config" "$overrides" >"$merged" 2>/dev/null; then
            unknown="$(jq -r --slurpfile base "$config" '[.gates // [] | .[].id] - [$base[0].gates[].id] | .[]' "$overrides" 2>/dev/null || true)"
            [ -n "$unknown" ] && printf 'cratis-quality-gate: %s overrides unknown gate(s): %s\n' \
                "${overrides#"$root"/}" "$(printf '%s' "$unknown" | tr '\n' ' ')" >&2
            config="$merged"
        else
            rm -f "$merged"
            printf 'cratis-quality-gate: %s could not be merged — managed gates used unchanged.\n' \
                "${overrides#"$root"/}" >&2
        fi
    else
        printf 'cratis-quality-gate: %s is not valid JSON — managed gates used unchanged.\n' \
            "${overrides#"$root"/}" >&2
    fi
fi

[ "$(jq -r '.enabled // true' "$config")" = "true" ] || exit 0

# ── What changed in the working tree ─────────────────────────────────────────
git -C "$root" rev-parse --git-dir >/dev/null 2>&1 || exit 0
changed="$(
    {
        git -C "$root" diff --name-only HEAD 2>/dev/null || true
        git -C "$root" ls-files --others --exclude-standard 2>/dev/null || true
    } | LC_ALL=C sort -u
)"
[ -n "$changed" ] || exit 0

# ── Project discovery ────────────────────────────────────────────────────────
# A gate names *what kind of project* it builds, never a product's file. The repository's
# own solution or package is discovered here, so the shipped gates activate unchanged in an
# application, a framework, or a corpus-only repository. Read lazily: a configuration whose
# gates all use literal requires.paths never pays for the listing.
repo_paths=""
repo_paths_read=0
repository_paths() {
    if [ "$repo_paths_read" -eq 0 ]; then
        repo_paths_read=1
        repo_paths="$(
            {
                git -C "$root" ls-files 2>/dev/null || true
                git -C "$root" ls-files --others --exclude-standard 2>/dev/null || true
            } | LC_ALL=C sort -u
        )"
    fi
    printf '%s\n' "$repo_paths"
}

# An install manifest distinguishes a managed copy from the corpus's authored source.
# Resolve actual targets, not adapter names: a product may legitimately own .agents (etc.).
physical_root="$(cd -P "$root" && pwd -P)"
managed_root=""
if [ -f "$root/.cratis/ai.manifest.json" ] && [ -d "$root/.cratis/ai" ]; then
    managed_root="$(cd -P "$root/.cratis/ai" && pwd -P)"
fi

repository_project_path() {
    local path="$root/$1" dir target hops=0
    [ -f "$path" ] || return 1
    # cd -P resolves directory adapters; readlink also covers package-file adapters.
    while :; do
        dir="$(cd -P "$(dirname "$path")" 2>/dev/null && pwd -P)" || return 1
        path="$dir/$(basename "$path")"
        [ -L "$path" ] || break
        hops=$((hops + 1))
        [ "$hops" -le 40 ] || return 1
        target="$(readlink "$path")" || return 1
        path="$(hook_abspath "$target" "$dir")"
    done
    case "$path" in
        "$physical_root"/*) ;;
        *) return 1 ;; # Never build a different repository through a symlink.
    esac
    if [ -n "$managed_root" ]; then
        case "$path" in
            "$managed_root"/*) return 1 ;;
        esac
    fi
}

# Find the deepest containing project for EACH triggering path, not unrelated or excluded
# changes. Globs break ties between project files in the same directory. A single eligible
# project can own source outside its directory; several ambiguous projects require configuration.
discover_paths() {
    local g candidates candidate eligible="" count=0 first="" match dir p depth best selected=""
    while IFS= read -r g; do
        [ -n "$g" ] || continue
        candidates="$(repository_paths | CRATIS_GLOB="$g" awk "$hook_glob_awk_lib"'
            BEGIN { re = g2re(ENVIRON["CRATIS_GLOB"]) }
            $0 ~ re { print }
        ')"
        while IFS= read -r candidate; do
            [ -n "$candidate" ] || continue
            repository_project_path "$candidate" || continue
            # Several globs can match the same project file.
            case "
$eligible
" in
                *"
$candidate
"*) continue ;;
            esac
            eligible="${eligible}${eligible:+
}$candidate"
            count=$((count + 1))
            [ -n "$first" ] || first="$candidate"
        done <<EOF
$candidates
EOF
    done <<EOF
$1
EOF
    [ "$count" -gt 0 ] || return 1
    while IFS= read -r p; do
        [ -n "$p" ] || continue
        match=""
        best=-1
        while IFS= read -r candidate; do
            dir="$(dirname "$candidate")"
            case "$p" in
                "$dir"/*) ;;
                *) [ "$dir" = "." ] || continue ;;
            esac
            # All containing directories are ancestors of this same path, so length
            # orders their depth; unrelated directory names never enter this comparison.
            depth=${#dir}
            [ "$dir" = "." ] && depth=0
            if [ "$depth" -gt "$best" ]; then
                match="$candidate"
                best=$depth
            fi
        done <<EOF
$eligible
EOF
        if [ -z "$match" ]; then
            if [ "$count" -eq 1 ]; then
                match="$first"
            else
                printf 'cratis-quality-gate: UNVERIFIED — no containing project for %s among multiple candidates. Configure workingDirectory.\n' "$p" >&2
                return 2
            fi
        fi
        selected="${selected}${selected:+
}$match"
    done <<EOF
$2
EOF
    printf '%s\n' "$selected" | LC_ALL=C sort -u
}

gate_count="$(jq -r '.gates | length' "$config")"
[ "${gate_count:-0}" -gt 0 ] || exit 0
fail_fast="$(jq -r '.failFast // true' "$config")"
max_lines="$(jq -r '.maxOutputLines // 60' "$config")"

tmp_root="$(hook_state_dir "$(hook_json "$input" '.session_id')")" || tmp_root="${TMPDIR:-/tmp}"
log_dir="$tmp_root/gate-logs"
mkdir -p "$log_dir" 2>/dev/null || log_dir="${TMPDIR:-/tmp}"

# Collect ALL paths matching this gate's globs after its exclusions, for discovery too.
gate_changed_paths() {
    local idx="$1" inc exc p
    inc="$(jq -r --argjson i "$idx" '.gates[$i].changed // [] | .[]' "$config")"
    exc="$(jq -r --argjson i "$idx" '.gates[$i].excludeChanged // [] | .[]' "$config")"
    [ -n "$inc" ] || return 0
    while IFS= read -r p; do
        [ -n "$p" ] || continue
        printf '%s\n' "$inc" | hook_glob_match "$p" || continue
        if [ -n "$exc" ]; then
            printf '%s\n' "$exc" | hook_glob_match "$p" && continue
        fi
        printf '%s\n' "$p"
    done <<EOF
$changed
EOF
    return 0
}

# Does the package.json at $1 define the script named $2? A missing file or a file that is not
# valid JSON defines nothing.
package_defines_script() {
    [ -f "$1" ] && jq -e --arg s "$2" '.scripts[$s] != null' "$1" >/dev/null 2>&1
}

# Report the first unmet requirement, or nothing when the gate can run here. $2 is the directory,
# relative to the repository root, the gate runs in.
gate_unmet() {
    local idx="$1" dir="$2" c p s
    while IFS= read -r c; do
        [ -n "$c" ] || continue
        hook_have "$c" || { printf "command '%s' is not on PATH" "$c"; return 0; }
    done <<EOF
$(jq -r --argjson i "$idx" '.gates[$i].requires.commands // [] | .[]' "$config")
EOF
    while IFS= read -r p; do
        [ -n "$p" ] || continue
        [ -e "$root/$p" ] || { printf "'%s' does not exist in this repository" "$p"; return 0; }
    done <<EOF
$(jq -r --argjson i "$idx" '.gates[$i].requires.paths // [] | .[]' "$config")
EOF
    # A package.json script a gate invokes must exist, or yarn fails with "Couldn't find a script"
    # instead of the gate being a NO-OP. A global script (g:) may live in the root package.json
    # that the workspace's own package.json defers to. That fallback assumes Yarn Berry, where
    # a g: script defined at the root is runnable from every workspace; no workspace package.json
    # is inspected.
    while IFS= read -r s; do
        [ -n "$s" ] || continue
        package_defines_script "$root/$dir/package.json" "$s" && continue
        case "$s" in
            g:*) package_defines_script "$root/package.json" "$s" && continue ;;
        esac
        printf "script '%s' is not defined in %s" "$s" "$dir/package.json"
        return 0
    done <<EOF
$(jq -r --argjson i "$idx" '.gates[$i].requires.packageScripts // [] | .[]' "$config")
EOF
    return 0
}

idx=0
ran=0
while [ "$idx" -lt "$gate_count" ]; do
    id="$(jq -r --argjson i "$idx" '.gates[$i].id' "$config")"
    desc="$(jq -r --argjson i "$idx" '.gates[$i].description // ""' "$config")"
    wd="$(jq -r --argjson i "$idx" '.gates[$i].workingDirectory // ""' "$config")"

    gate_changes="$(gate_changed_paths "$idx")"
    if [ -z "$gate_changes" ]; then
        [ "$dryrun" = "1" ] && printf 'cratis-quality-gate: SKIP  %-24s (no matching change)\n' "$id" >&2
        idx=$((idx + 1))
        continue
    fi

    # Discovery is a requirement and can select multiple affected project directories.
    workdirs="$wd"
    if [ -z "$workdirs" ]; then
        wd_globs="$(jq -r --argjson i "$idx" '.gates[$i].workingDirectoryFrom // [] | .[]' "$config")"
        if [ -n "$wd_globs" ]; then
            discovery_rc=0
            wd_paths="$(discover_paths "$wd_globs" "$gate_changes")" || discovery_rc=$?
            if [ "$discovery_rc" -eq 2 ]; then
                printf 'cratis-quality-gate: UNVERIFIED %-24s — ambiguous project discovery.\n' "$id" >&2
                exit 2
            fi
            if [ -z "$wd_paths" ]; then
                printf 'cratis-quality-gate: NO-OP %-24s — no repository path matches %s. Configure it in %s.\n' \
                    "$id" "$(printf '%s' "$wd_globs" | tr '\n' ' ')" "${config#"$root"/}" >&2
                idx=$((idx + 1))
                continue
            fi
            workdirs="$(while IFS= read -r wd_path; do dirname "$wd_path"; done <<EOF
$wd_paths
EOF
)"
            workdirs="$(printf '%s\n' "$workdirs" | LC_ALL=C sort -u)"
        fi
    fi
    [ -n "$workdirs" ] || workdirs="."

    project_index=0
    while IFS= read -r wd; do
        project_index=$((project_index + 1))
        unmet="$(gate_unmet "$idx" "$wd")"
        if [ -n "$unmet" ]; then
            printf 'cratis-quality-gate: NO-OP %-24s — %s. Configure it in %s.\n' \
                "$id" "$unmet" "${config#"$root"/}" >&2
            continue
        fi

        cmd=()
        while IFS= read -r arg; do
            cmd+=("$arg")
        done <<EOF
$(jq -r --argjson i "$idx" '.gates[$i].command // [] | .[]' "$config")
EOF
        if [ "${#cmd[@]}" -eq 0 ]; then
            continue
        fi

        if [ "$dryrun" = "1" ]; then
            printf 'cratis-quality-gate: RUN   %-24s %s\n                            $ %s   (cwd: %s)\n' \
                "$id" "$desc" "${cmd[*]}" "$wd" >&2
            ran=$((ran + 1))
            continue
        fi

        log="$log_dir/$id.log"
        [ "$project_index" -eq 1 ] || log="$log_dir/$id-$project_index.log"
        rc=0
        (cd -P "$root/$wd" && "${cmd[@]}") >"$log" 2>&1 || rc=$?
        ran=$((ran + 1))

        if [ "$rc" -ne 0 ]; then
            {
                printf 'QUALITY GATE FAILED: %s (exit %s)\n' "$id" "$rc"
                printf '  %s\n' "$desc"
                printf '  $ %s   (cwd: %s)\n\n' "${cmd[*]}" "$wd"
                printf -- '--- last %s lines ---\n' "$max_lines"
                tail -n "$max_lines" "$log" 2>/dev/null || true
                printf -- '--- end ---\n\n'
                printf 'Fix the failure and re-run the gate. Never change code merely to make a gate pass,\n'
                printf 'and never suppress warnings. Full log: %s\n' "$log"
            } >&2
            [ "$fail_fast" = "true" ] && exit 2
            failed=1
        fi
    done <<EOF
$workdirs
EOF
    idx=$((idx + 1))
done

[ "${failed:-0}" -eq 0 ] || exit 2
[ "$dryrun" = "1" ] && printf 'cratis-quality-gate: dry run complete — %s gate(s) would run.\n' "$ran" >&2
[ "$ran" -eq 0 ] && printf 'cratis-quality-gate: no gates selected — product verification was not performed.\n' >&2
exit 0
