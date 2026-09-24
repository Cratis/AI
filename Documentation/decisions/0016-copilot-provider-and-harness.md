# 0016 - GitHub Copilot as a provider vendor and as a third agent harness

## Status

Accepted

## Context

The package has described two coding-agent harnesses since the harness images moved here
(decision 0010): Claude Code and Pi. GitHub now ships a terminal-native agentic CLI of its own,
`@github/copilot`, with a documented programmatic mode (`copilot -p`), MCP client support, and
authentication from an environment variable - the three things a worker container needs.

Direct asked for it from two directions (Cratis/Direct#1150, #1151): as a provider *vendor*, so an
organization that already pays for Copilot seats can fold that capacity into governed dispatch
instead of buying a second credential, and as a *harness*, so the work actually runs.

## Decision

- `AIProviderType` gains `Copilot = 7` - **appended, never renumbered**, the same enum-evolution
  discipline every other member here follows. It is an agent-harness provider: Copilot exposes no
  first-party conversational completion surface, so it gets no `IAIProviderClient` implementation and
  nothing in `LanguageModels` changes.
- `Harness` gains `Copilot = 2`, appended for the same reason.
- `Providers/Copilot/CopilotCredential` draws the one distinction that matters for a vendor with **no
  metered API key**: a credential is usable or it is not. Both shapes GitHub's own flows produce are
  accepted - a bare token in a documented GitHub token format, and an OAuth record carrying an
  `access` field. `refresh`/`expires` are treated as optional rather than required, because GitHub
  only issues them when the OAuth app has token expiration enabled; requiring them would refuse a
  perfectly good non-expiring token.
- `Dockerfile.copilot` publishes `cratis/ai-agents-copilot`, built `FROM` the same base as the other
  two, with the CLI pinned to a verified version and `COPILOT_AUTO_UPDATE=false` so the CLI cannot
  update itself out from under that pin mid-session.
- `entrypoint.sh` gains `run_copilot()` and - the delicate part - a real **three-way** selection on
  `DIRECT_HARNESS`. Before this, anything that was not exactly `"pi"` ran Claude Code, so
  `DIRECT_HARNESS=copilot` would have silently run the wrong agent with a credential minted for a
  different vendor. The selection is now a `case` with Claude Code as the default arm, and
  `for_entrypoint/copilot-harness-selection.sh` pins both directions: `copilot` reaches Copilot, and
  every near-miss (casing, whitespace, typos, `copilot-cli`) still lands on Claude Code.

## What the Copilot path deliberately does differently

Each of these is a property of the CLI, not an omission:

- **No steering channel.** `copilot -p` runs one prompt to completion and exits, and ignores piped
  stdin when `-p` is given. The FIFO/pipe-holder/feeder arrangement the other two need to keep a
  long-lived session's stdin open has nothing to hold open, so it is absent and stdin is closed
  explicitly.
- **No system-prompt flag.** Claude takes `--append-system-prompt-file`, Pi takes
  `--append-system-prompt`; Copilot takes neither, and its custom-instructions mechanism
  (`AGENTS.md`, `.github/copilot-instructions.md`) lives in the checkout - untrusted input this
  script must not write into. The reviewed AI profile prompt is prepended to the prompt instead.
- **No Headroom.** The compression proxy speaks the first-party Anthropic and OpenAI APIs; a Copilot
  session talks to GitHub's own endpoints, which it cannot forward. `DIRECT_HEADROOM` is honored by
  saying in the log that it does not apply, rather than by breaking the session.
- **Skills, yes; MCP, yes.** The vendored skills are installed at `~/.copilot/skills`, the CLI's own
  user-level skills location, so the same authored content works under this harness. The
  `report_progress` MCP server is the same script the Claude image ships, wired in with
  `--additional-mcp-config` - the highest-precedence source in the CLI's own merge order, so a
  checkout's `.mcp.json` cannot displace it.
- **Usage is thin, and says so.** Copilot meters premium requests, not tokens, and its JSONL stream
  is not a documented interface. Token totals are summed from whatever the stream carries and left at
  zero otherwise, with a line in the log stating that a zero here is an absence of measurement rather
  than a measurement of nothing. A consumer ranking providers by burn should treat a Copilot
  provider's totals accordingly.

## Consequences

- A product can dispatch to Copilot by setting `DIRECT_HARNESS=copilot` and handing the container
  `COPILOT_GITHUB_TOKEN` - the highest-precedence of the three variables the CLI reads, chosen so a
  container that also carries a `GH_TOKEN` for git operations cannot decide which account the agent
  reasons as.
- Copilot CLI's programmatic mode is the least battle-tested of the three for long unattended
  sessions. The image is published; whether a given organization's Copilot entitlement permits
  non-interactive automation is that organization's to confirm against its own agreement.
