# Cratis skill-authoring contract

**Status:** Active authoring gate; not a runtime capability

## Purpose

Cratis skills are authored from authoritative product sources, reviewed target
metadata, and explicit evidence. Existing skill bodies, generated catalog views,
third-party prompt text, runtime packages, and model memory are not authority.

The machine-readable contract is
[`catalog/v2/authoring-contracts.json`](../catalog/v2/authoring-contracts.json).
The catalog validator fails when its clean-room, evidence, payload, or ownership
requirements weaken.

## Clean-room workflow

1. Freeze every researched source URL, immutable revision, license, and reviewed
   path.
2. Record requirement-level lessons without preserving source wording,
   headings, sequence, examples, templates, personas, or scripts.
3. Verify product claims against the owning Cratis product or client repository.
4. Draft from Cratis terminology, values, artifacts, and scenarios.
5. Keep one capability and one trigger intent. State realistic near misses and
   collision targets.
6. Distinguish framework contracts, Cratis conventions, and downstream product
   policy.
7. Give each step observable completion evidence and honest blocked, skipped, or
   inconclusive outcomes.
8. Run behavior, positive-trigger, negative-trigger, collision, security,
   portability, and product-source review.
9. Run phrase and structural-similarity review. Redesign substantial similarity
   rather than treating an open-source license as product approval.
10. Approve an exact source revision and content digest only after every gate
    passes.

## Allowed output

A future approved public skill may contain:

- `SKILL.md` with `name` and `description` frontmatter;
- linked, non-executable `references/**`;
- approved, non-executable `assets/**`;
- required license or notice files.

Public runtime payloads do not contain evals, scripts, rules, agents, prompts,
hooks, tooling, project facts, private facts, or unlinked resources. Creating a
runtime skill remains a separate reviewed delivery; this authoring contract does
not generate one.

## Human catalog

The human catalog is generated from metadata for navigation. It includes
candidates and visibly reports unclassified, unapproved, and runtime-ineligible
states. Generated views cannot become evidence, source authority, an authoring
input, or a runtime payload.

Run:

```bash
node tooling/generate-human-catalog.mjs
node tooling/generate-human-catalog.mjs --check
```

The generator is deterministic, bounded, and offline. It writes complete
partial files, publishes data files without removing the live directory, and
atomically replaces `manifest.json` last as the activation pointer. Readers
validate manifest hashes before trusting data. Its manifest hashes every
generated data or Markdown file and does not hash itself.
