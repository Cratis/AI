---
name: cratis-arc-react-bind-slice
compatibility: Requires React and generated Arc proxies.
description: Use when a React component needs a generated proxy hook to read query rows or execute a command. Not for generating its types (cratis-arc-generate-proxies).
---

# Bind an authoring screen to its contracts

Default to the generated hooks under Arc. The command owns the editable draft; the query owns the rows.

Use the backend's generated command and query exports. If either is missing, regenerate the proxies rather than writing a substitute.

1. Locate the command and read model modules. **Done:** The generated query returns the row type the screen renders and the command accepts the required identifier.
2. Keep the identifier stable while the draft is mounted. Set values through the command tuple and await execute before reporting acceptance. **Done:** A rejected write keeps its input and does not append a row.
3. Render the observed collection, keyed by the identifier rather than the label. **Done:** Rejection is visible, followed by an accepted command and its Aster row from the next query frame.

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

If the command succeeds but the list stays unchanged, inspect query frames before changing the component. For a connected but silent endpoint, follow [Locate the first missing emission](../cratis-arc-diagnose-live-query/SKILL.md); do not push the draft into the list.

Read references/provider.md when the view runs in a separate frontend host.

Read references/query-lifecycle.md when the first render has no rows.

## Verify

Run `npx tsc --noEmit` in the frontend, then submit rejected and valid inputs in the mounted screen. The rejection preserves the draft; the successful row appears once, from the next query frame.
