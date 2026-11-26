---
name: cratis-chronicle-select-client
compatibility: Native language toolchain and matching Chronicle client or generated contracts.
description: Use when consuming Chronicle gRPC contracts in TypeScript, Kotlin, Elixir or Python, or checking non-.NET append and concurrency support. Not for an Arc backend SDK (cratis-arc-select-backend-sdk).
---

# Choose the Chronicle client layer

1. Identify the deliverable: serialize a wire message, resolve a service stub, or execute a high-level operation. Read references/language-matrix.md when picking the package. **Done:** identify both the language and the layer; a generated stub isn't a configured client against a kernel.
2. For a wire contract, import from the generated package and run the language's own consumer. In Python the module follows the `EventTypes` contract group:

```python
import unittest
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc


class ContractTest(unittest.TestCase):
    def test_wire_roundtrip_and_service_stub(self):
        fact = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
        copy = eventtypes_pb2.EventType.FromString(fact.SerializeToString())
        self.assertEqual((copy.Id, copy.Generation), ("AuthorRegistered", 1))
        self.assertTrue(callable(eventtypes_pb2_grpc.EventTypesStub))
```

**Done:** the serialized message round-trips and the stub resolves without contacting a live kernel. A similarly named method from .NET is not evidence for Python.
3. For append outcomes, observer registration or guarded reads, verify the idiomatic SDK package, its exact operation and a native behavioral example. If missing, stop at the verified layer and name the missing operation. **Done:** no claim of concurrency protection from encoding a protobuf.

**Requires (Python example):** Check `python3 --version` and import `cratis_chronicle_contracts` in the application's virtual environment. If the interpreter or package is missing, use an environment with the application's pinned dependencies before claiming wire compatibility.

Save the wire check above as `check_contract.py` in the application and run `python3 -m unittest -v check_contract`. One passing test means the fields survived serialization and the stub resolved; it says nothing about live RPCs.
