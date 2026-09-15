# 0008 - Provider CRUD event ids match Direct's own implicit ones, not fresh guids

Status: Accepted - corrects decision 0007's choice of id, shipped and superseded the same day.
Related: decision 0007, decision 0002, decision 0006.

## Context

Decision 0007 pinned all 12 provider CRUD event types to freshly generated guids, reasoning that
"nothing has produced a real event through any of these 12 types yet." That was true of the
*package* in isolation - but false of what the pin was actually for: replacing Direct's own
pre-migration `Direct.AIProviders.Adding.AnthropicProviderAdded` (and eleven siblings) so Direct's
projections (`Resolving.ConfiguredAIProvider`, `Listing.AIProvider`) can read them instead.

Direct's own pre-migration types also use a bare `[EventType]` with no explicit id, which Chronicle
resolves to the CLR type name - `"AnthropicProviderAdded"`, literally. That is not a hypothetical:
Direct has real, already-stored production events under exactly that id, for every provider anyone
has ever configured. Pinning the package's replacement type to a *different* id (a fresh guid) would
not fix anything for Direct's actual cutover - it would silently orphan every one of those existing
events the moment Direct's own duplicate type is deleted and its projections start reading through
the package's type instead: the projection would look for `"b20a0d97-...-875e"` and find nothing,
because every event Direct has ever stored carries `"AnthropicProviderAdded"`.

## Decision

All 12 event type ids are the bare type name as a literal string - `"AnthropicProviderAdded"`,
`"OpenAIProviderAdded"`, `"AzureOpenAIProviderAdded"`, `"OpenAICompatibleProviderAdded"`,
`"ZAIProviderAdded"`, `"AIProviderRenamed"`, `"AIProviderRemoved"`,
`"AnthropicProviderReconfigured"`, `"OpenAIProviderReconfigured"`,
`"AzureOpenAIProviderReconfigured"`, `"OpenAICompatibleProviderReconfigured"`,
`"ZAIProviderReconfigured"` - exactly what Direct's own bare `[EventType]` already resolves each
same-named type to. Explicit rather than left to Chronicle's fallback (decision 0007's collision
concern still holds), but the *value* is chosen to match what already exists in Direct's real event
log, not a fresh identity.

This is still "pin once, never change" (decision 0002) - the value picked happens to equal what an
implicit resolution would already produce, which is the point: cutting Direct over to the package's
type does not change what a stored event's id means, only which assembly's CLR type reads it.

## Consequences

- Direct's actual cutover (deleting its own duplicate Adding/Reconfiguring/Renaming/Removing types
  for the vendors this package now covers, and pointing `Resolving.ConfiguredAIProvider`/
  `Listing.AIProvider` at the package's types instead) can proceed without an event-evolution
  procedure - there is no id change for Chronicle to reconcile, only a CLR type change, which a
  `[Passive]` or accumulating projection handles as an ordinary rebuild.
- **This id choice is specific to Direct's shape**, not a general policy for the package's future
  event types. A future event type with no real pre-existing production data anywhere (the normal
  case) should still get a fresh, meaningful id chosen once - decision 0007's actual standing rule
  (always pin explicitly, never rely on the type-name fallback) is unchanged. This record only
  narrows *which* value decision 0007 should have picked for events that are replacing something
  that already has a production identity.
- Studio's own equivalent events use different names and shapes entirely (`AnthropicModelConfigured`,
  not `AnthropicProviderAdded`) - this id choice says nothing about Studio's own eventual cutover,
  which needs its own separate mapping decision when that work starts.

## Alternatives rejected

- **Leaving decision 0007's fresh guids in place and writing an explicit event-evolution mapping**
  (decision 0002's scale-down/MongoDB-surgery procedure) to move Direct's stored events from the old
  string id to the new guid at cutover time. Rejected as needless process for a problem that does not
  need to exist - matching the id Direct already has achieves the same outcome (one event type, one
  reader) with no data-moving step required at all.
