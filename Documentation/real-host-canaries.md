# Real-host canary contracts

**Status:** Deny-by-default local fixture framework; no support promotion

## Why real-host evidence is separate

Static generation proves bytes and layout. It does not prove that an exact host
version installs, discovers, selects, updates, rolls back, or removes those
bytes. S9 records those phases independently and refuses to reinterpret older
static or compatibility observations as host evidence.

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
| Pi | 0.84.3 | Local fixture install/list/remove contract available |
| Claude Code | 2.1.245 | Blocked until hardened lifecycle argv is reviewed |
| Copilot CLI | 1.0.80 | Blocked; update/rollback argv unverified |
| Codex CLI | 0.149.1 | Marketplace registration is not installation |
| Gemini CLI | 0.56.0 | Blocked until exact executable and lifecycle are available |

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

The initial Pi run uses a synthetic local fixture, so every phase is
non-supporting even when install and removal pass. It cannot establish
`install-tested`, behavior, lifecycle, release, marketplace availability,
runtime eligibility, publication, promotion, or support.

Future supporting evidence requires an immutable non-synthetic artifact,
current exact host version, complete phase transcripts, selected skill
path/digest for behavior, genuine host-managed update and rollback, collision
proof, and explicit reviewed admission.
