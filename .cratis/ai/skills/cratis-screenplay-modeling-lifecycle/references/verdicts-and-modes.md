# Verdicts and modes

Exact commands, exit codes, admitted subsets and every version-specific fact live in
`cratis-screenplay-toolchain` (`references/versions.md` and its subset references). This file
defines what each result means and how to report it. Do not copy version facts here.

## Five independent results

| Result | Evidence | Does NOT prove |
|---|---|---|
| V1 authorable | folder-mode validate with warnings as errors. The standalone compiler includes imports in folder and file mode; the pinned `cratis` CLI (v3.27.1) file validation ignores imports, so folder mode is the cross-tool check | semantics, binding, specs |
| V2 executable diagnostics | the executable model reports no diagnostics for the scope | that any spec runs or passes |
| V3 binding-ready | the model binds to the executable semantic model | that any spec runs or passes |
| V4 reference specs run | the reference execution route only: engine, and per `.play` specification passed / failed / unsupported / cancelled | rendering, generated code, build or target tests |
| V5 delivery and target-verified | admission, publication, Debug build, Debug tests of generated specifications, each reported separately | customization conformance, faithful UI |

Results are independent: V3 can be ready while V1 has warnings; V5 build can pass with V4 not
run. Never infer one from another. Spec outcomes for V4 come only from a reference execution
route. Written or bound specifications are never "specs pass", and rendered Debug tests are
V5 evidence, not V4.

V4 rules:
- Report per `.play` specification (expected = specifications in the accepted scope; discovered =
  specifications the route ran). A gap between them is a finding.
- When no reference route exists in this toolchain, report `V4 not run: no route` with the reason.
  In executable mode with specs wanted, "done" needs V4 or that line.

V5 rules:
- Four separate lines of evidence: admission, publication, Debug build, Debug tests. Never collapse them.
- Generated specifications compile only under `#if DEBUG`: build and test in **Debug**. Map tests
  to `.play` specifications by generated spec class, not by test counts, and treat a difference
  between specifications in scope and classes found as a finding.
- Never claim a whole-application V5 from a subset, and never claim a customization made a
  rejected model renderable.

## Commands (enough to check without loading the toolchain skill)
- V1, preferred: `screenplay <model-folder> --warnaserror --no-color` (check "N file(s) compiled").
- V1, fallback: `cratis screenplay validate <model-folder> --warnings-as-errors`.
- V2, V3: the MCP workspace readiness and executable diagnostics.
- Name tool and version on each line. A tool older than the model's constructs reports false
  failures; see the toolchain skill.

## Report template

```text
Mode: executable   Source: <commit | commit+<hash>> / ws <revision> cat <catalogRevision>
V1 authorable:   pass (N files)                      | fail: PLAYnnnn at file:line - meaning
V2 diagnostics:  none (executable model)             | n diagnostics | not run: <reason>
V3 binding:      ready                               | blocked: PLAYnnnn ... | not run: design mode
V4 specs:        12 expected / 12 discovered, 11 passed, 1 unsupported (route) | not run: no route
V5 delivery:     admission ok, publication ok, build ok (Debug), tests 11/12   | not run: <reason>
Gaps:            <capability gaps, tool-version gaps>
```

## Source identity
Acceptance and verdicts bind to a **source identity**: the commit plus a digest of an explicit
manifest of every input the model depends on. Ignored and untracked inputs count (an ignored
attachment can change while the commit stays the same), so the digest comes from file bytes, not
from `git status`. Inputs: every file under the model root, the identity catalog
(`.screenplay/identities.json`) when present, and every attachment file the model references,
wherever it lives inside the repository.

Run from the repository root with repository-relative paths. It fails closed (non-zero exit, no
digest) on: a missing model-root argument, an empty input inventory, a missing, unreadable,
non-regular input, any input that resolves outside the repository, any symlink (the input itself
with or without a trailing slash, a symlinked parent component, or anything below an input
directory, including nested directory links), and any traversal, hashing or sort failure. Each
input is normalised first: trailing slashes are stripped, the whole path is resolved physically
(`pwd -P`) and compared with its lexical form, so `dir/` for a symlinked `dir`, `..`, `../x` and
`sub/../..` fail closed. The manifest lists canonical repository-relative paths, so `root`,
`root/` and `./root` give one digest.
Deletions and renames change the digest because the manifest lists paths as well as hashes.

```shell
#!/usr/bin/env bash
# Usage: ident.sh <model-root> [extra-input-path ...]   (run from the repository root)
set -euo pipefail
fail() { echo "ident: $*" >&2; exit 1; }
[[ $# -ge 1 ]] || fail "usage: ident.sh <model-root> [extra-input-path ...]"
repo=$(git rev-parse --show-toplevel) || fail "not in a git repository"
repo=$(cd "$repo" && pwd -P) || fail "cannot resolve the repository root"
commit=$(git rev-parse HEAD) || fail "no commit"
tmp=$(mktemp -d) || fail "mktemp failed"
trap 'rm -rf "$tmp"' EXIT
cd "$repo" || fail "cannot enter the repository root"
# Collapse ".", "" and ".." components lexically (no filesystem access).
lexical() {
  local IFS=/ part out=() r
  for part in $1; do
    case "$part" in
      ''|.) ;;
      ..) [[ ${#out[@]} -gt 0 ]] && unset 'out[${#out[@]}-1]' ;;
      *) out+=("$part") ;;
    esac
  done
  r="${out[*]-}"
  printf '/%s' "$r"
}
: > "$tmp/files"
for arg in "$@"; do
  p=$arg
  while [[ "$p" == */ && "$p" != "/" ]]; do p=${p%/}; done
  [[ -n "$p" ]] || fail "empty input"
  [[ -e "$p" ]] || fail "missing input: $arg"
  [[ ! -L "$p" ]] || fail "symlink input: $arg"
  if [[ "$p" == /* ]]; then lex=$(lexical "$p"); else lex=$(lexical "$repo/$p"); fi
  if [[ -d "$p" ]]; then
    real=$(cd "$p" && pwd -P) || fail "cannot resolve: $arg"
  else
    dir=$(cd "$(dirname "$p")" && pwd -P) || fail "cannot resolve: $arg"
    real="$dir/$(basename "$p")"
  fi
  [[ "$real" == "$repo"/* ]] || fail "input outside the repository: $arg"
  [[ "$real" == "$lex" ]] || fail "input path contains a symlink or an escaping component: $arg"
  rel=${real#"$repo"/}
  if [[ -d "$rel" ]]; then
    find "$rel" -type l -print > "$tmp/links" || fail "traversal failed: $arg"
    [[ ! -s "$tmp/links" ]] || fail "symlink under input: $(head -n 1 "$tmp/links")"
    find "$rel" -type f -print0 >> "$tmp/files" || fail "traversal failed: $arg"
  else
    [[ -f "$rel" ]] || fail "not a regular file: $arg"
    printf '%s\0' "$rel" >> "$tmp/files"
  fi
done
[[ -s "$tmp/files" ]] || fail "empty input inventory"
: > "$tmp/manifest"
while IFS= read -r -d '' f; do
  [[ -r "$f" && ! -L "$f" ]] || fail "unreadable or symlink: $f"
  h=$(shasum -a 256 < "$f") || fail "hash failed: $f"
  printf '%s\t%s\n' "$f" "${h%% *}" >> "$tmp/manifest"
done < "$tmp/files"
LC_ALL=C sort -u "$tmp/manifest" > "$tmp/sorted" || fail "sort failed"
d=$(shasum -a 256 < "$tmp/sorted") || fail "digest failed"
echo "$commit+${d:0:12}"
```
Example: `ident.sh .cratis/screenplay .cratis/screenplay/.screenplay/identities.json src/Billing/Rule.cs`
(the identity catalog sits inside the root, so list it only if it lives elsewhere; duplicates are
merged). Record the output as the source identity; a changed digest invalidates acceptance. Add the
MCP workspace revision and catalog revision when a workspace is open. Validated cases: a normal
folder (stable digest on rerun), a changed file, an added file, a deleted file, a symlinked folder,
a nested file symlink, a nested directory symlink, a symlink with a trailing slash (`dir/`, `dir//`),
a path through a symlinked parent, `.`, `..`, `../`, `../x`, `model/..`, `/`, an absolute
out-of-repository path, an empty folder, no argument, an empty argument, a missing input, an
unreadable file, an untraversable directory, and equal digests for `root`, `root/`, `./root` and
`other/../root`. The cases ran as an executable scratch test (26 cases) against the script above.

### Revisions are three different things
- **Source identity** (above): bytes of the inputs. Used for acceptance.
- **Workspace revision** (MCP `expectedRevision` and catalog revision): guards edits in one workspace session.
- **`modelRevision`** (MCP `read-workspace view=executable-model`): the canonical semantic revision
  of the bound executable model. It exists only when the model binds. Descriptions and source
  locations are not part of it; the application identity is (without `identities.json` it is
  bootstrapped from the root folder name, so renaming the root or moving the file changes it).

## Render revision drift
Do not compare the MCP `modelRevision` with a render manifest's `semanticRevision`: the render
bootstraps its own application identity from `--name` and the plain source, and equality is not
guaranteed. Compare **successive render manifests** (`.cratis-render.json` `semanticRevision`)
produced with the same inputs, the same `--name` and the same toolchain, rendered into a probe
folder under `.ai-work/screenplay/<model-slug>/render-probe/`; or export the workspace and render
that so identities match. Equal revisions do not prove customization conformance or faithful UI.
Procedure: `cratis-screenplay-render-and-gap-fill`.

## Tool-version gaps
When a diagnostic contradicts documented semantics (known cases are listed in the toolchain
skill):
1. Record a tool-version gap with the code and the documented behavior.
2. Keep the correct model. Do not reshape it to silence the tool.
3. Apply the toolchain workaround if one exists; otherwise report the result as blocked and find
   or file an issue.

## Modes
| Mode | Language | Done |
|---|---|---|
| `design` | everything the toolchain shows compiling; no planned or undocumented syntax | V1, self-check, independent review |
| `executable` | the executable subset | V1 + V3, plus V4 or "V4 not run: no route" |
| `renderable` | the renderable subset | V1 + V3 + V5 sub-results |

- Never use syntax the toolchain does not show compiling. Future-facing syntax only on request.
- Constructs outside the narrower subset stay in the model as design-mode content; the gap is
  recorded and routed (P8: fallback with the model as contract).
- Never remove `@pii`, `@sensitive`, authorization, date or state-dependent rules to reach V3 or
  V5. Report blocked execution.
- Narrowing the mode is the user's decision; widening back to design is always allowed.
- Roadmap items that would change verdicts (a spec runner in the compiler tool, a lineage and
  completeness report) stay "not available" until the toolchain skill lists them as released.
