# Model entity state and durable work separately

Use a top-level state machine for the state of one entity; its `follows` read model's key is the subject identity. Use a top-level workflow when a process must carry on across several steps, including a time or human wait. The `for` read model's key identifies the subject; one run of that workflow can be active per subject.

These excerpts assume a keyed `Invoice` read model, `InvoiceRegistered`, `InvoiceSent` and `InvoicePaid` facts on the invoice stream, `NotifyPaid`, `WriteOff` and `OfferPlan` commands, and a `Controller` persona. Supply every required fixture property in the actual model.

```play
statemachine InvoiceLifecycle
  follows Invoice
  state Draft initial
    on InvoiceSent -> Sent
  state Sent final

  specification SendingMovesToSent
    given InvoiceRegistered
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    when append InvoiceSent
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    then is Sent
```

```play
workflow Collect
  for Invoice
  trigger Sent on InvoiceSent
    -> Await
  wait Await for InvoicePaid expires after 7 days
    resumed -> Receipt
    expired -> Review
  approval Review by Controller expires after 1 day
    approved -> Write
    rejected -> Plan
    expired -> Plan
  action Receipt invokes NotifyPaid
  action Write invokes WriteOff
  action Plan invokes OfferPlan

  specification TheRunWaits
    given InvoiceRegistered
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    when append InvoiceSent
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    then waits at Await

  specification DeadlineSendsToReview
    given InvoiceRegistered
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    when append InvoiceSent
      for "9c858901-8a57-4791-81fe-4c455b099bc9"
    outcome Await expired
    then waits at Review
```

The language binds state transitions, workflow node outlets and subject identity. The reference runner compares transitions, suspensions and command invocations; `outcome` supplies a simulated wait or approval result, not elapsed time or a real response. For the deployed target separately prove its admission, storage, deadlines, approval authorization and command effects. Stage runtime approval support does not imply the Stage-rendered application exposes an approval surface; report an unsupported construct as a gap.
