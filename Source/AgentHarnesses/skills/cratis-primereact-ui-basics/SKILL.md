---
name: cratis-primereact-ui-basics
description: Baseline UI/UX standards for building React frontends on Cratis Components (PrimeReact theming/tokens) - usable, accessible, consistent screens. Use when building or modifying a Cratis Arc React page, form, dialog, or list; when adding a PrimeReact-backed control; or when reviewing a Cratis frontend change for sizing, spacing, contrast, or consistency.
---

# Cratis Components / PrimeReact UI Basics

**Goal:** usable, accessible, visually consistent screens on the Cratis stack - Cratis Components on
PrimeReact theming/tokens, not raw PrimeReact and not Tailwind-only layout with no component behind it.

This skill is about *baseline usability*, not this application's own design system decisions
(spacing scale, color palette, copy tone). Follow the target repository's own conventions first;
apply these rules wherever that repository is silent.

## When to Use

- Building or changing a page, list, form, or dialog on Cratis Arc + Cratis Components
- Choosing or wiring a PrimeReact-backed control (`Button`, `Dropdown`, `InputText`, `DataTable`, `Dialog`, `Toast`, `Tag`, …)
- Reviewing a frontend change for sizing, spacing, contrast, keyboard access, or consistency

## Core Rules

### 1. Components and their wrappers first, never raw HTML controls

Reach for a Cratis Components / PrimeReact control before a plain `<button>`, `<input>`, or a
hand-rolled overlay:

- `Button`, `InputText`/`InputTextField`, `Dropdown`/`DropdownField`, `DataTable`, `Tag`, `Toast`
- A form built against a command uses the `CommandForm`/`CommandDialog` field components
  (`InputTextField`, `DropdownField`, `ChipsField`, `MarkdownEditorField`, …), not a hand-wired
  `<form>` - they carry validation, labels, and error display consistently for free.
- A dialog is the project's own `Dialog`/`CommandDialog` wrapper around PrimeReact's `Dialog`,
  never `primereact/dialog` imported directly - the wrapper is where the project's confirm/cancel,
  busy-indicator, and closing conventions live.
- Prefer a component's own props (`size`, `severity`, `loading`, `disabled`) over custom CSS to
  express state - a `Button` with `loading` communicates busy consistently everywhere; a manually
  dimmed, unclickable-looking `<div>` does not.

### 2. Sizing - keep touch targets and text legible

- Interactive controls (buttons, inputs, dropdowns): **36-48px** tall. Never render a control under
  32px tall or with zero padding - unreachable on touch and easy to mis-click even with a mouse.
- Body text: **16px** (1rem) minimum for anything meant to be read, not skimmed. A dense data table
  or a secondary caption can run smaller, but never below ~13px.
- Line height: **1.5** minimum for paragraph text.
- Controls that sit in the same row (e.g. an `InputText` beside a `Dropdown`) should render at the
  same height - a visibly shorter control beside a taller one reads as broken, not intentional.

### 3. Spacing

- Label to control: 4-8px.
- Between form fields, stacked vertically: 12-16px.
- Between distinct sections (cards, panels): 24-32px.
- Interactive elements placed next to each other (icon buttons in a row): at least 8px apart, so a
  slightly imprecise tap or click does not land on the neighbor.
- Container padding: 16px or more - content should never touch the edge of a card or panel.

### 4. Accessibility (aim for WCAG 2.1 AA)

- Every field has a real, visible label - a `placeholder` is a hint, never a substitute for a label.
- Color contrast: at least 4.5:1 for text, 3:1 for UI component boundaries/icons that carry meaning.
- Every action reachable via keyboard alone (Tab to focus, Enter/Space to activate) - do not build an
  interaction that only responds to a mouse/pointer event.
- Focus must be visible - do not suppress a control's focus outline without providing an equivalent.
- Lean on what the underlying PrimeReact component already does for ARIA roles/states; only add
  explicit `aria-*` attributes for behavior the component cannot express on its own (e.g. a custom
  live region for an async status message).

### 5. Forms and validation

- Labels are always visible, not conjured from a placeholder.
- Group related fields under a heading, `Card`, or `Panel` rather than one long unbroken list.
- Show a validation error inline, next to the field it belongs to - never only in a summary at the
  top or bottom of the form.
- Write the actual rule that failed ("must be a valid URL"), never a bare "Invalid value" or
  "Error occurred".
- Disable the submitting control and show a loading state while a command is in flight - the
  project's `useCommandActions`/`isBusy()` pattern (or the dialog's own busy handling) exists
  precisely so this does not have to be hand-rolled per form.

### 6. Consistency over novelty

- The same kind of action looks the same everywhere it appears (the same icon, the same severity,
  the same position) - a destructive action is consistently `danger`/a trash icon, never sometimes
  plain text and sometimes a red button depending on which screen it is on.
- Primary action and secondary/cancel action keep a consistent left/right (or top/bottom) order
  across every dialog in the application - do not flip it screen by screen.
- An empty list state says what is missing and, where applicable, offers the action that would fill
  it ("No venues registered - discovery has nothing to watch yet.") rather than rendering a bare
  blank area.
- A loading list state uses the project's own loading placeholder (e.g. `LoadingList`), not a
  spinner improvised per page.

### 7. Responsive layout

- Design mobile-first where the target application supports narrow viewports at all; otherwise
  still verify the layout holds at common desktop widths without controls overlapping or truncating
  illegibly.
- Stack related controls vertically under a narrow viewport, lay them out horizontally once there is
  room - do not force a fixed multi-column layout that clips at smaller widths.

## Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| A raw `<button>`/`<input>` instead of the project's component | Use the Cratis Components / `CommandForm` field equivalent |
| Importing `Dialog` straight from `primereact/dialog` | Use the project's own `Dialog`/`CommandDialog` wrapper |
| A control rendered under 32px tall | 36-48px minimum |
| Body text under ~13px | 16px for anything meant to be read |
| Zero or near-zero spacing between fields | 12-16px vertical, 8px between adjacent interactive elements |
| A placeholder standing in for a label | Visible label; placeholder is a hint at most |
| A bare "Error" or "Invalid" message | Say specifically what is wrong |
| Inconsistent control heights in one row | Same height via the component's own size prop |
| An action whose only trigger is a mouse event (e.g. `onMouseDown` only) | Make it keyboard-reachable too |
| A blank area for an empty list | A short message, plus an action when one applies |

## Self-Check Before Finishing

- [ ] Every interactive control is a Cratis Components / PrimeReact component, not raw HTML
- [ ] Every control is at least 36px tall; body text is at least 16px
- [ ] Spacing follows the 4-8 / 12-16 / 24-32px scale above
- [ ] Every field has a visible label
- [ ] Every action is reachable by keyboard
- [ ] Color contrast looks like it clears 4.5:1 for text
- [ ] Loading and empty states use the project's own patterns, not one-off spinners/blank areas
- [ ] Destructive actions are visually consistent with how the rest of the application marks them
