---
name: cratis-platform-diagnose-slice
description: Use when a slice outcome is missing or stale and the failing boundary is unknown. Not for a confirmed correct stored row and stale live view (use cratis-arc-diagnose-live-query) or a confirmed observer failure (use cratis-chronicle-inspect-observer).
compatibility: Chronicle diagnostics below use the Cratis CLI 3.154.2.
---

# Find the first boundary that lost the update

Start with an existing request, not another write. Record the caller, command outcome, expected row key and request time. If the command was refused, inspect its authorization or validation result; a refused command isn't projection lag.

## Inspect the running Chronicle, read-only

Use read access to the intended server. Confirm the endpoint in the active CLI context or have the secret provider supply `CHRONICLE_CONNECTION_STRING`. An environment value overrides the context; without either, the CLI falls back to localhost. Never put credentials in shell history or diagnostic output. Use the application's tenant-to-namespace mapping; a tenant name need not be its Chronicle namespace.

```sh
cratis chronicle event-stores list
```

If unreachable, check the endpoint, credentials and network before interpreting missing data. Choose the actual store from the result. The following shell variables illustrate a Library deployment; replace their values with the store, namespace, event source and observer from this request:

```sh
store=library
cratis chronicle namespaces list -e "$store"
ns=Default
source_id='the-requested-author-id'
cratis chronicle events tail -e "$store" -n "$ns" --event-source-id "$source_id" --event-type AuthorRegistered
cratis chronicle observers list -e "$store" -n "$ns"
observer='the-registered-projection-id'
cratis chronicle observers show "$observer" -e "$store" -n "$ns"
cratis chronicle failed-partitions list --observer "$observer" -e "$store" -n "$ns"
```

If a command isn't present, inspect `cratis chronicle --help` and the relevant group's `--help`. A failed or unauthorized read is unknown, not an empty result. Inspect only authorized records; retain identifiers, not raw payloads.

1. The filtered tail gives the latest matching event log position, not the payload or proof that this request wrote it. A successful tail of `18446744073709551615` means no match, not a log position. Otherwise, match the position to the original append if known. If the write is still ambiguous and event content is restricted, ask an authorized operator to confirm the match and return only the permitted position or outcome. Don't run `events get` and redact it afterward. When authorized to read event content, `cratis chronicle events get -e "$store" -n "$ns" --event-source-id "$source_id" --event-type AuthorRegistered` can distinguish repeated registrations. If no match is confirmed, verify scope before investigating the write.
2. Compare the projection's last handled position **in that same store, namespace and sequence**. For a write at 12 and a checkpoint at 11, check observer state and failed partitions for this key. A checkpoint at 12 is not proof that the intended row exists. Inspect the observer (`cratis-chronicle-inspect-observer` skill) if the observer reports a failure. Don't reset, replay or retry partitions during diagnosis.
3. Run `cratis chronicle read-models list -e "$store" -n "$ns"`. For a queryable model, run `cratis chronicle read-models get "$model" "$row_key" -e "$store" -n "$ns"`, setting `model` to its listed **Identifier** and `row_key` to the expected projection key. For client-owned state, query the owning application instead; the CLI cannot retrieve it. Rerun the application query as the same caller and tenant. For the example observable `AllAuthors` query, GET the route from its generated proxy with `waitForFirstResult=true` and look for the exact ID in the first ready result. A pending response isn't evidence of an empty list. A missing stored row suggests mapping or key selection; a stored row excluded by the query suggests scope or filtering.
4. Only if the fresh query includes the ID, [inspect the live subscription](../cratis-arc-diagnose-live-query/SKILL.md) and rendered list. Distinguish an update never delivered to this client from an update received but not rendered. Record the first expected observation that was absent.
