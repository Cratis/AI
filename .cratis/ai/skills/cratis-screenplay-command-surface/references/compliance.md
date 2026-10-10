<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Personal data, secrets and processing purposes

## Contents

- Classify the value on its concept
- Declare the use separately
- Identify the person, not the stream

Authority: Screenplay v4.127.0 `concepts.md`, `purposes.md`, `events.md` and
`diagnostics.md`; decision 0041. These declarations do not establish lawful
processing or enforce retention. Check provider support separately.

## Classify the value on its concept

```screenplay
concept Email : String pii
  pii reason "Contact address"
concept MedicalNote : String personal
  personal special health
concept ConvictionNote : String pii
  pii criminal
concept PartnerApiKey : String secret
  secret scope namespace
  secret reason "Credential for the partner API"
```

`personal` is an alias of `pii`, not a second classification; canonical printing
writes `pii`. Write one marker. `pii personal`, `pii pii`, `secret secret` and
`@pii @pii` report one PLAY0653 warning per header. Both compilers retain the
first occurrence of each marker and attach body settings to it. The concept-line
repair removes later tokens with `PreserveTrivia`, retaining notes and comments.

`@pii`, `sensitive` and `@sensitive` still compile but are deprecated: one PLAY0565
information diagnostic per line. The line/document repair migrates them to bare
`pii`/`secret` without moving notes. `--warnaserror` does not fail on information.
Unknown markers report PLAY0566. Never remove protection to get a model to bind.

A reason is an optional free-text note about the value, not a lawful basis,
purpose or retention policy. At most one reason per declared marker; a reason for
an absent marker is an error. Classification is inherited through concept uses,
including fields nested in composite types; do not put markers on properties or
composite types.

`pii special` requires one of `racialOrEthnicOrigin`, `politicalOpinions`,
`religiousOrPhilosophicalBeliefs`, `tradeUnionMembership`, `genetic`, `biometric`,
`health`, `sexLifeOrSexualOrientation` (GDPR Art. 9(1)). `pii criminal` records
Art. 10 data and may coexist with `special`. These qualifiers require `pii`;
unknown categories and repeated `special` lines are errors (PLAY0570/0571).
A photograph alone is not biometric identification data.

`secret scope` accepts `subject`, `namespace`, `global`; omitted scope retains
Chronicle's Subject default. Scope on `pii`, duplicate scope and unknown values
are errors (PLAY0567/0568). Explicit scope on `pii secret` warns (PLAY0569),
because only `[PII]` renders. Changing scope for persisted event uses requires a
new event generation.

C# provider mapping: `pii` → `[PII]`; `secret` → `[Encrypted]` + `[NotAudited]`;
`pii secret` → `[PII]` only (Chronicle refuses `[PII]` with `[Encrypted]`, CHR0053).
This mapping is not admission: either marker, including qualifiers and scopes,
still blocks executable binding with PLAY0268. Subject lineage is a different
role, described below.

## Declare the use separately

```screenplay
concept ContactName : String pii
  pii reason "Identifies the customer's contact"
purpose Billing
  description "Issue invoices and collect payment"
  basis contract
  subjects customer, customerContact
  retention "Until the customer relationship ends"
  recipient "Payment provider"
module Finance
  purpose Billing
  feature Invoices
    slice StateChange RecordContact
      command RecordContact
        name ContactName
```

A top-level `purpose` has optional singleton `description`, `basis` (optional
quoted legal reference), `interest`, `condition` (optional quoted reference),
`authorization`, `subjects` (comma-separated categories), `retention`, and
`erasure exception`; `recipient` and `transfer "<destination>" safeguard
"<safeguard>" repeat. Text fields are quoted; description also accepts a text
fence. Unknown closed values or repeated singleton fields are errors.

- `basis`: `consent`, `contract`, `legalObligation`, `vitalInterests`, `publicTask`,
  `legitimateInterests` (Art. 6(1)). The last needs a nonblank `interest` statement;
  inconsistent interest/basis warns (PLAY0601).
- `condition`: `explicitConsent`, `employmentLaw`, `vitalInterests`, `notForProfit`,
  `madePublic`, `legalClaims`, `substantialPublicInterest`, `healthCare`,
  `publicHealth`, `research` (Art. 9(2)).
- `erasure exception`: `expression`, `legalObligation`, `publicTask`,
  `publicHealth`, `archiving`, `legalClaims` (Art. 17(3)).

Repeat `purpose <Name>` on modules, features or slices. Coverage is the **union**
of those references and ancestors' references, unlike authorization's AND rule.
Unresolved references warn (PLAY0600). Purpose metadata adds no ESM bytes and
reports PLAY0270; it does not implement consent, a legal hold or crypto-shredding.

Run `screenplay <root> --check purposes --warnaserror`: PLAY0602–0606 prompt for
uncovered personal data (including nested concepts), missing special-category
conditions, criminal authorization, bases and unused purposes. Ordinary compile
does not run this check. Findings are investigation prompts, never a legal verdict.

`screenplay report processing <root> --format markdown|json|csv` derives the
processing record; optional `--controller-name` and `--controller-contact` are
explicit inputs, never inferred. MCP `processing-record` returns revision-bound,
count/byte-bounded pages (`offset`, `expectedSourceRevision`); repeat controller
inputs across pages. Invalid source prevents reporting; binding is not required.
Opaque code/imports/runtime protections are not inferred. Zero purposes yields
zero rows, not compliance. Special/criminal data prompts a DPIA assessment, not a
claim of large-scale processing. An erasure exception with reachable `pii` flags
that per-subject crypto-shredding also destroys data kept for that purpose.
Move legal declarations out of old reasons by hand; repairs never guess them.

## Identify the person, not the stream

An event property may end in `subject`, last among modifiers (before `=` on an
inline mapping). Each generation may choose one mark independently:

```screenplay
concept CustomerId : Uuid
module Billing
  feature Contact
    slice StateChange ChangeContact
      event CustomerContactChanged
        customerId CustomerId subject
        note String
```

Required scalar `String`/`Uuid`, concepts over either, and Int-backed concepts
are allowed. Bare Int, optional/collection/composite values, enums, Decimal,
Bool and dates are refused. A `pii` or `secret` concept is refused because
`EventContext.Subject` is plaintext. Use a surrogate identity; an empty String
cannot be detected statically and Chronicle falls back to the event source.
Equal identity strings across entity kinds share one subject; favor Uuid.

PLAY0590–0595 cover multiple marks, invalid/protected types, wrong owner,
unsupported read-model marks and repeated/out-of-order modifiers. The mark is
report-only (PLAY0270): it changes no ESM bytes or runtime value and emits no
C# `[Subject]` yet. Without a supplied subject the runtime's
`$eventContext.subject` defaults to the event source. Do not promise propagation,
erasure, export or redaction from this declaration. MCP exposes `isSubject` and
event summaries' `subject.source` (`eventSource` or `property`).

The event data subject, `secret scope subject` (encryption scope), and policy
`matches subject` (the thing acted on, not the caller) are three different roles.
For actual Chronicle erasure and attributes, use `cratis-chronicle-compliance`.
