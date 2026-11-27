# Round-trip the Python event contract

Use Python 3.10 or later and a virtual environment. `cratis-chronicle-contracts` is not distributed on PyPI. If the matching Chronicle release has a wheel, `SHA256SUMS` and provenance, verify the artifact and pin its URL and hash. Install the verified wheel in the virtual environment. If the matching assets are missing, stop rather than substituting a different version.

In the activated environment, run:

```python
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc

fact = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
decoded = eventtypes_pb2.EventType.FromString(fact.SerializeToString())
assert (decoded.Id, decoded.Generation) == ("AuthorRegistered", 1)
assert callable(eventtypes_pb2_grpc.EventTypesStub)
```

Save as `check_contracts.py`; `python check_contracts.py` exits zero. If the generated module is missing, check the built wheel rather than trying an unversioned PyPI install. This verifies messages and stubs, not an idiomatic application SDK or network session.
