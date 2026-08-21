# Project-Owned Context Bootstrap Contract

**Status:** Fixture-tested design; not deployed
**Decision authority:** `Cratis/Workflows#68` for fleet rollout
**Canonical content:** `.cratis/PROJECT.md`

## Purpose

Project facts belong to the consuming repository. They must not be copied from
`Cratis/AI`, hidden inside a public skill, or merged automatically with another
project's content.

`.cratis/PROJECT.md` is the canonical content location. It is not an
instructions filename that the verified hosts discover automatically. A
recognized, project-owned bootstrap or an equivalent explicit managed
configuration is therefore required.

## Resolution contract

A context resolver follows this order:

1. read `.cratis/PROJECT.md` when it exists;
2. otherwise read legacy `.agents/PROJECT.md` as a migration fallback;
3. otherwise report a valid `no-context` state;
4. never concatenate the canonical and legacy files;
5. never write, replace, or delete either file.

When both files exist, `.cratis/PROJECT.md` wins. The legacy file remains
untouched until a later migration has separate, reviewed deletion evidence.

## Minimal bootstrap contract

For a repository whose canonical file exists, the smallest fallback is:

- root `AGENTS.md` for Copilot, Codex, Cursor, OpenCode, and Pi;
- root `CLAUDE.md` containing only `@.cratis/PROJECT.md` for Claude;
- root `GEMINI.md` containing only `@.cratis/PROJECT.md` for Gemini.

The `AGENTS.md` bootstrap only tells the host to read the selected project
context and not merge it with another context file. It contains no Cratis
architecture, coding, build, or quality-gate policy.

During legacy fallback, the same bootstrap forms point to
`.agents/PROJECT.md`. A managed or user configuration may replace a bootstrap
only when official host behavior proves equivalent discovery for the intended
scope.

## Ownership and safety

All four content and bootstrap locations are project-owned:

- `.cratis/PROJECT.md`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `GEMINI.md`.

Distribution tooling may propose missing bootstrap content, but it must not
create, overwrite, merge, or normalize these files automatically. An existing
bootstrap is reported as a conflict requiring project-maintainer review.

Shared package installation and removal must leave project-owned files
unchanged. Non-interactive and offline operation uses only repository files and
must not fetch a replacement context.

## Fixture evidence

`tooling/project-context-bootstrap.mjs` is a read-only resolver and planner.
Fixtures under `tooling/fixtures/project-context/` cover:

- an application with canonical context;
- a framework repository using the legacy fallback;
- both files, proving canonical precedence without combination;
- neither file, proving the valid no-context state;
- existing root bootstraps, proving they are reported and unchanged.

Run:

```bash
node --test tooling/specs/project-context-bootstrap.spec.mjs
```

These are sanitized fixtures only. No consuming repository is changed by this
foundation.

## Pilot gate

Fleet rollout remains blocked until one application and one framework pilot
prove every supported Tier 1 host discovers the intended project context. The
pilot must record host version, installation scope, bootstrap or managed
configuration used, offline behavior, update behavior, and rollback. Wrapper
retirement remains owned by Workflows and cannot occur from this repository
alone.
