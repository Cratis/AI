---
name: cratis-arc-react-bind-slice
description: Use when a React component must consume a generated query or execute a generated command. Not for generating its types (cratis-arc-generate-proxies).
---

# Bind an authoring screen to its contracts

Default to the generated hooks under Arc. The command owns the editable draft; the query owns the rows.

Start with the generated Authors contracts. Generate them from the owning backend before type checking; if the exports are missing, pass that project to `cratis-arc-generate-proxies` instead of writing a client substitute.

1. Locate the command and read model modules. Done: the generated query returns the row type the screen renders and the command accepts the required identifier.
2. Keep the identifier stable while the draft is mounted. Set values through the command tuple and await execute before reporting acceptance. Done: a rejected write keeps its input and does not append a row.
3. Render the observed collection, keyed by the identifier rather than the label. Done: rejection is visible, followed by an accepted command and its Aster row from the next query frame.

## Example

The imports below assume the generated directory is beside the view. Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { Guid } from '@cratis/fundamentals';
import { AllAuthors } from './generated/Authors/Author';
import { RegisterAuthor } from './generated/Authors/RegisterAuthor';

export function View() {
    const [authors] = AllAuthors.use();
    const [id] = useState(() => Guid.create());
    const [command, setValues] = RegisterAuthor.use({ id, name: '' });
    const [status, report] = useState('');
    const [busy, setBusy] = useState(false);
    async function register() {
        setBusy(true);
        try {
            const result = await command.execute();
            report(result.isSuccess ? 'Registered' : !result.isAuthorized ? 'Not authorized' :
                result.validationResults.map(error => error.message).join('; ') || 'Registration failed');
        } catch { report('Registration unavailable'); }
        finally { setBusy(false); }
    }
    return <><label>Name<input value={command.name} onChange={e => setValues({ name: e.target.value })}/></label>
        <button disabled={busy} onClick={register}>Register</button><p role="status">{status}</p>
        <ul>{authors.data.map(author => <li key={String(author.id)}>{author.name}</li>)}</ul></>;
}
```

If the command succeeds but the list stays unchanged, inspect query frames before changing the component. Give a connected but silent endpoint to `cratis-arc-diagnose-live-query`; do not push the draft into the list.

Read references/provider.md when the view runs in a separate frontend host.

Read references/query-lifecycle.md when the first render has no rows.

## Verify

In the cratis-arc-react-bind-slice example fixture, run `npm run test:example`. rejection is visible, followed by an accepted command and its Aster row from the next query frame.
