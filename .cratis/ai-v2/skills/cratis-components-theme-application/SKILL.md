---
name: cratis-components-theme-application
description: Use when setting up baseline Components styles or overriding theme tokens to change the palette in one part of the application. Not for choosing input controls (use cratis-components-choose-control).
compatibility: Requires @cratis/components and a CSS bundler that resolves package imports.
---

# Load the theme and change one area's color

Use a theme token for a color change, scoped to the smallest wrapper that should inherit it. Choose a named component part only when you need to style a specific piece of the component.

1. Add `host.css` beside `main.tsx` and import `./host.css` from that entry point. Mount `CratisComponentsProvider` from `@cratis/components` as shown in [Mount Arc and read a query result](../cratis-arc-react-bind-slice/SKILL.md).
2. Load tokens, component styles and the baseline theme in that order. Put unlayered token overrides after the imports and match the theme selector's specificity. Set the token on the wrapper of the area that should change:

```css
@import '@cratis/components/tokens';
@import '@cratis/components/styles';
@import '@cratis/components/theme';

.author-admin { --cratis-primary-color: rgb(101, 29, 155); }
```

3. Put `className="author-admin"` on the authors section. Controls inside inherit the override; sibling sections keep the default.
4. For an app-wide palette instead, put these rules after the three imports, outside `@layer`. Match the baseline selectors so the later value wins on the root and in themed subtrees. Wrap all three rules in `@media (forced-colors: none)` to preserve system colors in forced-colors mode.

```css
:root, .cratis-theme, :root.cratis-light, :root.cratis-dark.cratis-light,
:root.cratis-light .cratis-theme:not(.cratis-dark), .cratis-theme.cratis-light,
.cratis-dark .cratis-theme.cratis-light { --cratis-primary-color: #0f766e; }

:root.cratis-dark, .cratis-dark .cratis-theme, .cratis-theme.cratis-dark {
    --cratis-primary-color: #5eead4;
}

@media (prefers-color-scheme: dark) {
    :root:not(.cratis-light), .cratis-theme:not(.cratis-light) { --cratis-primary-color: #5eead4; }
}
```

## Scope action colors to a themed panel

Override the action tokens on the panel wrapper itself. Match the explicit-light selector when the panel is light inside a dark theme. Pair the action foreground with all three backgrounds; do not set ordinary panel `color` as a substitute.

```css
@media (forced-colors: none) {
    .cratis-theme.cratis-light.author-admin,
    .cratis-dark .cratis-theme.cratis-light.author-admin {
        --cratis-action-background: #92400e;
        --cratis-action-background-hover: #78350f;
        --cratis-action-background-active: #451a03;
        --cratis-action-text: #fff;
    }
}
```

Apply `cratis-theme cratis-light author-admin` to the light panel, not the page root.

## Target a component part

Use `.author-admin [data-cratis-part='header-content']` for the content inside a table header. Don't target private DOM nesting or internal vendor nodes.

## When it goes off the usual path

- **Controls look unstyled after an upgrade:** verify that the entry stylesheet loads and the Components provider wraps the surface before adding a vendor theme. Remove legacy vendor CSS and packages only if the host no longer uses them directly.
- **A ComboBox rule misses the listbox:** the popover is portalled outside the wrapper. Set `pt={{ popover: { className: 'author-options' } }}` on that ComboBox, then target `.author-options [data-cratis-part='optionLabel']` and `.author-options [data-cratis-part='optionDescription']` in `host.css`. Don't rely on the popover being a descendant of `.author-admin`.
- **A palette override fights system colors:** keep the override within `@media (forced-colors: none)`.

## Related skills

- [Mount the providers](../cratis-arc-react-bind-slice/SKILL.md)
