---
name: cratis-components-choose-control
description: Use when a developer binds a standalone number, calendar date or searchable choice to React state. Not for command fields (use cratis-components-submit-form).
compatibility: Requires react and @cratis/components.
---

# Bind book editor inputs by value type

1. In `Features/Books/BookFields.tsx`, import the controls from `@cratis/components/Common`. Mount the editor inside `CratisComponentsProvider` from `@cratis/components`.
2. Keep a `number | null` for a price, `Date | null` for a publication date, or `string | null` for an author's option key. Each control calls `onChange(null)` when cleared.
3. Bind `value` and `onChange` to the same state. Let `NumberInput` inherit the provider locale; it does not infer browser preferences on its own. When the app follows the browser, set `locale: navigator.language` in the mounted Components provider's `value` on the client, not on each field. Set `maximumFractionDigits` to suit the domain value. The `BookFields.tsx` example accepts the available authors from its caller; `failure` is a message when loading those options failed.

```tsx
import { useState } from 'react';
import { ComboBox, DatePickerInput, NumberInput } from '@cratis/components/Common';

type AuthorOption = { key: string; label: string };
export function BookFields({ authors, loading, failure }: { authors: AuthorOption[]; loading: boolean; failure?: string }) {
    const [price, setPrice] = useState<number | null>(null);
    const [published, setPublished] = useState<Date | null>(null);
    const [authorId, setAuthorId] = useState<string | null>(null);
    return <>
        <NumberInput value={price} onChange={setPrice} maximumFractionDigits={2} aria-label="Price" />
        <DatePickerInput value={published} onChange={setPublished} aria-label="Published" />
        <ComboBox options={authors} value={authorId} onChange={setAuthorId} aria-label="Author"
            loading={loading} failure={failure} />
    </>;
}
```

Use `ComboBox` for choosing an existing author; store its unique key because two options may share a label. For a free-text name, use `<input aria-label="Author name" value={name} onChange={event => setName(event.target.value)} />` with string state. Read prices and dates from `onChange`, not formatted text.

Put the accessible name on the control itself, not its surrounding panel. For the segmented date picker, pass `aria-label` on `DatePickerInput` to name its focus group. For a one-off check in the existing story, find the control by role and name, select a value with the keyboard, then clear it. The host should receive the typed value followed by `null`. Use [the UI observation skill](../cratis-specifications-observe-ui/SKILL.md) to exercise the interaction.

## When it goes off the usual path

- **The first outside click must also activate the underlying control:** pass `isNonModal={true}` to `DatePickerInput`. Otherwise leave the default: the first click only dismisses the calendar.

## Related skills

- [Bind command fields](../cratis-components-submit-form/SKILL.md)

For remote search, duplicate labels or removable entries, read [Collection selection](references/collections.md).

For ordered navigation rather than a selection field, read [Breadcrumb navigation](references/inputs.md).
