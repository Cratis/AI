---
applyTo: "**/for_*/**/*.ts, **/for_*/**/*.tsx, **/when_*/**/*.ts, **/when_*/**/*.tsx, **/given/**/*.ts, **/given/**/*.tsx"
paths:
  - "**/for_*/**/*.ts"
  - "**/when_*/**/*.ts"
  - "**/given/**/*.ts"
  - "**/for_*/**/*.tsx"
  - "**/when_*/**/*.tsx"
  - "**/given/**/*.tsx"
profile: framework
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# TypeScript spec assertions in platform packages

Follow the adjacent specs: keep their assertion API, file extension (`.ts` or `.tsx`) and fixture. Add a `given` file only when multiple contexts share setup.

Only in repositories that already use the strict `when_*.ts` convention: act once in `beforeEach`, start each `it` description with “should”, and make one Chai `.should` assertion per `it`. Elsewhere keep related observations together when that is the existing style; don't replace `expect` with `.should`.

[general.md](../../../rules/general.md) decides whether a spec is needed and at which layer. This file covers assertion style only.
