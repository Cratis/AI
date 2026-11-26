---
name: cratis-chronicle-select-client
description: Picks the Chronicle client package for a non-.NET service. Use when choosing Python, Elixir, Kotlin or TypeScript contracts or checking what a language client provides. Not for choosing an Arc backend SDK (use cratis-arc-select-backend-sdk).
compatibility: A language toolchain with the matching Chronicle contracts installed.
---

# Choose a Chronicle client for a non-.NET service

1. Decide whether the caller needs a wire message or needs to run Chronicle application behavior. A service stub is not a reactor host.
2. Use the generated contracts from `cratis-chronicle-contracts` in Python or `:cratis_chronicle_contracts` in Elixir. In TypeScript import generated types from `@cratis/chronicle.contracts`. In Kotlin `io.cratis.chronicle.contracts.ChronicleConnection` manages the gRPC channel; call its suspending `connect()` before using it.
3. For a reactor, projection, reducer or guarded application write, use the [.NET application integration](../cratis-chronicle-connect-application/SKILL.md). Don't translate a .NET API into another language and assume that implementation exists.

## Read a registered author's event type in Python

Install `cratis-chronicle-contracts` in the consuming service's Python environment. Run the following with `python -m unittest discover -s tests`. It checks the generated message and stub without connecting to a kernel.

```python
# tests/test_author_event_type.py
import unittest
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc


class AuthorEventTypeTest(unittest.TestCase):
    def test_registration_identity(self):
        registration = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
        decoded = eventtypes_pb2.EventType.FromString(registration.SerializeToString())
        self.assertEqual((decoded.Id, decoded.Generation), ("AuthorRegistered", 1))
        self.assertTrue(callable(eventtypes_pb2_grpc.EventTypesStub))
```

## Avoid

- Don't interpret a message round trip as a successful server write.
- Don't promise retry or reconnect behavior because the package exposes a channel or service stub.
- Don't assume a native consumer can host a .NET projection.

## Related skills

- [Choose the Arc backend SDK](../cratis-arc-select-backend-sdk/SKILL.md)
- [Connect a .NET application](../cratis-chronicle-connect-application/SKILL.md)
