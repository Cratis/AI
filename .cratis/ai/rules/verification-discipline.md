---
applyTo: "**/*"
---

# Verification discipline

A claim is only as good as the signal behind it. Internal reasoning *plans* the work;
external signals *confirm* it. Every line is tagged **[contract]** (binding) or
**[convention]** (the house default) per the Three Levels of Authority in
[`general.md`](./general.md).

- **[contract] Signals beat confidence.** A build result, a test run, a lint pass, an
  observed behavior — never the model's own certainty — settles whether something works.
- **[contract] "Done" means confirmed against a signal observed this time.** A gate that
  passed before the change is not evidence about the change. Re-run it.
- **[contract] After a fix, re-run the gate that failed.** Do not argue yourself to
  green.
- **[contract] State the verdict of every claim** using the `verification.verdict` set in
  [`catalog/vocabulary.json`](../../catalog/vocabulary.json): `settled`,
  `claimed-unverified`, `open`, `not-applicable`, `indeterminate`.
- **[contract] Unknown is not pass.** `indeterminate` means the check ran and could not
  decide; it is never reported, summarized or rolled up as a pass.
- **[contract] A green build is not behavioral correctness.** Compilation proves it
  builds. Whether it does the right thing is what specs and exercising the software are
  for.
- **[contract] Name what you did not verify.** A report that lists only the checks that
  passed reads as if everything was checked.
- **[contract] Report with inspectable evidence** — the command, the file, the run — not
  a paraphrase of it.
- **[convention] Prefer the narrowest signal that would actually fail.** A broad suite
  that cannot distinguish this change from any other is weak evidence, however green.
- **[convention] A signal that cannot fail proves nothing** — see
  [`guards-and-fuses.md`](./guards-and-fuses.md).
