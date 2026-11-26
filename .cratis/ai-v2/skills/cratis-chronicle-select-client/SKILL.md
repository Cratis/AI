---
name: cratis-chronicle-select-client
description: Use when choosing a Chronicle client package or contracts for a non-.NET service in Python, Elixir, Kotlin or TypeScript, or checking what a language client provides. Not for choosing an Arc backend SDK (use cratis-arc-select-backend-sdk).
compatibility: A language toolchain with the matching Chronicle contracts installed.
---

# Choose a Chronicle client for a non-.NET service

1. Decide whether the caller needs a wire message or needs to run Chronicle application behavior. A service stub is not a reactor host.
2. Use the generated contracts from `cratis-chronicle-contracts` in Python or `:cratis_chronicle_contracts` in Elixir. For a TypeScript application use `@cratis/chronicle`. Use `@cratis/chronicle.contracts` only when building a client or tool. In Kotlin `io.cratis.chronicle.contracts.ChronicleConnection` manages the gRPC channel; call its suspending `connect()` before using it.
3. When a Python, Elixir or Kotlin service needs to host a reactor, projection, reducer or guarded write, don't infer support from the contracts; for the .NET implementation use the [.NET application integration](../cratis-chronicle-connect-application/SKILL.md). Don't translate a .NET API into another language and assume that implementation exists.

## Read a registered author's event type in Python

Chronicle distributes generated Python contracts separately from PyPI. Check the Chronicle GitHub release matching the kernel tag for a wheel and `SHA256SUMS`. If both exist, pin its download URL and SHA-256 digest in the Python environment; don't use a bare package name. If the assets are absent, obtain a wheel built from that exact tag or stop before running this test. Run the following with `python -m unittest discover -s tests`. It checks the generated message and stub without connecting to a kernel.

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

- [Publish a shared contract](../cratis-chronicle-publish-contract/SKILL.md) when another application needs a public event.

- [Choose the Arc backend SDK](../cratis-arc-select-backend-sdk/SKILL.md)
- [Connect a .NET application](../cratis-chronicle-connect-application/SKILL.md)
