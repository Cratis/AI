#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail

usage() {
    cat <<'HELP'
Usage: cratis-local-packages.sh [--dry-run] COMMAND [ARGS]
Portable local package verification for macOS/Linux (Bash 3.2+). Windows: use WSL.
Exit codes: 0 success, 1 findings/failed operation, 2 cannot run/invalid input.

Commands (COMMAND --help shows these instructions too):
  stamp PRODUCER [PRODUCER...]
    Next patch of the highest reachable vX.Y.Z tag, UTC minute and HEAD sha7.
    With several producers the highest next patch wins (one stamp for a multi-hop
    chain, so no stamped package sorts below a released pin) and sha7 is the last
    producer's; every HEAD is printed to stderr.
  stamp --train PRODUCER [PRODUCER...]
    Train stamp X.Y.Z-train.g<sha7>: the same next patch, no minute, so one code
    state always yields one stamp. Accepted everywhere a local stamp is.
  plan [--map FILE] CONSUMER PRODUCER...
    Read-only. Print the plan derived from scripts/dependency-map.tsv (or
    CRATIS_LOCAL_MAP) for repository names listed in dependency order: pack rows
    (producer, ecosystem), overlay rows (producer, upstream) and consume rows
    (the consumer's own edges). Exit 2, nothing printed: unknown or repeated name,
    no edge, wrong order, a planned pack without ids or pack rows.
  verify-pack STAMP --consumer CONSUMER --producer PRODUCER... [--json] [--map FILE]
    Check exactly the plan that "plan" prints for those names: every planned package
    exists in the feed at exactly STAMP (never another stamp), and each nuspec
    dependency on another planned NuGet ID has STAMP as its lower bound. Run once,
    after the last pack. Exit 1 lists the findings ("missing: ..." / "dependency: ...").
    Exit 2: invalid plan, or a plan without pack rows (image-only). --json prints one
    line, {"stamp":..,"packages":[{"id":..,"version":..}]}, and sends findings to stderr.
  verify-pack STAMP NAME... [--ecosystem nuget|npm] [--json]
    Manual, weaker form: the IDs the map lists for each named repository (optionally
    one ecosystem) exist at STAMP and their planned NuGet dependencies point at STAMP.
  verify-assets CONSUMER-PATH STAMP [--npm] [--dir REL] [--json] --consumer C --producer P...
    Checks the same plan inside the consumer. Exit 1: a planned package missing from
    the feed; a planned ID resolved at another version ("ID VERSION PATH"); a producer
    the consumer uses in this ecosystem with none of its IDs resolved ("unconsumed:").
    NuGet reads obj/project.assets.json (none: exit 2); --npm reads installed copies
    under node_modules (under REL if given). --json: the consumer's resolved ids and versions.
  verify-assets CONSUMER-PATH STAMP [--npm] [--dir REL] [--json]
    Manual, weaker form without a plan: every package at STAMP in the feed that the
    consumer resolves must be STAMP (none resolved: exit 1).
  pack-nuget PRODUCER STAMP [--property NAME=VALUE]... PROJECT-OR-SLN...
    Release-pack each target into the NuGet feed; requires dotnet. Each --property
    becomes one -p:NAME=VALUE argument of that command only (closure prints the
    properties of each map pack row); no environment variable carries them.
  pack-npm PRODUCER STAMP
    Requires node, npm and Yarn 4, and a completed repository build. Temporarily
    version non-private workspaces, pack each with npm pack --ignore-scripts (the
    publish workflows' tool, so the tarball matches the published one) as
    <scope>-<name>-<version>.tgz, and restore tracked manifests even on failure.
    This helper does not build or run lifecycle scripts.
  use-nuget CONSUMER STAMP [--pin-transitive] [PACKAGE-ID...]
    Create a CPM overlay importing the repository's own Directory.Packages.props.
    Transitive pinning stays as the consumer sets it; --pin-transitive forces it on so
    stamped IDs the consumer does not pin still take effect (can raise NU1109 floors).
    Defaults to every stamped package ID in the feed. Prints properties and sourceable
    env. With source mapping, also prints the required restore --configfile.
    Non-CPM: manually use an untracked project copy with explicit PackageReference
    versions and dotnet restore --source FEED/nuget; do not edit shipped versions.
  use-npm CONSUMER STAMP [--dir REL]
    --dir REL names a Yarn project in a subdirectory (restore and clean follow it).
    Requires node and tar. Back up package.json, yarn.lock (including existing edits),
    and git diff; add file-tarball resolutions for every stamped feed package.
    Run yarn install afterward. Only one active npm overlay per session.
  restore CONSUMER
    Restore npm backups when only overlay resolutions and their local lockfile
    entries changed (including yarn install). Refuse unrelated changes and retain
    backups for review. Remove CPM/env overlays
    and run check. No git checkout is used on consumer files.
  check REPO [--staged]
    Scan added/changed tracked lines (staged-only if requested), plus all contents
    of untracked, non-ignored files. Reports path:line:pattern and file counts.
  clean [CONSUMER] [--stamp STAMP | --all] [--apply] [--dir REL]
    Default: list all local feed/cache/image/session subjects, without deleting.
    --apply deletes listed subjects (docker rmi, never force). Refuses more than
    CRATIS_LOCAL_CLEAN_MAX subjects (default 500), or unresolved npm backups.
    Known sessions are registered in FEED/sessions; an optional consumer also
    discovers its per-worktree session. Docker probes have a 10-second deadline.
  --self-test
    Isolated scratch HOME tests; npm uses inherited PATH to discover node.
    Other tests use system PATH. Reports passed and skipped counts.

Configuration: source ${XDG_CONFIG_HOME:-$HOME/.config}/cratis/local-packages.env
if present (trusted shell code), then use these defaults for unset variables:
  CRATIS_LOCAL_FEED=${XDG_CACHE_HOME:-$HOME/.cache}/cratis/local-feed
  CRATIS_LOCAL_SESSION_DIR=<absolute-git-dir>/cratis-local (per checkout)
  NUGET_PACKAGES=$HOME/.nuget/packages
  CRATIS_LOCAL_CLEAN_MAX=500
  CRATIS_LOCAL_RUN=optional executable wrapper, invoked for each heavy step as:
    "$CRATIS_LOCAL_RUN" build LABEL -- COMMAND ARGUMENTS...
Global --dry-run prints mutations instead of executing them; read-only discovery
still runs. Use a unique stamp once per producer build. Never publish local builds.
HELP
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 2; }
failed() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "required executable not found: $1"; }
quote_command() { printf ' +'; printf ' %q' "$@"; printf '\n'; }
DRY=0
ARGS=()
for argument in "$@"; do
    case "$argument" in --dry-run) DRY=1 ;; *) ARGS+=("$argument") ;; esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}
case " ${*:-} " in *' --help '*|*' -h '*) usage; exit 0 ;; esac
[ $# -gt 0 ] || { usage; exit 2; }
SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
# Self-test dispatch precedes configuration so the real HOME/config cannot affect it.
MODE=$1
shift
if [ "$MODE" != --self-test ]; then
    CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}/cratis/local-packages.env
    if [ -f "$CONFIG" ]; then
        # shellcheck source=/dev/null
        source "$CONFIG"
    fi
fi
FEED=${CRATIS_LOCAL_FEED:-${XDG_CACHE_HOME:-$HOME/.cache}/cratis/local-feed}
NUGET_CACHE=${NUGET_PACKAGES:-$HOME/.nuget/packages}
case "$FEED" in /*) ;; *) FEED=$PWD/$FEED ;; esac
case "$NUGET_CACHE" in /*) ;; *) NUGET_CACHE=$PWD/$NUGET_CACHE ;; esac
TMP=''
PACK_REPO=''
PACK_MANIFESTS=()
cleanup() {
    local status=$?
    trap - EXIT
    if [ ${#PACK_MANIFESTS[@]} -gt 0 ]; then
        if ! git -C "$PACK_REPO" checkout -- "${PACK_MANIFESTS[@]}"; then
            printf 'ERROR: producer manifest restoration failed: %s\n' "$PACK_REPO" >&2
            status=1
        fi
    fi
    if [ -n "$TMP" ]; then rm -rf -- "$TMP"; fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
scratch() { if [ -z "$TMP" ]; then TMP=$(mktemp -d "${TMPDIR:-/tmp}/cratis-local.XXXXXXXX"); fi; }
mutate() { if [ "$DRY" -eq 1 ]; then quote_command "$@"; else "$@"; fi; }
heavy() {
    local kind=$1 label=$2
    shift 2
    if [ -n "${CRATIS_LOCAL_RUN:-}" ]; then
        mutate "$CRATIS_LOCAL_RUN" "$kind" "$label" -- "$@"
    else
        mutate "$@"
    fi
}
repo_root() { git -C "$1" rev-parse --show-toplevel 2>/dev/null || die "not a Git repository: $1"; }
valid_stamp() {
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+-(local\.[0-9]{12}|train)\.g[0-9a-f]{7}$ ]] || die "invalid local stamp: $1"
}
session_path() {
    local path git_dir
    git_dir=$(git -C "$1" rev-parse --absolute-git-dir)
    path=${CRATIS_LOCAL_SESSION_DIR:-$git_dir/cratis-local}
    case "$path" in /*) ;; *) path=$PWD/$path ;; esac
    [ "$path" != / ] && [ "$path" != "$1" ] && [ ! -L "$path" ] || die "unsafe session directory: $path"
    # Git's own directory is never tracked, but check-ignore does not classify it
    # as ignored. Other in-checkout overrides must still be explicitly ignored.
    case "$path/" in
        "$git_dir/"*) ;;
        "$1/"*) git -C "$1" check-ignore -q "$path/" || die "session override must be outside tracked files or ignored" ;;
    esac
    printf '%s\n' "$path"
}
validate_session() {
    local session=$1 entry
    [ ! -L "$session" ] || die "symlink session directory: $session"
    [ -d "$session" ] || return 0
    for entry in "$session"/* "$session"/.[!.]* "$session"/..?*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        [ ! -L "$entry" ] || die "symlink in session: $entry"
        case "${entry##*/}" in
            repo|stamp|env|npm-dir|Directory.Packages.props|nuget.config) [ -f "$entry" ] || die "unexpected session entry: $entry" ;;
            npm-backup) [ -d "$entry" ] || die "unexpected session entry: $entry" ;;
            *) die "unrecognized file in session (preserved): $entry" ;;
        esac
    done
}
register_session() {
    local repo=$1 session=$2 stamp=$3
    validate_session "$session"
    if [ -f "$session/repo" ] && [ "$(cat "$session/repo")" != "$repo" ]; then die 'session belongs to another checkout'; fi
    mkdir -p "$session" "$FEED"
    printf '%s\n' "$repo" > "$session/repo"
    printf '%s\n' "$stamp" > "$session/stamp"
    if [ ! -f "$FEED/sessions" ] || ! grep -Fxq -- "$session" "$FEED/sessions"; then
        printf '%s\n' "$session" >> "$FEED/sessions"
    fi
}
xml_escape() { printf '%s' "$1" | sed -e 's/\&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/\&apos;/g"; }

# Next patch of the highest reachable vX.Y.Z tag; sets NEXT_BASE.
next_base() {
    local tag major minor patch
    tag=$(git -C "$1" tag --merged HEAD | awk '/^v[0-9]+\.[0-9]+\.[0-9]+$/' | sort -t. -k1.2,1n -k2,2n -k3,3n | tail -n 1)
    if [ -n "$tag" ]; then
        IFS=. read -r major minor patch <<< "${tag#v}"
        NEXT_BASE="$major.$minor.$((10#$patch + 1))"
    else
        printf 'WARNING: no reachable vX.Y.Z tag in %s; using 0.1.0\n' "$1" >&2
        NEXT_BASE=0.1.0
    fi
}
# True when version $1 sorts above $2 (major.minor.patch).
base_above() {
    local top
    top=$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)
    [ "$top" = "$1" ] && [ "$1" != "$2" ]
}

stamp() {
    [ $# -ge 1 ] || die 'stamp requires a producer repository'
    local repo base='' sha='' arg train=0 lines='' rname origin
    if [ "$1" = --train ]; then train=1; shift; [ $# -ge 1 ] || die 'stamp --train requires a producer repository'; fi
    for arg in "$@"; do
        repo=$(repo_root "$arg")
        next_base "$repo"
        if [ -z "$base" ] || base_above "$NEXT_BASE" "$base"; then base=$NEXT_BASE; fi
        sha=$(git -C "$repo" rev-parse HEAD) || die 'producer has no HEAD commit'
        if [ $# -gt 1 ]; then printf 'HEAD %s %s\n' "$repo" "$sha" >&2; fi
        # The repository name is its origin's last path part (stable across checkouts), else its folder name.
        origin=$(git -C "$repo" remote get-url origin 2>/dev/null || true)
        rname=$(basename "${origin:-$repo}"); rname=${rname%.git}
        lines="$lines$rname $sha"$'\n'
    done
    # With several producers the highest base wins, so no stamped package sorts
    # below a released pin of another stamped package (NU1605).
    # A train stamp has no minute and its sha7 covers every producer: the first 7 hex characters of the
    # SHA-1 of the sorted "<repo> <full HEAD sha>" lines. One combined code state always yields the same
    # stamp, and a change in any producer changes it. The grammar stays X.Y.Z-train.g<sha7>.
    if [ "$train" -eq 1 ]; then
        sha=$(printf '%s' "$lines" | LC_ALL=C sort -u | shasum -a 1) || die 'cannot hash the producer HEADs'
        printf '%s-train.g%.7s\n' "$base" "${sha%% *}"; return 0
    fi
    printf '%s-local.%s.g%.7s\n' "$base" "$(date -u +%Y%m%d%H%M)" "$sha"
}

pack_nuget() {
    [ $# -ge 3 ] || die 'pack-nuget requires producer, stamp and targets'
    local repo version target path count=0 property
    local properties=()
    repo=$(repo_root "$1"); version=$2; shift 2
    valid_stamp "$version"; need dotnet
    # Extra MSBuild properties (from the dependency map) go on the command line, never the environment:
    # an environment variable also reaches nested builds such as Chronicle's `dotnet run` code generator.
    while [ "${1:-}" = --property ]; do
        [ $# -ge 2 ] || die '--property requires NAME=VALUE'
        property=$2; shift 2
        [[ "$property" =~ ^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9_.,-]*$ ]] || die "invalid pack property: $property"
        properties+=("-p:$property")
    done
    [ $# -ge 1 ] || die 'pack-nuget requires at least one target after the properties'
    mutate mkdir -p "$FEED/nuget"
    for target in "$@"; do
        (cd "$repo" && heavy build "pack NuGet $target" dotnet pack "$target" -c Release "-p:PackageVersion=$version" "-p:Version=$version" ${properties[@]+"${properties[@]}"} -o "$FEED/nuget")
    done
    [ "$DRY" -eq 0 ] || return 0
    while IFS= read -r -d '' path; do
        printf '%s\n' "$path"; count=$((count + 1))
    done < <(find "$FEED/nuget" -type f -name "*.$version.nupkg" -print0)
    [ "$count" -gt 0 ] || failed 'pack produced no matching nupkgs'
    printf 'produced %s nupkgs\n' "$count"
}

# Pack one workspace with npm pack (what publish does) into the feed as <scope>-<name>-<version>.tgz.
pack_npm_workspace() {
    local repo=$1 manifest=$2 version=$3 dir name slug
    dir=$repo/$(dirname "$manifest")
    name=$(node -p "require(process.argv[1]).name" "$dir/package.json") || failed "cannot read package name: $manifest"
    slug=${name//\//-}
    if [ "$DRY" -eq 1 ]; then
        quote_command npm pack --ignore-scripts --pack-destination "$FEED/npm" "(in $dir)"
        return 0
    fi
    # Packing is a file copy, not a build: no queue slot per workspace.
    (cd "$dir" && mutate npm pack --ignore-scripts --pack-destination "$FEED/npm") >/dev/null
    [ "$FEED/npm/${slug#@}-$version.tgz" = "$FEED/npm/$slug-$version.tgz" ] || \
        mv -f "$FEED/npm/${slug#@}-$version.tgz" "$FEED/npm/$slug-$version.tgz" || failed "npm pack did not produce $name"
}

pack_npm() {
    [ $# -eq 2 ] || die 'pack-npm requires producer and stamp'
    local repo version path count=0
    repo=$(repo_root "$1"); version=$2
    valid_stamp "$version"; need node; need npm; need yarn; scratch
    git -C "$repo" diff --name-only HEAD -- 'package.json' '*/package.json' > "$TMP/modified"
    git -C "$repo" diff --cached --name-only -- 'package.json' '*/package.json' >> "$TMP/modified"
    git -C "$repo" diff --name-only -- 'package.json' '*/package.json' >> "$TMP/modified"
    [ ! -s "$TMP/modified" ] || die 'tracked package.json is already modified; preserve it before packing'
    (cd "$repo" && yarn workspaces list --json) > "$TMP/workspaces"
    node - "$repo" "$TMP/workspaces" > "$TMP/manifests" <<'NODE'
const fs = require('fs'), path = require('path');
const [repo, list] = process.argv.slice(2);
for (const line of fs.readFileSync(list, 'utf8').trim().split('\n')) {
    const workspace = JSON.parse(line);
    const file = path.join(workspace.location, 'package.json');
    if (!JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8')).private)
        process.stdout.write(file + '\0');
}
NODE
    PACK_REPO=$repo
    while IFS= read -r -d '' path; do
        git -C "$repo" ls-files --error-unmatch -- "$path" >/dev/null || die "untracked workspace manifest: $path"
        PACK_MANIFESTS+=("$path")
    done < "$TMP/manifests"
    [ ${#PACK_MANIFESTS[@]} -gt 0 ] || die 'no non-private workspaces found'
    if [ "$DRY" -eq 1 ]; then
        quote_command node '<set non-private workspace versions>' "$version" "${PACK_MANIFESTS[@]}"
        PACK_MANIFESTS=()
    else
        node - "$repo" "$version" "${PACK_MANIFESTS[@]}" <<'NODE'
const fs = require('fs'), path = require('path');
const [repo, version, ...files] = process.argv.slice(2);
for (const file of files) {
    const target = path.join(repo, file), json = JSON.parse(fs.readFileSync(target, 'utf8'));
    json.version = version;
    fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n');
}
NODE
    fi
    mutate mkdir -p "$FEED/npm"
    # npm pack, like the publish workflows' npm publish: yarn pack drops files of a gitignored dist folder.
    while IFS= read -r -d '' path; do
        pack_npm_workspace "$repo" "$path" "$version"
    done < "$TMP/manifests"
    if [ "$DRY" -eq 1 ]; then quote_command git -C "$repo" checkout -- '<versioned manifests>'; return 0; fi
    git -C "$repo" checkout -- "${PACK_MANIFESTS[@]}"
    PACK_MANIFESTS=()
    while IFS= read -r -d '' path; do
        printf '%s\n' "$path"; count=$((count + 1))
    done < <(find "$FEED/npm" -type f -name "*-$version.tgz" -print0)
    [ "$count" -gt 0 ] || failed 'pack produced no matching npm tarballs'
    printf 'produced %s npm tarballs\n' "$count"
}

# Read Include/Update attributes without assuming one element per line.
package_ids() {
    awk 'BEGIN { RS="<" } /^PackageVersion[[:space:]]/ {
        gsub(sprintf("%c",39),"\"")
        if (match($0, /(Include|Update)[[:space:]]*=[[:space:]]*"[^"]+"/)) {
            value=substr($0,RSTART,RLENGTH); sub(/^[^"]*"/,"",value); sub(/"$/,"",value); print value
        }
    }' "$1"
}
source_mapping() {
    local config=$1 output=$2 id
    shift 2
    scratch
    printf '%s\n' "$@" > "$TMP/ids"
    # Preserve all existing configuration, but remove exact mappings for overridden
    # IDs: NuGet must not select both the remote source and our local exact match.
    awk -v ids="$TMP/ids" -v feed="$(xml_escape "$FEED/nuget")" -v base="$(xml_escape "$(dirname "$config")")" '
        BEGIN { while ((getline id < ids)>0) { selected[tolower(id)]=1; ordered[++count]=id }; RS="<"; ORS="" }
        NR==1 { print; next }
        /^package[[:space:]]/ {
            value=$0; gsub(sprintf("%c",39),"\"",value)
            sub(/^.*pattern[[:space:]]*=[[:space:]]*"/,"",value); sub(/".*$/,"",value)
            if (tolower(value) in selected) next
        }
        /^packageSources[[:space:]]*>/ { sources=1 }
        /^\/packageSources[[:space:]]*>/ { sources=0 }
        sources && /^add[[:space:]]/ {
            # Relative source paths must retain their meaning after relocation.
            value=$0; gsub(sprintf("%c",39),"\"",value)
            if (match(value,/value[[:space:]]*=[[:space:]]*"[^"]*"/)) {
                attribute=substr(value,RSTART,RLENGTH); sub(/^[^"]*"/,"",attribute); sub(/"$/,"",attribute)
                if (attribute !~ /^([A-Za-z][A-Za-z0-9+.-]*:|\/|\\\\|%)/) {
                    sub(/value[[:space:]]*=[[:space:]]*"[^"]*"/,"value=\"" base "/" attribute "\"",value)
                    $0=value
                }
            }
        }
        /^\/packageSources[[:space:]]*>/ { print "<add key=\"cratis-local\" value=\"" feed "\" />\n" }
        /^\/packageSourceMapping[[:space:]]*>/ {
            print "<packageSource key=\"cratis-local\">\n"
            for (i=1;i<=count;i++) print "<package pattern=\"" ordered[i] "\" />\n"
            print "</packageSource>\n"
        }
        { print "<" $0 }
    ' "$config" > "$output"
}

use_nuget() {
    [ $# -ge 2 ] || die 'use-nuget requires consumer and stamp'
    local repo version session props id file config='' props_key sources_key action pin=0 args=()
    local ids=()
    repo=$(repo_root "$1"); version=$2; shift 2
    for id in "$@"; do
        if [ "$id" = --pin-transitive ]; then pin=1; else args+=("$id"); fi
    done
    set -- ${args[@]+"${args[@]}"}
    valid_stamp "$version"; props=$repo/Directory.Packages.props
    [ -f "$props" ] || die 'no Directory.Packages.props (non-CPM). Manual alternative: untracked project copy, explicit PackageReference versions, dotnet restore --source FEED/nuget'
    session=$(session_path "$repo"); scratch
    package_ids "$props" > "$TMP/consumer-ids"
    if [ $# -gt 0 ]; then
        ids=("$@")
    elif [ -d "$FEED/nuget" ]; then
        while IFS= read -r -d '' file; do
            id=${file##*/}; id=${id%."$version".nupkg}
            ids+=("$id")
        done < <(find "$FEED/nuget" -type f -name "*.$version.nupkg" -print0)
    fi
    [ ${#ids[@]} -gt 0 ] || die 'no matching NuGet package IDs found'
    for id in "${ids[@]}"; do
        [[ "$id" =~ ^[A-Za-z0-9_.-]+$ ]] || die "invalid package ID: $id"
        [ -f "$FEED/nuget/$id.$version.nupkg" ] || die "package missing from feed: $id $version"
    done
    while IFS= read -r -d '' file; do
        case "$file" in
            nuget.config|NuGet.Config|NuGet.config)
                if grep -q '<packageSourceMapping' "$repo/$file"; then config=$repo/$file; fi ;;
        esac
    done < <(git -C "$repo" ls-files -z)
    if [ -n "$config" ]; then
        if ! grep -q '</packageSources>' "$config" || ! grep -q '</packageSourceMapping>' "$config"; then
            die 'cannot overlay incomplete source mapping configuration'
        fi
        if grep -q 'key="cratis-local"' "$config"; then die 'source key cratis-local already exists'; fi
    fi
    if [ "$DRY" -eq 1 ]; then
        quote_command mkdir -p "$session"
        printf 'write %s importing %s; override %s IDs to %s\n' "$session/Directory.Packages.props" "$props" "${#ids[@]}" "$version"
        printf 'write %s/env%s\n' "$session" "${config:+ and nuget.config}"
        return 0
    fi
    register_session "$repo" "$session" "$version"
    {
        printf '<Project>\n  <Import Project="%s" />\n' "$(xml_escape "$props")"
        if [ "$pin" -eq 1 ]; then
            printf '  <PropertyGroup><CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled></PropertyGroup>\n'
        fi
        printf '  <ItemGroup>\n'
        for id in "${ids[@]}"; do
            action=Include
            if grep -Fxiq -- "$id" "$TMP/consumer-ids"; then action=Update; fi
            printf '    <PackageVersion %s="%s" Version="%s" />\n' "$action" "$id" "$version"
        done
        printf '  </ItemGroup>\n</Project>\n'
    } > "$session/Directory.Packages.props"
    props_key=DirectoryPackages"PropsPath"; sources_key=RestoreAdditional"ProjectSources"
    {
        printf 'export %s=%q\n' "$props_key" "$session/Directory.Packages.props"
        printf 'export %s=%q\n' "$sources_key" "$FEED/nuget"
    } > "$session/env"
    printf ' %q' "-p:$props_key=$session/Directory.Packages.props" "-p:$sources_key=$FEED/nuget"; printf '\n'
    printf 'source %q\n' "$session/env"
    if [ -n "$config" ]; then
        source_mapping "$config" "$session/nuget.config" "${ids[@]}"
        printf 'For restore, also pass: --configfile %q\n' "$session/nuget.config"
    elif [ -f "$session/nuget.config" ]; then
        rm -- "$session/nuget.config"
    fi
    printf 'overrode %s NuGet package IDs\n' "${#ids[@]}"
}

# Dependency map: tab-separated rows, '#' comments (see references/dependency-map.md).
# Everything below is derived from these rows; no function reads a feed listing to decide what to expect.
MAP=${CRATIS_LOCAL_MAP:-$(dirname "$SELF")/dependency-map.tsv}
map_require() {
    [ -f "$MAP" ] || die "dependency map not found: $MAP"
    awk -F'\t' '
        /^#/ || NF == 0 { next }
        $2 == "" { bad = 1 }
        $1 == "pack" && (NF == 4 || NF == 5) && ($3 == "nuget" || $3 == "npm") && $4 != "" && $2 != "" { next }
        $1 == "ids" && NF == 4 && ($3 == "nuget" || $3 == "npm") && $4 != "" && $2 != "" { next }
        $1 == "uses" && NF == 5 && ($4 == "nuget" || $4 == "npm" || $4 == "image") && $3 != "" && $5 != "" && $2 != "" { next }
        $1 == "image" && NF == 4 && $2 != "" { next }
        { printf "%s:%d: malformed dependency map row: %s\n", FILENAME, NR, $0 > "/dev/stderr"; bad = 1 }
        END { exit bad ? 1 : 0 }' "$MAP" || exit 2
}
map_rows() { awk -F'\t' -v kind="$1" '/^#/ || NF == 0 { next } $1 == kind' "$MAP"; }
map_known() { awk -F'\t' -v n="$1" '/^#/ || NF == 0 { next } $2 == n || ($1 == "uses" && $3 == n) { found = 1 } END { exit !found }' "$MAP"; }
# Edge rows "eco<TAB>manifest" for consumer $1 using producer $2.
map_edge() { map_rows uses | awk -F'\t' -v c="$1" -v p="$2" '$2 == c && $3 == p { print $4 "\t" $5 }'; }
# Expected package IDs of producer $1 in ecosystem $2, one per line; return 1 when the map has no ids row.
map_ids() {
    local rows
    rows=$(map_rows ids | awk -F'\t' -v r="$1" -v e="$2" '$2 == r && $3 == e { n = split($4, a, ","); for (i = 1; i <= n; i++) if (a[i] != "") print a[i] }')
    [ -n "$rows" ] || return 1
    printf '%s\n' "$rows"
}
# Pack rows of producer $1 in ecosystem $2 as "target<TAB>PROP=VAL,..." (properties may be empty).
map_pack_rows() { map_rows pack | awk -F'\t' -v r="$1" -v e="$2" '$2 == r && $3 == e { print $4 "\t" $5 }'; }
# True when the manifest rows of uses edge "$1 uses $2" include ecosystem $3.
map_uses() { map_edge "$1" "$2" | awk -F'\t' -v e="$3" '$1 == e { found = 1 } END { exit !found }'; }

# plan_derive OUTFILE CONSUMER PRODUCER...: the one plan every other command works from. Producers are in
# dependency order. Rows (TSV) are written to OUTFILE only when the whole plan is valid; any problem is die (exit 2).
# Call it directly, never inside $(...) or a pipeline, so the exit cannot be lost in a subshell.
#   pack <producer> <eco>            eco nuget|npm: a named downstream repository uses it in that ecosystem
#   overlay <producer> <upstream>    producer consumes an earlier-named upstream through NuGet
#   consume <producer> <eco> <path>  the consumer's own edge (eco nuget|npm|image) and its manifest
plan_derive() {
    local out=$1 consumer=$2 i j eco name edge manifests
    shift 2
    [ $# -ge 1 ] || die 'a plan needs a consumer and at least one producer'
    local names=("$consumer" "$@")
    map_require
    for ((i=0; i<${#names[@]}; i++)); do
        map_known "${names[$i]}" || die "repository not in the dependency map: ${names[$i]}"
        for ((j=i+1; j<${#names[@]}; j++)); do
            [ "${names[$i]}" != "${names[$j]}" ] || die "repository named twice (a consumer cannot also be a producer): ${names[$i]}"
        done
    done
    for ((i=1; i<${#names[@]}; i++)); do
        for ((j=i+1; j<${#names[@]}; j++)); do
            [ -z "$(map_edge "${names[$i]}" "${names[$j]}")" ] || die "order: ${names[$i]} uses ${names[$j]}; list ${names[$j]} first"
        done
    done
    : > "$out"
    for ((i=1; i<${#names[@]}; i++)); do
        name=${names[$i]}
        edge=0
        for eco in nuget npm image; do
            for ((j=0; j<${#names[@]}; j++)); do
                [ "$j" -eq 0 ] || [ "$j" -gt "$i" ] || continue
                if map_uses "${names[$j]}" "$name" "$eco"; then
                    edge=1
                    if [ "$eco" != image ]; then plan_add_pack "$out" "$name" "$eco"; fi
                    break
                fi
            done
        done
        [ "$edge" -eq 1 ] || die "no edge: nothing named after $name uses it (check the order and the map)"
    done
    for ((i=2; i<${#names[@]}; i++)); do
        for ((j=1; j<i; j++)); do
            if map_uses "${names[$i]}" "${names[$j]}" nuget; then printf 'overlay\t%s\t%s\n' "${names[$i]}" "${names[$j]}" >> "$out"; fi
        done
    done
    for ((i=1; i<${#names[@]}; i++)); do
        map_edge "$consumer" "${names[$i]}" | awk -F'\t' -v p="${names[$i]}" '{ print "consume\t" p "\t" $1 "\t" $2 }' >> "$out"
    done
    manifests=$(awk -F'\t' '$1 == "consume" && $3 == "npm" { print $4 }' "$out" | sort -u | wc -l | tr -d ' ')
    [ "$manifests" -le 1 ] || die "$consumer uses npm producers from different directories; only one npm overlay per session is supported"
    plan_warn_unnamed_hops "${names[@]}"
}
# Append "pack <producer> <eco>" after checking the map can verify it (an ids row) and build it (a pack row).
plan_add_pack() {
    map_ids "$2" "$3" > /dev/null || die "no ids row for $2 ($3): cannot verify the planned pack"
    [ -n "$(map_pack_rows "$2" "$3")" ] || die "no pack row for $2 ($3) in the map"
    printf 'pack\t%s\t%s\n' "$2" "$3" >> "$1"
}
# A producer that reaches the consumer through a repository that is not named keeps the released copy of it.
plan_warn_unnamed_hops() {
    local consumer=$1 kind x p eco manifest named
    shift
    named=$(printf '%s\n' "$@")
    map_rows uses | while IFS=$'\t' read -r kind x p eco manifest; do
        [ "$kind" = uses ] && [ "$eco" != '' ] || continue
        printf '%s\n' "$named" | grep -Fxq "$x" && continue
        printf '%s\n' "$named" | grep -Fxq "$p" || continue
        [ "$p" != "$consumer" ] || continue
        [ -n "$(map_edge "$consumer" "$x")" ] || continue
        printf 'WARNING: %s -> %s -> %s: %s is not named, so the released %s is kept; name it to rebuild it (a binary break is a finding)\n' "$p" "$x" "$consumer" "$x" "$x" >&2
    done
}

# plan [--map FILE] CONSUMER PRODUCER...: print the plan rows (read-only).
plan_command() {
    local args=()
    while [ $# -gt 0 ]; do
        case "$1" in
            --map) [ $# -ge 2 ] || die '--map requires a file'; MAP=$2; shift 2 ;;
            --*) die "unknown plan option: $1" ;;
            *) args+=("$1"); shift ;;
        esac
    done
    [ ${#args[@]} -ge 2 ] || die 'plan requires CONSUMER and at least one PRODUCER (repository names from the map)'
    scratch
    plan_derive "$TMP/plan" "${args[@]}"
    cat "$TMP/plan"
}

# ---- Verification primitives. Each one reads only what it is passed and writes only to the paths it is given. ----
# One private scratch directory per command; stateless: nothing survives between two verify invocations.
SCR=''
fn_scratch() { scratch; SCR=$(mktemp -d "$TMP/fn.XXXXXX") || die 'cannot create a scratch directory'; }

# One line per planned artifact: "id<TAB>eco<TAB>producer". Derived from the plan rows and the map's ids rows only.
expected_artifacts() {
    local plan=$1 out=$2 kind p eco id
    : > "$out"
    while IFS=$'\t' read -r kind p eco; do
        [ "$kind" = pack ] || continue
        while IFS= read -r id; do printf '%s\t%s\t%s\n' "$id" "$eco" "$p" >> "$out"; done < <(map_ids "$p" "$eco")
    done < "$plan"
}

# The exact feed file of one artifact. Never a glob and never another stamp.
feed_path() {
    case "$2" in
        nuget) printf '%s/nuget/%s.%s.nupkg\n' "$FEED" "$3" "$1" ;;
        npm) printf '%s/npm/%s-%s.tgz\n' "$FEED" "${3//\//-}" "$1" ;;
    esac
}

# Split EXPECTED into PRESENT_OUT (same rows) and FINDINGS_OUT ("missing: ID STAMP (producer eco)").
feed_check() {
    local stamp=$1 expected=$2 present=$3 findings=$4 id eco p
    : > "$present"; : > "$findings"
    while IFS=$'\t' read -r id eco p; do
        if [ -f "$(feed_path "$stamp" "$eco" "$id")" ]; then printf '%s\t%s\t%s\n' "$id" "$eco" "$p" >> "$present"
        else printf 'missing: %s %s (%s %s)\n' "$id" "$stamp" "$p" "$eco" >> "$findings"; fi
    done < "$expected"
}

# A dependency range names the stamp only when its lower bound is exactly the stamp:
# STAMP, [STAMP], [STAMP, ) pass; [1.0.0, STAMP) and 1.0.0 do not (a substring test would accept the first).
dep_matches() {
    local bound=$2
    bound=${bound%%,*}; bound=${bound#\[}; bound=${bound#\(}; bound=${bound%\]}; bound=${bound%\)}
    bound=${bound//[[:space:]]/}
    [ "$bound" = "$1" ]
}

# Every nuspec dependency of a present planned .nupkg whose ID is in DEPSET must point at the stamp.
# Appends to FINDINGS_OUT and sets NUSPEC_EDGES to the number of dependency edges checked.
NUSPEC_EDGES=0
nuspec_findings() {
    local stamp=$1 depset=$2 present=$3 findings=$4 id eco p dep range nuspec
    NUSPEC_EDGES=0
    nuspec=$findings.nuspec
    while IFS=$'\t' read -r id eco p; do
        [ "$eco" = nuget ] || continue
        if ! unzip -p "$(feed_path "$stamp" nuget "$id")" '*.nuspec' > "$nuspec" 2>/dev/null; then
            printf 'unreadable nuspec: %s\n' "$id" >> "$findings"; continue
        fi
        while IFS=$'\t' read -r dep range; do
            grep -Fxiq -- "$dep" "$depset" || continue
            NUSPEC_EDGES=$((NUSPEC_EDGES + 1))
            dep_matches "$stamp" "$range" || printf 'dependency: %s -> %s %s (expected %s)\n' "$id" "$dep" "$range" "$stamp" >> "$findings"
        done < <(grep -o '<dependency [^>]*>' "$nuspec" | sed -n 's/.*id="\([^"]*\)".*version="\([^"]*\)".*/\1\t\2/p')
    done < "$present"
    rm -f -- "$nuspec"
}

# "id<TAB>version<TAB>assets file" for every package in IDSFILE that the consumer's restore resolved.
# Library keys are "Id/Version"; project references are not packages. Exit 2 without an assets file.
nuget_resolutions() {
    local consumer=$1 idsfile=$2 out=$3 path files=()
    while IFS= read -r -d '' path; do files+=("$path"); done < <(find "$consumer" -name node_modules -prune -o -path '*/obj/project.assets.json' -type f -print0)
    [ ${#files[@]} -gt 0 ] || { printf 'ERROR: no obj/project.assets.json under %s (restore the consumer first)\n' "$consumer" >&2; return 2; }
    awk -F'\t' '
        NR == FNR { ids[tolower($0)] = 1; next }
        FNR == 1 { inlib = 0; pending = 0 }
        /^  "libraries": *\{/ { inlib = 1; next }
        inlib && /^  "[^"]+":/ { inlib = 0 }
        inlib && /^    "[^"]+\/[^"]+": *\{/ {
            key = $0; sub(/^    "/, "", key); sub(/": *\{.*$/, "", key)
            cut = index(key, "/"); pid = substr(key, 1, cut - 1); pver = substr(key, cut + 1); pending = 1; next
        }
        inlib && pending && /"type":/ {
            pending = 0
            if ($0 !~ /"project"/ && (tolower(pid) in ids)) print pid "\t" pver "\t" FILENAME
        }
    ' "$idsfile" "${files[@]}" > "$out" || { printf 'ERROR: cannot scan the consumer assets\n' >&2; return 2; }
}

# "name<TAB>version<TAB>package.json" for every installed copy of a package in IDSFILE under NM.
npm_installed() {
    local nm=$1 idsfile=$2 out=$3 name file version
    [ -d "$nm" ] || { printf 'ERROR: no node_modules: %s (run yarn install first)\n' "$nm" >&2; return 2; }
    : > "$out"
    while IFS= read -r name; do
        while IFS= read -r -d '' file; do
            version=$(grep -o '"version": *"[^"]*"' "$file" | head -n 1 | sed 's/.*: *"\(.*\)"/\1/' || true)
            printf '%s\t%s\t%s\n' "$name" "$version" "$file" >> "$out"
        done < <(find "$nm" -path "*/node_modules/$name/package.json" -type f -print0)
    done < "$idsfile"
}

# Every producer the consumer uses in ECO must have at least one of its planned IDs resolved.
# A consumer may use only part of a producer, so one ID is enough.
consumption_findings() {
    local plan=$1 eco=$2 resolved=$3 findings=$4 kind p e manifest ids
    while IFS=$'\t' read -r kind p e manifest; do
        [ "$kind" = consume ] && [ "$e" = "$eco" ] || continue
        ids=$(map_ids "$p" "$eco") || ids=''
        if ! awk -F'\t' 'NR == FNR { want[tolower($0)] = 1; next } tolower($1) in want { found = 1 } END { exit !found }' <(printf '%s\n' "$ids") "$resolved"; then
            printf 'unconsumed: %s (%s): none of %s resolved in the consumer\n' "$p" "$eco" "$(printf '%s' "$ids" | tr '\n' ',' | sed 's/,$//; s/,/, /g')" >> "$findings"
        fi
    done < "$plan"
}

# One JSON line from tab-separated "id<TAB>version" rows in $2, for machine consumers (pi-train).
json_report() {
    awk -F'\t' -v stamp="$1" 'BEGIN { printf "{\"stamp\":\"%s\",\"packages\":[", stamp }
        { printf "%s{\"id\":\"%s\",\"version\":\"%s\"}", (NR > 1 ? "," : ""), $1, $2 }
        END { print "]}" }' "$2"
}

# Print findings to stdout, or stderr when stdout carries JSON, then fail. Returns only when there are none.
report_findings() {
    local command=$1 findings=$2 out=$3 count
    count=$(wc -l < "$findings" | tr -d ' ')
    [ "$count" -eq 0 ] && return 0
    cat "$findings" >&"$out"
    failed "$command: $count findings"
}

# verify-pack STAMP (--consumer C --producer P... | NAME... [--ecosystem E]) [--json] [--map FILE]
# Plan mode checks exactly the plan the closure printed. Name mode (manual, weaker) builds the plan rows from
# the named repositories' ids rows instead of from edges.
verify_pack() {
    [ $# -ge 2 ] || die 'verify-pack requires STAMP and either --consumer C --producer P... or repository NAMEs'
    local stamp=$1 json=0 out=1 ecosystem='' consumer='' name eco d found
    local producers=() names=()
    shift
    while [ $# -gt 0 ]; do
        case "$1" in
            --json) json=1; out=2; shift ;;
            --map) [ $# -ge 2 ] || die '--map requires a file'; MAP=$2; shift 2 ;;
            --consumer) [ $# -ge 2 ] || die '--consumer requires a repository name'; consumer=$2; shift 2 ;;
            --producer) [ $# -ge 2 ] || die '--producer requires a repository name'; producers+=("$2"); shift 2 ;;
            --ecosystem) [ $# -ge 2 ] || die '--ecosystem requires nuget or npm'; ecosystem=$2; shift 2
                case "$ecosystem" in nuget|npm) ;; *) die 'invalid ecosystem' ;; esac ;;
            --*) die "unknown verify-pack option: $1" ;;
            *) names+=("$1"); shift ;;
        esac
    done
    valid_stamp "$stamp"; fn_scratch; d=$SCR
    if [ -n "$consumer" ] || [ ${#producers[@]} -gt 0 ]; then
        [ -n "$consumer" ] && [ ${#producers[@]} -gt 0 ] || die 'verify-pack plan mode needs both --consumer and --producer'
        [ ${#names[@]} -eq 0 ] && [ -z "$ecosystem" ] || die 'verify-pack takes either --consumer/--producer or repository names, not both'
        plan_derive "$d/plan" "$consumer" "${producers[@]}"
    else
        [ ${#names[@]} -ge 1 ] || die 'verify-pack requires --consumer/--producer or at least one repository name from the map'
        map_require
        : > "$d/plan"
        for name in "${names[@]}"; do
            map_known "$name" || die "repository not in the dependency map: $name"
            found=0
            for eco in nuget npm; do
                [ -z "$ecosystem" ] || [ "$eco" = "$ecosystem" ] || continue
                if map_ids "$name" "$eco" > /dev/null; then printf 'pack\t%s\t%s\n' "$name" "$eco" >> "$d/plan"; found=1; fi
            done
            [ "$found" -eq 1 ] || die "no ids row for $name (${ecosystem:-all ecosystems}) in the map"
        done
    fi
    grep -q '^pack' "$d/plan" || die 'the plan has no pack rows (image-only edges): nothing to verify'
    expected_artifacts "$d/plan" "$d/expected"
    awk -F'\t' '$2 == "nuget" { print $1 }' "$d/expected" > "$d/depset"
    [ ! -s "$d/depset" ] || need unzip
    feed_check "$stamp" "$d/expected" "$d/present" "$d/findings"
    nuspec_findings "$stamp" "$d/depset" "$d/present" "$d/findings"
    report_findings verify-pack "$d/findings" "$out"
    if [ "$json" -eq 1 ]; then
        awk -F'\t' -v s="$stamp" '{ print $1 "\t" s }' "$d/present" > "$d/json"
        json_report "$stamp" "$d/json"
        return 0
    fi
    printf 'verify-pack: %s planned artifacts present at %s (%s dependency edges checked)\n' "$(wc -l < "$d/present" | tr -d ' ')" "$stamp" "$NUSPEC_EDGES"
}

# verify-assets CONSUMER-PATH STAMP [--npm] [--dir REL] [--json] [--consumer C --producer P...] [--map FILE]
# Plan mode scans for exactly the planned IDs of one ecosystem; feed-wide mode (no --consumer) scans every
# package at the stamp in the feed, which is manual and weaker.
verify_assets() {
    [ $# -ge 2 ] || die 'verify-assets requires CONSUMER-PATH, STAMP, [--npm] [--dir REL]'
    local path=$1 stamp=$2 npm=0 dir='' json=0 out=1 consumer='' eco=nuget d name file matched nm unit
    local producers=()
    shift 2
    while [ $# -gt 0 ]; do
        case "$1" in
            --npm) npm=1; eco=npm; shift ;;
            --json) json=1; out=2; shift ;;
            --dir) [ $# -ge 2 ] || die '--dir requires a relative directory'; dir=${2%/}; shift 2 ;;
            --map) [ $# -ge 2 ] || die '--map requires a file'; MAP=$2; shift 2 ;;
            --consumer) [ $# -ge 2 ] || die '--consumer requires a repository name'; consumer=$2; shift 2 ;;
            --producer) [ $# -ge 2 ] || die '--producer requires a repository name'; producers+=("$2"); shift 2 ;;
            *) die "unknown verify-assets option: $1" ;;
        esac
    done
    valid_stamp "$stamp"; [ -d "$path" ] || die "not a directory: $path"
    case "$dir" in /*|..|../*|*/..|*/../*) die "--dir must be a relative path inside the consumer: $dir" ;; esac
    if [ -n "$consumer" ] || [ ${#producers[@]} -gt 0 ]; then
        [ -n "$consumer" ] && [ ${#producers[@]} -gt 0 ] || die 'verify-assets needs --consumer and --producer together'
    fi
    fn_scratch; d=$SCR
    : > "$d/findings"
    if [ -n "$consumer" ]; then
        plan_derive "$d/plan" "$consumer" "${producers[@]}"
        awk -F'\t' -v e="$eco" '$1 == "consume" && $3 == e { found = 1 } END { exit !found }' "$d/plan" || die "$consumer has no $eco edge to the named producers"
        expected_artifacts "$d/plan" "$d/all-expected"
        awk -F'\t' -v e="$eco" '$2 == e' "$d/all-expected" > "$d/expected"
        feed_check "$stamp" "$d/expected" "$d/present" "$d/findings"
        cut -f1 "$d/expected" | sort -u > "$d/ids"
    else
        : > "$d/ids"
        if [ "$npm" -eq 1 ]; then
            for file in "$FEED/npm/"*"-$stamp.tgz"; do
                [ -f "$file" ] || continue
                name=$(tar -xOf "$file" package/package.json | grep -o '"name": *"[^"]*"' | head -n 1 | sed 's/.*: *"\(.*\)"/\1/')
                [ -n "$name" ] || die "cannot read the package name: $file"
                printf '%s\n' "$name" >> "$d/ids"
            done
        else
            for file in "$FEED/nuget/"*".$stamp.nupkg"; do
                [ -f "$file" ] || continue
                name=${file##*/}; printf '%s\n' "${name%."$stamp".nupkg}" >> "$d/ids"
            done
            [ -s "$d/ids" ] || die "no packages at $stamp in the feed"
        fi
    fi
    if [ "$npm" -eq 1 ]; then
        nm=$path${dir:+/$dir}/node_modules
        npm_installed "$nm" "$d/ids" "$d/resolved" || return $?
    else
        nuget_resolutions "$path" "$d/ids" "$d/resolved" || return $?
    fi
    matched=$(wc -l < "$d/resolved" | tr -d ' ')
    awk -F'\t' -v s="$stamp" '$2 != s { print $1 " " $2 " " $3 }' "$d/resolved" >> "$d/findings"
    if [ -n "$consumer" ]; then
        consumption_findings "$d/plan" "$eco" "$d/resolved" "$d/findings"
    elif [ "$matched" -eq 0 ]; then
        failed "verify-assets: no stamped $eco package is resolved in the consumer"
    fi
    report_findings verify-assets "$d/findings" "$out"
    if [ "$json" -eq 1 ]; then
        awk -F'\t' '{ print $1 "\t" $2 }' "$d/resolved" | sort -u > "$d/json"
        json_report "$stamp" "$d/json"
        return 0
    fi
    unit=resolutions
    if [ "$npm" -eq 1 ]; then unit='installed copies'; fi
    printf 'verify-assets: %s %s, all at %s\n' "$matched" "$unit" "$stamp"
}

use_npm() {
    [ $# -eq 2 ] || { [ $# -eq 4 ] && [ "$3" = --dir ]; } || die 'use-npm requires consumer, stamp and optional --dir REL'
    local repo version session backup rel='' dir
    repo=$(repo_root "$1"); version=$2
    if [ $# -eq 4 ]; then rel=${4%/}; fi
    case "$rel" in /*|..|../*|*/..|*/../*) die "--dir must be a relative path inside the consumer: $rel" ;; esac
    dir=$repo${rel:+/$rel}
    valid_stamp "$version"; need node; need tar; scratch
    session=$(session_path "$repo"); backup=$session/npm-backup
    [ -f "$dir/package.json" ] || die "consumer has no package.json in ${rel:-the root}; use --dir REL for a Yarn project in a subdirectory"
    [ ! -e "$backup" ] || die "active npm backup exists: $backup; restore first"
    node - "$dir" "$FEED/npm" "$version" "$TMP/package.json" <<'NODE'
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
const [repo, feed, stamp, output] = process.argv.slice(2);
const root = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
let count = 0;
for (const file of fs.existsSync(feed) ? fs.readdirSync(feed) : []) {
    if (!file.endsWith('-' + stamp + '.tgz')) continue;
    const tarball = path.join(feed, file);
    // Read the packed name: slugified scoped names are not reversibly encoded.
    const {name} = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], {encoding: 'utf8'}));
    if (typeof name !== 'string' || !/^(@[^/\s]+\/)?[^/\s]+$/.test(name))
        throw new Error('Invalid packed package name: ' + tarball);
    root.resolutions = root.resolutions || {};
    root.resolutions[name] = 'file:' + tarball;
    count++;
}
if (!count) { console.error('ERROR: no matching npm tarballs'); process.exit(2); }
fs.writeFileSync(output, JSON.stringify(root, null, 2) + '\n');
console.log(`overrode ${count} npm packages`);
NODE
    if [ "$DRY" -eq 1 ]; then
        quote_command mkdir -p "$backup"
        quote_command cp "$TMP/package.json" "$dir/package.json"
        return 0
    fi
    register_session "$repo" "$session" "$version"
    mkdir "$backup"
    if [ -n "$rel" ]; then printf '%s\n' "$rel" > "$session/npm-dir"; fi
    cp -p "$dir/package.json" "$backup/package.json"
    if [ -f "$dir/yarn.lock" ]; then cp -p "$dir/yarn.lock" "$backup/yarn.lock"; fi
    git -C "$dir" diff HEAD -- package.json yarn.lock > "$backup/before.diff"
    cp "$TMP/package.json" "$backup/expected-package.json"
    cp "$TMP/package.json" "$dir/package.json"
    printf 'Next: cd %q && yarn install\n' "$dir"
    printf 'Vite: clear stale prebundles with rm -rf node_modules/.vite\n'
}

restore() {
    [ $# -eq 1 ] || die 'restore requires a consumer'
    local repo session backup dir
    repo=$(repo_root "$1"); session=$(session_path "$repo"); backup=$session/npm-backup
    validate_session "$session"
    dir=$repo
    if [ -f "$session/npm-dir" ]; then dir=$repo/$(cat "$session/npm-dir"); fi
    if [ -f "$session/repo" ] && [ "$(cat "$session/repo")" != "$repo" ]; then die 'session belongs to another checkout'; fi
    if [ -d "$backup" ]; then
        if ! cmp -s "$dir/package.json" "$backup/expected-package.json" ||
            { [ -f "$backup/yarn.lock" ] && ! cmp -s "$dir/yarn.lock" "$backup/yarn.lock"; } ||
            { [ ! -f "$backup/yarn.lock" ] && [ -e "$dir/yarn.lock" ]; }; then
            need node
            node "$(dirname "$SELF")/npm-restore-check.cjs" "$dir" "$backup" ||
                die "npm files changed beyond the overlay; review $backup (nothing restored)"
        fi
        mutate cp -p "$backup/package.json" "$dir/package.json"
        if [ -f "$backup/yarn.lock" ]; then mutate cp -p "$backup/yarn.lock" "$dir/yarn.lock"; else mutate rm -f -- "$dir/yarn.lock"; fi
        mutate rm -rf -- "$backup"
    fi
    mutate rm -f -- "$session/Directory.Packages.props" "$session/nuget.config" "$session/env" "$session/stamp" "$session/npm-dir"
    if [ "$DRY" -eq 0 ]; then check "$repo"; fi
}

# Check only changed lines, not unchanged context or removed local overrides.
# NUL-delimited Git paths preserve spaces; diagnostics are relative to the root.
check() {
    [ $# -ge 1 ] && [ $# -le 2 ] || die 'check requires repo and optional --staged'
    local repo path count=0 hits=0 staged=0
    repo=$(repo_root "$1"); shift
    if [ $# -gt 0 ]; then [ "$1" = --staged ] || die "unknown check option: $1"; staged=1; fi
    scratch
    if [ "$staged" -eq 1 ]; then
        git -C "$repo" diff --cached --name-only -z --diff-filter=ACMRT > "$TMP/tracked"
    else
        git -C "$repo" diff HEAD --name-only -z --diff-filter=ACMRT > "$TMP/tracked"
    fi
    git -C "$repo" ls-files --others --exclude-standard -z > "$TMP/untracked"
    while IFS= read -r -d '' path; do
        count=$((count + 1))
        if [ "$staged" -eq 1 ]; then
            git -C "$repo" diff --cached --no-ext-diff --no-textconv --unified=0 -- "$path" > "$TMP/diff"
        else
            git -C "$repo" diff HEAD --no-ext-diff --no-textconv --unified=0 -- "$path" > "$TMP/diff"
        fi
        awk '/^@@ / { split($3,a,","); n=substr(a[1],2); next } /^\+\+\+/ { next } /^\+/ { print n ":" substr($0,2); n++; next } /^ / { n++ }' "$TMP/diff" > "$TMP/lines"
        scan_lines "$path" "$TMP/lines" > "$TMP/hits"
        if [ -s "$TMP/hits" ]; then cat "$TMP/hits"; hits=$((hits + 1)); fi
    done < "$TMP/tracked"
    while IFS= read -r -d '' path; do
        [ ! -L "$repo/$path" ] || die "cannot scan untracked symlink without following outside repo: $path"
        [ -f "$repo/$path" ] || continue
        count=$((count + 1))
        awk '{print NR ":" $0}' "$repo/$path" > "$TMP/lines"
        scan_lines "$path" "$TMP/lines" > "$TMP/hits"
        if [ -s "$TMP/hits" ]; then cat "$TMP/hits"; hits=$((hits + 1)); fi
    done < "$TMP/untracked"
    printf 'checked %s files, %s leaks\n' "$count" "$hits"
    [ "$hits" -eq 0 ]
}
scan_lines() {
    local path=$1 input=$2
    awk -v path="$path" -v feed="$FEED" '
        function hit(pattern) { print path ":" number ":" pattern }
        {
            number=$0; sub(/:.*/,"",number); line=$0; sub(/^[^:]*:/,"",line)
            if (line ~ /-local\.[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]\.g[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]/) hit("local stamp")
            if (line ~ /-train\.g[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]/) hit("train stamp")
            if (index(line,feed)) hit("local feed path")
            if (index(line,"DirectoryPackages" "PropsPath")) hit("CPM overlay property")
            if (index(line,"RestoreAdditional" "ProjectSources")) hit("additional restore sources")
            if (line ~ /<PackageVersion[[:space:]]+Update[[:space:]]*=/) hit("package version override")
            if (path ~ /(^|\/)(package.json|yarn.lock)$/ && line ~ /(file|portal|link):/ &&
                (line ~ /\.tgz/ || line ~ /(file|portal|link):(\/|\.\.?\/|~\/|[A-Za-z]:)/)) hit("local npm reference")
        }
    ' "$input"
}

# Portable deadline for a read-only Docker probe; no dependency on GNU timeout.
bounded_docker() {
    local pid second status=0
    docker "$@" > "$TMP/docker-output" 2> "$TMP/docker-error" & pid=$!
    for ((second=0; second<10; second++)); do
        if ! kill -0 "$pid" 2>/dev/null; then break; fi
        sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
        kill -TERM "$pid" 2>/dev/null || :
        kill -KILL "$pid" 2>/dev/null || :
        wait "$pid" 2>/dev/null || :
        return 1
    fi
    wait "$pid" || status=$?
    return "$status"
}
local_artifact() {
    [[ "$1" =~ -(local\.[0-9]{12}|train)\.g[0-9a-f]{7}($|[^0-9A-Za-z]) ]]
}
clean() {
    local version='' apply=0 consumer='' arg path cache image session maximum count=0 rel=''
    local subjects=() kinds=()
    while [ $# -gt 0 ]; do
        arg=$1; shift
        case "$arg" in
            --stamp) [ $# -gt 0 ] || die '--stamp requires a stamp'; [ -z "$version" ] || die 'choose --stamp or --all'; version=$1; shift; valid_stamp "$version" ;;
            --all) [ -z "$version" ] || die 'choose --stamp or --all'; version=all ;;
            --apply) apply=1 ;;
            --dir) [ $# -gt 0 ] || die '--dir requires a relative directory'; rel=${1%/}; shift ;;
            -*) die "unknown clean option: $arg" ;;
            *) [ -z "$consumer" ] || die 'clean takes at most one consumer'; consumer=$(repo_root "$arg") ;;
        esac
    done
    maximum=${CRATIS_LOCAL_CLEAN_MAX:-500}
    [[ "$maximum" =~ ^[0-9]+$ ]] || die 'CRATIS_LOCAL_CLEAN_MAX must be a whole number'
    [ ${#maximum} -le 6 ] || die 'CRATIS_LOCAL_CLEAN_MAX is too large'
    maximum=$((10#$maximum))
    scratch
    for cache in "$FEED/nuget" "$FEED/npm"; do
        [ -d "$cache" ] || continue
        while IFS= read -r -d '' path; do
            local_artifact "${path##*/}" || continue
            if [ -n "$version" ] && [ "$version" != all ]; then case "$path" in *"$version"*) ;; *) continue ;; esac; fi
            subjects+=("$path"); kinds+=(file)
        done < <(find "$cache" -type f \( -name '*.nupkg' -o -name '*.snupkg' -o -name '*.tgz' \) -print0)
    done
    if [ -d "$NUGET_CACHE" ]; then
        for cache in "$NUGET_CACHE"/*; do
            [ -d "$cache" ] && [ ! -L "$cache" ] || continue
            for path in "$cache"/*-local.* "$cache"/*-train.*; do
                [ -d "$path" ] && [ ! -L "$path" ] || continue
                local_artifact "${path##*/}" || continue
                if [ -n "$version" ] && [ "$version" != all ] && [ "${path##*/}" != "$version" ]; then continue; fi
                subjects+=("$path"); kinds+=(directory)
            done
        done
    fi
    if [ -n "$consumer" ] && [ ! -f "$consumer${rel:+/$rel}/package.json" ]; then
        printf 'SKIP: no package.json in %s; pass --dir REL for a Yarn project in a subdirectory\n' "$consumer${rel:+/$rel}" >&2
    elif command -v yarn >/dev/null 2>&1 && [ -n "$consumer" ]; then
        cache=$(cd "$consumer${rel:+/$rel}" && yarn config get cacheFolder) || die 'cannot discover Yarn cache'
        if [ -d "$cache" ]; then
            while IFS= read -r -d '' path; do
                local_artifact "${path##*/}" || continue
                if [ -n "$version" ] && [ "$version" != all ]; then case "$path" in *"$version"*) ;; *) continue ;; esac; fi
                subjects+=("$path"); kinds+=(file)
            done < <(find "$cache" -type f \( -name '*-local.*' -o -name '*-train.*' \) -print0)
        fi
    else
        printf 'SKIP: Yarn cache discovery needs yarn and an explicit consumer\n' >&2
    fi
    if command -v docker >/dev/null 2>&1; then
        if bounded_docker image ls --format '{{.Repository}}:{{.Tag}}'; then
            while IFS= read -r image; do
                local_artifact "${image##*:}" || continue
                if [ -n "$version" ] && [ "$version" != all ]; then case "${image##*:}" in *"$version"*) ;; *) continue ;; esac; fi
                subjects+=("$image"); kinds+=(image)
            done < "$TMP/docker-output"
        else
            printf 'SKIP: Docker unavailable or did not respond within 10 seconds\n' >&2
        fi
    else printf 'SKIP: docker is not on PATH\n' >&2; fi
    if [ -f "$FEED/sessions" ]; then cat "$FEED/sessions" > "$TMP/sessions"; else : > "$TMP/sessions"; fi
    if [ -n "$consumer" ]; then session_path "$consumer" >> "$TMP/sessions"; fi
    sort -u "$TMP/sessions" > "$TMP/unique-sessions"
    while IFS= read -r session; do
        [ -d "$session" ] && [ -f "$session/repo" ] && [ -f "$session/stamp" ] || continue
        local_artifact "$(cat "$session/stamp")" || continue
        if [ -n "$version" ] && [ "$version" != all ] && [ "$(cat "$session/stamp")" != "$version" ]; then continue; fi
        [ ! -L "$session" ] && [ "$session" != / ] || die "unsafe session: $session"
        validate_session "$session"
        path=$(cat "$session/repo")
        [ "$(session_path "$path")" = "$session" ] || die "session directory no longer matches repository: $session"
        [ ! -d "$session/npm-backup" ] || die "unresolved npm backup: $session; restore before cleaning"
        subjects+=("$session"); kinds+=(session)
    done < "$TMP/unique-sessions"
    count=${#subjects[@]}
    [ "$count" -le "$maximum" ] || die "clean fuse: $count subjects exceeds $maximum"
    for ((arg=0; arg<count; arg++)); do printf '%s: %s\n' "${kinds[$arg]}" "${subjects[$arg]}"; done
    if [ "$apply" -eq 1 ] && [ "$DRY" -eq 0 ]; then
        for ((arg=0; arg<count; arg++)); do
            path=${subjects[$arg]}
            case "${kinds[$arg]}" in
                image) docker rmi "$path" ;;
                file) [ -f "$path" ] && [ ! -L "$path" ] || die "clean subject changed: $path"; rm -- "$path" ;;
                directory) [ -d "$path" ] && [ ! -L "$path" ] || die "clean subject changed: $path"; rm -rf -- "$path" ;;
                session)
                    [ -f "$path/stamp" ] && [ ! -L "$path" ] && [ ! -e "$path/npm-backup" ] || die "session changed: $path"
                    validate_session "$path"
                    rm -f -- "$path/repo" "$path/stamp" "$path/env" "$path/npm-dir" "$path/Directory.Packages.props" "$path/nuget.config"
                    rmdir -- "$path" ;;
            esac
        done
        printf 'removed %s subjects\n' "$count"
    else printf 'dry-run: %s subjects (use --apply to remove)\n' "$count"; fi
}

# shellcheck disable=SC2016  # fixtures assert literal $STAMP in printed commands
self_test() {
    [ $# -eq 0 ] || die '--self-test takes no arguments'
    local root home repo feed version output status passed=0 skipped=0 test_key arg map
    scratch; root=$TMP/self-test; mkdir -p "$root/home" "$root/repo"
    map=$root/map.tsv; home=$root/home; repo=$root/repo; feed=$home/.cache/cratis/local-feed
    # System-only tests stay hermetic; npm tests inherit PATH to discover node.
    # Both isolate HOME/config and omit the host adapter.
    st() { env -i HOME="$home" PATH=/usr/bin:/bin:/usr/sbin:/sbin TMPDIR="$TMP" /bin/bash "$SELF" "$@"; }
    stm() { env -i HOME="$home" PATH=/usr/bin:/bin:/usr/sbin:/sbin TMPDIR="$TMP" CRATIS_LOCAL_MAP="$map" /bin/bash "$SELF" "$@"; }
    has() { grep -Fq -- "$1" "$2"; }
    st_npm() { env -i HOME="$home" PATH="$PATH" TMPDIR="$TMP" /bin/bash "$SELF" "$@"; }
    git -C "$repo" init -q
    repo=$(repo_root "$repo")
    git -C "$repo" config user.email test@example.invalid
    git -C "$repo" config user.name 'Local package self-test'
    printf '<Project><ItemGroup><PackageVersion Include="Cratis.Test" Version="1.2.3" /></ItemGroup></Project>\n' > "$repo/Directory.Packages.props"
    printf '{"private":true,"dependencies":{"@cratis/test":"1.2.3"}}\n' > "$repo/package.json"
    cat > "$repo/yarn.lock" <<'LOCK'
# This file is generated by running "yarn install" inside your project.

__metadata:
  version: 8
  cacheKey: 10c0

"@cratis/test@npm:1.2.3":
  version: 1.2.3
  resolution: "@cratis/test@npm:1.2.3"
  checksum: original
  languageName: node
  linkType: hard

"unrelated@npm:1.0.0":
  version: 1.0.0
  resolution: "unrelated@npm:1.0.0"
  checksum: keep
  languageName: node
  linkType: hard
LOCK
    printf 'clean\n' > "$repo/probe"
    git -C "$repo" add .; git -C "$repo" commit -qm initial; git -C "$repo" tag v1.2.3
    status=0; st > "$root/output" || status=$?
    if [ "$status" -ne 2 ] || ! grep -q '^Usage:' "$root/output"; then
        failed 'self-test: no arguments must show usage and exit 2'
    fi
    passed=$((passed + 1))
    version=$(st stamp "$repo")
    [[ "$version" =~ ^1\.2\.4-local\.[0-9]{12}\.g[0-9a-f]{7}$ ]] || failed 'self-test: stamp format'
    passed=$((passed + 1))
    mkdir -p "$feed/nuget" "$feed/npm"
    : > "$feed/nuget/Cratis.Test.1.2.4-local.200001010000.g1234567.nupkg"
    st --dry-run use-nuget "$repo" 1.2.4-local.200001010000.g1234567 Cratis.Test > "$root/output"
    status=0; st --dry-run use-nuget "$repo" 1.2.4-local.200001010000.1234567 Cratis.Test > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 2 ] || failed 'self-test: unprefixed numeric SHA accepted'
    rm "$feed/nuget/Cratis.Test.1.2.4-local.200001010000.g1234567.nupkg"
    passed=$((passed + 2))
    : > "$feed/nuget/Cratis.Test.$version.nupkg"
    : > "$feed/nuget/Cratis.Transitive.$version.nupkg"
    mkdir -p "$root/tarball/package"
    for arg in test transitive; do
        printf '{"name":"@cratis/%s","version":"%s"}\n' "$arg" "$version" > "$root/tarball/package/package.json"
        tar -czf "$feed/npm/@cratis-$arg-$version.tgz" -C "$root/tarball" package
    done
    st use-nuget "$repo" "$version" > "$root/output"
    output=$(git -C "$repo" rev-parse --absolute-git-dir)/cratis-local
    grep -Fq "Import Project=\"$repo/Directory.Packages.props\"" "$output/Directory.Packages.props" || failed 'self-test: overlay import'
    grep -Fq "PackageVersion Update=\"Cratis.Test\" Version=\"$version\"" "$output/Directory.Packages.props" || failed 'self-test: pinned package Update'
    grep -Fq "PackageVersion Include=\"Cratis.Transitive\" Version=\"$version\"" "$output/Directory.Packages.props" || failed 'self-test: transitive package Include'
    if grep -Fq 'CentralPackageTransitivePinningEnabled' "$output/Directory.Packages.props"; then failed 'self-test: transitive pinning must be opt-in'; fi
    st use-nuget "$repo" "$version" --pin-transitive > "$root/output"
    grep -Fq 'CentralPackageTransitivePinningEnabled>true' "$output/Directory.Packages.props" || failed 'self-test: --pin-transitive enables pinning'
    grep -Fq "PackageVersion Include=\"Cratis.Transitive\" Version=\"$version\"" "$output/Directory.Packages.props" || failed 'self-test: --pin-transitive keeps the IDs'
    st use-nuget "$repo" "$version" Cratis.Test --pin-transitive > "$root/output" || failed 'self-test: --pin-transitive with explicit IDs'
    st use-nuget "$repo" "$version" > "$root/output"
    passed=$((passed + 3))
    test_key=DirectoryPackages"PropsPath"
    grep -Fq "export $test_key=" "$output/env" || failed 'self-test: env property'
    passed=$((passed + 5))
    st check "$repo" > "$root/output" || failed 'self-test: clean repo'
    passed=$((passed + 1))
    for test_key in stamp npm props sources override feed; do
        case "$test_key" in
            stamp) printf '%s\n' "$version" > "$repo/probe" ;;
            npm) printf '{"resolutions":{"@cratis/test":"%s%s"}}\n' 'file:/tmp/' 'package.tgz' > "$repo/package.json" ;;
            props) printf '%s=/tmp/overlay\n' DirectoryPackages"PropsPath" > "$repo/probe" ;;
            sources) printf '%s=/tmp/feed\n' RestoreAdditional"ProjectSources" > "$repo/probe" ;;
            override) printf '<PackageVersion %s="Cratis.Test" />\n' Update > "$repo/probe" ;;
            feed) printf '%s\n' "$feed" > "$repo/probe" ;;
        esac
        status=0; st check "$repo" > "$root/output" || status=$?
        [ "$status" -eq 1 ] || failed "self-test: did not find $test_key leak"
        passed=$((passed + 1))
        git -C "$repo" checkout -- probe package.json
    done
    printf '%s\n' "$version" > "$repo/untracked"
    status=0; st check "$repo" > "$root/output" || status=$?
    [ "$status" -eq 1 ] || failed 'self-test: untracked leak'
    rm "$repo/untracked"; passed=$((passed + 1))
    printf '%s\n' "$version" > "$repo/probe"; git -C "$repo" add probe
    printf 'clean again\n' > "$repo/probe"
    status=0; st check "$repo" --staged > "$root/output" || status=$?
    [ "$status" -eq 1 ] || failed 'self-test: staged content'
    git -C "$repo" restore --staged probe; git -C "$repo" checkout -- probe
    passed=$((passed + 1))
    if command -v node >/dev/null 2>&1; then
        # Preserve pre-existing user edits as well as the committed contents.
        st_npm use-npm "$repo" "$version"
        grep -Fq '"@cratis/transitive": "file:' "$repo/package.json" || failed 'self-test: transitive npm resolution'
        grep -Fq '"@cratis/test": "file:' "$repo/package.json" || failed 'self-test: direct npm resolution'
        st_npm restore "$repo" > "$root/output"
        passed=$((passed + 2))
        printf '{"private":true,"dependencies":{"@cratis/test":"1.2.3"},"userSetting":true}\n' > "$repo/package.json"
        cp "$repo/package.json" "$root/original-package.json"
        cp "$repo/yarn.lock" "$root/original-yarn.lock"
        st_npm use-npm "$repo" "$version"
        # Model Yarn's replacement of a remote entry with a file-tarball entry.
        node - "$repo/yarn.lock" "$feed/npm/@cratis-test-$version.tgz" "$version" <<'NODE'
const fs = require('fs');
const [file, input, stamp] = process.argv.slice(2);
const tarball = require('path').normalize(input);
const lock = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, lock.replace(/"@cratis\/test@npm:1\.2\.3":[\s\S]*?(?="unrelated)/,
    `"@cratis/test@file:${tarball}::locator=consumer%40workspace%3A.":\n` +
    `  version: ${stamp}\n  resolution: "@cratis/test@file:${tarball}::hash=abc&locator=consumer%40workspace%3A."\n` +
    '  checksum: local\n  languageName: node\n  linkType: hard\n\n'));
NODE
        cp "$repo/yarn.lock" "$root/overlay-yarn.lock"
        sed 's|^"@cratis/test@file:.*":$|"@cratis/test@npm:1.2.3":|' "$root/overlay-yarn.lock" > "$repo/yarn.lock"
        node "$(dirname "$SELF")/npm-restore-check.cjs" "$repo" "$output/npm-backup" || failed 'self-test: local resolution with original descriptor'
        passed=$((passed + 1))
        cp "$root/overlay-yarn.lock" "$repo/yarn.lock"
        printf '\n"unrelated-user-addition@npm:2":\n  version: 2\n' >> "$repo/yarn.lock"
        status=0; st_npm restore "$repo" > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] && [ -d "$output/npm-backup" ] || failed 'self-test: unrelated lockfile addition refused'
        grep -Fq 'file:' "$repo/package.json" || failed 'self-test: partial restore on conflict'
        passed=$((passed + 2))
        sed 's/checksum: keep/checksum: user-edit/' "$root/overlay-yarn.lock" > "$repo/yarn.lock"
        status=0; st_npm restore "$repo" > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] || failed 'self-test: unrelated lockfile edit refused'
        passed=$((passed + 1))
        cp "$root/overlay-yarn.lock" "$repo/yarn.lock"
        node - "$repo/package.json" <<'NODE'
const fs = require('fs'), file = process.argv[2];
const json = JSON.parse(fs.readFileSync(file)); json.userSetting = false;
fs.writeFileSync(file, JSON.stringify(json));
NODE
        status=0; st_npm restore "$repo" > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] || failed 'self-test: unrelated manifest edit refused'
        passed=$((passed + 1))
        cp "$output/npm-backup/expected-package.json" "$repo/package.json"
        st_npm restore "$repo" > "$root/output"
        cmp -s "$repo/package.json" "$root/original-package.json" || failed 'self-test: npm restore preserves prior manifest edits'
        cmp -s "$repo/yarn.lock" "$root/original-yarn.lock" || failed 'self-test: npm restore after install'
        [ ! -d "$output/npm-backup" ] || failed 'self-test: resolved backup removed'
        passed=$((passed + 3))
        git -C "$repo" checkout -- package.json
    else printf 'SKIP: npm mutation/restore needs node on inherited PATH\n'; skipped=$((skipped + 10)); fi
    # pack-npm uses npm pack so a nested, gitignored dist directory listed in files is packed whole.
    if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
        local pk_dir=$root/npm-workspace pk_feed=$root/npm-feed pk_ver=1.2.3-local.202601010000.gabcdef0 pk_count
        mkdir -p "$pk_dir/dist/bundles/sub" "$pk_feed/npm"
        printf '{"name":"@cratis/nested","version":"%s","files":["dist/bundles","dist/**/*.d.ts"]}\n' "$pk_ver" > "$pk_dir/package.json"
        printf 'dist\n' > "$pk_dir/.gitignore"
        printf 'a\n' > "$pk_dir/dist/bundles/a.js"; printf 'b\n' > "$pk_dir/dist/bundles/sub/b.js"
        printf 'export {}\n' > "$pk_dir/dist/a.d.ts"
        git -C "$pk_dir" init -q
        (FEED=$pk_feed; pack_npm_workspace "$pk_dir" package.json "$pk_ver") >/dev/null || failed 'self-test: npm workspace pack'
        [ -f "$pk_feed/npm/@cratis-nested-$pk_ver.tgz" ] || failed 'self-test: npm tarball name'
        pk_count=$(tar tzf "$pk_feed/npm/@cratis-nested-$pk_ver.tgz" | grep -c 'dist/bundles/') || true
        [ "$pk_count" -eq 2 ] || failed "self-test: nested dist files packed ($pk_count of 2)"
        tar tzf "$pk_feed/npm/@cratis-nested-$pk_ver.tgz" | grep -Fq 'dist/a.d.ts' || failed 'self-test: declaration glob packed'
        printf '{"name":"plainpkg","version":"%s","files":["dist/bundles"]}\n' "$pk_ver" > "$pk_dir/package.json"
        (FEED=$pk_feed; pack_npm_workspace "$pk_dir" package.json "$pk_ver") >/dev/null || failed 'self-test: unscoped npm workspace pack'
        [ -f "$pk_feed/npm/plainpkg-$pk_ver.tgz" ] || failed 'self-test: unscoped npm tarball kept'
        passed=$((passed + 5))
    else printf 'SKIP: npm pack needs node and npm on inherited PATH\n'; skipped=$((skipped + 5)); fi
    # Multi-repo stamp: the highest next patch wins and every HEAD is reported.
    local repo2 v2
    repo2=$root/repo2; mkdir -p "$repo2"; git -C "$repo2" init -q
    git -C "$repo2" config user.email test@example.invalid; git -C "$repo2" config user.name 'Local package self-test'
    printf 'x\n' > "$repo2/f"; git -C "$repo2" add f; git -C "$repo2" commit -qm initial; git -C "$repo2" tag v2.0.0
    v2=$(st stamp "$repo" "$repo2" 2> "$root/stderr")
    [[ "$v2" =~ ^2\.0\.1-local\.[0-9]{12}\.g$(git -C "$repo2" rev-parse --short=7 HEAD)$ ]] || failed 'self-test: multi-repo stamp uses highest base and last sha'
    [ "$(grep -c '^HEAD ' "$root/stderr")" -eq 2 ] || failed 'self-test: multi-repo stamp prints each HEAD'
    v2=$(st stamp "$repo2" "$repo" 2> /dev/null)
    [[ "$v2" =~ ^2\.0\.1-local\. ]] || failed 'self-test: multi-repo stamp order independent base'
    passed=$((passed + 3))
    # A train stamp covers every producer: changing a non-last producer changes it, order does not.
    local ta tb tc
    ta=$(st stamp --train "$repo" "$repo2" 2> /dev/null); tb=$(st stamp --train "$repo2" "$repo" 2> /dev/null)
    [ "$ta" = "$tb" ] || failed 'self-test: train stamp is independent of producer order'
    [[ "$ta" =~ ^2\.0\.1-train\.g[0-9a-f]{7}$ ]] || failed "self-test: multi-producer train grammar ($ta)"
    printf 'y\n' > "$repo/g"; git -C "$repo" add g; git -C "$repo" commit -qm second
    tc=$(st stamp --train "$repo" "$repo2" 2> /dev/null)
    [ "$tc" != "$ta" ] || failed 'self-test: a change in a non-last producer must change the train stamp'
    git -C "$repo" reset -q --hard HEAD~1
    [ "$(st stamp --train "$repo" "$repo2" 2> /dev/null)" = "$ta" ] || failed 'self-test: train stamp returns with the same state'
    passed=$((passed + 4))
    # Train mode: a deterministic X.Y.Z-train.g<sha7> stamp, accepted everywhere a local stamp is.
    local tv tv2 tsha tleak
    tsha=$(printf '%s %s\n' "$(basename "$repo")" "$(git -C "$repo" rev-parse HEAD)" | shasum -a 1 | cut -c1-7)
    tv=$(st stamp --train "$repo") || failed 'self-test: stamp --train'
    tv2=$(st stamp --train "$repo")
    [[ "$tv" =~ ^1\.2\.4-train\.g$tsha$ ]] || failed "self-test: train stamp grammar ($tv)"
    [ "$tv" = "$tv2" ] || failed 'self-test: train stamp is deterministic'
    : > "$feed/nuget/Cratis.Train.$tv.nupkg"; : > "$feed/nuget/Cratis.Train.1.2.4-local.200001010000.g1234567.nupkg"
    st --dry-run use-nuget "$repo" "$tv" Cratis.Train > "$root/output" || failed 'self-test: use-nuget accepts a train stamp'
    for tleak in 1.2.4-train.1234567 1.2.4-train.200001010000.g1234567 1.2.4-train.gABCDEF0 1.2.4-train.g123456; do
        status=0; st --dry-run use-nuget "$repo" "$tleak" Cratis.Train > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] || failed "self-test: invalid train stamp accepted ($tleak)"
    done
    st clean --stamp "$tv" > "$root/output" || failed 'self-test: clean accepts a train stamp'
    has "Cratis.Train.$tv.nupkg" "$root/output" || failed 'self-test: clean lists the train artifact'
    if has '200001010000' "$root/output"; then failed 'self-test: clean --stamp train must not list a local stamp'; fi
    rm "$feed/nuget/Cratis.Train.$tv.nupkg" "$feed/nuget/Cratis.Train.1.2.4-local.200001010000.g1234567.nupkg"
    printf 'Version="%s"\n' "$tv" > "$repo/probe-train"
    status=0; st check "$repo" > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 1 ] || failed 'self-test: check misses an untracked train version'
    has 'train stamp' "$root/output" || failed 'self-test: check names the train stamp'
    git -C "$repo" add probe-train
    status=0; st check "$repo" > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 1 ] || failed 'self-test: check misses a staged train version'
    status=0; st check "$repo" --staged > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 1 ] || failed 'self-test: check --staged misses a train version'
    git -C "$repo" rm -qf --cached probe-train; rm "$repo/probe-train"
    st check "$repo" > "$root/output" || failed 'self-test: check clean after removing the train probe'
    passed=$((passed + 13))
    # use-npm --dir for a Yarn project in a subdirectory (no root package.json).
    if command -v node >/dev/null 2>&1; then
        local sub=$root/repo3
        mkdir -p "$sub/Source/Workbench"; git -C "$sub" init -q
        git -C "$sub" config user.email test@example.invalid; git -C "$sub" config user.name 'Local package self-test'
        cp "$root/original-package.json" "$sub/Source/Workbench/package.json" 2>/dev/null || printf '{"private":true,"dependencies":{"@cratis/test":"1.2.3"}}\n' > "$sub/Source/Workbench/package.json"
        printf '# lock\n' > "$sub/Source/Workbench/yarn.lock"
        git -C "$sub" add .; git -C "$sub" commit -qm initial
        status=0; st_npm use-npm "$sub" "$version" > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] || failed 'self-test: use-npm without --dir needs a root package.json'
        st_npm use-npm "$sub" "$version" --dir Source/Workbench > "$root/output" || failed 'self-test: use-npm --dir'
        grep -Fq '"@cratis/test": "file:' "$sub/Source/Workbench/package.json" || failed 'self-test: use-npm --dir overlays the subdirectory manifest'
        status=0; st_npm use-npm "$sub" "$version" --dir ../x > "$root/output" 2>&1 || status=$?
        [ "$status" -eq 2 ] || failed 'self-test: use-npm --dir rejects escapes'
        st_npm restore "$sub" > "$root/output" || failed 'self-test: restore follows --dir'
        git -C "$sub" diff --quiet || failed 'self-test: restore --dir leaves the tracked files clean'
        [ ! -e "$(git -C "$sub" rev-parse --absolute-git-dir)/cratis-local/npm-dir" ] || failed 'self-test: restore removes npm-dir'
        passed=$((passed + 6))
    else printf 'SKIP: use-npm --dir needs node\n'; skipped=$((skipped + 6)); fi
    mkdir -p "$home/.nuget/packages/cratis.test/$version" "$home/.nuget/packages/cratis.test/1.2.3"
    mkdir -p "$home/.nuget/packages/cratis.test/1.2.3-local.keep"
    for arg in nuget npm; do
        : > "$feed/$arg/keep-local.notes.tgz"
        : > "$feed/$arg/keep-local.202610221735.g12345678.tgz"
    done
    for arg in default --all; do
        if [ "$arg" = default ]; then st clean > "$root/output"; else st clean "$arg" > "$root/output"; fi
        grep -Fq "$version" "$root/output" || failed 'self-test: clean finds stamped subjects'
        if grep -Eq 'keep-local|local.keep' "$root/output"; then failed 'self-test: clean selected non-stamp'; fi
        passed=$((passed + 2))
    done
    st clean --stamp "$version" > "$root/output"
    grep -Fq "$home/.nuget/packages/cratis.test/$version" "$root/output" || failed 'self-test: clean lists local cache'
    [ -d "$home/.nuget/packages/cratis.test/$version" ] || failed 'self-test: dry-run mutated cache'
    : > "$feed/nuget/Cratis.Test.$version.snupkg"
    st clean --stamp "$version" --apply > "$root/output"
    [ ! -e "$feed/nuget/Cratis.Test.$version.snupkg" ] || failed 'self-test: clean left a symbols package'
    [ ! -e "$home/.nuget/packages/cratis.test/$version" ] || failed 'self-test: clean failed to remove cache'
    [ -d "$home/.nuget/packages/cratis.test/1.2.3" ] || failed 'self-test: clean removed real version'
    passed=$((passed + 5))
    printf 'SKIP: real dotnet/Yarn/Docker packing is not a hermetic self-test\n'; skipped=$((skipped + 3))
    self_test_matrix
    printf 'self-test: %s passed, %s skipped\n' "$passed" "$skipped"
}

# V fixtures: verify-pack and verify-assets against a fixture feed (needs zip, unzip and tar).
# Each fixture starts from the same complete feed so one case cannot hide behind another.
self_test_verify() {
    local vfeed=$root/vfeed s=1.2.4-local.202601010000.gaaaaaaa old=1.2.4-local.200001010000.g1234567 args id
    local lib=(--consumer App --producer Lib --producer Mid)
    fxv() { env -i HOME="$home" PATH=/usr/bin:/bin:/usr/sbin:/sbin TMPDIR="$TMP" CRATIS_LOCAL_MAP="$fx" CRATIS_LOCAL_FEED="$vfeed" /bin/bash "$SELF" "$@"; }
    if ! command -v zip >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
        printf 'SKIP: verify fixtures need zip, unzip and tar\n'; skipped=$((skipped + 30)); return 0
    fi
    # mkpkg ID STAMP [DEPENDENCY-ID RANGE]...: a .nupkg (a zip with a nuspec) or, for an @scope/name ID, an npm tarball.
    mkpkg() {
        local pid=$1 stamp=$2 deps='' dir=$root/pk
        shift 2
        mkdir -p "$dir" "$vfeed/nuget" "$vfeed/npm"
        case "$pid" in
            @*) mkdir -p "$dir/package"; printf '{"name":"%s","version":"%s"}\n' "$pid" "$stamp" > "$dir/package/package.json"
                (cd "$dir" && tar -czf "$vfeed/npm/${pid//\//-}-$stamp.tgz" package) ;;
            *) while [ $# -ge 2 ]; do deps="$deps<dependency id=\"$1\" version=\"$2\" />"; shift 2; done
                printf '<package><metadata><id>%s</id><dependencies>%s</dependencies></metadata></package>\n' "$pid" "$deps" > "$dir/$pid.nuspec"
                rm -f "$vfeed/nuget/$pid.$stamp.nupkg"; (cd "$dir" && zip -q "$vfeed/nuget/$pid.$stamp.nupkg" "$pid.nuspec") ;;
        esac
    }
    # mkfeed STAMP [MID-DEPENDENCY-RANGE]: the complete feed of the plan "App Lib Mid".
    mkfeed() {
        rm -rf "$vfeed"
        mkpkg Cratis.Lib "$1"; mkpkg Cratis.Lib.Core "$1"; mkpkg @cratis/lib "$1"
        mkpkg Cratis.Mid "$1" Cratis.Lib "${2:-$1}"
        mkpkg Cratis.Extra "$1"
    }
    # mkassets DIR ID/VERSION...: a restore result that resolves exactly these packages.
    mkassets() {
        local dir=$1 entry sep=''
        shift; mkdir -p "$dir/obj"
        { printf '{\n  "libraries": {\n'
            for entry in "$@"; do printf '%s    "%s": {\n      "type": "package"\n    }' "$sep" "$entry"; sep=$',\n'; done
            printf '\n  }\n}\n'; } > "$dir/obj/project.assets.json"
    }
    # V1: complete feed, plan-mode verify and the exact JSON line.
    mkfeed "$s"
    expect_status 0 'V1 complete feed verifies' fxv verify-pack "$s" "${lib[@]}"
    has 'verify-pack: 4 planned artifacts present' "$root/output" || failed 'self-test: V1 summary'
    fxv verify-pack "$s" "${lib[@]}" --json > "$root/output" 2> "$root/stderr" || failed 'self-test: V1 json'
    printf '{"stamp":"%s","packages":[{"id":"Cratis.Lib","version":"%s"},{"id":"Cratis.Lib.Core","version":"%s"},{"id":"@cratis/lib","version":"%s"},{"id":"Cratis.Mid","version":"%s"}]}\n' "$s" "$s" "$s" "$s" "$s" > "$root/json.expected"
    cmp -s "$root/output" "$root/json.expected" || failed 'self-test: V1 json line grammar'
    passed=$((passed + 2))
    # V2: a cross-producer dependency at the wrong version.
    mkfeed "$s" 1.0.0
    expect_status 1 'V2 wrong-version cross-producer dependency' fxv verify-pack "$s" "${lib[@]}"
    has 'dependency: Cratis.Mid -> Cratis.Lib 1.0.0' "$root/output" || failed 'self-test: V2 names the dependency'
    passed=$((passed + 1))
    # V3: lower bound equal to the stamp passes; a range that merely contains the stamp does not.
    for args in "[$s, )" "$s" "[$s]"; do
        mkfeed "$s" "$args"
        expect_status 0 "V3 dependency range $args" fxv verify-pack "$s" "${lib[@]}"
    done
    mkfeed "$s" "[1.0.0, $s)"
    expect_status 1 'V3 range with the stamp as upper bound' fxv verify-pack "$s" "${lib[@]}"
    # V4: a dependency outside the plan is ignored.
    mkfeed "$s"; mkpkg Cratis.Mid "$s" Cratis.Lib "$s" Cratis.Other 1.0.0
    expect_status 0 'V4 unplanned dependency is ignored' fxv verify-pack "$s" "${lib[@]}"
    # V5: a missing planned artifact is not satisfied by another stamp.
    mkfeed "$s"; rm "$vfeed/nuget/Cratis.Lib.Core.$s.nupkg"; mkpkg Cratis.Lib.Core "$old"
    expect_status 1 'V5 missing planned artifact' fxv verify-pack "$s" "${lib[@]}"
    has "missing: Cratis.Lib.Core $s (Lib nuget)" "$root/output" || failed 'self-test: V5 names the artifact'
    mkassets "$root/cons" "Cratis.Lib/$s" "Cratis.Lib.Core/$s" "Cratis.Mid/$s"
    expect_status 1 'V5 verify-assets plan mode also fails on the missing artifact' fxv verify-assets "$root/cons" "$s" "${lib[@]}"
    passed=$((passed + 2))
    # V6: a real NuGet-only plan never demands the npm tarballs of a dual-ecosystem producer.
    rm -rf "$vfeed"
    while IFS= read -r id; do mkpkg "$id" "$s"; done < <(awk -F'\t' '$1 == "ids" && $2 == "Arc" && $3 == "nuget" { n = split($4, a, ","); for (i = 1; i <= n; i++) print a[i] }' "$(dirname "$SELF")/dependency-map.tsv")
    expect_status 0 'V6 real Arc NuGet plan without npm tarballs' env -i HOME="$home" PATH=/usr/bin:/bin TMPDIR="$TMP" CRATIS_LOCAL_FEED="$vfeed" /bin/bash "$SELF" verify-pack "$s" --consumer Stage --producer Arc
    # V7: stale assets (an older local stamp) name the ID, version and path.
    mkfeed "$s"
    mkassets "$root/cons" "Cratis.Lib/$old" "Cratis.Lib.Core/$s" "Cratis.Mid/$s"
    expect_status 1 'V7 stale local stamp' fxv verify-assets "$root/cons" "$s" "${lib[@]}"
    has "Cratis.Lib $old $root/cons/obj/project.assets.json" "$root/output" || failed 'self-test: V7 names id, version and path'
    passed=$((passed + 1))
    # V8: a train stamp changes with a commit in a non-last producer, so the old feed is stale.
    local t1 t2
    t1=$(st stamp --train "$repo" "$repo2" 2> /dev/null); mkfeed "$t1"
    expect_status 0 'V8 train feed verifies at its own stamp' fxv verify-pack "$t1" "${lib[@]}"
    git -C "$repo" commit -q --allow-empty -m 'non-last producer change'
    t2=$(st stamp --train "$repo" "$repo2" 2> /dev/null)
    [ "$t1" != "$t2" ] || failed 'self-test: V8 stamp changes with a non-last producer commit'
    expect_status 1 'V8 stale train stamp' fxv verify-pack "$t2" "${lib[@]}"
    has "missing: Cratis.Lib $t2" "$root/output" || failed 'self-test: V8 missing at the new train stamp'
    passed=$((passed + 2))
    # V9: a second, stale installed copy of an npm package.
    mkfeed "$s"
    mkdir -p "$root/npmcons/node_modules/@cratis/lib"
    printf '{"name":"@cratis/lib","version":"%s"}\n' "$s" > "$root/npmcons/node_modules/@cratis/lib/package.json"
    expect_status 0 'V9 one installed copy at the stamp' fxv verify-assets "$root/npmcons" "$s" --npm "${lib[@]}"
    mkdir -p "$root/npmcons/node_modules/x/node_modules/@cratis/lib"
    printf '{"name":"@cratis/lib","version":"1.0.0"}\n' > "$root/npmcons/node_modules/x/node_modules/@cratis/lib/package.json"
    expect_status 1 'V9 stale second npm copy' fxv verify-assets "$root/npmcons" "$s" --npm "${lib[@]}"
    has "@cratis/lib 1.0.0" "$root/output" || failed 'self-test: V9 names the stale copy'
    expect_status 1 'V9 feed-wide npm mode flags the same copy' fxv verify-assets "$root/npmcons" "$s" --npm
    passed=$((passed + 1))
    # V10: a named producer the consumer never resolved.
    mkfeed "$s"
    mkassets "$root/cons" "Cratis.Mid/$s" "Cratis.Extra/$s"
    expect_status 1 'V10 unconsumed producer' fxv verify-assets "$root/cons" "$s" --consumer App --producer Lib --producer Mid --producer Extra
    has 'unconsumed: Lib (nuget)' "$root/output" || failed 'self-test: V10 names the unconsumed producer'
    mkassets "$root/cons" "Cratis.Mid/$s" "Cratis.Extra/$s" "Cratis.Lib/$s"
    expect_status 0 'V10 one consumed ID is enough' fxv verify-assets "$root/cons" "$s" --consumer App --producer Lib --producer Mid --producer Extra
    passed=$((passed + 1))
    # V11: an unrelated package at the stamp is ignored in plan mode and flagged by the feed-wide mode.
    mkfeed "$s"; mkpkg Cratis.Unrelated "$s"
    mkassets "$root/cons" "Cratis.Lib/$s" "Cratis.Mid/$s" "Cratis.Unrelated/9.9.9"
    expect_status 0 'V11 plan mode ignores an unrelated package' fxv verify-assets "$root/cons" "$s" "${lib[@]}"
    expect_status 1 'V11 feed-wide mode flags it' fxv verify-assets "$root/cons" "$s"
    # V12: --json lists only what the consumer resolved, whatever else the feed holds.
    mkassets "$root/cons" "Cratis.Lib/$s" "Cratis.Mid/$s"
    fxv verify-assets "$root/cons" "$s" "${lib[@]}" --json > "$root/output" 2> "$root/stderr" || failed 'self-test: V12 json'
    printf '{"stamp":"%s","packages":[{"id":"Cratis.Lib","version":"%s"},{"id":"Cratis.Mid","version":"%s"}]}\n' "$s" "$s" "$s" > "$root/json.expected"
    cmp -s "$root/output" "$root/json.expected" || failed 'self-test: V12 json lists only consumer resolutions'
    passed=$((passed + 1))
    # V13/V14: cannot-run cases exit 2.
    expect_status 2 'V13 no edge in that ecosystem' fxv verify-assets "$root/cons" "$s" --npm --consumer Mid --producer Lib
    mkdir -p "$root/noassets"
    expect_status 2 'V13 no project.assets.json' fxv verify-assets "$root/noassets" "$s" "${lib[@]}"
    expect_status 2 'V14 verify-pack --consumer without --producer' fxv verify-pack "$s" --consumer App
    expect_status 2 'V14 verify-pack --producer without --consumer' fxv verify-pack "$s" --producer Lib
    expect_status 2 'V14 verify-assets --consumer without --producer' fxv verify-assets "$root/cons" "$s" --consumer App
    expect_status 2 'V14 verify-assets --producer without --consumer' fxv verify-assets "$root/cons" "$s" --producer Lib
    # Manual forms stay available.
    expect_status 0 'name-mode verify-pack' fxv verify-pack "$s" Lib --ecosystem nuget
    expect_status 2 'name-mode verify-pack without ids' fxv verify-pack "$s" Nod
}

# Fixture matrix for the plan, closure and verify commands. Runs inside self_test and uses its
# root/home/feed/st/passed/skipped (dynamic scope). `fx` is the fixture map, `real` the shipped one.
# expect_status WANT DESCRIPTION COMMAND...: run, capture stdout/stderr in $root/output and $root/stderr, require the exit code.
expect_status() {
    local want=$1 desc=$2 got=0
    shift 2
    "$@" > "$root/output" 2> "$root/stderr" || got=$?
    [ "$got" -eq "$want" ] || failed "self-test: $desc (exit $got, wanted $want)"
    passed=$((passed + 1))
}
tsv() { local IFS=$'\t'; printf '%s\n' "$*"; }
self_test_matrix() {
    local fx=$root/fx.tsv status
    fxm() { env -i HOME="$home" PATH=/usr/bin:/bin:/usr/sbin:/sbin TMPDIR="$TMP" CRATIS_LOCAL_MAP="$fx" /bin/bash "$SELF" "$@"; }
    {
        echo '# fixture map'
        tsv pack Lib nuget Lib.slnx
        tsv pack Lib nuget Lib.Extra.slnx A=1,B=2
        tsv ids Lib nuget Cratis.Lib,Cratis.Lib.Core
        tsv pack Lib npm .
        tsv ids Lib npm @cratis/lib
        tsv pack Mid nuget Mid.slnx
        tsv ids Mid nuget Cratis.Mid
        tsv pack Extra nuget Extra.slnx
        tsv ids Extra nuget Cratis.Extra
        tsv pack Nod nuget Nod.slnx
        tsv uses Mid Lib nuget Directory.Packages.props
        tsv uses App Mid nuget Directory.Packages.props
        tsv uses App Lib nuget Directory.Packages.props
        tsv uses App Extra nuget Directory.Packages.props
        tsv uses App Lib npm .
        tsv uses App Orl nuget Directory.Packages.props
        tsv uses Orl Lib nuget Directory.Packages.props
        tsv uses App Nod nuget Directory.Packages.props
    } > "$fx"
    # P1: exact plan rows and the unnamed-hop warning on stderr only.
    {
        tsv pack Lib nuget; tsv pack Lib npm; tsv pack Mid nuget; tsv overlay Mid Lib
        tsv consume Lib nuget Directory.Packages.props; tsv consume Lib npm .; tsv consume Mid nuget Directory.Packages.props
    } > "$root/p1.expected"
    fxm plan App Lib Mid > "$root/output" 2> "$root/stderr" || failed 'self-test: P1 plan'
    cmp -s "$root/output" "$root/p1.expected" || failed 'self-test: P1 plan rows differ from the expected plan'
    has 'Lib -> Orl -> App' "$root/stderr" || failed 'self-test: P1 unnamed-hop warning'
    if has 'WARNING' "$root/output"; then failed 'self-test: P1 warning must stay on stderr'; fi
    # P2/P3: the real map. An NuGet-only edge plans only the NuGet ecosystem of a dual-ecosystem producer;
    # npm-only ids on a NuGet edge cannot be planned. P3 must move to the fixture map if Screenplay ships NuGet ids.
    st plan Stage Arc > "$root/output" 2> "$root/stderr" || failed 'self-test: P2 real plan'
    { [ "$(grep -c '^pack' "$root/output")" -eq 1 ] && has "$(tsv pack Arc nuget)" "$root/output"; } || failed 'self-test: P2 plans exactly pack Arc nuget'
    status=0; st plan Stage Screenplay > "$root/output" 2> "$root/stderr" || status=$?
    { [ "$status" -eq 2 ] && [ ! -s "$root/output" ] && has 'Screenplay (nuget)' "$root/stderr"; } || failed 'self-test: P3 npm-only ids on a NuGet edge'
    passed=$((passed + 3))
    # P4-P7: invalid inputs exit 2 with nothing on stdout (unknown, repeated, consumer as producer, wrong order, no edge, no ids, no producer).
    local bad
    for bad in 'App Nope' 'App Lib Lib' 'App Lib App' 'App Mid Lib' 'Mid Extra' 'App Nod' 'App'; do
        status=0
        # shellcheck disable=SC2086
        fxm plan $bad > "$root/output" 2> "$root/stderr" || status=$?
        { [ "$status" -eq 2 ] && [ ! -s "$root/output" ]; } || failed "self-test: plan $bad must exit 2 with empty stdout (got $status)"
        passed=$((passed + 1))
    done
    # P8: a malformed row names its line.
    { cat "$fx"; printf 'uses\tApp\tLib\n'; } > "$root/bad.tsv"
    status=0; fx=$root/bad.tsv; fxm plan App Lib > "$root/output" 2> "$root/stderr" || status=$?
    fx=$root/fx.tsv
    { [ "$status" -eq 2 ] && has "bad.tsv:$(($(wc -l < "$root/bad.tsv"))): malformed" "$root/stderr"; } || failed 'self-test: P8 malformed map row'
    passed=$((passed + 1))
    # Pack properties are separate -p: arguments of the one command, never an environment variable.
    mkdir -p "$root/bin"; printf '#!/bin/sh\nexit 0\n' > "$root/bin/dotnet"; chmod +x "$root/bin/dotnet"
    env -i HOME="$home" PATH="$root/bin:/usr/bin:/bin" TMPDIR="$TMP" /bin/bash "$SELF" --dry-run pack-nuget "$repo" "$version" --property A=1 --property B=2 Lib.slnx > "$root/output" || failed 'self-test: pack-nuget --property dry run'
    { has ' -p:A=1 -p:B=2 ' "$root/output" && ! has CRATIS_LOCAL_PACK_PROPERTIES "$root/output"; } || failed 'self-test: pack-nuget prints separate -p: tokens'
    status=0; env -i HOME="$home" PATH="$root/bin:/usr/bin:/bin" TMPDIR="$TMP" /bin/bash "$SELF" --dry-run pack-nuget "$repo" "$version" --property 'A=1;B' Lib.slnx > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 2 ] || failed 'self-test: pack-nuget rejects an invalid property'
    status=0; env -i HOME="$home" PATH="$root/bin:/usr/bin:/bin" TMPDIR="$TMP" /bin/bash "$SELF" --dry-run pack-nuget "$repo" "$version" --property A=1 > "$root/output" 2>&1 || status=$?
    [ "$status" -eq 2 ] || failed 'self-test: pack-nuget needs a target after the properties'
    passed=$((passed + 3))
    self_test_verify
}

case "$MODE" in
    stamp) stamp "$@" ;;
    plan) plan_command "$@" ;;
    verify-pack) verify_pack "$@" ;;
    verify-assets) verify_assets "$@" ;;
    pack-nuget) pack_nuget "$@" ;;
    pack-npm) pack_npm "$@" ;;
    use-nuget) use_nuget "$@" ;;
    use-npm) use_npm "$@" ;;
    restore) restore "$@" ;;
    check) check "$@" ;;
    clean) clean "$@" ;;
    --self-test) self_test "$@" ;;
    *) die "unknown command: $MODE (use --help)" ;;
esac
