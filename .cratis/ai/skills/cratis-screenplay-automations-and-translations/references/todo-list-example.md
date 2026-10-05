# Example: a todo-list automation

A complete model: a result opens a work item, a reaction invokes a command, the command's fact
closes the item. It binds on Screenplay 4.64.0 (`executableReady: true`); the cratis 3.27.1
bundled compiler (Screenplay 4.60.1) rejects the Automation slice at binding with PLAY0268. Versions: `cratis-screenplay-toolchain` `references/versions.md`.

The first spec lists the whole cascade (`then` names every new fact: `CoursePassed`, and
`CertificateSent` through the reaction), and `given clock` supplies the instant that
`$context.occurred` needs. The cratis 3.27.1 bundled compiler reports a false PLAY0285 on that
cascade (cli#242), so the fence carries the standalone-compiler marker. These specs were not
run (V4: not run, no route); the expectations follow the v4.64.0 reference semantics.

What the model proves and what it does not:

- Proven by the model: one `CertificateSent` per enrolment (`unique event`), the queue opening
  and closing, a gated `RecordCompletion` that refuses non-coordinators.
- Not proven: that the certificate email reaches the person once. See
  `references/effects-and-idempotency.md`.
- The actor behind `SendCertificate` is a recorded security decision in the `Certification`
  module `description`, because reaction invocations carry no caller today (Screenplay#383).
- No local engine runs Automation specifications: report them as authored, not as run.

```screenplay
// Needs the standalone screenplay compiler (ESM v6)
// Todo-list automation. Shape: CoursePassed opens an item -> CertificateSender invokes
// SendCertificate -> CertificateSent closes the item. The once-only FACT is
// `unique event CertificateSent`; the external send is NOT proven once-only by this model.

domain Acme.Academy

concept EnrolmentId : Uuid

policy IsAuthenticated
  require authenticated
policy IsCoordinator
  require role "Coordinator"
persona Coordinator
  description "Records course results. Cannot: send certificates by hand"
  policy IsAuthenticated
  policy IsCoordinator

module Courses
  authorize IsAuthenticated
  feature Results
    authorize IsCoordinator
    slice StateChange RecordCompletion
      command RecordCompletion
        enrolmentId EnrolmentId identifier
        passed      Bool
        produces when passed == true
          CoursePassed
            for enrolmentId
            enrolmentId = enrolmentId          // copied on purpose: the reaction selects it as a value
        produces when passed == false
          CourseFailed
            for enrolmentId
      event CoursePassed
        enrolmentId EnrolmentId
      event CourseFailed
      constraint OneResultPerEnrolment
        unique event CoursePassed
        unique event CourseFailed
      specification RecordingAPass
        given caller
          authenticated
          role "Coordinator"
        given clock "2026-10-05T08:00:00Z"
        when RecordCompletion
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          passed      = true
        then CoursePassed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then CertificateSent
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          sentAt = "2026-10-05T08:00:00Z"
      specification RefusingANonCoordinator
        given caller
          authenticated
          role "Learner"
        when RecordCompletion
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          passed      = true
        then denied
      specification RecordingAFail
        given caller
          authenticated
          role "Coordinator"
        when RecordCompletion
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          passed      = false
        then CourseFailed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"

module Certification
  description "Trusted background boundary. No persona or screen issues SendCertificate; only the CertificateSender reaction invokes it, and reaction invocations carry no caller. Leaving the command ungated is a SECURITY DECISION, accepted only because: (1) it appends a fact keyed to one enrolment, (2) a repeat is rejected by IssueOnce, (3) the realization must not expose it to external callers (requirement to verify in the target). If (3) cannot hold, gate it with a service-actor policy and record the capability gap instead (reaction invocations carry no caller: Screenplay#383)."
  feature Certificates
    slice StateView CertificatesToSend
      description "Work queue: membership means 'still to send'; there is no status flag"
      readmodel PendingCertificate
        enrolmentId EnrolmentId
        completedAt DateTime
      query PendingCertificateById => PendingCertificate optional
        by enrolmentId EnrolmentId
      projection CertificatesToSend => PendingCertificate
        from CoursePassed
          enrolmentId = $eventSourceId
          completedAt = $eventContext.occurred
        remove with CertificateSent
      specification OpeningAnItem
        given CoursePassed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then query PendingCertificateById
          arguments
            enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          result
            enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
      specification ClosingAnItem
        given CoursePassed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        when append CertificateSent
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          sentAt = "2026-10-05T08:00:00Z"
        then no readmodel PendingCertificate for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
      specification NotQueueingAFail
        when append CourseFailed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then no readmodel PendingCertificate for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"

    slice StateChange SendCertificate
      description "Realization sends the certificate with idempotency key = enrolment id, then appends"
      command SendCertificate
        enrolmentId EnrolmentId identifier
        produces CertificateSent
          for enrolmentId
          sentAt = $context.occurred
      event CertificateSent
        sentAt DateTime
      constraint IssueOnce
        unique event CertificateSent
      specification SendingACertificate
        given clock "2026-10-05T08:00:00Z"
        when SendCertificate
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then CertificateSent
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          sentAt = "2026-10-05T08:00:00Z"
      specification RefusingASecondSend
        given CertificateSent
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          sentAt = "2026-10-05T08:00:00Z"
        when SendCertificate
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then error "Constraint 'IssueOnce' is violated: the event source already has the constrained event."

    slice Automation SendCertificates
      reaction CertificateSender
        description "Sends a certificate for every passed course; ends at CertificateSent"
        when CoursePassed
          enrolmentId
          invokes SendCertificate
            enrolmentId = enrolmentId
      specification SendingAfterAPass
        given clock "2026-10-05T08:00:00Z"
        when append CoursePassed
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          enrolmentId = "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
        then CertificateSent
          for "0d3b9e2a-6c4f-4f1e-8b7a-5e2d1c3b4a01"
          sentAt = "2026-10-05T08:00:00Z"
```

## Design-only additions

Two things a real queue often wants do not bind on 4.64.0 and stay out of the complete model
above: a list query (the visible queue) and a retry sweep that reads the whole view. Both parse
(V1) and report PLAY0268 at binding; durable per-item fan-out is outside the language
(Screenplay#286). Keep them in the model only when the document is the deliverable and say so
in the verdict.

```screenplay excerpt
// Parent: the complete document above, slice StateView CertificatesToSend.
query PendingCertificates => PendingCertificate[]
```

```screenplay excerpt
// Parent: the complete document above, slice Automation SendCertificates, after CertificateSender.
// The sweep reads the whole view (a clock trigger takes no `by`); iterating items needs code.
reaction CertificateRetrySweep
  description "Retries items still pending; per-item fan-out needs code today (#286)"
  every 15 minutes
    reads PendingCertificate
    file Reactions/RetryPendingCertificates.cs
```

`reads` documents what a trigger consults; it never protects (a trigger with `reads` that
`produces` directly fails binding: decide in a command instead).
