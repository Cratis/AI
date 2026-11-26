---
name: cratis-screenplay-edit-workspace
description: Use when editing a split .play model, proposing an AST change or recovering from stale workspace handles. Not for accepting modeled behavior (cratis-screenplay-accept-model).
---

# Change the revision that was reviewed

1. Use the `screenplay` MCP server's `open-workspace` and `read-workspace` on the authorized root. Read references/split-models.md when declarations span files. **Done:** record the composed model, touched document keys, identities and workspace revision; do not treat a line number as a handle.
2. Default to `propose-ast` with handles from that revision and node kinds from `syntax-schema`; request the smallest operation. **Done:** use `read-proposal` to inspect the server-produced proposal, including source changes, moved identities, diagnostics and semantic differences. An unrelated reprint or lost identity is a reason to reject it.
3. Only on explicit approval of this proposal for this workspace, use `apply`. Read references/stale-revision.md on any revision conflict. **Done:** either nothing changed or the new revision contains exactly the approved change and the full model compiles. Route the resulting model to [acceptance](../cratis-screenplay-accept-model/SKILL.md) for behavioral judgment.
4. In the isolated fixture run `screenplay ./model --warnaserror` and `node --test acceptance.test.mjs`. **Done:** both composed documents bind; changing the sibling document invalidates the old review snapshot. This offline contract check does not exercise a live MCP apply.
