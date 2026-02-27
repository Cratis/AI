`````instructions
````instructions
---
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript Conventions

## Enums over magic strings

- Prefer **`enum` over string literal union types** whenever a set of values represents a constrained domain concept.
- Use **string enums** (values equal the camelCase or readable string form) so serialized forms remain stable and readable.

**Do this:**
```ts
export enum SliceType {
    StateChange = 'stateChange',
    StateView   = 'stateView',
    Automation  = 'automation',
    Translator  = 'translator',
}
```

**Not this:**
```ts
export type SliceType = 'stateChange' | 'stateView' | 'automation' | 'translator';
```

- Use enum members everywhere — in `switch` cases, comparisons, object literals, and default parameter values.
- Do **not** import enums as `type`; they are values and must be a regular import.
- Export enums from the module's `index.ts` without the `type` keyword so consumers can reference the enum values.

## One type or enum per file — no dumping grounds

- Every interface, type alias, and enum lives in **its own file**, named after the type (e.g. `SliceType.ts`, `InteractionItem.ts`).
- **Never create a `types.ts`**, `models.ts`, `interfaces.ts`, or any other catch-all file that groups unrelated types together. These files grow without bounds and make imports ambiguous.
- Exception: **component props interfaces** (`*Props`) may live alongside their component in the same `.tsx` file, since they are tightly coupled to the component's public API and rarely used elsewhere.
- Aggregate type exports through the folder's `index.ts` so consumers have a stable, single import point while internal files still import from the specific source file.

**Example structure:**
```
Features/EventModeling/
  SliceType.ts          ← enum
  InteractionType.ts    ← enum
  EventKind.ts          ← enum
  ItemCategory.ts       ← enum
  UIElement.ts          ← interface
  InteractionItem.ts    ← interface (imports InteractionType)
  EventItem.ts          ← interface (imports EventKind)
  Slice.ts              ← interface (imports SliceType, UIElement, …)
  Feature.ts            ← interface (imports Slice)
  Module.ts             ← interface (imports Feature)
  index.ts              ← re-exports all of the above
```

## Localised strings

All user-visible text **must** come from the project's translation files — never hard-code UI strings directly in component code.

### Structure

```
Source/Core/
  Strings.ts                    ← re-exports the default (English) JSON
  Locales/
    en/
      translation.json          ← all English strings, organised by feature/component
```

`translation.json` is a nested JSON object whose top-level keys group strings by feature or component (e.g. `projects`, `eventModeling`, `chat`, `canvas`, `prototypeEditor`). Add new keys under the appropriate existing group, or add a new top-level group if the feature is new.

### Importing

Import the strings object using the `Strings` path alias (configured in `tsconfig.json`):

```ts
import strings from 'Strings';
```

Do **not** use relative paths such as `'../../Strings'` or `'../Strings'`.

### Usage

Access strings directly through the nested object — TypeScript infers the full type from the JSON file:

```tsx
import strings from 'Strings';

export const MyComponent = () => (
    <Button label={strings.projects.addProject} />
);
```

For attribute strings (e.g. `title`, `placeholder`, `aria-label`):

```tsx
<div title={strings.eventModeling.grid.detailPanel.event}>
    ...
</div>
```

### Adding new strings

1. Add the key to `Source/Core/Locales/en/translation.json` under the appropriate group.
2. TypeScript picks up the new key automatically from `Strings.ts` (no regeneration step).
3. Use the key via `strings.<group>.<key>` in the component.

### Rules

- **Never** use plain string literals for user-visible text in JSX or attribute props. This includes `label`, `header`, `placeholder`, `title`, `aria-label`, `emptyMessage`, and any visible text nodes.
- Only constant, non-localised values are allowed as raw strings (e.g. CSS class names, `key` props, internal identifiers).
````

`````
