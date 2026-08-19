# Temporary canonical JSON parity tool

This directory is migration tooling for maintainers. It is not a supported
Factory command, is not included in `Planner.slnx`, and is both non-packable and
non-publishable. `Factory.Core` and its permanent specifications do not
reference it.

Run it explicitly from the repository root, directing build intermediates to a
disposable directory:

```shell
PARITY_ARTIFACTS="$(mktemp -d)"
dotnet run \
  --project Factory/Migration/CanonicalJsonParity/Cratis.Factory.CanonicalJsonParity.csproj \
  --configuration Release \
  --artifacts-path "$PARITY_ARTIFACTS" \
  -- \
  --repository-root "$PWD" \
  --python python3
```

This explicit maintainer command is the only path in the native slice that
requires Python. The runner reads the single language-neutral
`Factory/Fixtures/Contracts/v1/canonical-json-vectors.json` manifest, generates
bounded inputs in memory, and sends the same exact raw bytes to `Factory.Core`
and the local Python adapter. The adapter calls the existing
`Factory/scripts/canonical_json.py` oracle for value serialization and hashes.
Its strict parser wrapper applies the newly accepted version 1 bounds; those
bounds are not historical behavior of the formerly unbounded value oracle.

Output is one typed JSON summary. It contains aggregate counts and numeric case
ordinals only; adapter failures never echo input, parser messages, source hints,
or paths. The runner and adapter contain no network behavior and do not write
fixtures or tracked repository files. Python runs in isolated, no-bytecode mode
(`-I -B`), excluding the user site and preventing cache files.

Delete this entire directory with the Python oracle, requirements, and
duplicate Python semantic tests after independent native parity acceptance.
The language-neutral vectors and permanent .NET conformance suite remain.
