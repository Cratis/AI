# DataPage — Reference

`DataPage` (from `@cratis/components/DataPage`) is the standard full-page layout: an action menubar, a query-backed data table, and an optional details pane, in one component.

It is **compound and declarative** — the table's columns and the toolbar's actions are *children*, not array props. There is no `columns`, `menuItems`, `detailPanel`, `onRowSelected`, `noDataMessage`, or `queryArgs` prop.

## Import

```tsx
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { Column } from 'primereact/column';   // columns are PrimeReact's
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | **Required.** Page title. |
| `children` | `ReactNode` | **Required.** `<DataPage.MenuItems>` and `<DataPage.Columns>`. |
| `query` | `Constructor<TQuery>` | **Required.** The proxy-generated query **class** (not an instance) — snapshot `IQueryFor` *or* observable `IObservableQueryFor`. `DataPage` inspects the prototype chain and mounts the right inner table. |
| `emptyMessage` | `string` | **Required.** Shown when the query returns no rows. |
| `queryArguments` | `TArguments` | Arguments forwarded to the query. |
| `detailsComponent` | `React.FC<IDetailsComponentProps<T>>` | Rendered in a right-hand split pane when a row is selected. |
| `dataKey` | `string` | Row identity field. |
| `selection` | `T` | Externally controlled selection. |
| `onSelectionChange` | `(event: DataTableSelectionSingleChangeEvent<T[]>) => void` | Fires after every selection change; read `event.value`. |
| `globalFilterFields` | `string[]` | Fields the global filter searches. |
| `defaultFilters` | `DataTableFilterMeta` | Seeds filter state on first render. |
| `clientFiltering` | `boolean` | Filter the fetched page in the browser instead of round-tripping. |
| `onRefresh` | `() => void` | Invoked when something asks the page to refetch. |
| `tableClassName` / `tablePt` / `tablePtOptions` / `tableUnstyled` | — | Pass-through to the inner PrimeReact `DataTable`. |
| `menubarClassName` / `menubarPt` / `menubarPtOptions` / `menubarUnstyled` | — | Pass-through to the action `Menubar`. |

One `query` prop takes either kind of query — there is no separate `observableQuery` prop.

## `<DataPage.MenuItems>` / `<DataPage.MenuItem>`

`MenuItem` extends PrimeReact's `MenuItem` (so `label`, `icon`, `command`, `disabled`, …) plus one Cratis flag:

| Prop | Description |
| --- | --- |
| `label` | Button text. **Menu items use `label`; command-form fields use `title`.** |
| `icon` | A React **component reference** (e.g. `mdIcons.MdAdd`), not a class string — `DataPage` renders it itself. |
| `command` | The click handler (PrimeReact's name for it — not `onClick`). |
| `disableOnUnselected` | When true, the item is disabled until a row is selected. |

```tsx
<DataPage.MenuItems>
    <MenuItem label="Add" icon={mdIcons.MdAdd} command={() => { void showAddDialog(); }} />
    <MenuItem label="Edit" icon={mdIcons.MdEdit} command={onEdit} disableOnUnselected />
</DataPage.MenuItems>
```

## `<DataPage.Columns>`

Children are plain PrimeReact `<Column>` elements — everything PrimeReact supports (`field`, `header`, `body`, `align`, `sortable`, filters) works unchanged.

```tsx
<DataPage.Columns>
    <Column field="name" header="Name" sortable />
    <Column header="Balance" body={(row: Account) => `$${row.balance.toFixed(2)}`} />
</DataPage.Columns>
```

## Details pane — `detailsComponent`

Pass a **component**, not a render function. It receives `{ item, onRefresh }` (`IDetailsComponentProps<T>`) and appears in a split pane when a row is selected.

```tsx
const AccountDetails = ({ item }: IDetailsComponentProps<Account>) => <AccountPanel account={item} />;

<DataPage … detailsComponent={AccountDetails} />
```

## Height — `DataPage` needs a bounded ancestor

`DataPage` fills the height it is given and divides it between the action bar and the table, so the paginator sits at the bottom of the page rather than below its edge. It cannot invent that height — **some ancestor must have a definite height** (the router outlet, a sized container, or a flex child with `min-height`). Without one it falls back to a small fixed height instead of collapsing.

## Full example

```tsx
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { Column } from 'primereact/column';
import { useDialog } from '@cratis/arc.react/dialogs';
import { AllAccounts } from './Accounts';
import { CreateAccountDialog } from './CreateAccountDialog';

export const AccountsPage = () => {
    const [CreateAccountWrapper, showCreateAccount] = useDialog(CreateAccountDialog);
    const [selected, setSelected] = useState<Account | undefined>();

    return (
        <>
            <DataPage
                title="Accounts"
                query={AllAccounts}
                emptyMessage="No accounts found."
                dataKey="id"
                onSelectionChange={event => setSelected(event.value)}
            >
                <DataPage.MenuItems>
                    <MenuItem
                        label="Create Account"
                        icon={mdIcons.MdAdd}
                        disableOnUnselected={false}
                        command={() => { void showCreateAccount(); }}
                    />
                </DataPage.MenuItems>
                <DataPage.Columns>
                    <Column field="name" header="Account" />
                    <Column field="ownerName" header="Owner" />
                    <Column header="Balance" body={(r: Account) => `$${r.balance.toFixed(2)}`} />
                </DataPage.Columns>
            </DataPage>
            <CreateAccountWrapper />
        </>
    );
};
```

`CreateAccountDialog` is a separate component rendering a `CommandDialog`. See `dialogs.md` for the full dialog pattern.
