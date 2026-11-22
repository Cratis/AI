<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Assert tags on a then event

Requires Screenplay 6.31.0 or later (`screenplay --version`); tag expectations select ESM v55.

Under a `then` event, `tag <identifier-or-string>` asserts the exact tag list in order, duplicates included, with the same count. `no tags` asserts an empty list. Omitting both leaves tags unspecified, not empty. Event order (`then events in any order`) does not relax the order within a tag list.

```screenplay
concept InvoiceId : Uuid
module Billing
  feature Invoices
    slice StateChange Register
      event InvoiceRegistered
        tag invoicing
        tag "billing"
        tag invoicing
      event InvoiceRecorded
      command RegisterInvoice
        invoiceId InvoiceId identifier
        produces InvoiceRegistered
          for invoiceId
        produces InvoiceRecorded
          for invoiceId
      screen Register
        action RegisterInvoice for screen
      specification RegisteringWithExactTags
        when RegisterInvoice
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
        then InvoiceRegistered
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          tag invoicing
          tag "billing"
          tag invoicing
        then InvoiceRecorded
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          no tags
      specification RegisteringWithoutCheckingTags
        when RegisterInvoice
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
        then InvoiceRegistered
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
        then InvoiceRecorded
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
```

Declaration and production tags describe what is appended; only the `then` lines above assert it. Keep payload properties, `for` and route expectations as well: tags do not replace any of them. Payload assignments such as `tag = "payload"` and `tags = "payload"` remain ordinary property assertions, not tag metadata. A tag-sensitive success needs an explicit list or `no tags`, not merely a passing payload comparison.

`PLAY1148` rejects tag expectations outside a `then` event: `given`, any `when` (including `when append`), redelivery locators and event examples cannot carry them. `no tags` cannot repeat or combine with `tag`; neither form takes children. Values must be identifiers or strings, never `$context` and `$env` expressions: dynamic production tags resolve at append time, so assert the resulting concrete values.

The MCP fixture-occurrence view and event-model board do not expose tag expectations; this is display-only, not lost execution semantics. Inspect the authored specification or ESM v55 `expectedTags`, and run `screenplay test` or MCP `run-specifications` for V4 evidence. A compiler pass or an absent field in a view is not a passing tag assertion. Failure output is described in [verdicts](../../cratis-screenplay-toolchain/references/verdicts.md#v4-reference-specifications-run).

Earlier models without these expectations keep their semantics; reference admission does not prove Stage or CLI rendering support.
