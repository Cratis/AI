---
name: cratis-chronicle-select-client
description: Use when consuming Chronicle gRPC contracts in TypeScript, Kotlin, Elixir or Python, or checking non-.NET append and concurrency support. Not for an Arc backend SDK (cratis-arc-select-backend-sdk).
---

# Choose the Chronicle client layer

1. Identify the deliverable: serialize a wire message, resolve a service stub, or execute a high-level operation. Read references/language-matrix.md when picking the package. **Done:** identify both the language and the layer; a generated stub isn't a configured client against a kernel.
2. For a wire contract, import from the generated package and run the language's own consumer. In Python the module follows the `EventTypes` contract group:

```python
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc

fact = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
copy = eventtypes_pb2.EventType.FromString(fact.SerializeToString())
assert (copy.Id, copy.Generation) == ("AuthorRegistered", 1)
assert callable(eventtypes_pb2_grpc.EventTypesStub)
```

**Done:** the serialized message round-trips and the stub resolves without contacting a live kernel. A similarly named method from .NET is not evidence for Python.
3. For append outcomes, observer registration or guarded reads, verify the idiomatic SDK package, its exact operation and a native behavioral example. If missing, stop at the verified layer and name the missing operation. **Done:** no claim of concurrency protection from encoding a protobuf.

With the fixture requirements installed in an isolated Python environment, run `node --test acceptance.test.mjs`; expect the native Python consumer to exit zero. Missing modules must fail the check, not skip it.
