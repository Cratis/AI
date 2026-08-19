# Temporary schema-validation parity tool

This directory is deletion-bound migration tooling for maintainers. It is not a
supported Factory command, is not included in `Planner.slnx`, and is both
non-packable and non-publishable. `Factory.Core` and its permanent
specifications do not reference it.

The runner reads the immutable language-neutral schema-validation vectors and
sends the same exact schema and instance bytes to `Factory.Core` and a local
Python adapter. It compares only Factory-owned stable facts: load and validation
status, schema-set and closure identity, sorted membership and member hashes,
reference counts, typed diagnostics and their safe locations, bounded-failure
status, and repeat and parallel determinism. Package messages, exception text,
raw values, source paths, and untrusted property names are never parity facts.

Run it explicitly from the repository root, directing build intermediates to a
disposable directory:

```shell
PARITY_ARTIFACTS="$(mktemp -d)"
dotnet run \
  --project Factory/Migration/SchemaValidationParity/Cratis.Factory.SchemaValidationParity.csproj \
  --configuration Release \
  --artifacts-path "$PARITY_ARTIFACTS" \
  -- \
  --repository-root "$PWD" \
  --python python3
```

The adapter runs with isolated Python and bytecode generation disabled. Neither
side performs network access or writes source fixtures. Delete this entire
directory with the Stage 0 Python oracle and duplicate Python specifications
after independent native schema-parity acceptance. Keep the language-neutral
vectors and permanent native specifications.
