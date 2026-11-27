---
name: cratis-chronicle-select-client
description: Use when choosing a Chronicle client or generated contracts for a non-.NET service. Not for choosing an Arc backend SDK (use cratis-arc-select-backend-sdk).
compatibility: A language toolchain with the matching Chronicle contracts installed.
---

# Choose a Chronicle client for a non-.NET service

1. **Application behavior:** start with the native application client when its pinned version implements and tests the required append, observe or host behavior against your kernel. Look for `:cratis_chronicle` (Elixir/OTP), `io.cratis:chronicle` (JVM), `@cratis/chronicle` (TypeScript), or `github.com/cratis/chronicle.go` (Go). Check the pinned version's documented support and tests for the operation. Don't infer support from another SDK.
2. **Wire tooling:** choose generated contracts when you need message types and service stubs, not hosted behavior. Use `cratis-chronicle-contracts` in Python, `:cratis_chronicle_contracts` in Elixir, or `@cratis/chronicle.contracts` in TypeScript. The Kotlin contracts' `ChronicleConnection` opens the gRPC connection; that is not the JVM application client.
3. **Missing application behavior:** route to an implementation that demonstrates the required behavior. For .NET, follow the [application integration](../cratis-chronicle-connect-application/SKILL.md).

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

## When it goes off the usual path

- **A Go append returns a transport error:** distinguish an explicit server refusal from an unknown commit. Check the intended history or reconcile using the operation's durable identity before repeating the append. A lost acknowledgement is not evidence of rejection.
- **The Python round trip passes:** it proves the wire types and stub are installed, not an append, retry, or hosted observer.

## Related skills

- [Publish a shared contract](../cratis-chronicle-publish-contract/SKILL.md) when another application needs a public event.

- [Choose the Arc backend SDK](../cratis-arc-select-backend-sdk/SKILL.md)
- [Connect a .NET application](../cratis-chronicle-connect-application/SKILL.md)
