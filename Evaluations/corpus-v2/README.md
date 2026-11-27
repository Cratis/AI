# Authoring inputs for the corpus

Nothing here ships and nothing here runs a model. These are offline inputs kept beside the corpus at `.cratis/ai`.

- `examples/cratis-<skill>/` holds a small compiled example for a few representative skills. Each builds on its own with `dotnet build -c Release` or, for the frontend example, the script in its `package.json`. `examples/Directory.*.props` pin the package versions the examples compile against.
- `skills/cratis-<skill>/` holds optional authoring cases for a skill: realistic requests that should and should not select it, and held-out scenarios. A skill needs none.

`yarn workspace @cratis/ai-verification run verify` checks that every directory in both trees names a skill that exists and that each case file parses. It does not build the examples or grade the cases.

`../conformance/` holds the install fixtures that `cratis ai test --install-only` runs in CI.
