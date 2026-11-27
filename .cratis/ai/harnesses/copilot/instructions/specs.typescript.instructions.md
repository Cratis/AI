---
applyTo: "**/for_*/**/*.ts, **/when_*/**/*.ts, **/given/**/*.ts"
paths:
  - "**/for_*/**/*.ts"
  - "**/when_*/**/*.ts"
  - "**/given/**/*.ts"
profile: framework
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# TypeScript spec assertions in platform packages

- Assert with the Chai `.should` fluent interface: `result.should.equal(expected)`. Do not use `expect()`.
- Start each `it()` description with "should", written as a sentence: `it('should replace the route parameter', …)`.
- Perform the action once in `beforeEach`; an `it()` block only asserts.

[general.md](../../../rules/general.md) decides whether a spec is needed and at which layer. This file covers assertion style only.
