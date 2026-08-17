# Data Tables — Reference

Use a standalone data table when you need a table without `DataPage`'s full-page chrome (embedded in a panel or card). Both components are what `DataPage` mounts internally, so their prop surface is the same shape.

Like `DataPage`, they are **declarative**: columns are PrimeReact `<Column>` **children**, not a `columns` array. There is no `columns`, `onRowSelected`, `selectedRow`, `noDataMessage`, or `queryArgs` prop.

## DataTableForQuery — snapshot query

```tsx
import { DataTableForQuery } from '@cratis/components/DataTables';
import { Column } from 'primereact/column';
import { AllAccounts } from './Accounts';

<DataTableForQuery
    query={AllAccounts}
    emptyMessage="No accounts found."
    dataKey="id"
    selection={selected}
    onSelectionChange={event => setSelected(event.value)}
>
    <Column field="name" header="Name" />
    <Column field="balance" header="Balance" />
</DataTableForQuery>
```

Bound to `IQueryFor<TDataType, TArguments>` via `useQueryWithPaging`. Runs in PrimeReact's `lazy` mode, so the server returns one page at a time and the paginator fetches the next.

## DataTableForObservableQuery — real-time push

```tsx
import { DataTableForObservableQuery } from '@cratis/components/DataTables';

<DataTableForObservableQuery
    query={ObserveAllAccounts}
    emptyMessage="No accounts found."
    onSelectionChange={event => setSelected(event.value)}
>
    <Column field="name" header="Name" />
</DataTableForObservableQuery>
```

Bound to `IObservableQueryFor<TDataType, TArguments>` via `useObservableQueryWithPaging`; re-renders whenever the read model changes server-side.

## Shared props

| Prop | Type | Description |
| --- | --- | --- |
| `query` | `Constructor<TQuery>` | **Required.** The proxy-generated query **class**. |
| `emptyMessage` | `string` | **Required.** Shown when there are no rows. |
| `children` | `ReactNode` | PrimeReact `<Column>` elements. |
| `queryArguments` | `TArguments` | Arguments forwarded to the query. |
| `dataKey` | `string` | Row identity field. |
| `selection` | `TDataType` | Current selection. |
| `onSelectionChange` | `(event: DataTableSelectionSingleChangeEvent<TDataType[]>) => void` | Selection callback; the row is `event.value`. |
| `globalFilterFields` | `string[]` | Fields the global filter searches. |
| `defaultFilters` | `DataTableFilterMeta` | Seeds filter state on first render. |
| `clientFiltering` | `boolean` | Filter the fetched page in the browser. |
| `className` / `pt` / `ptOptions` / `unstyled` | — | Pass-through to the PrimeReact `DataTable`. |
| `paginatorPt` / `paginatorPtOptions` / `paginatorUnstyled` | — | Pass-through to the inner `Paginator`. |

## Which component

| Situation | Component |
| --- | --- |
| Full page with toolbar and optional details pane | `DataPage` (it picks the right table for you) |
| Embedded table, snapshot query | `DataTableForQuery` |
| Embedded table, observable query | `DataTableForObservableQuery` |
| Inline data with no query | Plain PrimeReact `DataTable` |

Inside `DataPage` you never choose: it reads the prototype chain (`query.prototype instanceof QueryFor`) and mounts the matching one.
