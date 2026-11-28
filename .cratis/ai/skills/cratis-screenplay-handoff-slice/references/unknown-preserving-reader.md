# Read newer minor versions without executing unknowns

Default to strict reading. Use unknown-preserving admission only when an intermediary needs to retain unfamiliar data. Choose one semantic-model major with a shipped frozen baseline and an inclusive minor range. Both wire versions must be in that range and the language and semantic versions must form a matching pair. Classify by the original wire pair, not the validated known projection. Registered pairs admit no additions; an unregistered minor admits unknown members only above the highest registered minor of that major.

Check canonical bytes and the full revision before admitting any content. Keep the original bytes, wire pair, revision and owner-scoped unknown diagnostics alongside the validated known projection. Preserve unknowns as opaque data for byte-identical re-emission; do not infer semantics inside them, execute them or rebuild the document from just the projection. Keep ordinal member ordering in opaque objects, array order, and the distinction between missing and null.

Refuse the entire document for invalid versions or missing baseline, noncanonical bytes (including non-NFC text or duplicate members), revision mismatch, an unknown discriminator or a dangling known reference. Refuse when any bound is exceeded: 8,388,608 input bytes, container depth 64, 64 unknowns per owner, 1,024 per document, or 1,048,576 unknown value bytes. Unknown names, including inside opaque objects, must match `[a-z][A-Za-z0-9]*` and be at most 64 characters. Do not truncate to pass admission.

Neither strict reading nor preservation grants trust, execution or rendering authority. Check the intended target's separate admission and report any degradation or refusal.
