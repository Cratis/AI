---
name: cratis-arc-react-bind-slice
description: Use when configuring the Arc host in React, waiting for a generated query's argument or rendering its result states in custom markup. Not for a standard table (use cratis-components-display-list) or a command form (use cratis-components-submit-form).
compatibility: Requires react, react-dom, reflect-metadata, @cratis/components and @cratis/arc.react.
---

# Mount Arc and read a query result

1. In `main.tsx`, load metadata before the application. Mount the two providers once. `App.tsx` is the [application shell](../cratis-components-coordinate-feedback/SKILL.md); it supplies the required row-opening callback to the [Authors page](../cratis-components-display-list/SKILL.md).

```tsx
import 'reflect-metadata';
import { createRoot } from 'react-dom/client';
import { Arc } from '@cratis/arc.react';
import { CratisComponentsProvider } from '@cratis/components';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
    <CratisComponentsProvider><Arc><App /></Arc></CratisComponentsProvider>
);
```

2. Bind the state view to its generated query. Loading and errors are UI states, not separate slices. For custom markup **instead of** `DataPage`, import `AllAuthors` from `../../../generated/Features/Authors/Listing/Author` in the consuming component under `Features/Authors/Listing`. Use this fragment inside that function component. Do not add another `Authors` component or call the hook alongside a `DataPage` that already uses the query.

```tsx
const [authors] = AllAuthors.use();
if (!authors.isAuthorized) return <p>Not authorized.</p>;
if (!authors.isValid) return <p>Invalid query.</p>;
if (authors.hasExceptions || !authors.isSuccess) return <p>Could not load authors.</p>;
if (authors.isPerforming || !authors.isReady) return <p>Loading authors…</p>;
if (!authors.hasData) return <p>No authors yet.</p>;
return <ul>{authors.data.map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>;
```

3. For a name search in the same folder, import `AuthorsNamed` from the same generated file. That [paged query](../cratis-arc-page-query/SKILL.md) takes `{ name: string }`, unlike the argument-free live query. With the current input in `name: string`, call the hook on every render. Set the condition false when the input is blank, and show a prompt instead of reading the default result:

```tsx
const [matches] = AuthorsNamed.when(name.trim().length > 0).use({ name: name.trim() });
if (!name.trim()) return <p>Enter an author name.</p>;
```

## Configure the host

- Set `apiBasePath` on `Arc` to the API prefix. Set `microservice` to the target service name if the host serves several microservices.

## Avoid

- Don't edit generated files; [generate the proxies](../cratis-arc-generate-proxies/SKILL.md) from the backend.

## When it goes off the usual path

- **Rows aren't ready or access was denied:** show loading or error, not an empty list. Show an empty list only for a ready, successful result with no rows.
- **The account switches:** hide the previous caller's rows. Check `useIdentity()` (`@cratis/arc.react/identity`) for loading and sign-in state. Once the new credentials are active, call `arc.reconnectQueries?.()` on the `ArcContext` value read with `useContext` and wait for a fresh result before displaying rows.

## Related skills

- [Separate the view model](../cratis-arc-react-separate-view-model/SKILL.md) when presentation state belongs outside the component.
- [Theme the application](../cratis-components-theme-application/SKILL.md) to apply shared styles at the provider boundary.

- [Generate the TypeScript proxies](../cratis-arc-generate-proxies/SKILL.md)
- [Render the Library authors page](../cratis-components-display-list/SKILL.md)
