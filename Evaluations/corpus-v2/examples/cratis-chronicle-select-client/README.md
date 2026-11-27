# Python contracts consumer

Use Node 22+, Python 3.10+ and a virtual environment. This fixture needs the generated Python contracts from Chronicle `v19.184.3`; do not resolve the contracts by package name on PyPI.

Set `CHRONICLE_CONTRACTS_WHEEL_URL` to the direct URL of the wheel for that tag and `CHRONICLE_CONTRACTS_WHEEL_SHA256` to its digest from that release's `SHA256SUMS`. If the release has no assets, use a wheel generated from the exact tag following `Source/Clients/Python/README.md` in Chronicle. Use its `file:///` URL and the SHA-256 of that wheel. Without a matching wheel the fixture is blocked.

Run `python3 -m pip install -r requirements.txt`, then `node --test acceptance.test.mjs`. The test serializes and deserializes an event type and resolves its generated service stub. It does not contact a kernel.
