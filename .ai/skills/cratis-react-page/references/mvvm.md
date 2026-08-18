# MVVM — Reference

The Arc MVVM pattern keeps page logic in plain TypeScript classes (view models) and keeps components purely declarative.

## When to use MVVM

- Page has complex coordinated state (selected item, filters, multiple dialogs)
- Logic needs unit-testing independent of React
- You want to share state across child components via injection

For simple pages, MVVM is optional — use regular hooks directly in the component instead.

## Setup

Install packages if not already present:

```bash
npm install @cratis/arc.react.mvvm tsyringe reflect-metadata
```

Ensure `tsconfig.json` enables decorators:

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
}
```

Import `reflect-metadata` once, at the entry point of your app:

```tsx
import 'reflect-metadata';
```

## View model class

```ts
import { injectable } from 'tsyringe';

@injectable()
export class AccountsViewModel {
    selectedAccount?: AccountSummary = undefined;

    selectAccount(account: AccountSummary) {
        this.selectedAccount = account;
    }
}
```

- `@injectable()` — registers the class with tsyringe for DI
- **Never call `makeAutoObservable(this)` yourself.** `withViewModel` calls `makeAutoObservable(viewModel)` on the resolved instance for you. A constructor call runs first, so the framework's call becomes a second one — and MobX's development build throws `"makeAutoObservable can only be used on objects not already made observable"`. Production silently re-annotates. Either way it is wrong.
- **A view model must not have a superclass.** MobX rejects `makeAutoObservable` on a class with a base class, which is why Arc ships no view-model base class — only optional interfaces (`IHandleProps`, `IHandleParams`, `IHandleQueryParams`, `IViewModelDetached`), discovered by duck-typing.
- Child components that read view-model state must be wrapped in `observer` **imported from `@cratis/arc.react.mvvm`**, not from `mobx-react` directly.

## withViewModel

```tsx
import { withViewModel } from '@cratis/arc.react.mvvm';

export const AccountsPage = withViewModel(AccountsViewModel, ({ viewModel }) => {
    return (
        <DataPage
            title="Accounts"
            query={AllAccounts}
            emptyMessage="No accounts found."
            onSelectionChange={event => viewModel.selectAccount(event.value)}
            detailsComponent={AccountDetails}
        >
            <DataPage.Columns>
                <Column field="name" header="Name" />
            </DataPage.Columns>
        </DataPage>
    );
});
```

The view model instance is created once per mount and disposed on unmount. It is the same instance for the whole component tree under `withViewModel`.

## IHandleProps — reactive props

When a child component needs to receive a prop and react to its changes, implement `IHandleProps<T>`:

```ts
import { IHandleProps } from '@cratis/arc.react.mvvm';

interface DetailProps {
    account: AccountSummary;
}

@injectable()
export class AccountDetailViewModel implements IHandleProps<DetailProps> {
    account!: AccountSummary;

    handleProps(props: DetailProps): void {
        this.account = props.account;
    }
}
```

The method is **`handleProps(props)`** — there is no `propsChanged`. It is invoked once on mount, right after construction, and again on every subsequent props change (Arc compares deeply, so an unchanged object does not re-fire).

The sibling hooks follow the same naming: `IHandleParams<T>` → `handleParams(params)` (route params), `IHandleQueryParams<T>` → `handleQueryParams(queryParams)`, and `IViewModelDetached` → `detached()` on unmount. All are optional and discovered by duck-typing, so a view model implements only what it needs.

Props can also arrive through the constructor with the `@props` decorator:

```ts
import { props } from '@cratis/arc.react.mvvm';

@injectable()
export class AccountDetailViewModel {
    constructor(@props componentProps: DetailProps) { }
}
```

## Dependency injection in view models

Use tsyringe constructor injection. Cratis registers common singletons (e.g., `IEventStore`, query/command types):

```ts
@injectable()
export class AccountsViewModel {
    constructor(private readonly _accountsService: IAccountsService) { }
}
```

Note the empty constructor body — no `makeAutoObservable` call. Inject application services; commands and queries are used through their generated proxies, not injected.

## MVVM context

Wrap the app (or route root) in `<MVVM>` to enable the DI container:

```tsx
import { MVVM } from '@cratis/arc.react.mvvm';

<MVVM>
    <App />
</MVVM>
```

If you are using `<Arc>`, it already includes `<MVVM>` internally — do not double-wrap.
