# Private repository AI overlays

A private repository uses public-safe Cratis product and engineering packages,
then keeps confidential and repository-specific behavior beside its source.
There is no centralized confidential Cratis AI package by default.

## Why localize private behavior

Repository-local ownership keeps secrets and rapidly changing implementation
facts close to their authority. It avoids a second synchronized corpus, broad
private package access, accidental public generation, and unclear ownership.

The `engineering-` package prefix identifies maintainers as its audience. It
does not imply confidentiality.

## Recommended layout

```text
AGENTS.md
.cratis/
├── PROJECT.md
└── ai.json
.agents/
└── skills/
    └── <repository-local-skill>/
        ├── SKILL.md
        └── references/
.pi/
└── settings.json
```

- `AGENTS.md` contains always-on repository policy and locates project context.
- `.cratis/PROJECT.md` contains repository-owned facts without credential values.
- `.cratis/ai.json` pins shared public-safe profiles.
- `.agents/skills` contains private local workflows.
- `.pi/settings.json` pins the matching Pi package and remains project-owned.

Hosts that do not discover `.agents/skills` may use thin repository-owned
adapters. Maintain one local skill body; do not copy it between host folders.

## What belongs locally

Keep these in the private repository:

- unreleased APIs and roadmap behavior;
- private architecture and implementation details;
- deployment topology and infrastructure identifiers;
- incident and recovery procedures;
- customer-specific behavior;
- private support workflows;
- repository-specific build, release, or security exceptions;
- directions for obtaining credentials through approved mechanisms.

Never place actual credential values in AI instructions, project context, skill
files, commits, generated artifacts, or model prompts.

## What belongs in shared Cratis AI

Upstream behavior when it is useful across repositories and can be expressed
without confidential facts:

- general Cratis API usage based on public/approved sources;
- Specification by Example philosophy;
- language and framework conventions;
- public-safe contribution, review, compatibility, and documentation workflows;
- profile composition and host adapters.

## Resolve conflicts

Apply guidance in this order:

1. security, legal, and organization policy;
2. repository-local `AGENTS.md` and `.cratis/PROJECT.md`;
3. repository-local private skills;
4. pinned shared product/engineering profiles;
5. general model knowledge.

A local rule may deliberately narrow shared behavior. It must not silently
weaken security, authorization, or required quality gates.

## Share an improvement safely

Use the complete [maintainer improvement workflow](./maintaining-shared-ai-behavior.md)
to move only reusable public-safe behavior through the canonical review and
release path.

1. Identify the reusable behavior separately from private facts.
2. Update authoritative product code/docs first when the behavior is a product
   fact.
3. Remove private repository names, URLs, environments, incidents, customers,
   credentials, and unreleased examples.
4. Prepare a transient no-effect shared-improvement proposal for `Cratis/AI`.
   Create or update an issue only through a separately accepted exact repository
   operation profile.
5. Include the originating private repository only when its existence and link
   may be disclosed; otherwise coordinate the immutable authority evidence with
   authorized maintainers.
6. Review public expression, licensing, privacy, originality, compatibility, and
   affected profiles.
7. Deliver it downstream only through a new immutable release.

Do not automate reverse synchronization from private repositories.

## Provider and tool policy

Package privacy and model-provider privacy are different concerns. Installing a
public-safe package does not publish repository content, but an agent may still
send context to its selected model provider or invoke networked tools.

A private repository should document:

- approved model providers and accounts;
- data retention and training policy;
- allowed network tools and MCP servers;
- telemetry policy;
- repository/tool trust requirements;
- confirmation requirements for remote writes and destructive actions.

Enforce those controls through organization and host configuration, not by
embedding credentials or relying only on a skill prompt.

## Example

See [`Documentation/examples/private-repository-overlay`](./examples/private-repository-overlay/README.md)
for a complete non-secret illustrative overlay.
