---
name: cratis-arc-react-separate-view-model
description: Use when presentation state transitions or injected collaborators need testing independently of React. For simple local state, use cratis-arc-react-bind-slice.
compatibility: Requires @cratis/arc.react.mvvm, tsyringe, react-router-dom and reflect-metadata in an Arc React app.
---

# Filter authors with a bound view model

Keep simple presentation state in the view. Extract a view model when the search term and filtering decision need testing without React, or when presentation behavior needs an injected collaborator.

1. Set `compilerOptions.experimentalDecorators` to `true` in `tsconfig.json`. In [main.tsx](../cratis-arc-react-bind-slice/SKILL.md), import `reflect-metadata` first, `MVVM` from `@cratis/arc.react.mvvm` and `BrowserRouter` from `react-router-dom`. Keep the existing providers and wrap the application shell inside `Arc`: `<Arc><MVVM><BrowserRouter><App /></BrowserRouter></MVVM></Arc>`. In `App.tsx`, import `AuthorSearch` from `./Features/Authors/Listing/AuthorSearch` and render it on the search screen. The bound view reads the router; don't replace the shell or its dialog registration.
2. Put the search term and filter in `Features/Authors/Listing/AuthorSearchViewModel.ts`. `Author` and `AllAuthors` come from the slice's [generated proxy](../cratis-arc-generate-proxies/SKILL.md).

```ts
import { injectable } from 'tsyringe';
import type { Author } from '../../../generated/Features/Authors/Listing/Author';

@injectable()
export class AuthorSearchViewModel {
    search = '';
    setSearch(value: string) { this.search = value; }
    filter(authors: Author[]) {
        return authors.filter(author => author.name.toLowerCase().includes(this.search.toLowerCase()));
    }
}
```

3. In `Features/Authors/Listing/AuthorSearch.tsx`, call the generated query hook on each render and pass its current rows to the model. `withViewModel` creates and disposes the model.

```tsx
import { withViewModel } from '@cratis/arc.react.mvvm';
import { AllAuthors } from '../../../generated/Features/Authors/Listing/Author';
import { AuthorSearchViewModel } from './AuthorSearchViewModel';

export const AuthorSearch = withViewModel(AuthorSearchViewModel, ({ viewModel }) => {
    const [authors] = AllAuthors.use();
    if (!authors.isReady) return <p>Loading authors…</p>;
    if (!authors.isSuccess) return <p>Could not load authors.</p>;
    return <section>
        <label>Search authors<input value={viewModel.search}
            onChange={event => viewModel.setSearch(event.target.value)} /></label>
        <ul>{viewModel.filter(authors.data).map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>
    </section>;
});
```

Keep query loading and failure state in the bound view. Verify that changing the search text and receiving a new matching author both refresh the visible list.

For an injected service, register the actual service or implementation before mounting the view. For example, use `container.registerInstance(CatalogueToken, catalogue)` and declare `constructor(@inject(CatalogueToken) private readonly catalogue: Catalogue)` on the `@injectable()` view model, importing `container` and `inject` from `tsyringe`. Use the same token at both sites; `@inject` alone does not register anything.

## Avoid

- Don't construct a second model in `useState` or `new` one in the view.
- Don't call a query hook in the model. The bound view supplies fresh rows on every update.

## When it goes off the usual path

- **A child does not update after a model change:** pass plain values computed in the bound view, or wrap the child with `observer` from `@cratis/arc.react.mvvm` if it reads observable state directly.

## Related skills

- [Render a generated live query](../cratis-arc-react-bind-slice/SKILL.md)
