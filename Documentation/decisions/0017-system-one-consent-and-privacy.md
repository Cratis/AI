# 0017 - System One consent and privacy model for the Pi extension

## Status

Accepted

## Context

Cratis/AI#440 adds `cratis-system-one`, a Pi extension that asks a System One model (TypeSafe's hosted
Jev, another provider, or a local server such as Laya) whether each Cratis skill would help with the
user's prompt, and records the answer next to whether the model then read that skill. It is a
measurement: in shadow mode it changes nothing the model sees.

It is also the first corpus extension that sends the user's prompt text to a network service. The
corpus is distributed to many repositories, and `.cratis/ai.json` is committed, so it belongs to whoever
controls a repository, not to the person running the agent in it. A design that let the repository
configure the extension would let any repository take prompts, and credentials, from every contributor.

An early version of this design let a repository enable the extension with a loopback endpoint. It was
replaced before release for two reasons: it made setup a per-repository chore, and a loopback-only rule
still let the repository decide *that* prompts are processed. Measurements also changed the picture: a
local Laya, run without training, took 1.3 to 3.5 s per prompt for 70 skills and ranked them poorly, so
the hosted model is the realistic backend and consent has to be safe for a remote host.

## Decision

- **Enabling is a user decision, and only the user's.** It is stored in
  `<pi agent dir>/cratis-system-one.json` (Pi's `getAgentDir()`, so `PI_CODING_AGENT_DIR` is honored),
  written atomically with mode `0600` because it may hold a key. It records `consentedAt`.
- **`/system-one setup` is the consent flow.** It states exactly what is sent and to which endpoint,
  asks for confirmation, and probes that endpoint with one tiny request before saving. What is
  disclosed and probed is computed by the same resolution the extension uses at run time, so if
  `SYSTEMONE_ENDPOINT` overrides the user's choice, setup says so and names the endpoint that really
  receives data. Nothing is written before the confirmation. A failed probe saves only if the user
  insists. Without a UI it prints the manual steps to the terminal (stderr).
- **The repository can only opt out or narrow, and it fails closed.** The `systemOne` section of
  `.cratis/ai.json` accepts `{ "enabled": false }` and `{ "skillRelevance": { "mode": "off" } }`. It
  can never enable the extension, and can never set an endpoint, model, key or timeout. Any problem in
  that file (unreadable, not valid JSON, an unknown key, a wrong type, `enabled: true`) switches the
  extension off with one notice, because a file that may have been trying to opt out must not be read
  as silence. Consent resolution never throws.
- **The environment can restrict or tune, never enable.** `CRATIS_SYSTEM_ONE=0` and
  `CRATIS_SYSTEM_ONE_SKILL_RELEVANCE=off` restrict. `SYSTEMONE_ENDPOINT`, `SYSTEMONE_API_KEY` and
  `CRATIS_SYSTEM_ONE_MODEL` override, but only once the user file enables the extension. A globally
  exported key alone sends nothing.
- **Keys go only where the user pointed them.** Precedence is `SYSTEMONE_API_KEY`, then
  `TYPESAFE_API_KEY` (only for `https://api.typesafe.ai`), then the user file. Environment keys are
  never attached to any loopback endpoint, `http` or `https`; a local server gets a key only if the user
  stored one for that exact endpoint. Elsewhere, a key stored in the user file is bound to the origin it
  was stored for, so an environment override of the endpoint cannot carry it elsewhere. A non-loopback
  endpoint must be `https`; `http` is accepted only for `127.0.0.1`, `::1` and `localhost`. Redirects
  are refused, so a server cannot forward the prompt or key. The key never appears in status output,
  notices, session entries or the transcript, and a user file others can read is flagged once.
- **Silent until configured.** An unconfigured install produces no notices and makes no requests; only
  the `/system-one` command exists.
- **Only what a person types is judged.** A prompt is judged only when Pi says it was typed
  interactively (input source `interactive`) in a session with a UI, which excludes print and JSON
  modes and every subagent child process. Text another extension injects (source `extension`) may carry
  tool output or file contents, and an RPC host's prompt (source `rpc`) may be automated, so both are
  excluded, as is a turn with no input event. It is judged only in a repository set up with Cratis AI
  (`.cratis/ai.json` or `.cratis/ai.manifest.json`). Slash commands and skill or template invocations
  are not sent. Neither is text Pi wrapped around what was typed: `pi @file "..."` builds the first
  prompt as a `<file name="...">` block holding the file, then the typed text, and any prompt with a
  file block or whose text starts with `<` is skipped, as is one whose text another extension's `input`
  handler rewrote (it is judged only when it equals the typed text). File contents and tool output
  never are sent.
- **State is bounded and never persisted as text.** What is sent is the names and first sentence of the
  descriptions of the corpus skills Pi already loaded, and the first 1,200 characters of the prompt.
  Session entries hold skill names, probabilities, timings and which `SKILL.md` files were read, and no
  prompt text. There is no disk cache.
- **Advisory, and it fails open.** Per `capability-is-not-authority`, a score is evidence, not
  authorization. In shadow mode the extension returns no system prompt and no message. Requests run in
  the background so a prompt is never delayed, with a 5 s timeout, strict response validation and a
  circuit breaker that counts turns, honors `Retry-After` and probes with one request before resuming.
  Ending the session cancels running requests and records nothing afterwards. Handlers never throw.
- **Retention is the provider's.** The docs point users to the provider's terms
  (for TypeSafe, https://docs.typesafe.ai/legal) and do not make retention claims for it.

## Consequences

- Setup is one command, once per machine, instead of per repository. Every contributor makes their own
  choice and can see exactly what is sent before making it.
- A repository can protect its contributors (`enabled: false`) but cannot recruit them. Adding another
  repository-controlled setting to the extension would break this decision and needs a new one.
- The distributed extension has a network side, so its README is the contract for what leaves the
  machine and must change in the same commit as any change to what is sent.
- Promoting shadow scores to a hint in the conversation is a separate decision, gated on the measured
  data. If it is ever made it must go through a `before_agent_start` message, never `systemPrompt`,
  to keep the provider's prompt cache stable.
