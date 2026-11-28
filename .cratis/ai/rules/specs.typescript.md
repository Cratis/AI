---
applyTo: "**/for_*/**/*.ts, **/when_*/**/*.ts"
paths:
  - "**/for_*/**/*.ts"
  - "**/when_*/**/*.ts"
---

# TypeScript spec assertions

Follow the adjacent specs: keep their assertion API, file extension (`.ts` or `.tsx`) and fixture. Add a `given` file only when multiple contexts share setup.

Only in repositories that already use the strict `when_*.ts` convention: act once in `beforeEach`, start each `it` description with “should”, and make one Chai `.should` assertion per `it`. Elsewhere keep related observations together when that is the existing style; don't replace `expect` with `.should`.

[general.md](./general.md) decides whether a spec is needed and at which layer. This file covers assertion style only.

Compare JSON by parsing both sides and using the runner's deep equality assertion, not string equality. If saving canonical JSON fixtures, sort object keys recursively, including objects inside arrays, but preserve array order.

Stub only the collaborator boundary and assert the arguments it received. With Sinon already installed, for example, `const save = sinon.stub(repository, 'save')`; after the action, assert that `save.calledOnceWithExactly(expected)` is true using the local assertion API. Register `afterEach(() => sinon.restore())` to restore replaced methods. Otherwise use the existing runner's equivalent spy and cleanup.

Match the local runner’s includes: `when_*` can be a file or a directory. Where the suite uses `given(ContextClass, context => ...)`, keep that fixture rather than inventing a separate lifecycle.
