# Invoicing and dues: design-mode document for the stored-state rules

**Design mode, not binding-ready by design.** This document states the stored-state rules of the
invoicing example as the skill requires (`reads <View>` + `require ... message`, marked NOT
enforced in the slice `description`, target named). It compiles (V1, warnings as errors) but
does not bind at Screenplay 4.64.0: `reads` is PLAY0271 and `require` over a view is PLAY0268, so
no specification here runs (V3 blocked). Keep those lines: they state real intent and are never
replaced by prose. The runnable counterpart, which holds no stored-state rule, is
`invoicing-dues-example.md`; `scenario-examples.md` copies `ReversingAReceivedPayment` from here.

```screenplay
// Needs the standalone screenplay compiler (ESM v6)
// Scenario coverage design-mode example: stored-state rules of invoicing club dues (complete document).
// Design mode: `reads` is PLAY0271 and `require` over a view is PLAY0268 at binding, so this model
// compiles but is not executable; the specifications below do not run. The runnable counterpart
// is invoicing-dues-example.md.
// Target enforcement of every rule here: Arc [ProtectedDecision] with DecisionRead<T> (Arc v22.39.0
// or later, not in a Stage-rendered application), or a Chronicle DCB; Screenplay#129/#209.

concept InvoiceId : Uuid
concept MemberId : Uuid

policy IsAccounts
  require role "Accounts"

module Invoicing
  feature Dues
    authorize IsAccounts

    slice StateChange IssueInvoice
      description "Issues one invoice per invoice id (declared here so the rules below have an invoice to refer to)."
      command IssueInvoice
        invoiceId InvoiceId identifier
        member    MemberId
        amount    Decimal
        produces InvoiceIssued
          for invoiceId
          member = member
          amount = amount
      event InvoiceIssued
        member MemberId
        amount Decimal
      constraint IssueOnce
        unique event InvoiceIssued

    slice StateView OpenInvoices
      description "Todo list: membership means 'still to collect'. The rules below read it (it lags: an unguarded read is not protection)."
      readmodel OpenInvoice
        invoiceId InvoiceId
        member    MemberId
        amount    Decimal
      query OpenInvoiceById => OpenInvoice optional
        by invoiceId InvoiceId
      projection OpenInvoices => OpenInvoice
        from InvoiceIssued
          invoiceId = $eventSourceId
          member    = member
          amount    = amount
        remove with PaymentReceived
        remove with InvoiceVoided
        remove with InvoiceSettled
      event PaymentReceived

    slice StateView ReceivedPayments
      description "Which invoices have a received payment."
      readmodel ReceivedPayment
        invoiceId InvoiceId
      query ReceivedPaymentById => ReceivedPayment optional
        by invoiceId InvoiceId
      projection ReceivedPayments => ReceivedPayment
        from PaymentReceived
          invoiceId = $eventSourceId

    slice StateChange SettleOrVoidInvoice
      description "An invoice ends either settled or voided, never both (SettleOrVoid, enforced at append). NOT enforced in the model today: that the invoice exists and is still open (settling) and that only an open, unpaid invoice may be voided. Stated as `reads OpenInvoice` + `require` (PLAY0271/PLAY0268 at binding; Screenplay#129/#209). Target: Arc [ProtectedDecision] with DecisionRead, or a Chronicle DCB. Requirements to test in the target: settling an unknown invoice is rejected; voiding a paid invoice is rejected; voiding an open invoice succeeds."
      command SettleInvoice
        invoiceId InvoiceId identifier
        reads OpenInvoice as invoice by invoiceId   // stated intent, unprotected (PLAY0271 at binding)
        validate
          require invoice.amount > 0
            message "Only an open invoice can be settled"   // NOT enforced: the view lags (PLAY0268 at binding)
        produces InvoiceSettled
          for invoiceId
      command VoidInvoice
        invoiceId InvoiceId identifier
        reason    String
        reads OpenInvoice as invoice by invoiceId   // stated intent, unprotected (PLAY0271 at binding)
        validate
          require invoice.amount > 0
            message "Only an open, unpaid invoice can be voided"   // NOT enforced: the view lags (PLAY0268 at binding)
        produces InvoiceVoided
          for invoiceId
          reason = reason
      event InvoiceSettled
      event InvoiceVoided
        reason String
      constraint SettleOrVoid
        unique event InvoiceSettled
        unique event InvoiceVoided

      specification SettlingAnOpenInvoice
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when SettleInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then InvoiceSettled
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

      specification RejectingSettlementOfAnUnknownInvoice
        given caller
          authenticated
          role "Accounts"
        when SettleInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then error "Only an open invoice can be settled"

      specification RejectingTheVoidingOfAPaidInvoice
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        given PaymentReceived
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        when VoidInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason    = "Issued in error"
        then error "Only an open, unpaid invoice can be voided"

    slice StateChange ReversePayment
      description "Compensation for a received payment. NOT enforced in the model today: that a payment was received. Stated as `reads ReceivedPayment` + `require` (PLAY0271/PLAY0268 at binding). Target: a protected decision read of the payment (keyed by the invoice source id). RefundRequested is the request recorded by the reaction; it does not show a refund was delivered, and the gateway's own answer is a later external fact. Requirements to test in the target: reversing without a received payment is rejected; a correct reversal records PaymentReversed and RefundRequested."
      command ReversePayment
        invoiceId InvoiceId identifier
        amount    Decimal
        reads ReceivedPayment as payment by invoiceId   // stated intent, unprotected (PLAY0271 at binding)
        validate
          require payment.invoiceId == invoiceId
            message "A payment must have been received before it can be reversed"   // NOT enforced: the view lags (PLAY0268 at binding)
        produces PaymentReversed
          for invoiceId
          amount = amount
      event PaymentReversed
        amount Decimal

      specification ReversingAReceivedPayment
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        given PaymentReceived
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        when ReversePayment
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount    = 130
        then PaymentReversed
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount = 130
        then RefundRequested
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount = 130

      specification RejectingAReversalWithoutAReceivedPayment
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when ReversePayment
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount    = 130
        then error "A payment must have been received before it can be reversed"

    slice Automation RequestRefunds
      reaction RefundRequester
        description "Records a refund request for every reversed payment; ends at RefundRequested"
        when PaymentReversed
          amount
          produces RefundRequested
            amount = amount
      event RefundRequested
        amount Decimal

      specification RequestingARefundAfterAReversal
        when append PaymentReversed
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount = 130
        then RefundRequested
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          amount = 130
```
