---
applyTo: "**/*"
paths:
  - "**/*"
---

# Verification Discipline

Verification answers whether changed behavior works. It does not establish who
authored a file or preserve a chain of evidence about how it arrived.

- Select specs, review and local checks by [criticality tier](./criticality-tiers.md).
- Run one bounded phase per command with its real exit status; stop on failure. Read **cratis-engineering-ci-gates** for deadlines, phase selection and diagnostic handling.
- **[contract] Never iterate through CI:** never push to see failures; reproduce relevant CI failures locally. Run applicable local gates before pushing; required product/integration CI still passes before merge. Integration may wait for CI only when repository policy permits and CI enforces it; call it deferred, never a local pass. Required coverage without local proof or enforced CI is unverified. On a shared machine cap parallelism, one heavy phase at once (`cratis-engineering-ci-gates`).
- Never use filtered build/test output or printed zero-error counts as gate evidence; preserve the producer's exit status and needed diagnostics in `.ai-work/`.
- Keep specs fast; follow [fast-feedback.md](./fast-feedback.md).
- Keep each check deterministic and runnable locally and in CI.
- Check output is evidence; checksums, inventories, receipts, ledgers, attestations,
  snapshots, escrow copies and provenance records cannot replace behavior checks.
  Do not produce these or ad-hoc `verify-*` scripts unless a repository workflow or
  the user asks.
- Report the conclusion and any real uncertainty in a line or two, not the
  audit trail. Show the output when asked, when a claim is contested, or when
  the check failed. Report failures and skipped checks honestly.
