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
binds a tier to a concrete model; the corpus does not. Bind it with a `model:` in a
project-level override of the agent: `.pi/agents/<name>.md` for Pi, `.claude/agents` for
Claude Code, and the agent override for OpenCode (`provider/model`). The Pi subagent
extension does not resolve a tier on its own yet.

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
