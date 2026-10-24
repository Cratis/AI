<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Keying by the event source

Requires Screenplay 4.242.0 or later (`screenplay --version`). The marker selects
ESM v33 and serializes `keyIsEventSource` beside `sourceEvents`. A capture without
it keeps its earlier behavior, version and bytes.

Declare `key <property> is event source` only when the producer sources **every**
captured event by that property's value. This is a promise about the foreign
stream, not a request to move an event to another source. It lets a renderer that
admits v33 narrow an inbox history read by event source id. Binding and reference
execution do not prove the renderer or deployed observer realizes that promise.

Only a `source events` capture with a single property key may declare the marker.
Other capture sources or key shapes report PLAY0809, an error with no automatic
repair. The key must still be required on every `from` event (PLAY0700); the marker
does not permit `$eventSourceId` as the key expression.

## Typed fixtures

- An explicit fixture `for` must equal the key. A mismatch rejects execution with
  a contract rejection naming the capture, event and both values. Do not turn it
  into an accepted `then no events` scenario.
- A fixture without `for` takes the key as its source **before** projections and
  reactions see it, so `$eventSourceId` is the key.
- The check also runs while establishing givens, including a world with no action.
- Without the marker, an optional foreign fixture `for` stays opaque non-empty
  text, independent of the capture key. Do not add the marker just to fix a fixture.

This complete model uses a producer that sources dispatches by `orderId`:

```screenplay
module Shipping
  feature Tracking
    slice Translate ReceiveDispatches
      direction inbound
      event ParcelDispatched from "carrier"
        orderId String
      event DispatchRecorded
        orderId String
      capture DispatchFeed
        source events
          from ParcelDispatched
        key orderId is event source
        append DispatchRecorded
          when added
            orderId = $.orderId
      specification RecordingADispatch
        when append ParcelDispatched
          for "order-42"
          orderId = "order-42"
        then DispatchRecorded
          for "order-42"
          orderId = "order-42"
      specification TakingTheKeyAsSource
        when append ParcelDispatched
          orderId = "order-42"
        then DispatchRecorded
          for "order-42"
          orderId = "order-42"
```

Changing the first fixture's `for` to `"other-order"` rejects the run; it is not a
new stream to accept silently. Test that rejection and the given-only mismatch
through evaluator outcomes as well as the two successful source forms.

Authority: Screenplay [captures](https://github.com/Cratis/Screenplay/blob/v4.242.0/Documentation/screenplay/captures.md#keying-by-the-event-source)
and [capture grammar](https://github.com/Cratis/Screenplay/blob/v4.242.0/Documentation/screenplay/captures/grammar.md).
