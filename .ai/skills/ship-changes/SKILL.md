---
name: ship-changes
description: >
  Use when asked to commit, push, create a PR, ship, or land changes. Stop at
  the requested verb; separately authorize merge, publication, issue effects,
  label mutations, and branch deletion. Preserve history and explicit staging.

---

# Ship Changes

This skill handles only the requested shipping endpoint. Preserve repository-specific
conventions and stricter private/effect gates; do not infer authority for later steps.

## Authorization and stopping points

The requested verb is the stopping point, not permission for the whole workflow:

- **Commit-only:** review, explicitly stage authorized paths, commit, and stop. Do not push or open a PR.
- **Push-only:** push the authorized branch/commits and stop. Do not create additional commits or a PR unless requested.
- **PR-only:** prepare/open the requested PR and report required checks; stop before merge.
- **Ship/land:** clarify the exact intended endpoint and effects. These words alone do not authorize destructive or notification-bearing effects.

Merge, issue comments or closure, label mutations (especially labels that trigger publication/releases), publication, and local or remote branch deletion each require separate explicit authorization for exact targets and effects. Apply the repository's current mutation protocol and stricter local/private gates; tool access and inverse escrow alone supply no authority. For destructive/bulk effects, prepare an exact dry-run, capture pre-state and deterministic inverse escrow in ignored `.ai-work/`, obtain approval, recheck preconditions, and record/read back outcomes through the approved repository-owned adapter. If a required adapter, safe inverse/compensation, or authorization is missing, stop. Preserve any stricter prohibition below.

Never rewrite history: no amend, rebase, squash merge, hard reset, force-push, or forced branch deletion. Use new commits, revert, cherry-pick, and merge instead. A request to ship does not override this prohibition.

## Inputs

Collect the following before starting:

- **Release intent** — propose `major`, `minor`, `patch`, or repository-supported non-release intent (ordinarily `no-release`) from the actual impact; confirm the current workflow contract. Apply a label only with explicit authorization for that exact label and any publication effects. If the user forbids labels but the repository requires one, report the blocker; do not silently omit it or bypass the gate.
- **Branch name suffix** — short kebab-case description of the work, e.g. `fix/testing-orleans-runtime-assemblies`. Determine from the nature of the changes if not provided.
- **Related GitHub issue** — search read-only if the change likely relates to one; use the real number or omit the reference when none exists. Never invent or reuse example numbers. Record whether the change fully resolves or only partly addresses each issue so step 9 can prepare a no-effect disposition.

## Step 1 — Review the working tree

```bash
git status
git diff
```

Read the full diff. Understand every changed file before touching git.
Do **not** start staging until you know exactly how the commits will be split.

## Step 2 — Create the branch

Branch off of current `main`. Always use a prefix:

| Prefix | When to use |
|--------|-------------|
| `fix/` | bug fixes, runtime errors, incorrect behavior |
| `feat/` | new features, new slices, new capabilities |
| `chore/` | build infra, tooling, docs, refactoring |

```bash
git checkout -b <prefix>/<short-description>
```

## Step 3 — Make logical commits

### Commit splitting rules

Split commits so that each one is a single logical unit of work:

1. **Infrastructure / plumbing first** — new types, interfaces, MSBuild targets, shared build props — anything that later commits build on.
2. **Core behavior second** — the actual fix or feature that uses the infrastructure.
3. **Specs / tests third** — only when specs are clearly separate from the behavior change (e.g. new integration spec added after the source fix). Combine with behavior commit when tightly coupled.
4. **Integration or wiring last** — DI registration, routing, UI hookup.

Never mix unrelated changes in a single commit.

### Staging discipline

Stage files explicitly — never `git add .` or `git add -A`:

```bash
git add <file1> <file2>
git diff --cached          # verify staged content before committing
git commit -m "<message>"
```

### Commit message format

```text
<imperative summary — 72-char max, no trailing period>

<optional body: WHY the change was made, context, trade-offs>
<use bullets for multi-part changes>
```

- Subject starts with a verb: `Add`, `Fix`, `Remove`, `Rename`, `Extract`, `Update`, `Support`.
- Body separated from subject by a blank line.
- Body explains *why*, not *what* — the diff shows the what.

**Good examples:**

```text
Add _PackPrivateAssemblyGlobs target for runtime-only NuGet package embedding

Extend the shared client build infrastructure with a new MSBuild target.
The new PrivatePackageAssemblyGlob item type globs $(OutputPath) at pack
time and embeds matching DLLs into lib/{tfm}/ without a nuspec dependency.
```

```text
Fix duplicate key crash in IdentityStorage.Populate

The upsert used InsertOne which threw on existing identities.
Replace with ReplaceOne using upsert: true.
```

**Bad examples** (never do these):

- `Fix stuff`
- `WIP`
- `Added files`
- `Fix bug and add feature and update docs`

## Step 4 — Push the branch

**Stop after step 3 for commit-only.** Run this step only for an authorized push; push-only does not authorize new commits or a PR.

```bash
git push -u origin <branch-name>
```

## Step 5 — Create the PR

**Stop after step 4 for push-only.** Create a PR only when requested; PR-only stops before merge.

Use `mcp_github_github_create_pull_request` with:

- `owner` / `repo`: **the current repository** — derive it from the `origin` remote (`git remote get-url origin`); never hardcode a specific repo
- `head`: the branch name
- `base`: `main`
- `title`: short imperative sentence describing the overall change
- `body`: PR description (see below)

### PR description format

Follow `.github/pull_request_template.md` exactly, and write the body as
release notes. Include only non-empty sections.

```markdown
# Summary
<optional short overview>

## Added
- <release-note bullet> (#<actual-issue-number>)

## Changed
- <release-note bullet> (#<actual-issue-number>)

## Fixed
- <release-note bullet> (#<actual-issue-number>)
```

Rules:

- Bullets are short, release-note ready, written for a user reading the changelog.
- Use `# Summary` when the release-note bullets need context. The summary should
  explain what was fixed from the consumer's point of view and why the fix matters
  when that context is useful, instead of listing implementation details.
- End every bullet with `(#<N>)` using the **real** GitHub issue number. Search issues first. If there is no issue, omit the reference entirely — never write `(#issue)` or reuse an example number.
- Remove any empty sections — no blank headings.
- Never include any Copilot prompt transcript or "Original prompt" block.

### Searching for a related issue

```text
mcp_github_github_search_issues  query="<keywords> repo:<owner>/<repo>"
```

(Use the current repository's `<owner>/<repo>`, derived from the `origin` remote —
unless canonical `.cratis/PROJECT.md` (legacy `.agents/PROJECT.md` only if canonical is absent) says issues are tracked in a separate repo, in which
case search *that* one. See "When issues live in a different repository" in step 9.)

If nothing relevant is found, omit the issue reference from affected bullets.

For every issue you do find, record two things for the no-effect step 9 disposition:

- its exact repository and number; and
- whether this change **fully resolves** it or only partly addresses it.

**Do not put closing keywords (`Closes #N`, `Fixes #N`) in the PR body.** The
published release notes are the PR description verbatim, so a closing keyword
would ship into the changelog. Any post-merge issue effect instead requires separate exact authorization and the repository-owned operation policy.

## Step 6 — Confirm release intent

**Release intent** — propose `major`, `minor`, `patch`, or repository-supported non-release intent (ordinarily `no-release`) from the actual impact; confirm the current workflow contract. Apply a label only with explicit authorization for that exact label and any publication effects. If the user forbids labels but the repository requires one, report the blocker; do not silently omit it or bypass the gate.

Documentation-only changes use repository-supported non-release intent, ordinarily `no-release`; confirm the workflow contract rather than assuming a label or API state. Run relevant content, link, frontmatter, and corpus checks instead of unrelated application builds, and satisfy every repository-required check, including release-intent checks where supported. Documentation is never a blanket exemption from red CI.

Read back an authorized label/body edit to confirm the exact requested change; API errors or ambiguous results require reconciliation, not blind retries. This skill assumes no external API state.

## Step 7 — Wait for required CI

Documentation-only work is not exempt from required CI or release-intent checks.
Inspect required checks read-only with the repository-supported tools. Before any
separately authorized merge, every required check must pass. Diagnose a failure
within a bounded attempt, fix only in-scope causes with authorized additive
commits/pushes, and re-run the affected gate. Report unrelated, environmental, or
unresolved failures as blockers; do not keep editing or retrying indefinitely and
do not treat an expected failure as green.

## Step 8 — Merge the PR

**Separate explicit merge authorization required for the exact PR/head and declared effects. PR-only stops here.** Required checks must pass; use a true merge commit, never squash or rebase. A release label is not merge/publication authority.

Use `mcp_github_github_merge_pull_request` with:

- `merge_method`: **`merge`** — a real merge commit, always
- `owner` / `repo`: the current repository (same as step 5)
- `pullNumber`: the PR number returned in step 5

**`merge_method` is `merge` and nothing else. Never `squash`, never `rebase`** — and the same
applies if you reach for the CLI instead: `gh pr merge --merge`, never `gh pr merge --squash` or
`--rebase`. Squashing is a **history rewrite** (`.ai/rules/git-commits.md#never-rewrite-history`):
it replaces the branch's commits with one new commit, and if a later separately authorized operation deletes the branch, nothing is left pointing at the originals. It does not feel like a rewrite
— it looks like an integration step, and the tidier result looks like an improvement — which is
precisely why it is the easiest way to break the rule by accident.

If the repository's settings permit only squash or rebase merges, **stop and ask the human.** That
is a setting to change, not a reason to squash.

## Step 9 — Prepare related-issue dispositions

Issue closure, comments, assignment, mentions, labels, and relationship changes
are separate notification/effect operations. A request to ship code does not
authorize them.

For every related issue, return one bounded post-merge disposition:

- **Fully resolved:** propose closure with the exact merged PR as evidence.
- **Partly addressed:** propose one concise material-status update stating what
  landed and what remains.
- **Not resolved or uncertain:** propose no issue effect and state why.

Do not run `gh issue` mutation commands or issue-mutating MCP/API tools from this
shared skill. Perform an issue effect only through a repository-owned adapter
whose current profile separately activates that exact operation, expected state,
notification behavior, read-back, and Unknown reconciliation. No such adapter is
provided by this skill. An open related issue does not make the code shipment
incomplete; report the pending human/owning-system disposition explicitly.

### When issues live in a different repository

Some repositories are private with Issues disabled and track their issues in a
separate public repo (check canonical `.cratis/PROJECT.md`; `.agents/PROJECT.md` only when canonical context is absent). Two consequences:

- Every read-only lookup and proposed disposition records the exact
  `<owner>/<tracker-repo>#<number>`; never rely on the current checkout to infer
  the destination.
- **A bare `(#N)` in the PR body points at the wrong repo** — issues and pull
  requests share one number sequence per repository, so `#109` in the code repo
  links to *its* PR #109. Write the fully qualified `(<owner>/<tracker-repo>#N)`
  in release-note bullets instead. Closing keywords remain banned, and any later
  comment or closure stays behind the owning tracker repository's exact effect
  policy.

## Step 10 — Clean up the branch

Branch deletion is optional, not completion criteria. Only after a verified merge
and separate explicit authorization for each exact local/remote ref may cleanup
proceed through the repository’s mutation protocol. Capture pre-state and inverse
escrow, recheck refs immediately before each action, and read back each outcome.
Do not batch checkout, pull, and deletion into one unreviewed command. Use only
`git branch -d`, never `-D`; stop if it refuses or any ref/precondition drifts.
Leave branches intact and report pending cleanup when authorization is absent.

## Full example sequence

These are separate authorized endpoints, not one command batch. Paths and IDs
are placeholders; derive the current repository and real targets before acting.

```bash
# Commit-only: explicitly authorized paths, review, commit, then STOP.
git add <authorized-path>
git diff --cached
git commit -m "Fix the scoped behavior"

# Only when push was requested: push authorized commits, then STOP for push-only.
git push -u origin <authorized-branch>

# Only when PR creation was requested: use the reviewed template/body.
gh pr create --base main --head <authorized-branch> --body-file <reviewed-body-path>
# STOP before merge for PR-only. Report relevant required checks.
```

A release-intent label, merge, issue comment/closure, or branch deletion is not an
implied next command. First obtain separate explicit authorization for the exact
effect and satisfy the authorization, current workflow, and mutation gates above.

## Common mistakes to avoid

- **Never `git add .`** — always stage specific files and verify with `git diff --cached`.
- **Never invent issue numbers** — search first; omit the reference if nothing matches.
- **Never leave placeholder text** in PR bodies (`(#issue)`, `(#123)`).
- **Never commit code that does not compile** — every commit must be a working state.
- **Never push directly to `main`** — always go through the branch + PR flow.
- **Never assume issue-effect authority** — prepare the exact post-merge disposition in step 9; an owning repository adapter and operation profile must authorize any later comment or closure.
- **Never put `Closes #N` / `Fixes #N` in the PR body** — the release notes are the body verbatim.
- **Never delete branches automatically** — leave local/remote refs intact unless their exact deletion is separately authorized after verified merge.
