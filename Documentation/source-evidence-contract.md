# Source evidence admission contract

The source evidence contract defines a fail-closed boundary for future
first-party repository evidence used only in offline evaluation.

## Current phase

The canonical registry is `CONTRACT_ONLY`: it has no admissions and no
revocations. All ten source-authority diagnostics cases remain disabled. The
loader returns only `NO_ADMITTED_SOURCE_EVIDENCE`, with no claims, paths, source
content, or proof.

Synthetic diagnostics profile fixtures are never source authority.

## Contract layers

Future evidence must keep these records separate and content-addressed:

1. metadata-only bundle;
2. product-owner attestation;
3. independent source revision verification;
4. metadata redaction review;
5. repository-controlled admission;
6. optional repository-controlled revocation.

A supplier cannot self-admit or self-revoke evidence. Hashes establish byte
identity, not product authority.

## Content policy

Version 1 stores no source body, excerpt, patch, sanitized derivative, arbitrary
product assertion, local checkout path, credential, personal owner detail, or
mutable branch/tag reference. Artifact descriptors contain only immutable
repository object metadata, digests, byte lengths, bounded locators, and
owner-approved display-path state.

## Activation boundary

Even a future `EVIDENCE_ACCEPTED` result grants no runtime use, effects,
network access, writes, packaging, publication, approval, promotion, or
diagnostics case activation. Every such change requires separate review.
