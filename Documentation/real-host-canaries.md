# Real-host canary contracts

> **Audience:** Maintainers of Cratis/AI — canary lifecycle and evidence. Not required for adopting Cratis AI.

**Status:** Deny-by-default local fixture framework; no support promotion

## Why real-host evidence is separate

Static generation proves bytes and layout. It does not prove that an exact host
version installs, discovers, selects, updates, rolls back, or removes those
bytes. S9 records those phases independently and refuses to reinterpret older
static or compatibility observations as host evidence.

S9 belongs to the governed-support lane. A passive preview needs only a smaller
exact-artifact pack/install/discovery/uninstall smoke plus rollback; it cannot use
that basic signal to claim support. Teams can opt into S9 later when graduating a
preview to stable support or when executable/MCP behavior raises the risk.

The current framework is opt-in. Ordinary repository tests never execute a
detected host binary. Real execution requires both:

```text
CRATIS_S9_REAL_HOST_CANARY=1
--allow-real-host
```

The runner also requires an exact executable version, a disposable home and
consumer tree, forbidden credentials, and OS-enforced denied egress.

## Current matrix

| Host | Exact version | Current S9 status |
| --- | ---: | --- |
| Pi | 0.84.3 | Non-supporting denied-egress fixture install/list/remove passed; discovery, behavior, collision, update, and rollback blocked |
| Claude Code | 2.1.245 | Blocked: installed 2.1.235; no lifecycle command executed |
| Copilot CLI | 1.0.80 | Blocked: installed 1.0.67; no lifecycle command executed |
| Codex CLI | 0.149.1 | Blocked: installed 0.147.0; marketplace registration is not installation |
| Gemini CLI | 0.56.0 | Blocked: installed 0.33.1; no lifecycle command executed |

A missing executable and a version mismatch are explicit blocked outcomes, not
skips or passes.

## Required phases

Every report has a closed phase inventory:

1. preflight;
2. artifact validation;
3. negative baseline;
4. collision negative;
5. install;
6. discovery;
7. positive behavior;
8. negative behavior;
9. update;
10. rollback;
11. uninstall;
12. project-context preservation;
13. cleanup.

Blocked phases remain visible. Package or marketplace listing is not silently
called discovery. Reinstall or source replacement is not silently called update
or rollback.

## Isolation and preservation

The runner constructs an allowlisted environment rather than inheriting
`process.env`. API keys, OAuth tokens, proxies, cloud credentials, npm/GitHub
tokens, and host sessions are absent. On macOS the real lane uses
`sandbox-exec` with network denied.

The consumer snapshot includes bytes, modes, symlink targets, ignored content,
and empty directories outside `.git`, including:

- `.cratis/PROJECT.md`;
- `.agents/PROJECT.md`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `GEMINI.md`.

A passing context-preservation phase requires identical complete digests before
and after.

## Evidence boundary

The first Pi attempt was blocked before lifecycle execution because the initial
allowlisted PATH omitted its exact Node runtime. The second attempt passed but
is retained as superseded because its reported source revision predates the
uncommitted PATH correction used for that run. The third attempt uses committed
runner revision `1a9af3d`, Pi 0.84.3, and denied egress; fixture install,
package listing, removal, cleanup, and complete context preservation passed.

Denied-egress preflights also confirmed that locally installed Claude, Copilot,
Codex, and Gemini versions do not match the current matrix. Each stopped after
its version command; no lifecycle or marketplace command executed.

All reports use a synthetic local fixture, so every assertion is
non-supporting. The valid successful attempt is future-dated relative to the
current catalog `asOf` and remains inventory-only until that date is advanced by
review. It cannot establish
`install-tested`, behavior, lifecycle, release, marketplace availability,
runtime eligibility, publication, promotion, or support.

Future supporting evidence requires an immutable non-synthetic artifact,
current exact host version, complete phase transcripts, selected skill
path/digest for behavior, genuine host-managed update and rollback, collision
proof, and explicit reviewed admission. S10 uses a separate production lifecycle
schema; the S9 fixture report cannot be promoted by changing its labels.

## Report provenance and the host version pins

Every report declares who produced it (#262):

- `provenance: "runner"` — the runner emitted it, and its `caseId` must be one
  of the runner's own formats: `s9-<host>-local-fixture-<attemptId>` or
  `s9-<host>-version-preflight-<attemptId>`.
- `provenance: "hand"` — a human authored it; the report says so in its
  limitations, naming why the runner could not produce it. The four
  `version-preflight-blocked` reports from 2026-08-26 are the marked examples:
  they predate `--preflight-only`, which now makes that shape runner-produced.

**Pin refresh policy.** The host version pins in the canary matrix
(`distribution/real-host-canary-matrix.json`, mirrored in
`tooling/real-host-canary-contract.mjs`) are exact and reviewed; they are the
registry-latest values of the day they were pinned and drift by design as
hosts release. A pin change is a reviewed pull request that also re-runs the
preflight for that host (`node tooling/run-real-host-canary.mjs --host <id>
--output <path> --attempt-id <id> --preflight-only --allow-real-host`, with
`CRATIS_S9_REAL_HOST_CANARY=1`). The weekly governed audit reports each host's
current registry version against the pin as information — drift is a fact to
read, never a gate; the lane goes red only when a canary run actually observes
a mismatch, which is exactly what the preflight records.
