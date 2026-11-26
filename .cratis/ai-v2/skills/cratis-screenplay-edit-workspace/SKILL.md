---
name: cratis-screenplay-edit-workspace
description: Use when editing a split .play model, proposing an AST change or recovering from a stale workspace revision or handle. Not for accepting modeled behavior (cratis-screenplay-accept-model).
compatibility: Requires the Screenplay MCP server and CLI.
---

# Edit against a workspace revision

**Requires:** Check `screenplay --version` and confirm the configured `screenplay` MCP server lists `open-workspace`. If either is unavailable, stop before mutation; a local compile cannot substitute for applying a reviewed proposal.

1. Open the authorized root with `open-workspace` and use `read-workspace`. Read references/split-models.md if declarations span files. For example, a sibling document can own the identity used by a command:

```screenplay
concept AuthorId : Uuid

eventsource AuthorHistory
  identifier AuthorId
```

   **Done:** record the composed documents, identities, handles and revision; a line number is not a handle.
2. Use `propose-ast` with handles from that revision and node kinds from `syntax-schema`. Inspect `read-proposal`. **Done:** the source changes, identities, diagnostics and semantic diff match the intended edit without unrelated reprints.
3. Use `apply` only with explicit approval of that proposal for that workspace. If the revision is stale, follow references/stale-revision.md; do not replay old handles. **Done:** either nothing changed or the new revision contains exactly the approved change.
4. Run `screenplay ./model` against the whole composed directory, not the edited file alone. **Done:** all sibling references bind and the compiler exits zero. Send the revision to [Decide whether the model is accepted](../cratis-screenplay-accept-model/SKILL.md) for behavioral judgment.
