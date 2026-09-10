# Concepts — the words, mapped to what you know

Cratis AI is a plugin bundle for your AI coding tool. Most of its vocabulary
is just a careful name for something you already know from plugin ecosystems.

| Thing you know | Cratis word | What it is here |
| --- | --- | --- |
| A plugin | **profile** | A named selection of skills under the `cratis/` namespace — `cratis/chronicle`, `cratis/arc/csharp`. The marketplace plugin `cratis` carries every public profile; a profile is how a repository narrows that to exactly what its stack needs. |
| A skill | **skill** | The same thing: a passive `SKILL.md` (plus references and assets) your assistant loads when a task matches. No hooks, no executable code. |
| Your dependency manifest | **subscription** (`.cratis/ai.json`) | The committed, project-owned record of which profiles the repository expects, at which exact version, for which harnesses — the `package.json`-style pin the versioned flow updates by reviewed pull request. |
| Your project README section | **project context** (`.cratis/PROJECT.md`) | Your project facts — what it is, environments, commands, conventions. The shared profiles never own these; your repository does. |
| A release channel | **channel** | Derived, not declared: `cratis/engineering` is the maintainer channel, every other `cratis/*` id is the public channel. A subscription may deliberately mix the two (documentation plus an engineering cell); a mixed selection derives no channel. |
| The plugin marketplace | **marketplace** | The `Cratis/AI` repository itself, added as a marketplace source. Its manifests resolve the real `skills/` and `engineering/` directories on the default branch — there is no separate store. |

One paragraph each, in the order you meet them:

- A **profile** is just a bundle declaration. Install the plugin and you get
  every public one; subscribe in `.cratis/ai.json` when a repository needs a
  narrower, reviewable scope.
- A **skill** never executes anything. It is guidance your model reads — the
  same bytes in every harness.
- A **subscription** belongs to the consuming repository, never to a package.
  Packages may read it; nothing may write it for you.
- **Project context** is where your facts live so shared skills can stay
  generic. Keep credentials out of it, always.
- A **channel** answers "who is this guidance for": everyone (`public`) or
  Cratis maintainers (`cratis-engineering`). The namespace tells you which —
  no governance vocabulary needed.

For the complete id list and composition rules, see the
[profile reference](./profile-reference.md). For install commands per host,
see the [harness guide](./harnesses.md).
