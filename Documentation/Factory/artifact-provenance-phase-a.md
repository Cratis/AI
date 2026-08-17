# Issue 64 Phase A — deterministic artifact provenance

Phase A establishes the version 2 data boundary needed before an agent can be
given repository or prior-phase content. It is deliberately an integrity-only
foundation. It neither creates nor trusts runtime authority.

## Implemented checkpoint

The strict Draft 2020-12 contracts in [`Contracts/v2`](../../Contracts/v2/)
define:

- content-addressed artifact descriptors with exact byte length, media type,
  schema-closure hash, and classification;
- immutable-store receipt claims bound to a run and security domain;
- sanitizer attestations bound to the source and delivered descriptors, exact
  ruleset, allowlist, provider policy, run, attempt, and harness request;
- provenance sources for submitted requests, preflight values, and prior-phase
  output;
- a signed-shape run input set and phase result receipt; and
- a strict agent context containing only repository mode, exact profile/skill/
  capability references, and the selected workflow/phase/purpose/agent route.

[`artifact_provenance.py`](../../Factory/scripts/artifact_provenance.py) uses
`*_integrity_only` names intentionally. It verifies canonical self-hashes,
artifact hash/reference equality, exact schema closure, nested descriptor
references, run/attempt/security-domain bindings, and same-run prior-phase
provenance. It generates agent context by explicit field projection from a
self-addressed resolved profile and checks that the route is present in the
trusted workflow definitions and resolution. Evidence, dependency discoveries,
versions of application dependencies, rationales, warnings, remotes, manifest
content, paths, URLs, customer identifiers, and free-form prose are not in that
projection.

The examples in [`Contracts/v2/examples`](../../Contracts/v2/examples/) form
one canonical valid chain. Cross-runtime hashes are pinned in
[`canonical-vectors.json`](../../Factory/Fixtures/Contracts/v2/canonical-vectors.json).
The foundation validator discovers and registers both v1 and v2 schemas. It
does not reinterpret or upgrade v1 documents.

## Integrity is not authority

The `authority` fields reserve a closed interoperable signature shape, but the
Phase A code does not issue a signature, validate a key, authenticate an issuer,
confirm a store write, retrieve an artifact, or attest that sanitization
actually ran. The all-`A` signatures in examples are conspicuously non-trusted
test values. Passing local integrity verification means only that the supplied
documents and bytes are internally consistent with the supplied trusted schema
set and expected bindings.

The following remain blocked for a later authority slice:

- broker authentication, authorization, nonce/replay ledger, and run state;
- an immutable CAS/object-store implementation and durable retention receipts;
- sanitizer isolation, provider policy decisions, key management, and trusted
  signature verification;
- worker/provider selection, credential minting, materialization, dispatch, and
  time-of-check/time-of-use protection; and
- compiler, v1 harness request, Pi, Planner, Studio, and existing `cratis` CLI
  migration or wiring.

No Phase A artifact may be dispatched merely because an integrity-only helper
accepted it. A future broker must rebind every descriptor and receipt to its
authenticated run, security domain, attempt, current policy, trusted issuer,
and immutable store before releasing content or capabilities.

## Deterministic failure semantics

The library raises `IntegrityOnlyFailure` with machine-stable structural or
binding diagnostics. Schema violations, missing trusted schemas, canonical hash
mismatch, descriptor/reference mismatch, schema-closure drift, extra context
fields, unresolved routes, and cross-run or cross-domain substitution all fail
closed. Public human/machine operation envelopes are intentionally deferred
until an authority-owning command exists; Phase A adds no executable command.

