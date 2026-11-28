---
name: cratis-arc-page-query
description: Use when a developer needs an Arc query to return one page of a larger result, with a total and a sort. Not for an unpaged list (use cratis-arc-expose-query).
compatibility: Requires an Arc backend with the read model and its storage already connected.
---

# Return one page of a query

Count the authorized matches and return one stable window of that same set. Apply a deterministic order before cutting the page; do not count or page the returned window again. Choose a finite query by default. Use a live page only when the provider supports it and the open page must reflect writes.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. Python has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

With three matching rows and one other, request a page size of two and then the next page, as the same caller and tenant, with the data unchanged. Expect two IDs, then the remaining one, none repeated, and a total of three on both. Save both response bodies and run `node scripts/check-pages.mjs first.json second.json id` from the skill directory to check for repeated IDs.

In the frontend, request another page through the generated proxy's paging API rather than slicing the returned array.

## Stop when

Some fields are hidden from the caller: refuse a sort on a hidden field before the rows are ordered, because the order reveals the field's ranking, and restrict the rows before they are counted.

## Related skills

- [Expose a live query](../cratis-arc-expose-query/SKILL.md) for the unpaged Authors list.
- [Connect MongoDB](../cratis-arc-connect-storage/SKILL.md)
- [Display the list](../cratis-components-display-list/SKILL.md)
