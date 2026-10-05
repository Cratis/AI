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
- A draft produced in this session before the user accepts it does not opt the repository in.
- Declined proposals: a team that wants a lasting "no model" answer writes it in its own
  repository instructions, never in managed corpus files.
