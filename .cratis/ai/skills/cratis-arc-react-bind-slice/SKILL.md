---
name: cratis-arc-react-bind-slice
description: Use when a developer mounts the Arc React host, renders a generated query in custom markup or invokes a generated command from an action. Not for a standard table (use cratis-components-display-list) or a command form (use cratis-components-submit-form).
compatibility: Requires react, react-dom and compatible versions of @cratis/arc, @cratis/arc.react and @cratis/fundamentals. Add @cratis/components for DataPage or command dialogs.
---

# Bind generated proxies in a React component

Start with a plain function component and React-enabled generated proxies (`cratis-arc-generate-proxies` skill). For the Library example below, choose the import reference for the backend that produced the files: a C# project (`.csproj`) → [C#](references/csharp.md); a Kotlin project (`.kt`) → [Kotlin](references/kotlin.md). Otherwise use the module that actually exports the generated proxy.

In a new frontend, install `@cratis/arc`, `@cratis/arc.react`, `@cratis/fundamentals`, `react` and `react-dom`. Enable `experimentalDecorators: true` under `compilerOptions` in `tsconfig.json` for generated models that use legacy `@field` decorators, and use a build that honors that setting.

1. In `main.tsx`, load the Fundamentals metadata polyfill before importing the application. Mount `Arc` once. `App` is your root component. If starting without a shell, export a function named `App` from `App.tsx` and render the query view there.

```tsx
import '@cratis/fundamentals/reflection';
import { createRoot } from 'react-dom/client';
import { Arc } from '@cratis/arc.react';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
    <Arc><App /></Arc>
);
```

   For `DataPage` or command dialogs, import `CratisComponentsProvider` from `@cratis/components` and render `<Arc><CratisComponentsProvider><App /></CratisComponentsProvider></Arc>` instead.

2. Bind the state view to its generated query. Loading and errors are UI states, not separate slices. For custom markup **instead of** `DataPage`, import `AllAuthors` using the selected backend reference. Use this fragment inside that function component. Do not add another `Authors` component or call the hook alongside a `DataPage` that already uses the query.

```tsx
const [authors] = AllAuthors.use();
if (!authors.isAuthorized) return <p>Not authorized.</p>;
if (!authors.isValid) return <p>Invalid query.</p>;
if (authors.hasExceptions) return <p>Could not load authors.</p>;
if (authors.isPerforming || !authors.isReady) return <p>Loading authors…</p>;
if (!authors.isSuccess) return <p>Could not load authors.</p>;
if (!authors.hasData) return <p>No authors yet.</p>;
return <ul>{authors.data.map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>;
```

3. For a name search in the same folder, import `AuthorsNamed` from the module that exports it; do not assume both queries share a module. That paged query (`cratis-arc-page-query` skill) takes `{ name: string }`, unlike the argument-free live query. With the current input in `name: string`, call the hook on every render. Set the condition false when the input is blank, and show a prompt instead of reading the default result:

```tsx
const [matches] = AuthorsNamed.when(name.trim().length > 0).use({ name: name.trim() });
if (!name.trim()) return <p>Enter an author name.</p>;
```

## Execute an action without a form

When the action already has its inputs, use the generated command hook in the component that owns the action. For example, import `RegisterAuthor` from the registration slice's generated module. Given an `id` and `name` for the draft, and a `setStatus` state setter, bind this handler to the registration gesture:

```tsx
const [register, setValues] = RegisterAuthor.use();
async function registerAuthor() {
    setValues({ id, name });
    const result = await register.execute();
    if (!result.isAuthorized) setStatus('Not authorized.');
    else if (!result.isValid) setStatus(result.validationResults.map(v => v.message).join('; '));
    else setStatus(result.isSuccess ? 'Registration submitted.' : 'Registration failed.');
}
```

Render the status and keep failed input for correction. Read the updated list from the query, not the submitted command. When collecting the inputs in a dialog, use `cratis-components-submit-form` instead; it executes the command itself.

## Configure the host

- For the same-origin Library host, omit `apiBasePath`: the generated routes already start with `/api`. Set it only for an additional deployment prefix, e.g. `apiBasePath="/library"` for `/library/api/...`. Route the live-query transport to the backend too: the default SSE hub uses `/.cratis/queries/sse` and its `/subscribe` and `/unsubscribe` endpoints, with the same deployment prefix when set.
- For a named service, set `microservice="catalog"` on that same `Arc` element, using the actual service name.

- To show an editor-only control, import `RequireRole` from `@cratis/arc.react/identity`. Pass `roles={['catalog-editor']}` and distinguish `whileLoading` from `forbidden`. This is presentation only; enforce authorization on the backend command and query.

## When it goes off the usual path

- **Rows aren't ready or access was denied:** show loading or error, not an empty list. Show an empty list only for a ready, successful result with no rows.
- **The account switches:** cached query results and open query connections belong to the previous caller, and remounting views or the `<Arc>` provider does not discard them all. After sign-out or after installing a different user's credentials, reload the page (`window.location.reload()` or a full navigation) so every query starts fresh for the new caller.

## One-off binding check

Start with no rows, then register an author. The list should change without a page reload. With a blank search, expect the input hint.

## Related skills

- [Separate the view model](../cratis-arc-react-separate-view-model/SKILL.md) when presentation state belongs outside the component.
- Check the user-visible result (`cratis-specifications-observe-ui` skill) if the binding changes a user journey.
- For a standard query-backed table, use `cratis-components-display-list` from the Components profile.

For command state and refusal, read [commands.md](references/commands.md).

For loading, refusal and projection updates, read [query-state.md](references/query-state.md).
