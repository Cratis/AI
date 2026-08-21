# Autonomous redesign execution baseline

**Recorded:** 2026-08-20T23:14:07Z
**Repository:** `Cratis/AI`
**Purpose:** Durable Phase 0 worktree and authority evidence

This directory preserves the fresh baseline captured before the autonomous
redesign changed repository content. It is repository-only evidence and must
never enter a public runtime artifact or package.

## Repository state

- branch: `main`;
- HEAD and `origin/main`: `b795d5307e20f7f7458a67708b4f26975e223796`;
- divergence: zero ahead and zero behind;
- staged paths: zero;
- unstaged tracked paths: five;
- untracked paths: 271, of which 214 were `.pi` runtime artifacts and 57 were
  redesign deliverables;
- ignored paths: 150;
- changed paths with SHA-256 records: 276;
- worktrees at capture: one (`main`).

The SHA-256 digest of the complete `changed-path-sha256.tsv` file is
`d12cce35b17bf8135e5afa7d1b4593c3b48bc897a7c131335856443a52a3ed60`.
The digest after excluding `.pi/**` records is
`a605ee2735c7f5a256152f3bab6df9e85137c479b76f289c65d5f356bb9a9998`.

## Protected tracked files

| Path | SHA-256 |
| --- | --- |
| `.ai/hooks/agent-stop.md` | `6e7dfe33c9600a83989dfd9bacdb5473f9980c07bc4fcb8fb0083bdd63d18c6a` |
| `.ai/hooks/pre-commit.md` | `66c8576c47f560a78b41d6a17782a08e891b79f7048577c29cbb5d5da6d7cc05` |
| `.ai/hooks/scripts/validate-ai-setup.sh` | `f9d6bdffe0571ac7aa6ad5800f9d0c8811560e256dcb32225ada7a919fd13c7f` |
| `.gitignore` | `935d04efd7e11bb25d292216d586547e9db972d70cb01dc3151c217f39dcbe19` |
| `Documentation/index.md` | `4c99b605de94afacf09401cb6c696934580f3e220b9f7bafd00f2011498651ab` |

These files remain protected and are not part of the isolated redesign branch.

## Files

- `repository.tsv`, `status-short.txt`, and the diff/status files record branch,
  upstream, divergence, and staged/unstaged state.
- `untracked-paths.txt` and `ignored-paths.txt` record every path visible at the
  baseline.
- `changed-path-sha256.tsv` records SHA-256, file kind, and relative path for
  every pre-existing changed path.
- `worktrees.txt` and `branches.txt` record local repository topology.
- `authority/*.json` stores authenticated read-only snapshots of the four
  required GitHub authority issues after Option A+ was recorded.

The `.pi` entries named in these records remain runtime evidence, not repository
policy. No `.pi` content is copied into this evidence directory.
