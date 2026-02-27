````instructions
---
applyTo: "**/*.tsx"
---

# Building React Components

## Composition over Monoliths

- Always favor **splitting components into small, focused components** and composing them together.
- A component should do one thing well. If you find yourself writing several distinct visual regions or logical sections inside a single component, each one is likely its own component.
- Use a **composition pattern**: a parent component owns state and event handlers; child components receive only what they need via props.
- As a practical guide: every block comment (`/* … */`) that describes a region inside a component is a strong signal that the region should become its own component.

## Folder Structure

- If a component is a **single file with no related siblings**, place it directly in its parent feature folder.
- If a component **grows to need multiple related files** (sub-components, hooks, CSS, types, stories, etc.), create a **folder named after the component** and move everything related to it into that folder.
  - The main component file keeps the same name as the folder (e.g. `PrototypeWindow/PrototypeWindow.tsx`).
  - Always add an `index.ts` in the folder that re-exports the public surface, so import paths outside the folder stay stable.

**Example structure for a component with multiple related files:**
```
PrototypeWindow/
  PrototypeWindow.tsx      ← composition root, owns state & handlers
  PrototypeWindow.css      ← styles for the whole composition
  TitleBar.tsx             ← sub-component
  CanvasArea.tsx           ← sub-component
  ResizeHandle.tsx         ← sub-component
  DrawPreview.tsx          ← sub-component
  TrafficLights.tsx        ← sub-component
  index.ts                 ← re-exports public API
```

## Styling

- Favor **CSS classes in a dedicated `.css` file** for all static styles (layout, colours, spacing, typography, cursors, border-radius, etc.).
  - Import the CSS file once at the top of the composition root.
  - Name CSS classes with a consistent BEM-like prefix matching the component name (e.g. `.prototype-window-title-bar`).
- **Each component must have its own co-located `.css` file.** Never add styles for a sub-component into the parent composition root's CSS file.
  - Sub-components import their own CSS directly: `import './SubComponent.css'` at the top of the sub-component `.tsx` file.
  - The composition root's CSS file contains only grid/layout rules that apply to the overall composition structure (e.g. how children are positioned relative to one another). It never contains rules for classes owned by individual sub-components.
- Use **inline `style` props only for values that are dynamic at runtime** (e.g. pixel positions driven by state, computed widths/heights).
- Do not mix static and dynamic styles in the same inline object when the static part can live in CSS.
- Use **PrimeReact CSS variables** for all colors, backgrounds, and borders so that the component is compatible with all PrimeReact themes and supports dark mode automatically.
  - Common variables: `var(--surface-0)` through `var(--surface-900)`, `var(--surface-card)`, `var(--surface-border)`, `var(--surface-ground)`, `var(--text-color)`, `var(--text-color-secondary)`, `var(--primary-color)`, `var(--primary-color-text)`, `var(--highlight-bg)`.
  - Never hard-code hex or `rgb()` color values for UI chrome, text, borders, or backgrounds. Only hard-code colors that are intentionally theme-independent (e.g. brand-specific accent dots, traffic-light indicators).

## Props

- Each sub-component declares its own `*Props` interface documenting every prop with a JSDoc comment.
- Pass only the props a component actually needs — avoid threading through large prop bags through multiple levels.
- Event handler props follow the `on*` naming convention (`onPointerDown`, `onSelect`, etc.).

## Storybook

- Storybook is **always running** at **http://localhost:6006** — never restart it, stop it, or start your own instance.
- Use the `click` tool to interact with Storybook in the browser to visually verify component changes.

## Verification After Every Task

After completing any task, always run both of the following to confirm correctness before finishing:

1. `yarn lint` — ensures no lint errors have been introduced.
2. `npx tsc -b` — ensures the TypeScript compiler reports no errors.

## Dialogs

- **Never** import `Dialog` from `primereact/dialog`. Always use the Cratis component wrappers.
- When a dialog executes a Cratis Arc command on confirm, use **`CommandDialog`** from `@cratis/components/CommandDialog`:
  - Pass the command constructor to `command={}` — the component handles instantiation, execution, confirm/cancel buttons.
  - Use `onBeforeExecute` to set command values from local form state before execution.
  - Use `onConfirm` / `onCancel` to call `closeDialog(DialogResult.Ok / Cancelled)`.
  - Wrap form fields in `<CommandDialog.Fields>`.
- When a dialog only collects data without executing a command, use **`Dialog`** from `@cratis/components/Dialogs`:
  - Defaults to OK + Cancel buttons. Use `isValid` to enable/disable the confirm button.
  - Customise button labels with `okLabel` / `cancelLabel`.
  - Use `onConfirm` / `onCancel` callbacks.
- Do not render manual `<Button>` components for dialog actions — the dialog components handle their own footer buttons.

## README.md — MANDATORY for Complex Components

**This is not optional.** Every component folder that has sub-components, hooks, non-trivial architecture, or multiple related files MUST contain a `README.md`.

### Before starting work on a component

- **Check for an existing `README.md` first.** If one exists, read it before touching any source files.
- The README tells you the layout architecture, key design decisions, state strategy, CSS conventions, and extension steps.

### When to create a README

Create a `README.md` whenever the component folder contains:
- Two or more sub-components
- Non-obvious architecture choices (e.g. a layout approach chosen over a more obvious alternative)
- Non-trivial state management shared across children
- Custom hooks specific to the component
- CSS patterns that must be followed consistently
- A step-by-step guide for extending the component (e.g. adding a new row type)

Single-file, self-explanatory components (e.g. a simple button or label) do not need one.

### What a README must cover

- **Component hierarchy** — tree of components and what each owns
- **Architecture decisions** — what approach was chosen and why alternatives were rejected
- **Key constants / formulas** — any explicit sizing rules or domain-specific values
- **State management** — where state lives, what each piece controls
- **CSS conventions** — class naming, patterns used across child components
- **How to extend** — steps for common modifications (new row type, new element kind, etc.)

### Keeping READMEs current

- **When changing architecture, layout, state structure, or CSS conventions, update the README in the same commit.**
- If a decision documented in the README is reversed or improved, rewrite that section.
- If a "How to extend" step changes (e.g. a new file must be touched), update the checklist immediately.
- **Never consider a task complete if the README is stale or missing for a complex component.**

````
