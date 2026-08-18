# Branch protection for `main`

`main` currently has **no protection at all** — `gh api repos/Cratis/AI/branches/main/protection`
returns 404 and `.../rulesets` returns `[]`. Every check in `.github/workflows/` is therefore
advisory: a red build does not block a merge, and nothing blocks a direct push to `main`.

Creating the ruleset is an owner decision and is not done by automation. Create it under
**Settings → Rules → Rulesets → New branch ruleset**, targeting `main`, with:

| Rule | Setting |
|---|---|
| Restrict deletions | on |
| Block force pushes | on |
| Require a pull request before merging | on, 1 approval, **require review from Code Owners** |
| Require status checks to pass | on, **require branches to be up to date** |

Code-owner review matters here specifically because `.github/CODEOWNERS` now covers
`Directory.Packages.props`, `global.json` and `.github/workflows/`. An unreviewed change to any
of those can break every build in the repository — which is exactly how `main` went red for six
days on a compiler-toolset/SDK mismatch that no gate was watching.

## Required status checks

These are job *names*, not workflow names. All nine are safe to require: every one of them
reports a conclusion on every pull request (see the next section for why).

| Check | Workflow | Reports when irrelevant |
|---|---|---|
| `Factory change detection` | Factory Foundation | always runs (it is the gate itself) |
| `Deterministic Factory foundation` | Factory Foundation | `skipped` |
| `Factory .NET libraries` | Factory Foundation | `skipped` |
| `AI corpus` | Factory Foundation | `skipped` |
| `Documentation` | Factory Foundation | `skipped` |
| `Shell scripts` | Factory Foundation | `skipped` |
| `Planner change detection` | Planner Build | always runs (it is the gate itself) |
| `Backend` | Planner Build | `skipped` |
| `Frontend` | Planner Build | `skipped` |

### What `Documentation` actually gates

Only the lint half is blocking. The job runs `markdownlint-cli2` at a version pinned in
`factory-foundation.yml` (`MARKDOWNLINT_CLI2_VERSION`) — an unpinned upgrade once moved this
tree's finding count by 138 on its own, so the pin is what makes the check a stable gate. It then
runs `Documentation/verify-markdown.sh` with `continue-on-error: true`, which re-lints and
link-checks with linkinator. That second step reaches the network, and a network round trip is not
a sound blocking merge gate, so a broken link shows up as a red step inside a green job and does
not stop a merge. Requiring `Documentation` therefore guarantees markdown lint cleanliness, not
link health.

### What `Backend` and `Frontend` also gate

Both jobs now snapshot `git status --porcelain --untracked-files=all` right after checkout and
compare it again at the end — the dirty-tree guard `factory-foundation.yml` already ran over its
Python checks, ported across. `Backend` takes an extra comparison immediately after the Release
build, so a Release pass that regenerated proxies fails as its own distinct problem instead of
being misreported as stale committed proxies. `Publish build artifacts` carries the same guard,
placed before the upload so a modified tree cannot be shipped as `planner-app`.

It matters most on `Backend`, the only job in the repository that runs the Cratis proxy generator:
`Planner.csproj` points `CratisProxiesOutputPath` at the project directory, so a Debug build writes
153 tracked files (79 proxies and 74 `index.ts` barrels) into `Source/Planner`. Without the guard a
build whose regenerated output differed from what is committed would compile, test and report green
against a tree that only ever existed on the runner, then discard the diff at teardown. Requiring
`Backend` therefore also guarantees that the committed proxies are the ones the C# source actually
produces.

The comparison deliberately omits `--ignored`, which is where it diverges from the Factory
Foundation one. `bin/`, `obj/`, `node_modules/`, `Source/Planner/wwwroot/`, `Source/Planner/out`,
`.yarn/install-state.gz`, `.eslintcache` and `*.tsbuildinfo` are gitignored output these jobs exist
to produce; sweeping them in would fail every run, and a gate that always fails gets switched off.
The generator itself is hash-aware — it skips the write when a generated file's content is
unchanged — so an in-sync tree survives a full rebuild with `git status` completely clean.

No job was added or renamed by any of this, so the nine required checks above are unchanged.

### Checks that must NOT be required

| Check | Workflow | Why not |
|---|---|---|
| `Build worker image` | Worker Image | Path filtered to `Source/Claude/**`. On a pull request that does not touch it the workflow never starts, no check run is created, and a required check of that name sits at *Expected — waiting for status* forever. |
| `cleanup` | Cleanup PR Artifacts | Triggers on `pull_request: types: [closed]`, so it cannot report on an open pull request. |

`Publish build artifacts` (Planner Build) is the one judgment call rather than a hard rule. It is
gated the same way as `Backend`/`Frontend` and would report correctly if required, but it is the
longest job in the repository and proves nothing the required builds do not already prove — leave
it out unless a broken Dockerfile reaching `main` becomes a real problem.

## How the deadlock was removed

A workflow skipped by a `paths:` filter creates **no check run at all**. A required check of that
name therefore sits at *Expected — waiting for status* and the pull request can never merge. A job
skipped by an in-job `if:` is different: it reports a `skipped` conclusion, and branch protection
treats `skipped` as passing. That asymmetry is the whole fix.

Both `factory-foundation.yml` and `planner-build.yml` now have **no `paths:` filter on any
trigger**. Every path list moved into a small first job — `changes` — that publishes one boolean
output per downstream job, and each job carries `needs: changes` plus
`if: needs.changes.outputs.<name> == 'true'`. Nothing about *what* triggers a job changed; only
*where* the decision is made. Two consequences worth naming:

- The Factory Foundation push and pull_request filters used to be two byte-identical lists that
  GitHub Actions offers no way to factor out (no YAML anchors in workflow files). There is now
  one copy of each list, in the `changes` job.
- The lists are no longer a union of what *any* job needs, so they are per-job and narrower. A
  pull request touching only `.ai/**` runs `AI corpus` and skips `Deterministic Factory
  foundation` and `Factory .NET libraries`, which the old union filter ran in full.

`Factory change detection` and `Planner change detection` are in the required list on purpose. If
a gate job fails, every job that `needs:` it is skipped — and *skipped counts as passing*, so
without the gate itself being required, a broken gate would wave the whole pull request through.

### The deadlock classes this closes

| Pull request touches | Before | Now |
|---|---|---|
| `Source/Planner/**` only | all three Factory Foundation checks never report | they report `skipped`; `Backend`/`Frontend` run |
| `.ai/**` or `.github/**` only | `Backend` and `Frontend` never report | they report `skipped`; `AI corpus` runs |
| `Documentation/Planner/**` only | nothing runs at all | `Documentation` runs; everything else reports `skipped` |
| Anything not in any list (e.g. `LICENSE`) | both workflows never report | both gates report success; all other jobs report `skipped` |

That last row is the reason the filters were converted rather than simply deleted. Deleting them
outright would also have made every check report — but it would have run the full .NET build, the
Python foundation suite and the whole frontend pipeline on a documentation-only pull request.
`.ai/rules/pull-requests.md` says a documentation-only pull request "skips this section
entirely… open it and merge it" and carries no version label, so a design that makes those pull
requests wait on irrelevant builds contradicts repository policy. Conversion keeps both
properties: always reports, and skips in seconds when irrelevant.

### What it costs

One extra job per workflow per pull request. Each `changes` job is a checkout plus one action
call — roughly 20–30 seconds of wall time, billed as **1 job-minute each, so about 2 added
job-minutes per pull request**. The `Documentation` job adds another ~1–2 minutes, but only on
pull requests that touch `Documentation/**` or `.markdownlint-cli2.jsonc`.

Against that, a documentation-only pull request no longer spends ~15 minutes in
`Deterministic Factory foundation` and `Factory .NET libraries`, which the old
`Documentation/Factory/**` entry in the Factory Foundation filter used to trigger in full.

### Action runtimes

Every action used by `planner-build.yml`, `planner-publish.yml` and `worker-image.yml` is pinned to
a major that runs on **Node 24** — `actions/checkout@v7`, `actions/setup-dotnet@v6`,
`actions/setup-node@v7`, `actions/upload-artifact@v7`, `docker/login-action@v4`,
`docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, and `dorny/paths-filter@v4.0.3`,
which was already there. Before that bump every job logged *Node.js 20 is deprecated … being forced
to run on Node.js 24*. Node 24 actions need Actions Runner **v2.327.1 or later**; all jobs here run
on `ubuntu-latest`, which is far past it, so this only becomes a constraint if a self-hosted runner
is ever introduced. `factory-foundation.yml` still carries the Node 20 pins and needs the same bump,
plus `actions/setup-python@v7`.

### Third-party action

Change detection uses [`dorny/paths-filter`](https://github.com/dorny/paths-filter), pinned by
full commit SHA (`ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d`, v4.0.3) with a `# v4.0.3` comment, the
same convention as every other action in these workflows. On `pull_request` it reads the changed
file list from the REST API — hence the job-scoped `pull-requests: read` permission — and on
`push` it compares with git, which is why the job still checks out. It is skipped entirely on
`workflow_dispatch`, where every output is forced to `true` so a manual run always does everything.
