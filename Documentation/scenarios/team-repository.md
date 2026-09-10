# Scenario: team repository

A repository shared by several people (and possibly several tools), building
on Cratis.

## What you do

Beyond each person installing the plugin (see the
[harness guide](../harnesses.md)), the repository itself commits a three-file
contract that records what it means to be an AI-assisted Cratis project:

| File | What it carries |
| --- | --- |
| `.cratis/PROJECT.md` | Your project facts: what the product is, environments, local commands, conventions. Never credentials. |
| `.cratis/ai.json` | The neutral scope record: which `cratis/*` profiles this repository expects, at which exact version, for which harnesses. |
| `AGENTS.md` (+ a one-line `CLAUDE.md`) | The bootstrap every harness reads first; it points at `.cratis/PROJECT.md` rather than restating it. |

A `.cratis/ai.json` looks like this:

```json
{
  "schemaVersion": "1.0.0",
  "version": "1.0.0",
  "profiles": ["cratis/chronicle/kotlin"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

Name the profile after the narrowest true description of the repository —
`cratis/arc/csharp`, `cratis/chronicle`, `cratis/application` — every id and
its composition is listed in the [profile reference](../profile-reference.md).
`cratis/engineering` is the one maintainer-audience profile; it never mixes
with the public ones in the same subscription.

## What you get

- **Portability.** The contract is plain files any harness can read; nobody's
  editor settings are the source of truth.
- **Reviewability.** A new teammate (or a new AI tool) gets the same scope
  from the committed record, not from folklore.
- **Update readiness.** When versioned profile packages publish, a reviewed
  pull request that bumps the pin in `.cratis/ai.json` (and the host lock
  files) is the whole update; rollback is restoring the previous pin. See
  [updates and rollback](./updates-and-rollback.md).

## When you don't need this

A solo developer with one tool does not need the contract at all — the plugin
alone is enough (see [solo developer](./solo-developer.md)). If your team is
happy with the whole public bundle and no per-repository scope, the committed
files can wait until you actually want narrow scope or reviewed updates.

## Status

- The subscription file is the designed contract for the versioned flow. That
  flow — exact-version packages, update-bot pull requests — is **not published
  yet**; today skills arrive via the marketplace plugins that follow the
  `Cratis/AI` default branch, and committing `.cratis/ai.json` records the
  intended scope ahead of the first governed release.
- Everything ships as the supported `1.0.0` release.
