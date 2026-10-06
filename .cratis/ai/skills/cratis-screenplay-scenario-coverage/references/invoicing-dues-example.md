# Invoicing and dues: worked example for the scenario-examples excerpts

Complete model (harbor club dues) holding every declaration the excerpts in
`scenario-examples.md` and `view-and-story-specs.md` rely on. Each of those excerpts is copied
verbatim from the fence below (names are the specification names). Read the header comment for
the compile and run status.

```screenplay
// Needs the standalone screenplay compiler (ESM v6)
// Scenario coverage worked example: invoicing club dues (complete document).
// Backs the excerpts in scenario-examples.md and view-and-story-specs.md: issue an invoice,
// request payment, an external gateway result captured and translated, a payment reversal that
// requests a refund, an open-invoices todo list family and an accumulating credit balance.
// Stored-state rules (the invoice must exist, a reversal needs a received payment) are NOT
// enforced in the model: they are target requirements recorded in the slice descriptions.
// The external payment outcome is a fact (PaymentGatewayResultReceived); a refund request is a
// fact of intent, never proof that money moved.

concept InvoiceId : Uuid
concept MemberId : Uuid
concept GatewayOutcome : Enum
  captured
  declined

policy IsAccounts
  require role "Accounts"

module Invoicing
  feature Dues
    authorize IsAccounts

    slice StateChange IssueInvoice
      description "Issues one invoice per invoice id. IssueOnce refuses a retried issue with the same id. Why an amount above zero: a zero invoice cannot be collected or voided meaningfully."
      command IssueInvoice
        invoiceId InvoiceId identifier
        member    MemberId
        amount    Decimal
        validate
          amount > 0 message "An invoice needs an amount above zero"
        produces InvoiceIssued
          for invoiceId
          member = member
          amount = amount
      event InvoiceIssued
        member MemberId
        amount Decimal
      constraint IssueOnce
        unique event InvoiceIssued

      specification IssuingAnInvoice
        given caller
          authenticated
          role "Accounts"
        when IssueInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member    = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount    = 130
        then InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130

      specification RejectingAnInvoiceWithoutAnAmount
        given caller
          authenticated
          role "Accounts"
        when IssueInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member    = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount    = 0
        then error "An invoice needs an amount above zero"

      specification RefusingACallerWithoutTheAccountsRole
        given caller
          authenticated
        when IssueInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member    = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount    = 130
        then denied

    slice StateChange SettleOrVoidInvoice
      description "An invoice ends either settled or voided, never both: SettleOrVoid declares the exclusivity per invoice. NOT enforced in the model: that the invoice exists, and that a void is only for an unpaid invoice (target: Arc [ProtectedDecision] with DecisionRead, or a Chronicle DCB)."
      command SettleInvoice
        invoiceId InvoiceId identifier
        produces InvoiceSettled
          for invoiceId
      command VoidInvoice
        invoiceId InvoiceId identifier
        reason    String
        produces InvoiceVoided
          for invoiceId
          reason = reason
      event InvoiceSettled
      event InvoiceVoided
        reason String
      constraint SettleOrVoid
        unique event InvoiceSettled
        unique event InvoiceVoided

      specification RejectingSettlementOfAVoidedInvoice
        given caller
          authenticated
          role "Accounts"
        given InvoiceVoided
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason = "Issued in error"
        when SettleInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then error "Constraint 'SettleOrVoid' is violated: the event source already has the constrained event."

      specification RejectingTheVoidingOfASettledInvoice
        given caller
          authenticated
          role "Accounts"
        given InvoiceSettled
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        when VoidInvoice
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason    = "Issued in error"
        then error "Constraint 'SettleOrVoid' is violated: the event source already has the constrained event."

    slice StateChange RequestPayment
      description "Starts a payment attempt. PaymentRequested says only that we asked the gateway; it is NOT the outcome. The outcome arrives later as an external fact (slice PaymentGatewayResults). A request may be repeated after a decline, so there is deliberately no once-only constraint here."
      command RequestPayment
        invoiceId InvoiceId identifier
        produces PaymentRequested
          for invoiceId
      event PaymentRequested

      specification RequestingPayment
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when RequestPayment
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then PaymentRequested
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

      specification RetryingPaymentAfterADecline
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        given PaymentRequested
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        given PaymentDeclined
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason = "Card declined"
        when RequestPayment
          invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then PaymentRequested
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

    slice Translate PaymentGatewayResults
      description "Per external field: reference -> correlation key (our invoice id, echoed by the gateway); outcome -> translated to our enum; reason -> kept; cardholder -> ignored (personal data, no consumer). Authenticity of the webhook is a target requirement, not in the model. PaymentReceived and PaymentDeclined are OUR facts; PaymentGatewayResultReceived is the provider's."
      capture PaymentGatewayResults
        source webhook
          path /webhooks/payments/results
        key reference
        map
          outcome = outcome translate
            "C" => captured
            "D" => declined
        append PaymentGatewayResultReceived
          when outcome
            outcome = $.outcome
            reason  = $.reason
      reaction ReceivedTranslator
        when PaymentGatewayResultReceived
          outcome
          produces PaymentReceived
        where outcome == "captured"
      reaction DeclinedTranslator
        when PaymentGatewayResultReceived
          outcome
          reason
          produces PaymentDeclined
            reason = reason
        where outcome == "declined"
      event PaymentGatewayResultReceived
        outcome GatewayOutcome
        reason  String
      event PaymentReceived
      event PaymentDeclined
        reason String

      specification TranslatingADeclinedCardResult
        when capture PaymentGatewayResults
          reference = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          outcome   = "D"
          reason    = "Card declined"
        then PaymentGatewayResultReceived
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          outcome = "declined"
          reason  = "Card declined"
        then PaymentDeclined
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason = "Card declined"

    slice StateChange ReversePayment
      description "Compensation for a received payment. NOT enforced in the model: that a payment was received (target requirement). RefundRequested is the request recorded by the reaction; it does not show a refund was delivered, and the gateway's own answer is a later external fact."
      command ReversePayment
        invoiceId InvoiceId identifier
        amount    Decimal
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

    slice StateView OpenInvoices
      description "Todo list: membership means 'still to collect'; there is no status flag."
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

      specification OpenInvoicesLifecycle1Empty
        given caller
          authenticated
          role "Accounts"
        then query OpenInvoiceById
          arguments
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

      specification OpenInvoicesLifecycle2Issued
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        then query OpenInvoiceById
          arguments
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          result
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
            member    = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
            amount    = 130

      specification OpenInvoicesLifecycle3Paid
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when append PaymentReceived
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then no readmodel OpenInvoice for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then query OpenInvoiceById
          arguments
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

      specification OpenInvoicesLifecycle4Voided
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when append InvoiceVoided
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          reason = "Issued in error"
        then no readmodel OpenInvoice for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then query OpenInvoiceById
          arguments
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

      specification OpenInvoicesLifecycle5Settled
        given caller
          authenticated
          role "Accounts"
        given InvoiceIssued
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
          member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 130
        when append InvoiceSettled
          for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then no readmodel OpenInvoice for "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"
        then query OpenInvoiceById
          arguments
            invoiceId = "9c1f0a52-6a4e-4b1c-9f55-0d2c7b8e1a01"

    slice StateView MemberCredit
      description "Running credit balance per member: every top-up adds to it."
      readmodel Credit
        member  MemberId
        balance Decimal
      query CreditByMember => Credit optional
        by member MemberId
      command TopUpCredit
        member MemberId identifier
        amount Decimal
        produces CreditToppedUp
          for member
          amount = amount
      event CreditToppedUp
        amount Decimal
      projection MemberCredit => Credit
        from CreditToppedUp
          member = $eventSourceId
          add balance by amount

      specification MemberCreditAccumulatesTopUps
        given caller
          authenticated
          role "Accounts"
        given CreditToppedUp
          for "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 40
        when append CreditToppedUp
          for "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          amount = 70
        then query CreditByMember
          arguments
            member = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          result
            balance = 110
```

## Notes
- `RefundRequested` is listed by `ReversingAReceivedPayment` because the reaction cascades from the
  command; `RequestingARefundAfterAReversal` specifies the reaction on its own.
- The query answers "absent" with no `result` block; the whole-list query and the `OpenInvoices`
  list view in the excerpts are design-mode expectations (list queries compile but do not bind at
  4.64.0, PLAY0268, `cratis-screenplay-toolchain`, so they are retained as design-mode expectations): see `view-and-story-specs.md`.
