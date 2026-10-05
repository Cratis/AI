# Opt-in evidence

The decision rule is in `SKILL.md` ("Decide the level first"). This file holds the evidence.

## Why an empty directory or an MCP entry is not opt-in
At cratis CLI `v3.27.1` the `cratis/screenplay` profile (and composed profiles such as Stage)
makes `cratis ai install`/`update` create the selected model directory, normally the corpus
default `.cratis/screenplay` (`Documentation/ai/index.md`: "Install/update creates the selected
empty model directory ... but does not start the server or create source files"), and register
a Screenplay MCP entry for it. Uninstall keeps the directory. Both therefore appear in every
repository that merely installed the language skills, so neither can signal consent.

## The explicit signal
`mcpServers.screenplay.root` in `.cratis/ai.json` is the project-owned property that overrides the
model directory (`Documentation/reference/screenplay-mcp.md` at `v3.27.1`: "The optional
project-owned `mcpServers` property in `.cratis/ai.json` overrides the model directory or
disables registration"; `AiConfiguration.McpServers`, read by `AiMcpDescriptor` as
`configuration.McpServers?.GetValueOrDefault(Id)?.Root ?? DefaultRoot`). Verify with
`git -C <cli checkout> show v3.27.1:Documentation/reference/screenplay-mcp.md`.

## Edge cases
- `.play` files only under `.ai-work/`, a docs folder or a sample: not under the root, so not opt-in.
- Acceptance is visible in the repository: the model root holds at least one `.play` file tracked
  by git (`git ls-files <root>` lists it). Committing a model under the root is the team's act of
  acceptance and opts the repository in. P6 recommends that the user commit once they accept.
- An untracked or uncommitted `.play` file under the root is a draft: it does not opt the
  repository in and is not a contract for code agents. The modeler writes drafts into the root
  as before; they stay drafts until committed. A local STATE.md alone proves nothing to another
  clone.
- An explicitly configured root (`mcpServers.screenplay.root`) that is empty still counts as
  opted in; rule (b) is independent of rule (a).
- Declined proposals: a team that wants a lasting "no model" answer writes it in its own
  repository instructions, never in managed corpus files.
