# Cratis AI integration for Pi

This is the **plugin path** for repositories that do not use `cratis ai`.
Install it into a Pi project:

```bash
pi install -l npm:@cratis/pi
```

The package reads the repository's `.cratis/ai.json`, resolves its profiles and
languages through the packaged profile catalog, and contributes only the matching
skills. It also loads packaged rules, path guidance, prompts, agents, the
subagent tool, and Cratis quality hooks. When no `.cratis/ai.json` exists, it exposes the complete
packaged skill set. It therefore gives Pi the complete single-harness Cratis
experience without requiring the Cratis CLI.

The `subagent` tool stands down for the session when another extension already
provides a delegation tool named `Agent` (such as pi-subagents, which lists the
same agents). It removes itself from the active tools at session start and
shows one notice when Pi has a UI, so the model is not offered two delegation
tools.

The managed CLI path remains the choice when one repository must configure and
synchronize several harnesses. It writes the resolved corpus to `.cratis/ai`,
creates every harness integration, and records hashes for safe update and
uninstall. That managed setup loads rules through its own `.pi/extensions/cratis-rules`
and `.pi/extensions/cratis-path-guidance` extensions and does not require this package. If both paths are present, the package
yields to the managed installation to avoid duplicate resources and hooks. The Pi
package manages only Pi; it neither configures other harnesses nor owns a local
managed corpus.

## Path guidance and subagents

The packaged `cratis-path-guidance` extension attaches a path-scoped rule to the
tool result the first time a matching file is touched, and after a successful
`write` or `edit` adds one advisory line naming every skill whose `SKILL.md`
`cratis-hint-paths` frontmatter matches the file. (The key is Cratis-specific
because Claude Code gives a plain `paths` key its own meaning.) A skill is hinted at
most once per session and not when it is already in context: read (a shell command
counts only when `cat`, `sed`, `head`, `tail`, `less`, `bat`, `rg` or `grep` opens
its `SKILL.md` or a file under `references/`), preloaded by pi-subagents, or
expanded by `/skill:name`. A pi-subagents header without the skill's text (its
loader cannot read a symlinked `.pi/skills`) does not count as preloaded. The
skills considered are the ones Pi loaded plus the skills the repository selected
(`.cratis/ai.json`), so a session whose Pi skill list holds only personal skills,
or none (for example `skills: false`), still gets hints; an unselected skill is
never hinted, and none is added if the selection cannot be resolved. Rules follow
the same language and documentation selection as the system prompt. Nothing is
blocked and the system prompt is untouched. The system prompt carries only the
universal rules, so path-scoped rules are not delivered twice. The extension works
in sessions without a UI. It stands down when a managed installation
(`.cratis/ai.manifest.json`) already delivers path guidance: through its own
`.pi/extensions/cratis-path-guidance`, or through any `.pi/extensions/cratis-rules`
that is not the current universal-only version, since every earlier version
delivers path-scoped rules itself. A `cratis-rules` that cannot be recognised
counts as one that delivers them.

The universal rules add about 26k tokens to every session. A pi-subagents agent
(`@tintinweb/pi-subagents`) with an `extensions:` allowlist loads only the
extensions it names, so it gets none of this package by default. Name the two
cheap extensions to give it path guidance and the write and store guards without
the universal rules:

```yaml
extensions: cratis-path-guidance, cratis-hooks
```

The `subagent` tool of this package starts a full `pi` process and loads every
extension.
