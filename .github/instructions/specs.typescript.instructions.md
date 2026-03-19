---
applyTo: "**/for_*/**/*.ts, **/when_*/**/*.ts"
---

# How to Write TypeScript Specs

Extends the base [Specs Instructions](./specs.instructions.md) with TypeScript-specific conventions.

TypeScript specs follow the same BDD philosophy as C# specs — they describe behaviors, not implementations. The `given()` helper and context classes mirror the Cratis.Specifications pattern on the C# side: setup is separated from the action, and each `it()` assertion verifies a single outcome.

## Frameworks

- [Vitest](https://vitest.dev/) for running tests.
- [Mocha](https://mochajs.org) for test structure (`describe`, `it`, `beforeEach`).
- [SinonJS](https://sinonjs.org) for mocking/stubbing.
- [Chai](https://www.chaijs.com) for assertions — **always use the `.should` fluent interface**, never `expect()`. The fluent style reads as a natural sentence: `result.should.equal(expected)`.
- Run tests with `yarn test` from each package.

## File Structure

Tests live alongside source code in `for_`, `when_`, or `given_` folders:

```
for_EventsCommandResponseValueHandler/
├── given/
│   └── an_events_command_response_value_handler.ts
├── when_checking_can_handle/
│   ├── with_valid_events_collection.ts
│   ├── with_null_value.ts
│   └── without_event_source_id.ts
└── when_handling/
    ├── empty_events_collection.ts
    └── multiple_events_collection.ts
```

## BDD Pattern with `given()` Helper

The `given()` function is the TypeScript equivalent of the C# `Specification` base class. It instantiates a context class (the "given"), passes it to the test suite, and ensures setup runs before assertions. This keeps the Establish/Because/should pattern consistent across both stacks.

- Context class properties are **public** — tests access them via `context.propertyName`.
- Import `given` from the package root: `import { given } from '../../given';`.
- Simple tests without shared setup don't need a reusable context — use a plain `describe` with `beforeEach`.

## Naming Conventions

TypeScript specs use spaces in `it()` descriptions (unlike C# which uses underscores) because they appear in test runner output as human-readable sentences.

- Use **spaces** (not underscores) in `it()` descriptions:
  - ✅ `it('should return invalid result', ...)`
  - ❌ `it('should_return_invalid_result', ...)`
- Start `it()` descriptions with "should".
- `describe()` text describes the scenario in natural language.

## Assertions

**Always use the `.should` fluent interface. Never use `expect()`.** The `.should` style reads as a natural English sentence and matches the project's preference for code that reads like prose.

## Async

`beforeEach`, `afterEach`, and `it` callbacks can all be `async` when needed.

→ For step-by-step guidance on writing TypeScript specs with the `given()` helper, context classes, Sinon mocking, and Chai assertions, invoke the **`cratis-specs-typescript`** skill.
