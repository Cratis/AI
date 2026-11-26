---
name: cratis-components-submit-form
description: Use when building a CommandForm, CommandDialog or multi-step command wizard for React inputs. Not for generic confirmation (cratis-components-coordinate-feedback).
---

# Submit a generated command from fields

Use Arc CommandForm for inline input and Components fields for its members. Use CommandDialog when success should close a modal; let that form own execution.

Start with the generated Authors contracts. Generate them from the owning backend before type checking; if the exports are missing, pass that project to `cratis-arc-generate-proxies` instead of writing a client substitute.

1. Identify editable members and required hidden values. Done: the command has its id before the first validation, without asking the user to type it.
2. Bind fields with typed accessors and route member errors back to their fields. Done: the rejected name and its error remain visible in the open dialog.
3. Close only on success or deliberate cancellation. Done: changing the rejected name to Aster commits once and the dialog closes.

## Example

The imports below assume the generated directory is beside the view. Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { Guid } from '@cratis/fundamentals';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { RegisterAuthor } from './generated/Authors/RegisterAuthor';

export function View() {
    const [id] = useState(() => Guid.create());
    const [open, show] = useState(true);
    const [message, report] = useState('');
    return <><CommandDialog<RegisterAuthor> visible={open} title="New author" okLabel="Register"
        command={RegisterAuthor} initialValues={{ id }} onCancel={() => show(false)}
        onValidationFailure={errors => report(errors.map(error => error.message).join('; '))}
        onSuccess={() => { report('Registered'); show(false); }}>
        <InputTextField<RegisterAuthor> value={c => c.name} title="Name" />
    </CommandDialog><output>{message}</output></>;
}
```

If Save stays disabled, inspect the initialized command, including required context not represented by a field. Do not add a second execute call to the success callback.

Read references/multi-step.md when input spans ordered steps.

Read references/calendar-field.md when a command member carries a date.

## Verify

In the cratis-components-submit-form example fixture, run `npm run test:example`. changing the rejected name to Aster commits once and the dialog closes.
