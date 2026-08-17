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

Required status checks — these are job *names*, not workflow names:

- `Backend` and `Frontend` (Planner Build)
- `Deterministic Factory foundation`, `Factory .NET libraries`, `AI corpus` (Factory Foundation)

Code-owner review matters here specifically because `.github/CODEOWNERS` now covers
`Directory.Packages.props`, `global.json` and `.github/workflows/`. An unreviewed change to any
of those can break every build in the repository — which is exactly how `main` went red for six
days on a compiler-toolset/SDK mismatch that no gate was watching.

## The one gotcha: path-filtered workflows

Both workflows use `paths:` filters, and GitHub reports a required check that never ran as
*Expected — waiting for status*, which blocks the PR forever. Two ways to avoid deadlock:

- **Preferred:** require only checks from workflows that run on every PR. Today neither
  workflow does, so either drop the `paths:` filters, or
- add a `paths`-less companion job per workflow that reports the same check name via
  `if:`/skip logic.

`Factory Foundation`'s filter is already a deliberately broad union (all of `.github/**`,
`.ai/**`, `.claude/**`, `Source/Factory.Core*/**`, the build manifests) to shrink this window,
but a PR touching only `Source/Planner/**` still will not run it. Decide this before flipping
the required checks on.
