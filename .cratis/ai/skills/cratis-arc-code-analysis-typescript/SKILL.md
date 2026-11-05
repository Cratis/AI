---
name: cratis-arc-code-analysis-typescript
description: Use when adding the Arc ESLint plugin to a Node.js server project or fixing an arc-core lint finding such as missing-field, ARC0004 or ARCCHR0006. Not for C# analyzers or runtime build() graph errors.
license: MIT
---

# Lint Arc server artifacts with `@cratis/eslint-plugin-arc-core`

The plugin finds model-bound binding mistakes in `@command()`, `@readModel()`
and validator classes before `build()` or the first request. It targets ESLint
10 flat config and `typescript-eslint`. It does not lint the Arc frontend
packages or generated proxies. Peers: `eslint` `^10.0.0` and
`@typescript-eslint/parser` `^8.70.0`.

```javascript
// eslint.config.mjs
import arc from '@cratis/eslint-plugin-arc-core';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    ...tseslint.configs.recommended,
    arc.configs['recommended-type-checked']
);
```

Run `eslint src`. Two presets exist, both applied to `**/*.ts` and `**/*.tsx`
under the `arc-core/` rule prefix:

| Preset | Needs type information | Rules |
| --- | --- | --- |
| `recommended` | no | every rule except `query-argument-name`, `arcchr0006` and `arcchr0010`; type-dependent comparisons are skipped |
| `recommended-type-checked` | yes (`projectService`) | `recommended` plus `arcchr0006` and `arcchr0010` |

`arc-core/query-argument-name` is opt-in in both presets.

## Rules and how to fix them

Rule names are `arc-core/<name>`. Arc rules keep the .NET ARC ids only where the
same mistake exists in TypeScript.

| Rule | Finds | Fix |
| --- | --- | --- |
| `missing-field` | public instance property on `@command()`/`@readModel()` without `@field` (private, `#` and `_` names are ignored) | add `@field(String)` etc.; unmarked properties are invisible to the wire schema |
| `declared-field` | decorated property declared with `declare` | use `!` with a real class field |
| `inject-binding` | `@inject` token count or provable type disagrees with `handle` parameters | align tokens and parameters (type comparison needs type information) |
| `query-binding` | `@query` descriptor count differs from the method's parameters, or a token type disagrees | one descriptor per parameter |
| `query-argument-name` (opt-in) | literal wire argument name differs from the method parameter | rename one to match |
| `misplaced-decorator` | `@query` not on a static read-model method, `@inject` not on a command `handle`, authorization on an unsupported member | move it |
| `unexported-artifact` | decorated artifact not exported (including an export at the end of the file) | export the class; `discover()` only registers exports |
| `validator-target` | validator subclass without `@validator(Target)` | add the decorator |
| `arc0002` | class with public fields and an instance `handle()` but no `@command()` | add `@command()` and `@field`s; no decorator is needed if the class is a service |
| `arc0003` | external `handle(command: DecoratedCommand)` that never runs | move `handle` onto the command |
| `arc0004` | command without an instance `handle()` (inherited counts) | add one |
| `arc0005` | `provide()` value discarded because `handle` takes no parameter for it | add the parameter or drop the value |
| `arc0010` | async `handle()` with no `await`, `for await` or returned value | remove `async` or await |
| `arc0012` | built-in `Error` thrown from a decorated artifact | throw a domain-named error class (or reject through validation) |
| `arc0014` | generic type arguments on `@query` (HTTP cannot supply them) | use a concrete type |
| `arc0015` | primitive query parameter converted to a `ConceptAs` inside the query, skipping concept validation | bind the concept as the parameter |
| `arc0019` | `@allowAnonymous()` with `@authorize()` or `@roles()` on one declaration | remove one |
| `arcchr0003` | reactor appends directly through `eventLog.append`/`appendMany` on a store from `getEventStore`/`getStore` | return the event from the reactor |
| `arcchr0006` | command-returning reactor without once-only or a replay handler | add `@onceOnly()` or a replay handler (type-checked) |
| `arcchr0007` | command handler bypassing the append pipeline with a direct write | return the event |
| `arcchr0009` | secret command field persisted into Chronicle causation | mark with `@notAudited` or `@pii` |
| `arcchr0010` | keyless command returning a GUID meant as the event stream id | return `eventSourceIdResponse` (type-checked) |

The .NET ids ARC0001, ARC0006 to ARC0009, ARC0011, ARC0016 to ARC0018 and
ARC0020/ARC0021 have no TypeScript rule: TypeScript queries may return any
shape, a missing command read model is explicit through
`commandReadModel(Type, { optional: true })`, concepts are classes, roles are
strings, operations are returned `CommandOperation` objects, and ASP.NET
attributes do not exist in the Node host.

## Pitfalls

- A suppression comment hides the finding, not the bug: `unexported-artifact`
  and `missing-field` describe things `build()` or the wire schema will break on.
- The Chronicle rules need the decorator imports to come from
  `@cratis/chronicle` or `@cratis/chronicle/reactors`; the rule cannot prove a
  `this.client` field belongs to the reactor, so a non-match is not a clean bill.
- Lint complements, not replaces, `build()`: the builder validates the whole
  graph (missing services, lifetime mismatches, misplaced decorators, stale
  metadata) and `arc-proxygenerator --check-metadata` catches stale generated
  metadata in CI.

## Verify

Run `eslint src` with the type-checked preset in CI next to `tsc` and the
specs. A pass shows no `arc-core/*` findings; a deliberately broken artifact
(for example a `@command()` property without `@field`) should fail with
`arc-core/missing-field`.

## Route near misses

- Writing the artifacts: `cratis-arc-command-typescript`,
  `cratis-arc-query-typescript`, `cratis-arc-validation-typescript`.
- The Roslyn analyzers for C# Arc: the C# command skills.
