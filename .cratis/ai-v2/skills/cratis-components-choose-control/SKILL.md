---
name: cratis-components-choose-control
description: Binds a number, calendar date or searchable choice to React state. Use when a screen needs a standalone controlled input. Not for command fields (use cratis-components-submit-form).
compatibility: Requires react and @cratis/components.
---

# Bind book editor inputs by value type

1. In `Features/Books/BookFields.tsx`, import the controls from `@cratis/components/Common`. Mount the editor under the [application providers](../cratis-arc-react-bind-slice/SKILL.md).
2. Keep a `number | null` for a price, `Date | null` for a publication date, or `string | null` for an author's option key. Each control calls `onChange(null)` when cleared.
3. Bind `value` and `onChange` to the same state. The `BookFields.tsx` example accepts the available authors from its caller; `failure` is a message when loading those options failed.

```tsx
import { useState } from 'react';
import { ComboBox, DatePickerInput, NumberInput } from '@cratis/components/Common';

type AuthorOption = { key: string; label: string };
export function BookFields({ authors, loading, failure }: { authors: AuthorOption[]; loading: boolean; failure?: string }) {
    const [price, setPrice] = useState<number | null>(null);
    const [published, setPublished] = useState<Date | null>(null);
    const [authorId, setAuthorId] = useState<string | null>(null);
    return <>
        <NumberInput value={price} onChange={setPrice} aria-label="Price" />
        <DatePickerInput value={published} onChange={setPublished} aria-label="Published" />
        <ComboBox options={authors} value={authorId} onChange={setAuthorId} aria-label="Author"
            loading={loading} failure={failure} />
    </>;
}
```

## Avoid

- Don't parse formatted price or date text. Read the typed value from `onChange`.
- Don't store the author's label; two options may share a name. Use the unique `key`.
- Don't expect these controls to update a generated command. Use the typed `CommandForm` fields for that.

## Related skills

- [Bind command fields](../cratis-components-submit-form/SKILL.md)
