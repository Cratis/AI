#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# Offline private-installation contract: real Git credential selection and real local clones,
# with a transport double that requires each repository's own restricted token.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
export HOME="$root/home"
mkdir -p "$HOME" "$root/bin" "$root/workspace"
export REAL_GIT="$(command -v git)" ROOT="$root"
entrypoint="$here/../entrypoint.sh"
awk '/^if \[\[ -n "\$\{DIRECT_REPOSITORY_CHECKOUTS:-\}"/ { take=1 } take { print } take && /^fi$/ { exit }' "$entrypoint" > "$root/auth"
awk '/^clone_restricted_repositories\(\)/ { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" | perl -pe 's@/workspace@\$ROOT/workspace@g' > "$root/functions"
awk '/^push_workspaces\(\)/ { take=1 } take { print } take && /^}$/ { exit }' "$entrypoint" >> "$root/functions"
[[ $(grep -c '^}$' "$root/functions") -eq 2 ]] || exit 2
"$REAL_GIT" init -q "$root/source"
"$REAL_GIT" -C "$root/source" -c user.name=Spec -c user.email=spec@example.invalid commit -qm initial --allow-empty
"$REAL_GIT" clone -q --bare "$root/source" "$root/private.git"
cat > "$root/bin/git" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == clone ]]; then
    url="$2"; dest="$3"
    response=$(printf 'url=%s\n\n' "$url" | GIT_TERMINAL_PROMPT=0 "$REAL_GIT" credential fill)
    case "$url" in
        https://github.com/First/Same.git) expected=first-clone ;;
        https://github.com/Second/Same.git) expected=second-clone ;;
        *) exit 1 ;;
    esac
    [[ "$response" == *"password=$expected"* ]] || exit 1
    [[ "${DENY_SECOND:-0}" != 1 || "$expected" != second-clone ]] || exit 1
    printf '%s\n' "$url" >> "$ROOT/clones"
    exec "$REAL_GIT" clone -q "$ROOT/private.git" "$dest"
fi
exec "$REAL_GIT" "$@"
STUB
chmod +x "$root/bin/git"
export PATH="$root/bin:$PATH"
export DIRECT_REPOSITORY_CHECKOUTS='[{"repository":"internal-1","url":"https://github.com/First/Same.git","path":"repos/First/Same"},{"repository":"internal-2","url":"https://github.com/Second/Same.git","path":"repos/Second/Same"}]'
export DIRECT_CLONE_CREDENTIALS='[{"url":"https://github.com/First/Same.git","token":"first-clone"},{"url":"https://github.com/Second/Same.git","token":"second-clone"}]'
unset GITHUB_TOKEN GH_TOKEN DIRECT_PUSH_TOKEN_URL
fail() { exit 1; }
log() { :; }
link_primary_corpus() { [[ -d "$1/.git" ]]; }
# shellcheck source=/dev/null
. "$root/auth"
# shellcheck source=/dev/null
. "$root/functions"
clone_restricted_repositories
[[ $(wc -l < "$root/clones") -eq 2 ]]
[[ -d "$root/workspace/repos/First/Same/.git" && -d "$root/workspace/repos/Second/Same/.git" ]]
! grep -q 'first-clone\|second-clone' "$HOME/.gitconfig"
for url in https://github.com/Third/Same.git https://github.com/First/Other.git http://github.com/First/Same.git; do
    if printf 'url=%s\n\n' "$url" | GIT_TERMINAL_PROMPT=0 "$REAL_GIT" credential fill > "$root/denied" 2> "$root/denied-error"; then
        echo "Unexpected access: $url"; exit 1
    fi
done
# No automatic push or token refresh, even with locally committed work and legacy branch settings.
DIRECT_BRANCH=direct/spec
WORKSPACES=("$root/workspace/repos/First/Same|old|https://github.com/First/Same.git")
push_workspaces
# Start again: access to only one of two private installations must fail the entire preparation.
rm -rf "$root/workspace/repos"
export DENY_SECOND=1
if clone_restricted_repositories; then echo 'Partial checkout reported success'; exit 1; fi
# Refuse a traversal/collision in the mapping before touching a repository.
DIRECT_REPOSITORY_CHECKOUTS='[{"repository":"bad","url":"https://github.com/First/Same.git","path":"repos/../Same"}]'
if clone_restricted_repositories; then echo 'Invalid mapping reported success'; exit 1; fi
# No broad provider token may coexist with restricted credentials.
DIRECT_REPOSITORY_CHECKOUTS='[]'
export GITHUB_TOKEN=forbidden
if ( . "$root/auth" ); then echo 'Broad credential was accepted'; exit 1; fi
echo 'Checked 2 installation checkouts, 3 denied credential paths, partial/invalid checkout, no publish and broad-token refusal'
