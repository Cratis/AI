<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

---
title: Anthropic credentials
description: Choose the correct transport for Console keys and Claude subscription tokens.
---

`Cratis.AI.Providers.Anthropic.AnthropicCredential` accepts revealed `AIProviderApiKey` values.
It removes whitespace introduced by pasted, wrapped terminal output before classifying or sending
an Anthropic credential. This applies to both previously stored and newly entered credentials.

| Method | Result |
| --- | --- |
| `Normalize(apiKey)` | An `AIProviderApiKey` without whitespace. Use this value when building worker secrets. |
| `IsOAuthToken(apiKey)` | Whether the normalized value starts with `sk-ant-oat`, using an ordinal prefix comparison. |
| `HeadersFor(apiKey)` | Normalized OAuth bearer authorization plus the OAuth beta header, or a normalized `x-api-key` header for a console key. |

Normalize only **after revealing** a protected value. Do not normalize ciphertext or apply this
Anthropic-specific rule to other providers' credential formats. An unset credential remains unset.
Normalization does not refresh an expired token, increase account quota, or guarantee authentication.

## Subscription transport and runtime

A setup token is not a Console API key. Subscription completions use the **unmodified official
Claude Code CLI**, not the Messages API with fabricated Claude Code identity headers.
`HeadersFor` is a credential-format helper, not permission to use a subscription against any
Anthropic endpoint. Model discovery still reports `ModelCatalogUnavailable` without a separate
key authorized for the Models API; CLI aliases are never recorded as a discovered catalog.

Install [official Claude Code](https://code.claude.com/docs/en/setup) in the environment that runs
`Cratis.AI`, including your container image. The `claude` executable must be on the service's
`PATH`, not merely installed on your developer workstation. Use a runtime supporting `--effort`,
`--output-format json`, `--strict-mcp-config`, `--no-session-persistence`, `--setting-sources`, and
`--disable-slash-commands`; confirm these against `claude --help`. Cratis.AI does not install or
update the CLI. A missing executable returns a failed completion, not an API fallback.

The runtime needs network access to Claude and permission to create and remove temporary
working directories and launch child processes. Each completion uses an empty working directory,
isolated configuration and home, no built-in tools, no MCP servers, and disabled hooks. The revealed
token is passed only in the child environment as `CLAUDE_CODE_OAUTH_TOKEN`, never in arguments.
Caller cancellation kills the child process tree. Do not log child environments or credentials.
Managed machine policy can still apply; use a dedicated service environment.

## Tier defaults without model discovery

`TierModelResolution.Resolve(ConfiguredAIProvider, ModelTier)` resolves an explicit tier mapping
first, then a discovered catalog. If neither names a model, **only** an Anthropic provider with a
revealed subscription token gets the [official CLI aliases](https://code.claude.com/docs/en/model-config#model-aliases):

| Tier | CLI alias |
| --- | --- |
| Fast | `haiku` |
| Balanced | `sonnet` |
| Powerful | `opus` |
| Premier | `opus` |

These are framework-owned transport defaults, not guessed versioned model IDs or an entitlement
claim. Powerful and Premier share Opus because there is no distinct fourth CLI family. Explicit
mappings win even if the account cannot use that model; failures stay visible. API-key providers
without mappings or a catalog still resolve to `ModelName.NotSet`. The older mapping/catalog-only
`Resolve` overload remains unchanged. Provider serving checks, pooled completions, and pooled chat
use the provider-aware overload, so subscription calls do not depend on a usage-reporting key.

## Conversational transport: `ClaudeCodeChatClient`

`AIChatClientFactory.Create` serves a Claude subscription token through
`Cratis.AI.Providers.Anthropic.ClaudeCodeChatClient` - a real `Microsoft.Extensions.AI.IChatClient`
built on the unmodified official Claude Code CLI, not the Messages API SDK (which rejects a
subscription token outright) and not a forged set of Claude Code identity headers on a raw
Messages request. `AIChatClientFactory.CanServe` returns `true` for a subscription token once a
model resolves, exactly as it does for a Console key. The conversational transport currently
requires Unix owner-only file creation; Windows is explicitly rejected rather than creating an
MCP credential file with unverified permissions.

Every call is one isolated `claude` child, in its own disposable temporary working directory,
running with:

```text
-p --output-format stream-json --verbose --include-partial-messages
--tools "" --strict-mcp-config --mcp-config <per-call config>
--permission-prompts none --disable-slash-commands --no-session-persistence
--setting-sources "" --settings {"disableAllHooks":true}
```

`--tools ""` removes every built-in tool (no shell, no file access); `--dangerously-skip-permissions`
is never used, because that flag would restore exactly the tools this configuration removes.
When the caller supplies `ChatOptions.Tools` and tool mode is not `None`, each turn also starts a fresh, loopback-only
[MCP](https://modelcontextprotocol.io) server (`ClaudeCodeMcpServer`, built on the .NET runtime's
own `HttpListener` - no new package dependency) exposing exactly those functions, named and
pre-approved through `--allowedTools mcp__cratis__*` so a headless run never blocks on a permission
prompt nobody can answer. A function still runs in this process, in the caller's own tenant and
service scope, invoked only when the CLI's own model decides to call it; the final answer returns
as ordinary text and usage - never a fabricated `FunctionCallContent`, because the tool loop has
already finished, inside the CLI, before `GetResponseAsync`/`GetStreamingResponseAsync` returns.

The server requires a random per-invocation bearer credential, compares it in constant time before
reading a body, and rejects every browser Origin. The credential is written to an owner-only
(0600) temporary MCP config file; only the file path enters argv. Requests are limited to 1 MiB
and eight concurrent requests, with a 30-second body-read deadline. Streamable-HTTP MCP versions
2025-03-26 and 2025-06-18 are supported; other initialization versions negotiate 2025-06-18.
Malformed argument shapes never invoke a function. Tool failures and vendor diagnostics use safe
messages rather than exposing exception text. Disposal cancels and drains active calls before the
caller's tenant scope can exit, including functions that ignore cancellation.

`ChatOptions.ModelId` overrides the configured model. JSON response schemas use `--json-schema`
and return `structured_output` rather than intermediary prose. Required/specific tool selection,
non-function tools, unsupported content types, and strict sampling/output limits are rejected.
`AIChatClientFactory` treats generic `Temperature` and `MaxOutputTokens` values as preferences,
normalizes them to CLI-controlled defaults, and lists them in response metadata under
`vendor_controlled_options`. **These are not enforced limits.** Other unsupported controls remain
errors. Construct `ClaudeCodeChatClient` directly when unsupported preferences must be rejected.

**History is replayed as a transcript, not resumed.** Claude Code's own session persistence
(`--session-id`/`--resume`/`--continue`) is the officially documented way to continue a
conversation across invocations, but it writes transcripts to disk under the CLI's own config
directory. This transport deliberately never does that: every turn gets a fresh, isolated temporary
directory, removed on normal completion or cancellation after the server drains. An abrupt host
crash can leave temporary files behind; use a private service account and a managed temporary
storage cleanup policy. Since `IChatClient` is stateless per call, the caller's full message history
is encoded as escaped JSON with roles, function names, arguments, call IDs and results inside one
prompt (see `ClaudeCodeTranscript`). **Textual history is not native vendor role history:** JSON
escaping preserves boundaries but does not enforce model trust or eliminate prompt injection.
System text uses the CLI system prompt; unsupported modalities are rejected rather than dropped. Feeding prior turns back through `--input-format stream-json` was deliberately not
used instead: its documented behavior is to execute each incoming message as a real turn, which
would re-run (and re-bill) every earlier turn on every call.

Cancelling a call kills the child's whole process tree and disposes the MCP listener. A turn that
ends without a `result` message, or whose `result` reports a failure (including the MCP server
never connecting), raises `ClaudeCodeConversationFailed` rather than returning a silently empty
answer. A nonzero child exit fails even after a success-shaped result. Streaming consumers may
already have observed partial text when a later failure is raised; they must not treat it as a
completed answer. Rate-limit and assistant API errors also fail the turn without raw diagnostics;
`ClaudeCodeConversationFailed.Kind` distinguishes rate limits from model-request failures.
A rate limit is a usage/capacity restriction, **not evidence of an invalid credential**; replacing
credentials does not restore exhausted quota.

When a turn uses native functions, retrying it can repeat writes even before the first text arrives.
`ClaudeCodeConversationFailed.FunctionInvocationAttempted` marks **any** actual caller function
invocation attempt, including one that throws or is still running when the child fails. The marker is
per turn and never cleared by a later tool outcome. `PooledChatClient` stops the pool on this marker
for both streaming and nonstreaming calls; a safe rate-limit reason and `Kind` remain intact rather
than being reclassified as credential failure. Before any function attempt, rate-limit failover
remains available. Connecting MCP, listing tools, and rejecting malformed arguments do not count as
function attempts. No empty “started” update is emitted to claim that tools have not run.

A stopped turn does not roll back tool effects or prove they completed. Reconcile unknown effects
before retrying manually; use idempotent functions where possible. Caller cancellation remains
cancellation, with its original exception/token, and call resources are drained and released.

Usage aggregates all reported models, keeps cache reads separate from cache creation, and uses
the vendor's reported stop reason and cost. The revealed token reaches the child only through `CLAUDE_CODE_OAUTH_TOKEN` in its
environment, never an argument, and nothing about the credential or the conversation is logged.

:::caution[Runtime compatibility and entitlement]
CLI availability, supported flags, subscription quota, and model entitlement are runtime
prerequisites. Validate them in your service environment before relying on this transport;
configuration readiness alone does not establish a successful conversation. Native function
execution has no rollback guarantee, so reconcile unknown effects before retrying a failed turn.
:::
