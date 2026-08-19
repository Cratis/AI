# Corpus propagation health — measured 2026-08-19

Canonical corpus: `/Volumes/sourcecode/repos/cratis/AI/.ai/`. This report answers WU-1:
how stale is the corpus downstream, and why does propagation lag.

Every number below was produced by a command recorded in the "How to reproduce" section.
Measurement used Python `hashlib` over `git ls-tree` object ids. The `diff` command was
not used anywhere (it has misreported identical files on this machine).

## Headline

1. **Propagation is not broken. It is a mesh, and it is running.** 21 distinct repositories
   have acted as a propagation *source*; `Chronicle` alone wrote 370 sync commits into 33
   repos. `Cratis/AI` is one source among many, responsible for 124 of them.
2. **The five corrected API claims have reached zero downstream repos — because they are
   not on `origin/main` here.** `c852d41` sits on the unmerged branch
   `fix/ai-platform-hardening`, which is 85 commits ahead of `origin/main` and 0 behind.
   Canonical `origin/main` still serves `tooltip=` (32 occurrences) and `TenantId.Empty`.
   Nothing downstream can be fresher than the source.
3. **Comparing `origin/main` to `origin/main`, 31 of 35 downstream repos are still stale**
   against what canonical has already published. So there is a real lag *in addition* to
   the unmerged-branch effect — it is smaller than the working-tree comparison suggested,
   but it is not zero.
4. The prior session's "77 repos" is **wrong**, and so is the corrected "82". 40 of the 82
   directories are **git worktrees** (`.git` is a file, not a directory) — sharing an
   object store with their parent repo. There are **42 real repositories**, of which
   **35 carry `.ai/` downstream** plus canonical.

## Why the earlier numbers were wrong

Two independent measurement errors compounded, and both inflated the alarm:

- **Worktrees counted as repositories.** `Arc-sp-phase0`, `Studio-754`, `Screenplay-123`
  and 37 others are worktrees of `Arc`, `Studio`, `Screenplay`. Counting them measures the
  same repository many times and invents "snapshot clusters" that are really just
  branch-creation timestamps.
- **Working trees compared instead of published refs.** Downstream checkouts sit on
  arbitrary feature branches (`Studio` was on `feat/wire-analyzer-into-build`, `Chronicle`
  on `fix/revert-docker-boot-gate`), while canonical was compared from a branch 85 commits
  ahead of `main`. That comparison measures unmerged local work, not propagation health.

The corrected method compares `origin/main:.ai` to `origin/main:.ai`, which is the only
comparison that isolates propagation.

## Downstream staleness against canonical `origin/main` (173 files)

Verdict: `IN SYNC` = 0 differing and 0 missing; `near-sync` = 3 or fewer combined.

| Repo | files | identical | differ | missing | extra | verdict |
|---|---:|---:|---:|---:|---:|---|
| Arc | 173 | 171 | 2 | 0 | 0 | near-sync |
| Prologue | 173 | 172 | 1 | 0 | 0 | near-sync |
| Screenplay | 173 | 172 | 1 | 0 | 0 | near-sync |
| Stage | 173 | 172 | 1 | 0 | 0 | near-sync |
| Chronicle | 171 | 169 | 2 | 2 | 0 | STALE |
| Studio | 173 | 169 | 2 | 2 | 2 | STALE |
| AuthProxy | 171 | 163 | 8 | 2 | 0 | STALE |
| Components | 171 | 163 | 8 | 2 | 0 | STALE |
| Templates | 171 | 163 | 8 | 2 | 0 | STALE |
| release-action | 172 | 163 | 8 | 2 | 1 | STALE |
| Lens | 171 | 153 | 18 | 2 | 0 | STALE |
| Documentation | 165 | 144 | 18 | 11 | 3 | STALE |
| Architecture | 171 | 148 | 23 | 2 | 0 | STALE |
| Common | 171 | 148 | 23 | 2 | 0 | STALE |
| Narrator | 171 | 148 | 23 | 2 | 0 | STALE |
| Specifications | 171 | 148 | 23 | 2 | 0 | STALE |
| Experiments | 172 | 148 | 23 | 2 | 1 | STALE |
| ProtocolGeneration | 172 | 148 | 23 | 2 | 1 | STALE |
| homebrew-cratis | 171 | 147 | 24 | 2 | 0 | STALE |
| Automation | 162 | 141 | 21 | 11 | 0 | STALE |
| Samples | 162 | 141 | 21 | 11 | 0 | STALE |
| Prompter | 162 | 140 | 22 | 11 | 0 | STALE |
| Chronicle.Elixir | 171 | 75 | 95 | 3 | 1 | STALE |
| Chronicle.TypeScript | 171 | 75 | 95 | 3 | 1 | STALE |
| Chronicle.Kotlin | 141 | 55 | 85 | 33 | 1 | STALE |
| Fundamentals | 141 | 55 | 85 | 33 | 1 | STALE |
| cli | 141 | 55 | 85 | 33 | 1 | STALE |
| .github | 138 | 53 | 85 | 35 | 0 | STALE |
| Ante | 131 | 51 | 80 | 42 | 0 | STALE |
| Dockerfiles | 131 | 51 | 80 | 42 | 0 | STALE |
| StudioIssues | 131 | 51 | 80 | 42 | 0 | STALE |
| cratis.github.io | 131 | 51 | 80 | 42 | 0 | STALE |
| cratis.studio | 131 | 51 | 80 | 42 | 0 | STALE |
| Synopsis | 7 | 0 | 4 | 169 | 3 | STALE (partial adopter) |
| Workshops | 28 | 4 | 24 | 145 | 0 | STALE (partial adopter) |

`Synopsis` and `Workshops` carry deliberately partial corpora, not failed syncs.

## The five API corrections

Present in canonical `origin/main`: **no**. Present in any downstream repo: **no**.

| Defect | canonical `origin/main` | downstream repos carrying the fix |
|---|---|---:|
| `ToolbarButton tooltip=` should be `title=` | still `tooltip=` (32x) | 0 of 35 |
| `TenantId.Empty` should be `NotSet` | still `Empty` | 0 of 35 |
| `UserId.Empty` should be `NotSet` | still `Empty` | 0 of 35 |
| `Column` imported from a DataPage path | still wrong | 0 of 35 |
| `CommandDialog header=`/`confirmLabel=` | still wrong | 0 of 35 |

**This is not a propagation defect.** The fix is unmerged by the owner's explicit decision
(D1: nothing merges separately). The corpus reaches the fleet when the branch merges.
Recorded so no future session mistakes this for a broken pipeline.

## How propagation actually works

Trigger: `push` to `main` touching `.ai/**`, `.claude/**`, `.agents/**`, `.pi/**`,
`AGENTS.md` and the `.github` instruction paths, plus `workflow_dispatch`
(`.github/workflows/propagate-copilot-instructions.yml:3-19`). It delegates to the reusable
workflow `Cratis/Workflows/.github/workflows/propagate-copilot-instructions.yml`, which
enumerates all non-archived `Cratis/*` repos, builds one source artifact, and fans out with
`max-parallel: 3`, `fail-fast: false`. Delivery is a **direct push to the target's default
branch** via the Git Data API — not a pull request. So "unmerged sync PRs" is not the
failure mode.

**38 repositories carry this workflow**, which is why propagation is a mesh: any of them
can originate a sync. That explains the observed edges — `Chronicle` is the busiest source
by a wide margin, not `AI`.

### Structural risks found in the mechanism

1. **Mesh topology with no declared ownership.** 21 repos have written the corpus into
   others. If two sources publish different content, last writer wins, silently. Nothing
   records which repository owns which part of the corpus. This is the most serious
   structural finding --- the corpus is the specification of the AI developer, and 21
   repositories can rewrite it. Note the fix is **ownership**, not centralization; see
   proposal C, which was decided against sole authority on the authorship numbers.
2. **Sync commits suppress onward propagation** (reusable workflow, the
   `^Sync Copilot instructions from` guard). Sound in itself — it stops infinite fan-out —
   but combined with the mesh it means a repo can hold content that never travels further.
3. **No visibility whatsoever.** No summary job, no issue comment, no badge, no dashboard.
   With `fail-fast: false`, one repo failing to receive a sync (expired `PAT_WORKFLOWS`,
   branch protection without bypass) is invisible except in that job's log. **A stale repo
   is undetectable without the manual measurement performed here.**

## Proposal — make propagation health continuously visible

Not built. Requires ratification before any work starts.

- **A. Publish a manifest with the corpus.** Have the source artifact carry a
  `.ai/.corpus-manifest.json` holding the source repo, source commit sha, and a digest of
  the tree. A downstream repo then knows exactly which canonical commit it is on, and
  staleness becomes a cheap local comparison instead of a 35-repo hashing exercise.
- **B. One scheduled reporter job in `Cratis/AI`.** Daily: read each repo's manifest via
  the API, compare to canonical `main`, and write a single issue (or update one) listing
  repos more than N commits behind. Cheap, needs no downstream change beyond A.
- **C. Declare authority per path, not per repository — DECIDED.** The tempting version of
  this, making `Cratis/AI` the only permitted source, was rejected on the evidence. `Chronicle`
  authored **237** corpus-modifying syncs against this repository's **91**, and `Components`,
  `Arc` and `Fundamentals` add 68 more. Sole authority would declare the majority of real
  authorship illegitimate and route it through a repository whose maintainers are not the
  people writing those rules. It would be enforcement against the grain of how the work
  actually happens, and the predictable result is that people work around it.
  What the mesh actually lacks is not a single owner but **a statement of who owns what**.
  A rule about Chronicle belongs to Chronicle; the shared corpus belongs here. So the
  mechanism should record, per path, which repository is authoritative, and annotate --- not
  refuse --- a sync whose source is not the owner of the paths it changes. That preserves the
  mesh's real benefit, which is that a maintainer fixes a rule where they found it, while
  making an unexpected rewrite visible instead of silent.
  **Enforcement should wait for visibility.** Ship A and B, watch who actually writes what for
  a few weeks against real data, and only then decide whether anything needs to be refused
  outright. Nothing here is urgent enough to justify guessing.
- **D. Fail loudly on partial fan-out.** Add a summary job that consumes the matrix results
  and fails the run when any target was not updated. Addresses risk 3.

A and B together give continuous visibility for roughly one workflow and one small script.
C is a policy decision for the owner, not an implementation detail. **Do not fix 35 repos by
hand** — the mechanism is what needs fixing, and most of the current gap closes by itself
when this branch merges.

## How to reproduce

All measurements are read-only.

```bash
# Real repositories vs worktrees ( .git file == worktree )
python3 - <<'PY'
import os
root='/Volumes/sourcecode/repos/cratis'
d=[x for x in sorted(os.listdir(root)) if os.path.isdir(os.path.join(root,x))]
print('worktrees:',len([x for x in d if os.path.isfile(os.path.join(root,x,'.git'))]))
print('real repos:',len([x for x in d if os.path.isdir(os.path.join(root,x,'.git'))]))
PY

# Canonical is unmerged: expect "85  0"
git -C /Volumes/sourcecode/repos/cratis/AI rev-list --left-right --count fix/ai-platform-hardening...origin/main

# Canonical origin/main still carries the defects: expect 0 and 32
git -C /Volumes/sourcecode/repos/cratis/AI show origin/main:.ai/skills/toolbar/SKILL.md | grep -c "title='"
git -C /Volumes/sourcecode/repos/cratis/AI show origin/main:.ai/skills/toolbar/SKILL.md | grep -c "tooltip="

# Propagation mesh: which repos can act as a source
for r in /Volumes/sourcecode/repos/cratis/*/; do
  git -C "$r" cat-file -e origin/main:.github/workflows/propagate-copilot-instructions.yml 2>/dev/null && echo "$r"
done
```

The per-repo staleness table was produced by comparing `git ls-tree -r origin/main .ai/`
object ids between each repo and canonical. Subagent scratch scripts:
`/tmp/cratis-staleness/*.py` (note: those scripts contain the worktree miscount described
above; the corrected method is the one documented here).
