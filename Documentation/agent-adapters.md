---
title: Agent adapters
description: Preserve canonical agent instructions and tool restrictions across harness loaders.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Agent definitions live in `.cratis/ai/agents/`. Harness adapters preserve their
instructions while expressing tool restrictions in the vocabulary each loader
understands. Edit the canonical agent, not its generated adapter.

| Harness | Agent source |
| --- | --- |
| Claude Code, Cursor, Copilot | Canonical agent files through harness links |
| Pi | Generated files in `.cratis/ai/harnesses/pi/agents/`, exposed through `.pi/agents` |
| OpenCode | Generated files in `.cratis/ai/harnesses/opencode/agents/`, exposed through `.opencode/agents` |

## Pi tool restrictions

Pi adapters preserve the canonical metadata and body, replacing `tools:` with a
comma-separated Pi-native allowlist. For example, `Read, Grep, Glob, Bash, Edit,
Write` becomes `read, grep, find, bash, edit, write`. Both the Cratis `subagent`
extension and an external `Agent` loader can consume that list without losing
the agent's file and shell tools.

Generation uses the same tool-name map as the Cratis runtime loader. Known
non-built-in names such as `Agent` are omitted; an unknown name fails generation
and names the agent and tool. Generation also refuses a list with no resolvable
Pi tools, rather than allowing a loader to interpret it as unrestricted access.

## Model tier and provider independence

Canonical agents never pin a native `model:`. A model id is not portable across harnesses
and goes stale, and generation refuses an agent that carries one. Each agent declares a
`modelTier` instead:

- `scoped`: the default tier for a scoped change.
- `strongest`: needs a stated reason in the agent body.
- `reviewer`: the reviewer tier. Reviewer agents also declare
  `reviewIndependence: different-provider`, so the review runs on a different provider
  than the author where the harness can select one (see `review-reports.md`).

Corpus verification fails an agent without a valid `modelTier`. The harness or product
binds a tier to a concrete model; the corpus does not. Other harnesses bind models through
their own overrides: `.claude/agents` for Claude Code and the agent override for OpenCode
(`provider/model`). External Pi loaders follow their own model-selection rules.

### Cratis Pi subagent configuration

The Cratis `subagent` extension resolves models in this order:

1. An explicit `model:` in a user or project agent override (for example,
   `.pi/agents/<name>.md`). This wins even when unavailable or on the author's provider.
2. The agent's `modelTier` in your user-owned `<getAgentDir()>/cratis-models.json`
   (normally `~/.pi/agent/cratis-models.json`; Pi's agent-directory override also applies).
3. The dispatching session's model when no tier candidate is available.

For example, using illustrative provider/model names rather than a model recommendation:

```json
{
  "schemaVersion": "1.0",
  "tiers": {
    "scoped": "provider-a/small-model",
    "strongest": "provider-a/large-model",
    "reviewer": ["provider-b/review-model", "provider-a/review-model"]
  }
}
```

Each tier accepts a string or an ordered list of `provider/id` candidates. Tier candidates
are filtered using Pi's available models. For `reviewIndependence: different-provider`,
the first available candidate whose provider differs from the dispatching session wins.
Provider identity is the prefix before the first slash. An explicit `model:` is never
replaced by tier resolution.

If independence is impossible, the reviewer still runs on the first available tier
candidate, or on the session model if none is available. The result is marked
`single-provider` and includes a visible warning that the review is **not independent**.
An explicit same-provider reviewer override gets the same warning. Warnings appear in
tool output in single, chain and parallel modes, and once per dispatch in an interactive
session. Only ordinary session-model inheritance carries the session's thinking level;
explicit selections, tier selections and reviewer fallbacks do not.

Keep this optional configuration in your user agent directory, not in the corpus or
`.cratis/ai.json`: it reflects your model access and cost choices. It survives repository
`cratis ai install` updates, which manage repository files, not this user-owned file.
Missing configuration preserves session-model inheritance; reviewers still warn when not
independent. Invalid JSON, unsupported schema versions (only `1.x` is supported), invalid
known-tier mappings and files larger than 64 KiB are ignored with a dispatch warning.
Unknown tier keys are ignored.

The `@cratis/pi` package declares its generated agent directory through
`pi.subagents.agents` for external loaders that support package resources.
The Cratis extension still yields when an external `Agent` tool is present.
Package agents are defaults: project and user agents can override them according
to the external loader's precedence. See the [Pi package guide](../Source/Pi.Plugin/README.md).

## Regenerate after editing

From this repository with workspace dependencies installed, run
`yarn workspace @cratis/harness-setup run setup`. Commit the generated files and
any changed integration links with the canonical change.

`yarn workspace @cratis/harness-setup run check` checks adapter drift without
writing files. Missing, stale and orphaned files fail the check. Setup regenerates
marked outputs but refuses unowned occupied paths unless explicitly forced.

Managed CLI installations need a CLI that points `.pi/agents` at the generated
directory. CLI v3.76.0 still points at canonical agents, so updating the corpus
alone does not repair external-loader tool restrictions in that channel.
