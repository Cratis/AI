# Round-trip the Python event contract

Use Python 3.10 or later. `cratis-chronicle-contracts` is not on PyPI, and the Chronicle 19.184.3 release attaches no wheel, so build the package from the Chronicle source at the release tag you target (`v19.184.3`). In a checkout of that tag, from `Source/Clients/Python`:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
python generate.py --proto-root ../../Kernel/Protobuf
pytest
python build_package.py
```

Install the built wheel into your project's virtual environment. If generation, the package tests or the build fail, stop rather than substituting another version or an unversioned PyPI package. A later release that attaches a wheel with `SHA256SUMS` and provenance can be installed by pinning its URL and hash instead.

In the activated environment, run:

```python
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc

fact = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
decoded = eventtypes_pb2.EventType.FromString(fact.SerializeToString())
assert (decoded.Id, decoded.Generation) == ("AuthorRegistered", 1)
assert callable(eventtypes_pb2_grpc.EventTypesStub)
```

Save as `check_contracts.py`; `python check_contracts.py` exits zero. If the generated module is missing, rebuild the wheel from the tag rather than trying an unversioned PyPI install. This verifies messages and stubs, not an idiomatic application SDK or network session.
