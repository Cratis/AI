---
name: cratis-components-choose-control
description: Use when a React screen needs a standalone controlled input for a number, calendar date or searchable choice. Not for command fields (use cratis-components-submit-form).
compatibility: Requires react and @cratis/components.
---

# Bind book editor inputs by value type

1. In `Features/Books/BookFields.tsx`, import the controls from `@cratis/components/Common`. Mount the editor under the [application providers](../cratis-arc-react-bind-slice/SKILL.md).
2. Keep a `number | null` for a price, `Date | null` for a publication date, or `string | null` for an author's option key. Each control calls `onChange(null)` when cleared.
3. Bind `value` and `onChange` to the same state. Let `NumberInput` use the provider locale and set fraction digits to fit the value. The `BookFields.tsx` example accepts the available authors from its caller; `failure` is a message when loading those options failed.

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

Put the accessible name on the control itself, not its surrounding panel. For the segmented date picker, pass `aria-label` on `DatePickerInput` to name its focus group. In the UI check, find the input or group by role and name, then use the keyboard to edit or select a value.

## When it goes off the usual path

- **The first outside click must also activate the underlying control:** check that the installed `DatePickerInput` supports the option and pass `isNonModal={true}`. Otherwise leave the default: the first click only dismisses the calendar.

## Related skills

- [Bind command fields](../cratis-components-submit-form/SKILL.md)
