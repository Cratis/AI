#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
root="$(cd "$root" && pwd -P)"
trap 'rm -rf "$root"' EXIT
export GIT_CONFIG_GLOBAL="$root/gitconfig" HOME="$root/home" TMPDIR="$root"
mkdir "$HOME"
entrypoint="$here/../entrypoint.sh"
for function in validate_workspace_mode validate_host_prepared_workspace prepare_host_workspace prepare_host_workspace_prompt push_workspaces; do
    awk -v name="$function" '$0 == name "() {" { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
done
[[ $(grep -c '^}$' "$root/functions") -eq 5 ]] || { echo 'Missing host-workspace functions'; exit 1; }
fail() { printf '%s\n' "$*" >&2; exit 1; }
log() { :; }
clone_into_workspace() { exit 99; }
clone_restricted_repositories() { exit 99; }
refresh_git_token() { exit 99; }
remember_workspace() { exit 99; }
# shellcheck source=/dev/null
. "$root/functions"
# Real local work trees; git is later wrapped to record all preparation calls.
git init -q "$root/work"
mkdir "$root/work/sub" "$root/not-git" "$root/bin"
ln -s "$root/work" "$root/link"
ln -s / "$root/root-link"
touch "$root/file"
real_git="$(command -v git)"
export REAL_GIT="$real_git" CALLS="$root/calls"
cat > "$root/bin/git" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS"
case " $* " in
    *' clone '*|*' fetch '*|*' ls-remote '*|*' push '*|*' checkout '*|*' branch '*|*' add '*|*' commit '*|*' update-ref '*|*' symbolic-ref '*|*credential.helper*) exit 99 ;;
    *' config '*) [[ " $* " == *' config --global '* ]] || exit 99 ;;
esac
exec "$REAL_GIT" "$@"
STUB
chmod +x "$root/bin/git"
export PATH="$root/bin:$PATH"
unset CRATIS_WORKSPACE_MODE
validate_workspace_mode
CRATIS_WORKSPACE_MODE=''; validate_workspace_mode
for mode in Host-Prepared 'host-prepared ' HOST-PREPARED clone 1 true; do
    if ( CRATIS_WORKSPACE_MODE="$mode" validate_workspace_mode ) > "$root/error" 2>&1; then exit 1; fi
    grep -q '^\[workspace\] Unknown' "$root/error"
done
export CRATIS_WORKSPACE_MODE=host-prepared
validate_workspace_mode
if ( export DIRECT_RUN_MODE=bundle-diff; validate_workspace_mode ) > "$root/error" 2>&1; then exit 1; fi
for variable in GITHUB_TOKEN GH_TOKEN DIRECT_PUSH_TOKEN_URL DIRECT_CLONE_CREDENTIALS DIRECT_REPOSITORY_URL DIRECT_REPOSITORY_URLS DIRECT_REPOSITORY_CHECKOUTS DIRECT_REPOSITORY_CACHE DIRECT_BRANCH; do
    for value in '' synthetic-fixture-value; do
        if ( export "$variable=$value"; validate_workspace_mode ) > "$root/error" 2>&1; then exit 1; fi
        grep -q "host-prepared mode refuses $variable" "$root/error"
        if grep -q synthetic-fixture-value "$root/error"; then exit 1; fi
    done
done
COPILOT_GITHUB_TOKEN=synthetic-provider-value validate_workspace_mode
for path in '' ws / "$root/work/../work" "$root/./work" "$root//work" "$root/work/" "$root/a:b" "$root/a,b" "$root/"$'a\nb' "$root/link" "$root/link/sub" "$root/root-link" "$root/missing" "$root/file" "$root/not-git" "$root/work/sub"; do
    if ( validate_host_prepared_workspace "$path" ) > "$root/error" 2>&1; then echo "Unexpected valid path"; exit 1; fi
    grep -q '^\[workspace\]' "$root/error"
done
if [[ $(id -u) -ne 0 ]]; then
    mkdir "$root/unwritable"; chmod 500 "$root/unwritable"
    if ( validate_host_prepared_workspace "$root/unwritable" ) > "$root/error" 2>&1; then exit 1; fi
    chmod 700 "$root/unwritable"
fi
validate_host_prepared_workspace "$root/work"
: > "$CALLS"
# Execute the actual main dispatch with /workspace relocated into this hermetic fixture.
awk '/^# Clone what the work covers:/ { take=1 } /^# Checked,/ { exit } take { print }' "$entrypoint" |
    sed "s#/workspace#$root/work#g" > "$root/dispatch"
grep -q 'prepare_host_workspace' "$root/dispatch"
WORKSPACES=()
# shellcheck source=/dev/null
. "$root/dispatch"
[[ ${#WORKSPACES[@]} -eq 0 ]]
WORKSPACES=("$root/work|old|https://github.com/o/r.git")
export DIRECT_BRANCH=forced-branch
[[ ${#WORKSPACES[@]} -eq 1 ]]
push_workspaces
if grep -Eq 'clone|fetch|ls-remote|push|checkout|branch|credential.helper| commit | add |update-ref|symbolic-ref' "$CALLS"; then exit 1; fi
grep -q 'config --global --add safe.directory' "$CALLS"
[[ "$(git config --global --get-all safe.directory)" == "$root/work" ]]
printf 'original fixture prompt\n' > "$root/prompt"
export PROMPT_FILE="$root/prompt"
prepare_host_workspace_prompt
[[ "$PROMPT_FILE" != "$root/prompt" ]]
grep -q 'uncommitted working-tree changes' "$PROMPT_FILE"
grep -q 'Do not commit, stage, write refs, or change repository git configuration' "$PROMPT_FILE"
grep -q 'original fixture prompt' "$PROMPT_FILE"
[[ $(cat "$root/prompt") == 'original fixture prompt' ]]
echo 'host-prepared: modes, nine refused inputs, hostile paths, local preparation and push guard checked'
