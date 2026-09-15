# Provenance

This `react-agent-skills/` directory is vendored, unmodified, from an upstream open-source project -
not authored by Cratis.

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

## Why kept unmodified rather than re-authored

Each of the 19 skills under `skills/` is a substantial, curated body of React-ecosystem guidance
(references, checklists, examples) that would be expensive to reproduce faithfully and easy to
silently drift from upstream if hand-edited. Re-vendoring at a newer commit is a deliberate,
reviewable update to this directory and the pinned commit above; nothing in this tree should be
edited by hand.

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
