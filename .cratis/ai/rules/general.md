# Working with Cratis

## Know which work this is

- **Application**: the repository builds a product on Cratis. Arc exposes commands for intent and queries for reads. Chronicle stores events as facts and builds read models from them. Components renders the UI, and generated Arc proxies connect it to the backend.
- **Platform**: the repository is Arc, Chronicle, Components, Fundamentals, Specifications or another Cratis library or tool. Keep its existing structure and published contracts. Do not shape a library as an application slice.

## Implement the contract a caller can observe

- Start from the behavior the caller should see, and implement the smallest contract that delivers it.
- Choose a skill by the task at hand. Check its nearest exclusion, and load a linked skill only when the work reaches that boundary.
- Examples yield to repository facts and installed package versions.
- Fix incorrect behavior within the requested change; report unrelated defects separately.
- Treat generated output as output: change the owning contract and regenerate.
- Existing code or local instructions do not override corpus conventions. Only an accepted decision record naming the rule it replaces can do so, and it never relaxes security, framework or API contracts, or gates.
- Settle a reversible choice from the repository's own evidence and report it. Ask only a necessary question, as one bounded question with a recommendation.

## Approval is not execution

Accepting a model, plan or review does not authorize rendering, applying, deploying or changing a running system. Ask explicitly before acting, sending repository data to a hosted service, changing MCP configuration or forcing a render over edited files.

Use Screenplay when `.cratis/ai.json` sets `mcpServers.screenplay.root`, the application already has `.play` source anywhere, or the user requests Screenplay or Stage. An MCP entry, profile or empty directory alone is not opt-in. If `.cratis/ai.json` sets `modelFirst.frozen: true` (optional `reason`), committed `.play` files are generated evidence. Edit or regenerate them only when the request names the path or model; skip them in generic regeneration and report it. When frozen or not opted in, work code-first from accepted examples.

## Protect tenants, data and secrets

- Never trust identity or tenant scope supplied by the caller. Enforce access on the server, including for live queries.
- Keep credentials and personal data out of code, examples, logs and diagnostics.
- Never print or copy a credential into the conversation, a note or a command. Ask for the one non-secret field you need and refer to a secret by name. If a value appears, stop, do not repeat it, and have it rotated.
- Do not reset, replay or delete shared state to make a check pass.
- Before a destructive or bulk change, show the exact targets and the way to recover. Act only on explicit authority for that change, then reread the resulting state.

## Retrieve remote content

- Fetch exact CI logs, artifacts or API JSON with `curl -LsS`. Capture the body separately from `--write-out '%{http_code}'`; record curl's exit code before filtering. Use page-fetch tools for rendered summaries. Keep credentials, authorization headers and signed URL queries out of commands, transcripts, logs and artifacts.

## Verify what can go wrong

- Verify consequential decisions, transformations and failures. Do not verify passthrough, getters or the framework itself.
- Call the decision directly unless framework behavior such as binding, validation, authorization or projection is in question; then exercise it through the framework. Never do both for the same decision.
- As a planning default, a behavior-neutral change needs no new case, a fix usually needs one regression case, and a small change needs one to three. Explain more than five cases or any new hosted test. These defaults never limit coverage of security, migration or replay, deterministic failure, redaction or resource limits.
## Report what actually ran

State each command and its outcome. Distinguish source inspection, compilation, model acceptance and execution. Name the checks that did not run.

Preserve shared history: integrate with merge commits and undo with revert; do not rebase, squash, amend or force-push.
