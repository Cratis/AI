# Audit format

Use after any reaction, capture or translation was added or changed, and at the end of a review.
Enumerate every affected declaration with its location; name any scope you did not review. A
result is complete, open or blocked, never "looks fine". The exhaustive enumeration is the
technique: partial work stays visible and nothing is skipped because it looked redundant.

## Per automation (reaction)
| Declaration | Location | Trigger inputs traced | Condition | Effect and actor | Pending lifecycle | Repetition scope | Closing paths | Named cases | Result |
|---|---|---|---|---|---|---|---|---|---|

Result is `complete` only when every column is filled or says why it does not apply (for example
"direct effect: immediate, internal, cannot fail"). `open` names the unresolved decision and who
answers. `blocked` names the capability gap (for example Screenplay#383 for the actor, or a
list query that does not bind) with the intended behaviour.

## Per translation (capture or translator reaction)
| Source and type | Location | Correlation | Field dispositions | Target fields traced | Dedup and ordering | Trust boundary | Recovery owner | Named cases | Result |
|---|---|---|---|---|---|---|---|---|---|

## Filled example (from `todo-list-example.md`)
| Declaration | Check | Result |
|---|---|---|
| `CertificateSender` | trigger `CoursePassed` selects `enrolmentId`; `invokes SendCertificate`; actor recorded as an internal command not exposed (target requirement); repeat absorbed by `IssueOnce` | complete |
| queue `CertificatesToSend` | opens on `CoursePassed`, closes on `CertificateSent`; cancellation or supersession: none in scope (stated); specs open and close | complete |
| `CertificateRetrySweep` | reads the whole view; per-item fan-out needs code (Screenplay#286) | blocked |
| external send once | not provable in the model; idempotency key = enrolment id is a target requirement | open (owner: realization) |
| Unreviewed | `RecordCompletion` denial for a non-coordinator is specified; query authorization not in scope | stated |

Then the verdict line per `cratis-screenplay-toolchain`: tool and version on each of V1 to V4
(V4 for these slices: "not run: no route").
