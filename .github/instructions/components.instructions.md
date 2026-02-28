---
applyTo: "**/*.tsx"
---

# Building React Components

## Composition over Monoliths

A well-built component tree is like a well-organized kitchen — every tool has a place, and you can find what you need without opening every drawer. Large components that do everything are hard to understand, hard to test, and hard to change without breaking something unrelated.

- Split components into small, focused pieces and compose them together. Each component should have a single, clear responsibility.
- Parent components own state and event handlers; children receive props. This makes data flow predictable and debuggable.
- If you find yourself writing a block comment like `// Author list section` inside a component, that section should be its own component. The comment is a code smell — the component name should provide that context instead.

## Folder Structure

- Single-file component → place directly in the parent feature folder.
- Multi-file component (sub-components, hooks, CSS) → create a folder named after the component:

```
PrototypeWindow/
  PrototypeWindow.tsx      ← composition root
  PrototypeWindow.css      ← styles for the composition
  TitleBar.tsx             ← sub-component
  CanvasArea.tsx           ← sub-component
  ResizeHandle.tsx         ← sub-component
  index.ts                 ← re-exports public API
```

Add an `index.ts` that re-exports the public surface so import paths stay stable.

## Styling

Consistent styling comes from discipline: static styles in CSS files, dynamic values inline, and colors always from PrimeReact's design tokens. This ensures theming works automatically and no component breaks the visual language.

- Use **CSS classes in co-located `.css` files** for static styles.
- Each component must have its own CSS file — never add sub-component styles to the parent's CSS. This keeps styles co-located with the component they belong to.
- The composition root's CSS only contains layout/grid rules for positioning children — it should not style the children themselves.
- Use inline `style` props **only** for runtime-dynamic values (pixel positions, computed sizes).
- Use **PrimeReact CSS variables** for all colors, backgrounds, borders. This ensures the application respects theming and dark/light mode switches:
  - `var(--surface-0)` through `var(--surface-900)`, `var(--surface-card)`, `var(--surface-border)`
  - `var(--text-color)`, `var(--text-color-secondary)`, `var(--primary-color)`
  - Never hard-code hex or `rgb()` for UI chrome — it will break when themes change.
- Name CSS classes with a BEM-like prefix matching the component name.

## Props

Props are a component's public API. They should be clear, minimal, and well-documented.

- Each sub-component declares its own `*Props` interface with JSDoc on every prop.
- Pass only needed props — avoid threading large prop bags through component trees.
- Event handlers follow `on*` naming: `onPointerDown`, `onSelect`.

## Dialogs

The Cratis dialog wrappers handle command execution, validation timing, loading states, and footer buttons consistently. Using PrimeReact's raw `Dialog` bypasses all of this and leads to inconsistent UX.

- **Never** import `Dialog` from `primereact/dialog`.
- For command-executing dialogs: use `CommandDialog` from `@cratis/components/CommandDialog`.
- For data-collection dialogs: use `Dialog` from `@cratis/components/Dialogs`.
- Do not render manual `<Button>` components for dialog actions — the dialog components handle footers.

## Storybook

- Storybook runs at **http://localhost:6006** — never restart it.
- Use the `click` tool to interact with Storybook for visual verification.

## Verification

After every task, run both:
1. `yarn lint`
2. `npx tsc -b`

## README.md for Complex Components

Complex components accumulate knowledge that lives nowhere else — why a particular state structure was chosen, how sub-components divide responsibilities, what conventions the CSS follows. Without a README, the next developer (or AI) has to reverse-engineer all of this from the code.

Every component folder with sub-components, hooks, or non-trivial architecture **must** have a `README.md`.

**Before starting work:** Check for an existing README and read it first. It may contain context that changes your approach.

**A README must cover:**
- Component hierarchy — tree of components and what each owns
- Architecture decisions — what was chosen and why
- State management — where state lives, what each piece controls
- CSS conventions — patterns used across children
- How to extend — steps for common modifications

**Keep READMEs current** — update in the same commit when changing architecture, layout, or state structure.
