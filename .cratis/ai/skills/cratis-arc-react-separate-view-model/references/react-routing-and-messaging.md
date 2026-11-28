# Changing URL values and local messages

Use `handleProps`, `handleParams` and `handleQueryParams` to apply incoming values on mount and when they change. Constructor values are only the initial values. For URL conversion, supply a real class, with `@field`-decorated properties and emitted decorator metadata. With a route segment `:count`, the binding turns URL `"42"` into numeric `42`:

```ts
import { field } from '@cratis/fundamentals';
import { params, type IHandleParams } from '@cratis/arc.react.mvvm';
import { injectable } from 'tsyringe';

class RouteParams {
    @field count!: number;
}

@injectable()
export class AuthorListViewModel implements IHandleParams<RouteParams> {
    count: number;
    constructor(@params initial: RouteParams) { this.count = initial.count; }
    handleParams(next: RouteParams) { this.count = next.count; }
}
```

Use `@queryParams` with a typed class for query-string values. An inline interface or undecorated properties do not give the serializer the conversion metadata.

For list/detail selection, import `MessengerScope` from `@cratis/arc.react/messaging` and render both bound views inside the same scope. Components needing direct access use `useMessenger` from that same React entry point. View models inject `IMessenger` from `@cratis/arc.react.mvvm/messaging`, which re-exports the same token as `@cratis/arc/messaging`. `withViewModel` supplies the nearest scoped instance. Messages go down to children by default, not up; use `bubbleToParent` on the child scope only if the parent needs them. The list publishes `new AuthorSelected(id)` through its injected messenger; the detail subscribes and releases the subscription when detached:

```ts
import type { IViewModelDetached } from '@cratis/arc.react.mvvm';
import { IMessenger } from '@cratis/arc.react.mvvm/messaging';
import { inject, injectable } from 'tsyringe';

export class AuthorSelected {
    constructor(readonly id: string) {}
}

@injectable()
export class AuthorDetailsViewModel implements IViewModelDetached {
    authorId: string | undefined;
    private readonly unsubscribe: () => void;
    constructor(@inject(IMessenger) messenger: IMessenger) {
        const subscription = messenger.subscribe(AuthorSelected, message => { this.authorId = message.id; });
        this.unsubscribe = () => subscription.unsubscribe();
    }
    detached() { this.unsubscribe(); }
}
```
