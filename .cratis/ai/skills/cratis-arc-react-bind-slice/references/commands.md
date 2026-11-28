# Command state and refusal

Trace displayed values to the read model and submitted properties to the generated command. Treat inputs as a draft. `hasChanges` compares it with the baseline; `revertChanges()` restores that baseline. Preserve the draft and clear busy state on every refusal. Use the real identity provider, not a caller ID from the form.

## Present safe feedback

Inside the component that owns `id`, `name` and `setStatus`, import the generated `RegisterAuthor` and bind the following handler. No refusal closes the view or clears the inputs. The refresh instruction means re-read the query, then let the user deliberately resubmit.

```tsx
const [register, setValues] = RegisterAuthor.use();
async function registerAuthor() {
    setValues({ id, name });
    try {
        const result = await register.execute();
        const findings = result.validationResults;
        if (!result.isAuthorized) {
            if (result.isSuspended) setStatus('Registration is temporarily suspended.');
            else if (result.isNotAvailable) setStatus('Registration is unavailable.');
            else setStatus('Not authorized.');
        } else if (result.isMissingHandler) setStatus('Registration is unavailable.');
        else if (findings.some(v => v.reason === 'concurrencyViolation' &&
            (v.reasonDetail === 'ReadChanged' || v.reasonDetail === 'ReadIncomplete'))) {
            setStatus('Refresh the author list before trying again.');
        } else if (result.isRetryable) setStatus('Try again later.');
        else if (!result.hasExceptions && !result.isValid && findings.some(v => v.reason === 'rule' && v.members.includes('name'))) {
            setStatus('Check the author name.');
        } else setStatus(result.isSuccess ? 'Registration submitted.' : 'Registration failed.');
    } catch {
        setStatus('Could not confirm registration. Check the list before retrying.');
    }
}
```

`ReadChanged` and `ReadIncomplete` describe a guarded read, not a field failure; recognize the exact pairs independently of the retryable flag. Match authored `rule` findings to fields via `members` and select application-approved copy, optionally keyed by `reasonDetail`. Unknown reasons, exceptions, stack traces and raw validation messages are not user copy. Check success before reading `response` or continuing. Opt in to throttled `autoServerValidate` for early feedback, not permission or a guarantee of execution. When using generated form fields, a `GuidField` edits a supplied identifier; it does not generate one.

## Availability and operator suspension

Import `useIsAvailable`, `RequireAvailable` and `useAvailableItems` from `@cratis/arc.react/availability`. Use `useIsAvailable(part, args)` with the generated proxy and the same argument values that execution will use. With no provider the app opts out; with one, distinguish `!isKnown` from an unavailable answer and do not treat a failed argument-aware check as available. Keep a last good context decision distinct from an initial failure. Never execute a disabled action. `RequireAvailable` takes the same `part` and `args`, with separate `whileLoading`, `unavailable` and `suspended` slots. A suspension lifts when the operator re-enables the part; do not report it as ordinary `NotAvailable` or missing permission. For results without the command result getters, use `isSuspended(result)` and `isNotAvailable(result)` from `@cratis/arc/availability`.

Filter navigation against the live availability list; return `undefined` for an ungated entry. This list filter is not a per-argument gate. Inside the navigation component, with the generated `AllAuthors` in scope:

```tsx
const visible = useAvailableItems([
    { href: '/', label: 'Home' },
    { href: '/authors', label: 'Authors', part: AllAuthors },
], item => item.part);
return <nav>{visible.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>;
```

The server must still authorize every execution.

## Aggregate an editable section

`CommandScope` tracks generated commands and queries; hooks register with the nearest scope, and nested scopes contribute dirty, busy and validation state to their parent. Use `setHasChanges` and `setIsPerforming` to drive reactive UI, and `useCommandScope` from `@cratis/arc.react/commands` inside the scope to inspect `hasValidationFailures` or `aggregatedValidationFailures`. A bound view model can inject `ICommandScope` from the same package to receive its nearest scope.

`execute()` and `revertChanges()` act on commands registered directly with that scope (execution skips unchanged commands), not commands in nested scopes. Show aggregate busy state at the parent and put save/revert in the section that owns its draft. In this excerpt `NameFields` binds the generated command in that inner section; `reportResult` classifies its execution results using the rules above:

```tsx
import { useState, type ReactElement } from 'react';
import { CommandScope, useCommandScope } from '@cratis/arc.react/commands';

function NameSection() {
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    return <CommandScope setHasChanges={setDirty} setIsPerforming={setBusy}>
        <NameFields />
        <NameActions disabled={!dirty || busy} />
    </CommandScope>;
}

function NameActions({ disabled }: { disabled: boolean }) {
    const scope = useCommandScope();
    return <>
        <button type="button" disabled={disabled} onClick={async () => reportResult(await scope.execute())}>Save</button>
        <button type="button" disabled={disabled} onClick={() => scope.revertChanges()}>Revert</button>
    </>;
}

export function AuthorSections({ summary }: { summary: ReactElement }) {
    const [busy, setBusy] = useState(false);
    return <section aria-busy={busy}>
        <CommandScope setIsPerforming={setBusy}>
            {summary}
            <NameSection />
        </CommandScope>
    </section>;
}
```
