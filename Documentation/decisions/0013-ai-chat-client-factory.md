# 0013 - AIChatClientFactory: the first real piece of the Conversational API

## Status

Accepted

## Context

Studio's own cutover to `Cratis.AI.Providers.Configuring` (PR #350, decision 0009) deleted Studio's
duplicate provider *commands*, but nothing about Studio's actual AI usage changed - Studio's
`Agent.ChatClient` still constructs `Microsoft.Extensions.AI.IChatClient` instances directly per
vendor, entirely bypassing the package. Unlike Direct's worker-runtime cutover, which changed real
behavior (Direct's own container launching now runs through `Cratis.AI.Workers`), Studio's provider
cutover was configuration-plumbing only - a fair criticism, and the reason this decision exists.

The plan's Section 5.4 (Conversational API) is the piece that would change that, and it is explicit
that this is "the largest single judgement call in the whole plan" - `ChatClient` is 8 partials with
~35 production files around it and heavy Studio-domain code (project/domain/event-model generation)
built on top. Attempting the full move in one sitting risks either a rushed, incomplete result or
running out of room mid-change with Studio's real conversational AI feature in a broken state.

## Decision

Ported the vendor-generic half of `ChatClient.CreateChatClientFor`/`ProviderReadiness` into
`Cratis.AI.Conversations.AIChatClientFactory` - not the whole Conversational API, one well-isolated
seam of it:

- `ResolveModelId`, `CanServe`, `Create` (the vendor SDK construction: `OpenAI.Chat.ChatClient`,
  `AnthropicClient`, endpoint normalization for Azure OpenAI and OpenAI-compatible gateways) - all of
  it operates on primitive values (`AIProviderType`, `AIProviderApiKey`, `AIProviderEndpoint`,
  `ModelName`), not a whole `ConfiguredAIProvider` read model, since Direct's and Studio's own shapes
  differ (decision 0009) and this needs to work against either without forcing one onto the other.
- Added `Microsoft.Extensions.AI`, `Microsoft.Extensions.AI.OpenAI`, `Anthropic` as real package
  dependencies of `Cratis.AI` (versions already centrally pinned, unused until now) - a genuinely new
  kind of dependency for this package, alongside (not replacing) the existing HTTP-protocol
  `IAIProviderClient` implementations.
- Deliberately did **not** move `Conversation/`, `Acting/`, `Mcp/`, the prompt files, or any of
  `ChatClient`'s other 7 partials, and did **not** attempt to route this factory's output back through
  `ProviderAwareLanguageModel`'s pool/tier/concurrency resolution - that reconciliation between the two
  resolution paths (completion-in/completion-out vs. an in-process multi-turn `IChatClient`) is real,
  separate, larger work the plan itself flags as the hard part of this step. This decision covers only
  the piece that removes duplicated, mechanical vendor-wiring code with zero behavior change risk to
  the 35 files built on top of `ChatClient` - they still get an `IChatClient` back through the same
  `ChatClientConfiguration` contract, unchanged.

## Consequences

- Studio's `ChatClient.CreateChatClientFor`/`ProviderReadiness` become thin callers of this factory
  instead of reimplementing vendor SDK construction locally - real behavior is unchanged (same vendor
  SDKs, same endpoint normalization, same defaults), but the logic itself is no longer duplicated.
- `Cratis.AI` now carries `Microsoft.Extensions.AI`/`OpenAI`/`Anthropic` as transitive dependencies for
  every consumer, including Direct, which does not use `AIChatClientFactory` at all yet. Accepted as
  the cost of sharing this logic rather than duplicating it a third time (Direct's own worker-dispatched
  agents have never needed an `IChatClient` and still do not); revisit if this ever becomes a real
  package-size or dependency-surface concern.
- The actual "run conversations through the package's pool/tier/concurrency resolution" reconciliation
  the plan calls the core technical work of this step is still open. This decision's scope is
  explicitly narrower than that, by design, not by oversight - see this file's own Context section for
  why attempting it in the same change was rejected.
- `AIProviderType.ZAI`/`AIProviderType.OpenAICodex` have no conversational client - `Create` returns
  `null` for both, since Z.ai and OpenAI Codex are agent-harness-only providers (see their own remarks
  on `AIProviderType`), not ones a caller opens an in-process chat session against.
