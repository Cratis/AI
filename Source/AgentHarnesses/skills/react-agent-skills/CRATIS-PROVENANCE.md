# Provenance

This `react-agent-skills/` directory is vendored from an upstream open-source project,
with the bounded routing-description modifications below. The upstream guidance is not authored by Cratis.

- **Source:** https://github.com/thongdn-it/react-agent-skills
- **Pinned commit:** `22b5ec4e4a1077e213bcf368bb2b6ed26c91d8e9` (branch `master`)
- **License:** MIT (see `LICENSE` in this directory, copied verbatim from upstream)
- **Vendored for:** Cratis/Stagehand#118 - carrying React/UI-ecosystem Claude Skills into the
  worker images so Wright, Medic, Roadie and Bard (the job-mode agents) can draw on them for
  React/Next.js/Tailwind/testing work, the same way `.ai/skills/skill-creator` vendors an
  upstream Anthropic skill into this repository's own contributor corpus.

## Why vendored rather than fetched at container start

Static content baked into the image at build time (`COPY`), never fetched over the network when a
worker container starts - the existing convention for everything else provisioned into these images
(see `Dockerfile.claude`'s MCP servers and `Dockerfile.base`'s `entrypoint.sh`). A network fetch at
startup would make a worker's behavior depend on an upstream repository staying available and
unchanged for as long as this image is in use, and would need its own supply-chain review every time
it ran rather than once, at vendor time.

## Local routing-description modifications

The 18 shipped skills under `skills/` retain their upstream bodies, references, examples,
metadata, names, directories and license. Cratis changed only their frontmatter descriptions
to invocation conditions starting with `Use when`, with concise near-miss boundaries and
sibling names that exist in the shipped collection. Removed capability summaries remain
covered by the body introductions and reference categories. No upstream content was refreshed.

On a deliberate re-vendor, compare against the pinned commit above, preserve the upstream
license and review each description against the complete new body and nearest shipped sibling.
Reapply these routing-only changes explicitly; do not overwrite bodies with a bulk rewrite.
Run `Source/AgentHarnesses/verify-vendored-skills.sh` and the repository corpus/install gates.

## Where a worker sees this

`Dockerfile.claude` copies this directory's `skills/` folder into `/home/agent/.claude/skills/` -
Claude Code's user-level skills location, available regardless of which repository the worker
happens to be checked out to. This is deliberately not through `.ai/skills/` (this repository's own
AI-contributor corpus, which only reaches a worker when the work happens to be on Direct itself)
- these are skills for building things *with* Claude, not skills for working *on* Direct.

Not available in the Pi harness image (`Dockerfile.pi`): Pi is invoked with `--no-skills` because it
has no compatible skill-loading mechanism for this format (see the comment beside that flag in
`entrypoint.sh`). An agent seeded on the Pi harness (the default for a never-configured agent - see
`Direct.Agents.Seeding.DefaultAgentsSeeding`) does not see these skills until switched to the
Claude harness in Settings.
