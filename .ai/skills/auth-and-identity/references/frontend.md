# Frontend Identity

This reference covers consuming identity in React, MVVM, and vanilla TypeScript.

## How the Frontend Gets Identity

The frontend uses a **cookie-first** approach:

1. Check for the `.cratis-identity` cookie (base64-encoded JSON, `HttpOnly=false`)
2. If cookie exists → decode and use it (no HTTP call needed)
3. If no cookie → call `GET /.cratis/me` to fetch identity and set the cookie
4. In development mode, the cookie fallback (`/.cratis/me` call) always works — no ingress simulation needed

## React

### IdentityProvider Context

`<Arc>` renders an `<IdentityProvider>` for you (forwarding its own `httpHeadersCallback`), so an app that mounts `<Arc>` needs no wrapper of its own to read identity:

```tsx
import { Arc } from '@cratis/arc.react';

export const App = () => (
    <Arc>
        {/* useIdentity() works anywhere in here */}
    </Arc>
);
```

`<Arc>` does not forward a `detailsType`, so for type-safe details with complex types (e.g., `Guid`) mount your own `<IdentityProvider>` **inside** `<Arc>` — the inner context wins for everything below it:

```tsx
import { Arc } from '@cratis/arc.react';
import { IdentityProvider } from '@cratis/arc.react/identity';
import { Guid } from '@cratis/fundamentals';

class UserIdentityDetails {
    userId: Guid = Guid.empty;
    firstName: string = '';
    lastName: string = '';
}

export const App = () => (
    <Arc>
        <IdentityProvider detailsType={UserIdentityDetails}>
            {/* your app */}
        </IdentityProvider>
    </Arc>
);
```

It has to be inside `<Arc>`: `IdentityProvider` reads `apiBasePath` and `origin` off `ArcContext`, and outside `<Arc>` both fall back to empty strings. Each provider fetches `/.cratis/me` on mount, so the nested one costs one extra request on first load.

`IdentityProviderProps` is exactly three props — `children`, `httpHeadersCallback`, and `detailsType`.

### `useIdentity()` Hook

Access identity anywhere in your component tree:

```tsx
import { useIdentity } from '@cratis/arc.react/identity';

type UserDetails = {
    department: string;
    title: string;
};

export const UserProfile = () => {
    const identity = useIdentity<UserDetails>();

    return (
        <div>
            <h3>{identity.name}</h3>
            <p>Department: {identity.details.department}</p>
        </div>
    );
};
```

**With default values** (useful for local development when the cookie might not exist):

```tsx
const identity = useIdentity<UserDetails>({
    department: '[N/A]',
    title: '[N/A]'
});
```

**With a details constructor** — always name the type argument explicitly:

```tsx
const identity = useIdentity<UserIdentityDetails>(UserIdentityDetails);

// With default values:
const identity = useIdentity<UserIdentityDetails>(UserIdentityDetails, {
    userId: Guid.empty,
    firstName: '[N/A]',
    lastName: '[N/A]'
});
```

`useIdentity` declares `(defaultDetails?)` **before** `(type, defaultDetails?)`, and a bare class reference satisfies the inferred `TDetails` of the first overload — so omitting the type argument silently binds the wrong overload and types `details` as `typeof UserIdentityDetails`. Nothing complains at the call; the error lands on the first property access (`Property 'firstName' does not exist on type 'typeof UserIdentityDetails'`).

The constructor argument only tells `useIdentity` that the second argument is the defaults. Type-safe deserialization (`JsonSerializer.deserializeFromInstance()`) comes from `detailsType` on `<IdentityProvider>`, not from this overload.

### Role Checking

```tsx
const identity = useIdentity();

if (identity.isInRole('Admin')) {
    // show admin UI
}

// Or access roles directly
console.log(identity.roles);
```

### Refreshing Identity

When identity changes on the backend (e.g., user granted new roles):

```tsx
const identity = useIdentity();
const handleRefresh = () => identity.refresh();
```

This calls `GET /.cratis/me` again and updates both the cookie and context.

### `IIdentityContext<TDetails>` Shape

`useIdentity()` returns `IIdentityContext<TDetails>` — the `IIdentity<TDetails>` members plus `clearIdentity`:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique ID from identity provider |
| `name` | `string` | Display name |
| `roles` | `string[]` | Assigned roles |
| `details` | `TDetails` | Application-specific details |
| `isSet` | `boolean` | Whether identity has been loaded |
| `isInRole(role)` | `(string) => boolean` | Check role membership |
| `refresh()` | `() => Promise<IIdentity>` | Re-fetch identity from backend |
| `clearIdentity()` | `() => void` | Drop the `.cratis-identity` cookie and reset the context — use on sign-out |

## MVVM (tsyringe)

In an MVVM setup, `IIdentityProvider` is automatically registered in the DI container by `Bindings.initialize()`:

```typescript
import { injectable } from 'tsyringe';
import { IIdentityProvider } from '@cratis/arc/identity';

type UserDetails = {
    department: string;
};

@injectable()
export class MyViewModel {
    constructor(private readonly _identityProvider: IIdentityProvider) {}

    async loadUser() {
        const identity = await this._identityProvider.getCurrent<UserDetails>();
        console.log(identity.details.department);
    }
}
```

Requires the [MVVM Context](../../cratis-react-page/references/mvvm.md) to be set up.

## Vanilla TypeScript (No Framework)

Use `IdentityProvider` directly:

```typescript
import { IdentityProvider } from '@cratis/arc/identity';

const identity = await IdentityProvider.getCurrent<UserDetails>();
console.log(identity.name);
console.log(identity.isInRole('Admin'));
```

## Frontend Role-Based UI Pattern

Combine `useIdentity()` with authorization attributes on the backend for defense in depth:

```tsx
const identity = useIdentity();

return (
    <div>
        {identity.isInRole('Admin') && <AdminPanel />}
        {identity.isInRole('Manager') && <ManagerDashboard />}
        <PublicContent />
    </div>
);
```

The frontend check is for UX (hiding buttons the user can't use). The backend `[Roles]` attribute is the actual security boundary.
